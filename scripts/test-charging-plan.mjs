// Run: node scripts/test-charging-plan.mjs
// Regression for FEATURES.md #2: a calculated force-charge plan must stop on its
// own, also when the price never rises (flat fixed-tariff nights).
// 1. Engine - shared test vectors; the iOS self-check runs the same ones against
//    Domain/ChargingApi.swift. Times are relative to "now", so no fake clock.
// 2. UI (browser, stubbed endpoints - never touches Supabase or the wallbox):
//    calculator -> saved window -> caption -> manual toggle clears it.
// Requires Playwright Chromium (`pnpm exec playwright install chromium`) or local Chrome.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import moment from 'moment';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// Vercel runs functions in UTC; hooks.server.ts must move local time to Vienna.
process.env.TZ = 'UTC';

// Settings.svelte needs a drawer around it (Drawer.Close) - generated, gitignored
const qaDir = '.svelte-kit/qa';
mkdirSync(qaDir, { recursive: true });
writeFileSync(
	`${qaDir}/SettingsHarness.svelte`,
	`<script>
	import * as Drawer from '$lib/components/ui/drawer/index';
	import Settings from '/src/components/system/Settings.svelte';
	let { userSettings } = $props();
</script>

<Drawer.Root open={true}>
	<Drawer.Content><Settings {userSettings} saved={() => {}} /></Drawer.Content>
</Drawer.Root>
`
);

const uiHarness = `
	<div id="app"></div>
	<script type="module">
		import { mount } from 'svelte';
		import { Db } from '/src/lib/classes/db.ts';
		import SettingsHarness from '/${qaDir}/SettingsHarness.svelte';
		import ChargingOverview from '/src/components/charging/ChargingOverview.svelte';

		// a plan for tonight 23:00 - 01:00 (browser local time)
		const from = new Date();
		from.setHours(23, 0, 0, 0);
		const until = new Date(from.getTime() + 2 * 3600 * 1000);
		const plan = {
			status: 'suggestion', suggestedPriceToSet: 14, suggestedKwToSet: 8.1, hoursCharging: 2,
			estimatedPrice: 2.25, chargingFrom: from.toISOString(), chargingUntil: until.toISOString()
		};
		const params = new URLSearchParams(location.search);
		const row = {
			email: 'qa@example.invalid', solarManIsOn: true, solarManAppEmail: 'qa@example.invalid',
			goEIsOn: true, useAwattar: true, priceProvider: 'fixed',
			forceChargeIsOn: false, forceChargeKw: 5, forceChargeUnderCent: 10
		};
		if (params.has('applied'))
			Object.assign(row, {
				forceChargeIsOn: true, forceChargeKw: 8.1, forceChargeUnderCent: 14,
				forceChargeFrom: plan.chargingFrom, forceChargeUntil: plan.chargingUntil
			});
		const settings = Db.mapFromDb(row);

		window.qa = { saves: [], plan };
		window.fetch = async (input, init) => {
			const url = String(input instanceof Request ? input.url : input);
			const reply = (body) =>
				new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
			if (url.startsWith('/api/save_settings')) {
				window.qa.saves.push(JSON.parse(init.body));
				return reply(true);
			}
			if (url.startsWith('/api/calculation')) return reply(plan);
			if (url.startsWith('/api/charging'))
				return reply({
					kw: 0, carStatus: 'waiting', userSettings: settings,
					suggestion: { allDataAvailable: true, currentChargingReason: '', suggestedKw: -1 }
				});
			return new Response('{}', { status: 404 });
		};
		const overview = params.get('part') === 'overview';
		mount(overview ? ChargingOverview : SettingsHarness, {
			target: document.querySelector('#app'),
			props: overview ? {} : { userSettings: settings }
		});
	</script>`;

const server = await createServer({
	server: { port: 0 },
	logLevel: 'error',
	plugins: [
		{
			// Settings.svelte reads the Auth.js session from $app/stores; outside a
			// SvelteKit app that store has no context
			name: 'qa-app-stores',
			enforce: 'pre',
			resolveId(id, importer) {
				if (importer?.endsWith('/Settings.svelte') && id.includes('app/stores'))
					return '\0qa-app-stores';
			},
			load(id) {
				if (id === '\0qa-app-stores')
					return `import { readable } from 'svelte/store';
						export const page = readable({ data: { session: { user: { email: 'qa@example.invalid' } } } });`;
			}
		},
		{
			name: 'charge-plan-ui-harness',
			configureServer(vite) {
				vite.middlewares.use(async (req, res, next) => {
					if (req.url.split('?')[0] !== '/__charge-plan-ui') return next();
					res.setHeader('Content-Type', 'text/html');
					res.end(await vite.transformIndexHtml(req.url, uiHarness));
				});
			}
		}
	]
});

let failed = false;
const check = (name, fn) => {
	try {
		fn();
		console.log(`PASS: ${name}`);
	} catch (e) {
		failed = true;
		console.log(`FAIL: ${name}: ${e.message.replace(/\s+/g, ' ')}`);
	}
};
// the engine logs every calculation - keep the report readable
const quiet = async (fn) => {
	const log = console.log;
	console.log = () => {};
	try {
		return await fn();
	} finally {
		console.log = log;
	}
};

let browser;
try {
	await server.listen();
	const charging = await server.ssrLoadModule('/src/lib/classes/charging.ts');
	const { Db } = await server.ssrLoadModule('/src/lib/classes/db.ts');
	const { PriceApi } = await server.ssrLoadModule('/src/lib/classes/priceApi.ts');
	const { ChargingApi, isInForceChargeWindow } = charging;

	const allMonths = '1,2,3,4,5,6,7,8,9,10,11,12';
	/** One rule per hour of day; priceForHour returning undefined = no rule. */
	const tariffJson = (priceForHour, title = 'qa') =>
		JSON.stringify({
			title,
			ranges: [
				{
					validFrom: '2020-01-01',
					prices: Array.from({ length: 24 }, (_, hour) => ({ hour, price: priceForHour(hour) }))
						.filter((rule) => rule.price !== undefined)
						.map(({ hour, price }) => ({ months: allMonths, hours: String(hour), price }))
				}
			]
		});
	const settingsFor = (row) =>
		Db.mapFromDb({ email: 'qa@example.invalid', useAwattar: true, priceProvider: 'fixed', ...row });

	const h = moment().hour();
	const at = (offsetHours) => moment().startOf('hour').add(offsetHours, 'hours').toISOString();
	const iso = (value) => (value ? moment(value).toISOString() : value);
	const calculate = (row) =>
		quiet(() => new ChargingApi(settingsFor(row)).getCalculationSuggestion());
	const summary = (r) => [
		r.status,
		r.hoursCharging,
		r.suggestedKwToSet,
		r.suggestedPriceToSet,
		r.estimatedPrice
	];

	// V1 - the reported bug: flat 13.9 all night, 54 kWh battery 40 -> 70 %
	const v1 = await calculate({
		fixedPriceData: tariffJson(() => 13.9),
		carBatteryKwh: 54,
		carBatteryCurrentPercent: 40,
		carBatteryTargetPercent: 70,
		carBatteryTargetHour: (h + 8) % 24
	});
	check('V1 flat night: 2 h at 8.1 kW, threshold 14.0, 2.25 €', () =>
		assert.deepEqual(summary(v1), ['suggestion', 2, 8.1, 14, 2.25])
	);
	check('V1 flat night: plan window = the next 2 full hours', () =>
		assert.deepEqual([iso(v1.chargingFrom), iso(v1.chargingUntil)], [at(1), at(3)])
	);

	// V2 - distinct prices: the two cheapest hours are not adjacent
	const v2Prices = { 0: 5, 1: 20, 2: 10, 3: 30, 4: 10, 5: 25, 6: 12, 7: 40 };
	const v2 = await calculate({
		fixedPriceData: tariffJson((hour) => v2Prices[(hour - h + 24) % 24]),
		carBatteryKwh: 100,
		carBatteryCurrentPercent: 40,
		carBatteryTargetPercent: 58,
		carBatteryTargetHour: (h + 8) % 24
	});
	check('V2 cheapest hours: 2 h at 9 kW, threshold 10.1, 1.8 €', () =>
		assert.deepEqual(summary(v2), ['suggestion', 2, 9, 10.1, 1.8])
	);
	check('V2 window spans the two cheapest hours (+2 .. +5)', () =>
		assert.deepEqual([iso(v2.chargingFrom), iso(v2.chargingUntil)], [at(2), at(5)])
	);

	// V3 - target unreachable: 90 kWh needed, 7 h x 9 kW = 63 kWh possible
	const v3 = await calculate({
		fixedPriceData: tariffJson(() => 13.9),
		carBatteryKwh: 100,
		carBatteryCurrentPercent: 10,
		carBatteryTargetPercent: 100,
		carBatteryTargetHour: (h + 8) % 24
	});
	check('V3 unreachable target: all 7 h at 9 kW (was an all-zero result)', () =>
		assert.deepEqual(summary(v3), ['suggestion', 7, 9, 14, 8.76])
	);
	check('V3 window = all remaining hours (+1 .. +8)', () =>
		assert.deepEqual([iso(v3.chargingFrom), iso(v3.chargingUntil)], [at(1), at(8)])
	);

	// V4 - engine: force charging only inside the plan window
	const engineSettings = (window) => {
		const settings = settingsFor({
			fixedPriceData: tariffJson(() => 13.9),
			forceChargeIsOn: true,
			forceChargeKw: 8.1,
			forceChargeUnderCent: 14,
			chargeWithExcessIsOn: false,
			chargeUntilMinBattery: 100,
			pauseCharging: false
		});
		if (window) [settings.forceChargeFrom, settings.forceChargeUntil] = window;
		return settings;
	};
	const status = (kw) => ({
		gotInverterData: true,
		inverterTimestamp: new Date(),
		powerProduction: 0,
		powerUsage: kw + 0.5,
		batterySoc: 50,
		gotWallBoxData: true,
		kw,
		carStatus: 'charging',
		currentPrice: 13.9
	});
	const hoursFromNow = (hours) => moment().add(hours, 'hours').toDate();
	const suggest = (window, kw) =>
		new ChargingApi(engineSettings(window)).calculateChargingSuggestion(status(kw)).suggestedKw;
	check('V4a no window (manual force charging) still charges', () =>
		assert.equal(suggest(undefined, 0), 8.1)
	);
	check('V4b inside the plan window: charge', () =>
		assert.equal(suggest([hoursFromNow(-1), hoursFromNow(1)], 0), 8.1)
	);
	check('V4c before the plan window: stop', () =>
		assert.equal(suggest([hoursFromNow(1), hoursFromNow(2)], 8), 0)
	);
	check('V4d after the plan window: stop although 13.9 < 14 (the reported bug)', () =>
		assert.equal(suggest([hoursFromNow(-2), hoursFromNow(-1)], 8), 0)
	);
	check('isInForceChargeWindow: half-open window, unset bounds = unlimited', () => {
		assert.equal(typeof isInForceChargeWindow, 'function', 'isInForceChargeWindow is missing');
		const settings = engineSettings();
		assert.equal(isInForceChargeWindow(settings), true);
		settings.forceChargeUntil = moment().subtract(1, 'ms').toDate();
		assert.equal(isInForceChargeWindow(settings), false);
		settings.forceChargeUntil = undefined;
		settings.forceChargeFrom = moment().add(1, 'minute').toDate();
		assert.equal(isInForceChargeWindow(settings), false);
	});

	// V6 (web only) - server timezone: price = hour of day reveals the clock in use
	const viennaHour = Number(
		new Intl.DateTimeFormat('en-GB', {
			hour: '2-digit',
			hourCycle: 'h23',
			timeZone: 'Europe/Vienna'
		}).format(new Date())
	);
	const hourly = settingsFor({ fixedPriceData: tariffJson((hour) => hour) });
	const utcPrice = await PriceApi.getCurrentPrice(hourly);
	await server.ssrLoadModule('/src/hooks.server.ts');
	const serverPrice = await PriceApi.getCurrentPrice(hourly);
	check(
		`V6 server uses Vienna local time (UTC clock gave ${utcPrice}, Vienna is ${viennaHour})`,
		() => assert.equal(serverPrice, viennaHour)
	);

	// UI - stubbed endpoints only
	const base = `http://localhost:${server.httpServer.address().port}/__charge-plan-ui`;
	browser = await chromium.launch(
		existsSync('/Applications/Google Chrome.app') ? { channel: 'chrome' } : {}
	);
	const open = async (query) => {
		const page = await browser.newPage();
		page.on('pageerror', (error) => console.error(error.stack));
		page.setDefaultTimeout(10000);
		await page.goto(`${base}?${query}`);
		return page;
	};

	{
		const page = await open('part=settings');
		await page.getByRole('tab', { name: 'Calculator' }).click();
		await page.getByRole('button', { name: 'CALCULATE', exact: true }).click();
		const row = page.getByText('Charging window:');
		await row.waitFor();
		const windowText = await row.locator('xpath=following-sibling::div[1]').innerText();
		check('calculator result shows the plan window', () =>
			assert.equal(windowText.trim(), '23:00 – 01:00')
		);
		// Drawer.Close renders its own <button> around <Button>: click the inner one
		await page.getByRole('button', { name: 'Use as force charging parameters' }).last().click();
		await page.waitForFunction(() => window.qa.saves.length >= 2);
		const { save, plan } = await page.evaluate(() => ({
			save: window.qa.saves.at(-1),
			plan: window.qa.plan
		}));
		check('applying the plan saves force charging on together with its window', () =>
			assert.deepEqual(
				[
					save.forceChargeIsOn,
					save.forceChargeKw,
					save.forceChargeUnderCent,
					save.forceChargeFrom,
					save.forceChargeUntil
				],
				[true, 8.1, 14, plan.chargingFrom, plan.chargingUntil]
			)
		);
		await page.close();
	}

	{
		const page = await open('part=settings&applied');
		const caption = page.getByText('Calculated plan:');
		await caption.waitFor();
		const captionText = (await caption.innerText()).replace(/\s+/g, ' ').trim();
		check('force-charge settings show the plan caption', () =>
			assert.equal(captionText, 'Calculated plan: 23:00 – 01:00, then off')
		);
		const forceSwitch = page.locator('label:has-text("Activate Force Charging") + button');
		await forceSwitch.click(); // off
		await forceSwitch.click(); // on again = manual force charging
		const captionLeft = await page.getByText('Calculated plan:').count();
		await page.getByRole('button', { name: 'SAVE' }).last().click();
		await page.waitForFunction(() => window.qa.saves.length >= 1);
		const save = await page.evaluate(() => window.qa.saves.at(-1));
		check('a manual toggle drops the plan window (manual force charging is unlimited)', () =>
			assert.deepEqual(
				[
					captionLeft,
					save.forceChargeIsOn,
					save.forceChargeFrom ?? null,
					save.forceChargeUntil ?? null
				],
				[0, true, null, null]
			)
		);
		await page.close();
	}

	{
		const page = await open('part=overview&applied');
		await page.getByText('Force charging enabled').waitFor();
		const text = (await page.locator('#app').innerText()).replace(/\s+/g, ' ');
		check('dashboard status line shows the plan window', () =>
			assert.ok(text.includes('(8.1 kw, price < 14 cent, 23:00–01:00)'), text)
		);
		await page.close();
	}
} finally {
	await browser?.close();
	await server.close();
	rmSync(qaDir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);

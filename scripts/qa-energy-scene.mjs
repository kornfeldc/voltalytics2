// Run: node scripts/qa-energy-scene.mjs [outDir]
// Visual QA for FEATURES.md #3 (3D house view, web): mounts the /v layout +
// dashboard with mocked API and weather responses (fixtures = iOS
// MockData.swift) and saves screenshots for the stacked (phone/tablet), split
// (desktop) and toggle-off (unchanged dashboard) cases, plus night, weather
// and settings variants. Checks the layout chrome along the way. Requires
// Playwright Chromium or local Chrome (WebGL may run in software: slow).
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const outDir = process.argv[2] ?? '/tmp/voltalytics-scene-qa';
mkdirSync(outDir, { recursive: true });

const harness = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</head>
<body>
	<div id="app"></div>
	<script type="module">
		import { mount } from 'svelte';
		import Harness from '/scripts/qa/SceneHarness.svelte';
		import { Db } from '/src/lib/classes/db.ts';

		const params = new URLSearchParams(location.search);
		const night = params.get('state') === 'night';

		// day curves = iOS Components/MockData.swift
		const trapezoid = (h, a, b) => (h < a || h > b ? 0 : Math.min(1, Math.min(h - a, b - h) / 0.75));
		const clamp = (v) => Math.max(0, Math.min(1, v));
		const frame = (timestamp, h) => {
			const production = 6.2 * Math.max(0, Math.sin((Math.PI * (h - 6)) / 14));
			const usage = 0.35 + 1.6 * trapezoid(h, 6.5, 9) + 2.4 * trapezoid(h, 17, 21.5);
			const toBattery = 1.0 * trapezoid(h, 11, 16);
			const fromBattery = 1.4 * trapezoid(h, 18.5, 21.5);
			const surplus = production - usage - toBattery + fromBattery;
			return {
				timestamp,
				powerProduction: production,
				powerUsage: usage,
				powerToBattery: toBattery,
				powerFromBattery: fromBattery,
				powerToGrid: Math.max(0, surplus),
				powerFromGrid: Math.min(0, surplus),
				batterySoc: 55 + 33 * clamp((h - 11) / 5) - 20 * clamp((h - 18.5) / 3)
			};
		};
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const steps = Math.min(288, Math.floor((Date.now() - start.getTime()) / 300000) + 1);
		const timeFrame = Array.from({ length: steps }, (_, step) =>
			frame(new Date(start.getTime() + step * 300000).toISOString(), step / 12)
		);
		const keys = ['powerFromGrid', 'powerToGrid', 'powerToBattery', 'powerFromBattery', 'powerProduction', 'powerUsage'];
		const statistic = (range) => {
			const factor = range === 'day' ? 1 : range === 'month' ? 30 : 365;
			return Object.fromEntries(
				keys.map((key) => [key, timeFrame.reduce((total, f) => total + (f[key] ?? 0), 0) * (5 / 60) * factor])
			);
		};
		// day: PV covers home + battery + export, the Model Y charges from excess;
		// night: battery covers the home, the car force-charges from the grid
		const realTime = night
			? { timestamp: new Date().toISOString(), batterySoc: 61, powerProduction: 0, powerUsage: 0.9,
				powerToBattery: 0, powerFromBattery: -0.9, powerToGrid: 0, powerFromGrid: -3.7 }
			: { timestamp: new Date().toISOString(), batterySoc: 74, powerProduction: 4.6, powerUsage: 1.7,
				powerToBattery: 1.0, powerFromBattery: 0, powerToGrid: 1.9, powerFromGrid: 0 };
		const weather = night
			? { temperature_2m: 8.4, weather_code: 0, cloud_cover: 5, precipitation: 0, snowfall: 0, snow_depth: 0, wind_speed_10m: 6, is_day: 0 }
			: { temperature_2m: 14.2, weather_code: 1, cloud_cover: 20, precipitation: 0, snowfall: 0, snow_depth: 0, wind_speed_10m: 9, is_day: 1 };

		const allMonths = '1,2,3,4,5,6,7,8,9,10,11,12';
		const tariff = {
			title: 'qa',
			ranges: [{ validFrom: '2020-01-01', prices: [{ months: allMonths, hours: Array.from({ length: 24 }, (_, h) => h).join(','), price: 13.9 }] }]
		};
		const settings = Db.mapFromDb({
			email: 'qa@example.invalid',
			solarManIsOn: true,
			goEIsOn: true,
			useAwattar: true,
			priceProvider: 'fixed',
			fixedPriceData: JSON.stringify(tariff),
			chargeWithExcessIsOn: true,
			chargeUntilMinBattery: 80,
			forceChargeIsOn: true,
			forceChargeUnderCent: 15,
			forceChargeKw: 3.7
		});
		const chargingInfo = {
			gotInverterData: true,
			inverterTimestamp: new Date().toISOString(),
			powerProduction: realTime.powerProduction,
			powerUsage: realTime.powerUsage,
			batterySoc: realTime.batterySoc,
			gotWallBoxData: true,
			kw: night ? 3.7 : 4.6,
			ampere: night ? 16 : 7,
			phase: 1,
			chargingAllowed: true,
			carStatus: 'charging',
			currentPrice: 13.9,
			userSettings: settings,
			suggestion: {
				allDataAvailable: true,
				currentChargingReason: night ? 'force' : 'excess',
				suggestedKw: night ? 3.7 : 4.8
			}
		};

		const realFetch = window.fetch.bind(window);
		window.qa = { requests: [] };
		window.fetch = async (input, init) => {
			const url = new URL(String(input instanceof Request ? input.url : input), location.href);
			const json = (body) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
			if (url.hostname === 'api.open-meteo.com') {
				window.qa.requests.push('open-meteo');
				return json({ current: weather });
			}
			if (url.hostname === 'nominatim.openstreetmap.org') {
				window.qa.requests.push('nominatim');
				return json([{ lat: '48.2082', lon: '16.3738', name: 'Wien', address: { city: 'Wien' } }]);
			}
			if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, init);
			window.qa.requests.push(url.pathname);
			switch (url.pathname) {
				case '/api/inverter/realtime':
					return json({ realTimeData: realTime });
				case '/api/inverter/timeframe':
					return json(timeFrame);
				case '/api/inverter/statistics':
					return json([statistic(url.searchParams.get('range'))]);
				case '/api/charging':
					return json(chargingInfo);
				default:
					return json({});
			}
		};

		mount(Harness, {
			target: document.querySelector('#app'),
			props: { data: { userSettings: Promise.resolve(settings) } }
		});
	</script>
</body>
</html>`;

const server = await createServer({
	// SvelteKit limits served files to src/ etc.; the harness wrapper lives in scripts/qa
	server: { port: 0, fs: { allow: ['scripts/qa'] } },
	plugins: [
		{
			name: 'energy-scene-harness',
			configureServer(vite) {
				vite.middlewares.use(async (req, res, next) => {
					if (req.url.split('?')[0] !== '/__energy-scene') return next();
					res.setHeader('Content-Type', 'text/html');
					res.end(await vite.transformIndexHtml(req.url, harness));
				});
			}
		}
	]
});

const phone = {
	viewport: { width: 393, height: 852 },
	deviceScaleFactor: 3,
	isMobile: true,
	hasTouch: true
};
const iphone17 = {
	viewport: { width: 402, height: 874 },
	deviceScaleFactor: 3,
	isMobile: true,
	hasTouch: true
};
const tablet = {
	viewport: { width: 820, height: 1180 },
	deviceScaleFactor: 2,
	isMobile: true,
	hasTouch: true
};
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };

const cases = [
	{ name: 'phone-stacked-day', device: phone, query: 'qaHour=13.5', fullPage: true },
	{ name: 'phone-stacked-scrolled', device: phone, query: 'qaHour=13.5', scroll: 600 },
	{ name: 'phone-stacked-night', device: phone, query: 'state=night&qaHour=21' },
	{ name: 'phone-off', device: phone, scene: false, fullPage: true },
	{ name: 'tablet-stacked', device: tablet, query: 'qaHour=10' },
	{ name: 'desktop-split-day', device: desktop, query: 'qaHour=13.5' },
	{ name: 'desktop-split-night', device: desktop, query: 'state=night&qaHour=21' },
	{ name: 'desktop-split-rain', device: desktop, query: 'qaHour=11&qaWeather=rain&qaTemp=9' },
	{ name: 'desktop-split-snow', device: desktop, query: 'qaHour=12&qaWeather=snow&qaTemp=-2' },
	{ name: 'desktop-off', device: desktop, scene: false },
	// fresh browser, nothing in localStorage: the 3D view is off by default
	{ name: 'desktop-default', device: desktop, scene: false, fresh: true },
	{ name: 'desktop-settings', device: desktop, query: 'qaHour=13.5', settings: true },
	// side by side with the iOS simulator (iPhone 17, -voltalytics-qa-hour 13.5
	// -voltalytics-qa-weather partly -voltalytics-qa-temp 14)
	{ name: 'iphone17-parity', device: iphone17, query: 'qaHour=13.5&qaWeather=partly&qaTemp=14' },
	{ name: 'iphone17-parity-night', device: iphone17, query: 'qaHour=21&qaWeather=clear&qaTemp=8' },
	{ name: 'iphone17-parity-snow', device: iphone17, query: 'qaHour=12&qaWeather=snow&qaTemp=-2' }
];
const only = process.env.QA_ONLY?.split(',');

let browser;
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

try {
	await server.listen();
	const base = `http://localhost:${server.httpServer.address().port}/__energy-scene`;
	browser = await chromium.launch({
		...(existsSync('/Applications/Google Chrome.app') ? { channel: 'chrome' } : {}),
		args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
	});

	if (!only || only.includes('settings-controls')) {
		// Settings: address → Nominatim + weather chip; switch off → classic dashboard
		const context = await browser.newContext({ ...desktop, colorScheme: 'dark' });
		await context.addInitScript(() => {
			localStorage.setItem('voltalytics_sceneEnabled', 'true');
			localStorage.setItem('voltalytics_weatherAddress', '');
		});
		const page = await context.newPage();
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.setDefaultTimeout(90_000);
		await page.goto(`${base}?qaHour=13.5`);
		await page.locator('.hero[data-scene-ready="true"]').waitFor();
		await page.locator('header button').last().click();
		await page.getByPlaceholder('Address (default: Eisenstadt)').fill('Stephansplatz 1, Wien');
		await page
			.locator('.weather-caption', { hasText: 'Wien' })
			.waitFor({ timeout: 10_000 })
			.catch(() => undefined);
		const afterAddress = await page.evaluate(() => ({
			chip: document.querySelector('.weather-caption')?.textContent,
			geocoding: window.qa.requests.filter((r) => r === 'nominatim').length,
			stored: localStorage.getItem('voltalytics_weatherAddress'),
			cachedPlaces: Object.keys(localStorage).filter((k) =>
				k.startsWith('voltalytics_weatherPlace_')
			).length
		}));
		await page.locator('label:has-text("3D house view") + button[role="switch"]').click();
		await page.waitForTimeout(1000);
		const afterToggle = await page.evaluate(() => ({
			heroes: document.querySelectorAll('.hero').length,
			stored: localStorage.getItem('voltalytics_sceneEnabled')
		}));
		await page.screenshot({ path: `${outDir}/settings-controls.png`, animations: 'disabled' });
		console.log(`settings-controls: ${JSON.stringify({ afterAddress, afterToggle })}`);
		check('settings: address is geocoded once (debounced) and the chip follows it', () => {
			assert.equal(afterAddress.geocoding, 1);
			assert.match(afterAddress.chip ?? '', /Wien/);
			assert.equal(afterAddress.stored, 'Stephansplatz 1, Wien');
			assert.equal(afterAddress.cachedPlaces, 1);
		});
		check('settings: switching the 3D view off restores the classic dashboard', () => {
			assert.equal(afterToggle.heroes, 0);
			assert.equal(afterToggle.stored, 'false');
		});
		check('settings: no page errors', () => assert.deepEqual(errors, []));
		await context.close();
	}

	if (!only || only.includes('drawer-scroll')) {
		// Settings drawer on a phone (taller than the screen): it must fit the
		// viewport and scroll; dragging down inside scrolled content scrolls back
		// instead of dismissing the sheet (vaul only dismisses at scroll top).
		const context = await browser.newContext({ ...phone, colorScheme: 'dark' });
		const page = await context.newPage();
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.setDefaultTimeout(90_000);
		await page.goto(base);
		await page.getByText('13,90').first().waitFor();
		await page.locator('header button').last().click();
		await page.getByText('Price provider').waitFor();
		await page.waitForTimeout(900); // vaul ignores drags for 500 ms after opening
		const drawer = () =>
			page.evaluate(() => {
				const content = document.querySelector('[data-vaul-drawer]');
				const rect = content?.getBoundingClientRect();
				const scroller = [...(content?.querySelectorAll('*') ?? [])].find(
					(el) =>
						/(auto|scroll)/.test(getComputedStyle(el).overflowY) &&
						el.scrollHeight > el.clientHeight
				);
				return {
					open: !!rect && rect.height > 0 && rect.top < innerHeight - 40,
					top: Math.round(rect?.top ?? -1),
					scrollTop: scroller?.scrollTop ?? null
				};
			});
		const opened = await drawer();
		const focused = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80));
		// real touch swipes (CDP), like scrolling the sheet on a phone
		const cdp = await context.newCDPSession(page);
		const swipe = async (fromY, toY) => {
			await cdp.send('Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [{ x: 196, y: fromY }]
			});
			for (let step = 1; step <= 12; step++) {
				const y = fromY + ((toY - fromY) * step) / 12;
				await cdp.send('Input.dispatchTouchEvent', {
					type: 'touchMove',
					touchPoints: [{ x: 196, y }]
				});
				await page.waitForTimeout(16);
			}
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
			await page.waitForTimeout(900);
		};
		await swipe(700, 300); // finger up: content scrolls down
		const scrolled = await drawer();
		await swipe(300, 520); // finger down while scrolled: content scrolls back, sheet stays
		const dragged = await drawer();
		await page.screenshot({ path: `${outDir}/drawer-scroll.png`, animations: 'disabled' });
		console.log(`drawer-scroll: ${JSON.stringify({ opened, focused, scrolled, dragged })}`);
		check('drawer: fits the screen (its top is reachable)', () => assert.ok(opened.top >= 0));
		check('drawer: content scrolls', () => assert.ok((scrolled.scrollTop ?? 0) > 0));
		check('drawer: swiping down while scrolled scrolls back and keeps it open', () => {
			assert.equal(dragged.open, true);
			assert.ok((dragged.scrollTop ?? 0) < (scrolled.scrollTop ?? 0));
		});
		check('drawer: no page errors', () => assert.deepEqual(errors, []));
		await context.close();
	}

	for (const qa of cases.filter((c) => !only || only.includes(c.name))) {
		const scene = qa.scene !== false;
		const context = await browser.newContext({ ...qa.device, colorScheme: 'dark' });
		if (!qa.fresh) {
			await context.addInitScript((enabled) => {
				localStorage.setItem('voltalytics_sceneEnabled', String(enabled));
				localStorage.setItem('voltalytics_weatherAddress', '');
			}, scene);
		}
		const page = await context.newPage();
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			// the bare harness page has no favicon
			if (message.type() === 'error' && !message.text().startsWith('Failed to load resource'))
				errors.push(message.text());
		});
		page.on('response', (response) => {
			if (response.status() >= 400 && !response.url().endsWith('/favicon.ico'))
				errors.push(`${response.status()} ${response.url()}`);
		});
		page.setDefaultTimeout(90_000);
		const started = Date.now();
		await page.goto(`${base}?${qa.query ?? ''}`);

		if (scene) {
			await page.locator('.hero[data-scene-ready="true"]').waitFor();
		} else {
			await page.getByText('Charging Battery').first().waitFor();
		}
		await page.getByText('13,90').first().waitFor();
		await page.waitForTimeout(1500);
		const ready = Date.now() - started;

		if (qa.scroll) {
			await page.evaluate((y) => window.scrollTo(0, y), qa.scroll);
			await page.waitForTimeout(800);
		}
		if (qa.settings) {
			await page.locator('header button').last().click();
			await page.getByText('3D house view').waitFor();
			await page.waitForTimeout(800);
		}

		const facts = await page.evaluate(() => ({
			heroes: document.querySelectorAll('.hero').length,
			callouts: [...document.querySelectorAll('.callout')].map((c) => c.textContent?.trim()),
			headers: document.querySelectorAll('header').length,
			// battery labels exist only in InverterLiveGraph (the classic live card)
			liveGraph: /(Dis)?[Cc]harging Battery/.test(document.body.innerText),
			topBarBackground: getComputedStyle(document.querySelector('header')).backgroundColor,
			requests: window.qa.requests,
			resources: performance
				.getEntriesByType('resource')
				.map((entry) => entry.name)
				.filter((name) => !name.startsWith(location.origin))
		}));
		await page.screenshot({
			path: `${outDir}/${qa.name}.png`,
			fullPage: qa.fullPage === true,
			animations: 'disabled'
		});
		console.log(`${qa.name}: ready in ${ready} ms, ${JSON.stringify(facts)}`);

		check(`${qa.name}: no page errors`, () => assert.deepEqual(errors, []));
		if (scene) {
			check(`${qa.name}: one hero with callouts, live flows not duplicated in the card`, () => {
				assert.equal(facts.heroes, 1);
				assert.ok(facts.callouts.length >= 4, `callouts: ${facts.callouts.length}`);
				assert.equal(facts.liveGraph, false);
			});
			check(
				`${qa.name}: weather from Open-Meteo or the QA override, no geocoding without an address`,
				() => assert.ok(!facts.requests.includes('nominatim'))
			);
		} else {
			check(`${qa.name}: toggle off = unchanged dashboard`, () => {
				assert.equal(facts.heroes, 0);
				assert.equal(facts.liveGraph, true);
				assert.ok(!facts.requests.includes('open-meteo'), 'weather fetched without the scene');
			});
		}
		if (qa.name.startsWith('desktop-split')) {
			check(`${qa.name}: split shows a single TopBar (in the card column)`, () =>
				assert.equal(facts.headers, 1)
			);
		}
		if (qa.name === 'phone-stacked-day') {
			check('stacked TopBar floats transparent over the sky', () =>
				assert.equal(facts.topBarBackground, 'rgba(0, 0, 0, 0)')
			);
		}
		if (qa.name === 'phone-stacked-scrolled') {
			check('stacked TopBar gets its background back once scrolled past the scene', () =>
				assert.notEqual(facts.topBarBackground, 'rgba(0, 0, 0, 0)')
			);
		}
		await context.close();
	}
} finally {
	await browser?.close();
	await server.close();
}
console.log(`screenshots: ${outDir}`);
process.exit(failed ? 1 : 0);

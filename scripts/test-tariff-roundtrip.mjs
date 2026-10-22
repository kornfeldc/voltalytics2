// Run: node scripts/test-tariff-roundtrip.mjs
// Requires Playwright Chromium (`pnpm exec playwright install chromium`) or local Chrome.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({
	server: { port: 0 },
	plugins: [
		{
			name: 'tariff-roundtrip-harness',
			configureServer(vite) {
				vite.middlewares.use(async (req, res, next) => {
					if (req.url.split('?')[0] !== '/__tariff-roundtrip') return next();
					res.setHeader('Content-Type', 'text/html');
					res.end(
						await vite.transformIndexHtml(
							req.url,
							`
		<div id="editor"></div>
		<script type="module">
			import { mount } from 'svelte';
			import TariffEditor from '/src/components/system/TariffEditor.svelte';
			import { Db } from '/src/lib/classes/db.ts';
			import { parseFixedPriceTariff } from '/src/lib/classes/fixedPrice.ts';
			const tariff = {
				title: 'iOS tariff',
				ranges: [{ validFrom: '2026-01-01', prices: [
					{ months: '1,10,12', hours: '0,12,23', price: 9.9 }
				] }]
			};
			if (location.search.includes('arrays')) {
				const rule = tariff.ranges[0].prices[0];
				rule.months = [1, 10, 12];
				rule.hours = [0, 12, 23];
			}
			let row = { email: 'qa@example.invalid', useAwattar: true,
				priceProvider: 'fixed', fixedPriceData: JSON.stringify(tariff) };
			const settings = Db.mapFromDb(row);
			Db.getClient = () => ({ from: () => ({ update: (payload) => ({
				eq: async () => { row = { ...row, ...payload }; return { error: null }; }
			}) }) });
			window.qa = {
				save: async () => {
					settings.pauseCharging = !settings.pauseCharging;
					await Db.saveUserSettings(settings.email, settings);
					return { parsed: parseFixedPriceTariff(row.fixedPriceData), row };
				},
				provider: async (provider) => {
					settings.priceProvider = provider;
					await Db.saveUserSettings(settings.email, settings);
					return Db.mapFromDb(row);
				}
			};
			mount(TariffEditor, { target: document.querySelector('#editor'), props: {
				value: settings.fixedPriceData,
				onchange: (json) => { settings.fixedPriceData = json; }
			} });
		</script>`
						)
					);
				});
			}
		}
	]
});

let browser;
try {
	await server.listen();
	browser = await chromium.launch(
		existsSync('/Applications/Google Chrome.app') ? { channel: 'chrome' } : {}
	);
	const page = await browser.newPage();
	page.on('pageerror', (error) => console.error(error.stack));
	page.setDefaultTimeout(10000);
	await page.goto(`http://localhost:${server.httpServer.address().port}/__tariff-roundtrip`);
	await page.locator('#tariffTitle').waitFor();
	const checkSavedRule = async (title = 'iOS tariff') => {
		const { parsed, row } = await page.evaluate(() => window.qa.save());
		assert.ok(parsed, 'Saving web settings must keep the iOS tariff readable');
		assert.equal(parsed.title, title);
		assert.equal(parsed.ranges[0].validFrom, '2026-01-01');
		const storedRule = JSON.parse(row.fixedPriceData).ranges[0].prices[0];
		assert.equal(storedRule.months, '1,10,12');
		assert.equal(storedRule.hours, '0,12,23');
		assert.deepEqual(parsed.ranges[0].prices[0], {
			months: [1, 10, 12],
			hours: [0, 12, 23],
			price: 9.9
		});
	};
	await checkSavedRule();
	console.log('PASS: unrelated settings save preserves iOS tariff months, hours and price');
	await page.locator('#tariffTitle').fill('Updated in web');
	await checkSavedRule('Updated in web');
	if (process.env.QA_SCREENSHOT) {
		await page.screenshot({ path: process.env.QA_SCREENSHOT, fullPage: true });
	}
	console.log('PASS: editing a tariff preserves its rules and hour 23');
	for (const provider of ['none', 'fixed', 'awattar', 'fixed']) {
		const reloaded = await page.evaluate((value) => window.qa.provider(value), provider);
		assert.equal(reloaded.priceProvider, provider, 'Provider must survive save/reload');
		assert.equal(reloaded.useAwattar, provider !== 'none');
		assert.ok(reloaded.fixedPriceData, 'Switching providers must retain the saved tariff');
	}
	console.log('PASS: provider changes persist the derived legacy flag and retain the tariff');
	await page.goto(`http://localhost:${server.httpServer.address().port}/__tariff-roundtrip?arrays`);
	await page.locator('#tariffTitle').waitFor();
	await checkSavedRule();
	const repaired = await page.evaluate(() => window.qa.save());
	assert.equal(typeof JSON.parse(repaired.row.fixedPriceData).ranges[0].prices[0].hours, 'string');
	console.log(
		'PASS: tariffs written by the broken web editor recover to the iOS-compatible format'
	);
} finally {
	await browser?.close();
	await server.close();
}

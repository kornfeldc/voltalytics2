// Run: node scripts/test-price-display.mjs
// Regression for FEATURES.md #2: the price views must show the configured
// provider's prices on first open (no stale aWATTar response may win) and must
// refresh at the full hour. Requires Playwright Chromium or local Chrome.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const harness = `
	<div id="app"></div>
	<script type="module">
		import { mount } from 'svelte';
		import Dashboard from '/src/routes/v/dashboard/+page.svelte';
		import PricesPage from '/src/routes/v/awattar/+page.svelte';
		import { Db } from '/src/lib/classes/db.ts';
		import { awattarState } from '/src/lib/state/awattarState.svelte.ts';

		const params = new URLSearchParams(location.search);
		const allMonths = '1,2,3,4,5,6,7,8,9,10,11,12';
		// 'hourly': price = hour of day, so a refresh after a full hour is visible
		const prices = params.get('tariff') === 'hourly'
			? Array.from({ length: 24 }, (_, h) => ({ months: allMonths, hours: String(h), price: h }))
			: [{ months: allMonths, hours: Array.from({ length: 24 }, (_, h) => h).join(','), price: 13.9 }];
		const tariff = { title: 'qa', ranges: [{ validFrom: '2020-01-01', prices }] };

		// aWATTar answers late with an unmistakable 99.99 ct - like the cold cache
		// after every full hour (the cache key contains the hour).
		const realFetch = window.fetch.bind(window);
		window.qa = { awattarCalls: 0, currentPrice: () => awattarState.currentPrice };
		window.fetch = async (input, init) => {
			const url = String(input instanceof Request ? input.url : input);
			if (!url.includes('/marketdata')) return realFetch(input, init);
			window.qa.awattarCalls++;
			await new Promise((resolve) => setTimeout(resolve, 400));
			const day = new Date();
			day.setHours(0, 0, 0, 0);
			const data = Array.from({ length: 48 }, (_, h) => ({
				start_timestamp: day.getTime() + h * 3600 * 1000,
				marketprice: 833.25
			}));
			return new Response(JSON.stringify({ data }), {
				headers: { 'Content-Type': 'application/json' }
			});
		};

		const settings = Db.mapFromDb({
			email: 'qa@example.invalid',
			useAwattar: true,
			priceProvider: 'fixed',
			fixedPriceData: JSON.stringify(tariff)
		});
		mount(params.get('page') === 'prices' ? PricesPage : Dashboard, {
			target: document.querySelector('#app'),
			props: { data: { userSettings: Promise.resolve(settings) } }
		});
	</script>`;

const server = await createServer({
	server: { port: 0 },
	plugins: [
		{
			name: 'price-display-harness',
			configureServer(vite) {
				vite.middlewares.use(async (req, res, next) => {
					if (req.url.split('?')[0] !== '/__price-display') return next();
					res.setHeader('Content-Type', 'text/html');
					res.end(await vite.transformIndexHtml(req.url, harness));
				});
			}
		}
	]
});

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
	const base = `http://localhost:${server.httpServer.address().port}/__price-display`;
	browser = await chromium.launch(
		existsSync('/Applications/Google Chrome.app') ? { channel: 'chrome' } : {}
	);

	// fresh context = empty localStorage = the "opening the app" case
	const open = async (query, setup) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		page.on('pageerror', (error) => console.error(error.stack));
		page.setDefaultTimeout(10000);
		await setup?.(page);
		await page.goto(`${base}?${query}`);
		return { context, page };
	};

	{
		const { context, page } = await open('page=dashboard');
		await page.getByText('13,90').first().waitFor();
		await page.waitForTimeout(1500); // let the slow aWATTar answer land
		const currentPrice = await page.evaluate(() => window.qa.currentPrice());
		const text = await page.locator('#app').innerText();
		check('dashboard current price comes from the fixed tariff on first open', () =>
			assert.equal(currentPrice, 13.9)
		);
		check('dashboard price list never shows aWATTar prices', () =>
			assert.ok(!text.includes('99,99'), 'found an aWATTar price in the list')
		);
		const awattarCalls = await page.evaluate(() => window.qa.awattarCalls);
		check('dashboard never asks aWATTar when the fixed tariff is configured', () =>
			assert.equal(awattarCalls, 0)
		);
		await context.close();
	}

	{
		const { context, page } = await open('page=prices');
		await page.getByText('13,90').first().waitFor();
		await page.waitForTimeout(1500);
		const text = await page.locator('#app').innerText();
		check('prices page shows the fixed tariff on first open', () =>
			assert.ok(!text.includes('99,99'), 'found an aWATTar price on the prices page')
		);
		await context.close();
	}

	{
		// open at hh:59:30, then let 90 s pass: the current price must follow the hour
		const start = new Date();
		start.setHours(15, 59, 30, 0);
		const { context, page } = await open('page=dashboard&tariff=hourly', (page) =>
			page.clock.install({ time: start })
		);
		await page.getByText('15:00 - 16:00').waitFor();
		await page.clock.runFor(1000);
		const before = await page.evaluate(() => window.qa.currentPrice());
		await page.clock.runFor(90 * 1000);
		await page.waitForTimeout(500);
		const after = await page.evaluate(() => window.qa.currentPrice());
		check('current price follows the full hour without a manual refresh', () =>
			assert.deepEqual([before, after], [15, 16])
		);
		await context.close();
	}
} finally {
	await browser?.close();
	await server.close();
}
process.exit(failed ? 1 : 0);

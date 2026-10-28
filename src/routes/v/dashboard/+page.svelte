<script lang="ts">
	// noinspection ES6UnusedImports
	import * as Card from '$lib/components/ui/card/index';
	import DashboardLive from '../../../components/dashboard/DashboardLive.svelte';
	import DashboardToday from '../../../components/dashboard/DashboardToday.svelte';
	import DashboardMonth from '../../../components/dashboard/DashboardMonth.svelte';
	import DashboardPrices from '../../../components/dashboard/DashboardPrices.svelte';
	import DashboardCharging from '../../../components/dashboard/DashboardCharging.svelte';
	import { drawerState } from '$lib/state/drawerState.svelte.js';
	import { awattarState } from '$lib/state/awattarState.svelte';
	import moment from 'moment';
	import type { AwattarEntry } from '$lib/classes/awattar';
	import { Button } from '$lib/components/ui/button';
	import type { IUserSettings } from '$lib/classes/db';
	import EnergyHero from '../../../components/energy/EnergyHero.svelte';
	import TopBar from '../../../components/system/TopBar.svelte';
	import { sceneState, type SceneLayout } from '$lib/state/sceneState.svelte';
	let { data }: { data: { userSettings: Promise<IUserSettings> } } = $props();

	// 3D house view (FEATURES.md #3, optional per browser). The scene fills the
	// viewport behind the dashboard (FEATURES.md #5) and the cards float over it;
	// the camera frames the property into the part they leave free (`focus`):
	// stacked (portrait-shaped or narrower than 700 px) — under the floating
	// TopBar, cards below it scrolling up over the fixed scene; split
	// (landscape-shaped from 700 px) — card column with its own TopBar left, the
	// property right.
	let viewportWidth = $state(typeof window === 'undefined' ? 0 : window.innerWidth);
	let viewportHeight = $state(typeof window === 'undefined' ? 0 : window.innerHeight);
	let scrollY = $state(0);

	const sceneLayout = (userSettings: IUserSettings | undefined): SceneLayout =>
		!sceneState.enabled || !userSettings?.currentInverter
			? 'off'
			: viewportWidth >= 700 && viewportWidth > viewportHeight
				? 'split'
				: 'stacked';
	/**
	 * Stacked: height of the free area below the TopBar — up to half the width
	 * on wide windows, so the house keeps sky above it (a 560 px strip across a
	 * tall desktop window squeezed it to the top).
	 */
	const focusHeight = $derived(
		Math.min(Math.max(viewportHeight * 0.56, 320), Math.max(560, viewportWidth * 0.5))
	);
	const columnWidth = $derived(Math.min(Math.max(viewportWidth * 0.4, 340), 460));
	/** Split: the column's tint fades out beyond its edge; the free area starts after it. */
	const columnFade = 64;
	const focus = (layout: SceneLayout) =>
		layout === 'split'
			? {
					x: columnWidth + columnFade,
					y: 0,
					width: Math.max(1, viewportWidth - columnWidth - columnFade),
					height: viewportHeight
				}
			: { x: 0, y: sceneState.topBarHeight, width: viewportWidth, height: focusHeight };

	$effect(() => {
		sceneState.heroUnderBar = sceneState.layout === 'stacked' && scrollY < focusHeight - 8;
	});

	/** Tells the layout which chrome to render (TopBar, width limit). */
	const syncLayout = (_node: HTMLElement, layout: SceneLayout) => {
		sceneState.layout = layout;
		return {
			update: (next: SceneLayout) => {
				sceneState.layout = next;
			},
			destroy: () => {
				sceneState.layout = 'off';
				sceneState.heroUnderBar = false;
			}
		};
	};

	const cardClass = 'shadow-lg dark:shadow-slate-800 dark:border-slate-900';
	/** Over the 3D scene: frosted, so the cards stay legible on a busy background. */
	const sceneCardClass = 'shadow-lg dark:border-slate-900 bg-card/70 backdrop-blur-xl';
	const openSettings = () => {
		drawerState.isOpened = true;
	};

	const getFormattedPrice = (price: number): string => {
		return new Intl.NumberFormat('de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(price);
	};

	const getPriceColor = (price: number): string => {
		if (price < 10) {
			return 'text-positive';
		} else if (price < 20) {
			return 'text-neutral2';
		} else if (price < 30) {
			return 'text-warning';
		} else {
			return 'text-negative';
		}
	};
</script>

<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} bind:scrollY />

{#snippet dashboardLive()}<DashboardLive />{/snippet}
<!-- with the 3D house view the live flows are in the scene; the card keeps the day chart -->
{#snippet dashboardChart()}<DashboardLive graph={false} />{/snippet}
{#snippet dashboardCharging()}<DashboardCharging />{/snippet}
{#snippet dashboardToday()}<DashboardToday />{/snippet}
{#snippet dashboardMonth()}<DashboardMonth />{/snippet}
{#snippet card(title, rightTitle, contentSnippet, renderPrice = false)}
	<Card.Header class="flex flex-col p-2 px-4">
		<div class="grid grid-cols-2">
			<h1 class="whitespace-nowrap">{title}</h1>
			{#if renderPrice && awattarState.currentPrice}
				<p class="text-right text-lg {getPriceColor(awattarState.currentPrice)}">
					<span class="text-xs">cent/kWh</span>
					{getFormattedPrice(awattarState.currentPrice)}
				</p>
			{:else}
				<p class="text-right text-sm text-muted-foreground">{rightTitle}</p>
			{/if}
		</div>
	</Card.Header>
	<Card.Content class="px-4 py-0 pb-2">
		{@render contentSnippet()}
	</Card.Content>
{/snippet}

{#snippet cards(userSettings: IUserSettings, scene: boolean)}
	<!-- declared here so it gets the resolved settings: undefined settings make
	PriceApi fall back to aWATTar (public landing page) -->
	{#snippet dashboardPrices()}<DashboardPrices {userSettings} />{/snippet}
	{#if !userSettings?.currentInverter && !userSettings?.currentWallbox && !userSettings?.useAwattar}
		<div class="dashboard_live">
			<Card.Root class={scene ? sceneCardClass : cardClass} onclick={() => openSettings()}>
				<Card.Header class="flex flex-col p-2 px-4">
					<h1 class="whitespace-nowrap">start setup</h1>
				</Card.Header>
				<Card.Content class="flex justify-center px-4 py-0 pb-2">
					<Button>Click here to open setup</Button>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
	{#if userSettings?.currentInverter}
		<div class="dashboard_live">
			<Card.Root class={scene ? sceneCardClass : cardClass}>
				{@render card(
					`${userSettings?.currentInverter} live data`,
					'',
					scene ? dashboardChart : dashboardLive,
					userSettings?.useAwattar
				)}
			</Card.Root>
		</div>

		{#if userSettings?.currentWallbox}
			<div class="dashboard_charging">
				<Card.Root class={scene ? sceneCardClass : cardClass} onclick={() => openSettings()}>
					{@render card(`${userSettings?.currentWallbox} live data`, '', dashboardCharging)}
				</Card.Root>
			</div>
		{/if}

		<div class="dashboard_today">
			<a href={'/v/inverter/day/' + moment().format('YYYY-MM-DD')}>
				<Card.Root class={scene ? sceneCardClass : cardClass}>
					{@render card('today', '', dashboardToday)}
				</Card.Root>
			</a>
		</div>

		<div class="dashboard_month">
			<a href={'/v/inverter/month/' + moment().format('YYYY-MM')}>
				<Card.Root class={scene ? sceneCardClass : cardClass}>
					{@render card('month', '', dashboardMonth)}
				</Card.Root>
			</a>
		</div>
	{/if}

	{#if userSettings?.useAwattar}
		<div class="dashboard_awattar">
			<Card.Root class={scene ? sceneCardClass : cardClass}>
				{@render card('prices', 'cent/kWh', dashboardPrices)}
			</Card.Root>
		</div>
	{/if}
{/snippet}

{#await data.userSettings then userSettings}
	{@const layout = sceneLayout(userSettings)}
	<div class="contents" use:syncLayout={layout}>
		{#if layout !== 'off'}
			<!-- one scene behind both layouts: resizing across them never remounts it -->
			<div class="scene_backdrop">
				<EnergyHero hasWallbox={!!userSettings?.currentWallbox} focus={focus(layout)} />
			</div>
		{/if}
		{#if layout === 'split'}
			<div class="scene_column_tint" style:width="{columnWidth + columnFade}px"></div>
			<div class="scene_overlay" style:width="{columnWidth}px">
				<TopBar embedded />
				<section class="dashboard_grid dashboard_grid_single px-3 pb-3 pt-4">
					{@render cards(userSettings, true)}
				</section>
			</div>
		{:else if layout === 'stacked'}
			<!-- clear band over the property; the cards scroll up over the fixed scene
			on a tinted sheet that reaches at least the bottom of the viewport -->
			<div style:height="{focusHeight}px"></div>
			<div
				class="scene_overlay scene_sheet"
				style:min-height="{Math.max(0, viewportHeight - sceneState.topBarHeight - focusHeight)}px"
			>
				<!-- one column, today + month side by side: the chart-only live card is
				shorter than today + month, the two-column grid left a gap under it -->
				<section
					class="dashboard_grid dashboard_grid_single mx-auto w-full max-w-[800px] px-4 pb-4 pt-3"
				>
					{@render cards(userSettings, true)}
				</section>
			</div>
		{:else}
			<section class="dashboard_grid">
				{@render cards(userSettings, false)}
			</section>
		{/if}
	</div>
{/await}

<style>
	.dashboard_live {
		grid-area: live;
	}
	.dashboard_charging {
		grid-area: charging;
	}
	.dashboard_today {
		grid-area: today;
	}
	.dashboard_month {
		grid-area: month;
	}
	.dashboard_awattar {
		grid-area: awattar;
	}

	.dashboard_grid {
		display: grid;
		grid-gap: 1em;
	}

	@media (max-width: 600px) {
		.dashboard_grid {
			grid-template-columns: auto auto;
			grid-template-areas:
				'live live'
				'charging charging'
				'today month'
				'awattar awattar';
		}
	}

	@media (min-width: 601px) and (max-width: 1000px) {
		.dashboard_grid {
			grid-template-columns: auto auto;
			grid-template-areas:
				'live today'
				'live month'
				'charging charging'
				'awattar awattar';
		}
	}

	@media (min-width: 1001px) {
		.dashboard_grid {
			grid-template-columns: auto auto;
			grid-template-areas:
				'live today'
				'live month'
				'charging awattar';
		}
	}

	/* 3D house view (FEATURES.md #3): the scene fills the viewport behind the
	page (FEATURES.md #5), the cards float over it. 100vh = the large viewport on
	mobile Safari: a collapsing toolbar doesn't resize the canvas. */
	.scene_backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		z-index: 0;
	}

	.scene_overlay {
		position: relative;
		z-index: 1;
	}

	/* purple tint behind the cards (user request: like the base background before,
	the middle ground between its near-black base and a rich purple) — the cards sit
	completely on it, it fades in eased (smoothstep) so no edge shows, and never
	over the free area: the sheet fades in over 140 px below the free area's edge,
	the column's tint fades out over 64 px beyond the column, where the free area
	starts (`columnFade`) */
	.scene_column_tint,
	.scene_sheet {
		--tint: 268 40% 93%;
		--tint-alpha: 0.48;
		--fade: 140px;
		--tint-ramp:
			hsl(var(--tint) / 0) 0,
			hsl(var(--tint) / calc(var(--tint-alpha) * 0.156)) calc(var(--fade) * 0.25),
			hsl(var(--tint) / calc(var(--tint-alpha) * 0.5)) calc(var(--fade) * 0.5),
			hsl(var(--tint) / calc(var(--tint-alpha) * 0.844)) calc(var(--fade) * 0.75),
			hsl(var(--tint) / var(--tint-alpha)) var(--fade);
	}

	:global(.dark) .scene_column_tint,
	:global(.dark) .scene_sheet {
		--tint: 268 90% 11%;
		--tint-alpha: 0.52;
	}

	.scene_column_tint {
		--fade: 64px;
		position: fixed;
		top: 0;
		left: 0;
		height: 100vh;
		z-index: 0;
		pointer-events: none;
		background: linear-gradient(to left, var(--tint-ramp));
	}

	.scene_sheet {
		background: linear-gradient(to bottom, var(--tint-ramp));
	}

	/* scene layouts: one column, today + month side by side */
	.dashboard_grid.dashboard_grid_single {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		grid-template-areas:
			'live live'
			'charging charging'
			'today month'
			'awattar awattar';
	}
</style>

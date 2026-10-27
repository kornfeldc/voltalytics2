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

	// 3D house view (FEATURES.md #3, optional per browser): stacked below 900 px —
	// scene full width under the floating TopBar, cards below; split from 900 px —
	// card column with its own TopBar left, scene right at full height.
	let viewportWidth = $state(typeof window === 'undefined' ? 0 : window.innerWidth);
	let viewportHeight = $state(typeof window === 'undefined' ? 0 : window.innerHeight);
	let scrollY = $state(0);

	const sceneLayout = (userSettings: IUserSettings | undefined): SceneLayout =>
		!sceneState.enabled || !userSettings?.currentInverter
			? 'off'
			: viewportWidth >= 900
				? 'split'
				: 'stacked';
	const heroHeight = $derived(
		Math.min(Math.max(viewportHeight * 0.56, 320), 560) + sceneState.topBarHeight
	);
	const columnWidth = $derived(Math.min(Math.max(viewportWidth * 0.4, 340), 460));

	$effect(() => {
		sceneState.heroUnderBar =
			sceneState.layout === 'stacked' && scrollY < heroHeight - sceneState.topBarHeight - 8;
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
			<Card.Root class={cardClass} onclick={() => openSettings()}>
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
			<Card.Root class={cardClass}>
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
				<Card.Root class={cardClass} onclick={() => openSettings()}>
					{@render card(`${userSettings?.currentWallbox} live data`, '', dashboardCharging)}
				</Card.Root>
			</div>
		{/if}

		<div class="dashboard_today">
			<a href={'/v/inverter/day/' + moment().format('YYYY-MM-DD')}>
				<Card.Root class={cardClass}>
					{@render card('today', '', dashboardToday)}
				</Card.Root>
			</a>
		</div>

		<div class="dashboard_month">
			<a href={'/v/inverter/month/' + moment().format('YYYY-MM')}>
				<Card.Root class={cardClass}>
					{@render card('month', '', dashboardMonth)}
				</Card.Root>
			</a>
		</div>
	{/if}

	{#if userSettings?.useAwattar}
		<div class="dashboard_awattar">
			<Card.Root class={cardClass}>
				{@render card('prices', 'cent/kWh', dashboardPrices)}
			</Card.Root>
		</div>
	{/if}
{/snippet}

{#await data.userSettings then userSettings}
	{@const layout = sceneLayout(userSettings)}
	<div class="contents" use:syncLayout={layout}>
		{#if layout === 'split'}
			<div class="scene_split">
				<div class="scene_column" style:width="{columnWidth}px">
					<TopBar embedded />
					<section class="dashboard_grid dashboard_grid_single px-3 pb-3 pt-3">
						{@render cards(userSettings, true)}
					</section>
				</div>
				<div class="scene_side">
					<EnergyHero hasWallbox={!!userSettings?.currentWallbox} />
				</div>
			</div>
		{:else if layout === 'stacked'}
			<div
				class="scene_hero"
				style:height="{heroHeight}px"
				style:margin-top="-{sceneState.topBarHeight}px"
			>
				<EnergyHero
					hasWallbox={!!userSettings?.currentWallbox}
					topInset={sceneState.topBarHeight}
					fadesOut
				/>
			</div>
			<section class="dashboard_grid mx-auto w-full max-w-[800px] px-4 pb-4 pt-3">
				{@render cards(userSettings, true)}
			</section>
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

	/* 3D house view (FEATURES.md #3) */
	.scene_hero {
		position: relative;
		width: 100%;
	}

	.scene_split {
		display: flex;
		align-items: flex-start;
		min-height: 100vh;
	}

	.scene_column {
		flex: none;
		min-width: 0;
	}

	.scene_side {
		position: sticky;
		top: 0;
		flex: 1;
		min-width: 0;
		height: 100vh;
		height: 100dvh;
	}

	/* split card column: one column, today + month side by side */
	.dashboard_grid.dashboard_grid_single {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		grid-template-areas:
			'live live'
			'charging charging'
			'today month'
			'awattar awattar';
	}
</style>

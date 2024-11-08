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
	let { data } = $props();

	const cardClass = 'shadow-lg shadow-slate-800 border-slate-900';
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

{#snippet dashboardLive()}<DashboardLive />{/snippet}
{#snippet dashboardCharging()}<DashboardCharging />{/snippet}
{#snippet dashboardToday()}<DashboardToday />{/snippet}
{#snippet dashboardMonth()}<DashboardMonth />{/snippet}
{#snippet dashboardPrices()}<DashboardPrices />{/snippet}
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

<section class="grid grid-cols-2 gap-3">
	{#await data.userSettings then userSettings}
		{#if userSettings?.currentInverter}
			<Card.Root class="col-span-2 {cardClass}">
				{@render card(
					`${userSettings?.currentInverter} live data`,
					'',
					dashboardLive,
					userSettings?.useAwattar
				)}
			</Card.Root>

			<Card.Root class="col-span-2 {cardClass}" onclick={() => openSettings()}>
				{@render card(`${userSettings?.currentWallbox} live data`, '', dashboardCharging)}
			</Card.Root>

			<a href={'/v/inverter/day/' + moment().format('YYYY-MM-DD')}>
				<Card.Root class={cardClass}>
					{@render card('today', '', dashboardToday)}
				</Card.Root>
			</a>

			<a href={'/v/inverter/month/' + moment().format('YYYY-MM')}>
				<Card.Root class={cardClass}>
					{@render card('month', '', dashboardMonth)}
				</Card.Root>
			</a>
		{/if}

		{#if userSettings?.useAwattar}
			<Card.Root class="col-span-2 {cardClass}">
				{@render card('awattar prices', 'cent/kWh', dashboardPrices)}
			</Card.Root>
		{/if}
	{/await}
</section>

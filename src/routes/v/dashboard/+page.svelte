<script lang="ts">
	// noinspection ES6UnusedImports
	import * as Card from '$lib/components/ui/card/index';
	import DashboardLive from '../../../components/dashboard/DashboardLive.svelte';
	import DashboardToday from '../../../components/dashboard/DashboardToday.svelte';
	import DashboardMonth from '../../../components/dashboard/DashboardMonth.svelte';
	import DashboardPrices from '../../../components/dashboard/DashboardPrices.svelte';
	let { data } = $props();

	const cardClass = 'shadow-lg shadow-slate-800 border-slate-900';
</script>

{#snippet dashboardLive()}<DashboardLive />{/snippet}
{#snippet dashboardToday()}<DashboardToday />{/snippet}
{#snippet dashboardMonth()}<DashboardMonth />{/snippet}
{#snippet dashboardPrices()}<DashboardPrices />{/snippet}
{#snippet card(title, rightTitle, contentSnippet)}
	<Card.Header class=" p-2 px-4">
		<div class="grid grid-cols-2">
			<h1 class="">{title}</h1>
			<p class="text-right text-sm text-muted-foreground">{rightTitle}</p>
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
				{@render card(`${userSettings?.currentInverter} live data`, '', dashboardLive)}
			</Card.Root>

			<Card.Root class={cardClass}>
				{@render card('today header', '', dashboardToday)}
			</Card.Root>

			<Card.Root class={cardClass}>
				{@render card('month header', '', dashboardMonth)}
			</Card.Root>
		{/if}

		{#if userSettings?.useAwattar}
			<Card.Root class="col-span-2 {cardClass}">
				{@render card('awattar prices', 'cent/kWh', dashboardPrices)}
			</Card.Root>
		{/if}
	{/await}
</section>

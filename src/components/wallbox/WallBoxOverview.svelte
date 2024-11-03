<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import type { IInverterStatistic } from '$lib/classes/interver';
	import type { IUserSettings } from '$lib/classes/db';
	import {
		BanIcon,
		BatteryIcon,
		BoltIcon,
		CarFrontIcon,
		CarIcon,
		HomeIcon,
		SunIcon,
		UnplugIcon,
		ZapIcon
	} from 'lucide-svelte';
	import type { IWallBoxRealTimeData } from '$lib/classes/wallBox';
	import { vConsole } from '$lib/classes/vconsole';

	let realTimeData = $state({} as IWallBoxRealTimeData);
	let userSettings = $state({} as IUserSettings);

	const getRealTimeData = async (): Promise<void> => {
		const res = await fetch(`/api/wallbox/realtime`);
		const result = await res.json();
		realTimeData = result.realTimeData;
		userSettings = result.userSettings;

		vConsole.log('data', realTimeData);
		if ((realTimeData?.kw ?? 0) > 0) status = 'force';
		else if (realTimeData?.carStatus === 'unknown') status = 'no_car';
		else status = 'not_charging';
	};

	const isExcessChargingEnabled = $derived(userSettings.chargeWithExcessIsOn);
	const isForceChargingEnabled = $derived(userSettings.forceChargeIsOn);
	const isBatteryChargingEnabled = $derived((userSettings.chargeUntilMinBattery ?? 0) > 0);

	let status = $state('no_car' as 'force' | 'excess' | 'battery' | 'not_charging' | 'no_car');
	const isCharging = $derived(status !== 'not_charging' && status !== 'no_car');
	const mainColor = $derived(
		status === 'excess'
			? 'text-neutral'
			: status === 'battery'
				? 'text-neutral2'
				: status === 'force'
					? 'text-negative'
					: 'text-inactive'
	);

	const statusOrder = $derived.by(() => {
		if (status === 'excess') return ['excess', 'force', 'battery'];
		else if (status === 'battery') return ['battery', 'force', 'excess'];
		return ['force', 'excess', 'battery'];
	});
</script>

{#snippet skeleton()}
	<div class="mb-4 flex gap-2">
		<Skeleton class="h-12 w-12 rounded-full" />
		<div class="flex grow flex-col items-center justify-center">
			<Skeleton class="mb-2 h-4 w-1/2 " />
			<Skeleton class="h-4 w-full " />
		</div>
		<Skeleton class="h-12 w-12 rounded-full" />
	</div>
	<div class="flex flex-col gap-2">
		{#each [0, 1, 2] as i}
			<Skeleton class="h-4 w-1/2 " />
		{/each}
	</div>
{/snippet}

{#snippet renderStatusLine(isActive, text)}
	<div class={isActive ? 'text-xl ' + mainColor : 'text-inactive text-sm'}>{text}</div>
{/snippet}

{#snippet renderForceChargingLine()}
	{#if status === 'force'}
		{@render renderStatusLine(true, 'force charging')}
	{:else if isForceChargingEnabled}
		{@render renderStatusLine(false, 'force charging enabled')}
	{:else}
		{@render renderStatusLine(false, 'force charging disabled')}
	{/if}
{/snippet}

{#snippet renderExcessChargingLine()}
	{#if status === 'excess'}
		{@render renderStatusLine(true, 'excess charging')}
	{:else if isExcessChargingEnabled}
		{@render renderStatusLine(false, 'excess charging enabled')}
	{:else}
		{@render renderStatusLine(false, 'excess charging disabled')}
	{/if}
{/snippet}

{#snippet renderBatteryChargingLine()}
	{#if status === 'battery'}
		{@render renderStatusLine(true, 'charging from battery')}
	{:else if isBatteryChargingEnabled}
		{@render renderStatusLine(
			false,
			'battery charging enabled (>' + userSettings.chargeUntilMinBattery + '%)'
		)}
	{:else}
		{@render renderStatusLine(false, 'battery charging disabled')}
	{/if}
{/snippet}

{#snippet renderTitle()}
	{@const className = mainColor + (isCharging ? ' text-xl ' : ' text-md')}

	<span class={className}>
		{#if status === 'not_charging'}
			not charging
		{:else if status === 'no_car'}
			no car plugged in
		{:else}
			{realTimeData?.kw} kw
			<span class="pl-1 text-xs">{realTimeData?.phase}p|{realTimeData?.ampere}a</span>
		{/if}
	</span>
{/snippet}

{#snippet renderFlow()}
	<div class="flex h-5 w-full">
		<div class="relative w-full">
			<div class="line absolute h-1 w-full bg-slate-500">
				<div
					class="dot absolute top-[-2px] z-10 h-2 w-2 rounded-full bg-amber-300 {isCharging
						? 'animateLeftToRight'
						: 'hidden'}"
				></div>
			</div>
		</div>
	</div>
{/snippet}

<div class="h-[8.5em]">
	{#await getRealTimeData()}
		{@render skeleton()}
	{:then _}
		{@const iconClass = 'mt-4 h-8 w-8 text-slate-400'}
		<div class="mb-4 mt-2 flex flex items-center justify-center gap-2">
			{#if status === 'battery'}
				<BatteryIcon class={iconClass} />
			{:else if status === 'excess'}
				<SunIcon class={iconClass} />
			{:else}
				<ZapIcon class={iconClass} />
			{/if}
			<div class="flex grow flex-col items-center justify-center">
				<div class="mb-2">
					{@render renderTitle()}
				</div>
				{@render renderFlow()}
			</div>
			{#if status === 'no_car'}
				<UnplugIcon class="{iconClass} text-inactive" />
			{:else}
				<CarIcon class={iconClass} />
			{/if}
		</div>
		<div class="flex flex-col">
			{#each statusOrder as statusItem}
				{#if statusItem === 'force'}
					{@render renderForceChargingLine()}
				{:else if statusItem === 'excess'}
					{@render renderExcessChargingLine()}
				{:else if statusItem === 'battery'}
					{@render renderBatteryChargingLine()}
				{/if}
			{/each}
		</div>
	{/await}
</div>

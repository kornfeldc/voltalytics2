<script lang="ts">
	import type { IInverterRealTimeData } from '$lib/classes/interver';
	import InverterLiveGraphSkeleton from './InverterLiveGraphSkeleton.svelte';
	import InverterLiveGraphCorner from './InverterLiveGraphCorner.svelte';
	import {
		BatteryChargingIcon,
		BatteryFullIcon,
		BatteryLowIcon,
		BatteryMediumIcon,
		BatteryWarningIcon,
		HomeIcon,
		LightbulbIcon,
		SunIcon,
		ZapIcon
	} from 'lucide-svelte';
	import moment from 'moment';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';

	let realTimeInfo = $state({} as IInverterRealTimeData);

	let lastUpdateTime = $derived.by(() => {
		if (!realTimeInfo?.timestamp) return '';
		return moment(realTimeInfo.timestamp).format('DD.MM.yyyy HH:mm');
	});

	const getRealTimeInfo = async (): Promise<void> => {
		const res = await fetch(`/api/inverter/realtime`);
		realTimeInfo = await res.json();
	};

	onMount(() => {
		setTimeout(() => {
			invalidateAll();
		}, 60 * 1000);
	});
</script>

{#snippet productionIcon()}<SunIcon />{/snippet}
{#snippet gridIcon()}<ZapIcon />{/snippet}
{#snippet batteryEmptyIcon()}<BatteryWarningIcon class="rotate-[-90deg] transform" />{/snippet}
{#snippet batteryLowIcon()}<BatteryLowIcon class="rotate-[-90deg] transform" />{/snippet}
{#snippet batteryMediumIcon()}<BatteryMediumIcon class="rotate-[-90deg] transform" />{/snippet}
{#snippet batteryFullIcon()}<BatteryFullIcon class="rotate-[-90deg] transform" />{/snippet}
{#snippet batteryChargingIcon()}<BatteryChargingIcon class="rotate-[-90deg] transform" />{/snippet}
{#snippet batteryIcon()}
	<div class="flex flex-col justify-center">
		{#if (realTimeInfo?.powerToBattery ?? 0) > 0}
			{@render batteryChargingIcon()}
		{:else if (realTimeInfo?.batterySoc ?? 0) >= 80}
			{@render batteryFullIcon()}
		{:else if (realTimeInfo?.batterySoc ?? 0) >= 50}
			{@render batteryMediumIcon()}
		{:else if (realTimeInfo?.batterySoc ?? 0) >= 20}
			{@render batteryLowIcon()}
		{:else}
			{@render batteryEmptyIcon()}
		{/if}
		<span class={'text-inactive pt-0.5 text-center text-xs'}>{realTimeInfo?.batterySoc ?? 0}%</span>
	</div>
{/snippet}
{#snippet usageIcon()}<LightbulbIcon />{/snippet}

{#snippet productionCorner()}
	<InverterLiveGraphCorner
		label="Production"
		color="text-neutral"
		value={realTimeInfo.powerProduction}
		icon={productionIcon}
	/>
{/snippet}

{#snippet gridCorner()}
	{#if realTimeInfo.powerFromGrid}
		<InverterLiveGraphCorner
			label="From Grid"
			color="text-negative"
			value={realTimeInfo.powerFromGrid}
			doesAffectCosts={true}
			right={true}
			icon={gridIcon}
		/>
	{:else if realTimeInfo.powerToGrid}
		<InverterLiveGraphCorner
			label="To Grid"
			color="text-positive"
			value={realTimeInfo.powerToGrid}
			doesAffectCosts={false}
			right={true}
			icon={gridIcon}
		/>
	{:else}
		<InverterLiveGraphCorner
			label="Grid"
			color="text-inactive"
			value={0}
			doesAffectCosts={false}
			right={true}
			icon={gridIcon}
		/>
	{/if}
{/snippet}

{#snippet batteryCorner()}
	{#if realTimeInfo.powerToBattery}
		<InverterLiveGraphCorner
			label="Charging Battery"
			color="text-positive"
			value={realTimeInfo.powerToBattery}
			doesAffectCosts={false}
			icon={batteryIcon}
		/>
	{:else if realTimeInfo.powerFromBattery}
		<InverterLiveGraphCorner
			label="Discharging Battery"
			color="text-neutral2"
			value={realTimeInfo.powerFromBattery}
			doesAffectCosts={false}
			icon={batteryIcon}
		/>
	{:else}
		<InverterLiveGraphCorner
			label="Battery"
			color="text-inactive"
			value={0}
			doesAffectCosts={false}
			icon={batteryIcon}
		/>
	{/if}
{/snippet}

{#snippet usageCorner()}
	<InverterLiveGraphCorner
		label="Usage"
		color="text-warning"
		value={realTimeInfo.powerUsage}
		doesAffectCosts={true}
		right={true}
		icon={usageIcon}
	/>
{/snippet}

{#snippet flow({ color, topClass, bottomClass, topDot, bottomDot })}
	<div class="flex h-5">
		<div class="relative w-full">
			<div class="line absolute {topClass} {color}">
				<div class="dot absolute z-10 h-2 w-2 rounded-full bg-amber-300 {topDot}"></div>
			</div>
			<div class="line absolute {bottomClass} {color}">
				<div class="dot absolute z-10 h-2 w-2 rounded-full bg-amber-300 {bottomDot}"></div>
			</div>
		</div>
	</div>
{/snippet}

{#snippet productionFlow()}
	{@render flow({
		color: 'bg-slate-500',
		topClass: 'left-[10px] w-1 h-4',
		bottomClass: 'top-4 left-[10px] w-full h-1',
		topDot: 'hidden',
		bottomDot:
			'top-[-2px] left-[-2px] ' +
			((realTimeInfo.powerProduction ?? 0) > 0 ? 'animateLeftToRight' : 'hidden')
	})}
{/snippet}

{#snippet gridFlow()}
	{@render flow({
		color: 'bg-slate-500',
		topClass: 'right-[10px] w-1 h-4',
		bottomClass: 'top-4 right-[10px] w-full h-1',
		topDot: 'hidden',
		bottomDot:
			'top-[-2px] right-[-2px] ' +
			((realTimeInfo.powerFromGrid ?? 0) > 0
				? 'animateRightToLeft'
				: (realTimeInfo.powerToGrid ?? 0) > 0
					? 'animateLeftToRight'
					: 'hidden')
	})}
{/snippet}

{#snippet batteryFlow()}
	{@render flow({
		color: 'bg-slate-500',
		topClass: 'top-2 left-[10px] w-full h-1',
		bottomClass: 'top-2 left-[10px] w-1 h-5',
		topDot:
			'top-[-2px] left-[-2px] ' +
			((realTimeInfo.powerToBattery ?? 0) > 0
				? 'animateRightToLeft'
				: (realTimeInfo.powerFromBattery ?? 0) > 0
					? 'animateLeftToRight'
					: 'hidden'),
		bottomDot: 'hidden'
	})}
{/snippet}

{#snippet usageFlow()}
	{@render flow({
		color: 'bg-slate-500',
		topClass: 'top-2 right-[10px] w-full h-1',
		bottomClass: 'top-2 right-[10px] w-1 h-5 pb-5',
		topDot:
			'top-[-2px] right-[-2px] ' +
			((realTimeInfo.powerUsage ?? 0) > 0 ? 'animateLeftToRight' : 'hidden'),
		bottomDot: 'hidden'
	})}
{/snippet}

<div class="h-[10em]">
	{#await getRealTimeInfo()}
		<InverterLiveGraphSkeleton />
	{:then _}
		<div class="text-inactive relative top-[-1em] text-xs">{lastUpdateTime}</div>
		<div class="grid grid-cols-3">
			<div>
				{@render productionCorner()}
			</div>
			<div></div>
			<div>
				{@render gridCorner()}
			</div>

			<div>{@render productionFlow()}</div>
			<div class={'row-span-2 flex justify-center align-middle'}>
				<HomeIcon
					class="mt-1 h-10 w-10 rounded-full border-2 border-primary/70 bg-primary/20 p-1.5 text-white/80"
				></HomeIcon>
			</div>
			<div>{@render gridFlow()}</div>
			<div>{@render batteryFlow()}</div>
			<div>{@render usageFlow()}</div>

			<div class={'mt-3'}>
				{@render batteryCorner()}
			</div>
			<div></div>
			<div class={'mt-3'}>
				{@render usageCorner()}
			</div>
		</div>
	{/await}
</div>

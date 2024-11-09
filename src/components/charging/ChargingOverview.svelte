<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { BatteryIcon, CarIcon, SunIcon, UnplugIcon, ZapIcon } from 'lucide-svelte';
	import { vConsole } from '$lib/classes/vconsole';
	import type { IChargingInfo } from '$lib/classes/charging';
	import { invalidate, invalidateAll } from '$app/navigation';
	import { Toaster } from '$lib/components/ui/sonner';
	import { toast } from 'svelte-sonner';

	let chargingInfo = $state({} as IChargingInfo);
	let chaningChargingPower = $state(false);

	const getChargingInfo = async (): Promise<void> => {
		const res = await fetch(`/api/charging`);
		chargingInfo = await res.json();

		if ((chargingInfo?.kw ?? 0) > 0) status = chargingInfo.suggestion.currentChargingReason as any;
		else if (chargingInfo?.carStatus === 'unknown') status = 'no_car';
		else status = 'not_charging';
	};

	const isExcessChargingEnabled = $derived(chargingInfo.userSettings.chargeWithExcessIsOn);
	const isForceChargingEnabled = $derived(chargingInfo.userSettings.forceChargeIsOn);
	const isBatteryChargingEnabled = $derived(
		(chargingInfo.userSettings.chargeUntilMinBattery ?? 100) < 100
	);

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
		// if (status === 'excess') return ['excess', 'force', 'battery'];
		// else if (status === 'battery') return ['battery', 'force', 'excess'];
		return ['excess', 'force', 'battery'];
	});

	const click = async (event: MouseEvent) => {
		if (chargingInfo?.suggestion?.suggestedKw < 0) return;

		event.stopPropagation();
		event.preventDefault();
		await changeChargingPower(chargingInfo.suggestion.suggestedKw);
	};

	const changeChargingPower = async (kw: number) => {
		chaningChargingPower = true;
		const response = await fetch(`/api/charging`, {
			headers: {
				'Content-Type': 'application/json'
			},
			method: 'POST',
			body: JSON.stringify({ kw })
		});
		const result = await response.json();
		chaningChargingPower = false;

		console.log('result of set charging', result);
		if (result.status === 'success') {
			toast.success('Charging speed changed');
			setTimeout(() => {
				invalidateAll();
			}, 2000);
		} else toast.error('Failed to set charging speed');
	};

	const getForceChargeSfx = (): string => {
		let ret = ' ';
		if (chargingInfo.userSettings.useAwattar)
			ret +=
				' (' +
				chargingInfo.userSettings.forceChargeKw +
				' kw, price < ' +
				chargingInfo.userSettings.forceChargeUnderCent +
				' cent)';
		else ret += ' (' + chargingInfo.userSettings.forceChargeKw + ' kw)';
		return ret;
	};
</script>

<Toaster />

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

{#snippet renderStatusLine(isActive, text, subText = '', isEnabled = false)}
	<div class={isActive ? 'text-xl ' + mainColor : isEnabled ? 'text-md' : 'text-inactive text-sm'}>
		{text}<span class="text-xs">{subText}</span>
	</div>
{/snippet}

{#snippet renderExcessChargingLine()}
	{#if status === 'excess'}
		{@render renderStatusLine(true, 'excess charging')}
	{:else if isExcessChargingEnabled}
		{@render renderStatusLine(false, 'excess charging enabled', '', true)}
	{:else}
		{@render renderStatusLine(false, 'excess charging disabled', '', false)}
	{/if}
{/snippet}

{#snippet renderForceChargingLine()}
	{#if status === 'force'}
		{@render renderStatusLine(true, 'force charging')}
	{:else if isForceChargingEnabled}
		{@render renderStatusLine(false, 'force charging enabled', getForceChargeSfx(), true)}
	{:else}
		{@render renderStatusLine(false, 'force charging disabled', '', false)}
	{/if}
{/snippet}

{#snippet renderBatteryChargingLine()}
	{#if status === 'battery'}
		{@render renderStatusLine(true, 'charging from battery')}
	{:else if isBatteryChargingEnabled}
		{@render renderStatusLine(
			false,
			'battery charging enabled',
			'(>' + chargingInfo.userSettings.chargeUntilMinBattery + '%)',
			true
		)}
	{:else}
		{@render renderStatusLine(false, 'battery charging disabled', '', false)}
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
			{chargingInfo?.kw} kw
			<span class="pl-1 text-xs">{chargingInfo?.phase}p|{chargingInfo?.ampere}a</span>
		{/if}
	</span>
{/snippet}

{#snippet renderSubTitle()}
	<span class="text-inactive text-xs">
		{#if chargingInfo?.suggestion.suggestedKw === 0}
			suggestion: don't charge
		{:else if chargingInfo?.suggestion.suggestedKw > 0}
			suggestion: charge with {chargingInfo?.suggestion.suggestedKw} kw
		{:else}
			&nbsp;
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

<div class="h-[9.5em]">
	{#await getChargingInfo()}
		{@render skeleton()}
	{:then _}
		{#if chaningChargingPower}
			{@render skeleton()}
		{:else}
			{@const iconClass = 'mt-2 h-8 w-8 text-slate-400'}
			<div
				class="mb-4 flex flex items-center justify-center gap-2"
				onclick={(event) => click(event)}
			>
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
					<div class="mt-[-1em]">
						{@render renderSubTitle()}
					</div>
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
		{/if}
	{/await}
</div>

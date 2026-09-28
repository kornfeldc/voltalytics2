<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Button } from '$lib/components/ui/button/index';
	import { Slider } from '$lib/components/ui/slider/index';
	import { BatteryIcon, CarIcon, PauseIcon, SunIcon, UnplugIcon, ZapIcon } from 'lucide-svelte';
	import { vConsole } from '$lib/classes/vconsole';
	import { type IChargingInfo, isManualChargeActive } from '$lib/classes/charging';
	import { invalidate, invalidateAll } from '$app/navigation';
	import { Toaster } from '$lib/components/ui/sonner';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import NoData from '../system/NoData.svelte';

	let chargingInfo = $state({} as IChargingInfo);
	let chaningChargingPower = $state(false);
	let chargingIsPaused = $derived(chargingInfo.userSettings.pauseCharging);
	let loading = $state(false);

	const getChargingInfo = async (): Promise<void> => {
		await loadChargingInfo();
	};

	const loadChargingInfo = async (): Promise<void> => {
		const res = await fetch(`/api/charging?antic=` + new Date().getTime());
		chargingInfo = await res.json();

		if ((chargingInfo?.kw ?? 0) > 0) status = chargingInfo.suggestion.currentChargingReason as any;
		else if (chargingInfo?.carStatus === 'unknown') status = 'no_car';
		else status = 'not_charging';

		if (!boostDefaultsSet && chargingInfo.userSettings) {
			boostKw =
				chargingInfo.userSettings.forceChargeKw ?? chargingInfo.userSettings.maxChargingPower;
			boostDefaultsSet = true;
		}
	};

	const isExcessChargingEnabled = $derived(chargingInfo.userSettings.chargeWithExcessIsOn);
	const isForceChargingEnabled = $derived(chargingInfo.userSettings.forceChargeIsOn);
	const isBatteryChargingEnabled = $derived(
		(chargingInfo.userSettings.chargeUntilMinBattery ?? 100) < 100
	);

	let status = $state(
		'no_car' as 'boost' | 'force' | 'excess' | 'battery' | 'not_charging' | 'no_car'
	);
	const isCharging = $derived(status !== 'not_charging' && status !== 'no_car');
	const mainColor = $derived(
		status === 'excess'
			? 'text-neutral'
			: status === 'battery'
				? 'text-neutral2'
				: status === 'force' || status === 'boost'
					? 'text-negative'
					: 'text-inactive'
	);

	const isBoostActive = $derived(
		!!chargingInfo.userSettings && isManualChargeActive(chargingInfo.userSettings)
	);
	let showBoostOptions = $state(false);
	let boostKw = $state(1.5);
	let boostDurationMinutes = $state(0); // 0 = until manually stopped
	let boostDefaultsSet = $state(false);

	const statusOrder = $derived.by(() => {
		// if (status === 'excess') return ['excess', 'force', 'battery'];
		// else if (status === 'battery') return ['battery', 'force', 'excess'];
		return ['excess', 'force', 'battery'];
	});

	const click = async (event: MouseEvent) => {
		event.stopPropagation();
		event.preventDefault();
		if (chargingInfo?.suggestion?.suggestedKw < 0) return;
		await changeChargingPower(chargingInfo.suggestion.suggestedKw);
	};

	const togglePause = async (event: MouseEvent) => {
		event.stopPropagation();
		event.preventDefault();

		console.log('set');
		loading = true;
		const res = await fetch('/api/set_pause_charging?pauseCharging=' + !chargingIsPaused, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});
		await res.json();

		loading = true;
		await changeChargingPowerToSuggestion();
		loading = false;
	};

	const changeChargingPower = async (kw: number, setSuggested = false) => {
		chaningChargingPower = true;

		const endpoint = setSuggested ? '/api/charging_to_suggestion' : '/api/charging';
		const body = setSuggested ? {} : { kw };

		const response = await fetch(endpoint, {
			headers: {
				'Content-Type': 'application/json'
			},
			method: 'POST',
			body: JSON.stringify(body)
		});
		const result = await response.json();

		setTimeout(async () => {
			await loadChargingInfo();

			chaningChargingPower = false;

			console.log('result of set charging', result);
			if (result.status === 'success') {
				toast.success('Charging speed changed');
			} else toast.error('Failed to set charging speed');
		}, 5000);
	};

	const changeChargingPowerToSuggestion = async () => {
		await changeChargingPower(0, true);
	};

	const setManualCharging = async (on: boolean) => {
		loading = true;

		const body = on
			? { on: true, kw: boostKw, durationMinutes: boostDurationMinutes || undefined }
			: { on: false };
		const res = await fetch('/api/manual_charging', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const result = await res.json();

		setTimeout(async () => {
			await loadChargingInfo();
			showBoostOptions = false;
			loading = false;

			if (result.status === 'success') {
				toast.success(on ? 'Boost charging started' : 'Boost charging stopped');
			} else toast.error(result.message ?? 'Failed to change boost charging');
		}, 5000);
	};

	const getBoostSubText = (): string => {
		const until = chargingInfo.userSettings?.manualChargeUntil;
		if (!until) return '';
		const time = new Date(until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		return ' until ' + time;
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

	const settingsChanged = async () => {
		console.log('settings got changed');
		document.removeEventListener('settingsChanged', settingsChanged);
		loading = true;
		await changeChargingPowerToSuggestion();
		loading = false;
	};

	onMount(() => {
		reload(true);

		document.removeEventListener('settingsChanged', settingsChanged);
		document.addEventListener('settingsChanged', settingsChanged);
	});

	const reload = (first = false) => {
		if (!first) {
			const dialog = document.querySelector('div[role="dialog"]');
			if (!dialog) getChargingInfo();
		}
		setTimeout(() => {
			reload();
		}, 120 * 1000);
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
	{#if status === 'excess' && !chargingIsPaused}
		{@render renderStatusLine(true, 'Excess charging')}
	{:else if isExcessChargingEnabled}
		{@render renderStatusLine(false, 'Excess charging enabled', '', true)}
	{:else}
		{@render renderStatusLine(false, 'Excess charging disabled', '', false)}
	{/if}
{/snippet}

{#snippet renderBoostChargingLine()}
	{#if isBoostActive}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="flex items-center justify-between" onclick={(e) => e.stopPropagation()}>
			<div class="text-negative text-xl">
				Boost charging<span class="text-xs">
					({chargingInfo.userSettings.manualChargeKw} kw{getBoostSubText()})</span
				>
			</div>
			<Button
				variant="outline"
				size="sm"
				onclick={(e: MouseEvent) => {
					e.preventDefault();
					e.stopPropagation();
					setManualCharging(false);
				}}>Stop</Button
			>
		</div>
	{:else if showBoostOptions}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="flex w-full flex-col gap-2" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center gap-2">
				<span class="text-inactive w-14 shrink-0 text-xs">Boost kw</span>
				<div class="grow pr-2">
					<Slider
						value={[boostKw]}
						onValueChange={(v) => {
							boostKw = v[0];
						}}
						min={chargingInfo.userSettings.minChargingPower}
						max={chargingInfo.userSettings.maxChargingPower}
						step={0.1}
					/>
				</div>
				<span class="text-inactive w-12 text-right text-xs">{boostKw} kw</span>
			</div>
			<div class="flex gap-1">
				{#each [0, 60, 120, 240, 480] as minutes (minutes)}
					<Button
						class="flex-1"
						variant={boostDurationMinutes === minutes ? 'default' : 'outline'}
						size="sm"
						onclick={() => (boostDurationMinutes = minutes)}>
						{minutes === 0 ? '∞' : minutes / 60 + 'h'}
					</Button>
				{/each}
			</div>
			<div class="flex gap-1">
				<Button class="flex-1" size="sm" onclick={() => setManualCharging(true)}>Start</Button>
				<Button
					class="flex-1"
					variant="outline"
					size="sm"
					onclick={() => (showBoostOptions = false)}>Cancel</Button>
			</div>
		</div>
	{:else}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="text-inactive flex items-center justify-between text-sm"
			onclick={(e) => e.stopPropagation()}>
			<span>Boost<span class="text-xs"> (charge now, no matter what)</span></span>
			<Button
				variant="outline"
				size="sm"
				onclick={() => (showBoostOptions = true)}>Start</Button>
		</div>
	{/if}
{/snippet}

{#snippet renderForceChargingLine()}
	{#if status === 'force' && !chargingIsPaused}
		{@render renderStatusLine(true, 'Force charging')}
	{:else if isForceChargingEnabled}
		{@render renderStatusLine(false, 'Force charging enabled', getForceChargeSfx(), true)}
	{:else}
		{@render renderStatusLine(false, 'Force charging disabled', '', false)}
	{/if}
{/snippet}

{#snippet renderBatteryChargingLine()}
	{#if status === 'battery' && !chargingIsPaused}
		{@render renderStatusLine(true, 'Charging from battery')}
	{:else if isBatteryChargingEnabled}
		{@render renderStatusLine(
			false,
			'Battery charging enabled',
			'(>' + chargingInfo.userSettings.chargeUntilMinBattery + '%)',
			true
		)}
	{:else}
		{@render renderStatusLine(false, 'Battery charging disabled', '', false)}
	{/if}
{/snippet}

{#snippet renderTitle()}
	{@const className = mainColor + (isCharging ? ' text-xl ' : ' text-md')}

	<span class={className}>
		{#if status === 'not_charging'}
			Not charging
		{:else if status === 'no_car'}
			No car plugged in
		{:else}
			{chargingInfo?.kw} kw
			<span class="pl-1 text-xs">{chargingInfo?.phase}p|{chargingInfo?.ampere}a</span>
		{/if}
	</span>
{/snippet}

{#snippet renderSubTitle()}
	<span class="text-inactive text-xs">
		{#if chargingIsPaused}
			charging is paused
		{:else if chargingInfo?.suggestion.suggestedKw === 0}
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

<div class="min-h-[11.5em]">
	{#await getChargingInfo()}
		{@render skeleton()}
	{:then _}
		{#if loading}
			{@render skeleton()}
		{:else if chaningChargingPower}
			{@render skeleton()}
		{:else if !chargingInfo.suggestion.allDataAvailable}
			<NoData></NoData>
		{:else}
			{@const iconClass = 'mt-2 h-8 w-8 text-slate-400'}
			<div class="mb-4 flex items-center justify-center gap-2" onclick={(event) => click(event)}>
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
				{#if chargingIsPaused}
					<PauseIcon class="{iconClass} text-inactive" onclick={(event) => togglePause(event)} />
				{:else if status === 'no_car'}
					<UnplugIcon class="{iconClass} text-inactive" onclick={(event) => togglePause(event)} />
				{:else}
					<CarIcon class={iconClass} onclick={(event) => togglePause(event)} />
				{/if}
			</div>
			<div class="flex flex-col">
				{@render renderBoostChargingLine()}
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

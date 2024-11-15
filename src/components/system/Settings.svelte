<!--suppress ES6UnusedImports -->
<script lang="ts">
	import { signOut } from '@auth/sveltekit/client';
	import { Button } from '$lib/components/ui/button/index';
	import { Label } from '$lib/components/ui/label/index';
	import { Input } from '$lib/components/ui/input/index';
	import { Switch } from '$lib/components/ui/switch/index';
	import { Slider } from '$lib/components/ui/slider/index';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select';
	import * as Avatar from '$lib/components/ui/avatar/index';
	import * as Tabs from '$lib/components/ui/tabs/index';
	// noinspection ES6UnusedImports
	import * as Drawer from '$lib/components/ui/drawer/index';

	import { page } from '$app/stores';
	import { UserIcon } from 'lucide-svelte';
	import { type IUserSettings } from '$lib/classes/db';
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	import type { ICalculationSuggestion } from '$lib/classes/charging';

	let { userSettings, saved }: { userSettings: IUserSettings; saved: () => void } = $props();
	let formData = $state(userSettings);

	let calculating = $state(false);
	let calculationResult = $state({} as ICalculationSuggestion);

	let initialTab = $derived.by(() => {
		return formData.solarManAppEmail || formData.solarEdgeApiKey ? 'settings' : 'setup';
	});

	const inverterOptions = [
		{ value: '', label: "Don't use inverter data" },
		{ value: 'solarman', label: 'SolarMan' },
		{ value: 'solaredge', label: 'SolarEdge' }
	];

	const wallBoxOptions = [
		{ value: '', label: "Don't use wallbox" },
		{ value: 'goe', label: 'Go-E' }
	];

	let currentInverter = $derived.by(() => {
		return inverterOptions.find((i) => i.value === formData.currentInverter)!;
	});
	let currentWallbox = $derived.by(() => {
		return wallBoxOptions.find((i) => i.value === formData.currentWallbox)!;
	});

	let userImage = $derived($page.data?.session?.user?.image);
	let userName = $derived($page.data?.session?.user?.email);
	let isChargingPossible = $derived.by(() => {
		return formData.currentInverter !== '' && formData.currentWallbox !== '';
	});

	const changeInverter = (option: any) => {
		formData.currentInverter = option.value;
	};

	const changeWallbox = (option: any) => {
		formData.currentWallbox = option.value;
	};

	const save = async () => {
		await saveWithoutUi();
		saved();
	};

	const saveWithoutUi = async () => {
		const body = JSON.stringify(formData);
		const res = await fetch('/api/save_settings', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body
		});
		await res.json();
	};

	const calculate = async () => {
		calculating = true;
		await saveWithoutUi();
		const response = await fetch('/api/calculation');
		calculationResult = await response.json();
		calculating = false;
	};

	const useCalculationResult = async () => {
		formData.forceChargeIsOn = true;
		formData.forceChargeKw = calculationResult.suggestedKwToSet;
		formData.forceChargeUnderCent = calculationResult.suggestedPriceToSet;
		await save();
	};

	const formatValue = (val: number) => {
		return new Intl.NumberFormat('de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(val);
	};
</script>

{#snippet renderCalculationResult()}
	{#if calculationResult?.status}
		<Card.Root class="mt-4">
			<Card.Content class="p-4">
				{#if calculationResult.status === 'no_suggestion'}
					no suggestion available
				{:else if calculationResult.status === 'suggestion'}
					<h1>Result</h1>
					<div class="grid grid-cols-4 gap-2 pt-2">
						<div class="col-span-3">Suggested max cents per kWh:</div>
						<div class="text-right">
							{formatValue(calculationResult.suggestedPriceToSet ?? 0)}
						</div>

						<div class="col-span-3">Suggested kw:</div>
						<div class="text-right">
							{formatValue(calculationResult.suggestedKwToSet ?? 0)}
						</div>

						<div class="col-span-3">Hours charging:</div>
						<div class="text-right">
							{calculationResult.hoursCharging}
						</div>

						<div class="col-span-3">Estimated price:</div>
						<div class="text-right">
							{formatValue(calculationResult.estimatedPrice ?? 0)} €
						</div>

						<Button class="col-span-4" onclick={() => useCalculationResult()}
							>Use as force charging parameters</Button
						>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
{/snippet}

{#snippet renderUserCard()}
	<Card.Root>
		<Card.Content class="p-2">
			<div class="flex items-center">
				<Avatar.Root class="mr-2">
					<Avatar.Image src={userImage} alt={userName} />
					<Avatar.Fallback>
						<UserIcon />
					</Avatar.Fallback>
				</Avatar.Root>
				<div class="grow">{userName}</div>
				<Button variant="secondary" onclick={() => signOut()}>Sign out</Button>
			</div>
		</Card.Content>
	</Card.Root>
{/snippet}

<div class="w-full p-4">
	<Tabs.Root value={initialTab}>
		<Tabs.Content value="setup" class="focus-visible:ring-0">
			{@render renderUserCard()}

			<div class="mt-8 grid grid-cols-4 items-center gap-y-2">
				<Label>Inverter</Label>
				<Select.Root selected={currentInverter} onSelectedChange={changeInverter}>
					<Select.Trigger class="col-span-3">
						<Select.Value placeholder={inverterOptions[0].label} />
					</Select.Trigger>
					<Select.Content>
						{#each inverterOptions as inverterOption}
							<Select.Item value={inverterOption.value} label={inverterOption.label}>
								{inverterOption.label}</Select.Item
							>
						{/each}
					</Select.Content>
					<Select.Input name="inverter" />
				</Select.Root>

				{#if formData.currentInverter === 'solarman'}
					<Label>Email</Label>
					<Input class="col-span-3" bind:value={formData.solarManAppEmail} />

					<Label>App Id</Label>
					<Input class="col-span-3" bind:value={formData.solarManAppId} />

					<Label>Secret</Label>
					<Input class="col-span-3" bind:value={formData.solarManAppSecret} />

					<Label>Password</Label>
					<Input class="col-span-3" bind:value={formData.solarManAppPw} />
				{/if}

				{#if formData.currentInverter === 'solaredge'}
					<Label>Api Key</Label>
					<Input class="col-span-3" bind:value={formData.solarEdgeApiKey} />

					<Label>Account Key</Label>
					<Input class="col-span-3" bind:value={formData.solarEdgeAccountKey} />
				{/if}

				<div class="col-span-4 my-3"></div>

				<Label>Wallbox</Label>
				<Select.Root selected={currentWallbox} onSelectedChange={changeWallbox}>
					<Select.Trigger class="col-span-3">
						<Select.Value placeholder={wallBoxOptions[0].label} />
					</Select.Trigger>
					<Select.Content>
						{#each wallBoxOptions as wallBoxOption}
							<Select.Item value={wallBoxOption.value} label={wallBoxOption.label}>
								{wallBoxOption.label}</Select.Item
							>
						{/each}
					</Select.Content>
					<Select.Input name="wallbox" />
				</Select.Root>

				{#if formData.currentWallbox === 'goe'}
					<Label>SerialNr</Label>
					<Input class="col-span-3" bind:value={formData.goESerial} />

					<Label>Api Token</Label>
					<Input class="col-span-3" bind:value={formData.goEApiToken} />
				{/if}

				<div class="col-span-4 my-3"></div>

				<Label>Use Awattar</Label>
				<Switch bind:checked={formData.useAwattar} id="awattar"></Switch>

				<Drawer.Close class="col-span-4 mt-4">
					<Button class="w-full" onclick={() => save()}>SAVE</Button>
				</Drawer.Close>
			</div>
		</Tabs.Content>

		<Tabs.Content value="settings" class="focus-visible:ring-0">
			<div class="mt-8 grid grid-cols-4 items-center gap-y-2">
				{#if isChargingPossible}
					<Label class="col-span-3">Use suggestions automatically</Label>
					<Switch class="justify-self-end" bind:checked={formData.autoExecuteSuggestions}></Switch>

					<Label class="col-span-3">Activate Excess Charging</Label>
					<Switch class="justify-self-end" id="excess" bind:checked={formData.chargeWithExcessIsOn}
					></Switch>

					{#if (formData.chargeUntilMinBattery ?? 0) < 100}
						<div class="col-span-4 mt-4"></div>
					{/if}
					<Label class="col-span-3">Activate Charging from PV Battery</Label>
					<Switch
						class="justify-self-end"
						id="force"
						checked={(formData.chargeUntilMinBattery ?? 0) < 100}
						onCheckedChange={(v) => {
							formData.chargeUntilMinBattery = v ? 70 : 100;
						}}
					></Switch>
					{#if (formData.chargeUntilMinBattery ?? 0) < 100}
						<Label class="col-span-3">Always charge when battery is above (%)</Label>
						<div class="col-span-3 pr-3">
							<Slider
								value={[formData.chargeUntilMinBattery ?? 0]}
								onValueChange={(v) => {
									formData.chargeUntilMinBattery = v[0];
								}}
								min={10}
								max={90}
								step={5}
							/>
						</div>
						<Input type="number" bind:value={formData.chargeUntilMinBattery} readonly />
						<div class="col-span-4 mb-4"></div>
					{/if}

					<!--{#if formData.forceChargeIsOn || (formData.chargeUntilMinBattery ?? 0) < 100}-->
					<!--	<div class="col-span-4 my-3"></div>-->
					<!--{/if}-->

					{#if formData.forceChargeIsOn && (formData.chargeUntilMinBattery ?? 0) === 100}
						<div class="col-span-4 mt-4"></div>
					{/if}
					<Label class="col-span-3">Activate Force Charging</Label>
					<Switch class="justify-self-end" id="force" bind:checked={formData.forceChargeIsOn}
					></Switch>

					{#if formData.forceChargeIsOn}
						<Label class="col-span-3">Turn off force charging in the morning</Label>
						<Switch class="justify-self-end" bind:checked={formData.autoTurnOffForceCharging}
						></Switch>

						{#if formData.useAwattar}
							<Label class="col-span-4 mt-3">Force charge when Awattar price is below cent</Label>
							<div class="col-span-3 pr-3">
								<Slider
									value={[formData.forceChargeUnderCent ?? 0]}
									onValueChange={(v) => {
										formData.forceChargeUnderCent = v[0];
									}}
									min={-10}
									max={25}
									step={0.1}
								/>
							</div>
							<Input type="number" bind:value={formData.forceChargeUnderCent} readonly />
						{/if}

						<Label class="col-span-4 mt-3">Force charge kw</Label>
						<div class="col-span-3 pr-3">
							<Slider
								value={[formData.forceChargeKw ?? 1]}
								onValueChange={(v) => {
									formData.forceChargeKw = v[0];
								}}
								min={1}
								max={10}
								step={0.5}
							/>
						</div>
						<Input type="number" bind:value={formData.forceChargeKw} readonly />
					{/if}

					<Drawer.Close class="col-span-4 mt-4">
						<Button class="w-full" onclick={() => save()}>SAVE</Button>
					</Drawer.Close>
				{/if}
			</div>
		</Tabs.Content>

		<Tabs.Content value="calculator" class="focus-visible:ring-0">
			<div class="mb-8 mt-8 grid grid-cols-4 items-center gap-y-2">
				<Label class="col-span-3">Vehicle Battery Capacity in kWh</Label>
				<Input
					type="number"
					min="5"
					max="120"
					class="col-span-1"
					bind:value={formData.carBatteryKwh}
				></Input>

				<Label class="col-span-4 mt-3">Current State of Charge in %</Label>
				<div class="col-span-3 pr-3">
					<Slider
						value={[formData.carBatteryCurrentPercent ?? 50]}
						onValueChange={(v) => {
							formData.carBatteryCurrentPercent = v[0];
						}}
						min={1}
						max={100}
						step={1}
					/>
				</div>
				<Input type="number" readonly bind:value={formData.carBatteryCurrentPercent} />

				<Label class="col-span-4 mt-3">Target State of Charge in %</Label>
				<div class="col-span-3 pr-3">
					<Slider
						value={[formData.carBatteryTargetPercent ?? 80]}
						onValueChange={(v) => {
							formData.carBatteryTargetPercent = v[0];
						}}
						min={1}
						max={100}
						step={1}
					/>
				</div>
				<Input type="number" readonly bind:value={formData.carBatteryTargetPercent} />

				<Label class="col-span-4 mt-3">Target Hour</Label>
				<div class="col-span-3 pr-3">
					<Slider
						value={[formData.carBatteryTargetHour ?? 6]}
						onValueChange={(v) => {
							formData.carBatteryTargetHour = v[0];
						}}
						min={0}
						max={23}
						step={1}
					/>
				</div>
				<Input type="number" readonly bind:value={formData.carBatteryTargetHour} />
			</div>

			<Button variant="outline" class="w-full border-primary" onclick={() => calculate()}
				>CALCULATE</Button
			>

			{#if calculating}
				<div class="mt-4 flex w-full justify-center">
					<LoaderCircle class="mr-2 h-12 w-12 animate-spin" />
				</div>
			{:else}
				{@render renderCalculationResult()}
			{/if}
		</Tabs.Content>

		{#if isChargingPossible}
			<Tabs.List
				class="mt-4 grid w-full {isChargingPossible && formData.useAwattar
					? 'grid-cols-3'
					: 'grid-cols-2'}"
			>
				<Tabs.Trigger value="setup">Setup</Tabs.Trigger>
				<Tabs.Trigger value="settings">Settings</Tabs.Trigger>
				{#if isChargingPossible && formData.useAwattar}
					<Tabs.Trigger value="calculator">Calculator</Tabs.Trigger>
				{/if}
			</Tabs.List>
		{/if}
	</Tabs.Root>
</div>

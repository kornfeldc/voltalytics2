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

	let { userSettings, saved }: { userSettings: IUserSettings; saved: () => void } = $props();
	let formData = $state(userSettings);

	let initialTab = $derived.by(() => {
		return formData.solarManAppEmail ? 'settings' : 'setup';
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
		const body = JSON.stringify(formData);
		const res = await fetch('/api/save_settings', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body
		});
		await res.json();
		saved();
	};
</script>

<div class="w-full p-4">
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

	<Tabs.Root value={initialTab}>
		<Tabs.Content value="setup">
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

		<Tabs.Content value="settings">
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
						<Slider
							class="col-span-3 pr-4"
							value={[formData.chargeUntilMinBattery ?? 0]}
							onValueChange={(v) => {
								formData.chargeUntilMinBattery = v[0];
							}}
							min={10}
							max={90}
							step={5}
						/>
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
							<Slider
								class="col-span-3 pr-4"
								value={[formData.forceChargeUnderCent ?? 0]}
								onValueChange={(v) => {
									formData.forceChargeUnderCent = v[0];
								}}
								min={-10}
								max={25}
								step={0.1}
							/>
							<Input type="number" bind:value={formData.forceChargeUnderCent} readonly />
						{/if}

						<Label class="col-span-4 mt-3">Force charge kw</Label>
						<Slider
							class="col-span-3 pr-4 "
							value={[formData.forceChargeKw ?? 1]}
							onValueChange={(v) => {
								formData.forceChargeKw = v[0];
							}}
							min={1}
							max={10}
							step={0.5}
						/>
						<Input type="number" bind:value={formData.forceChargeKw} readonly />
					{/if}

					<Drawer.Close class="col-span-4 mt-4">
						<Button class="w-full" onclick={() => save()}>SAVE</Button>
					</Drawer.Close>
				{/if}
			</div>
		</Tabs.Content>
		{#if isChargingPossible}
			<Tabs.List class="mt-4 grid w-full grid-cols-2">
				<Tabs.Trigger value="setup">Setup</Tabs.Trigger>
				<Tabs.Trigger value="settings">Settings</Tabs.Trigger>
			</Tabs.List>
		{/if}
	</Tabs.Root>
</div>

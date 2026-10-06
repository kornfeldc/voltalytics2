<script lang="ts">
	import AwattarChart from '../../../components/awattar/AwattarChart.svelte';
	import type { IUserSettings } from '$lib/classes/db';

	let { data }: { data: { userSettings: Promise<IUserSettings> } } = $props();
	let userSettings = $state(undefined as IUserSettings | undefined);

	$effect(() => {
		data.userSettings.then((settings: IUserSettings) => (userSettings = settings));
	});
</script>

<section>
	<div class="mb-2 grid grid-cols-2 p-2">
		<h1>prices</h1>
		<p class="text-right text-sm text-muted-foreground">cent/kWh</p>
	</div>
	<AwattarChart {userSettings} />
</section>
<script lang="ts">
	import InverterLiveGraph from '../inverter/InverterLiveGraph.svelte';
	import InverterDayChartContainer from '../inverter/InverterDayChartContainer.svelte';

	/** False when the 3D house view shows the live flows (FEATURES.md #3). */
	let { graph = true }: { graph?: boolean } = $props();
</script>

<div class="mb-2">
	{#if graph}<InverterLiveGraph />{/if}
	<InverterDayChartContainer />
</div>

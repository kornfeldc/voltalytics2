<script lang="ts">
	import type { IInverterRealTimeData } from '$lib/classes/interver';
	import moment from 'moment/moment';
	import InverterDayChart from './InverterDayChart.svelte';

	let data: IInverterRealTimeData[] = $state([]);
	const getData = async (): Promise<IInverterRealTimeData[]> => {
		const res = await fetch(
			`/api/inverter/timeframe?dayFrom=${moment().format('YYYY-MM-DD')}&dayTo=${moment().format('YYYY-MM-DD')}`
		);
		return await res.json();
	};
</script>

<div class="h-[11em] pt-4">
	{#await getData()}
		loading
	{:then data}
		<InverterDayChart {data} showLegend={false} showWholeDay={false} />
	{/await}
</div>

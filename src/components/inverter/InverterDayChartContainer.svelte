<script lang="ts">
	import type { IInverterRealTimeData } from '$lib/classes/interver';
	import moment from 'moment/moment';
	import InverterDayChart from './InverterDayChart.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';

	let data: IInverterRealTimeData[] = $state([]);
	const getData = async (): Promise<IInverterRealTimeData[]> => {
		const res = await fetch(
			`/api/inverter/timeframe?dayFrom=${moment().format('YYYY-MM-DD')}&dayTo=${moment().format('YYYY-MM-DD')}`
		);
		return await res.json();
	};
</script>

<div class="h-[12em] pt-4">
	{#await getData()}
		<div class="flex w-full items-center justify-center gap-2 pt-4 align-middle">
			<Skeleton class="h-[9em] w-[1em]"></Skeleton>
			<Skeleton class="h-[1em] grow"></Skeleton>
		</div>
	{:then data}
		<InverterDayChart {data} showLegend={false} showWholeDay={false} />
	{/await}
</div>

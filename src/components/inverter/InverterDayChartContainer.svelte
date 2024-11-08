<script lang="ts">
	import type { IInverterRealTimeData } from '$lib/classes/interver';
	import moment from 'moment/moment';
	import InverterDayChart from './InverterDayChart.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';

	let { day = moment().format('YYYY-MM-DD') }: { day?: string } = $props();
	let data: IInverterRealTimeData[] = $state([]);
	const getData = async (): Promise<IInverterRealTimeData[]> => {
		const res = await fetch(`/api/inverter/timeframe?dayFrom=${day}&dayTo=${day}`);
		return await res.json();
	};
</script>

{#await getData()}
	<div class="h-[12em] pt-4">
		<div class="flex w-full items-center justify-center gap-2 pt-4 align-middle">
			<Skeleton class="h-[9em] w-[1em]"></Skeleton>
			<Skeleton class="h-[1em] grow"></Skeleton>
		</div>
	</div>
{:then data}
	{#if data.length >= 0}
		<div class="h-[12em] pt-4">
			<InverterDayChart {data} showLegend={false} showWholeDay={false} />
		</div>
	{/if}
{/await}

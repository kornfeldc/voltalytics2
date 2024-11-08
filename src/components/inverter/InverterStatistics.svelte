<script lang="ts">
	import type { IInverterStatistic } from '$lib/classes/interver';
	import moment from 'moment/moment';
	import InverterLiveGraphSkeleton from './InverterLiveGraphSkeleton.svelte';
	import InverterStatisticsSkeleton from './InverterStatisticsSkeleton.svelte';

	interface IProps {
		referenceDate: string;
		range?: 'day' | 'month' | 'year';
	}

	let { referenceDate = moment().format('YYYY-MM-DD'), range = 'day' }: IProps = $props();

	let statisticsData = $state({} as IInverterStatistic);
	const getStatisticsData = async (): Promise<void> => {
		const res = await fetch(
			`/api/inverter/statistics?referenceDate=${referenceDate}&range=${range}`
		);
		statisticsData = (await res.json())[0];
	};

	const gridConfig = [
		[
			['powerProduction', 'text-neutral', 'Production'],
			['powerFromGrid', 'text-negative text-right', 'From Grid']
		],
		[
			['powerToBattery', 'text-positive', 'To Battery'],
			['powerToGrid', 'text-positive text-right', 'To Grid']
		],
		[
			['powerFromBattery', 'text-neutral2', 'From Battery'],
			['powerUsage', 'text-warning text-right', 'Usage']
		]
	];

	const formatValue = (value: number): string => {
		return (value ?? 0).toLocaleString('de-DE', {
			minimumFractionDigits: range === 'day' ? 2 : 0,
			maximumFractionDigits: range === 'day' ? 2 : 0
		});
	};
</script>

<div class="h-[9em]">
	{#await getStatisticsData()}
		<InverterStatisticsSkeleton />
	{:then _}
		<div class="grid grid-cols-2 gap-1">
			{#each gridConfig as lineConfig}
				{#each lineConfig as columnConfig}
					{#if columnConfig.length === 0}
						<div></div>
					{:else}
						<div class={columnConfig[1]}>
							<div class="whitespace-nowrap text-xl tracking-tight">
								{formatValue(statisticsData[columnConfig[0]])}
								<span class="text-xs">kWh</span>
							</div>
							<div class="text-inactive whitespace-nowrap text-xs">
								{columnConfig[2]}
							</div>
						</div>
					{/if}
				{/each}
			{/each}
		</div>
	{/await}
</div>

<script lang="ts">
	import {
		CategoryScale,
		Chart,
		Chart as ChartJS,
		Filler,
		Legend,
		LinearScale,
		LineController,
		LineElement,
		PointElement,
		Title,
		Tooltip
	} from 'chart.js';

	import moment from 'moment';
	import type { IInverterRealTimeData } from '$lib/classes/interver';
	import { onMount } from 'svelte';

	interface IProps {
		data: IInverterRealTimeData[];
		showLegend: boolean;
		showWholeDay: boolean;
	}

	let { data, showLegend, showWholeDay }: IProps = $props();

	if (showWholeDay && data?.length > 0) {
		let act = moment(data[0].timestamp);
		let end = moment(act).endOf('day');
		while (act <= end) {
			if (!data.find((x) => moment(x.timestamp).isSame(act)))
				data.push({ timestamp: act.toDate() } as IInverterRealTimeData);
			act = act.add(5, 'minutes');
		}
	}

	const labels = $derived.by(() => {
		return data.map((x) => moment(x.timestamp).format('HH:mm'));
	});

	ChartJS.register(
		CategoryScale,
		LinearScale,
		PointElement,
		LineController,
		LineElement,
		Title,
		Tooltip,
		Filler,
		Legend
	);

	let options = {
		responsive: true,
		plugins: {
			legend: {
				position: 'top' as const
			},
			axis: {
				x: {
					ticks: {}
				}
			}
		},
		scales: {
			x: {
				ticks: {
					autoSkip: false,
					callback: (value: any, index: number) => {
						const val = labels[index];
						const displayLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:55'];
						return displayLabels.includes(val) ? (val == '23:55' ? '24:00' : val) : null;
					}
				}
			}
		}
	} as any;

	if (!showLegend) options.plugins.legend.display = false;

	const getRealPurchasePower = (item: IInverterRealTimeData): number => {
		if ((item.powerFromGrid ?? 0) !== 0) return item.powerFromGrid!;
		const usage = Math.abs(item.powerUsage ?? 0);
		const generation = Math.abs(item.powerProduction ?? 0);
		const discharge = Math.abs(item.powerFromBattery ?? 0);
		const theoreticalPurchase = usage - generation - discharge;
		if (theoreticalPurchase < 0) return 0;
		return theoreticalPurchase * -1;
	};

	const mapLineData = $derived.by(() => {
		return {
			labels: labels,
			datasets: [
				{
					fill: true,
					label: 'Production',
					data: data.map((x) => Math.abs(x.powerProduction ?? 0)),
					borderColor: 'rgb(59, 130, 246)',
					backgroundColor: 'rgba(59, 130, 246, 0.5)',
					borderWidth: 1,
					pointRadius: 0
				},
				{
					fill: true,
					label: 'Purchased',
					data: data.map((x) => getRealPurchasePower(x)),
					borderColor: 'rgb(244, 63, 94)',
					backgroundColor: 'rgba(244, 63, 94, 0.5)',
					borderWidth: 1,
					pointRadius: 0
				},
				{
					fill: true,
					label: 'Usage',
					data: data.map((x) => Math.abs(x.powerUsage ?? 0)),
					borderColor: 'rgb(251, 146, 60)',
					backgroundColor: 'rgba(251, 146, 60, 0.5)',
					borderWidth: 1,
					pointRadius: 0
				}
			]
		};
	});

	onMount(() => {
		const ctx = document.getElementById('chart') as HTMLCanvasElement;
		new Chart(ctx, {
			type: 'line',
			options: options,
			data: mapLineData
		});
	});
</script>

<canvas id="chart"></canvas>

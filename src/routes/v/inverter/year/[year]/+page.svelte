<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index';
	import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-svelte';
	import moment from 'moment/moment';
	import InverterStatistics from '../../../../../components/inverter/InverterStatistics.svelte';

	let { data }: { data: any } = $props();
	let referenceDate = $derived.by(() => {
		return moment(data.year, 'YYYY').startOf('year').format('YYYY');
	});

	let prevYear = $derived.by(() => {
		return moment(data.year).subtract(1, 'year').format('YYYY');
	});

	let nextYear = $derived.by(() => {
		if (moment(data.year).isSame(moment(), 'year')) return moment().format('YYYY');
		return moment(data.year).add(1, 'year').format('YYYY');
	});

	let monthsInYear = $derived.by(() => {
		const startOfYear = moment(data.year).startOf('year');
		let endOfYear = moment(startOfYear).endOf('year');
		if (endOfYear.isAfter(moment())) endOfYear = moment().startOf('month');

		return Array.from({ length: endOfYear.diff(startOfYear, 'months') + 1 }, (_, i) => {
			return moment(startOfYear).add(i, 'months').format('YYYY-MM-DD');
		}).reverse();
	});
</script>

<div class="mt-2 flex gap-2">
	<div class="grow"></div>
	<div>
		<Button variant="outline" href="/v/inverter/year/{prevYear}">
			<ChevronLeftIcon />
		</Button>
	</div>
	<div>
		<Button variant="outline">
			{data.year}
		</Button>
	</div>
	<div>
		<Button variant="outline" href="/v/inverter/year/{nextYear}">
			<ChevronRightIcon />
		</Button>
	</div>
	<div class="grow"></div>
</div>

<Card.Root class="mx-2 my-4 border-slate-900 shadow-lg shadow-slate-800">
	<Card.Content class="p-4">
		<InverterStatistics {referenceDate} range="year" />
	</Card.Content>
</Card.Root>

<div class="pt-4 text-center text-primary">Months</div>

{#each monthsInYear as month}
	<a href="/v/inverter/month/{month}">
		<Card.Root class="mx-2 my-4 border-slate-900 shadow-lg shadow-slate-800">
			<Card.Header class="p-2 text-center">
				{moment(month).format('MMMM YYYY')}
			</Card.Header>
			<Card.Content class="p-4 pt-0">
				<InverterStatistics referenceDate={month} range="month" />
			</Card.Content>
		</Card.Root>
	</a>
{/each}

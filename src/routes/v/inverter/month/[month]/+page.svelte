<script lang="ts">
	import InverterStatistics from '../../../../../components/inverter/InverterStatistics.svelte';
	import moment from 'moment';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index';
	import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-svelte';

	let { data }: { data: any } = $props();
	let referenceDate = $derived.by(() => {
		return moment(data.month, 'YYYY-MM').startOf('month').format('YYYY-MM-DD');
	});

	let prevMonth = $derived.by(() => {
		return moment(data.month).subtract(1, 'month').format('YYYY-MM');
	});

	let nextMonth = $derived.by(() => {
		if (moment(data.month).isSame(moment(), 'month')) return moment().format('YYYY-MM');
		return moment(data.month).add(1, 'month').format('YYYY-MM');
	});

	let navYear = $derived.by(() => {
		return moment(data.month).format('YYYY');
	});

	let daysInMonth = $derived.by(() => {
		const startOfMonth = moment(data.month).startOf('month');
		let endOfMonth = moment(startOfMonth).endOf('month');
		if (endOfMonth.isAfter(moment())) endOfMonth = moment().startOf('day');

		return Array.from({ length: endOfMonth.diff(startOfMonth, 'days') + 1 }, (_, i) => {
			return moment(startOfMonth).add(i, 'days').format('YYYY-MM-DD');
		}).reverse();
	});
</script>

<div class="mt-2 flex gap-2">
	<div class="grow"></div>
	<div>
		<Button variant="outline" href="/v/inverter/month/{prevMonth}">
			<ChevronLeftIcon />
		</Button>
	</div>
	<div>
		<Button variant="outline" href="/v/inverter/year/{navYear}">
			{data.month}
		</Button>
	</div>
	<div>
		<Button variant="outline" href="/v/inverter/month/{nextMonth}">
			<ChevronRightIcon />
		</Button>
	</div>
	<div class="grow"></div>
</div>

<Card.Root class="mx-2 my-4 border-slate-900 shadow-lg shadow-slate-800">
	<Card.Content class="p-4">
		<InverterStatistics {referenceDate} range="month" />
	</Card.Content>
</Card.Root>

<div class="pt-4 text-center text-primary">Days</div>

{#each daysInMonth as day}
	<a href="/v/inverter/day/{day}">
		<Card.Root class="mx-2 my-4 border-slate-900 shadow-lg shadow-slate-800">
			<Card.Header class="p-2 text-center">
				{day}
			</Card.Header>
			<Card.Content class="p-4 pt-0">
				<InverterStatistics referenceDate={day} range="day" />
			</Card.Content>
		</Card.Root>
	</a>
{/each}

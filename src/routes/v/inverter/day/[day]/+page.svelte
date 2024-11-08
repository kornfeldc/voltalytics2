<script lang="ts">
	import InverterDayChartContainer from '../../../../../components/inverter/InverterDayChartContainer.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowLeftCircleIcon,
		ArrowLeftIcon,
		ChevronLeftIcon,
		ChevronRightIcon
	} from 'lucide-svelte';
	import moment from 'moment';
	import * as Card from '$lib/components/ui/card/index';
	import InverterStatistics from '../../../../../components/inverter/InverterStatistics.svelte';
	let { data }: { data: any } = $props();

	let prevDay = $derived.by(() => {
		return moment(data.day).subtract(1, 'day').format('YYYY-MM-DD');
	});

	let nextDay = $derived.by(() => {
		if (moment(data.day).isSame(moment(), 'day')) return moment().format('YYYY-MM-DD');
		return moment(data.day).add(1, 'day').format('YYYY-MM-DD');
	});

	let navMonth = $derived.by(() => {
		return moment(data.day).format('YYYY-MM');
	});
</script>

<div class="mt-2 flex gap-2">
	<div class="grow"></div>
	<div>
		<Button variant="outline" href="/v/inverter/day/{prevDay}">
			<ChevronLeftIcon />
		</Button>
	</div>
	<div>
		<Button variant="outline" href="/v/inverter/month/{navMonth}">
			{data.day}
		</Button>
	</div>
	<div>
		<Button variant="outline" href="/v/inverter/day/{nextDay}">
			<ChevronRightIcon />
		</Button>
	</div>
	<div class="grow"></div>
</div>

<Card.Root class="mx-2 my-4 border-slate-900 shadow-lg shadow-slate-800">
	<Card.Content class="p-4">
		<InverterStatistics referenceDate={data.day} />
	</Card.Content>
</Card.Root>

<InverterDayChartContainer day={data.day} />

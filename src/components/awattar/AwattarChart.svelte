<script lang="ts">
	import type { AwattarEntry } from '$lib/classes/awattar';
	import moment from 'moment';
	import { Skeleton } from '$lib/components/ui/skeleton';

	let entries = $state([] as AwattarEntry[]);

	const prices = $derived.by(() => {
		return entries.map((e) => e.grossPrice);
	});
	const maxValue = $derived.by(() => {
		return Math.max(...prices);
	});
	const minValue = $derived.by(() => {
		return Math.min(...prices);
	});
	const interval = $derived((maxValue - minValue) / 99);
	const entriesWithRange = $derived.by(() => {
		return entries.map((entry) => {
			const index = Math.floor((entry.grossPrice - minValue) / interval);
			return { entry, range: index + 1 };
		});
	});

	const getEntries = async (): Promise<void> => {
		const res = await fetch(`/api/awattar?hours=12&offsetHours=0`);
		entries = await res.json();
	};

	const getFormattedFrom = (entry: AwattarEntry): string => {
		return `${moment(entry.time).format('HH:mm')}`;
	};

	const getFormattedPrice = (entry: AwattarEntry): string => {
		return new Intl.NumberFormat('de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(entry.grossPrice);
	};

	const getEntryClass = (entry: AwattarEntry): string => {
		const entryFrom = moment(entry.time);
		const entryTo = moment(entry.time).add(1, 'hours');
		const now = moment();

		//future
		if (now.isBefore(entryFrom)) return '';

		// now
		if (now.isBefore(entryTo)) return 'text-primary font-bold text-lg';

		// past
		return 'text-muted-foreground text-sm';
	};

	const getClass = (entry: AwattarEntry): string => {
		const entryFrom = moment(entry.time);
		const entryTo = moment(entry.time).add(1, 'hours');
		const now = moment();

		let ret = 'm-1 my-2 pr-3 border rounded-md';
		ret += ' border-indigo-200 text-slate-800';
		ret += ' dark:border-indigo-950 dark:text-gray-200';
		if (now.isSameOrAfter(entryFrom) && now.isBefore(entryTo)) ret += ' font-medium text-xl';

		// add a spacer when a new day begins
		const index = entries.findIndex((x) => JSON.stringify(x) === JSON.stringify(entry));
		if (index !== 0 && moment(entry.time).format('HH') === '00') ret += ' mt-6';

		return ret;
	};

	const getGradient = (entry: AwattarEntry): string => {
		if (entry.grossPrice > 20) {
			return 'from-emerald-500 via-blue-500 to-red-500';
		}
		if (entry.grossPrice > 15) {
			return 'from-emerald-500 via-blue-500 to-amber-500';
		}
		if (entry.grossPrice > 10) {
			return 'from-emerald-500 to-blue-500';
		}

		return 'from-emerald-500 to-emerald-500';
	};

	const getWidth = (entry: AwattarEntry): number => {
		return entriesWithRange?.find((e) => e.entry.grossPrice === entry.grossPrice)?.range ?? 0;
	};
</script>

{#await getEntries()}
	{#each [0, 1, 2, 3, 4, 5, 6] as i}
		<Skeleton class="mb-2 h-[2em] w-full" />
	{/each}
{:then _}
	{#each entries as entry}
		<div class="flex {getClass(entry)}">
			<div class="grow">
				<div
					style="width: {getWidth(entry)}%; min-width:0.1em"
					class="to-50 rounded-md bg-gradient-to-r indent-2 {getGradient(entry)}"
				>
					{getFormattedFrom(entry)}
				</div>
			</div>
			<div class="ml-2 text-right">
				{getFormattedPrice(entry)}
			</div>
		</div>
	{/each}
{/await}

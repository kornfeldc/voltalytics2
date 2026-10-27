<script lang="ts">
	import type { AwattarEntry } from '$lib/classes/awattar';
	import type { IUserSettings } from '$lib/classes/db';
	import { PriceApi } from '$lib/classes/priceApi';
	import moment from 'moment';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { awattarState } from '$lib/state/awattarState.svelte';
	import { hourState } from '$lib/state/hourState.svelte';
	import NoData from '../system/NoData.svelte';

	let {
		hours = 12,
		userSettings
	}: { hours?: number; userSettings?: IUserSettings } = $props();

	let latestRequest = 0;
	const getEntries = async (settings?: IUserSettings): Promise<AwattarEntry[]> => {
		const request = ++latestRequest;
		const result = (await PriceApi.getData({ hours }, settings)) ?? [];
		// {#await} drops a superseded promise, but not this side effect - a slow
		// stale request must not overwrite the shared current price
		if (request !== latestRequest) return result;

		const now = moment().startOf('hour');
		awattarState.currentPrice = result.find((entry) =>
			now.isSame(moment(entry.time), 'hour')
		)?.grossPrice;
		return result;
	};

	const getFormattedFromTo = (entry: AwattarEntry): string => {
		return `${moment(entry.time).format('HH:mm')} - ${moment(entry.time).add(1, 'hours').format('HH:mm')}`;
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
		if (now.isBefore(entryTo)) return 'text-primary font-bold text-lg border-b-2 border-primary';

		// past
		return 'text-muted-foreground text-sm';
	};
</script>

{#key hourState.hour}
	{#await getEntries(userSettings)}
		{#each [0, 1, 2, 3, 4, 5, 6] as i}
			<Skeleton class="mb-2 h-[1em] w-full" />
		{/each}
	{:then awattarEntries}
		<div class="grid grid-cols-2">
			{#each awattarEntries as entry}
				<div class={getEntryClass(entry)}>
					{getFormattedFromTo(entry)}
				</div>
				<div class="text-right {getEntryClass(entry)}">{getFormattedPrice(entry)}</div>
			{/each}
		</div>
	{:catch _}
		<NoData></NoData>
	{/await}
{/key}

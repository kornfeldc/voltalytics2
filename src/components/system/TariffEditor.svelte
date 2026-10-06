<script lang="ts">
	import { Input } from '$lib/components/ui/input/index';
	import { Label } from '$lib/components/ui/label/index';
	import { Button } from '$lib/components/ui/button/index';
	import { parseFixedPriceTariff, type IFixedPriceRule } from '$lib/classes/fixedPrice';
	import moment from 'moment';

	/**
	 * Structured editor for the fixed-price tariff (settings.fixedPriceData).
	 * Edits an in-memory model; every change is serialized canonically
	 * (JSON.stringify -> quoted keys, months/hours ascending) and pushed to the
	 * parent via {@link onchange}. Validation reuses the strict fixedPrice
	 * parser so what is shown here is exactly what the engine will accept.
	 */
	let { value, onchange }: { value: string | null; onchange: (json: string) => void } = $props();

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	interface EditRule {
		months: boolean[];
		hours: boolean[];
		price: number | undefined;
	}
	interface EditRange {
		validFrom: string;
		prices: EditRule[];
	}

	const flagsOf = (list: number[], max: number): boolean[] => {
		const flags = new Array<boolean>(max + 1).fill(false);
		for (const i of list) flags[i] = true;
		return flags;
	};

	const toEditRanges = (json: string | null): EditRange[] => {
		const tariff = json ? parseFixedPriceTariff(json) : undefined;
		return (tariff?.ranges ?? []).map((range) => ({
			validFrom: range.validFrom,
			prices: range.prices.map(
				(rule: IFixedPriceRule): EditRule => ({
					months: flagsOf(rule.months, 12),
					hours: flagsOf(rule.hours, 23),
					price: rule.price
				})
			)
		}));
	};

	// Intentionally capture only the initial `value` - the editor then owns its
	// own model and pushes changes back up; parent updates are not re-parsed.
	// svelte-ignore state_referenced_locally
	const initialTariff = value ? parseFixedPriceTariff(value) : undefined;
	let title = $state(initialTariff?.title ?? '');
	// svelte-ignore state_referenced_locally
	let ranges = $state<EditRange[]>(toEditRanges(value));

	const indices = (flags: boolean[]): number[] =>
		flags.flatMap((on, i) => (on ? [i] : []));

	const serialize = (): string =>
		JSON.stringify({
			title: title,
			ranges: ranges.map((range) => ({
				validFrom: range.validFrom,
				prices: range.prices.map((rule) => ({
					months: indices(rule.months),
					hours: indices(rule.hours),
					price: rule.price ?? 0
				}))
			}))
		});

	// Canonical JSON on every change - but never write an empty placeholder
	// over a pristine setting.
	$effect(() => {
		if (title || ranges.length) onchange(serialize());
	});

	let validation = $derived.by(() => {
		if (!ranges.length) return 'No ranges defined';
		const tariff = parseFixedPriceTariff(serialize());
		if (!tariff) return 'Invalid tariff';
		return `✓ ${tariff.title || '(untitled)'} — ${tariff.ranges.length} ranges`;
	});

	const addRange = () => {
		ranges.push({ validFrom: moment().format('YYYY-MM-DD'), prices: [] });
	};

	const removeRange = (index: number) => {
		ranges.splice(index, 1);
	};

	const addRule = (range: EditRange) => {
		range.prices.push({
			months: new Array<boolean>(12).fill(false),
			hours: new Array<boolean>(24).fill(false),
			price: undefined
		});
	};

	const removeRule = (range: EditRange, index: number) => {
		range.prices.splice(index, 1);
	};

	const toggle = (flags: boolean[], index: number) => {
		flags[index] = !flags[index];
	};

	const prefillExample = () => {
		title = 'Example tariff';
		ranges = [
			{
				validFrom: moment().format('YYYY-MM-DD'),
				prices: [
					{
						months: flagsOf([1, 2, 3, 4, 5, 9, 10, 11, 12], 12),
						hours: flagsOf([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22], 23),
						price: 30
					},
					{
						months: flagsOf([1, 2, 3, 4, 5, 9, 10, 11, 12], 12),
						hours: flagsOf([0, 1, 2, 3, 4, 5, 23], 23),
						price: 25
					},
					{
						months: flagsOf([6, 7, 8], 12),
						hours: flagsOf(Array.from({ length: 24 }, (_, i) => i), 23),
						price: 28
					}
				]
			}
		];
	};
</script>

<div class="mt-2 flex flex-col gap-2">
	{#if !value && !ranges.length}
		<Button variant="outline" onclick={prefillExample}>Load example tariff</Button>
	{/if}

	<Label for="tariffTitle">Title</Label>
	<Input id="tariffTitle" bind:value={title} placeholder="e.g. my tariff 2026" />

	{#each ranges as range, rangeIndex (rangeIndex)}
		<div class="rounded-md border p-2">
			<div class="flex items-center gap-2">
				<Label class="whitespace-nowrap">Valid from</Label>
				<Input type="date" bind:value={range.validFrom} class="w-40" />
				<div class="grow"></div>
				<Button variant="ghost" size="sm" onclick={() => removeRange(rangeIndex)}>Delete range</Button>
			</div>

			{#each range.prices as rule, ruleIndex (ruleIndex)}
				<div class="mt-2 rounded border p-2">
					<div class="flex items-center">
						<Label class="grow">Price rule {ruleIndex + 1}</Label>
						<Button variant="ghost" size="sm" onclick={() => removeRule(range, ruleIndex)}
							>Delete rule</Button
						>
					</div>

					<Label class="mt-1 text-xs text-muted-foreground">Months</Label>
					<div class="flex flex-wrap gap-1">
						{#each rule.months as on, month (month)}
							<button
								type="button"
								class="rounded border px-1.5 py-0.5 text-xs {on
									? 'bg-primary text-primary-foreground'
									: 'bg-background text-muted-foreground'}"
								onclick={() => toggle(rule.months, month)}
							>
								{MONTHS[month]}
							</button>
						{/each}
					</div>

					<Label class="mt-1 text-xs text-muted-foreground">Hours</Label>
					<div class="flex flex-wrap gap-1">
						{#each rule.hours as on, hour (hour)}
							<button
								type="button"
								class="rounded border px-1.5 py-0.5 text-xs {on
									? 'bg-primary text-primary-foreground'
									: 'bg-background text-muted-foreground'}"
								onclick={() => toggle(rule.hours, hour)}
							>
								{hour}
							</button>
						{/each}
					</div>

					<div class="mt-2 flex items-center gap-2">
						<Label class="whitespace-nowrap">Price ct/kWh</Label>
						<Input type="number" step="0.1" bind:value={rule.price} class="w-24" />
					</div>
				</div>
			{/each}

			<Button variant="outline" size="sm" class="mt-2" onclick={() => addRule(range)}
				>Add price rule</Button
			>
		</div>
	{/each}

	<Button variant="outline" size="sm" onclick={addRange}>Add price range</Button>

	<p class="text-muted-foreground text-xs">{validation}</p>
</div>
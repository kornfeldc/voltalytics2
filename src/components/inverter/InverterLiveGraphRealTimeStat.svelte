<script lang="ts">
	import * as Svelte from 'svelte';
	import type { AwattarEntry } from '$lib/classes/awattar';

	interface IProps {
		label: string;
		color: string;
		value: number;
		doesAffectCosts: boolean;
		right: boolean;
		currentPrice: number | undefined;
	}

	let { label, color, value, doesAffectCosts = true, right = false }: IProps = $props();

	const getFormattedValue = (val: number | undefined) => {
		if (val === undefined) return '';
		return new Intl.NumberFormat('de-DE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(val);
	};
</script>

<div class={right ? 'mr-2 text-right' : 'ml-2'}>
	<div
		class="{value ? color : 'text-inactive'} flex items-center text-xl {right ? 'justify-end' : ''}"
	>
		<span class={!right ? 'mr-2' : 'whitespace-nowrap'}>
			{getFormattedValue(value)}
			<span class="whitespace-nowrap text-xs"> kW </span>
		</span>
		<!-- additional ? -->
	</div>
	<div class="text-inactive whitespace-nowrap text-xs">{label}</div>
</div>

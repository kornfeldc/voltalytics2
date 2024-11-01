<script lang="ts">
	import * as Svelte from 'svelte';
	import InverterLiveGraphRealTimeStat from './InverterLiveGraphRealTimeStat.svelte';

	interface IProps {
		label: string;
		color: string;
		icon: Svelte.Snippet;
		value: number;
		doesAffectCosts: boolean;
		right: boolean;
	}

	let { label, color, icon, value, doesAffectCosts = false, right = false }: IProps = $props();
</script>

{#snippet realTimeStat()}
	<InverterLiveGraphRealTimeStat {label} {color} {value} {doesAffectCosts} {right}
	></InverterLiveGraphRealTimeStat>
{/snippet}

<div class="flex {value ? color : 'text-inactive'} {right ? 'justify-end text-right' : ''}">
	{#if right}{@render realTimeStat()}{/if}
	<div class="pt-0.5">{@render icon()}</div>
	{#if !right}{@render realTimeStat()}{/if}
</div>

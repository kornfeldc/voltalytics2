<script lang="ts">
	import { Slider as SliderPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';

	type $$Props = SliderPrimitive.Props;

	let className: $$Props['class'] = undefined;
	export let value: $$Props['value'] = [0];
	export { className as class };

	let showOverlay = writable(false);

	const handlePointerEnd = (event: Event) => {
		showOverlay.set(false);
	};

	const handlePointerStart = (event: PointerEvent) => {
		showOverlay.set(true);
		event.preventDefault(); // Ensure it stops propagation here
	};
</script>

{#if $showOverlay}
	<div class="relative ml-12 flex w-full justify-center">
		<div
			class="absolute top-[-8em] rounded-md border-2 border-primary bg-background/50 px-10 py-6 backdrop-blur"
		>
			{value}
		</div>
	</div>
{/if}

<SliderPrimitive.Root
	bind:value
	class={cn('relative flex w-full touch-none select-none items-center', className)}
	{...$$restProps}
	let:thumbs
	onpointerdown={(e) => handlePointerStart(e)}
	onpointerup={(e) => handlePointerEnd(e)}
>
	<span class="relative h-2 w-full grow overflow-hidden rounded-full bg-primary/20">
		<SliderPrimitive.Range class="absolute h-full bg-primary" />
	</span>
	{#each thumbs as thumb}
		<SliderPrimitive.Thumb
			{thumb}
			class="block h-6 w-6 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
		/>
	{/each}
</SliderPrimitive.Root>

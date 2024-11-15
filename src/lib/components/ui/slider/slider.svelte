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
	let startTouchX = writable(0);
	let startTouchY = writable(0);

	let startPointerX = writable(0);
	let startPointerY = writable(0);

	onMount(() => {});

	const handleTouchEnd = (event: Event) => {
		showOverlay.set(false);
	};

	const handlePointerEnd = (event: Event) => {
		showOverlay.set(false);
	};

	const handleTouchMove = (event: TouchEvent) => {
		const touch = event.touches[0];
		const deltaY = Math.abs(touch.clientY - $startTouchY);
		if (deltaY > 2) {
			event.preventDefault(); // Block Y-axis movements
			event.stopPropagation();
		}
	};

	const handlePointerMove = (event: PointerEvent) => {
		const deltaY = Math.abs(event.clientY - $startPointerY);
		if (deltaY > 2) {
			event.preventDefault(); // Block Y-axis movements
			event.stopPropagation();
		}
	};

	const handleTouchStart = (event: TouchEvent) => {
		const touch = event.touches[0];
		startTouchX.set(touch.clientX);
		startTouchY.set(touch.clientY);
		showOverlay.set(true);
		event.preventDefault(); // Ensure it stops propagation here
	};

	const handlePointerStart = (event: PointerEvent) => {
		startPointerX.set(event.clientX);
		startPointerY.set(event.clientY);
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
	ontouchstart={(e) => handleTouchStart(e)}
	ontouchmove={(e) => handleTouchMove(e)}
	ontouchend={(e) => handleTouchEnd(e)}
	onpointerdown={(e) => handlePointerStart(e)}
	onpointermove={(e) => handlePointerMove(e)}
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

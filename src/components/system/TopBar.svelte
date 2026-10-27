<script lang="ts">
	import { UserIcon, Zap } from 'lucide-svelte';
	// noinspection ES6UnusedImports
	import * as Drawer from '$lib/components/ui/drawer/index';
	// noinspection ES6UnusedImports
	import * as Avatar from '$lib/components/ui/avatar/index.js';

	import { page } from '$app/stores';
	import { sceneState } from '$lib/state/sceneState.svelte';

	/**
	 * Split dashboard: rendered by the page at the top of its card column,
	 * styled like the dashboard cards (FEATURES.md #3).
	 */
	let { embedded = false }: { embedded?: boolean } = $props();

	let userImage = $derived($page.data?.session?.user?.image);
	let userName = $derived($page.data?.session?.user?.name);
	/** Stacked 3D house view scrolled to the top: float transparent over the sky. */
	let floating = $derived(!embedded && sceneState.layout === 'stacked' && sceneState.heroUnderBar);

	// the stacked scene extends under the layout's bar by its height
	let height = $state(0);
	$effect(() => {
		if (!embedded && height > 0) sceneState.topBarHeight = height;
	});
</script>

{#if embedded}
	<!-- cards scroll away behind a page-background backdrop (never visibly above the
	card) and fade out over the 16 px gap below it; the card paints on top of both,
	shadow included -->
	<header class="sticky top-0 z-10 px-3 pt-3">
		<div class="pointer-events-none absolute inset-0 bg-background"></div>
		<div
			class="pointer-events-none absolute inset-x-0 top-full h-4 bg-gradient-to-b from-background to-transparent"
		></div>
		<div
			class="relative rounded-xl border bg-card p-1 text-card-foreground shadow-lg dark:border-slate-900 dark:shadow-slate-800"
		>
			{@render bar()}
		</div>
	</header>
{:else}
	<header
		bind:clientHeight={height}
		class="sticky top-0 z-10 p-1 transition-[background-color,box-shadow,color] duration-300 {floating
			? 'bg-transparent text-white shadow-none'
			: 'bg-background/50 shadow-lg backdrop-blur dark:shadow-primary/50'}"
	>
		{@render bar()}
	</header>
{/if}

{#snippet bar()}
	<div class="flex items-center px-4">
		<Zap href="/v/dashboard" class="h-12 w-12 text-amber-400"></Zap>
		<a href="/v/dashboard" class="ml-1 text-xl">voltalytics</a>

		<div class="text-inactive pl-2 pt-1.5 text-xs">{__APP_VERSION__}</div>

		<div class="inline-block w-full flex-grow text-center uppercase"></div>
		<Drawer.Trigger>
			<Avatar.Root>
				<Avatar.Image src={userImage} alt={userName} />
				<Avatar.Fallback>
					<UserIcon />
				</Avatar.Fallback>
			</Avatar.Root>
		</Drawer.Trigger>
	</div>
{/snippet}

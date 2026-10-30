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
	 * styled like the dashboard cards over the 3D scene (FEATURES.md #3, #5).
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
	<!-- pinned over the scene; the frosted cards scroll up under it -->
	<header class="sticky top-0 z-10 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
		<div
			class="relative rounded-xl border bg-card/70 p-1 text-card-foreground shadow-lg backdrop-blur-xl dark:border-slate-900"
		>
			{@render bar()}
		</div>
	</header>
{:else}
	<!-- floating: the sky's top colour (the scene draws that flat behind the bar);
	iOS Safari extends the bar's colour into its status bar, pages can't draw there -->
	<header
		bind:clientHeight={height}
		class="sticky top-0 z-10 p-1 pt-[calc(env(safe-area-inset-top)+0.25rem)] transition-[background-color,box-shadow,color] duration-300 {floating
			? 'text-white shadow-none'
			: 'bg-background/50 shadow-lg backdrop-blur dark:shadow-primary/50'}"
		style:background-color={floating ? sceneState.skyTop || 'transparent' : null}
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

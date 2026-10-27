<script lang="ts">
	import { UserIcon, Zap } from 'lucide-svelte';
	// noinspection ES6UnusedImports
	import * as Drawer from '$lib/components/ui/drawer/index';
	// noinspection ES6UnusedImports
	import * as Avatar from '$lib/components/ui/avatar/index.js';

	import { page } from '$app/stores';
	import { sceneState } from '$lib/state/sceneState.svelte';

	/** Split dashboard: rendered by the page in its card column (FEATURES.md #3). */
	let { embedded = false }: { embedded?: boolean } = $props();

	let userImage = $derived($page.data?.session?.user?.image);
	let userName = $derived($page.data?.session?.user?.name);
	/** Stacked 3D house view scrolled to the top: float transparent over the sky. */
	let floating = $derived(!embedded && sceneState.layout === 'stacked' && sceneState.heroUnderBar);
</script>

<header
	bind:clientHeight={sceneState.topBarHeight}
	class="sticky top-0 z-10 p-1 transition-[background-color,box-shadow,color] duration-300 {floating
		? 'bg-transparent text-white shadow-none'
		: 'bg-background/50 shadow-lg backdrop-blur dark:shadow-primary/50'}"
>
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
</header>

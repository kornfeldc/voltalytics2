﻿<script lang="ts">
	// noinspection ES6UnusedImports
	import * as Drawer from '$lib/components/ui/drawer/index';
	import type { IUserSettings } from '$lib/classes/db';
	import { invalidateAll } from '$app/navigation';
	import FullPageLoading from '../../components/system/FullPageLoading.svelte';
	import TopBar from '../../components/system/TopBar.svelte';
	import Settings from '../../components/system/Settings.svelte';
	import { onMount } from 'svelte';
	import { drawerState } from '$lib/state/drawerState.svelte.js';

	interface Props {
		children?: import('svelte').Snippet;
		data?: any;
	}

	let userSettings = $state(undefined as IUserSettings | undefined);

	const loadUser = async () => {
		userSettings = await data.userSettings;
	};

	const saved = () => {
		document.dispatchEvent(new Event('settingsChanged'));
		invalidateAll();
	};

	let { children, data }: Props = $props();

	// Pull-to-refresh logic
	onMount(() => {
		let startY = 0;
		let endY = 0;

		const handleTouchStart = (event: TouchEvent) => {
			startY = event.touches[0].clientY;
		};

		const handleTouchMove = (event: TouchEvent) => {
			endY = event.touches[0].clientY;
			if (endY - startY > 400) {
				// Trigger refresh if pulled down more than 100px
				invalidateAll();
			}
		};

		document.addEventListener('touchstart', handleTouchStart, { passive: true });
		document.addEventListener('touchmove', handleTouchMove, { passive: true });

		return () => {
			document.removeEventListener('touchstart', handleTouchStart);
			document.removeEventListener('touchmove', handleTouchMove);
		};
	});
</script>

{#await loadUser()}
	<FullPageLoading></FullPageLoading>
{:then _}
	{#if userSettings}
		<Drawer.Root bind:open={drawerState.isOpened}>
			<div class="flex min-h-screen flex-col">
				<TopBar></TopBar>
				<main class="mx-auto w-full max-w-[800px]">
					{@render children?.()}
				</main>
			</div>
			<Drawer.Content class="mx-auto max-w-[800px]">
				<div class="safe_margin_bottom_reduced">
					<Settings {userSettings} {saved}></Settings>
				</div>
			</Drawer.Content>
		</Drawer.Root>
	{/if}
{/await}

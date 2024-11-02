<script lang="ts">
	// noinspection ES6UnusedImports
	import * as Drawer from '$lib/components/ui/drawer/index';
	import type { IUserSettings } from '$lib/classes/db';
	import { invalidateAll } from '$app/navigation';
	import FullPageLoading from '../../components/system/FullPageLoading.svelte';
	import TopBar from '../../components/system/TopBar.svelte';
	import Settings from '../../components/system/Settings.svelte';

	interface Props {
		children?: import('svelte').Snippet;
		data?: any;
	}

	let userSettings = $state(undefined as IUserSettings | undefined);

	const loadUser = async () => {
		userSettings = await data.userSettings;
	};

	const saved = async () => {
		await invalidateAll();
	};

	let { children, data }: Props = $props();
</script>

{#await loadUser()}
	<FullPageLoading></FullPageLoading>
{:then _}
	{#if userSettings}
		<Drawer.Root>
			<div class="flex min-h-screen flex-col">
				<TopBar></TopBar>
				<main>
					{@render children?.()}
				</main>
			</div>
			<Drawer.Content>
				<Settings {userSettings} {saved}></Settings>
			</Drawer.Content>
		</Drawer.Root>
	{/if}
{/await}

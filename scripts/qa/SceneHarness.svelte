<script lang="ts">
	// Visual-QA wrapper for scripts/qa-energy-scene.mjs: the /v layout (TopBar,
	// settings drawer) around the dashboard page, like the real route tree.
	import '../../src/app.css';
	import { ModeWatcher } from 'mode-watcher';
	import type { IUserSettings } from '$lib/classes/db';
	import Layout from '../../src/routes/v/+layout.svelte';
	import Dashboard from '../../src/routes/v/dashboard/+page.svelte';

	let { data }: { data: { userSettings: Promise<IUserSettings> } } = $props();
</script>

<ModeWatcher />
<Layout {data}>
	<Dashboard {data} />
</Layout>

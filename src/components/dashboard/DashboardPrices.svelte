<script lang="ts">
	import AwattarList from '../awattar/AwattarList.svelte';
	import type { IUserSettings } from '$lib/classes/db';

	let { userSettings }: { userSettings?: IUserSettings } = $props();
</script>

<a href="/v/awattar">
	<AwattarList hours={5} {userSettings} />
</a>
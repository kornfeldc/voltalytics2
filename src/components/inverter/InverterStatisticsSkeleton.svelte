<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index';
</script>

<div class="grid grid-cols-5 align-middle">
	{#each [0, 1, 2] as index}
		{#each ['h-6', 'h-2'] as height}
			<Skeleton class="{height} col-span-2 mb-1 w-full"></Skeleton>
			<div />
			<Skeleton class="{height} col-span-2 mb-1 w-full"></Skeleton>
		{/each}
	{/each}
</div>

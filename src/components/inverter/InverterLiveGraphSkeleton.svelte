<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index';
</script>

<Skeleton class="h-4 w-1/3"></Skeleton>
<div class="grid grid-cols-3 pt-1 align-middle">
	<Skeleton class="h-10 w-10 rounded-full"></Skeleton>
	<div class=""></div>
	<div class="flex justify-end">
		<Skeleton class="h-10 w-10 rounded-full"></Skeleton>
	</div>

	<div class="flex items-center">
		<Skeleton class="h-4 w-full"></Skeleton>
	</div>
	<div class="flex justify-center">
		<Skeleton class="h-10 w-10 rounded-full"></Skeleton>
	</div>
	<div class="flex items-center">
		<Skeleton class="h-4 w-full"></Skeleton>
	</div>

	<Skeleton class="h-10 w-10 rounded-full"></Skeleton>
	<div class=""></div>
	<div class="flex justify-end">
		<Skeleton class="h-10 w-10 rounded-full"></Skeleton>
	</div>
</div>

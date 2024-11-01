<script lang="ts">
	import LoaderCircle from 'lucide-svelte/icons/loader-circle';
	interface Props {
		position?: 'center' | 'top';
	}

	let { position = 'center' }: Props = $props();
</script>

<div class="flex h-screen w-full justify-center {position === 'center' ? 'items-center' : ''}">
	<LoaderCircle class="mr-2 h-12 w-12 animate-spin" />
</div>

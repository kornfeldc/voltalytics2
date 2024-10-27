<script lang="ts">
	import { Zap } from 'lucide-svelte';
	import { signIn } from '@auth/sveltekit/client';
	import { Button } from '$lib/components/ui/button/index';

	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	$effect(() => {
		if ($page.data.session) goto('/v/dashboard');
	});
</script>

<div class="flex h-[100vh] w-full flex-col items-center justify-center">
	<Zap class="h-28 w-28 text-amber-400"></Zap>
	<h1 class="mb-3 text-[3em]">voltalytics</h1>
	<Button onclick={() => signIn('google', { callbackUrl: '/v/dashboard' })}>Sign in</Button>
</div>

<script lang="ts">
	import { Zap } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card/index';
	import { signIn } from '@auth/sveltekit/client';
	import { Button } from '$lib/components/ui/button/index';

	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import AwattarChart from '../components/awattar/AwattarChart.svelte';
	import AwattarList from '../components/awattar/AwattarList.svelte';
	import { awattarState } from '$lib/state/awattarState.svelte';

	$effect(() => {
		if ($page.data.session) goto('/v/dashboard');
	});
</script>

<div class="flex h-[100vh] w-full flex-col items-center justify-center">
	<Zap class="h-28 w-28 text-amber-400"></Zap>
	<h1 class="mb-3 text-[3em]">voltalytics</h1>
	<Button onclick={() => signIn('google', { callbackUrl: '/v/dashboard' })}>Sign in</Button>

	<a href="/awattar">
		<Card.Root class="mt-20 w-full max-w-72 border-slate-900 shadow-lg shadow-slate-800">
			<Card.Header class="flex flex-col p-2 px-4">
				<div class="grid grid-cols-2">
					<h1 class="whitespace-nowrap">awattar prices</h1>
					<p class="text-right text-sm text-muted-foreground">cent/kWh</p>
				</div>
			</Card.Header>
			<Card.Content class="px-4 py-0 pb-2">
				<AwattarList />
			</Card.Content>
		</Card.Root>
	</a>
</div>

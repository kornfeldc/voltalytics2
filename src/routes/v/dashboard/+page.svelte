<script lang="ts">
	import { signIn, signOut } from '@auth/sveltekit/client';
	import { Button } from '$lib/components/ui/button/index';
</script>

<Button onclick={() => signOut()}>Sign out</Button>

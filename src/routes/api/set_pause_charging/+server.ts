import { json } from '@sveltejs/kit';
import { Db } from '$lib/classes/db';

export async function POST({ locals, url }) {
	const session = await locals.auth();
	if (!session?.user?.email) throw json({ error: 'Not logged in' }, { status: 401 });
	const pauseCharing = url.searchParams.get('pauseCharging') === 'true';
	console.log('server pc ', pauseCharing);
	await Db.setPauseCharging(session.user.email!, pauseCharing);
	return json(true, { status: 200 });
}

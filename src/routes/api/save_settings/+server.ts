import { json } from '@sveltejs/kit';
import { Db } from '$lib/classes/db';

export async function POST({ locals, request }) {
	const session = await locals.auth();

	if (!session?.user?.email) throw json({ error: 'Not logged in' }, { status: 401 });

	const formData = await request.json();
	await Db.saveUserSettings(session.user.email!, formData);
	return json(true, { status: 200 });
}

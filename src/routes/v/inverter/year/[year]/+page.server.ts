import { redirect } from '@sveltejs/kit';
import { Db } from '$lib/classes/db';

export async function load({ locals, params }) {
	const session = await locals.auth();
	if (!session?.user?.email) redirect(307, '/');

	const { year } = params;
	const userSettings = Db.getUserSettings(session.user.email);
	return {
		year
	};
}

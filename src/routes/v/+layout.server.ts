// src/routes/protected/+layout.server.js

import { redirect } from '@sveltejs/kit';
import { Db } from '$lib/classes/db';

export const load = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.email) redirect(307, '/');

	const userSettings = Db.getUserSettings(session.user.email);
	return {
		session,
		userSettings
	};
};

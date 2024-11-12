import { json, redirect } from '@sveltejs/kit';
import { InverterApi } from '$lib/classes/interver';
import { Db } from '$lib/classes/db';
import { vConsole } from '$lib/classes/vconsole';

export async function GET({ locals, url }) {
	const session = await locals.auth();
	if (!session?.user?.email) redirect(307, '/');

	const userSettings = await Db.getUserSettings(session.user.email);
	if (!userSettings) redirect(307, '/');

	const dayFrom = url.searchParams.get('dayFrom')!;
	const dayTo = url.searchParams.get('dayTo')!;
	const inverterApi = new InverterApi(userSettings!);
	const data = await inverterApi.getTimeFrameData({ dayFrom, dayTo });
	return json(data);
}

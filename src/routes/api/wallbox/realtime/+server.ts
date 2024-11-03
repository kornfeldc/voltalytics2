import { json, redirect } from '@sveltejs/kit';
import { InverterApi } from '$lib/classes/interver';
import { Db } from '$lib/classes/db';
import { vConsole } from '$lib/classes/vconsole';
import { WallBoxApi } from '$lib/classes/wallBox';

export async function GET({ locals, url }) {
	vConsole.log('api call - wallbox realtime', url.href);
	const session = await locals.auth();
	if (!session?.user?.email) redirect(307, '/');

	const userSettings = await Db.getUserSettings(session.user.email);
	if (!userSettings) redirect(307, '/');

	const wallBoxApi = new WallBoxApi(userSettings!);
	const realTimeData = await wallBoxApi.getRealTimeData();

	return json({
		realTimeData,
		userSettings
	});
}

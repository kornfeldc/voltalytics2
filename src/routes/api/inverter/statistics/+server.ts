import { json, redirect } from '@sveltejs/kit';
import { InverterApi } from '$lib/classes/interver';
import { Db } from '$lib/classes/db';
import { vConsole } from '$lib/classes/vconsole';

export async function GET({ locals, url }) {
	vConsole.log('api call - statistics', url.href);
	const session = await locals.auth();
	if (!session?.user?.email) redirect(307, '/');

	const userSettings = await Db.getUserSettings(session.user.email);
	if (!userSettings) redirect(307, '/');

	const referenceDate = url.searchParams.get('referenceDate')!;
	const range = url.searchParams.get('range')! as 'day' | 'month' | 'year';
	const inverterApi = new InverterApi(userSettings!);
	const statisticsData = await inverterApi.getStatistics({ referenceDate, range });
	return json(statisticsData);
}

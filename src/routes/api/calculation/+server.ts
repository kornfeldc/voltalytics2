import { json, redirect } from '@sveltejs/kit';
import { InverterApi } from '$lib/classes/interver';
import { Db } from '$lib/classes/db';
import { vConsole } from '$lib/classes/vconsole';
import { WallBoxApi } from '$lib/classes/wallBox';
import { ChargingApi } from '$lib/classes/charging';

export async function GET({ locals, url }) {
	const session = await locals.auth();
	if (!session?.user?.email) redirect(307, '/');

	const userSettings = await Db.getUserSettings(session.user.email);
	if (!userSettings) redirect(307, '/');

	const chargingApi = new ChargingApi(userSettings!);
	const calculation = await chargingApi.getCalculationSuggestion();

	return json(calculation);
}

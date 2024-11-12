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
	const chargingInfo = await chargingApi.getChargingInfo();

	return json(chargingInfo);
}

export async function POST({ request, locals }): Promise<Response> {
	const { kw } = await request.json();

	const session = await locals.auth();
	if (!session?.user?.email) redirect(307, '/');

	const userSettings = await Db.getUserSettings(session.user.email);
	if (!userSettings) redirect(307, '/');

	const wallBoxApi = new WallBoxApi(userSettings!);
	const result = await wallBoxApi.setChargingSpeed(kw);
	return json(result, { status: 200 });
}

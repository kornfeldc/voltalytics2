import { json, redirect } from '@sveltejs/kit';
import { InverterApi } from '$lib/classes/interver';
import { Db } from '$lib/classes/db';
import { vConsole } from '$lib/classes/vconsole';
import { WallBoxApi } from '$lib/classes/wallBox';
import { ChargingApi } from '$lib/classes/charging';
export async function POST({ request, locals }): Promise<Response> {
	const { kw } = await request.json();

	const session = await locals.auth();
	if (!session?.user?.email) redirect(307, '/');

	const userSettings = await Db.getUserSettings(session.user.email);
	if (!userSettings) redirect(307, '/');

	const chargingApi = new ChargingApi(userSettings!);
	const chargingInfo = await chargingApi.getChargingInfo();

	if (chargingInfo.suggestion.suggestedKw < kw)
		return json(
			{
				status: 'success',
				message: 'Nothing to change'
			},
			{ status: 200 }
		);

	const wallBoxApi = new WallBoxApi(userSettings!);
	const result = await wallBoxApi.setChargingSpeed(chargingInfo.suggestion.suggestedKw);
	return json(result, { status: 200 });
}

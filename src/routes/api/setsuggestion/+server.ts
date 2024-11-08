import { json, redirect } from '@sveltejs/kit';
import { Db } from '$lib/classes/db';
import { ChargingApi } from '$lib/classes/charging';
import { WallBoxApi } from '$lib/classes/wallBox';

export async function GET({ url }) {
	const userHash = url.searchParams.get('hash');

	const userSettings = await Db.getUserSettingsByHash(userHash);
	if (!userSettings) redirect(307, '/');

	const chargingApi = new ChargingApi(userSettings!);
	const chargingInfo = await chargingApi.getChargingInfo();

	if (chargingInfo.suggestion.suggestedKw === -1)
		return json({
			chargingInfo,
			result: 'dont_change'
		});

	const wallBoxApi = new WallBoxApi(userSettings!);
	const result = await wallBoxApi.setChargingSpeed(chargingInfo.suggestion.suggestedKw);

	return json({
		chargingInfo,
		wallBoxResult: result
	});
}

﻿import { json, redirect } from '@sveltejs/kit';
import { Db } from '$lib/classes/db';
import { ChargingApi } from '$lib/classes/charging';
import { WallBoxApi } from '$lib/classes/wallBox';
import moment from 'moment';

export async function GET({ url }) {
	const userHash = url.searchParams.get('hash');

	let userSettings = await Db.getUserSettingsByHash(userHash);
	if (!userSettings) redirect(307, '/');

	if (!userSettings.autoExecuteSuggestions)
		return json({ result: 'auto_execute_suggestions_disabled' });

	if (shouldResetForceCharge(userSettings)) {
		await Db.resetForceCharge(userSettings.email);
		userSettings = await Db.getUserSettingsByHash(userHash);
	}

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

function shouldResetForceCharge(userSettings: any) {
	if (!userSettings.forceChargeIsOn) return false;
	if (!userSettings.autoTurnOffForceCharging) return false;
	if (!userSettings.lastForceChargeReset) return true;

	const morning = moment().startOf('day').add(6, 'hour');
	if (moment().isBefore(morning)) return false;

	return !moment(userSettings.lastForceChargeReset).isSame(moment(), 'day');
}

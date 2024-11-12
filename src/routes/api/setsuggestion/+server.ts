import { json, redirect } from '@sveltejs/kit';
import { Db } from '$lib/classes/db';
import { ChargingApi } from '$lib/classes/charging';
import { WallBoxApi } from '$lib/classes/wallBox';
import moment from 'moment';
import { vConsole } from '$lib/classes/vconsole';

export async function GET({ url }) {
	const userHash = url.searchParams.get('hash');

	let userSettings = await Db.getUserSettingsByHash(userHash);
	if (!userSettings) redirect(307, '/');

	if (!userSettings.autoExecuteSuggestions)
		return json({ result: 'auto_execute_suggestions_disabled' });

	if (shouldResetForceCharge(userSettings)) {
		await Db.resetForceCharge(userSettings.email);
		userSettings = await Db.getUserSettingsByHash(userHash);
		vConsole.info('turned off force charging', userSettings);
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
	const ret = {
		chargingInfo,
		wallBoxResult: result
	};

	vConsole.info('charging speed changed', ret);
	return json(ret);
}

function shouldResetForceCharge(userSettings: any) {
	const morning = moment().startOf('day').add(6, 'hour');
	const morningUntil = moment().startOf('day').add(6.5, 'hour');
	const lastResetWasToday = moment(userSettings.lastForceChargeReset).isSame(moment(), 'day');
	vConsole.info('shouldResetForceCharge', {
		userSettings: userSettings.forceChargeIsOn,
		autoTurnOffForceCharging: userSettings.autoTurnOffForceCharging,
		lastForceChargeReset: userSettings.lastForceChargeReset,
		morning,
		morningUntil,
		lastResetWasToday
	});

	if (!userSettings.forceChargeIsOn) return false;
	if (!userSettings.autoTurnOffForceCharging) return false;
	if (moment().isBefore(morning)) return false;
	if (moment().isAfter(morningUntil)) return false;
	if (!userSettings.lastForceChargeReset) return true;
	return !lastResetWasToday;
}

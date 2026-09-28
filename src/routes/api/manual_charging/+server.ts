import { json, redirect } from '@sveltejs/kit';
import { Db } from '$lib/classes/db';
import { ChargingApi } from '$lib/classes/charging';
import { WallBoxApi } from '$lib/classes/wallBox';
import { vConsole } from '$lib/classes/vconsole';

interface IManualChargingRequest {
	on: boolean;
	kw?: number;
	durationMinutes?: number;
}

export async function POST({ request, locals }): Promise<Response> {
	const session = await locals.auth();
	if (!session?.user?.email) redirect(307, '/');

	const body = (await request.json()) as IManualChargingRequest;

	let userSettings = await Db.getUserSettings(session.user.email);
	if (!userSettings) redirect(307, '/');

	const until = body.durationMinutes
		? new Date(Date.now() + body.durationMinutes * 60 * 1000)
		: undefined;
	await Db.setManualCharging(session.user.email, body.on, body.kw, until);

	// reload so the suggestion below is evaluated with the new boost state
	userSettings = await Db.getUserSettings(session.user.email);
	if (!userSettings) redirect(307, '/');

	const chargingApi = new ChargingApi(userSettings);
	const chargingInfo = await chargingApi.getChargingInfo();
	const suggestedKw = chargingInfo.suggestion.suggestedKw;

	// apply immediately - don't wait for the next suggestion poll
	let wallBoxResult;
	if (suggestedKw >= 0) {
		const wallBoxApi = new WallBoxApi(userSettings);
		wallBoxResult = await wallBoxApi.setChargingSpeed(suggestedKw);
	}

	vConsole.info('manual_charging - ' + (body.on ? 'started' : 'stopped'), {
		suggestedKw,
		wallBoxResult
	});

	return json(
		{
			status: 'success',
			chargingInfo,
			wallBoxResult
		},
		{ status: 200 }
	);
}

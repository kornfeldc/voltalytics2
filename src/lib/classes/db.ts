﻿import pkg from '@supabase/supabase-js';
const { createClient, SupabaseClient } = pkg;

export interface IUserSettings {
	currentInverter: '' | 'solarman' | 'solaredge';
	currentWallbox: '' | 'goe';

	theme: string;

	solarManAppId: string;
	solarManAppSecret: string;
	solarManAppEmail: string;
	solarManAppPw: string;

	solarEdgeApiKey: string;

	goESerial: string;
	goEApiToken: string;

	useAwattar: boolean;

	chargeWithExcessIsOn: boolean;
	chargeUntilMinBattery?: number;

	forceChargeIsOn?: boolean;
	forceChargeUnderCent?: number;
	forceChargeKw?: number;

	minChargingPower: number;
	maxChargingPower: number;
	minMinutesOldForAction: number;
	kwFromBattery: number;
	maxKwFor1Phase: number;
	forceChargeUnderCentFallback: number;
	currentPriceFallback: number;
	kwDifferenceChange: number;
}

const FixedUserSettings = {
	minChargingPower: 1.5,
	maxChargingPower: 9,
	minMinutesOldForAction: 10,
	kwFromBattery: 4.5,
	maxKwFor1Phase: 3,
	forceChargeUnderCentFallback: 20,
	currentPriceFallback: 50,
	kwDifferenceChange: 0.3
};

export class Db {
	static supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
	static supabaseKey = import.meta.env.VITE_SUPABASE_KEY as string;

	// @ts-ignore
	static getClient(): SupabaseClient {
		return createClient(this.supabaseUrl, this.supabaseKey);
	}

	static async getUserSettings(email: string): Promise<IUserSettings | undefined> {
		if (!email) return;

		const supabase = this.getClient();
		const { data, error } = await supabase.from('user').select('*').eq('email', email).single();
		if (error) console.error(error);

		if (!data) {
			// insert user entry
			await supabase.from('user').insert({ email });
			return this.getUserSettings(email);
		}

		return this.mapFromDb(data);
	}

	static async getUserSettingsByHash(hash: string): Promise<IUserSettings | undefined> {
		if (!hash) return;

		const supabase = this.getClient();
		const { data, error } = await supabase
			.from('user')
			.select('*')
			.eq('hash', hash)
			.neq('hash', Math.random())
			.single();

		if (error) console.error(error);

		if (!data) return undefined;

		return this.mapFromDb(data);
	}

	static mapFromDb(dbUser: any): IUserSettings {
		return {
			email: dbUser.email,
			hash: dbUser.hash,
			theme: dbUser.theme,
			currentInverter: dbUser.solarManIsOn ? 'solarman' : dbUser.solarEdgeIsOn ? 'solaredge' : '',
			currentWallbox: dbUser.goEIsOn ? 'goe' : '',

			solarManAppId: dbUser.solarManAppId,
			solarManAppSecret: dbUser.solarManAppSecret,
			solarManAppEmail: dbUser.solarManAppEmail,
			solarManAppPw: dbUser.solarManAppPw,

			solarEdgeApiKey: dbUser.solarEdgeApiKey,

			goESerial: dbUser.goESerial,
			goEApiToken: dbUser.goEApiToken,

			useAwattar: dbUser.useAwattar,

			chargeWithExcessIsOn: dbUser.chargeWithExcessIsOn,
			chargeUntilMinBattery: dbUser.chargeUntilMinBattery,

			forceChargeIsOn: dbUser.forceChargeIsOn,
			forceChargeUnderCent: dbUser.forceChargeUnderCent,
			forceChargeKw: dbUser.forceChargeKw,

			...FixedUserSettings
		} as IUserSettings;
	}

	static async saveUserSettings(email: string, settings: IUserSettings) {
		const supabase = this.getClient();
		const { error } = await supabase
			.from('user')
			.update({
				// theme: user.theme,
				// hash: user.hash,
				solarManAppId: settings.solarManAppId,
				solarManAppSecret: settings.solarManAppSecret,
				solarManAppEmail: settings.solarManAppEmail,
				solarManAppPw: settings.solarManAppPw,
				solarManIsOn: settings.currentInverter === 'solarman',
				solarEdgeIsOn: settings.currentInverter === 'solaredge',
				solarEdgeApiKey: settings.solarEdgeApiKey,
				useAwattar: settings.useAwattar,
				chargeWithExcessIsOn: settings.chargeWithExcessIsOn,
				chargeUntilMinBattery: settings.chargeUntilMinBattery,
				forceChargeIsOn: settings.forceChargeIsOn,
				forceChargeUnderCent: settings.forceChargeUnderCent,
				forceChargeKw: settings.forceChargeKw,
				goEIsOn: settings.currentWallbox === 'goe',
				goESerial: settings.goESerial,
				goEApiToken: settings.goEApiToken
			})
			.eq('email', email);
	}

	static async saveUserSolarManToken(email: string, token: string) {
		const supabase = this.getClient();
		const { error } = await supabase
			.from('user')
			.update({
				solarManLastAccessToken: token
			})
			.eq('email', email);
	}
}

import pkg from '@supabase/supabase-js';
const { createClient, SupabaseClient } = pkg;
import { SUPABASE_KEY, SUPABASE_URL } from '$env/static/private';

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
}

export interface IUser {
	theme: string;
	email: string;
	hash: string;
	solarManIsOn: boolean;
	solarManAppId: string;
	solarManAppSecret: string;
	solarManAppEmail: string;
	solarManAppPw: string;
	solarManLastAccessToken: string;
	chargeWithExcessIsOn: boolean;
	chargeUntilMinBattery?: number;
	forceChargeIsOn?: boolean;
	forceChargeUnderCent?: number;
	forceChargeKw?: number;
	goEIsOn: boolean;
	goESerial: string;
	goEApiToken: string;
	useAwattar: boolean;
	solarEdgeIsOn: boolean;
	solarEdgeApiKey: string;
}

export class Db {
	static supabaseUrl = SUPABASE_URL;
	static supabaseKey = SUPABASE_KEY;

	// @ts-ignore
	static getClient(): SupabaseClient {
		return createClient(this.supabaseUrl, this.supabaseKey);
	}

	static async getUser(email: string): Promise<IUser | undefined> {
		if (!email) return;

		const supabase = this.getClient();
		const { data, error } = await supabase.from('user').select('*').eq('email', email).single();
		if (error) console.error(error);

		if (!data) {
			// insert user entry
			await supabase.from('user').insert({ email });
			return this.getUser(email);
		}

		return this.mapFromDb(data);
	}

	static async getUserSettings(email: string): Promise<IUserSettings | undefined> {
		const user = await this.getUser(email);
		return user ? this.mapToUserSettings(user) : undefined;
	}

	static async getUserByHash(hash: string): Promise<IUser | undefined> {
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

	static mapFromDb(dbUser: any): IUser {
		return {
			email: dbUser.email,
			hash: dbUser.hash,
			theme: dbUser.theme,
			solarManAppId: dbUser.solarManAppId,
			solarManAppSecret: dbUser.solarManAppSecret,
			solarManAppEmail: dbUser.solarManAppEmail,
			solarManAppPw: dbUser.solarManAppPw,
			solarManIsOn: dbUser.solarManIsOn,
			solarManLastAccessToken: dbUser.solarManLastAccessToken,
			chargeWithExcessIsOn: dbUser.chargeWithExcessIsOn,
			chargeUntilMinBattery: dbUser.chargeUntilMinBattery,
			forceChargeIsOn: dbUser.forceChargeIsOn,
			forceChargeUnderCent: dbUser.forceChargeUnderCent,
			forceChargeKw: dbUser.forceChargeKw,
			goEIsOn: dbUser.goEIsOn,
			goESerial: dbUser.goESerial,
			goEApiToken: dbUser.goEApiToken,
			useAwattar: dbUser.useAwattar,
			solarEdgeIsOn: dbUser.solarEdgeIsOn,
			solarEdgeApiKey: dbUser.solarEdgeApiKey
		} as IUser;
	}

	static async saveUserSettings(email: string, settings: IUserSettings) {
		const user = this.mapSettingsToUser(settings);
		const supabase = this.getClient();
		const { error } = await supabase
			.from('user')
			.update({
				// theme: user.theme,
				// hash: user.hash,
				solarManAppId: user.solarManAppId,
				solarManAppSecret: user.solarManAppSecret,
				solarManAppEmail: user.solarManAppEmail,
				solarManAppPw: user.solarManAppPw,
				solarManIsOn: user.solarManIsOn,
				solarEdgeIsOn: user.solarEdgeIsOn,
				solarEdgeApiKey: user.solarEdgeApiKey,
				useAwattar: user.useAwattar,
				chargeWithExcessIsOn: user.chargeWithExcessIsOn,
				chargeUntilMinBattery: user.chargeUntilMinBattery,
				forceChargeIsOn: user.forceChargeIsOn,
				forceChargeUnderCent: user.forceChargeUnderCent,
				forceChargeKw: user.forceChargeKw,
				goEIsOn: user.goEIsOn,
				goESerial: user.goESerial,
				goEApiToken: user.goEApiToken
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

	static mapToUserSettings(user: IUser): IUserSettings {
		return {
			theme: user.theme,
			currentInverter: user.solarManIsOn ? 'solarman' : user.solarEdgeIsOn ? 'solaredge' : '',
			currentWallbox: user.goEIsOn ? 'goe' : '',

			solarManAppId: user.solarManAppId,
			solarManAppSecret: user.solarManAppSecret,
			solarManAppEmail: user.solarManAppEmail,
			solarManAppPw: user.solarManAppPw,

			solarEdgeApiKey: user.solarEdgeApiKey,

			goESerial: user.goESerial,
			goEApiToken: user.goEApiToken,

			useAwattar: user.useAwattar,

			chargeWithExcessIsOn: user.chargeWithExcessIsOn,
			chargeUntilMinBattery: user.chargeUntilMinBattery,

			forceChargeIsOn: user.forceChargeIsOn,
			forceChargeUnderCent: user.forceChargeUnderCent,
			forceChargeKw: user.forceChargeKw
		} as IUserSettings;
	}

	static mapSettingsToUser(userSettings: IUserSettings): IUser {
		return {
			theme: userSettings.theme,
			solarManIsOn: userSettings.currentInverter === 'solarman',
			goEIsOn: userSettings.currentWallbox === 'goe',

			solarManAppId: userSettings.solarManAppId,
			solarManAppSecret: userSettings.solarManAppSecret,
			solarManAppEmail: userSettings.solarManAppEmail,
			solarManAppPw: userSettings.solarManAppPw,

			goESerial: userSettings.goESerial,
			goEApiToken: userSettings.goEApiToken,

			solarEdgeIsOn: userSettings.currentInverter === 'solaredge',
			solarEdgeApiKey: userSettings.solarEdgeApiKey,
			useAwattar: userSettings.useAwattar,

			chargeWithExcessIsOn: userSettings.chargeWithExcessIsOn,
			chargeUntilMinBattery: userSettings.chargeUntilMinBattery,

			forceChargeIsOn: userSettings.forceChargeIsOn,
			forceChargeUnderCent: userSettings.forceChargeUnderCent,
			forceChargeKw: userSettings.forceChargeKw
		} as IUser;
	}
}

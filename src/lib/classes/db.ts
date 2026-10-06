import moment from 'moment';
import { createClient } from '@supabase/supabase-js';

export interface IUserSettings {
	email: string;

	currentInverter: '' | 'solarman' | 'solaredge';
	currentWallbox: '' | 'goe';

	theme: string;

	solarManAppId: string;
	solarManAppSecret: string;
	solarManAppEmail: string;
	solarManAppPw: string;

	solarEdgeApiKey: string;
	solarEdgeAccountKey: string;

	goESerial: string;
	goEApiToken: string;

	useAwattar: boolean;

	/** Exclusive price source: 'none' | 'awattar' (default) | 'fixed'. */
	priceProvider: 'none' | 'awattar' | 'fixed';
	/** Fixed-price tariff JSON, stored verbatim. */
	fixedPriceData: string | null;

	chargeWithExcessIsOn: boolean;
	chargeUntilMinBattery?: number;

	forceChargeIsOn?: boolean;
	forceChargeUnderCent?: number;
	forceChargeKw?: number;

	autoExecuteSuggestions: boolean;
	autoTurnOffForceCharging: boolean;
	lastForceChargeReset?: Date;
	carBatteryKwh?: number;
	carBatteryCurrentPercent?: number;
	carBatteryTargetPercent?: number;
	carBatteryTargetHour?: number;
	pauseCharging: boolean;

	manualChargeIsOn?: boolean;
	manualChargeKw?: number;
	manualChargeUntil?: Date;

	minChargingPower: number;
	maxChargingPower: number;
	minMinutesOldForAction: number;
	kwFromBattery: number;
	maxKwFor1Phase: number;
	forceChargeUnderCentFallback: number;
	currentPriceFallback: number;
	kwDifferenceChange: number;
}

/** Subset of the Supabase `user` row consumed by mapFromDb. */
interface IDbUserRow {
	email?: string;
	hash?: string;
	theme?: string;
	solarManIsOn?: boolean;
	solarEdgeIsOn?: boolean;
	solarManAppId?: string;
	solarManAppSecret?: string;
	solarManAppEmail?: string;
	solarManAppPw?: string;
	solarEdgeApiKey?: string;
	solarEdgeAccountKey?: string;
	goEIsOn?: boolean;
	goESerial?: string;
	goEApiToken?: string;
	useAwattar?: boolean;
	priceProvider?: string;
	fixedPriceData?: string | null;
	chargeWithExcessIsOn?: boolean;
	chargeUntilMinBattery?: number;
	forceChargeIsOn?: boolean;
	forceChargeUnderCent?: number;
	forceChargeKw?: number;
	autoExecuteSuggestions?: boolean;
	autoTurnOffForceCharging?: boolean;
	carBatteryKwh?: number;
	carBatteryCurrentPercent?: number;
	carBatteryTargetPercent?: number;
	carBatteryTargetHour?: number;
	pauseCharging?: boolean;
	manualChargeIsOn?: boolean;
	manualChargeKw?: number;
	manualChargeUntil?: string | Date;
	lastForceChargeReset?: string | Date;
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

	static parseEmail(email: string): string {
		return email;
	}

	static async getUserSettings(email: string): Promise<IUserSettings | undefined> {
		if (!email) return;

		console.log('getUserSettins', email);
		console.log('getUserSettins p ', this.parseEmail(email));

		const supabase = this.getClient();
		const { data, error } = await supabase
			.from('user')
			.select('*')
			.eq('email', this.parseEmail(email))
			.single();
		if (error) {
			console.error(error);
		}

		if (!data) {
			// insert user entry
			const res = await supabase.from('user').insert({
				email: this.parseEmail(email)
			});
			return this.getUserSettings(this.parseEmail(email));
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

	static mapFromDb(dbUser: IDbUserRow): IUserSettings {
		// Legacy derivation (identical to iOS): the old useAwattar master switch
		// wins over the priceProvider column default. Off -> 'none'; on -> the
		// column with 'none'/missing treated as 'awattar'.
		const priceProvider: IUserSettings['priceProvider'] = dbUser.useAwattar
			? dbUser.priceProvider === 'fixed'
				? 'fixed'
				: 'awattar'
			: 'none';
		return {
			email: this.parseEmail(dbUser.email ?? ''),
			hash: dbUser.hash,
			theme: dbUser.theme,
			currentInverter: dbUser.solarManIsOn ? 'solarman' : dbUser.solarEdgeIsOn ? 'solaredge' : '',
			currentWallbox: dbUser.goEIsOn ? 'goe' : '',

			solarManAppId: dbUser.solarManAppId,
			solarManAppSecret: dbUser.solarManAppSecret,
			solarManAppEmail: dbUser.solarManAppEmail,
			solarManAppPw: dbUser.solarManAppPw,

			solarEdgeApiKey: dbUser.solarEdgeApiKey,
			solarEdgeAccountKey: dbUser.solarEdgeAccountKey,

			goESerial: dbUser.goESerial,
			goEApiToken: dbUser.goEApiToken,

			// Legacy derivation (identical to iOS): the old useAwattar master switch
			// wins over the priceProvider column default. Off -> 'none'; on -> the
			// column with 'none'/missing treated as 'awattar'.
			priceProvider: dbUser.useAwattar
				? dbUser.priceProvider === 'fixed'
					? 'fixed'
					: 'awattar'
				: 'none',
			// Derived mirror (= priceProvider !== 'none') kept for engine/UI gates.
			useAwattar: priceProvider !== 'none',

			fixedPriceData: dbUser.fixedPriceData ?? null,

			chargeWithExcessIsOn: dbUser.chargeWithExcessIsOn,
			chargeUntilMinBattery: dbUser.chargeUntilMinBattery,

			forceChargeIsOn: dbUser.forceChargeIsOn,
			forceChargeUnderCent: dbUser.forceChargeUnderCent,
			forceChargeKw: dbUser.forceChargeKw,

			autoExecuteSuggestions: dbUser.autoExecuteSuggestions,
			autoTurnOffForceCharging: dbUser.autoTurnOffForceCharging,

			carBatteryKwh: dbUser.carBatteryKwh ?? 70,
			carBatteryCurrentPercent: dbUser.carBatteryCurrentPercent ?? 50,
			carBatteryTargetPercent: dbUser.carBatteryTargetPercent ?? 50,
			carBatteryTargetHour: dbUser.carBatteryTargetHour ?? 6,
			pauseCharging: dbUser.pauseCharging,

			manualChargeIsOn: dbUser.manualChargeIsOn ?? false,
			manualChargeKw: dbUser.manualChargeKw ?? undefined,
			manualChargeUntil: dbUser.manualChargeUntil
				? moment(dbUser.manualChargeUntil).toDate()
				: undefined,

			lastForceChargeReset: dbUser.lastForceChargeReset
				? moment(dbUser.lastForceChargeReset).toDate()
				: undefined,

			...FixedUserSettings
		} as IUserSettings;
	}

	static async resetForceCharge(email: string) {
		const supabase = this.getClient();
		const { error } = await supabase
			.from('user')
			.update({
				forceChargeIsOn: false,
				lastForceChargeReset: moment().toDate()
			})
			.eq('email', this.parseEmail(email));
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
				solarEdgeAccountKey: settings.solarEdgeAccountKey,
				useAwattar: settings.useAwattar,
				priceProvider: settings.priceProvider,
				fixedPriceData: settings.fixedPriceData ?? null,
				chargeWithExcessIsOn: settings.chargeWithExcessIsOn,
				chargeUntilMinBattery: settings.chargeUntilMinBattery,
				forceChargeIsOn: settings.forceChargeIsOn,
				forceChargeUnderCent: settings.forceChargeUnderCent,
				forceChargeKw: settings.forceChargeKw,
				autoExecuteSuggestions: settings.autoExecuteSuggestions,
				autoTurnOffForceCharging: settings.autoTurnOffForceCharging,
				goEIsOn: settings.currentWallbox === 'goe',
				goESerial: settings.goESerial,
				goEApiToken: settings.goEApiToken,
				carBatteryKwh: settings.carBatteryKwh,
				carBatteryCurrentPercent: settings.carBatteryCurrentPercent,
				carBatteryTargetPercent: settings.carBatteryTargetPercent,
				carBatteryTargetHour: settings.carBatteryTargetHour,
				pauseCharging: settings.pauseCharging
			})
			.eq('email', this.parseEmail(email));
	}

	static async setPauseCharging(email: string, pauseCharging: boolean) {
		const supabase = this.getClient();
		const { error } = await supabase
			.from('user')
			.update({
				pauseCharging: pauseCharging
			})
			.eq('email', this.parseEmail(email));
	}

	/**
	 * Manual boost charging - overrules all other charging logic while on.
	 * Only mutated here and by the manual_charging endpoint, deliberately NOT
	 * in saveUserSettings so a stale settings save cannot clear an active boost.
	 */
	static async setManualCharging(email: string, on: boolean, kw?: number, until?: Date) {
		const supabase = this.getClient();
		const { error } = await supabase
			.from('user')
			.update({
				manualChargeIsOn: on,
				manualChargeKw: on ? (kw ?? null) : null,
				manualChargeUntil: on && until ? until.toISOString() : null
			})
			.eq('email', this.parseEmail(email));
		if (error) console.error(error);
	}

	static async expireManualCharge(email: string) {
		const supabase = this.getClient();
		const { error } = await supabase
			.from('user')
			.update({
				manualChargeIsOn: false,
				manualChargeKw: null,
				manualChargeUntil: null
			})
			.eq('email', this.parseEmail(email))
			.eq('manualChargeIsOn', true)
			.lt('manualChargeUntil', moment().toDate().toISOString());
		if (error) console.error(error);
	}

	static async saveUserSolarManToken(email: string, token: string) {
		const supabase = this.getClient();
		const { error } = await supabase
			.from('user')
			.update({
				solarManLastAccessToken: token
			})
			.eq('email', this.parseEmail(email));
	}
}

import type { IUserSettings } from '$lib/classes/db';
import { type IWallBoxMethods, type IWallBoxRealTimeData, WallBoxApi } from '$lib/classes/wallBox';
import { InverterApi } from '$lib/classes/interver';
import { AwattarApi } from '$lib/classes/awattar';

export interface IChargingStatus {
	gotInverterData: boolean;
	inverterTimestamp: Date;
	powerProduction: number | null;
	powerUsage: number | null;
	batterySoc: number | null;

	gotWallBoxData: boolean;
	kw?: number;
	ampere?: number;
	phase?: number;
	chargingAllowed?: boolean;
	carStatus: 'waiting' | 'charging' | 'charged' | 'unknown';

	currentPrice: number | null;
}

export interface IChargingSuggestion {
	allDataAvailable: boolean;
	currentChargingReason: '' | 'force' | 'excess' | 'battery';
}

export interface IChargingInfo extends IChargingStatus {
	userSettings: IUserSettings;
	suggestion: IChargingSuggestion;
}

export class ChargingApi {
	userSettings: IUserSettings;

	constructor(userSettings: IUserSettings) {
		this.userSettings = userSettings;
	}

	async getChargingInfo(): Promise<IChargingInfo> {
		const wallBoxApi = new WallBoxApi(this.userSettings!);
		const wallBoxRealTimeData = await wallBoxApi.getRealTimeData();

		const inverterApi = new InverterApi(this.userSettings!);
		const inverterRealTimeData = await inverterApi.getRealTimeData();

		const currentPrice = this.userSettings.useAwattar
			? ((await AwattarApi.getCurrentPrice()) ?? null)
			: null;

		const chargingStatus = {
			gotInverterData: inverterRealTimeData !== null,
			powerProduction: inverterRealTimeData?.powerProduction ?? 0,
			powerUsage: inverterRealTimeData?.powerUsage ?? 0,
			inverterTimestamp: inverterRealTimeData?.timestamp ?? new Date(),
			batterySoc: inverterRealTimeData?.batterySoc ?? 0,

			gotWallBoxData: wallBoxRealTimeData !== null,
			kw: wallBoxRealTimeData?.kw ?? 0,
			ampere: wallBoxRealTimeData?.ampere ?? 0,
			phase: wallBoxRealTimeData?.phase ?? 0,
			chargingAllowed: wallBoxRealTimeData?.chargingAllowed ?? false,
			carStatus: wallBoxRealTimeData?.carStatus ?? 'unknown',

			currentPrice: currentPrice
		} as IChargingStatus;

		return {
			...chargingStatus,
			userSettings: this.userSettings,
			suggestion: this.calculateChargingSuggestion(chargingStatus)
		};
	}

	calculateChargingSuggestion(status: IChargingStatus): IChargingSuggestion {
		let ret = {} as IChargingSuggestion;

		const currentlyCharging = (status.kw ?? 0) > 0;
		const usageWithoutCar = (status.powerUsage ?? 0) - (status.kw ?? 0);
		const exceedingKw = (status.powerProduction ?? 0) - usageWithoutCar;

		if (currentlyCharging && this.userSettings.chargeWithExcessIsOn && exceedingKw > 0)
			ret.currentChargingReason = 'excess';
		else if (
			currentlyCharging &&
			(status.batterySoc ?? 0) > (this.userSettings.chargeUntilMinBattery ?? 0)
		)
			ret.currentChargingReason = 'excess';
		else if (currentlyCharging) ret.currentChargingReason = 'force';
		else ret.currentChargingReason = '';

		return ret;
	}
}

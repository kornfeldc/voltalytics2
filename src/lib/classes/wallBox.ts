import type { IUserSettings } from '$lib/classes/db';
import { GoeApi } from '$lib/classes/goe';
/**
 * Interface representing the base data for an inverter.
 *
 * @property {number | null} batterySoc - The state of charge of the battery, or null if not available.
 * @property {number | null} powerFromGrid - The power drawn from the grid, or null if not available.
 * @property {number | null} powerToGrid - The power supplied to the grid, or null if not available.
 * @property {number | null} powerToBattery - The power sent to the battery for charging, or null if not available.
 * @property {number | null} powerFromBattery - The power drawn from the battery, or null if not available.
 * @property {number | null} powerProduction - The power produced by the inverter, or null if not available.
 * @property {number | null} powerUsage - The power usage of the system, or null if not available.
 */
export interface IWallBoxBaseData {}

export interface IWallBoxRealTimeData extends IWallBoxBaseData {
	kw?: number;
	ampere?: number;
	phase?: number;
	chargingAllowed?: boolean;
	carStatus: 'waiting' | 'charging' | 'charged' | 'unknown';
}

export interface IWallBoxChargingResponse {
	status: 'success' | 'error';
	message?: string;
}

export interface IWallBoxMethods {
	getRealTimeData(): Promise<IWallBoxRealTimeData | undefined>;
	getPhaseAndAmpFromKw(kw: number): { phase: number; ampere: number };
	setChargingSpeed(kw: number): Promise<IWallBoxChargingResponse>;
}

export class WallBoxApi implements IWallBoxMethods {
	userSettings: IUserSettings;
	constructor(userSettings: IUserSettings) {
		this.userSettings = userSettings;
	}

	setChargingSpeed(kw: number): Promise<IWallBoxChargingResponse> {
		const apiObj = this.getWallBoxApiObj();
		if (!apiObj) return Promise.reject('No wallbox API object found.');
		return apiObj.setChargingSpeed(kw);
	}

	getPhaseAndAmpFromKw(kw: number): { phase: number; ampere: number } {
		return this.getWallBoxApiObj()?.getPhaseAndAmpFromKw(kw) ?? { phase: 0, ampere: 0 };
	}

	getRealTimeData(): Promise<IWallBoxRealTimeData | undefined> {
		const apiObj = this.getWallBoxApiObj();
		if (!apiObj) return Promise.reject('No wallbox API object found.');
		return apiObj.getRealTimeData();
	}

	getWallBoxApiObj(): IWallBoxMethods | undefined {
		if (this.userSettings?.currentWallbox === 'goe') {
			return new GoeApi(this.userSettings);
		}
		return undefined;
	}
}

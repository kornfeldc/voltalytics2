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

export interface IWallBoxMethods {
	getRealTimeData(): Promise<IWallBoxRealTimeData | undefined>;
}

export class WallBoxApi implements IWallBoxMethods {
	userSettings: IUserSettings;
	constructor(userSettings: IUserSettings) {
		this.userSettings = userSettings;
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

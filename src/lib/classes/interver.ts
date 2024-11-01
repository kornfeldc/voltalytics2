import type { IUserSettings } from '$lib/classes/db';
import { SolarmanApi } from '$lib/classes/solarman';

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
export interface IInverterBaseData {
	batterySoc: number | null;

	powerFromGrid: number | null;
	powerToGrid: number | null;

	powerToBattery: number | null;
	powerFromBattery: number | null;

	powerProduction: number | null;
	powerUsage: number | null;
}

export interface IInverterRealTimeData extends IInverterBaseData {
	timestamp: Date;
}

export interface IInverterMethods {
	getRealTimeData(): Promise<IInverterRealTimeData | undefined>;
}

export class InverterApi implements IInverterMethods {
	userSettings: IUserSettings;
	constructor(userSettings: IUserSettings) {
		this.userSettings = userSettings;
	}

	getRealTimeData(): Promise<IInverterRealTimeData | undefined> {
		const apiObj = this.getInverterApiObj();
		if (!apiObj) return Promise.reject('No inverter API object found.');
		return apiObj.getRealTimeData();
	}

	getInverterApiObj(): IInverterMethods | undefined {
		if (this.userSettings?.currentInverter === 'solarman') {
			return new SolarmanApi(this.userSettings);
		}
		return undefined;
	}
}

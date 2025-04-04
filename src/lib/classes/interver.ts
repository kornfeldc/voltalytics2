﻿import type { IUserSettings } from '$lib/classes/db';
import { SolarmanApi } from '$lib/classes/solarman';
import moment from 'moment';
import { SolarEdgeApi } from '$lib/classes/solaredge';

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
	powerFromGrid: number | null;
	powerToGrid: number | null;

	powerToBattery: number | null;
	powerFromBattery: number | null;

	powerProduction: number | null;
	powerUsage: number | null;
}

export interface IInverterStatistic extends IInverterBaseData {}

export interface IInverterRealTimeData extends IInverterBaseData {
	timestamp: Date;
	batterySoc: number | null;
}

export interface IInverterMethods {
	getRealTimeData(): Promise<IInverterRealTimeData | undefined>;
	getStatistics({
		referenceDate,
		range
	}: {
		referenceDate: string;
		range: 'day' | 'month' | 'year';
	}): Promise<IInverterStatistic[] | undefined>;
	getTimeFrameData({
		dayFrom,
		dayTo
	}: {
		dayFrom: string;
		dayTo: string;
	}): Promise<IInverterRealTimeData[] | undefined>;
}

export class InverterApi implements IInverterMethods {
	userSettings: IUserSettings;
	constructor(userSettings: IUserSettings) {
		this.userSettings = userSettings;
	}

	async getStatistics({
		referenceDate,
		range
	}: {
		referenceDate: string;
		range: 'day' | 'month' | 'year';
	}): Promise<IInverterStatistic[] | undefined> {
		const apiObj = this.getInverterApiObj();
		if (!apiObj) return Promise.reject('No inverter API object found.');

		if (moment(referenceDate).isAfter(moment(), range)) return [];
		return apiObj.getStatistics({ referenceDate, range });
	}

	async getTimeFrameData({
		dayFrom,
		dayTo
	}: {
		dayFrom: string;
		dayTo: string;
	}): Promise<IInverterRealTimeData[] | undefined> {
		const apiObj = this.getInverterApiObj();
		if (!apiObj) return Promise.reject('No inverter API object found.');
		return apiObj.getTimeFrameData({ dayFrom, dayTo });
	}

	async getRealTimeData(): Promise<IInverterRealTimeData | undefined> {
		const apiObj = this.getInverterApiObj();
		if (!apiObj) return Promise.reject('No inverter API object found.');
		return apiObj.getRealTimeData();
	}

	getInverterApiObj(): IInverterMethods | undefined {
		if (this.userSettings?.currentInverter === 'solarman')
			return new SolarmanApi(this.userSettings);

		if (this.userSettings?.currentInverter === 'solaredge')
			return new SolarEdgeApi(this.userSettings);

		return undefined;
	}
}

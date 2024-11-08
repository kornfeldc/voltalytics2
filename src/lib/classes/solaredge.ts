import type {
	IInverterMethods,
	IInverterRealTimeData,
	IInverterStatistic
} from '$lib/classes/interver';
import type { IUserSettings } from '$lib/classes/db';
import moment from 'moment';

export interface ISolarEdgeSiteOverview {
	production: {
		total: number;
		units: string;
		toSelfConsumption: number;
		toStorage: number;
		toGrid: number;
	};

	consumption: {
		total: number;
		units: string;
		fromPv: number;
		fromStorage: number;
		fromGrid: number;
	};

	performance: {
		specificYield: number;
		performanceRation: number;
	};
}

export interface ISolarEdgePowerFlow {
	updatedAt: string;
	refreshRate: number;
	unit: string;
	pv: {
		active: boolean;
		power: number;
	};
	load: {
		active: boolean;
		power: number;
	};
	storage: {
		active: boolean;
		power: number;
		status: 'CHARGE' | 'DISCHARGE' | 'IDLE';
		chargeLevel: number;
	};
	grid: {
		active: boolean;
		power: number;
		status: 'IMPORT' | 'EXPORT' | 'IDLE' | 'GRID_OUTAGE';
	};
}

export class SolarEdgeApi implements IInverterMethods {
	userSettings: IUserSettings;
	solarEdgeUrl = import.meta.env.VITE_SOLAREDGE_URL as string;

	constructor(userSettings: IUserSettings) {
		this.userSettings = userSettings;
	}

	async getRealTimeData(): Promise<IInverterRealTimeData | undefined> {
		const stationId = await this.getStationId();
		if (!stationId) return;

		let url = `${this.solarEdgeUrl}/sites/${stationId}/power-flow`;
		url += new Date().getTime();

		const response = await fetch(url, {
			headers: {
				...this.getHeaders()
			}
		});

		if (!response.ok) return;

		const result = await response.json();

		const realTimeInfo = result as ISolarEdgePowerFlow;
		return this.mapToInverterResult(realTimeInfo);
	}

	async getTimeFrameData({
		dayFrom,
		dayTo
	}: {
		dayFrom: string;
		dayTo: string;
	}): Promise<IInverterRealTimeData[] | undefined> {
		const stationId = await this.getStationId();
		if (!stationId) return;

		// const url = `${this.solarEdgeUrl}/station/v1.0/history?language=en`;
		// const body = {
		// 	stationId,
		// 	timeType: 1,
		// 	startTime: dayFrom,
		// 	endTime: dayTo
		// } as any;
		//
		// const response = await fetch(url, {
		// 	method: 'POST',
		// 	headers: {
		// 		'Content-Type': 'application/json',
		// 		Authorization: `Bearer ${token}`
		// 	},
		// 	body: JSON.stringify(body)
		// });
		//
		// if (!response.ok) return;
		//
		// const result = await response.json();
		// if (!result?.requestId) return;
		//
		// const data = result as any;
		// if (!data.success) return;
		//
		// const stationData = result.stationDataItems as ISolarEdgeRealTimeInfo[];
		// return stationData.map((x) => this.mapToInverterResult(x));
		return [];
	}

	async getStatistics({
		referenceDate,
		range
	}: {
		referenceDate: string;
		range: 'day' | 'month' | 'year';
	}): Promise<IInverterStatistic[] | undefined> {
		const stationId = await this.getStationId();
		if (!stationId) return;
		//
		// const url = `${this.solarEdgeUrl}/station/v1.0/history?language=en`;
		// const body = {
		// 	stationId
		// } as any;
		//
		// if (range === 'day') {
		// 	body.timeType = 2;
		// 	body.startTime = moment(referenceDate).format('YYYY-MM-DD');
		// 	body.endTime = moment(referenceDate).format('YYYY-MM-DD');
		// } else if (range === 'month') {
		// 	body.timeType = 3;
		// 	body.startTime = moment(referenceDate).format('YYYY-MM');
		// 	body.endTime = moment(referenceDate).format('YYYY-MM');
		// }
		//
		// const response = await fetch(url, {
		// 	method: 'POST',
		// 	headers: {
		// 		'Content-Type': 'application/json',
		// 		Authorization: `Bearer ${token}`
		// 	},
		// 	body: JSON.stringify(body)
		// });
		//
		// if (!response.ok) return;
		//
		// const result = await response.json();
		// if (!result?.requestId) return;
		//
		// if (!result.success) return;
		//
		// const stationData = result.stationDataItems as ISolarEdgeFrameStationDataItem[];
		// return stationData.map((x) => this.mapStatToInverterResult(x));
		return [];
	}

	private getHeaders() {
		return {
			'X-API-KEY': this.userSettings.solarManAppId,
			'X-Account-Key': this.userSettings.solarManAppEmail
		};
	}

	async getStationId(): Promise<string | undefined> {
		const url = `${this.solarEdgeUrl}/sites`;
		const response = await fetch(url, {
			headers: {
				...this.getHeaders()
			}
		});

		if (!response.ok) return;

		const result = await response.json();
		const stationList = result ?? [];
		if (stationList.length === 0) return;
		return stationList[0].siteId;
	}

	// mapToSiteOverviewInverterResult(realTimeInfo: ISolarEdgeSiteOverview): IInverterRealTimeData {
	// 	return {
	// 		//timestamp: new Date(),
	// 		//batterySoc: realTimeInfo.batterySoc,
	// 		powerProduction: realTimeInfo.production.total,
	// 		powerUsage: realTimeInfo.consumption.total,
	// 		powerFromGrid: realTimeInfo.consumption.fromGrid,
	// 		powerToGrid: realTimeInfo.production.toGrid,
	// 		powerFromBattery: realTimeInfo.consumption.fromStorage,
	// 		powerToBattery: realTimeInfo.production.toStorage
	// 	} as IInverterRealTimeData;
	// }

	mapToInverterResult(realTimeInfo: ISolarEdgePowerFlow): IInverterRealTimeData {
		return {
			timestamp: moment(realTimeInfo.updatedAt).toDate(),
			batterySoc: realTimeInfo.storage.chargeLevel,
			powerProduction: realTimeInfo.pv.power,
			powerUsage: realTimeInfo.load.power,
			powerFromGrid: realTimeInfo.grid.status === 'IMPORT' ? realTimeInfo.grid.power : 0,
			powerToGrid: realTimeInfo.grid.status === 'EXPORT' ? realTimeInfo.grid.power : 0,
			powerFromBattery:
				realTimeInfo.storage.status === 'DISCHARGE' ? realTimeInfo.storage.power : 0,
			powerToBattery: realTimeInfo.storage.status === 'CHARGE' ? realTimeInfo.storage.power : 0
		} as IInverterRealTimeData;
	}

	// mapStatToInverterResult(statistics: ISolarEdgeFrameStationDataItem): IInverterStatistic {
	// 	return {
	// 		powerProduction: statistics.generationValue ?? 0,
	// 		powerUsage: statistics.useValue ?? 0,
	// 		powerFromGrid: statistics.buyValue ?? 0,
	// 		powerToGrid: statistics.gridValue ?? 0,
	// 		powerFromBattery: statistics.dischargeValue ?? 0,
	// 		powerToBattery: statistics.chargeValue ?? 0
	// 	} as IInverterStatistic;
	// }
}

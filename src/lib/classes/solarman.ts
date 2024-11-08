import type {
	IInverterMethods,
	IInverterRealTimeData,
	IInverterStatistic
} from '$lib/classes/interver';
import type { IUserSettings } from '$lib/classes/db';
import moment from 'moment';

export interface ISolarManRealTimeInfo {
	success: boolean | null;
	lastUpdateTime: number | null;
	batterySoc: number | null;
	generationPower: number | null;
	usePower: number | null;
	gridPower: number | null;
	purchasePower: number | null;
	wirePower: number | null;
	chargePower: number | null;
	dischargePower: number | null;
	batteryPower: number | null;
	generationTotal: number | null;
}

export interface ISolarManFrameStationDataItem {
	useValue: number | null;
	gridValue: number | null;
	buyValue: number | null;
	chargeValue: number | null;
	dischargeValue: number | null;
	generationValue: number | null;
}

export class SolarmanApi implements IInverterMethods {
	userSettings: IUserSettings;
	solarManUrl = import.meta.env.VITE_SOLARMAN_URL as string;

	constructor(userSettings: IUserSettings) {
		this.userSettings = userSettings;
	}

	async getRealTimeData(): Promise<IInverterRealTimeData | undefined> {
		const token = await this.getAuthToken();
		if (!token) return;

		const stationId = await this.getStationId(token);
		if (!stationId) return;

		let url = `${this.solarManUrl}/station/v1.0/realTime?language=en`;
		url += new Date().getTime();

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify({ stationId })
		});

		if (!response.ok) return;

		const result = await response.json();
		if (!result?.requestId) return;

		const realTimeInfo = result as ISolarManRealTimeInfo;
		if (!realTimeInfo.success) return;
		return this.mapToInverterResult(realTimeInfo);
	}

	async getTimeFrameData({
		dayFrom,
		dayTo
	}: {
		dayFrom: string;
		dayTo: string;
	}): Promise<IInverterRealTimeData[] | undefined> {
		const token = await this.getAuthToken();
		if (!token) return;

		const stationId = await this.getStationId(token);
		if (!stationId) return;

		const url = `${this.solarManUrl}/station/v1.0/history?language=en`;
		const body = {
			stationId,
			timeType: 1,
			startTime: dayFrom,
			endTime: dayTo
		} as any;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) return;

		const result = await response.json();
		if (!result?.requestId) return;

		const data = result as any;
		if (!data.success) return;

		const stationData = result.stationDataItems as ISolarManRealTimeInfo[];
		return stationData.map((x) => this.mapToInverterResult(x));
	}

	async getStatistics({
		referenceDate,
		range
	}: {
		referenceDate: string;
		range: 'day' | 'month' | 'year';
	}): Promise<IInverterStatistic[] | undefined> {
		const token = await this.getAuthToken();
		if (!token) return;

		const stationId = await this.getStationId(token);
		if (!stationId) return this.getEmptyInverterStatistic();

		const url = `${this.solarManUrl}/station/v1.0/history?language=en`;
		const body = {
			stationId
		} as any;

		if (range === 'day') {
			body.timeType = 2;
			body.startTime = moment(referenceDate).format('YYYY-MM-DD');
			body.endTime = moment(referenceDate).format('YYYY-MM-DD');
		} else if (range === 'month') {
			body.timeType = 3;
			body.startTime = moment(referenceDate).format('YYYY-MM');
			body.endTime = moment(referenceDate).format('YYYY-MM');
		} else if (range === 'year') {
			body.timeType = 4;
			body.startTime = moment(referenceDate).startOf('year').format('YYYY');
			body.endTime = moment(referenceDate).endOf('year').format('YYYY');
		}

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) return this.getEmptyInverterStatistic();

		const result = await response.json();
		if (!result?.requestId) return this.getEmptyInverterStatistic();

		if (!result.success) return this.getEmptyInverterStatistic();

		const stationData = result.stationDataItems as ISolarManFrameStationDataItem[];
		const ret = stationData.map((x) => this.mapStatToInverterResult(x));
		if (ret.length === 0) return this.getEmptyInverterStatistic();
		return ret;
	}

	private getEmptyInverterStatistic(): Array<IInverterStatistic> {
		return [
			{
				powerFromGrid: 0,
				powerToGrid: 0,
				powerFromBattery: 0,
				powerToBattery: 0,
				powerProduction: 0,
				powerUsage: 0
			}
		] as IInverterStatistic[];
	}

	async getStationId(authToken: string | undefined): Promise<string | undefined> {
		const token = authToken ?? (await this.getAuthToken());
		if (!token) return;

		const body = {
			appSecret: this.userSettings.solarManAppSecret,
			email: this.userSettings.solarManAppEmail,
			password: this.userSettings.solarManAppPw
		};

		const bodyData = JSON.stringify(body);
		const url = `${this.solarManUrl}/station/v1.0/list`;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: bodyData
		});

		if (!response.ok) return;

		const result = await response.json();
		const stationList = result?.stationList ?? [];
		if (stationList.length === 0) return;
		return stationList[0].id;
	}

	async getAuthToken(): Promise<string | undefined> {
		const url = `${this.solarManUrl}/account/v1.0/token?appId=${this.userSettings.solarManAppId}`;
		const body = {
			appSecret: this.userSettings.solarManAppSecret,
			email: this.userSettings.solarManAppEmail,
			password: this.userSettings.solarManAppPw
		};

		const bodyData = JSON.stringify(body);

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: bodyData
		});

		if (!response.ok) return;

		const result = await response.json();
		return result.access_token;
	}

	mapToInverterResult(realTimeInfo: ISolarManRealTimeInfo): IInverterRealTimeData {
		let gridPower = (realTimeInfo.gridPower ?? 0) / 1000;
		if (gridPower <= 0.01) gridPower = 0;

		const unixDateTime = realTimeInfo.lastUpdateTime ?? (realTimeInfo as any).dateTime;
		return {
			timestamp: new Date(unixDateTime * 1000),
			batterySoc: realTimeInfo.batterySoc,
			powerProduction: (realTimeInfo.generationPower ?? 0) / 1000,
			powerUsage: (realTimeInfo.usePower ?? 0) / 1000,
			powerFromGrid: (realTimeInfo.purchasePower ?? 0) / -1000,
			powerToGrid: gridPower,
			powerFromBattery: (realTimeInfo.dischargePower ?? 0) / -1000,
			powerToBattery: (realTimeInfo.chargePower ?? 0) / 1000
		} as IInverterRealTimeData;
	}

	mapStatToInverterResult(statistics: ISolarManFrameStationDataItem): IInverterStatistic {
		return {
			powerProduction: statistics.generationValue ?? 0,
			powerUsage: statistics.useValue ?? 0,
			powerFromGrid: statistics.buyValue ?? 0,
			powerToGrid: statistics.gridValue ?? 0,
			powerFromBattery: statistics.dischargeValue ?? 0,
			powerToBattery: statistics.chargeValue ?? 0
		} as IInverterStatistic;
	}
}

import type { IInverterMethods, IInverterRealTimeData } from '$lib/classes/interver';
import type { IUserSettings } from '$lib/classes/db';
import { SOLARMAN_URL } from '$env/static/private';

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

export class SolarmanApi implements IInverterMethods {
	userSettings: IUserSettings;
	solarManUrl = SOLARMAN_URL;

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
		console.log('got this far', realTimeInfo);
		return {
			timestamp: new Date((realTimeInfo.lastUpdateTime ?? 0) * 1000),
			batterySoc: realTimeInfo.batterySoc,
			powerProduction: (realTimeInfo.generationPower ?? 0) / 1000,
			powerUsage: (realTimeInfo.usePower ?? 0) / 1000,
			powerFromGrid: (realTimeInfo.purchasePower ?? 0) / -1000,
			powerToGrid: (realTimeInfo.gridPower ?? 0) / 1000,
			powerFromBattery: (realTimeInfo.dischargePower ?? 0) / 1000,
			powerToBattery: (realTimeInfo.chargePower ?? 0) / 1000
		} as IInverterRealTimeData;
	}
}

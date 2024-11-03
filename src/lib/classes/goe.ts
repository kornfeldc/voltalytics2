import type { IUserSettings } from '$lib/classes/db';
import type { IWallBoxMethods, IWallBoxRealTimeData } from '$lib/classes/wallBox';

export class GoeApi implements IWallBoxMethods {
	userSettings: IUserSettings;
	goeUrl = import.meta.env.VITE_GOE_URL as string;

	constructor(userSettings: IUserSettings) {
		this.userSettings = userSettings;
	}

	private getEndpoint() {
		const url = this.goeUrl!;
		return url.replace('snr', this.userSettings.goESerial);
	}

	private getHeader() {
		return {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.userSettings.goEApiToken}`
			}
		};
	}
	async getRealTimeData(): Promise<IWallBoxRealTimeData | undefined> {
		const endpoint = this.getEndpoint() + '/api/status';
		const response = await fetch(endpoint, { ...this.getHeader() });
		const result = await response.json();
		return this.mapResult(result);
	}

	mapResult(result: any): IWallBoxRealTimeData {
		return {
			kw: (result?.nrg[11] ?? 0) / 1000,
			ampere: result?.amp ?? 0,
			phase: result?.psm ?? 0,
			chargingAllowed: result?.alw ?? false,
			carStatus:
				result?.car === 3 || result?.car === 4
					? 'waiting'
					: result?.c === 2
						? 'charging'
						: 'unknown'
		} as IWallBoxRealTimeData;
	}
}

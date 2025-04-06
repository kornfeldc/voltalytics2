import type { IUserSettings } from '$lib/classes/db';
import type {
	IWallBoxChargingResponse,
	IWallBoxMethods,
	IWallBoxRealTimeData
} from '$lib/classes/wallBox';
import { Time } from '@internationalized/date';

export class GoeApi implements IWallBoxMethods {
	userSettings: IUserSettings;
	goeUrl = import.meta.env.VITE_GOE_URL as string;

	constructor(userSettings: IUserSettings) {
		this.userSettings = userSettings;
	}

	setChargingSpeed(kw: number): Promise<IWallBoxChargingResponse> {
		console.log('goe check pc', this.userSettings.pauseCharging);
		if (this.userSettings.pauseCharging) return this.setRawChargingSpeed(0, 0);
		const phaseAndAmp = this.getPhaseAndAmpFromKw(kw);
		return this.setRawChargingSpeed(phaseAndAmp.ampere, phaseAndAmp.phase);
	}

	private async setRawChargingSpeed(
		current: number,
		phase: number
	): Promise<IWallBoxChargingResponse> {
		phase = phase == 3 ? 2 : phase;
		const charge = current > 0 && phase > 0;
		let endpoint = !charge
			? `${this.getEndpoint()}/api/set?frc=1`
			: `${this.getEndpoint()}/api/set?&amp=${current}&psm=${phase}&frc=2`;

		const response = await fetch(endpoint, {
			...this.getHeader(),
			method: 'GET'
		});

		if (response.ok) {
			const data = await response.json();
			console.log('setChargingSpeed response', data);
			return { status: 'success' };
		}
		return {
			status: 'error',
			message: response.statusText
		};
	}

	getPhaseAndAmpFromKw(kw: number): { phase: number; ampere: number } {
		if (kw < 1) return { phase: 0, ampere: 0 };

		let phase = 1;
		let ampere: number; // Minimum current setting

		// Assuming a voltage of 230V for single-phase and 400V for three-phase
		const singlePhaseVoltage = 230;
		const threePhaseVoltage = 400;

		// Calculate the current for single-phase
		const singlePhaseCurrent = (kw * 1000) / singlePhaseVoltage;

		// If the current exceeds 16A (common limit for single-phase), switch to three-phase
		if (singlePhaseCurrent > 16) {
			phase = 3;
			ampere = (kw * 1000) / (threePhaseVoltage * Math.sqrt(3));
		} else {
			ampere = singlePhaseCurrent;
		}

		// Round the current to the nearest whole number
		ampere = Math.round(ampere);

		// Ensure current is within safe and valid range
		if (phase === 1 && ampere > 32) {
			ampere = 32; // Upper limit for single-phase
		} else if (phase === 3 && ampere > 32) {
			ampere = 32; // Upper limit for three-phase
		} else if (ampere < 6) {
			ampere = 6; // Lower limit for safety
		}

		// dont charge with "too high" kw on 1 phase, switch to 3 phases instead
		if (kw > this.userSettings.maxKwFor1Phase && phase === 1) {
			phase = 3;
			ampere = 6;
		}

		return { phase, ampere };
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
		let endpoint = this.getEndpoint() + '/api/status';

		// https://github.com/goecharger/go-eCharger-API-v2/blob/main/apikeys-de.md
		const keysToGet = ['nrg', 'amp', 'psm', 'alw', 'car', 'utc', 'loc'];
		const filterParams = 'filter=' + keysToGet.join(',');
		endpoint += `?${filterParams}`;

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
					: result?.car === 2
						? 'charging'
						: 'unknown'
		} as IWallBoxRealTimeData;
	}
}

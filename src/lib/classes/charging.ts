import type { IUserSettings } from '$lib/classes/db';
import { WallBoxApi } from '$lib/classes/wallBox';
import { InverterApi } from '$lib/classes/interver';
import { AwattarApi } from '$lib/classes/awattar';
import moment from 'moment';

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
	suggestedKw: number;
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

		let chargingStatus = {
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

		// fake data for tesing
		// chargingStatus.kw = 4.5;
		// chargingStatus.powerUsage = 5;
		// chargingStatus.powerProduction = 0;
		// chargingStatus.carStatus = 'charging';
		// chargingStatus.batterySoc = 80;
		// this.userSettings.chargeUntilMinBattery = 100;

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

		ret.currentChargingReason = this.getCurrentChargingReason(
			currentlyCharging,
			status,
			exceedingKw
		);

		let forceChargeSuggestion = this.getForceChargeSuggestion(status);
		let batterySuggestion = this.getBatterySuggestion(status);
		let excessSuggestion = this.getExcessChargeSuggestion(status);

		if (excessSuggestion === -1) ret.suggestedKw = excessSuggestion;
		else {
			ret.suggestedKw = Math.max(...[forceChargeSuggestion, excessSuggestion, batterySuggestion]);
			// fit into boundaries
			if (ret.suggestedKw > 0 && ret.suggestedKw < this.userSettings.minChargingPower)
				ret.suggestedKw = this.userSettings.minChargingPower;
			if (ret.suggestedKw > this.userSettings.maxChargingPower)
				ret.suggestedKw = this.userSettings.maxChargingPower;
		}

		console.log('calculated suggestions', {
			forceChargeSuggestion,
			batterySuggestion,
			excessSuggestion,
			suggestedKw: ret.suggestedKw,
			diff: Math.abs(ret.suggestedKw - (status.kw ?? 0))
		});

		// check the difference between currently charging kw and suggested kw
		if (
			ret.suggestedKw > 0 &&
			Math.abs(ret.suggestedKw - (status.kw ?? 0)) < this.userSettings.kwDifferenceChange
		) {
			ret.suggestedKw = -1;
		}

		return ret;
	}

	private getExcessChargeSuggestion(status: IChargingStatus): number {
		if (!this.userSettings.chargeWithExcessIsOn) return 0;

		const usageWithoutCar = (status.powerUsage ?? 0) - (status.kw ?? 0);
		const exceedingKw = (status.powerProduction ?? 0) - usageWithoutCar;
		if (exceedingKw < 1) return 0;

		const inverterStatusMinutesOld = moment().diff(moment(status.inverterTimestamp), 'minutes');
		if (inverterStatusMinutesOld >= this.userSettings.minMinutesOldForAction) return -1;

		return exceedingKw;
	}

	private getForceChargeSuggestion(status: IChargingStatus): number {
		if (!this.userSettings.forceChargeIsOn) return 0;

		if (!this.userSettings.useAwattar) return this.userSettings.forceChargeKw ?? 5;

		const currentPrice = status.currentPrice ?? this.userSettings.currentPriceFallback;
		const forceChargeUnderCent =
			this.userSettings.forceChargeUnderCent ?? this.userSettings.forceChargeUnderCentFallback;

		if (currentPrice < forceChargeUnderCent) return this.userSettings.forceChargeKw ?? 5;
		return 0;
	}

	private getBatterySuggestion(status: IChargingStatus): number {
		if ((status.batterySoc ?? 0) > (this.userSettings.chargeUntilMinBattery ?? 100))
			return this.userSettings.kwFromBattery;
		return 0;
	}

	private getCurrentChargingReason(
		currentlyCharging: boolean,
		status: IChargingStatus,
		exceedingKw: number
	) {
		if (
			currentlyCharging &&
			(status.batterySoc ?? 0) > (this.userSettings.chargeUntilMinBattery ?? 0)
		)
			return 'battery';
		else if (currentlyCharging && this.userSettings.chargeWithExcessIsOn && exceedingKw > 0)
			return 'excess';
		else if (currentlyCharging) return 'force';
		return '';
	}
}

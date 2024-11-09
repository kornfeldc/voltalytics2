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

export interface ICalculationResult {
	suggestedPriceToSet?: number;
	suggestedKwToSet?: number;
	hoursCharging?: number;
	estimatedPrice?: number;
}

export interface ICalculationSuggestion extends ICalculationResult {
	status: undefined | 'no_suggestion' | 'suggestion' | 'not_necessary';
	failedReason?: undefined | 'no_awattar_data' | 'not_enough_data';
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

		// check the difference between currently charging kw and suggested kw
		if (
			ret.suggestedKw >= 0 &&
			Math.abs(ret.suggestedKw - (status.kw ?? 0)) < this.userSettings.kwDifferenceChange
		) {
			ret.suggestedKw = -1;
		}

		ret.suggestedKw = Math.round(ret.suggestedKw * 100) / 100;
		return ret;
	}

	async getCalculationSuggestion(): Promise<ICalculationSuggestion> {
		const currentKwhInBattery =
			(this.userSettings.carBatteryKwh! / 100) * this.userSettings.carBatteryCurrentPercent!;
		const targetKwhInBattery =
			(this.userSettings.carBatteryKwh! / 100) * this.userSettings.carBatteryTargetPercent!;
		const missingKwh = targetKwhInBattery - currentKwhInBattery;

		if (missingKwh <= 0)
			return {
				status: 'not_necessary'
			} as ICalculationSuggestion;

		const now = moment().startOf('hour');
		const targetMoment =
			this.userSettings.carBatteryTargetHour! <= moment().hour()
				? moment()
						.startOf('day')
						.add(1, 'days')
						.add(this.userSettings.carBatteryTargetHour! - 1, 'hours')
				: moment()
						.startOf('day')
						.add(this.userSettings.carBatteryTargetHour! - 1, 'hours');

		const hoursBetween = targetMoment.diff(now, 'hours');

		// get prices for all those hours
		const awattarPrices = await AwattarApi.getData({ hours: hoursBetween + 2, offsetHours: 0 });
		if (awattarPrices === null)
			return {
				status: 'no_suggestion',
				failedReason: 'no_awattar_data'
			} as ICalculationSuggestion;

		const match = awattarPrices!.find((p) => p.time.startOf('hour').isSame(targetMoment, 'hour'));
		if (!match)
			return {
				status: 'no_suggestion',
				failedReason: 'not_enough_data'
			} as ICalculationSuggestion;

		const prices = awattarPrices
			.filter((p) => p.time.startOf('hour').isAfter(moment(), 'hour'))
			.filter((p) => p.time.startOf('hour').isSameOrBefore(targetMoment, 'hour'))
			.map((p) => p.grossPrice);
		const calculationResult = this.calculateBestForceChargingValues(missingKwh, prices);

		return {
			status: 'suggestion',
			...calculationResult
		} as ICalculationSuggestion;
	}

	private calculateBestForceChargingValues(
		kwhToCharge: number,
		prices: Array<number>
	): ICalculationResult {
		// Constants for minimum and maximum charging power
		const minChargingPower = this.userSettings.minChargingPower;
		const maxChargingPower = this.userSettings.maxChargingPower;

		console.log('calculateBestForceChargingValues', kwhToCharge, prices);

		let suggestedPriceToSet = 0;
		let suggestedKwToSet = 0;
		let hoursCharging = 0;
		let estimatedPrice = 0;

		// Sort prices in ascending order to find the lowest viable threshold
		const sortedPrices = [...prices].sort((a, b) => a - b);
		console.log('sortedPrices', sortedPrices);

		// Iterate over each possible price threshold to find the optimal setting
		for (let priceThreshold of sortedPrices) {
			let totalKwhCharged = 0;
			let totalCost = 0;
			let hourCount = 0;

			// Charge only in hours where price is below or equal to the threshold
			for (let price of prices) {
				if (price <= priceThreshold) {
					// Calculate maximum charging speed within limits
					const chargingSpeed = Math.min(maxChargingPower, kwhToCharge - totalKwhCharged);
					totalKwhCharged += chargingSpeed;
					totalCost += price * chargingSpeed;
					hourCount++;

					// Stop if required kWh is reached
					if (totalKwhCharged >= kwhToCharge) break;
				}
			}

			// If this threshold allows us to charge the required kWh, record it as optimal
			if (totalKwhCharged >= kwhToCharge) {
				suggestedPriceToSet = priceThreshold;
				suggestedKwToSet = Math.min(maxChargingPower, kwhToCharge / hourCount);
				hoursCharging = hourCount;
				estimatedPrice = totalCost;
				break;
			}
		}
		// raise by 1 so that forceCharging works with < price
		suggestedPriceToSet += 0.1;

		suggestedPriceToSet = Math.round(suggestedPriceToSet * 100) / 100;
		suggestedKwToSet = Math.round(suggestedKwToSet * 10) / 10;
		estimatedPrice = Math.round(estimatedPrice) / 100;

		return {
			suggestedPriceToSet,
			suggestedKwToSet,
			hoursCharging,
			estimatedPrice
		};
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

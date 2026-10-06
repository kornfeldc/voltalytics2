import moment from 'moment';
import type { IUserSettings } from '$lib/classes/db';
import { AwattarApi, type AwattarEntry } from '$lib/classes/awattar';
import { getFixedPriceEntries } from '$lib/classes/fixedPrice';
import { VoltCache } from '$lib/classes/voltCache';

/**
 * Facade over the electricity price sources, dispatching on the user's
 * priceProvider setting. All price consumers (charging engine, calculator,
 * price views) call this - never AwattarApi directly. Missing/undefined
 * settings fall back to aWATTar (e.g. the public landing page before login).
 */
export class PriceApi {
	static async getData(
		{ hours = 5, offsetHours = 1 } = {},
		userSettings?: IUserSettings
	): Promise<Array<AwattarEntry> | null> {
		if (userSettings?.priceProvider === 'none') return [];
		if (userSettings?.priceProvider === 'fixed')
			return PriceApi.getFixedData({ hours, offsetHours }, userSettings.fixedPriceData);
		return AwattarApi.getData({ hours, offsetHours });
	}

	static async getCurrentPrice(userSettings?: IUserSettings): Promise<number | undefined> {
		if (userSettings?.priceProvider === 'none') return undefined;
		if (userSettings?.priceProvider === 'fixed') {
			const data = await PriceApi.getFixedData(
				{ hours: 2, offsetHours: 0 },
				userSettings.fixedPriceData
			);
			const now = moment().startOf('hour');
			return data.find((x) => moment(x.time).isSame(now))?.grossPrice;
		}
		return AwattarApi.getCurrentPrice();
	}

	/**
	 * Expands the fixed tariff into hourly entries, cached like aWATTar (1 h).
	 * The verbatim fixedPriceData string is part of the cache key so a tariff
	 * change invalidates the cached expansion. Moment objects serialized
	 * through VoltCache JSON come back as strings - re-wrapped here.
	 */
	private static async getFixedData(
		{ hours, offsetHours }: { hours: number; offsetHours: number },
		fixedPriceData: string | null
	): Promise<Array<AwattarEntry>> {
		try {
			const startMoment = moment()
				.startOf('hour')
				.add(offsetHours * -1, 'hours');
			let data: Array<AwattarEntry> = await VoltCache.get(
				`fixedPriceData_${startMoment.unix() * 1000}_${hours}_${fixedPriceData ?? ''}`,
				'',
				60 * 60 /*1 hour*/,
				async (): Promise<Array<AwattarEntry>> =>
					getFixedPriceEntries(fixedPriceData, { hours, offsetHours })
			);
			return (data ?? []).map((entry) => ({ ...entry, time: moment(entry.time) }));
		} catch (e) {
			return [];
		}
	}
}

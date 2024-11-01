import moment, { type Moment } from 'moment';
import { VoltCache } from '$lib/classes/voltCache';
import { AWATTAR_API } from '$env/static/private';

export interface AwattarEntry {
	time: Moment;
	netPrice: number;
	grossPrice: number;
}

export class AwattarApi {
	static async getData({ hours = 5, offsetHours = 1 } = {}): Promise<Array<AwattarEntry> | null> {
		try {
			const startMoment = moment().startOf('hour').add(-12, 'hours');
			const start = startMoment.unix() * 1000;

			let data: Array<AwattarEntry> = await VoltCache.get(
				`aWATTarData_${start}`,
				'',
				60 * 60 /*1 hour*/,
				async (): Promise<any> => {
					try {
						let url = `${AWATTAR_API}/marketdata?start=${start}`;
						const res = await fetch(url);
						if (res.ok) return AwattarApi.parseResponse(await res.json());
						return [];
					} catch (e: any) {
						return [];
					}
				}
			);
			data = data.filter((entry) => this.showEntry(entry, hours, offsetHours));
			return data;
		} catch (e1: any) {
			return [];
		}
	}

	static showEntry(entry: AwattarEntry, hours: number, offsetHours: number): boolean {
		const entryTime = moment(entry.time).unix() * 1000;
		const validStart =
			moment()
				.startOf('hour')
				.add(offsetHours * -1, 'hours')
				.unix() * 1000;
		if (hours === 0) return entryTime >= validStart;

		const validEnd = moment().startOf('hour').add(hours, 'hours').unix() * 1000;
		return entryTime >= validStart && entryTime <= validEnd;
	}

	static parseResponse(response: any): Array<AwattarEntry> {
		return response.data.map((x: any) => {
			return {
				time: moment(x.start_timestamp),
				netPrice: x.marketprice / 10,
				grossPrice: (x.marketprice / 10) * 1.2
			};
		});
	}

	static async getCurrentPrice(): Promise<number | undefined> {
		const data = await AwattarApi.getData();
		const now = moment().startOf('hour');
		const entry = data?.find((x) => moment(x.time).isSame(now));
		return entry?.grossPrice;
	}
}

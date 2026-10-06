import moment, { type Moment } from 'moment';
import type { AwattarEntry } from '$lib/classes/awattar';

export interface IFixedPriceRule {
	months: number[];
	hours: number[];
	price: number;
}

export interface IFixedPriceRange {
	validFrom: string;
	prices: IFixedPriceRule[];
}

export interface IFixedPriceTariff {
	title: string;
	ranges: IFixedPriceRange[];
}

/** Parses a comma-separated list of numbers with whitespace tolerated. */
function parseList(value: unknown, min: number, max: number): number[] | undefined {
	if (typeof value !== 'string') return undefined;

	const list: number[] = [];
	for (const part of value.split(',')) {
		const num = Number(part.trim());
		if (!Number.isInteger(num) || num < min || num > max) return undefined;
		list.push(num);
	}
	return list;
}

function parseRange(rawRange: unknown): IFixedPriceRange | undefined {
	if (!rawRange || typeof rawRange !== 'object') return undefined;
	const candidate = rawRange as Record<string, unknown>;

	if (typeof candidate.validFrom !== 'string') return undefined;
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(candidate.validFrom) ||
		!moment(candidate.validFrom, 'YYYY-MM-DD', true).isValid()
	)
		return undefined;
	if (!Array.isArray(candidate.prices)) return undefined;

	const prices: IFixedPriceRule[] = [];
	for (const rawPrice of candidate.prices) {
		if (!rawPrice || typeof rawPrice !== 'object') return undefined;
		const rule = rawPrice as Record<string, unknown>;
		const months = parseList(rule.months, 1, 12);
		const hours = parseList(rule.hours, 0, 23);
		if (!months || !hours || typeof rule.price !== 'number' || !isFinite(rule.price))
			return undefined;
		prices.push({ months, hours, price: rule.price });
	}

	return { validFrom: candidate.validFrom, prices };
}

/**
 * Parses a user-provided fixed-price tariff JSON string.
 * Returns undefined on any invalid input - a broken tariff never throws,
 * it simply results in "no data" (engine behaves like an aWATTar outage).
 */
export function parseFixedPriceTariff(
	json: string | null | undefined
): IFixedPriceTariff | undefined {
	if (!json) return undefined;

	let raw: unknown;
	try {
		raw = JSON.parse(json);
	} catch (e) {
		return undefined;
	}

	if (!raw || typeof raw !== 'object') return undefined;
	const candidate = raw as Record<string, unknown>;
	if (typeof candidate.title !== 'string' || !Array.isArray(candidate.ranges)) return undefined;

	const ranges: IFixedPriceRange[] = [];
	for (const rawRange of candidate.ranges) {
		const range = parseRange(rawRange);
		if (!range) return undefined;
		ranges.push(range);
	}

	return { title: candidate.title, ranges };
}

/**
 * Resolves the fixed price (ct/kWh, final gross price - no VAT split) for a
 * moment in time: the LAST range with validFrom <= startOfDay(t), and inside
 * it the FIRST rule matching both month and hour. No match -> undefined.
 */
export function getFixedPrice(tariff: IFixedPriceTariff, t: Moment): number | undefined {
	const day = moment(t).startOf('day');

	let activeRange: IFixedPriceRange | undefined;
	for (const range of tariff.ranges) {
		if (moment(range.validFrom, 'YYYY-MM-DD').isSameOrBefore(day)) activeRange = range;
	}
	if (!activeRange) return undefined;

	const month = day.month() + 1;
	const hour = moment(t).hour();
	const rule = activeRange.prices.find((p) => p.months.includes(month) && p.hours.includes(hour));
	return rule?.price;
}

/**
 * Expands the tariff into hourly entries matching the AwattarApi window
 * semantics ({@link AwattarApi.showEntry}). Hours without a matching rule are
 * omitted; an invalid/unparseable tariff yields an empty list.
 */
export function getFixedPriceEntries(
	json: string | null | undefined,
	{ hours = 5, offsetHours = 1 } = {}
): Array<AwattarEntry> {
	const tariff = parseFixedPriceTariff(json);
	if (!tariff) return [];

	const validStart = moment()
		.startOf('hour')
		.add(offsetHours * -1, 'hours');
	// hard cap so the "no end bound" case (hours === 0) stays finite
	const validEnd =
		hours === 0
			? moment().startOf('hour').add(168, 'hours')
			: moment().startOf('hour').add(hours, 'hours');

	const entries: Array<AwattarEntry> = [];
	const cursor = validStart.clone();
	while (cursor.isSameOrBefore(validEnd)) {
		const price = getFixedPrice(tariff, cursor);
		if (price !== undefined)
			entries.push({ time: cursor.clone(), netPrice: price, grossPrice: price });
		cursor.add(1, 'hours');
	}
	return entries;
}

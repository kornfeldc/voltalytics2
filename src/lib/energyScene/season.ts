// Holiday modes of the 3D energy scene (FEATURES.md #4) — shared with iOS
// EnergySceneSeason.swift. Active by local calendar date from a week before the
// holiday to the day after: Halloween Oct 24 – Nov 1, Christmas Dec 17 – 27,
// Easter Palm Sunday – Easter Monday. No three.js imports.

export type Season = 'halloween' | 'christmas' | 'easter';

export const seasonEmoji: Record<Season, string> = {
	halloween: '🎃',
	christmas: '🎄',
	easter: '🐣'
};

/** Easter Sunday of `year` (Gregorian calendar, anonymous computus) as [month 1–12, day]. */
export function easterSunday(year: number): [number, number] {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const n = h + l - 7 * m + 114;
	return [Math.floor(n / 31), (n % 31) + 1];
}

const dayNumber = (year: number, month: number, day: number) =>
	Date.UTC(year, month - 1, day) / 86_400_000;

/** Season active on `date` (local calendar day), or null. */
export function activeSeason(date: Date): Season | null {
	const qa = qaSeason();
	if (qa !== undefined) return qa;
	const year = date.getFullYear();
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const md = month * 100 + day;
	if (md >= 1024 && md <= 1101) return 'halloween';
	if (md >= 1217 && md <= 1227) return 'christmas';
	const [easterMonth, easterDay] = easterSunday(year);
	const offset = dayNumber(year, month, day) - dayNumber(year, easterMonth, easterDay);
	if (offset >= -7 && offset <= 1) return 'easter';
	return null;
}

/** Dev-only `?qaSeason=halloween|christmas|easter|none` (iOS: `-voltalytics-qa-season`). */
function qaSeason(): Season | null | undefined {
	if (!import.meta.env.DEV || typeof location === 'undefined') return undefined;
	const value = new URLSearchParams(location.search).get('qaSeason');
	if (value === 'none') return null;
	return value === 'halloween' || value === 'christmas' || value === 'easter' ? value : undefined;
}

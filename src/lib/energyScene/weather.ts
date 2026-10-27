// Live weather for the 3D energy scene (FEATURES.md #3) — port of iOS
// WeatherApi.swift. Open-Meteo (free, no key, CC BY 4.0) for the current
// conditions; the address is geocoded with OpenStreetMap Nominatim (the web has
// no MapKit). Both results live in localStorage only; only coordinates rounded
// to ~1 km go to Open-Meteo.
import { VoltCache } from '$lib/classes/voltCache';

export interface CurrentWeather {
	temperature: number;
	weatherCode: number;
	/** 0…100 % */
	cloudCover: number;
	/** mm in the last interval */
	precipitation: number;
	/** cm in the last interval */
	snowfall: number;
	/** m of snow on the ground */
	snowDepth: number;
	/** km/h */
	windSpeed: number;
	isDay: boolean;
}

export type WeatherCondition =
	| 'clear'
	| 'mainlyClear'
	| 'partlyCloudy'
	| 'overcast'
	| 'fog'
	| 'drizzle'
	| 'rain'
	| 'freezingRain'
	| 'showers'
	| 'snow'
	| 'snowShowers'
	| 'thunderstorm';

export interface WeatherPlace {
	latitude: number;
	longitude: number;
	name: string;
}

/** Fallback when no address is set or it cannot be resolved. */
export const eisenstadt: WeatherPlace = {
	latitude: 47.8457,
	longitude: 16.5232,
	name: 'Eisenstadt'
};

/** WMO weather interpretation codes (Open-Meteo `weather_code`). */
export function condition(weather: CurrentWeather): WeatherCondition {
	const code = weather.weatherCode;
	if (code === 0) return 'clear';
	if (code === 1) return 'mainlyClear';
	if (code === 2) return 'partlyCloudy';
	if (code === 3) return 'overcast';
	if (code === 45 || code === 48) return 'fog';
	if ([51, 53, 55].includes(code)) return 'drizzle';
	if ([56, 57, 66, 67].includes(code)) return 'freezingRain';
	if ([61, 63, 65].includes(code)) return 'rain';
	if ([71, 73, 75, 77].includes(code)) return 'snow';
	if ([80, 81, 82].includes(code)) return 'showers';
	if ([85, 86].includes(code)) return 'snowShowers';
	if ([95, 96, 99].includes(code)) return 'thunderstorm';
	return 'overcast';
}

export const conditionLabel: Record<WeatherCondition, string> = {
	clear: 'Clear',
	mainlyClear: 'Mostly clear',
	partlyCloudy: 'Partly cloudy',
	overcast: 'Overcast',
	fog: 'Fog',
	drizzle: 'Drizzle',
	rain: 'Rain',
	freezingRain: 'Freezing rain',
	showers: 'Rain showers',
	snow: 'Snow',
	snowShowers: 'Snow showers',
	thunderstorm: 'Thunderstorm'
};

export const isSnowing = (w: CurrentWeather) => {
	const c = condition(w);
	return c === 'snow' || c === 'snowShowers' || w.snowfall > 0.01;
};

export const isRaining = (w: CurrentWeather) =>
	!isSnowing(w) &&
	['drizzle', 'rain', 'freezingRain', 'showers', 'thunderstorm'].includes(condition(w));

/** Snow lying on roofs and lawn. */
export const hasSnowCover = (w: CurrentWeather) =>
	w.snowDepth > 0.01 || (isSnowing(w) && w.temperature < 1);

/** 0 = clear … 1 = overcast; rain/fog skies are never "clear". */
export function cloudiness(w: CurrentWeather | undefined): number {
	if (!w) return 0;
	const base = w.cloudCover / 100;
	const c = condition(w);
	if (c === 'thunderstorm') return 1;
	if (['fog', 'drizzle', 'rain', 'freezingRain', 'showers', 'snow', 'snowShowers'].includes(c)) {
		return Math.max(base, 0.85);
	}
	return base;
}

interface OpenMeteoResponse {
	current: {
		temperature_2m: number;
		weather_code: number;
		cloud_cover: number;
		precipitation: number;
		snowfall: number;
		snow_depth?: number;
		wind_speed_10m: number;
		is_day: number;
	};
}

export async function currentWeather(place: WeatherPlace): Promise<CurrentWeather | undefined> {
	const qa = qaWeather();
	if (qa) return qa;
	const lat = Math.round(place.latitude * 100) / 100;
	const lon = Math.round(place.longitude * 100) / 100;
	return VoltCache.get(`weather_${lat}_${lon}`, 'scene', 600, async () => {
		try {
			const url =
				`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
				'&current=temperature_2m,weather_code,cloud_cover,precipitation,snowfall,snow_depth,wind_speed_10m,is_day';
			const res = await fetch(url);
			if (!res.ok) return undefined;
			const { current } = (await res.json()) as OpenMeteoResponse;
			return {
				temperature: current.temperature_2m,
				weatherCode: current.weather_code,
				cloudCover: current.cloud_cover,
				precipitation: current.precipitation,
				snowfall: current.snowfall,
				snowDepth: current.snow_depth ?? 0,
				windSpeed: current.wind_speed_10m,
				isDay: current.is_day === 1
			} satisfies CurrentWeather;
		} catch {
			return undefined;
		}
	});
}

/** Settings address → coordinates (cached per address); fallback Eisenstadt. */
export async function resolvePlace(address: string): Promise<WeatherPlace> {
	const query = address.trim();
	if (!query) return eisenstadt;
	const cacheKey = `voltalytics_weatherPlace_${query.toLowerCase()}`;
	try {
		const cached = localStorage.getItem(cacheKey);
		if (cached) return JSON.parse(cached) as WeatherPlace;
		const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`;
		const res = await fetch(url, { headers: { Accept: 'application/json' } });
		if (!res.ok) return eisenstadt;
		const results = (await res.json()) as {
			lat: string;
			lon: string;
			name?: string;
			address?: Record<string, string>;
		}[];
		const first = results[0];
		if (!first) return eisenstadt;
		const address = first.address ?? {};
		const place: WeatherPlace = {
			latitude: Number(first.lat),
			longitude: Number(first.lon),
			name:
				address.city ??
				address.town ??
				address.village ??
				address.municipality ??
				first.name ??
				query
		};
		localStorage.setItem(cacheKey, JSON.stringify(place));
		return place;
	} catch {
		return eisenstadt;
	}
}

/**
 * Dev-only `?qaWeather=clear|partly|overcast|fog|drizzle|rain|snow|thunder`
 * (+ `&qaTemp=7`) fakes the conditions for scene QA (iOS:
 * `-voltalytics-qa-weather`).
 */
function qaWeather(): CurrentWeather | undefined {
	if (!import.meta.env.DEV || typeof location === 'undefined') return undefined;
	const params = new URLSearchParams(location.search);
	const kind = params.get('qaWeather');
	if (!kind) return undefined;
	const temperature = Number(params.get('qaTemp') ?? 12);
	const presets: Record<string, [number, number, number, number]> = {
		partly: [2, 45, 0, 0],
		overcast: [3, 100, 0, 0],
		fog: [45, 100, 0, 0],
		drizzle: [53, 100, 0.3, 0],
		rain: [63, 100, 2.5, 0],
		snow: [73, 100, 0.4, 0.8],
		thunder: [95, 100, 4, 0]
	};
	const [code, cover, rain, snow] = presets[kind] ?? [0, 5, 0, 0];
	return {
		temperature: snow > 0 ? Math.min(temperature, -1) : temperature,
		weatherCode: code,
		cloudCover: cover,
		precipitation: rain,
		snowfall: snow,
		snowDepth: snow > 0 ? 0.05 : 0,
		windSpeed: 14,
		isDay: true
	};
}

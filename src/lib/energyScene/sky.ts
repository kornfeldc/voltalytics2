// 2D canvas layers around the 3D energy scene (FEATURES.md #3) — port of the
// SwiftUI SkyBackdrop / HorizonHaze / SkyPalette / WeatherEffects
// (EnergyHeroView.swift). All drawing happens in render-frame coordinates
// (see CameraRig); callers translate by the lens-shift offset. No three.js.
import { dayAmount, horizonY, warmth, type CameraRig, type Daylight } from './model';
import { cloudiness, condition, isRaining, isSnowing, type CurrentWeather } from './weather';
import type { Season } from './season';

type RGB = [number, number, number];

const mix = (a: RGB, b: RGB, t: number): RGB => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t
];
const css = (c: RGB, alpha = 1) =>
	`rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${alpha})`;

/** Deterministic LCG (SeededRandom on iOS) so the sky never flickers between redraws. */
export class SeededRandom {
	private state: bigint;
	constructor(seed: number) {
		this.state = (BigInt(seed) * 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
	}
	next(): number {
		this.state = (this.state * 6364136223846793005n + 1442695040888963407n) & 0xffffffffffffffffn;
		return Number(this.state >> 11n) / 2 ** 53;
	}
}

export interface SkyPalette {
	zenith: RGB;
	mid: RGB;
	horizon: RGB;
	haze: RGB;
	sunCore: RGB;
	sunGlow: RGB;
	sunGlowAlpha: number;
	cloud: RGB;
	cloudAlpha: number;
	cloudTop: RGB;
	cloudBottom: RGB;
	fairCloudAlpha: number;
}

/** Night → twilight/golden hour → day, then toward overcast grey by cloud cover. */
export function skyPalette(daylight: Daylight, weather: CurrentWeather | undefined): SkyPalette {
	const day = dayAmount(daylight);
	const clouds = cloudiness(weather);
	const storm = weather
		? condition(weather) === 'thunderstorm'
			? 1
			: isRaining(weather)
				? 0.55
				: 0
		: 0;
	const warm = warmth(daylight) * (1 - 0.85 * clouds);

	const clearZenith = mix([0.02, 0.03, 0.09], [0.12, 0.33, 0.68], day);
	const clearMid = mix(
		mix([0.04, 0.06, 0.16], [0.3, 0.55, 0.85], day),
		[0.55, 0.5, 0.7],
		warm * 0.6
	);
	const clearHorizon = mix(
		mix([0.1, 0.12, 0.24], [0.7, 0.83, 0.95], day),
		[1.0, 0.68, 0.42],
		warm * 0.75
	);
	const greyZenith = mix(
		[0.05, 0.055, 0.07],
		mix([0.5, 0.54, 0.6], [0.25, 0.28, 0.34], storm),
		day
	);
	const greyMid = mix([0.08, 0.085, 0.1], mix([0.62, 0.65, 0.69], [0.36, 0.39, 0.44], storm), day);
	const greyHorizon = mix(
		[0.13, 0.13, 0.15],
		mix([0.76, 0.78, 0.8], [0.5, 0.52, 0.55], storm),
		day
	);

	const lightCloud = mix(mix([0.16, 0.19, 0.3], [1, 1, 1], day), [1, 0.82, 0.7], warm * 0.5);
	const darkCloud = mix([0.1, 0.11, 0.13], mix([0.7, 0.72, 0.75], [0.32, 0.34, 0.38], storm), day);
	const shadedCloud = mix(
		mix([0.1, 0.12, 0.2], [0.76, 0.81, 0.89], day),
		[0.72, 0.6, 0.64],
		warm * 0.5
	);

	return {
		zenith: mix(clearZenith, greyZenith, clouds),
		mid: mix(clearMid, greyMid, clouds),
		horizon: mix(clearHorizon, greyHorizon, clouds),
		haze: mix(
			mix(mix([0.05, 0.07, 0.1], [0.42, 0.55, 0.45], day), [0.6, 0.5, 0.4], warm * 0.4),
			mix([0.07, 0.08, 0.09], [0.5, 0.55, 0.52], day),
			clouds * 0.7
		),
		sunCore: [1, 0.97 - 0.15 * warm, 0.86 - 0.35 * warm],
		sunGlow: [1, 0.85 - 0.2 * warm, 0.5 - 0.2 * warm],
		sunGlowAlpha: 0.55,
		cloud: mix(lightCloud, darkCloud, clouds),
		cloudAlpha: 0.4 + 0.3 * day,
		cloudTop: mix(lightCloud, darkCloud, clouds * 0.7),
		cloudBottom: mix(shadedCloud, darkCloud, clouds * 0.7),
		fairCloudAlpha: 0.45 + 0.45 * day
	};
}

/**
 * Colour at the top edge of the sky — iOS Safari extends it into its status
 * bar area, which pages cannot draw into (FEATURES.md #5).
 */
export const skyTopColor = (daylight: Daylight, weather: CurrentWeather | undefined) =>
	css(skyPalette(daylight, weather).zenith);

/** Where the moon sits (upper left of the free area), shared by the sky and the Halloween witch. */
const moonPosition = (rig: CameraRig) => ({
	x: rig.safeRect.x + rig.safeRect.width * 0.2,
	y: Math.max(rig.safeRect.y + 30, horizonY(rig) * 0.3)
});

/**
 * Gradient sky, stars, sun or moon (hidden by clouds), overcast deck,
 * fair-weather cumulus. Halloween (FEATURES.md #4): big orange harvest moon.
 */
export function drawSky(
	ctx: CanvasRenderingContext2D,
	rig: CameraRig,
	daylight: Daylight,
	weather: CurrentWeather | undefined,
	season: Season | null = null
) {
	const { width, height } = rig.viewSize;
	const horizon = horizonY(rig);
	const palette = skyPalette(daylight, weather);
	const clouds = weather ? cloudiness(weather) : 0.15;
	const topInset = rig.safeRect.y;

	// flat above the free area: the stacked TopBar floats over it in the same
	// colour, which iOS Safari extends into its status bar (FEATURES.md #5)
	const gradient = ctx.createLinearGradient(0, Math.min(topInset, horizon - 1), 0, horizon);
	gradient.addColorStop(0, css(palette.zenith));
	gradient.addColorStop(0.5, css(palette.mid));
	gradient.addColorStop(1, css(palette.horizon));
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, horizon + 1);
	ctx.fillStyle = css(palette.haze);
	ctx.fillRect(0, horizon, width, Math.max(0, height - horizon));

	const night = 1 - dayAmount(daylight);
	const clearSky = 1 - clouds;
	if (night > 0.05 && clearSky > 0.1) {
		const rng = new SeededRandom(42);
		for (let i = 0; i < 140; i++) {
			const x = rng.next() * width;
			const y = rng.next() * horizon * 0.95;
			const r = 0.5 + rng.next() * 1.1;
			ctx.fillStyle = `rgba(255,255,255,${night * clearSky * (0.35 + 0.6 * rng.next())})`;
			ctx.beginPath();
			ctx.arc(x, y, r, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	const discOpacity = 1 - Math.min(1, Math.max(0, (clouds - 0.45) / 0.45));
	if (discOpacity > 0.02) {
		if (daylight.elevation > -3) {
			// across the free area, not behind the card column
			const x = rig.safeRect.x + rig.safeRect.width * (0.86 - 0.72 * daylight.dayProgress);
			const lift = Math.min(1, Math.max(0, daylight.elevation) / 32);
			const top = topInset + 34;
			const y = horizon - Math.max(0, horizon - top) * lift - 6;
			sun(ctx, x, y, 15, palette.sunCore, palette.sunGlow, palette.sunGlowAlpha, discOpacity);
		} else if (season === 'halloween') {
			const moon = moonPosition(rig);
			sun(ctx, moon.x, moon.y, 17, [1, 0.8, 0.5], [1, 0.55, 0.15], 0.5, discOpacity);
		} else {
			const moon = moonPosition(rig);
			sun(ctx, moon.x, moon.y, 10, [0.93, 0.93, 0.93], [0.6, 0.7, 1], 0.35, discOpacity);
		}
	}

	const skyTop = topInset;
	const skyHeight = Math.max(1, horizon - topInset);
	if (clouds > 0.55) {
		// overcast: a diffuse deck (overcast skies have no edges)
		ctx.save();
		ctx.filter = 'blur(6px)';
		const rng = new SeededRandom(77);
		const count = Math.floor(6 + clouds * 10);
		for (let i = 0; i < count; i++) {
			const x = rng.next();
			const y = rng.next();
			const w = 0.25 + rng.next() * 0.3;
			ctx.fillStyle = css(palette.cloud, palette.cloudAlpha * 0.5 * (clouds - 0.4));
			ctx.beginPath();
			ctx.ellipse(
				width * x,
				skyTop + skyHeight * (0.05 + y * 0.8) + (width * w * 0.22) / 2,
				(width * w) / 2,
				(width * w * 0.22) / 2,
				0,
				0,
				Math.PI * 2
			);
			ctx.fill();
		}
		ctx.restore();
	}
	// fair-weather cumulus: defined puffs, shaded underside, only lightly softened
	const rng = new SeededRandom(31);
	const puffs = clouds > 0.9 ? 0 : 2 + Math.floor(clouds * 6);
	for (let i = 0; i < puffs; i++) {
		const w = width * (0.15 + rng.next() * 0.13);
		const cx = rng.next() * width;
		const cy = skyTop + skyHeight * (0.22 + rng.next() * 0.5);
		cumulus(ctx, cx, cy, w, palette, rng);
	}
	// behind a TopBar the sky stays flat (the bar floats in this colour) and
	// fades into stars, glow and clouds over 24 px instead of a hard edge
	if (topInset > 0) {
		const fade = ctx.createLinearGradient(0, topInset, 0, topInset + 24);
		fade.addColorStop(0, css(palette.zenith));
		fade.addColorStop(1, css(palette.zenith, 0));
		ctx.fillStyle = css(palette.zenith);
		ctx.fillRect(0, 0, width, topInset);
		ctx.fillStyle = fade;
		ctx.fillRect(0, topInset, width, 24);
	}
}

function sun(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	core: RGB,
	glow: RGB,
	glowAlpha: number,
	opacity: number
) {
	for (const [reach, strength] of [
		[5, 0.22],
		[2.4, 1]
	] as const) {
		const r = radius * reach;
		const g = ctx.createRadialGradient(x, y, radius * 0.9, x, y, r);
		g.addColorStop(0, css(glow, glowAlpha * strength * opacity));
		g.addColorStop(1, css(glow, 0));
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.fillStyle = css(core, opacity);
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
}

/** Flat-bottomed cluster of puffs, lit from above. */
function cumulus(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	width: number,
	palette: SkyPalette,
	rng: SeededRandom
) {
	const base = width * 0.15;
	ctx.save();
	ctx.globalAlpha = palette.fairCloudAlpha;
	ctx.filter = 'blur(1.2px)';
	ctx.beginPath();
	ctx.rect(cx - width, cy - width, width * 2, width + base);
	ctx.clip();
	const shading = ctx.createLinearGradient(0, cy - width * 0.35, 0, cy + base);
	shading.addColorStop(0, css(palette.cloudTop));
	shading.addColorStop(1, css(palette.cloudBottom));
	ctx.fillStyle = shading;
	ctx.beginPath();
	ctx.roundRect(cx - width / 2, cy - base, width, base * 2, base);
	for (let i = 0; i < 4; i++) {
		const t = (i + 0.5) / 4;
		const r = width * (0.12 + 0.12 * Math.sin(Math.PI * t) + 0.04 * rng.next());
		const x = cx - width / 2 + width * t;
		const y = cy - base * 0.4 - r * 0.55;
		ctx.moveTo(x + r, y);
		ctx.arc(x, y, r, 0, Math.PI * 2);
	}
	ctx.fill('nonzero');
	ctx.restore();
}

/**
 * Haze just below the horizon (much deeper in fog). Web: drawn behind the 3D
 * scene, whose fog fades the far ground into the same colour — so the band
 * starts opaque where the fogged ground edge meets the horizon line.
 */
export function drawHaze(
	ctx: CanvasRenderingContext2D,
	rig: CameraRig,
	daylight: Daylight,
	weather: CurrentWeather | undefined
) {
	const { width, height } = rig.viewSize;
	const horizon = horizonY(rig);
	const fog = weather ? condition(weather) === 'fog' : false;
	const band = height * (fog ? 0.3 : 0.06 + 0.05 * cloudiness(weather));
	const haze = skyPalette(daylight, weather).horizon;
	const gradient = ctx.createLinearGradient(0, horizon, 0, horizon + band);
	gradient.addColorStop(0, css(haze, 1));
	gradient.addColorStop(0.25, css(haze, fog ? 0.95 : 0.6));
	gradient.addColorStop(1, css(haze, 0));
	ctx.fillStyle = gradient;
	ctx.fillRect(0, horizon - 2, width, band + 2);
}

export const hasAnimatedEffects = (weather: CurrentWeather | undefined) =>
	!!weather && (isRaining(weather) || isSnowing(weather) || condition(weather) === 'thunderstorm');

/** Fog, rain/snow streaks and lightning (time in seconds). */
export function drawWeatherEffects(
	ctx: CanvasRenderingContext2D,
	rig: CameraRig,
	daylight: Daylight,
	weather: CurrentWeather | undefined,
	time: number
) {
	if (!weather) return;
	const { width, height } = rig.viewSize;
	if (condition(weather) === 'fog') {
		const horizon = horizonY(rig) / Math.max(1, height);
		const fog: RGB = dayAmount(daylight) > 0.3 ? [0.84, 0.84, 0.84] : [0.12, 0.13, 0.15];
		const gradient = ctx.createLinearGradient(0, 0, 0, height);
		gradient.addColorStop(0, css(fog, 0.2));
		gradient.addColorStop(Math.min(0.99, horizon), css(fog, 0.85));
		gradient.addColorStop(Math.min(1, horizon + 0.35), css(fog, 0.45));
		gradient.addColorStop(1, css(fog, 0.3));
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);
	}
	if (isSnowing(weather)) {
		const heavy = Math.min(1, weather.snowfall / 1.5);
		const count = 90 + Math.floor(heavy * 140);
		const rng = new SeededRandom(13);
		for (let i = 0; i < count; i++) {
			const near = i % 3 === 0;
			const speed = (near ? 70 : 38) * (0.8 + 0.4 * rng.next());
			const flake = near ? 3.4 : 1.9;
			const startX = rng.next() * width;
			const sway = rng.next() * 6;
			const travel = height + flake;
			const y = ((rng.next() * travel + time * speed) % travel) - flake;
			const x = startX + Math.sin(time * 0.9 + sway) * (near ? 14 : 8);
			ctx.fillStyle = `rgba(255,255,255,${near ? 0.9 : 0.6})`;
			ctx.beginPath();
			ctx.arc(x + flake / 2, y + flake / 2, flake / 2, 0, Math.PI * 2);
			ctx.fill();
		}
	} else if (isRaining(weather)) {
		const heavy = Math.min(1, weather.precipitation / 3);
		const count = 70 + Math.floor(heavy * 160);
		const slant = Math.min(0.35, weather.windSpeed / 90);
		const rng = new SeededRandom(11);
		for (let i = 0; i < count; i++) {
			const near = i % 3 === 0;
			const speed = (near ? 1250 : 850) * (0.85 + 0.3 * rng.next());
			const length = (near ? 26 : 15) * (0.8 + 0.4 * rng.next());
			const startX = rng.next() * width * (1 + slant) - width * slant;
			const travel = height + length;
			const y = ((rng.next() * travel + time * speed) % travel) - length;
			const x = startX + slant * y;
			ctx.strokeStyle = `rgba(255,255,255,${near ? 0.42 : 0.24})`;
			ctx.lineWidth = near ? 1.4 : 0.9;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x + slant * length, y + length);
			ctx.stroke();
		}
	}
	if (condition(weather) === 'thunderstorm') {
		const cycle = time % 8.5;
		const flash = cycle < 0.07 ? 0.5 : cycle > 0.16 && cycle < 0.24 ? 0.32 : 0;
		if (flash > 0) {
			ctx.fillStyle = `rgba(242,242,242,${flash})`;
			ctx.fillRect(0, 0, width, height);
		}
	}
}

// MARK: - holiday sky (FEATURES.md #4)

/** True while the season draws moving silhouettes (the effects layer must redraw per frame). */
export const seasonSkyAnimates = (season: Season | null, daylight: Daylight) =>
	season === 'christmas' || (season === 'halloween' && dayAmount(daylight) < 0.7);

/** Witch crossing the harvest moon (Halloween nights) or Santa's sleigh (Christmas). */
export function drawSeasonSky(
	ctx: CanvasRenderingContext2D,
	rig: CameraRig,
	daylight: Daylight,
	season: Season | null,
	time: number
) {
	const night = 1 - dayAmount(daylight);
	if (season === 'halloween' && night > 0.3) drawWitchFlight(ctx, rig, time, night);
	if (season === 'christmas') drawSleighFlight(ctx, rig, time, night);
}

/** Every 30 s a 7 s flight right → left across the free area, straight across the moon. */
function drawWitchFlight(
	ctx: CanvasRenderingContext2D,
	rig: CameraRig,
	time: number,
	night: number
) {
	const phase = time % 30;
	if (phase > 7) return;
	const p = phase / 7;
	const start = rig.safeRect.x + rig.safeRect.width + 70;
	const travel = rig.safeRect.width + 140;
	const moon = moonPosition(rig);
	const atMoon = (start - moon.x) / travel;
	const x = start - travel * p;
	const y = moon.y + 50 * (p - atMoon) + 5 * Math.sin(p * 16);
	const scale = Math.min(1.3, Math.max(0.7, rig.safeRect.width / 900));
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(scale, scale);
	ctx.fillStyle = ctx.strokeStyle = `rgba(12, 6, 18, ${0.92 * night})`;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.lineWidth = 2.2;
	ctx.beginPath(); // broom stick, flying left
	ctx.moveTo(-26, 4);
	ctx.lineTo(22, 7);
	ctx.stroke();
	ctx.beginPath(); // bristles
	ctx.moveTo(20, 5);
	ctx.lineTo(36, 0);
	ctx.lineTo(38, 8);
	ctx.lineTo(34, 15);
	ctx.lineTo(20, 9);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath(); // body
	ctx.moveTo(-4, 5);
	ctx.quadraticCurveTo(-2, -10, 4, -14);
	ctx.lineTo(12, -12);
	ctx.quadraticCurveTo(16, -2, 18, 6);
	ctx.closePath();
	ctx.fill();
	const wave = 3 * Math.sin(time * 9);
	ctx.beginPath(); // cape
	ctx.moveTo(10, -12);
	ctx.quadraticCurveTo(22, -10, 27, -2 + wave);
	ctx.lineTo(16, 2);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath(); // head
	ctx.arc(2, -17, 3.6, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath(); // hat brim + crooked cone
	ctx.ellipse(2, -20, 7, 1.6, -0.15, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(-2, -20.5);
	ctx.lineTo(10, -33);
	ctx.lineTo(6, -20);
	ctx.closePath();
	ctx.fill();
	ctx.lineWidth = 1.6;
	ctx.beginPath(); // arm on the broom, legs
	ctx.moveTo(0, -8);
	ctx.lineTo(-8, 4);
	ctx.moveTo(2, 4);
	ctx.lineTo(-2, 11);
	ctx.lineTo(-6, 11);
	ctx.stroke();
	ctx.restore();
}

/**
 * Every 26 s a 10 s arc left → right across the free area; Rudolph's nose glows
 * and a sparkle trail follows at night.
 */
function drawSleighFlight(
	ctx: CanvasRenderingContext2D,
	rig: CameraRig,
	time: number,
	night: number
) {
	const phase = time % 26;
	if (phase > 10) return;
	const p = phase / 10;
	const safe = rig.safeRect;
	const top = safe.y;
	const sky = Math.max(1, horizonY(rig) - top);
	const scale = Math.min(1.2, Math.max(0.65, safe.width / 1000));
	const x = safe.x - 220 * scale + (safe.width + 300 * scale) * p;
	const y = top + sky * (0.42 - 0.16 * Math.sin(Math.PI * p));
	const ink = night > 0.5 ? `rgba(16, 10, 22, 0.92)` : `rgba(70, 30, 25, 0.85)`;
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(scale, scale);
	if (night > 0.3) {
		for (let k = 0; k < 10; k++) {
			const alpha = (1 - k / 10) * 0.8 * night;
			ctx.fillStyle = `rgba(255, 215, 120, ${alpha})`;
			ctx.beginPath();
			ctx.arc(-26 - k * 14, 6 + 3 * Math.sin(time * 4 + k), 1.6 - k * 0.1, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.fillStyle = ctx.strokeStyle = ink;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.lineWidth = 1;
	ctx.beginPath(); // reins
	ctx.moveTo(18, -6);
	for (let i = 0; i < 4; i++) ctx.lineTo(48 + i * 34, -8 - i * 3);
	ctx.stroke();
	for (let i = 0; i < 4; i++) reindeer(ctx, 50 + i * 34, -6 - i * 3, time * 10 + i * 1.3);
	sleigh(ctx);
	const nose = { x: 50 + 3 * 34 + 18.5, y: -6 - 9 - 12 };
	if (night > 0.3) {
		const glow = ctx.createRadialGradient(nose.x, nose.y, 0, nose.x, nose.y, 9);
		glow.addColorStop(0, `rgba(255, 60, 50, ${0.9 * night})`);
		glow.addColorStop(1, 'rgba(255, 60, 50, 0)');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(nose.x, nose.y, 9, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.fillStyle = 'rgba(235, 40, 35, 0.95)';
	ctx.beginPath();
	ctx.arc(nose.x, nose.y, 1.8, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function reindeer(ctx: CanvasRenderingContext2D, x: number, y: number, gallop: number) {
	ctx.beginPath(); // body
	ctx.ellipse(x, y, 11, 5, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath(); // neck
	ctx.moveTo(x + 7, y - 2);
	ctx.lineTo(x + 12, y - 10);
	ctx.lineTo(x + 15, y - 9);
	ctx.lineTo(x + 11, y);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath(); // head
	ctx.ellipse(x + 15, y - 11, 4, 2.4, -0.3, 0, Math.PI * 2);
	ctx.fill();
	ctx.lineWidth = 1.2;
	ctx.beginPath(); // antlers
	ctx.moveTo(x + 13, y - 13);
	ctx.lineTo(x + 11, y - 19);
	ctx.moveTo(x + 12, y - 16);
	ctx.lineTo(x + 9, y - 18);
	ctx.moveTo(x + 11, y - 19);
	ctx.lineTo(x + 14, y - 21);
	ctx.stroke();
	const swing = Math.sin(gallop) * 5;
	ctx.lineWidth = 1.6;
	ctx.beginPath(); // legs + tail
	ctx.moveTo(x + 6, y + 3);
	ctx.lineTo(x + 9 + swing, y + 11);
	ctx.moveTo(x + 4, y + 3);
	ctx.lineTo(x + 6 - swing, y + 11);
	ctx.moveTo(x - 6, y + 3);
	ctx.lineTo(x - 9 - swing, y + 11);
	ctx.moveTo(x - 8, y + 3);
	ctx.lineTo(x - 11 + swing, y + 10);
	ctx.moveTo(x - 10, y - 2);
	ctx.lineTo(x - 14, y - 5);
	ctx.stroke();
}

function sleigh(ctx: CanvasRenderingContext2D) {
	ctx.lineWidth = 2;
	ctx.beginPath(); // runner with curled front + struts
	ctx.moveTo(-22, 8);
	ctx.lineTo(14, 8);
	ctx.quadraticCurveTo(24, 8, 22, 1);
	ctx.moveTo(-14, 8);
	ctx.lineTo(-14, 3);
	ctx.moveTo(8, 8);
	ctx.lineTo(8, 3);
	ctx.stroke();
	ctx.beginPath(); // body
	ctx.moveTo(-24, -8);
	ctx.quadraticCurveTo(-24, 4, -14, 4);
	ctx.lineTo(14, 4);
	ctx.quadraticCurveTo(20, 2, 18, -4);
	ctx.lineTo(6, -2);
	ctx.lineTo(-12, -2);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath(); // Santa + sack
	ctx.moveTo(4, -7);
	ctx.arc(-2, -7, 6, 0, Math.PI * 2);
	ctx.moveTo(2.5, -15);
	ctx.arc(-1, -15, 3.5, 0, Math.PI * 2);
	ctx.moveTo(-4.5, -17);
	ctx.lineTo(-9, -23);
	ctx.lineTo(2.5, -18);
	ctx.closePath();
	ctx.moveTo(-9, -8);
	ctx.arc(-15, -8, 6, 0, Math.PI * 2);
	ctx.fill();
}

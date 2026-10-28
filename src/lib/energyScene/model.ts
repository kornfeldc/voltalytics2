// Scene model for the 3D energy view (FEATURES.md #3) — port of iOS
// EnergySceneModel.swift: live flow state, sun position and the camera rig
// shared by the three.js camera and the 2D overlays (sky, callouts). No
// three.js imports.
import type { IInverterRealTimeData } from '$lib/classes/interver';
import type { Vec3 } from './lot';

export type CarSource = 'solar' | 'battery' | 'grid' | 'mixed';

/** Charging status as derived in ChargingOverview.svelte. */
export type ChargingStatus = 'boost' | 'force' | 'excess' | 'battery' | 'not_charging' | 'no_car';

/** Live power flows the scene animates (InverterRealTimeData signs: import/discharge negative). */
export interface EnergyFlowState {
	hasData: boolean;
	timestamp?: Date;
	solarKw: number;
	homeKw: number;
	/** > 0 export, < 0 import */
	gridKw: number;
	/** > 0 charging, < 0 discharging */
	batteryKw: number;
	batterySoc: number | null;
	showsBattery: boolean;
	showsCar: boolean;
	carKw: number;
	carSource: CarSource;
}

/**
 * Readings below this are rounding noise, not a flow (e.g. 0,03 kW "to grid"):
 * shown as 0 kW, without a direction or pulses (user, FEATURES.md #3).
 */
export const flowTolerance = 0.1;

/** `kw` or 0 inside the tolerance. */
const flow = (kw: number) => (Math.abs(kw) < flowTolerance ? 0 : kw);

export function flowState(
	realtime: IInverterRealTimeData | undefined,
	charging: { kw: number; status: ChargingStatus } | undefined,
	hasWallbox: boolean
): EnergyFlowState {
	const state: EnergyFlowState = {
		hasData: false,
		solarKw: 0,
		homeKw: 0,
		gridKw: 0,
		batteryKw: 0,
		batterySoc: null,
		showsBattery: false,
		showsCar: hasWallbox,
		carKw: 0,
		carSource: 'mixed'
	};
	if (realtime) {
		state.hasData = true;
		state.timestamp = realtime.timestamp ? new Date(realtime.timestamp) : undefined;
		state.solarKw = flow(Math.abs(realtime.powerProduction ?? 0));
		state.homeKw = flow(Math.abs(realtime.powerUsage ?? 0));
		const toGrid = flow(realtime.powerToGrid ?? 0);
		const fromGrid = flow(Math.abs(realtime.powerFromGrid ?? 0));
		state.gridKw = toGrid > 0 ? toGrid : -fromGrid;
		const toBattery = flow(realtime.powerToBattery ?? 0);
		const fromBattery = flow(Math.abs(realtime.powerFromBattery ?? 0));
		state.batteryKw = toBattery > 0 ? toBattery : -fromBattery;
		state.batterySoc = realtime.batterySoc ?? null;
		state.showsBattery = realtime.batterySoc != null || toBattery > 0 || fromBattery > 0;
	}
	if (
		hasWallbox &&
		charging &&
		charging.status !== 'not_charging' &&
		charging.status !== 'no_car'
	) {
		state.carKw = flow(charging.kw);
		state.carSource =
			charging.status === 'excess'
				? 'solar'
				: charging.status === 'battery'
					? 'battery'
					: charging.status === 'force' || charging.status === 'boost'
						? 'grid'
						: 'mixed';
	}
	return state;
}

export function sameFlowState(a: EnergyFlowState | undefined, b: EnergyFlowState): boolean {
	return !!a && JSON.stringify(a) === JSON.stringify(b);
}

// MARK: - daylight

export interface Daylight {
	/** degrees above the horizon (negative at night) */
	elevation: number;
	/** degrees from north, clockwise */
	azimuth: number;
	/** 0 at sunrise … 1 at sunset (clamped) — drives the sun's sky arc */
	dayProgress: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

const smoothstep = (edge0: number, edge1: number, x: number) => {
	const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
};

/** 0 = night … 1 = full daylight, smooth across civil twilight. */
export const dayAmount = (d: Daylight) => smoothstep(-6, 9, d.elevation);
/** Golden-hour warmth, 0…1. */
export const warmth = (d: Daylight) => 1 - smoothstep(4, 18, Math.abs(d.elevation - 2));

/** Unit vector to the sun in scene space (y up, north = −z, east = +x). */
export function sunDirection(d: Daylight): Vec3 {
	const el = (d.elevation * Math.PI) / 180;
	const az = (d.azimuth * Math.PI) / 180;
	const v: Vec3 = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
	const length = Math.hypot(v[0], v[1], v[2]);
	return [v[0] / length, v[1] / length, v[2] / length];
}

export function daylightAt(date: Date, latitude: number, longitude: number): Daylight {
	const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
	const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86_400_000);
	const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
	const rad = Math.PI / 180;
	const declination = 23.44 * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365) * rad;
	const b = (2 * Math.PI * (dayOfYear - 81)) / 364;
	const equationOfTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
	const solarTime = utcHours + longitude / 15 + equationOfTime / 60;
	const hourAngle = 15 * (solarTime - 12) * rad;
	const lat = latitude * rad;
	const sinEl =
		Math.sin(lat) * Math.sin(declination) +
		Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
	const el = Math.asin(clamp(sinEl, -1, 1));
	const cosAz =
		(Math.sin(declination) - Math.sin(el) * Math.sin(lat)) /
		Math.max(1e-6, Math.cos(el) * Math.cos(lat));
	let az = Math.acos(clamp(cosAz, -1, 1)) / rad;
	if (hourAngle > 0) az = 360 - az;
	const cosH0 =
		(Math.sin(-0.833 * rad) - Math.sin(lat) * Math.sin(declination)) /
		(Math.cos(lat) * Math.cos(declination));
	const h0 = Math.acos(clamp(cosH0, -1, 1));
	const progress = (hourAngle + h0) / Math.max(1e-6, 2 * h0);
	return { elevation: el / rad, azimuth: az, dayProgress: clamp(progress, 0, 1) };
}

// MARK: - camera rig

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Fixed camera framing shared by the three.js camera and the 2D overlays. The
 * scene fills the whole view (FEATURES.md #5); `safeRect` is the part bars and
 * the dashboard overlay leave free. The property is framed into it and the
 * camera looks through its centre — an off-axis projection (lens shift,
 * `camera.setViewOffset`), so the perspective stays the same wherever the
 * free area sits.
 */
export interface CameraRig {
	position: Vec3;
	target: Vec3;
	/** pinhole focal length in px (view distance per unit of tangent) */
	focalLength: number;
	/** where the optical axis meets the view: the centre of `safeRect` */
	center: { x: number; y: number };
	viewSize: { width: number; height: number };
	/** free part of the view; callouts and the header chips stay inside it */
	safeRect: Rect;
}

/**
 * Fits ~29 m of the property into the free width (at least ±10 m into its
 * height, so wide, short areas keep sky above the roof for the sun) and keeps
 * the horizon about a quarter down the free area.
 */
export function framing(size: { width: number; height: number }, safeRect?: Rect): CameraRig {
	const width = Math.max(size.width, 1);
	const height = Math.max(size.height, 1);
	const safe = safeRect ?? { x: 0, y: 0, width, height };
	// degenerate free areas (tiny windows) frame as if they had some room
	const safeWidth = Math.max(safe.width, 160);
	const safeHeight = Math.max(safe.height, 160);
	const aim: Vec3 = [3.8, 3.4, 1.2];
	const yaw = (24 * Math.PI) / 180; // from +z toward +x
	const distance = 38;
	const halfSpan = 14.5;
	const focal = Math.min(
		safeWidth / ((2 * halfSpan) / distance),
		safeHeight / ((2 * 10) / distance)
	);
	// the axis passes the free area's centre; the horizon sits a quarter of its
	// height above that, i.e. the camera pitches down by that angle
	const pitch =
		(clamp((Math.atan((0.25 * safeHeight) / focal) * 180) / Math.PI, 5, 15) * Math.PI) / 180;
	const direction: Vec3 = [
		Math.sin(yaw) * Math.cos(pitch),
		Math.sin(pitch),
		Math.cos(yaw) * Math.cos(pitch)
	];
	return {
		position: [
			aim[0] + direction[0] * distance,
			aim[1] + direction[1] * distance,
			aim[2] + direction[2] * distance
		],
		target: aim,
		focalLength: focal,
		center: { x: safe.x + safe.width / 2, y: safe.y + safe.height / 2 },
		viewSize: { width, height },
		safeRect: safe
	};
}

/**
 * Symmetric frustum for three.js: the smallest frame centred on the optical
 * axis that covers the view, its vertical fov, and where the view sits in it
 * (`camera.setViewOffset`).
 */
export function lensFrame(rig: CameraRig) {
	const { width, height } = rig.viewSize;
	const halfWidth = Math.max(rig.center.x, width - rig.center.x);
	const halfHeight = Math.max(rig.center.y, height - rig.center.y);
	return {
		fullWidth: 2 * halfWidth,
		fullHeight: 2 * halfHeight,
		offsetX: halfWidth - rig.center.x,
		offsetY: halfHeight - rig.center.y,
		verticalFov: (2 * Math.atan(halfHeight / rig.focalLength) * 180) / Math.PI
	};
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
const normalize = (a: Vec3): Vec3 => {
	const length = Math.hypot(a[0], a[1], a[2]) || 1;
	return [a[0] / length, a[1] / length, a[2] / length];
};

/** Screen point in view coordinates, null when behind the camera. */
export function project(rig: CameraRig, point: Vec3): { x: number; y: number } | null {
	const forward = normalize(sub(rig.target, rig.position));
	const right = normalize(cross(forward, [0, 1, 0]));
	const up = cross(right, forward);
	const d = sub(point, rig.position);
	const depth = dot(d, forward);
	if (depth <= 0.01) return null;
	return {
		x: rig.center.x + (rig.focalLength * dot(d, right)) / depth,
		y: rig.center.y - (rig.focalLength * dot(d, up)) / depth
	};
}

/** Screen y of the horizon straight ahead. */
export function horizonY(rig: CameraRig): number {
	const forward = sub(rig.target, rig.position);
	const flat = normalize([forward[0], 0, forward[2]]);
	const far: Vec3 = [
		rig.position[0] + flat[0] * 10_000,
		rig.position[1],
		rig.position[2] + flat[2] * 10_000
	];
	return project(rig, far)?.y ?? rig.safeRect.y + 0.25 * rig.safeRect.height;
}

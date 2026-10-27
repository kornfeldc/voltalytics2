// Layout of the user's property for the 3D energy scene (FEATURES.md #3) — 1:1
// port of `Lot` in ../voltalyticsIos EnergyScene+Property.swift. Modelled on
// the user's drone photo: white house (ground floor + attic) with a steep
// terracotta roof and a large black PV array (skylight lower left), recessed
// entrance; open double carport on the east side (standing-seam roof, PV strip
// front to back) with the black Model Y (nose in, left, at the go-e) and the
// black BYD Atto 2 (nose out, right); battery at the west corner; utility pole
// east. Meters, y up, front façade faces +z (south). No three.js imports here —
// the callout overlay uses these anchors without loading the 3D bundle.

export type Vec3 = [number, number, number];

const deg = Math.PI / 180;

const halfWidth = 6; // house x −6 … 6
const halfDepth = 5; // house z −5 … 5, front façade at +5
const wall = 4.2;
const pitch = 42 * deg;
const rise = halfDepth * Math.tan(pitch);
const roofThickness = 0.2;
const eaveOverhang = 0.45;
const gableOverhang = 0.35;
const slopeLength = halfDepth / Math.cos(pitch);
const slabLength = slopeLength + eaveOverhang + 0.14;

export const Lot = {
	halfWidth,
	halfDepth,
	wall,
	pitch,
	rise,
	ridge: [0, wall + rise, 0] as Vec3,
	eaveOverhang,
	gableOverhang,
	roofThickness,
	roofWidth: halfWidth * 2 + gableOverhang * 2,
	slopeDown: [0, -Math.sin(pitch), Math.cos(pitch)] as Vec3,
	slopeNormal: [0, Math.cos(pitch), Math.sin(pitch)] as Vec3,
	slopeLength,
	/** Roof slab from just past the ridge to the eave edge … */
	slabLength,
	/** … and the distance (down-slope from the ridge) of its centre. */
	slabCenter: slabLength / 2 - 0.14,

	// carport (east): open double bay x 6 … 12.6, white side wall on the east
	carportMinX: 6,
	carportMaxX: 12.6,
	carportMinZ: -3.6,
	carportMaxZ: 5.6,
	carportHeight: 3,

	// energy devices + cars
	hub: [5.55, 1.5, 5.07] as Vec3, // gateway on the façade
	battery: [-6.75, 0, 4.45] as Vec3, // free-standing, west corner
	wallbox: [6.065, 1.2, 4.75] as Vec3, // go-e on the house wall, left bay front
	car: [7.6, 0, 1.875] as Vec3, // Model Y, left bay, nose-in
	chargePort: [6.63, 0.93, 4.02] as Vec3, // Model Y: rear left, toward the go-e
	secondCar: [10.8, 0, 2.145] as Vec3, // BYD Atto 2, right bay, nose-out
	pole: [14.4, 0, -0.6] as Vec3,
	farPole: [24, 0, -18] as Vec3,
	fenceZ: 11.2,

	// callout anchors (projected by the hero overlay)
	solarCallout: [0.4, 9.1, 0.2] as Vec3,
	homeCallout: [1.8, 0.05, 6.1] as Vec3,
	batteryCallout: [-6.75, 0.08, 4.95] as Vec3,
	carCallout: [7.6, 0.2, 4.75] as Vec3,
	gridCallout: [14.4, 8.6, -0.6] as Vec3
};

/** Point on the south roof plane, `s` meters down from the ridge, `lift` above the tiles. */
export function roofPoint(x: number, s: number, lift: number): Vec3 {
	const k = Lot.roofThickness + lift;
	return [
		Lot.ridge[0] + Lot.slopeDown[0] * s + Lot.slopeNormal[0] * k + x,
		Lot.ridge[1] + Lot.slopeDown[1] * s + Lot.slopeNormal[1] * k,
		Lot.ridge[2] + Lot.slopeDown[2] * s + Lot.slopeNormal[2] * k
	];
}

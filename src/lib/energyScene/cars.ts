// The two cars in the double carport — 1:1 port of ../voltalyticsIos
// EnergyScene+Car.swift: black Tesla Model Y (left bay, nose-in, rear light
// bar to the street, rear-left charge port at the go-e) and black BYD Atto 2
// (right bay, nose-out). Lofted from cross-sections (local frame: front +z).
import * as THREE from 'three';
import { Lot, type Vec3 } from './lot';
import { loftGeometry, type LoftStation } from './geometry';
import type { EnergyScene } from './scene';

const station = (
	z: number,
	halfWidth: number,
	bottom: number,
	top: number,
	round: number
): LoftStation => ({
	z,
	halfWidth,
	bottom,
	top,
	round
});

/**
 * Black Tesla Model Y (≈ 4.75 × 1.92 × 1.62 m): high-shouldered crossover
 * body, fastback glass greenhouse, 19″ aero wheels, light bars front and rear.
 */
export function buildCar(s: EnergyScene) {
	const car = new THREE.Group();
	car.position.set(...Lot.car);
	car.rotation.y = Math.PI; // nose toward the back wall
	s.carGroup.add(car);
	const { paint, glass } = carMaterials(s);

	addShell(
		s,
		[
			station(-2.38, 0.7, 0.5, 0.95, 0.85),
			station(-2.28, 0.9, 0.33, 1.06, 0.6),
			station(-1.9, 0.96, 0.25, 1.08, 0.45),
			station(-0.8, 0.97, 0.23, 1.06, 0.45),
			station(0.6, 0.97, 0.23, 1.03, 0.45),
			station(1.45, 0.95, 0.25, 0.96, 0.5),
			station(2.0, 0.9, 0.29, 0.85, 0.6),
			station(2.3, 0.8, 0.37, 0.75, 0.8),
			station(2.39, 0.64, 0.45, 0.66, 0.9)
		],
		[
			station(-2.16, 0.84, 1.03, 1.09, 0.6),
			station(-1.85, 0.8, 1.03, 1.38, 0.6),
			station(-1.2, 0.75, 1.03, 1.58, 0.55),
			station(-0.2, 0.74, 1.03, 1.62, 0.55),
			station(0.45, 0.76, 1.03, 1.56, 0.55),
			station(1.32, 0.86, 0.99, 1.07, 0.6)
		],
		paint,
		glass,
		car
	);

	// Gemini aero covers with a light rim ring
	wheels(
		s,
		car,
		0.97,
		[-1.47, 1.42],
		0.36,
		s.pbr(0.16, 0.17, 0.18, { roughness: 0.35, metallic: 0.6 })
	);
	for (const side of [-1, 1]) {
		s.box([0.12, 0.09, 0.22], [side * 1.0, 1.07, 1.02], paint, 0.04, car); // mirror
	}

	// light bars: pale lamp glass by day, glowing after dusk
	s.box(
		[1.5, 0.035, 0.04],
		[0, 0.8, 2.32],
		s.pbr(0.55, 0.56, 0.58, { roughness: 0.1, clearcoat: 1 }),
		0.015,
		car
	);
	s.box(
		[1.62, 0.04, 0.04],
		[0, 0.97, -2.33],
		s.pbr(0.35, 0.03, 0.04, { roughness: 0.15, clearcoat: 1 }),
		0.015,
		car
	);
	const white = new THREE.Color(1, 1, 1);
	const red = new THREE.Color().setRGB(1, 0.08, 0.1, THREE.SRGBColorSpace);
	s.carLights = [
		lightBar(s, [1.5, 0.04, 0.05], [0, 0.8, 2.33], white, 4, car),
		lightBar(s, [1.62, 0.045, 0.05], [0, 0.97, -2.34], red, 3.5, car)
	];
}

/**
 * Black BYD Atto 2 (≈ 4.31 × 1.83 × 1.68 m), nose-out: more upright compact
 * SUV than the Model Y — taller glasshouse, steeper rear hatch, roof rails,
 * slim angular headlights linked by a trim strip, black lower grille.
 */
export function buildSecondCar(s: EnergyScene) {
	const car = new THREE.Group();
	car.position.set(...Lot.secondCar); // nose toward the street
	s.carGroup.add(car);
	const { paint, glass } = carMaterials(s);

	addShell(
		s,
		[
			station(-2.16, 0.72, 0.5, 1.0, 0.8),
			station(-2.06, 0.88, 0.33, 1.09, 0.55),
			station(-1.65, 0.91, 0.27, 1.11, 0.4),
			station(0.5, 0.915, 0.27, 1.09, 0.4),
			station(1.3, 0.9, 0.29, 1.02, 0.45),
			station(1.85, 0.87, 0.33, 0.96, 0.55),
			station(2.08, 0.82, 0.38, 0.9, 0.7),
			station(2.17, 0.72, 0.44, 0.84, 0.85)
		],
		[
			station(-1.98, 0.82, 1.07, 1.13, 0.5),
			station(-1.78, 0.8, 1.07, 1.56, 0.5),
			station(-1.0, 0.78, 1.07, 1.665, 0.45),
			station(0.2, 0.78, 1.07, 1.675, 0.45),
			station(0.75, 0.8, 1.05, 1.55, 0.5),
			station(1.32, 0.86, 1.01, 1.09, 0.55)
		],
		paint,
		glass,
		car
	);

	// two-tone alloys
	wheels(
		s,
		car,
		0.915,
		[-1.31, 1.31],
		0.34,
		s.pbr(0.42, 0.43, 0.45, { roughness: 0.3, metallic: 0.9 })
	);
	const trim = s.pbr(0.28, 0.29, 0.31, { roughness: 0.3, metallic: 1 });
	for (const side of [-1, 1]) {
		s.box([0.12, 0.09, 0.22], [side * 0.95, 1.12, 0.95], paint, 0.04, car); // mirror
		s.box([0.05, 0.05, 1.8], [side * 0.6, 1.71, -0.35], trim, 0.02, car); // roof rail
	}

	// face: slim angular headlights + linking trim strip, black lower grille
	const lampGlass = s.pbr(0.62, 0.63, 0.66, { roughness: 0.08, clearcoat: 1 });
	for (const side of [-1, 1]) {
		s.box([0.44, 0.06, 0.06], [side * 0.5, 0.84, 2.07], lampGlass, 0.02, car).rotation.z =
			side * 0.12;
	}
	s.box([0.56, 0.025, 0.04], [0, 0.87, 2.12], trim, 0.01, car);
	s.box(
		[1.05, 0.24, 0.06],
		[0, 0.5, 2.12],
		s.pbr(0.015, 0.015, 0.02, { roughness: 0.8 }),
		0.03,
		car
	);
	s.box(
		[1.4, 0.05, 0.04],
		[0, 1.0, -2.13],
		s.pbr(0.35, 0.03, 0.04, { roughness: 0.15, clearcoat: 1 }),
		0.015,
		car
	); // tail lamp strip
}

/** Gloss black paint + dark glass, both double-sided. */
function carMaterials(s: EnergyScene) {
	return {
		paint: s.pbr(0.012, 0.013, 0.016, {
			roughness: 0.16,
			metallic: 0.65,
			clearcoat: 1,
			doubleSided: true
		}),
		glass: s.pbr(0.02, 0.026, 0.036, { roughness: 0.03, clearcoat: 1, doubleSided: true })
	};
}

function addShell(
	s: EnergyScene,
	body: LoftStation[],
	greenhouse: LoftStation[],
	paint: THREE.Material,
	glass: THREE.Material,
	car: THREE.Object3D
) {
	const shell = new THREE.Mesh(loftGeometry(body), paint);
	car.add(shell);
	s.registerWeatherSurface(shell, { snow: false });
	car.add(new THREE.Mesh(loftGeometry(greenhouse), glass));
}

/** Night-only light bar with an elongated glow. */
function lightBar(
	s: EnergyScene,
	size: Vec3,
	position: Vec3,
	color: THREE.Color,
	intensity: number,
	car: THREE.Object3D
) {
	const bar = s.box(size, position, s.glow(color, intensity), 0.015, car);
	bar.userData.noShadow = true;
	const halo = s.halo(color, 1, 0.45);
	halo.scale.set(size[0] * 1.6, 0.4, 1);
	bar.add(halo);
	bar.visible = false;
	return bar;
}

/** Dark arch, tyre, light rim ring and wheel face per corner. */
function wheels(
	s: EnergyScene,
	car: THREE.Object3D,
	halfTrack: number,
	axles: number[],
	radius: number,
	rim: THREE.Material
) {
	const arch = s.pbr(0.01, 0.01, 0.012, { roughness: 0.9 });
	const tyre = s.pbr(0.05, 0.05, 0.055, { roughness: 0.9 });
	const ring = s.pbr(0.6, 0.62, 0.65, { roughness: 0.3, metallic: 1 });
	const hub = radius;
	for (const side of [-1, 1]) {
		for (const z of axles) {
			const x = side * halfTrack;
			s.rod([x * 0.99, hub + 0.05, z], [x * 1.005, hub + 0.05, z], radius + 0.08, arch, car);
			s.rod([x * 0.76, hub, z], [x * 1.02, hub, z], radius, tyre, car);
			s.rod([x * 1.01, hub, z], [x * 1.025, hub, z], radius * 0.7, ring, car);
			s.rod([x * 1.02, hub, z], [x * 1.035, hub, z], radius * 0.6, rim, car);
		}
	}
}

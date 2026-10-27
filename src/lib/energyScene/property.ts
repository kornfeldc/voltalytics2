// Builders for the user's property in the 3D energy scene — 1:1 port of
// ../voltalyticsIos EnergyScene+Property.swift (same coordinates, sizes and
// colours): grounds + street, fence, garden, neighbours, house with roof PV,
// façade and east gable, double carport with its PV strip and the go-e,
// battery, utility poles + overhead line, and the flow routes into the
// gateway on the façade.
import * as THREE from 'three';
import { Lot, roofPoint, type Vec3 } from './lot';
import { prismGeometry, sag } from './geometry';
import { palette } from './palette';
import type { EnergyScene } from './scene';

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const srgb = (r: number, g: number, b: number) =>
	new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

// MARK: grounds

export function buildGrounds(s: EnergyScene) {
	const lawn = new THREE.Mesh(
		new THREE.CircleGeometry(36, 72).rotateX(-Math.PI / 2),
		s.pbr(1, 1, 1, { roughness: 0.96, map: s.textures.grass })
	);
	lawn.position.set(3, 0, 0);
	s.root.add(lawn);
	s.registerWeatherSurface(lawn);
	const apron = new THREE.Mesh(
		// iOS: r 600; wider here so its fogged edge meets the horizon line
		new THREE.CircleGeometry(2000, 96).rotateX(-Math.PI / 2),
		s.pbr(0.26, 0.4, 0.2, { roughness: 1 })
	);
	apron.position.set(3, -0.03, 0);
	s.root.add(apron);
	s.registerWeatherSurface(apron);

	// pavers: carport floor + driveway, entrance path + terrace
	const pavers = (minX: number, maxX: number, minZ: number, maxZ: number, y: number) => {
		const size: Vec3 = [maxX - minX, 0.04, maxZ - minZ];
		const material = s.pbr(1, 1, 1, {
			roughness: 0.82,
			map: s.textures.pavers,
			tiling: [size[0] / 1.6, size[2] / 1.6]
		});
		s.registerWeatherSurface(s.box(size, [(minX + maxX) / 2, y, (minZ + maxZ) / 2], material));
	};
	pavers(5.95, 12.75, Lot.carportMinZ - 0.05, Lot.fenceZ, 0.02);
	pavers(1.0, 2.6, Lot.halfDepth, Lot.fenceZ, 0.021);
	pavers(0.3, 4.4, Lot.halfDepth, 6.6, 0.022);

	// street: sidewalk, curb, asphalt with dashed centre line
	s.registerWeatherSurface(
		s.box([120, 0.05, 1.9], [3, 0.025, 12.6], s.pbr(0.66, 0.66, 0.64, { roughness: 0.92 }))
	);
	s.box([120, 0.12, 0.18], [3, 0.06, 13.6], s.pbr(0.58, 0.58, 0.57, { roughness: 0.85 }));
	s.registerWeatherSurface(
		s.box([120, 0.03, 6.4], [3, 0.015, 16.9], s.pbr(0.35, 0.34, 0.33, { roughness: 0.88 }))
	);
	const marking = s.pbr(0.85, 0.85, 0.82, { roughness: 0.7 });
	for (let index = -16; index <= 18; index++) {
		s.box([1.6, 0.035, 0.14], [index * 3.4, 0.02, 16.9], marking);
	}

	buildFence(s);
	buildGarden(s);
	buildNeighbors(s);

	// garden lamp in front of the carport + street lamp
	const black = s.pbr(0.08, 0.08, 0.09, { roughness: 0.5, metallic: 0.5 });
	s.rod([10.9, 0, 9.0], [10.9, 0.9, 9.0], 0.05, black);
	s.box([0.34, 0.3, 0.34], [10.9, 1.05, 9.0], s.pbr(0.9, 0.9, 0.88, { roughness: 0.3 }), 0.15);
	s.lamp([10.9, 1.05, 9.0], [10.9, 1.3, 9.3], 5, [0.3, 0.26, 0.3]);
	const steel = s.pbr(0.22, 0.23, 0.25, { roughness: 0.5, metallic: 0.7 });
	s.rod([-4.5, 0, 12.4], [-4.5, 4.6, 12.4], 0.07, steel);
	s.box([0.1, 0.08, 1.3], [-4.5, 4.6, 13.0], steel);
	s.box([0.36, 0.12, 0.6], [-4.5, 4.52, 13.55], steel, 0.04);
	s.lamp([-4.5, 4.45, 13.55], [-4.5, 3.8, 13.3], 11, [0.28, 0.03, 0.5]);
}

/**
 * Anthracite slat panels between white pillars along the street east of the
 * entrance (none in front of the west garden), a gate at the entrance path,
 * open to the driveway.
 */
function buildFence(s: EnergyScene) {
	const z = Lot.fenceZ;
	const white = s.pbr(0.94, 0.94, 0.92, { roughness: 0.8 });
	const cap = s.pbr(0.74, 0.74, 0.73, { roughness: 0.6 });
	const slats = s.pbr(1, 1, 1, {
		roughness: 0.5,
		metallic: 0.3,
		map: s.textures.fenceSlats,
		doubleSided: true
	});
	for (const [from, to] of [
		[2.7, 5.9],
		[12.8, 14.4]
	]) {
		const count = Math.max(1, Math.round((to - from) / 2.4));
		const step = (to - from) / count;
		s.box([to - from, 0.22, 0.24], [(from + to) / 2, 0.11, z], white);
		for (let index = 0; index <= count; index++) {
			const x = from + index * step;
			s.box([0.34, 1.25, 0.34], [x, 0.625, z], white);
			s.box([0.4, 0.06, 0.4], [x, 1.28, z], cap);
			if (index < count) s.box([step - 0.34, 0.92, 0.05], [x + step / 2, 0.68, z], slats);
		}
	}
	// gate between its posts at the entrance path
	s.box([0.34, 1.25, 0.34], [0.9, 0.625, z], white);
	s.box([0.4, 0.06, 0.4], [0.9, 1.28, z], cap);
	s.box([1.75, 1.0, 0.05], [1.8, 0.72, z], slats);
}

function buildGarden(s: EnergyScene) {
	// fruit trees + bushes in the front garden (west)
	tree(s, [-3.4, 0, 8.4], 0.72, true);
	tree(s, [-8.6, 0, 7.6], 0.85, true);
	const shrub = s.pbr(0.2, 0.36, 0.16, { roughness: 0.95 });
	for (const [x, z, r] of [
		[-11.5, 10.2, 0.75],
		[-6.2, 10.3, 0.6],
		[-0.4, 6.0, 0.45],
		[13.7, 9.8, 0.7]
	]) {
		s.sphere(r, [x, r * 0.75, z], shrub);
	}
	// hedges along the back and west boundary
	const hedge = s.pbr(0.17, 0.32, 0.14, { roughness: 0.95 });
	s.box([30, 1.8, 0.9], [0, 0.9, -10.5], hedge, 0.35);
	s.box([0.9, 1.6, 20], [-15.5, 0.8, 0.5], hedge, 0.35);
	s.box([0.9, 1.6, 6], [14.6, 0.8, -7], hedge, 0.35);
	// big trees behind the house for depth
	tree(s, [-12.5, 0, -7.5], 1.35, false);
	tree(s, [2.5, 0, -13.5], 1.5, false);
	tree(s, [12.5, 0, -13], 1.2, false);

	// wooden shed (back right)
	s.box([2.6, 2.1, 2.2], [12.4, 1.05, -7.6], s.pbr(0.42, 0.25, 0.15, { roughness: 0.75 }));
	s.box([2.95, 0.14, 2.5], [12.4, 2.17, -7.6], s.pbr(0.22, 0.23, 0.25, { roughness: 0.6 }));
	// playset: tower with red roof + blue slide
	const post = s.pbr(0.55, 0.38, 0.22, { roughness: 0.8 });
	for (const [dx, dz] of [
		[-0.6, -0.6],
		[0.6, -0.6],
		[-0.6, 0.6],
		[0.6, 0.6]
	]) {
		s.rod([8.6 + dx, 0, -7.8 + dz], [8.6 + dx, 2.4, -7.8 + dz], 0.06, post);
	}
	s.box([1.35, 0.08, 1.35], [8.6, 1.3, -7.8], post);
	const red = s.pbr(0.78, 0.13, 0.12, { roughness: 0.6 });
	for (const side of [1, -1]) {
		s.box([0.85, 0.05, 1.5], [8.6 + side * 0.3, 2.6, -7.8], red).rotation.z = side * -0.75;
	}
	s.box(
		[0.5, 0.05, 2.4],
		[8.6, 0.72, -6.25],
		s.pbr(0.15, 0.4, 0.85, { roughness: 0.35 })
	).rotation.x = 0.55;
}

function tree(s: EnergyScene, base: Vec3, size: number, light: boolean) {
	s.rod(
		base,
		add(base, [0, 2.4 * size, 0]),
		0.16 * size,
		s.pbr(0.3, 0.21, 0.14, { roughness: 0.9 })
	);
	const greens = (
		light
			? [
					[0.3, 0.48, 0.2],
					[0.36, 0.54, 0.24],
					[0.26, 0.42, 0.18]
				]
			: [
					[0.2, 0.36, 0.16],
					[0.25, 0.42, 0.18],
					[0.17, 0.31, 0.14]
				]
	).map(([r, g, b]) => s.pbr(r, g, b, { roughness: 0.95 }));
	const blobs: [Vec3, number][] = [
		[[0, 3.0, 0], 1.3],
		[[0.6, 3.75, 0.25], 1.0],
		[[-0.55, 3.55, -0.3], 0.95],
		[[0.1, 4.3, -0.1], 0.75]
	];
	blobs.forEach(([offset, radius], index) => {
		s.sphere(radius * size, add(base, scale(offset, size)), greens[index % 3]);
	});
}

/** Simplified neighbouring houses at the edges, softened by the haze. */
function buildNeighbors(s: EnergyScene) {
	const white = s.pbr(0.92, 0.92, 0.9, { roughness: 0.9 });
	const grey = s.pbr(0.36, 0.37, 0.4, { roughness: 0.7 });
	s.box([10, 3.4, 8], [-22, 1.7, -4], white);
	const roof = new THREE.Mesh(
		prismGeometry(10.6, 8.6, 3, true),
		s.pbr(0.36, 0.37, 0.4, { roughness: 0.7, doubleSided: true })
	);
	roof.position.set(-22, 3.4, -4);
	s.root.add(roof);
	s.box([9, 6.6, 7], [27, 3.3, -16], white);
	s.box([9.4, 0.3, 7.4], [27, 6.75, -16], grey);
	s.box([6, 1.6, 0.05], [27, 4.6, -12.47], s.pbr(0.12, 0.13, 0.15, { roughness: 0.2 }));
}

// MARK: house

export function buildHouse(s: EnergyScene) {
	const w = Lot.halfWidth * 2;
	const d = Lot.halfDepth * 2;
	s.box([w, Lot.wall, d], [0, Lot.wall / 2, 0], s.pbr(0.95, 0.95, 0.93, { roughness: 0.9 }));
	s.box([w + 0.06, 0.3, d + 0.06], [0, 0.15, 0], s.pbr(0.62, 0.62, 0.61, { roughness: 0.85 }));
	const gable = new THREE.Mesh(
		prismGeometry(w, d, Lot.rise, false),
		s.pbr(0.95, 0.95, 0.93, { roughness: 0.9, doubleSided: true })
	);
	gable.position.set(0, Lot.wall, 0);
	s.root.add(gable);
	buildRoof(s);
	buildFacade(s);
	buildEastGable(s);
}

/**
 * Terracotta slabs with dark-brown bargeboards + fascia, ridge cap, chimney,
 * gutters, skylight and the 40-module black PV array.
 */
function buildRoof(s: EnergyScene) {
	const tiles = s.pbr(1, 1, 1, {
		roughness: 0.6,
		map: s.textures.terracotta,
		tiling: [Lot.roofWidth / 2.6, Lot.slabLength / 2.9],
		doubleSided: true
	});
	const wood = s.pbr(0.29, 0.16, 0.09, { roughness: 0.7 });
	let frontSlab: THREE.Mesh | undefined;
	for (const side of [1, -1]) {
		const down: Vec3 = [0, Lot.slopeDown[1], Lot.slopeDown[2] * side];
		const normal: Vec3 = [0, Lot.slopeNormal[1], Lot.slopeNormal[2] * side];
		const slab = s.box(
			[Lot.roofWidth, Lot.roofThickness, Lot.slabLength],
			add(add(Lot.ridge, scale(down, Lot.slabCenter)), scale(normal, Lot.roofThickness / 2)),
			tiles
		);
		slab.rotation.x = Lot.pitch * side;
		s.registerWeatherSurface(slab);
		// slab-local: x across, y out of the roof, z down-slope (front) / up-slope (back)
		for (const end of [-1, 1]) {
			s.box(
				[0.07, 0.38, Lot.slabLength],
				[end * (Lot.roofWidth / 2 - 0.035), -0.13, 0],
				wood,
				0,
				slab
			);
		}
		s.box(
			[Lot.roofWidth, 0.28, 0.06],
			[0, -0.08, side * (Lot.slabLength / 2 - 0.03)],
			wood,
			0,
			slab
		);
		if (side > 0) frontSlab = slab;
	}
	s.box(
		[Lot.roofWidth, 0.2, 0.42],
		add(Lot.ridge, [0, 0.22, 0]),
		s.pbr(0.62, 0.27, 0.13, { roughness: 0.6 }),
		0.06
	);

	// chimney: white plaster with a dark cap
	s.box(
		[0.65, 1.5, 0.65],
		[1.0, Lot.ridge[1] + 0.2, 0.3],
		s.pbr(0.93, 0.93, 0.91, { roughness: 0.85 })
	);
	s.box(
		[0.82, 0.12, 0.82],
		[1.0, Lot.ridge[1] + 1.0, 0.3],
		s.pbr(0.3, 0.3, 0.32, { roughness: 0.6 })
	);

	// gutters + downpipes
	const metal = s.pbr(0.32, 0.33, 0.35, { roughness: 0.4, metallic: 0.7 });
	const eave = roofPoint(0, Lot.slopeLength + Lot.eaveOverhang - 0.02, -Lot.roofThickness - 0.1);
	s.rod([-Lot.roofWidth / 2, eave[1], eave[2]], [Lot.roofWidth / 2, eave[1], eave[2]], 0.07, metal);
	for (const x of [-Lot.halfWidth - 0.15, Lot.halfWidth - 0.35]) {
		s.rod([x, eave[1], eave[2]], [x, 0.1, Lot.halfDepth + 0.12], 0.055, metal);
	}

	const panel = frontSlab;
	if (!panel) return;
	// all-black modules: 2 rows of 11 + 2 rows of 9 (right-aligned), skylight lower left
	const surface = Lot.roofThickness / 2;
	const moduleLength = 1.5;
	[11, 11, 9, 9].forEach((count, row) => {
		const sDown = 0.3 + moduleLength / 2 + row * (moduleLength + 0.03);
		for (let column = 0; column < count; column++) {
			const x = 5.15 - column * 1.03;
			solarModule(s, [x, surface + 0.06, sDown - Lot.slabCenter], moduleLength, panel);
		}
	});
	const skylightS = 0.3 + 2.5 * (moduleLength + 0.03);
	s.box(
		[1.04, 0.08, 1.3],
		[-4.55, surface + 0.04, skylightS - Lot.slabCenter],
		s.pbr(0.62, 0.64, 0.67, { roughness: 0.35, metallic: 0.8 }),
		0,
		panel
	);
	const skylight = s.plane(
		0.88,
		1.14,
		s.pbr(0.16, 0.22, 0.3, { roughness: 0.03, clearcoat: 1 }),
		panel
	);
	skylight.position.set(-4.55, surface + 0.085, skylightS - Lot.slabCenter);
}

/** One PV module (black frame + cell glass), local +y = module normal. */
export function solarModule(
	s: EnergyScene,
	position: Vec3,
	length: number,
	parent: THREE.Object3D
) {
	s.box(
		[1.0, 0.04, length],
		position,
		s.pbr(0.06, 0.065, 0.075, { roughness: 0.4, metallic: 0.6 }),
		0,
		parent
	);
	const cells = s.plane(
		0.97,
		length - 0.03,
		s.pbr(1, 1, 1, {
			roughness: 0.08,
			metallic: 0.1,
			clearcoat: 1,
			map: s.textures.blackModule,
			doubleSided: true
		}),
		parent
	);
	cells.position.set(position[0], position[1] + 0.021, position[2]);
}

function buildFacade(s: EnergyScene) {
	const z = Lot.halfDepth;
	const front = new THREE.Quaternion();
	framedWindow(s, [-4.6, 1.52, z], 0.9, 0.95, front, true);
	framedWindow(s, [-3.45, 1.52, z], 0.9, 0.95, front, true);
	framedWindow(s, [-1.3, 1.5, z], 0.6, 1.5, front, true);
	framedWindow(s, [-0.25, 1.5, z], 0.6, 1.5, front, false);
	framedWindow(s, [3.55, 1.62, z], 0.8, 0.85, front, true);

	// recessed entrance: white portal, anthracite door with glass strip, step
	const white = s.pbr(0.97, 0.97, 0.96, { roughness: 0.8 });
	s.box([0.32, 2.75, 0.42], [1.09, 1.375, z + 0.2], white);
	s.box([0.32, 2.75, 0.42], [2.51, 1.375, z + 0.2], white);
	s.box([1.74, 0.42, 0.42], [1.8, 2.96, z + 0.2], white);
	s.box([1.1, 2.25, 0.06], [1.8, 1.125, z + 0.03], s.pbr(0.22, 0.23, 0.25, { roughness: 0.45 }));
	s.windowPanes.push(s.box([0.18, 1.7, 0.02], [2.15, 1.2, z + 0.065], s.glass()));
	s.box(
		[0.04, 0.7, 0.05],
		[1.42, 1.1, z + 0.085],
		s.pbr(0.75, 0.76, 0.78, { roughness: 0.25, metallic: 1 })
	);
	s.box([1.7, 0.16, 0.65], [1.8, 0.08, z + 0.32], s.pbr(0.66, 0.66, 0.64, { roughness: 0.85 }));
	s.lamp([1.8, 2.72, z + 0.3], [1.8, 2.3, z + 1.1], 5, [0.22, 0.04, 0.22]);

	// gateway (energy hub) the flows converge on
	s.box([0.46, 0.62, 0.14], Lot.hub, s.pbr(0.88, 0.89, 0.9, { roughness: 0.35 }), 0.03);
	const green = srgb(0.3, 0.9, 0.55);
	const led = s.box([0.12, 0.025, 0.02], add(Lot.hub, [0, 0.23, 0.075]), s.glow(green, 2));
	led.userData.noShadow = true;
	led.add(s.halo(green, 0.3, 0.5));
}

/** East gable above the carport: upper-floor windows + satellite dish. */
function buildEastGable(s: EnergyScene) {
	const east = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
	const x = Lot.halfWidth;
	framedWindow(s, [x, 5.3, 2.4], 0.75, 1.05, east, false);
	framedWindow(s, [x, 5.3, -1.6], 0.75, 1.05, east, false);
	framedWindow(s, [x, 7.0, 0.4], 0.5, 0.7, east, false);
	const white = s.pbr(0.92, 0.92, 0.9, { roughness: 0.4 });
	s.rod([x, 4.75, 4.0], [x + 0.3, 4.75, 4.0], 0.025, white);
	s.rod([x + 0.3, 4.75, 4.0], [x + 0.36, 4.8, 4.04], 0.33, white);
}

/**
 * Framed window (anthracite frame, teal glass, sill); `facing` rotates local
 * +z (outward) onto the wall normal.
 */
function framedWindow(
	s: EnergyScene,
	center: Vec3,
	width: number,
	height: number,
	facing: THREE.Quaternion,
	glow: boolean
) {
	const frame = new THREE.Group();
	frame.position.set(...center);
	frame.quaternion.copy(facing);
	s.root.add(frame);
	const anthracite = s.pbr(0.2, 0.21, 0.23, { roughness: 0.45 });
	s.box([width + 0.12, height + 0.12, 0.08], [0, 0, 0.03], anthracite, 0, frame);
	s.windowPanes.push(s.box([width - 0.08, height - 0.08, 0.02], [0, 0, 0.08], s.glass(), 0, frame));
	if (height > width * 1.3) {
		s.box([width - 0.08, 0.04, 0.03], [0, height * 0.18, 0.095], anthracite, 0, frame);
	} else {
		s.box([0.04, height - 0.08, 0.03], [0, 0, 0.095], anthracite, 0, frame);
	}
	s.box(
		[width + 0.22, 0.05, 0.2],
		[0, -height / 2 - 0.08, 0.1],
		s.pbr(0.82, 0.82, 0.8, { roughness: 0.6 }),
		0,
		frame
	);
	if (!glow) return;
	const light = new THREE.PointLight(srgb(1, 0.72, 0.4), 0, 6, 2);
	light.position
		.set(0, -0.3, 1.3)
		.applyQuaternion(facing)
		.add(new THREE.Vector3(...center));
	s.root.add(light);
	s.windowLights.push(light);
}

// MARK: carport

export function buildCarport(s: EnergyScene) {
	const white = s.pbr(0.95, 0.95, 0.93, { roughness: 0.88 });
	const centerX = (Lot.carportMinX + Lot.carportMaxX) / 2;
	const centerZ = (Lot.carportMinZ + Lot.carportMaxZ) / 2;
	const width = Lot.carportMaxX - Lot.carportMinX + 0.2;
	const depth = Lot.carportMaxZ - Lot.carportMinZ + 0.2;
	const seam = s.pbr(1, 1, 1, {
		roughness: 0.42,
		metallic: 0.55,
		map: s.textures.standingSeam,
		tiling: [width / 1.3, 1]
	});
	s.registerWeatherSurface(s.box([width, 0.2, depth], [centerX, Lot.carportHeight, centerZ], seam));
	// white fascia beam across the open front
	s.box([width, 0.55, 0.32], [centerX, Lot.carportHeight - 0.3, Lot.carportMaxZ - 0.06], white);

	// open double bay: white side wall on the east, back wall
	const wallHeight = Lot.carportHeight - 0.1;
	s.box(
		[0.3, wallHeight, Lot.carportMaxZ - Lot.carportMinZ],
		[Lot.carportMaxX - 0.15, wallHeight / 2, centerZ],
		white
	);
	s.box(
		[Lot.carportMaxX - Lot.carportMinX, wallHeight, 0.25],
		[centerX, wallHeight / 2, Lot.carportMinZ + 0.125],
		white
	);

	// second PV strip along the house wall, front to back: 5 rows of two
	// landscape modules, east edge raised 6° (as on the drone photo)
	const mount = new THREE.Group();
	mount.position.set(7.95, Lot.carportHeight + 0.3, 2.3);
	// yaw: module length (local z) across the bay; tilt about the depth axis
	mount.quaternion
		.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (6 * Math.PI) / 180)
		.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
	s.root.add(mount);
	for (let row = 0; row < 5; row++) {
		for (const column of [-1, 1]) {
			solarModule(s, [(row - 2) * 1.04, 0, column * 0.87], 1.7, mount);
		}
	}
	const rail = s.pbr(0.55, 0.56, 0.58, { roughness: 0.4, metallic: 0.8 });
	for (const x of [7.0, 8.9]) {
		s.box([0.06, 0.06, 5.3], [x, Lot.carportHeight + 0.14 + (x - 7.0) * 0.1, 2.3], rail);
	}

	// go-e on the house wall at the front of the left bay, next to the
	// Model Y's charge port (shown with the cars)
	const wallbox = new THREE.Group();
	s.carGroup.add(wallbox);
	s.box(
		[0.13, 0.4, 0.28],
		Lot.wallbox,
		s.pbr(0.05, 0.05, 0.06, { roughness: 0.22, clearcoat: 1 }),
		0.05,
		wallbox
	);
	const led = s.rod(
		add(Lot.wallbox, [0.065, 0.08, 0]),
		add(Lot.wallbox, [0.08, 0.08, 0]),
		0.07,
		s.glow(palette.solar, 3),
		wallbox
	);
	led.userData.noShadow = true;
	// the rod is scaled (radius, length, radius): counter-scale the halo
	const halo = s.halo(palette.solar, 0.32, 0.6);
	halo.scale.set(0.32 / led.scale.x, 0.32 / led.scale.y, 1);
	led.add(halo);
	led.userData.halo = halo;
	s.wallboxLed = led;
	s.lamp([9.3, Lot.carportHeight - 0.12, 3.6], [9.3, 2.4, 3.8], 7, [0.45, 0.03, 0.45]);
}

// MARK: battery

export function buildBattery(s: EnergyScene) {
	const origin = Lot.battery;
	const group = s.batteryGroup;
	s.box(
		[1.25, 0.08, 0.85],
		add(origin, [0, 0.04, 0]),
		s.pbr(0.7, 0.7, 0.68, { roughness: 0.9 }),
		0,
		group
	);
	s.box(
		[0.8, 1.3, 0.3],
		add(origin, [0, 0.73, 0]),
		s.pbr(0.94, 0.95, 0.96, { roughness: 0.2, clearcoat: 0.8 }),
		0.06,
		group
	);
	s.box(
		[0.62, 0.012, 0.01],
		add(origin, [0, 1.17, 0.152]),
		s.pbr(0.3, 0.32, 0.35, { roughness: 0.4 }),
		0,
		group
	);
	for (let index = 0; index < 5; index++) {
		const led = s.box(
			[0.04, 0.085, 0.012],
			add(origin, [0, 0.5 + index * 0.11, 0.153]),
			s.pbr(0.2, 0.22, 0.24, { roughness: 0.4 }),
			0,
			group
		);
		led.userData.noShadow = true;
		const halo = s.halo(palette.battery, 0.22, 0.55);
		halo.visible = false;
		led.add(halo);
		led.userData.halo = halo;
		s.batteryLeds.push(led);
	}
}

// MARK: grid

const insulatorOffsets = [-0.85, 0, 0.85];

export function buildGridLine(s: EnergyScene) {
	pole(s, Lot.pole, true);
	pole(s, Lot.farPole, false);
	const wire = s.pbr(0.08, 0.08, 0.09, { roughness: 0.5 });
	for (const offset of insulatorOffsets) {
		const points = sag(
			add(Lot.pole, [0, 8.0, offset]),
			add(Lot.farPole, [0, 8.0, offset]),
			0.9,
			18
		);
		for (let i = 1; i < points.length; i++) s.rod(points[i - 1], points[i], 0.022, wire);
		s.rod(
			add(Lot.farPole, [0, 8.0, offset]),
			add(Lot.farPole, [9, 7.4, -11 + offset]),
			0.022,
			wire
		);
	}
}

function pole(s: EnergyScene, base: Vec3, transformer: boolean) {
	const wood = s.pbr(0.36, 0.26, 0.18, { roughness: 0.85 });
	s.rod(base, add(base, [0, 8.4, 0]), 0.13, wood);
	s.box([0.12, 0.12, 2.1], add(base, [0, 7.75, 0]), wood);
	const ceramic = s.pbr(0.78, 0.8, 0.82, { roughness: 0.2, clearcoat: 1 });
	for (const offset of insulatorOffsets) {
		s.rod(add(base, [0, 7.81, offset]), add(base, [0, 7.99, offset]), 0.055, ceramic);
	}
	if (!transformer) return;
	const steel = s.pbr(0.55, 0.57, 0.6, { roughness: 0.4, metallic: 0.6 });
	s.rod(add(base, [0.44, 5.7, 0]), add(base, [0.44, 6.75, 0]), 0.32, steel);
	s.box([0.3, 0.1, 0.1], add(base, [0.2, 6.6, 0]), steel);
}

// MARK: flow routes

/**
 * All routes end at the gateway on the façade (`Lot.hub`, x 5.32…5.78,
 * y 1.19…1.81, front z 5.14).
 */
export function buildFlows(s: EnergyScene) {
	const z = 5.1;
	const shift = (points: Vec3[], offset: Vec3) => points.map((p) => add(p, offset));

	// roof PV: down the roof from the array, over the eave, down to the hub
	const eaveEdge = Lot.slopeLength + Lot.eaveOverhang - 0.05;
	const solar: Vec3[] = [
		roofPoint(5.2, 6.45, 0.1),
		roofPoint(5.2, eaveEdge, 0.06),
		roofPoint(5.2, eaveEdge, -Lot.roofThickness - 0.08),
		[5.2, 4.0, z],
		[5.2, 1.85, z]
	];
	s.drawConduit(solar, 'solar');
	s.addTrack('solar', shift(solar, [0, 0, 0.04]), 16);

	// carport PV: from the strip's front edge to the roof edge, along it to the
	// house corner, down to the hub
	const top = Lot.carportHeight + 0.14;
	const carportSolar: Vec3[] = [
		[6.5, top, 4.95],
		[6.5, top, Lot.carportMaxZ - 0.1],
		[6.1, top, Lot.carportMaxZ - 0.1],
		[5.9, 2.9, z],
		[5.72, 1.85, z]
	];
	s.drawConduit(carportSolar, 'carportSolar');
	s.addTrack('carportSolar', shift(carportSolar, [0, 0.04, 0.03]), 10);

	// battery: down the wall, under the terrace/lawn west to the battery
	const side = Lot.battery[0] + 0.45; // battery's east face
	const battery: Vec3[] = [
		[5.4, 1.15, z],
		[5.4, 0.08, z],
		[5.4, 0.05, 5.35],
		[side, 0.05, 5.35],
		[side, 0.05, Lot.battery[2]],
		[side, 0.4, Lot.battery[2]]
	];
	s.drawConduit(battery.slice(0, 2), 'battery');
	s.drawLane(battery.slice(2, 5), 'battery');
	s.addTrack('battery', shift(battery, [0, 0.03, 0.04]), 26);

	// car: down the wall, into the carport, up to the go-e on the house wall,
	// along the cable to the Model Y's rear-left port
	const cable = sag(add(Lot.wallbox, [0.08, -0.2, 0]), add(Lot.chargePort, [0, 0, 0.05]), 0.35, 10);
	const car: Vec3[] = [
		[5.55, 1.15, z],
		[5.55, 0.08, z],
		[5.55, 0.05, 5.3],
		[6.15, 0.05, 5.3],
		[6.15, 0.05, Lot.wallbox[2]],
		[6.12, Lot.wallbox[1] - 0.22, Lot.wallbox[2]],
		...cable
	];
	s.drawConduit(car.slice(0, 2), 'car');
	s.drawLane(car.slice(2, 5), 'car');
	s.drawConduit(car.slice(4, 6), 'car');
	const cableMaterial = s.pbr(0.05, 0.05, 0.06, { roughness: 0.6 });
	for (let i = 1; i < cable.length; i++)
		s.rod(cable[i - 1], cable[i], 0.024, cableMaterial, s.carGroup);
	s.addTrack('car', shift(car, [0.03, 0.03, 0.03]), 14);

	// grid: down the wall, under the driveway east, along the carport's side
	// wall to the pole, up it and out along the overhead line
	const p = Lot.pole;
	const line = sag(add(p, [0, 8.06, 0]), add(Lot.farPole, [0, 8.06, 0]), 0.9, 18);
	const grid: Vec3[] = [
		[5.7, 1.15, z],
		[5.7, 0.08, z],
		[5.7, 0.05, 5.85],
		[13.4, 0.05, 5.85],
		[13.4, 0.05, p[2]],
		[p[0] - 0.16, 0.05, p[2]],
		[p[0] - 0.16, 7.6, p[2]],
		...line
	];
	s.drawConduit(grid.slice(0, 2), 'grid');
	s.drawLane(grid.slice(2, 6), 'grid');
	s.drawConduit(grid.slice(5, 7), 'grid', 0.03);
	s.addTrack('grid', shift(grid, [0, 0.03, 0.04]), 40);
}

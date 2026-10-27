// Holiday decorations of the 3D energy scene (FEATURES.md #4) — 1:1 with iOS
// EnergyScene+Decorations.swift: same Lot coordinates, sizes, colours and
// animation curves. Built into their own group when the season changes;
// animated pieces cast no shadows (the scene's shadow map is static).
import * as THREE from 'three';
import { Lot, roofPoint, type Vec3 } from './lot';
import { loftGeometry, PolyPath, rotation, v3 } from './geometry';
import type { EnergyScene } from './scene';
import type { Season } from './season';

export interface Decorations {
	readonly group: THREE.Group;
	/** Scene clock in seconds + frame delta. */
	tick(time: number, dt: number): void;
	/** 0 = day … 1 = night: glow, halos and flicker lights. */
	setNight(night: number): void;
	dispose(): void;
}

export function buildDecorations(scene: EnergyScene, season: Season): Decorations {
	const kit = new Kit(scene);
	if (season === 'halloween') buildHalloween(kit);
	else if (season === 'christmas') buildChristmas(kit);
	else buildEaster(kit);
	kit.finish();
	return kit;
}

const srgb = (r: number, g: number, b: number) =>
	new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const TAU = Math.PI * 2;
/** Faces toward the camera (scene yaw 24° from +z toward +x). */
const towardCamera = (24 * Math.PI) / 180;
/** Deterministic 0…1 per index (iOS: same formula in Double). */
const hash = (i: number) => {
	const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
};

type GlowMode = 'steady' | 'twinkle' | 'flicker' | 'breathe';

/** Shared twinkle/flicker curves (iOS: `GlowMode.level`). */
function modulation(mode: GlowMode, seed: number, time: number) {
	switch (mode) {
		case 'twinkle':
			return (
				0.45 +
				0.55 * (0.5 + 0.5 * Math.sin(time * (1.5 + 2.5 * hash(seed)) + TAU * hash(seed + 50)))
			);
		case 'flicker':
			return 0.82 + 0.12 * Math.sin(time * 11 + seed) + 0.06 * Math.sin(time * 23.7 + 2 * seed);
		case 'breathe':
			return 0.8 + 0.2 * Math.sin(time * 2 + seed * 0.6);
		default:
			return 1;
	}
}

interface Glow {
	material: THREE.MeshStandardMaterial;
	day: number;
	night: number;
	mode: GlowMode;
	seed: number;
	halo?: THREE.Sprite;
	haloOpacity: number;
}

interface Flame {
	light: THREE.PointLight;
	intensity: number;
	seed: number;
}

/** Builder + runtime state: unit geometries scaled per mesh, glow bookkeeping. */
class Kit implements Decorations {
	readonly group = new THREE.Group();
	readonly glows: Glow[] = [];
	readonly flames: Flame[] = [];
	readonly animations: ((time: number, dt: number) => void)[] = [];
	readonly animated = new Set<THREE.Object3D>();
	private night = 0;
	private time = 0;
	private readonly sphereGeometry = new THREE.SphereGeometry(1, 20, 14);
	private readonly boxGeometry = new THREE.BoxGeometry(1, 1, 1);
	private readonly cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 18);
	private readonly coneGeometry = new THREE.ConeGeometry(1, 1, 20);
	private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

	constructor(readonly s: EnergyScene) {}

	// MARK: building blocks

	/** Cached matte/painted material by colour. */
	paint(r: number, g: number, b: number, roughness = 0.8, metallic = 0) {
		const key = `${r},${g},${b},${roughness},${metallic}`;
		let material = this.materials.get(key);
		if (!material) {
			material = this.s.pbr(r, g, b, { roughness, metallic });
			this.materials.set(key, material);
		}
		return material;
	}

	node(position: Vec3 = [0, 0, 0], yaw = 0, parent: THREE.Object3D = this.group) {
		const node = new THREE.Group();
		node.position.set(...position);
		node.rotation.y = yaw;
		parent.add(node);
		return node;
	}

	private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) {
		const mesh = new THREE.Mesh(geometry, material);
		parent.add(mesh);
		return mesh;
	}

	sphere(
		radius: number | Vec3,
		center: Vec3,
		material: THREE.Material,
		parent: THREE.Object3D = this.group
	) {
		const mesh = this.mesh(this.sphereGeometry, material, parent);
		const [x, y, z] = typeof radius === 'number' ? [radius, radius, radius] : radius;
		mesh.scale.set(x, y, z);
		mesh.position.set(...center);
		return mesh;
	}

	box(size: Vec3, center: Vec3, material: THREE.Material, parent: THREE.Object3D = this.group) {
		const mesh = this.mesh(this.boxGeometry, material, parent);
		mesh.scale.set(...size);
		mesh.position.set(...center);
		return mesh;
	}

	/** Vertical cylinder; `radius` [x, z] for an elliptic one. */
	cylinder(
		radius: number | [number, number],
		height: number,
		center: Vec3,
		material: THREE.Material,
		parent: THREE.Object3D = this.group
	) {
		const mesh = this.mesh(this.cylinderGeometry, material, parent);
		const [x, z] = typeof radius === 'number' ? [radius, radius] : radius;
		mesh.scale.set(x, height, z);
		mesh.position.set(...center);
		return mesh;
	}

	/** Upright cone standing on `base`. */
	cone(
		radius: number,
		height: number,
		base: Vec3,
		material: THREE.Material,
		parent: THREE.Object3D = this.group
	) {
		const mesh = this.mesh(this.coneGeometry, material, parent);
		mesh.scale.set(radius, height, radius);
		mesh.position.set(base[0], base[1] + height / 2, base[2]);
		return mesh;
	}

	rod(
		from: Vec3,
		to: Vec3,
		radius: number,
		material: THREE.Material,
		parent: THREE.Object3D = this.group
	) {
		const a = v3(from);
		const b = v3(to);
		const delta = new THREE.Vector3().subVectors(b, a);
		const length = Math.max(delta.length(), 0.001);
		const mesh = this.mesh(this.cylinderGeometry, material, parent);
		mesh.position.addVectors(a, b).multiplyScalar(0.5);
		mesh.quaternion.copy(rotation(new THREE.Vector3(0, 1, 0), delta.divideScalar(length)));
		mesh.scale.set(radius, length, radius);
		return mesh;
	}

	/** Lets a material's emissive intensity follow day/night (+ twinkle/flicker). */
	track(
		material: THREE.MeshStandardMaterial,
		day: number,
		night: number,
		mode: GlowMode = 'steady',
		seed = 0
	) {
		this.glows.push({ material, day, night, mode, seed, haloOpacity: 0 });
		return material;
	}

	/** Self-lit material with `day`/`night` emissive levels. */
	glow(color: THREE.Color, day: number, night: number, mode: GlowMode = 'steady', seed = 0) {
		return this.track(this.s.glow(color, day), day, night, mode, seed);
	}

	/** Additive halo following a glow's level (web stand-in for bloom); `size` in meters. */
	halo(
		material: THREE.MeshStandardMaterial,
		parent: THREE.Object3D,
		size: number,
		opacity = 0.6,
		at?: Vec3
	) {
		const entry = this.glows.find((glow) => glow.material === material);
		if (!entry) return;
		const sprite = this.s.halo(material.emissive, 1, 0);
		sprite.scale.set(
			size / Math.max(parent.scale.x, 1e-3),
			size / Math.max(parent.scale.y, 1e-3),
			1
		);
		if (at) sprite.position.set(...at);
		parent.add(sprite);
		entry.halo = sprite;
		entry.haloOpacity = opacity;
	}

	flame(color: THREE.Color, position: Vec3, intensity: number, distance: number, seed: number) {
		const light = new THREE.PointLight(color, 0, distance, 2);
		light.position.set(...position);
		this.group.add(light);
		this.flames.push({ light, intensity, seed });
	}

	animate(node: THREE.Object3D, step: (time: number, dt: number) => void) {
		this.animated.add(node);
		this.animations.push(step);
	}

	// MARK: runtime

	finish() {
		const moving = new Set<THREE.Object3D>();
		this.animated.forEach((node) => node.traverse((child) => moving.add(child)));
		const glowing = new Set(this.glows.map((g) => g.material));
		this.group.traverse((object) => {
			if (!(object instanceof THREE.Mesh)) return;
			const lit = glowing.has(object.material as THREE.MeshStandardMaterial);
			object.castShadow = !moving.has(object) && !lit;
			object.receiveShadow = !lit;
		});
		this.update();
	}

	setNight(night: number) {
		this.night = night;
		this.update();
	}

	tick(time: number, dt: number) {
		this.time = time;
		for (const step of this.animations) step(time, dt);
		this.update();
	}

	private update() {
		const { night, time } = this;
		for (const glow of this.glows) {
			const level = modulation(glow.mode, glow.seed, time);
			glow.material.emissiveIntensity = (glow.day + (glow.night - glow.day) * night) * level;
			if (glow.halo) {
				glow.halo.material.opacity = glow.haloOpacity * night * level;
				glow.halo.visible = night > 0.05;
			}
		}
		for (const flame of this.flames) {
			flame.light.intensity = flame.intensity * night * modulation('flicker', flame.seed, time);
		}
	}

	dispose() {
		const materials = new Set<THREE.Material>();
		this.group.traverse((object) => {
			if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
				materials.add(object.material as THREE.Material);
				if (object instanceof THREE.Mesh) object.geometry.dispose();
			}
		});
		// sprite maps are the scene's shared halo texture: keep them
		materials.forEach((material) => material.dispose());
		this.group.removeFromParent();
	}
}

// MARK: shared pieces

/** Bulbs along the front eave gutter and the carport fascia (Halloween + Christmas). */
function stringLights(k: Kit, colors: THREE.Color[], mode: GlowMode, day: number, night: number) {
	const eave = roofPoint(0, Lot.slopeLength + Lot.eaveOverhang - 0.02, -Lot.roofThickness - 0.1);
	const fasciaY = Lot.carportHeight - 0.55;
	const lines: [Vec3, Vec3, number][] = [
		[[-6.2, eave[1] - 0.1, eave[2] + 0.06], [6.2, eave[1] - 0.1, eave[2] + 0.06], 30],
		[[6.05, fasciaY, Lot.carportMaxZ + 0.14], [12.55, fasciaY, Lot.carportMaxZ + 0.14], 16]
	];
	const wire = k.paint(0.05, 0.05, 0.06, 0.6);
	let index = 0;
	for (const [from, to, count] of lines) {
		k.rod(from, to, 0.008, wire);
		for (let i = 0; i < count; i++) {
			const t = i / (count - 1);
			const position: Vec3 = [
				from[0] + (to[0] - from[0]) * t,
				from[1] - 0.045,
				from[2] + (to[2] - from[2]) * t
			];
			const material = k.glow(colors[index % colors.length], day, night, mode, index);
			const bulb = k.sphere([0.04, 0.05, 0.04], position, material);
			k.halo(material, bulb, 0.34, 0.55);
			index++;
		}
	}
}

/** Pastel eggs hanging along the front eave and the carport fascia (Easter's string lights). */
function eggGarland(k: Kit, pastel: THREE.Material[]) {
	const eave = roofPoint(0, Lot.slopeLength + Lot.eaveOverhang - 0.02, -Lot.roofThickness - 0.1);
	const fasciaY = Lot.carportHeight - 0.55;
	const lines: [Vec3, Vec3, number][] = [
		[[-6.2, eave[1] - 0.1, eave[2] + 0.06], [6.2, eave[1] - 0.1, eave[2] + 0.06], 24],
		[[6.05, fasciaY, Lot.carportMaxZ + 0.14], [12.55, fasciaY, Lot.carportMaxZ + 0.14], 13]
	];
	const ribbon = k.paint(0.98, 0.9, 0.55, 0.7);
	let index = 0;
	for (const [from, to, count] of lines) {
		k.rod(from, to, 0.012, ribbon);
		for (let i = 0; i < count; i++) {
			const t = i / (count - 1);
			const top: Vec3 = [from[0] + (to[0] - from[0]) * t, from[1], from[2] + (to[2] - from[2]) * t];
			const drop = 0.06 + 0.06 * hash(index + 900);
			k.rod(top, [top[0], top[1] - drop, top[2]], 0.004, ribbon);
			k.sphere(
				[0.07, 0.095, 0.07],
				[top[0], top[1] - drop - 0.095, top[2]],
				pastel[index % pastel.length]
			);
			index++;
		}
	}
}

// MARK: Halloween

function buildHalloween(k: Kit) {
	stringLights(k, [srgb(1, 0.5, 0.08), srgb(0.6, 0.2, 1)], 'breathe', 0.5, 2.2);

	// jack-o'-lanterns: entrance step, gate post + first fence pillars, west lawn
	const pumpkins: [Vec3, number][] = [
		[[1.15, 0.16, 5.5], 0.17],
		[[2.45, 0.16, 5.5], 0.15],
		[[0.9, 1.31, Lot.fenceZ], 0.15],
		[[2.7, 1.31, Lot.fenceZ], 0.15],
		[[5.9, 1.31, Lot.fenceZ], 0.14],
		[[-1.9, 0, 6.9], 0.32]
	];
	pumpkins.forEach(([base, radius], index) => pumpkin(k, base, radius, index));
	k.flame(srgb(1, 0.55, 0.15), [1.8, 0.55, 5.95], 2.2, 3.5, 3);

	for (let index = 0; index < 5; index++) bat(k, index);
	ghost(k);

	// crooked tombstones on the lawn east of the driveway
	const stone = k.paint(0.5, 0.52, 0.55, 0.95);
	const engraving = k.paint(0.3, 0.31, 0.33, 0.9);
	const stones: [Vec3, Vec3, number, number, number][] = [
		[[13.2, 0, 7.0], [0.42, 0.66, 0.12], 0.5, 0.08, 0],
		[[14.15, 0, 7.5], [0.36, 0.56, 0.11], 0.35, -0.12, 0],
		[[13.5, 0, 8.1], [0.34, 0.5, 0.1], 0.6, 0, -0.14]
	];
	for (const [base, size, yaw, tiltZ, tiltX] of stones) {
		const node = k.node(base, yaw);
		node.rotation.z = tiltZ;
		node.rotation.x = tiltX;
		const slab = k.s.box(size, [0, size[1] / 2 - 0.05, 0], stone, 0.1, node);
		slab.castShadow = true;
		for (const y of [0.62, 0.5]) {
			k.box(
				[size[0] * 0.5, 0.025, 0.006],
				[0, size[1] * y - 0.05, size[2] / 2 + 0.002],
				engraving,
				node
			);
		}
	}
}

/** Lobed pumpkin with a carved face toward the camera; glows + flickers after dusk. */
function pumpkin(k: Kit, base: Vec3, r: number, index: number) {
	const node = k.node(base, towardCamera);
	const orange = k.paint(0.93, 0.42, 0.06, 0.55);
	for (let lobe = 0; lobe < 6; lobe++) {
		const a = (lobe / 6) * TAU;
		k.sphere(
			[0.58 * r, 0.78 * r, 0.58 * r],
			[Math.sin(a) * 0.42 * r, 0.78 * r, Math.cos(a) * 0.42 * r],
			orange,
			node
		);
	}
	k.sphere([0.7 * r, 0.8 * r, 0.7 * r], [0, 0.78 * r, 0], orange, node);
	const stem = k.cylinder(0.07 * r, 0.26 * r, [0, 1.62 * r, 0], k.paint(0.3, 0.35, 0.12), node);
	stem.rotation.z = 0.25;
	const face = k.glow(srgb(1, 0.62, 0.18), 0.25, 2.4, 'flicker', index * 1.7);
	for (const side of [-1, 1]) {
		k.box(
			[0.16 * r, 0.16 * r, 0.04 * r],
			[side * 0.22 * r, 0.95 * r, 0.94 * r],
			face,
			node
		).rotation.z = Math.PI / 4;
		k.box(
			[0.14 * r, 0.08 * r, 0.04 * r],
			[side * 0.26 * r, 0.62 * r, 0.9 * r],
			face,
			node
		).rotation.z = side * -0.45;
	}
	k.box([0.09 * r, 0.09 * r, 0.04 * r], [0, 0.78 * r, 0.99 * r], face, node).rotation.z =
		Math.PI / 4;
	k.box([0.46 * r, 0.09 * r, 0.04 * r], [0, 0.56 * r, 0.93 * r], face, node);
	k.halo(face, node, 4.5 * r, 0.7, [0, 0.75 * r, 1.05 * r]);
}

/** Bat circling the chimney (ellipse), wings flapping. */
function bat(k: Kit, index: number) {
	const node = k.node();
	const black = k.paint(0.05, 0.045, 0.06, 0.8);
	k.sphere([0.08, 0.07, 0.13], [0, 0, 0], black, node);
	k.sphere(0.055, [0, 0.02, 0.11], black, node);
	for (const side of [-1, 1]) k.box([0.02, 0.06, 0.015], [side * 0.03, 0.08, 0.11], black, node);
	const wings = [-1, 1].map((side) => {
		const pivot = k.node([side * 0.05, 0, 0], 0, node);
		k.box([0.42, 0.01, 0.2], [side * 0.21, 0, -0.01], black, pivot);
		k.box([0.24, 0.01, 0.12], [side * 0.32, 0, -0.12], black, pivot).rotation.y = side * 0.45;
		return pivot;
	});
	const radius = 2.6 + 0.9 * index;
	const height = 9.6 + 0.5 * (index % 3);
	const speed = (0.55 + 0.12 * index) * (index % 2 === 0 ? 1 : -1);
	const start = hash(index + 10) * TAU;
	k.animate(node, (time) => {
		const a = start + speed * time;
		node.position.set(
			1.0 + radius * Math.cos(a),
			height + 0.35 * Math.sin(time * 1.7 + index),
			0.3 + radius * 0.6 * Math.sin(a)
		);
		node.rotation.y = Math.atan2(-radius * Math.sin(a) * speed, radius * 0.6 * Math.cos(a) * speed);
		const flap = Math.sin(time * (9 + index) + index) * 0.75;
		wings[0].rotation.z = flap;
		wings[1].rotation.z = -flap;
	});
}

/** Sheet ghost drifting and bobbing above the tombstones east of the driveway. */
function ghost(k: Kit) {
	const node = k.node([13.7, 0.9, 7.6], towardCamera);
	const sheet = k.s.pbr(0.96, 0.97, 1, { roughness: 0.7 });
	sheet.transparent = true;
	sheet.opacity = 0.85;
	sheet.emissive.setRGB(0.75, 0.85, 1, THREE.SRGBColorSpace);
	k.track(sheet, 0, 0.55);
	const stations = [
		[0, 0.42],
		[0.18, 0.38],
		[0.5, 0.33],
		[0.8, 0.32],
		[1.0, 0.28],
		[1.12, 0.19],
		[1.18, 0.06]
	].map(([z, radius]) => ({ z, halfWidth: radius, bottom: -radius, top: radius, round: 1 }));
	const body = new THREE.Mesh(loftGeometry(stations).rotateX(-Math.PI / 2), sheet);
	node.add(body);
	const black = k.paint(0.03, 0.03, 0.04, 0.6);
	for (const side of [-1, 1]) {
		k.sphere([0.05, 0.075, 0.03], [side * 0.1, 0.98, 0.27], black, node);
		k.sphere([0.08, 0.16, 0.08], [side * 0.36, 0.62, 0.05], sheet, node).rotation.z = side * 0.6;
	}
	k.sphere([0.05, 0.065, 0.03], [0, 0.8, 0.31], black, node);
	k.animate(node, (time) => {
		node.position.set(
			13.7 + 0.45 * Math.sin(time * 0.35),
			0.9 + 0.18 * Math.sin(time * 1.4),
			7.6 + 0.3 * Math.sin(time * 0.5)
		);
		node.rotation.z = 0.08 * Math.sin(time * 1.1);
	});
}

// MARK: Christmas

function buildChristmas(k: Kit) {
	const colors = [
		srgb(1, 0.12, 0.12),
		srgb(0.15, 0.95, 0.3),
		srgb(1, 0.75, 0.2),
		srgb(0.2, 0.45, 1),
		srgb(1, 0.92, 0.8)
	];
	stringLights(k, colors, 'twinkle', 0.7, 2.4);

	// icicle lights under the carport fascia
	const icicle = srgb(0.8, 0.9, 1);
	for (let i = 0; i < 26; i++) {
		const x = 6.1 + i * 0.25;
		const length = 0.12 + 0.22 * hash(i + 100);
		const top = Lot.carportHeight - 0.57;
		k.rod(
			[x, top, Lot.carportMaxZ + 0.13],
			[x, top - length, Lot.carportMaxZ + 0.13],
			0.012,
			k.glow(icicle, 0.5, 1.6, 'twinkle', i + 60)
		);
	}

	christmasTree(k, [-1.2, 0, 7.9]);
	snowman(k, [13.5, 0, 7.8]);
	santa(k);

	// wreath with a red bow on the front door
	const green = k.paint(0.05, 0.3, 0.12, 0.9);
	const red = k.paint(0.8, 0.06, 0.08, 0.6);
	const door: Vec3 = [1.8, 1.65, Lot.halfDepth + 0.1];
	for (let i = 0; i < 18; i++) {
		const a = (i / 18) * TAU;
		k.sphere(0.055, add(door, [0.19 * Math.cos(a), 0.19 * Math.sin(a), 0]), green);
	}
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * TAU + 0.3;
		k.sphere(0.022, add(door, [0.19 * Math.cos(a), 0.19 * Math.sin(a), 0.05]), red);
	}
	for (const side of [-1, 1]) {
		k.sphere([0.06, 0.04, 0.025], add(door, [side * 0.05, -0.19, 0.04]), red);
		k.box([0.025, 0.12, 0.01], add(door, [side * 0.03, -0.26, 0.04]), red).rotation.z = side * 0.25;
	}
	k.sphere(0.025, add(door, [0, -0.19, 0.05]), red);
}

function christmasTree(k: Kit, base: Vec3) {
	k.cylinder(0.09, 0.35, add(base, [0, 0.175, 0]), k.paint(0.3, 0.2, 0.12, 0.9));
	const fir = k.paint(0.06, 0.26, 0.11, 0.9);
	const tiers: [number, number, number][] = [
		[0.3, 1.15, 0.95],
		[0.85, 0.95, 0.74],
		[1.38, 0.85, 0.5]
	];
	for (const [y, height, radius] of tiers) k.cone(radius, height, add(base, [0, y, 0]), fir);
	/** Outer radius of the tree at height `y`. */
	const envelope = (y: number) =>
		Math.max(
			0,
			...tiers.map(([by, h, r]) => (y >= by && y <= by + h ? r * (1 - (y - by) / h) : 0))
		);

	// ornaments
	const ornaments = [
		k.paint(0.85, 0.08, 0.1, 0.25, 0.4),
		k.paint(0.95, 0.72, 0.2, 0.25, 0.8),
		k.paint(0.15, 0.35, 0.9, 0.25, 0.4),
		k.paint(0.85, 0.87, 0.9, 0.2, 0.9)
	];
	for (let i = 0; i < 16; i++) {
		const tier = tiers[i < 8 ? 0 : i < 13 ? 1 : 2];
		const f = 0.18 + 0.4 * hash(i + 300);
		const a = hash(i + 200) * TAU;
		const radius = tier[2] * (1 - f) + 0.05;
		k.sphere(
			0.065,
			add(base, [radius * Math.cos(a), tier[0] + f * tier[1], radius * Math.sin(a)]),
			ornaments[i % 4]
		);
	}
	// twinkling lights spiralling up
	for (let i = 0; i < 24; i++) {
		const t = i / 24;
		const y = 0.38 + 1.75 * t;
		const radius = envelope(y) + 0.03;
		const a = t * 3 * TAU;
		const material = k.glow(srgb(1, 0.85, 0.55), 0.8, 2.6, 'twinkle', i + 120);
		const light = k.sphere(
			0.03,
			add(base, [radius * Math.cos(a), y, radius * Math.sin(a)]),
			material
		);
		k.halo(material, light, 0.22, 0.5);
	}
	// glowing star
	const shape = new THREE.Shape();
	for (let i = 0; i < 10; i++) {
		const a = Math.PI / 2 + (i / 10) * TAU;
		const radius = i % 2 === 0 ? 0.17 : 0.07;
		if (i === 0) shape.moveTo(radius * Math.cos(a), radius * Math.sin(a));
		else shape.lineTo(radius * Math.cos(a), radius * Math.sin(a));
	}
	const starGeometry = new THREE.ExtrudeGeometry(shape, {
		depth: 0.05,
		bevelEnabled: false
	}).translate(0, 0, -0.025);
	const starNode = k.node(add(base, [0, 2.35, 0]), towardCamera);
	const gold = k.glow(srgb(1, 0.8, 0.3), 1.2, 3, 'breathe', 7);
	starNode.add(new THREE.Mesh(starGeometry, gold));
	k.halo(gold, starNode, 1.1, 0.8);

	// presents
	const presents: [Vec3, Vec3, number, THREE.Material, THREE.Material][] = [
		[
			[0.45, 0, 0.65],
			[0.3, 0.3, 0.3],
			0.2,
			k.paint(0.8, 0.08, 0.1, 0.6),
			k.paint(0.95, 0.75, 0.25, 0.3, 0.6)
		],
		[
			[-0.5, 0, 0.6],
			[0.36, 0.24, 0.28],
			-0.3,
			k.paint(0.15, 0.3, 0.75, 0.6),
			k.paint(0.85, 0.87, 0.9, 0.3, 0.6)
		],
		[
			[-0.05, 0, 0.9],
			[0.26, 0.2, 0.26],
			0.5,
			k.paint(0.1, 0.5, 0.2, 0.6),
			k.paint(0.85, 0.1, 0.12, 0.5)
		]
	];
	for (const [offset, [w, h, d], yaw, paper, ribbon] of presents) {
		const node = k.node(add(base, offset), yaw);
		k.box([w, h, d], [0, h / 2, 0], paper, node);
		k.box([w + 0.012, h + 0.012, 0.045], [0, h / 2, 0], ribbon, node);
		k.box([0.045, h + 0.012, d + 0.012], [0, h / 2, 0], ribbon, node);
		for (const side of [-1, 1])
			k.sphere([0.05, 0.035, 0.03], [side * 0.035, h + 0.02, 0], ribbon, node);
	}
}

function snowman(k: Kit, base: Vec3) {
	const node = k.node(base, towardCamera);
	const snow = k.paint(0.94, 0.95, 0.98, 0.95);
	const coal = k.paint(0.04, 0.04, 0.05, 0.7);
	const red = k.paint(0.78, 0.1, 0.12, 0.8);
	const black = k.paint(0.05, 0.05, 0.06, 0.6);
	const wood = k.paint(0.32, 0.2, 0.1, 0.9);
	k.sphere(0.42, [0, 0.38, 0], snow, node);
	k.sphere(0.31, [0, 0.98, 0], snow, node);
	k.sphere(0.22, [0, 1.42, 0], snow, node);
	for (const side of [-1, 1]) k.sphere(0.028, [side * 0.075, 1.48, 0.19], coal, node);
	for (let j = -2; j <= 2; j++)
		k.sphere(0.018, [j * 0.045, 1.35 + 0.012 * j * j, 0.205 - 0.01 * Math.abs(j)], coal, node);
	for (const [y, z] of [
		[0.88, 0.293],
		[1.0, 0.309],
		[1.12, 0.277]
	]) {
		k.sphere(0.03, [0, y, z], coal, node);
	}
	const nose = k.cone(0.035, 0.2, [0, 0, 0], k.paint(0.95, 0.45, 0.1, 0.7), node);
	nose.rotation.x = Math.PI / 2;
	nose.position.set(0, 1.42, 0.3);
	const hat = k.node([0, 1.61, 0], 0, node);
	hat.rotation.z = 0.12;
	k.cylinder(0.25, 0.03, [0, 0.015, 0], black, hat);
	k.cylinder(0.16, 0.26, [0, 0.16, 0], black, hat);
	k.cylinder(0.163, 0.05, [0, 0.06, 0], red, hat);
	k.cylinder(0.235, 0.09, [0, 1.24, 0], red, node);
	k.box([0.08, 0.26, 0.03], [0.12, 1.1, 0.21], red, node).rotation.z = 0.15;
	for (const side of [-1, 1]) {
		k.rod([side * 0.27, 1.05, 0], [side * 0.62, 1.32, 0.05], 0.018, wood, node);
		k.rod([side * 0.52, 1.24, 0.04], [side * 0.6, 1.4, 0.02], 0.012, wood, node);
	}
}

/** Santa sitting on the ridge (east of the chimney, clear of the solar callout), waving; sack beside him. */
function santa(k: Kit) {
	const node = k.node([4.6, 9.0, 0.15], 0.2);
	const red = k.paint(0.78, 0.08, 0.08, 0.7);
	const fur = k.paint(0.96, 0.96, 0.94, 0.95);
	const skin = k.paint(0.96, 0.78, 0.68, 0.8);
	const black = k.paint(0.05, 0.05, 0.06, 0.6);
	const gold = k.paint(0.95, 0.75, 0.25, 0.3, 0.6);
	k.sphere([0.32, 0.36, 0.28], [0, 0.32, 0], red, node);
	k.box([0.08, 0.46, 0.04], [0, 0.3, 0.26], fur, node);
	k.cylinder([0.31, 0.27], 0.06, [0, 0.26, 0], black, node);
	k.box([0.1, 0.08, 0.02], [0, 0.26, 0.275], gold, node);
	k.sphere(0.17, [0, 0.78, 0.02], skin, node);
	k.sphere([0.17, 0.17, 0.12], [0, 0.68, 0.1], fur, node);
	k.sphere([0.1, 0.035, 0.05], [0, 0.75, 0.17], fur, node);
	k.sphere(0.035, [0, 0.79, 0.18], k.paint(0.95, 0.6, 0.55, 0.7), node);
	for (const side of [-1, 1]) k.sphere(0.018, [side * 0.055, 0.84, 0.15], black, node);
	const hat = k.node([0, 0.88, 0], 0, node);
	hat.rotation.z = -0.3;
	k.cone(0.16, 0.36, [0, 0, 0], red, hat);
	k.cylinder(0.175, 0.07, [0, 0.02, 0], fur, hat);
	k.sphere(0.06, [0, 0.37, 0], fur, hat);
	// left arm resting, right arm waving
	k.rod([-0.28, 0.5, 0], [-0.32, 0.18, 0.22], 0.07, red, node);
	k.sphere(0.07, [-0.32, 0.16, 0.24], fur, node);
	const arm = k.node([0.28, 0.52, 0], 0, node);
	k.rod([0, 0, 0], [0.22, 0.34, 0.04], 0.07, red, arm);
	k.sphere(0.075, [0.24, 0.37, 0.04], fur, arm);
	k.animate(arm, (time) => {
		arm.rotation.z = -0.25 + 0.35 * Math.sin(time * 6);
	});
	// legs dangling down the front slope, boots on the modules
	for (const side of [-1, 1]) {
		k.rod([side * 0.14, 0.06, 0.15], [side * 0.16, -0.42, 0.55], 0.08, red, node);
		k.box([0.13, 0.12, 0.22], [side * 0.16, -0.48, 0.62], black, node).rotation.x = -0.4;
	}
	// sack
	const sack = k.paint(0.5, 0.14, 0.1, 0.9);
	k.sphere([0.3, 0.27, 0.28], [5.25, 9.2, 0.0], sack);
	k.cylinder(0.07, 0.1, [5.25, 9.47, 0.0], gold);
	k.sphere([0.1, 0.06, 0.1], [5.25, 9.54, 0.0], sack);
}

// MARK: Easter

function buildEaster(k: Kit) {
	const pastel = [
		k.paint(1, 0.55, 0.72, 0.35),
		k.paint(1, 0.86, 0.3, 0.35),
		k.paint(0.4, 0.68, 1, 0.35),
		k.paint(0.45, 0.88, 0.45, 0.35),
		k.paint(0.72, 0.5, 1, 0.35),
		k.paint(1, 0.6, 0.25, 0.35)
	];
	const egg = (
		center: Vec3,
		scale: number,
		material: THREE.Material,
		tilt = 0,
		parent?: THREE.Object3D
	) => {
		const mesh = k.sphere([0.065 * scale, 0.088 * scale, 0.065 * scale], center, material, parent);
		mesh.rotation.z = tilt;
		return mesh;
	};

	// eggs hidden in the lawn (both sides of the path)
	const lawn: [number, number][] = [
		[-1.2, 6.2],
		[-2.8, 7.4],
		[-4.0, 6.5],
		[-5.6, 7.6],
		[-7.2, 7.0],
		[-9.6, 8.2],
		[-10.8, 9.6],
		[-8.2, 10.6],
		[-5.2, 10.6],
		[-3.0, 10.4],
		[-1.0, 9.6],
		[-0.6, 8.0],
		[3.2, 7.4],
		[4.6, 8.8],
		[3.8, 10.6],
		[-6.4, 5.6]
	];
	lawn.forEach(([x, z], i) =>
		egg([x, 0.11, z], 2, pastel[i % pastel.length], (hash(i + 500) - 0.5) * 2.4)
	);

	// Easter egg tree: eggs on strings around the front fruit tree's crown
	const string = k.paint(0.95, 0.95, 0.95, 0.8);
	for (let i = 0; i < 10; i++) {
		const a = (i / 10) * TAU + 0.17;
		const anchor: Vec3 = [-3.4 + 0.767 * Math.cos(a), 1.623, 8.4 + 0.767 * Math.sin(a)];
		k.rod(anchor, add(anchor, [0, -0.14, 0]), 0.004, string);
		egg(add(anchor, [0, -0.21, 0]), 0.85, pastel[(i + 2) % pastel.length]);
	}
	// blossoms on both fruit trees
	const blossom = [
		k.paint(1, 0.8, 0.86, 0.9),
		k.paint(1, 0.97, 0.97, 0.9),
		k.paint(0.98, 0.65, 0.78, 0.9)
	];
	const blobs: [Vec3, number][] = [
		[[0, 3.0, 0], 1.3],
		[[0.6, 3.75, 0.25], 1.0],
		[[-0.55, 3.55, -0.3], 0.95],
		[[0.1, 4.3, -0.1], 0.75]
	];
	const trees: [Vec3, number][] = [
		[[-3.4, 0, 8.4], 0.72],
		[[-8.6, 0, 7.6], 0.85]
	];
	trees.forEach(([base, scale], t) => {
		for (let i = 0; i < 30; i++) {
			const [center, radius] = blobs[i % blobs.length];
			const seed = t * 100 + i;
			const a = hash(seed + 700) * TAU;
			const up = 0.15 + 0.75 * hash(seed + 800);
			const flat = Math.sqrt(1 - up * up);
			const direction: Vec3 = [flat * Math.cos(a), up, flat * Math.sin(a)];
			const point = add(base, [
				(center[0] + direction[0] * radius) * scale,
				(center[1] + direction[1] * radius) * scale,
				(center[2] + direction[2] * radius) * scale
			]);
			k.sphere(0.19 * scale, point, blossom[i % blossom.length]);
		}
	});

	// tulips along the façade and inside the street fence
	const blooms = [
		k.paint(0.9, 0.1, 0.14, 0.5),
		k.paint(1, 0.84, 0.18, 0.5),
		k.paint(1, 0.48, 0.68, 0.5),
		k.paint(0.98, 0.97, 0.94, 0.5),
		k.paint(1, 0.52, 0.12, 0.5),
		k.paint(0.62, 0.3, 0.85, 0.5)
	];
	const stem = k.paint(0.2, 0.5, 0.15, 0.8);
	const beds: [number, number, number, number][] = [
		[-5.6, 0.1, 5.5, 0],
		[2.95, 5.65, Lot.fenceZ - 0.28, 40]
	];
	for (const [from, to, z, seed] of beds) {
		for (let x = from, i = 0; x <= to + 1e-6; x += 0.3, i++) {
			const h = 0.24 + 0.1 * hash(seed + i + 400);
			k.rod([x, 0, z], [x, h, z], 0.011, stem);
			k.sphere([0.045, 0.06, 0.045], [x, h + 0.04, z], blooms[(seed + i) % blooms.length]);
			k.box([0.03, 0.12, 0.01], [x + 0.02, 0.07, z], stem).rotation.z = -0.4;
		}
	}

	// big Easter basket on the front lawn
	const wicker = k.paint(0.62, 0.45, 0.25, 0.95);
	const basket = k.node([0.3, 0, 8.9], towardCamera);
	basket.scale.setScalar(1.8);
	k.cylinder(0.16, 0.13, [0, 0.065, 0], wicker, basket);
	k.cylinder(0.17, 0.03, [0, 0.13, 0], k.paint(0.5, 0.35, 0.18, 0.95), basket);
	k.sphere([0.15, 0.04, 0.15], [0, 0.13, 0], k.paint(0.4, 0.7, 0.25, 0.9), basket);
	for (let i = 0; i < 7; i++) {
		const a0 = (i / 7) * Math.PI;
		const a1 = ((i + 1) / 7) * Math.PI;
		const point = (a: number): Vec3 => [0.16 * Math.cos(a), 0.13 + 0.19 * Math.sin(a), 0];
		k.rod(point(a0), point(a1), 0.012, wicker, basket);
	}
	[
		[-0.06, -0.05],
		[0.06, -0.04],
		[0, 0.06],
		[-0.05, 0.05]
	].forEach(([dx, dz], i) =>
		egg([dx, 0.18, dz], 0.9, pastel[(i + 1) % pastel.length], (i - 1.5) * 0.3, basket)
	);

	eggGarland(k, pastel);

	bunny(k);
	for (let index = 0; index < 3; index++) butterfly(k, index);
}

/** Storybook-size Easter bunny hopping a loop across the front lawn and path: runs of 7 hops, then a pause. */
function bunny(k: Kit) {
	const node = k.node();
	node.scale.setScalar(1.8);
	const fur = k.paint(0.66, 0.55, 0.45, 0.95);
	const white = k.paint(0.95, 0.95, 0.93, 0.95);
	const black = k.paint(0.03, 0.03, 0.04, 0.5);
	k.sphere([0.2, 0.19, 0.28], [0, 0.24, 0], fur, node);
	k.sphere(0.14, [0, 0.46, 0.24], fur, node);
	const ears = [-1, 1].map((side) => {
		const ear = k.node([side * 0.06, 0.56, 0.2], 0, node);
		ear.rotation.z = side * -0.15;
		k.sphere([0.042, 0.18, 0.025], [0, 0.14, 0], fur, ear);
		return ear;
	});
	k.sphere(0.07, [0, 0.28, -0.27], white, node);
	for (const side of [-1, 1]) {
		k.sphere(0.022, [side * 0.075, 0.5, 0.35], black, node);
		k.sphere(0.05, [side * 0.08, 0.05, 0.18], fur, node);
		k.sphere([0.05, 0.035, 0.12], [side * 0.12, 0.04, -0.1], fur, node);
	}
	k.sphere(0.018, [0, 0.45, 0.38], k.paint(1, 0.55, 0.65, 0.6), node);
	const loop: Vec3[] = [
		[-3.6, 0, 6.8],
		[-1.0, 0, 7.2],
		[1.8, 0, 7.6],
		[4.6, 0, 7.4],
		[4.8, 0, 9.6],
		[1.8, 0, 10.0],
		[-1.4, 0, 9.8],
		[-4.4, 0, 9.2],
		[-5.6, 0, 7.8],
		[-3.6, 0, 6.8]
	];
	const path = new PolyPath(loop);
	const position = new THREE.Vector3();
	const tangent = new THREE.Vector3();
	const hop = 0.42;
	const hops = 7;
	const stride = 0.6;
	const pause = 1.4;
	const cycle = hops * hop + pause;
	k.animate(node, (time) => {
		const run = Math.floor(time / cycle);
		const phase = time - run * cycle;
		const hopping = phase < hops * hop;
		const travelled = run * hops * stride + (hopping ? (phase / hop) * stride : hops * stride);
		path.sample(travelled % path.length, position, tangent);
		const p = hopping ? (phase / hop) % 1 : 0;
		node.position.set(position.x, 0.3 * 4 * p * (1 - p), position.z);
		node.rotation.y = Math.atan2(tangent.x, tangent.z);
		const twitch = hopping ? 0 : 0.12 * Math.sin(time * 9);
		ears[0].rotation.x = twitch;
		ears[1].rotation.x = -twitch;
	});
}

/** Butterfly fluttering a Lissajous loop around the beds. */
function butterfly(k: Kit, index: number) {
	const centers: Vec3[] = [
		[-2.6, 0.9, 6.0],
		[-2.2, 1.6, 8.2],
		[4.3, 0.8, 10.2]
	];
	const colors: [number, number, number][] = [
		[1, 0.55, 0.1],
		[1, 0.9, 0.3],
		[0.35, 0.6, 1]
	];
	const node = k.node();
	node.scale.setScalar(1.6);
	const wing = k.paint(...colors[index], 0.6);
	k.box([0.014, 0.014, 0.1], [0, 0, 0], k.paint(0.05, 0.05, 0.06, 0.6), node);
	const wings = [-1, 1].map((side) => {
		const pivot = k.node([0, 0, 0], 0, node);
		k.box([0.16, 0.004, 0.12], [side * 0.08, 0, 0.02], wing, pivot);
		k.box([0.12, 0.004, 0.09], [side * 0.065, 0, -0.07], wing, pivot);
		return { pivot, side };
	});
	const [cx, cy, cz] = centers[index];
	const phase = index * 2.1;
	k.animate(node, (time) => {
		const x = cx + 1.1 * Math.sin(0.7 * time + phase);
		const z = cz + 0.7 * Math.sin(1.1 * time + phase);
		node.position.set(x, cy + 0.25 * Math.sin(2.3 * time + phase) + 0.1 * Math.sin(5 * time), z);
		node.rotation.y = Math.atan2(
			0.77 * Math.cos(0.7 * time + phase),
			0.77 * Math.cos(1.1 * time + phase)
		);
		const flap = 0.2 + 0.9 * (0.5 + 0.5 * Math.sin(time * 18 + phase));
		for (const { pivot, side } of wings) pivot.rotation.z = side * flap;
	});
}

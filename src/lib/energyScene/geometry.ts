// Geometry helpers for the 3D energy scene — port of the loft/prism/sag and
// path sampling helpers in EnergyScene.swift.
import * as THREE from 'three';
import type { Vec3 } from './lot';

export const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

/** Rotation taking `from` onto `to` (both unit), robust for opposite vectors. */
export function rotation(from: THREE.Vector3, to: THREE.Vector3): THREE.Quaternion {
	if (from.dot(to) < -0.9999) {
		const axis = Math.abs(from.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
		return new THREE.Quaternion().setFromAxisAngle(axis.cross(from).normalize(), Math.PI);
	}
	return new THREE.Quaternion().setFromUnitVectors(from, to);
}

/** Hanging wire/cable between two points (parabolic sag). */
export function sag(a: Vec3, b: Vec3, depth: number, segments: number): Vec3[] {
	const points: Vec3[] = [];
	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		points.push([
			a[0] + (b[0] - a[0]) * t,
			a[1] + (b[1] - a[1]) * t - depth * 4 * t * (1 - t),
			a[2] + (b[2] - a[2]) * t
		]);
	}
	return points;
}

/** Cross-section of a lofted shape: rounded rectangle in x/y at `z` (round 0 boxy … 1 elliptic). */
export interface LoftStation {
	z: number;
	halfWidth: number;
	bottom: number;
	top: number;
	round: number;
}

/** Smooth closed mesh through superellipse cross-sections, capped at both ends. */
export function loftGeometry(stations: LoftStation[], ring = 24): THREE.BufferGeometry {
	const positions: number[] = [];
	const normals: number[] = [];
	const indices: number[] = [];
	const rings = stations.map((station) => {
		const exponent = 2 / (2 + (1 - station.round) * 8);
		const halfHeight = (station.top - station.bottom) / 2;
		const mid = station.bottom + halfHeight;
		return Array.from({ length: ring }, (_, index) => {
			const angle = (index / ring) * Math.PI * 2;
			const c = Math.cos(angle);
			const s = Math.sin(angle);
			return new THREE.Vector3(
				station.halfWidth * Math.sign(c) * Math.pow(Math.abs(c), exponent),
				mid + halfHeight * Math.sign(s) * Math.pow(Math.abs(s), exponent),
				station.z
			);
		});
	});
	const side: THREE.Vector3[] = rings.flat();
	const sideNormals = side.map(() => new THREE.Vector3());
	for (let station = 0; station < rings.length - 1; station++) {
		for (let index = 0; index < ring; index++) {
			const a = station * ring + index;
			const b = station * ring + ((index + 1) % ring);
			const c = (station + 1) * ring + ((index + 1) % ring);
			const d = (station + 1) * ring + index;
			// rings run counter-clockwise seen from +z: (a, b, c) faces outward
			for (const [i0, i1, i2] of [
				[a, b, c],
				[a, c, d]
			]) {
				indices.push(i0, i1, i2);
				const n = new THREE.Vector3()
					.subVectors(side[i1], side[i0])
					.cross(new THREE.Vector3().subVectors(side[i2], side[i0]));
				sideNormals[i0].add(n);
				sideNormals[i1].add(n);
				sideNormals[i2].add(n);
			}
		}
	}
	side.forEach((p, i) => {
		positions.push(p.x, p.y, p.z);
		const n =
			sideNormals[i].lengthSq() > 0 ? sideNormals[i].normalize() : new THREE.Vector3(0, 1, 0);
		normals.push(n.x, n.y, n.z);
	});
	// flat end caps
	for (const [points, facing] of [
		[rings[0], -1],
		[rings[rings.length - 1], 1]
	] as const) {
		const center = points
			.reduce((sum, p) => sum.add(p), new THREE.Vector3())
			.divideScalar(points.length);
		const base = positions.length / 3;
		positions.push(center.x, center.y, center.z);
		normals.push(0, 0, facing);
		for (const p of points) {
			positions.push(p.x, p.y, p.z);
			normals.push(0, 0, facing);
		}
		for (let index = 0; index < ring; index++) {
			const p = base + 1 + index;
			const q = base + 1 + ((index + 1) % ring);
			if (facing > 0) indices.push(base, p, q);
			else indices.push(base, q, p);
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	geometry.setIndex(indices);
	return geometry;
}

/** Gable ends (and optionally the roof planes) of a ridge-along-x prism, base at y = 0. */
export function prismGeometry(
	width: number,
	depth: number,
	rise: number,
	slopes: boolean
): THREE.BufferGeometry {
	const hw = width / 2;
	const hd = depth / 2;
	const positions: number[] = [];
	const normals: number[] = [];
	const triangle = (a: Vec3, b: Vec3, c: Vec3, n: Vec3) => {
		positions.push(...a, ...b, ...c);
		normals.push(...n, ...n, ...n);
	};
	triangle([hw, 0, hd], [hw, 0, -hd], [hw, rise, 0], [1, 0, 0]);
	triangle([-hw, 0, -hd], [-hw, 0, hd], [-hw, rise, 0], [-1, 0, 0]);
	if (slopes) {
		const front = new THREE.Vector3(0, hd, rise).normalize().toArray() as Vec3;
		const back = new THREE.Vector3(0, hd, -rise).normalize().toArray() as Vec3;
		triangle([-hw, 0, hd], [hw, 0, hd], [hw, rise, 0], front);
		triangle([-hw, 0, hd], [hw, rise, 0], [-hw, rise, 0], front);
		triangle([hw, 0, -hd], [-hw, 0, -hd], [-hw, rise, 0], back);
		triangle([hw, 0, -hd], [-hw, rise, 0], [hw, rise, 0], back);
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	return geometry;
}

/** Polyline with arc-length sampling. */
export class PolyPath {
	readonly points: THREE.Vector3[];
	private readonly cumulative: number[];

	constructor(points: Vec3[]) {
		this.points = points.map(v3);
		this.cumulative = [0];
		for (let i = 1; i < this.points.length; i++) {
			this.cumulative.push(this.cumulative[i - 1] + this.points[i - 1].distanceTo(this.points[i]));
		}
	}

	get length() {
		return this.cumulative[this.cumulative.length - 1] ?? 0;
	}

	/** Position and unit tangent `s` meters along the path. */
	sample(s: number, position: THREE.Vector3, tangent: THREE.Vector3) {
		const distance = Math.min(Math.max(0, s), this.length);
		let low = 0;
		let high = this.cumulative.length - 1;
		while (high - low > 1) {
			const mid = (low + high) >> 1;
			if (this.cumulative[mid] <= distance) low = mid;
			else high = mid;
		}
		const a = this.points[low];
		const b = this.points[high];
		const segment = Math.max(1e-5, this.cumulative[high] - this.cumulative[low]);
		position.lerpVectors(a, b, (distance - this.cumulative[low]) / segment);
		tangent.subVectors(b, a).normalize();
	}
}

// Procedurally drawn textures for the 3D energy scene (no image assets) — port
// of EnergySceneTextures.swift: all-black PV cells, terracotta tiles,
// standing-seam metal, pavers, slat fence, grass, light probes and the halo
// sprite used for glows. Deterministic (seeded) so every load looks the same.
import * as THREE from 'three';
import { SeededRandom } from './sky';

const rgb = (r: number, g: number, b: number, a = 1) =>
	`rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;

function canvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
	const element = document.createElement('canvas');
	element.width = width;
	element.height = height;
	const ctx = element.getContext('2d');
	if (ctx) draw(ctx);
	return element;
}

function texture(element: HTMLCanvasElement, repeat = false) {
	const tex = new THREE.CanvasTexture(element);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 8;
	if (repeat) {
		tex.wrapS = THREE.RepeatWrapping;
		tex.wrapT = THREE.RepeatWrapping;
	}
	return tex;
}

/** All-black monocrystalline module: 6 × 10 near-black cells with faint fingers. */
export const blackModule = () =>
	texture(
		canvas(360, 560, (ctx) => {
			ctx.fillStyle = rgb(0.05, 0.055, 0.065);
			ctx.fillRect(0, 0, 360, 560);
			const columns = 6;
			const rows = 10;
			const gap = 3;
			const border = 7;
			const cellW = (360 - 2 * border - (columns - 1) * gap) / columns;
			const cellH = (560 - 2 * border - (rows - 1) * gap) / rows;
			const rng = new SeededRandom(5);
			for (let row = 0; row < rows; row++) {
				for (let column = 0; column < columns; column++) {
					const x = border + column * (cellW + gap);
					const y = border + row * (cellH + gap);
					const shade = 0.022 + 0.012 * rng.next();
					ctx.fillStyle = rgb(shade, shade * 1.05, shade * 1.3);
					ctx.fillRect(x, y, cellW, cellH);
					ctx.fillStyle = rgb(0.12, 0.12, 0.14, 0.35);
					for (let finger = 1; finger < 4; finger++) {
						ctx.fillRect(x + (cellW * finger) / 4, y, 1, cellH);
					}
				}
			}
		})
	);

/** Terracotta tiles (tileable 8 × 8): per-tile variation, shaded lower lip, dark joints. */
export const terracotta = () =>
	texture(
		canvas(512, 512, (ctx) => {
			ctx.fillStyle = rgb(0.42, 0.17, 0.08);
			ctx.fillRect(0, 0, 512, 512);
			const rng = new SeededRandom(17);
			const tile = 64;
			for (let row = 0; row < 8; row++) {
				for (let column = 0; column < 8; column++) {
					const v = 0.92 + 0.12 * rng.next();
					const x = column * tile + 1.5;
					const y = row * tile + 1.5;
					const w = tile - 3;
					ctx.fillStyle = rgb(0.86 * v, 0.4 * v, 0.2 * v);
					ctx.fillRect(x, y, w, w);
					ctx.fillStyle = rgb(0.62 * v, 0.27 * v, 0.13 * v);
					ctx.fillRect(x, y + w * 0.78, w, w * 0.22);
					ctx.fillStyle = rgb(0.95 * v, 0.5 * v, 0.27 * v, 0.6);
					ctx.fillRect(x + w * 0.18, y + w * 0.05, w * 0.1, w * 0.65);
				}
			}
		}),
		true
	);

/** Anthracite standing seam (tileable): seams every 64 px. */
export const standingSeam = () =>
	texture(
		canvas(256, 256, (ctx) => {
			ctx.fillStyle = rgb(0.25, 0.26, 0.28);
			ctx.fillRect(0, 0, 256, 256);
			for (let seam = 0; seam < 256; seam += 64) {
				ctx.fillStyle = rgb(0.36, 0.37, 0.39);
				ctx.fillRect(seam, 0, 4, 256);
				ctx.fillStyle = rgb(0.17, 0.18, 0.19);
				ctx.fillRect(seam + 4, 0, 3, 256);
			}
		}),
		true
	);

/** Light grey concrete pavers in running bond (tileable). */
export const pavers = () =>
	texture(
		canvas(512, 512, (ctx) => {
			ctx.fillStyle = rgb(0.5, 0.5, 0.49);
			ctx.fillRect(0, 0, 512, 512);
			const rng = new SeededRandom(29);
			const stoneH = 64;
			const stoneW = 128;
			for (let row = 0; row < 8; row++) {
				const offset = row % 2 === 0 ? 0 : stoneW / 2;
				for (let column = -1; column < 4; column++) {
					const v = 0.72 + 0.08 * rng.next();
					ctx.fillStyle = rgb(v, v, v * 0.98);
					ctx.fillRect(column * stoneW + offset + 2, row * stoneH + 2, stoneW - 4, stoneH - 4);
				}
			}
		}),
		true
	);

/** Anthracite horizontal-slat fence panel. */
export const fenceSlats = () =>
	texture(
		canvas(256, 128, (ctx) => {
			ctx.fillStyle = rgb(0.08, 0.085, 0.09);
			ctx.fillRect(0, 0, 256, 128);
			const pitch = 16;
			for (let slat = 0; slat < 8; slat++) {
				ctx.fillStyle = rgb(0.25, 0.26, 0.28);
				ctx.fillRect(0, slat * pitch + 2, 256, pitch - 4);
				ctx.fillStyle = rgb(0.33, 0.34, 0.36);
				ctx.fillRect(0, slat * pitch + pitch - 5, 256, 2);
			}
		})
	);

/** Lawn: mid green with dense speckles and mowing stripes. */
export const grass = () =>
	texture(
		canvas(1024, 1024, (ctx) => {
			ctx.fillStyle = rgb(0.25, 0.4, 0.19);
			ctx.fillRect(0, 0, 1024, 1024);
			ctx.fillStyle = rgb(0.29, 0.45, 0.21, 0.35);
			for (let stripe = 0; stripe < 16; stripe += 2) ctx.fillRect(stripe * 64, 0, 64, 1024);
			const rng = new SeededRandom(23);
			for (let i = 0; i < 14_000; i++) {
				const x = rng.next() * 1024;
				const y = rng.next() * 1024;
				ctx.fillStyle =
					rng.next() > 0.5 ? rgb(0.36, 0.53, 0.24, 0.55) : rgb(0.16, 0.29, 0.13, 0.55);
				ctx.beginPath();
				ctx.arc(x + 1.1, y + 1.1, 1.1, 0, Math.PI * 2);
				ctx.fill();
			}
		})
	);

/**
 * Equirectangular light probe: sky gradient above, ground bounce below. Web:
 * the day sky greys with cloud cover (iOS blends toward its night probe).
 */
export function environment(night: boolean, clouds = 0): THREE.Texture {
	const mix = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] - v) * clouds);
	const zenith = mix([0.27, 0.5, 0.88], [0.6, 0.62, 0.66]);
	const horizon = mix([0.78, 0.87, 0.97], [0.78, 0.79, 0.81]);
	const stops = night
		? [rgb(0.03, 0.05, 0.13), rgb(0.09, 0.11, 0.22), rgb(0.03, 0.04, 0.05), rgb(0.01, 0.015, 0.02)]
		: [
				rgb(zenith[0], zenith[1], zenith[2]),
				rgb(horizon[0], horizon[1], horizon[2]),
				rgb(0.36, 0.44, 0.3),
				rgb(0.2, 0.27, 0.16)
			];
	const tex = texture(
		canvas(512, 256, (ctx) => {
			const gradient = ctx.createLinearGradient(0, 0, 0, 256);
			gradient.addColorStop(0, stops[0]);
			gradient.addColorStop(0.5, stops[1]);
			gradient.addColorStop(0.5, stops[2]);
			gradient.addColorStop(1, stops[3]);
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, 512, 256);
		})
	);
	tex.mapping = THREE.EquirectangularReflectionMapping;
	return tex;
}

/** Soft radial dot for additive glow sprites (the web's stand-in for bloom). */
export const halo = () => {
	const tex = new THREE.CanvasTexture(
		canvas(128, 128, (ctx) => {
			const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
			gradient.addColorStop(0, 'rgba(255,255,255,1)');
			gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
			gradient.addColorStop(1, 'rgba(255,255,255,0)');
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, 128, 128);
		})
	);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
};

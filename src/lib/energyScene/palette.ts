// Flow colours of the 3D energy scene (iOS `EnergyScene.Palette`) — per
// source, so the car's cable shows what it charges from.
import * as THREE from 'three';
import type { CarSource } from './model';

const srgb = (r: number, g: number, b: number) =>
	new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

export const palette = {
	solar: srgb(1, 0.74, 0.16),
	battery: srgb(0.13, 0.83, 0.93),
	export: srgb(0.18, 0.85, 0.62),
	gridImport: srgb(0.96, 0.25, 0.37),
	mixed: srgb(0.62, 0.65, 1)
};

export const carColor = (source: CarSource) =>
	source === 'solar'
		? palette.solar
		: source === 'battery'
			? palette.battery
			: source === 'grid'
				? palette.gridImport
				: palette.mixed;

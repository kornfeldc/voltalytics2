// three.js port of the iOS RealityKit energy scene (FEATURES.md #3,
// EnergyScene.swift): procedural model of the user's property with live power
// flows as glowing pulses along conduits, lawn cables, the overhead line and
// the charging cable into the gateway on the façade. Sun, sky light and
// surfaces (wet, snow) follow time of day and the live weather. Builders live
// in property.ts and cars.ts. Loaded lazily (dynamic import) by EnergyHero.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
	dayAmount,
	lensFrame,
	sameFlowState,
	sunDirection,
	warmth,
	type CameraRig,
	type Daylight,
	type EnergyFlowState
} from './model';
import type { Vec3 } from './lot';
import { cloudiness, hasSnowCover, isRaining, type CurrentWeather } from './weather';
import { PolyPath, rotation, v3 } from './geometry';
import { carColor, palette } from './palette';
import { buildDecorations, type Decorations } from './decorations';
import type { Season } from './season';
import { skyPalette } from './sky';
import * as textures from './textures';
import {
	buildBattery,
	buildCarport,
	buildFlows,
	buildGridLine,
	buildGrounds,
	buildHouse
} from './property';
import { buildCar, buildSecondCar } from './cars';

export type Flow = 'solar' | 'carportSolar' | 'battery' | 'grid' | 'car';

export interface PbrOptions {
	roughness: number;
	metallic?: number;
	clearcoat?: number;
	map?: THREE.Texture;
	tiling?: [number, number];
	doubleSided?: boolean;
}

interface WeatherSurface {
	mesh: THREE.Mesh;
	dry: THREE.Material;
	wet?: THREE.Material;
	snowy?: THREE.Material;
}

type SurfaceState = 'dry' | 'wet' | 'snowy';

export class EnergyScene {
	readonly renderer: THREE.WebGLRenderer;
	readonly scene = new THREE.Scene();
	readonly root = new THREE.Group();
	readonly camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2600);
	/**
	 * Far ground fades into the sky's horizon colour. iOS draws this haze as a 2D
	 * band over the scene; a band crosses the roof when the house reaches the
	 * horizon (wide stacked heroes), fog never touches the property.
	 */
	readonly fog = new THREE.Fog(0xffffff, 120, 1200);
	readonly sun = new THREE.DirectionalLight(0xffffff, 3);

	// filled by the builders
	tracks = new Map<Flow, FlowTrack>();
	laneEntities = new Map<Flow, THREE.Object3D[]>();
	windowPanes: THREE.Mesh[] = [];
	windowLights: THREE.PointLight[] = [];
	nightLamps: THREE.PointLight[] = [];
	nightBulbs: THREE.Object3D[] = [];
	readonly batteryGroup = new THREE.Group();
	batteryLeds: THREE.Mesh[] = [];
	readonly carGroup = new THREE.Group();
	carLights: THREE.Object3D[] = [];
	wallboxLed?: THREE.Mesh;
	private weatherSurfaces: WeatherSurface[] = [];

	readonly textures = {
		blackModule: textures.blackModule(),
		terracotta: textures.terracotta(),
		standingSeam: textures.standingSeam(),
		pavers: textures.pavers(),
		fenceSlats: textures.fenceSlats(),
		grass: textures.grass(),
		halo: textures.halo()
	};

	private readonly unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 18);
	private readonly pmrem: THREE.PMREMGenerator;
	private envDay: THREE.Texture;
	private envDayClouds = 0;
	private readonly envNight: THREE.Texture;
	private appliedRig?: CameraRig;
	private appliedRigKey = '';
	private appliedDaylight?: Daylight;
	private appliedState?: EnergyFlowState;
	private appliedWeather?: CurrentWeather;
	private appliedSurface: SurfaceState = 'dry';
	private paused = false;
	/** Holiday decorations (FEATURES.md #4) + the clock and night level they animate with. */
	private decorations?: Decorations;
	private appliedSeason: Season | null = null;
	private clock = 0;
	private night = 0;

	constructor(canvas: HTMLCanvasElement) {
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
			powerPreference: 'high-performance'
		});
		this.renderer.setClearColor(0x000000, 0);
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.toneMapping = THREE.NeutralToneMapping;
		this.renderer.toneMappingExposure = 1;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
		// the property is static: re-render shadows only when light/scene change
		this.renderer.shadowMap.autoUpdate = false;

		this.pmrem = new THREE.PMREMGenerator(this.renderer);
		this.envDay = this.pmrem.fromEquirectangular(textures.environment(false)).texture;
		this.envNight = this.pmrem.fromEquirectangular(textures.environment(true)).texture;

		this.scene.add(this.root);
		this.scene.environment = this.envDay;
		this.scene.fog = this.fog;
		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(2048, 2048);
		Object.assign(this.sun.shadow.camera, {
			left: -34,
			right: 34,
			top: 34,
			bottom: -34,
			near: 1,
			far: 160
		});
		this.sun.shadow.bias = -0.0004;
		this.sun.shadow.normalBias = 0.03;
		this.sun.target.position.set(3, 0, 0);
		this.root.add(this.sun, this.sun.target);
	}

	build() {
		buildGrounds(this);
		buildHouse(this);
		buildCarport(this);
		buildBattery(this);
		buildCar(this);
		buildSecondCar(this);
		buildGridLine(this);
		buildFlows(this);
		this.root.add(this.batteryGroup, this.carGroup);
		this.root.traverse((object) => {
			if (object instanceof THREE.Mesh && object.userData.noShadow !== true) {
				object.castShadow = true;
				object.receiveShadow = true;
			}
		});
	}

	setPaused(paused: boolean) {
		this.paused = paused;
	}

	/** Canvas size (CSS px) and pixel ratio; the projection follows the rig in `apply`. */
	resize(size: { width: number; height: number }, pixelRatio: number) {
		this.renderer.setPixelRatio(pixelRatio);
		this.renderer.setSize(size.width, size.height, false);
	}

	apply(
		state: EnergyFlowState,
		daylight: Daylight,
		weather: CurrentWeather | undefined,
		rig: CameraRig
	) {
		const rigKey = JSON.stringify(rig);
		if (rigKey !== this.appliedRigKey) {
			this.appliedRigKey = rigKey;
			this.appliedRig = rig;
			// lens shift: a symmetric frustum around the optical axis, the view a window into it
			const lens = lensFrame(rig);
			this.camera.fov = lens.verticalFov;
			this.camera.aspect = lens.fullWidth / lens.fullHeight;
			this.camera.setViewOffset(
				lens.fullWidth,
				lens.fullHeight,
				lens.offsetX,
				lens.offsetY,
				rig.viewSize.width,
				rig.viewSize.height
			);
			this.camera.position.set(...rig.position);
			this.camera.lookAt(v3(rig.target));
			this.camera.updateProjectionMatrix();
		}
		const daylightChanged = JSON.stringify(daylight) !== JSON.stringify(this.appliedDaylight);
		const weatherChanged = JSON.stringify(weather) !== JSON.stringify(this.appliedWeather);
		if (daylightChanged || weatherChanged || !sameFlowState(this.appliedState, state)) {
			this.appliedDaylight = daylight;
			this.appliedWeather = weather;
			this.appliedState = state;
			this.applyDaylight(daylight, state, weather);
			this.applyFlows(state);
			this.applySurfaces(surfaceState(weather));
			this.renderer.shadowMap.needsUpdate = true;
		}
	}

	/** Per-frame pulse + decoration animation. */
	tick(dt: number) {
		if (this.paused) return;
		const step = Math.min(dt, 0.1);
		for (const track of this.tracks.values()) track.tick(step);
		this.clock += step;
		this.decorations?.tick(this.clock, step);
	}

	/** Builds (or removes) the holiday decorations when the season changes. */
	setSeason(season: Season | null) {
		if (season === this.appliedSeason) return;
		this.appliedSeason = season;
		this.decorations?.dispose();
		this.decorations = undefined;
		if (season) {
			this.decorations = buildDecorations(this, season);
			this.root.add(this.decorations.group);
			this.decorations.setNight(this.night);
		}
		this.renderer.shadowMap.needsUpdate = true;
	}

	render() {
		this.renderer.render(this.scene, this.camera);
	}

	dispose() {
		const materials = new Set<THREE.Material>();
		this.root.traverse((object) => {
			if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
				object.geometry.dispose();
				(Array.isArray(object.material) ? object.material : [object.material]).forEach((m) =>
					materials.add(m)
				);
			}
		});
		for (const surface of this.weatherSurfaces) {
			[surface.dry, surface.wet, surface.snowy].forEach((m) => m && materials.add(m));
		}
		for (const material of materials) {
			// tiled textures are per-material clones of the shared canvases
			(material as THREE.MeshStandardMaterial).map?.dispose();
			material.dispose();
		}
		Object.values(this.textures).forEach((t) => t.dispose());
		this.envDay.dispose();
		this.envNight.dispose();
		this.pmrem.dispose();
		this.renderer.dispose();
		this.renderer.forceContextLoss();
	}

	// MARK: daylight + weather

	private applyDaylight(
		daylight: Daylight,
		state: EnergyFlowState,
		weather: CurrentWeather | undefined
	) {
		const day = dayAmount(daylight);
		const clouds = cloudiness(weather);
		const target = this.sun.target.position;
		if (day > 0.02) {
			// real azimuth, elevation clamped so low sun still draws shadows;
			// clouds dim the direct light (softer shadows against the sky light)
			const dir = sunDirection({ ...daylight, elevation: Math.max(daylight.elevation, 9) });
			this.sun.position.set(target.x + dir[0] * 70, dir[1] * 70, target.z + dir[2] * 70);
			const warm = warmth(daylight) * (1 - clouds);
			this.sun.color.setRGB(1, 1 - 0.2 * warm, 1 - 0.42 * warm, THREE.SRGBColorSpace);
			this.sun.intensity = (0.85 + 4.6 * day) * (1 - 0.78 * clouds);
		} else {
			// moonlight from the upper left (hidden by clouds)
			this.sun.position.set(target.x - 30, 50, target.z + 34);
			this.sun.color.setRGB(0.62, 0.72, 1, THREE.SRGBColorSpace);
			this.sun.intensity = 0.35 * (1 - 0.7 * clouds);
		}
		// overcast skies light grey, not blue (iOS blends toward its night probe)
		if (Math.abs(clouds - this.envDayClouds) > 0.1) {
			this.envDay.dispose();
			this.envDay = this.pmrem.fromEquirectangular(textures.environment(false, clouds)).texture;
			this.envDayClouds = clouds;
		}
		this.scene.environment = day > 0.4 ? this.envDay : this.envNight;
		const horizon = skyPalette(daylight, weather).horizon;
		this.fog.color.setRGB(horizon[0], horizon[1], horizon[2], THREE.SRGBColorSpace);
		this.scene.environmentIntensity =
			(day > 0.4 ? 0.5 + 0.9 * day : 0.5 + 0.6 * day) * (1 - 0.25 * clouds);

		// interior + outdoor lights after dusk; windows brighter with more usage
		const night = 1 - day;
		const usage = Math.min(state.homeKw, 6) / 6;
		for (const pane of this.windowPanes) {
			const material = pane.material as THREE.MeshPhysicalMaterial;
			material.emissive.setRGB(1, 0.74, 0.42, THREE.SRGBColorSpace);
			material.emissiveIntensity = night * (1.0 + 1.5 * usage);
		}
		for (const light of this.windowLights) light.intensity = night * (1.5 + 2 * usage);
		for (const lamp of this.nightLamps) lamp.intensity = night * 7;
		for (const bulb of this.nightBulbs) bulb.visible = night > 0.3;
		for (const light of this.carLights) light.visible = night > 0.4;
		this.night = night;
		this.decorations?.setNight(night);
	}

	private applySurfaces(next: SurfaceState) {
		if (next === this.appliedSurface) return;
		this.appliedSurface = next;
		for (const surface of this.weatherSurfaces) {
			surface.mesh.material =
				next === 'wet'
					? (surface.wet ?? surface.dry)
					: next === 'snowy'
						? (surface.snowy ?? surface.wet ?? surface.dry)
						: surface.dry;
		}
	}

	/** Registers a surface for wet (darker, glossy) and snow (white) variants. */
	registerWeatherSurface(mesh: THREE.Mesh, options: { wet?: boolean; snow?: boolean } = {}) {
		const dry = mesh.material as THREE.MeshStandardMaterial;
		let wet: THREE.Material | undefined;
		if (options.wet !== false) {
			// darker + glossy with a clear coat (iOS scales the tint by 0.62)
			wet = new THREE.MeshPhysicalMaterial({
				color: dry.color.clone().multiplyScalar(0.62),
				map: dry.map,
				metalness: dry.metalness,
				roughness: 0.16,
				clearcoat: 0.8,
				clearcoatRoughness: 0.04,
				side: dry.side
			});
		}
		let snowy: THREE.Material | undefined;
		if (options.snow !== false) {
			snowy = this.pbr(0.93, 0.95, 0.98, {
				roughness: 0.85,
				doubleSided: dry.side === THREE.DoubleSide
			});
		}
		this.weatherSurfaces.push({ mesh, dry, wet, snowy });
	}

	// MARK: flows

	private applyFlows(state: EnergyFlowState) {
		// the two PV arrays share production by module count (40 roof / 10 carport)
		this.configure('solar', state.solarKw * 0.8, true, palette.solar, state);
		this.configure('carportSolar', state.solarKw * 0.2, true, palette.solar, state);
		this.configure(
			'battery',
			Math.abs(state.batteryKw),
			state.batteryKw > 0,
			palette.battery,
			state
		);
		this.configure(
			'grid',
			Math.abs(state.gridKw),
			state.gridKw > 0,
			state.gridKw > 0 ? palette.export : palette.gridImport,
			state
		);
		this.configure('car', state.carKw, true, carColor(state.carSource), state);

		this.batteryGroup.visible = state.showsBattery;
		this.laneEntities.get('battery')?.forEach((e) => (e.visible = state.showsBattery));
		this.carGroup.visible = state.showsCar;
		this.laneEntities.get('car')?.forEach((e) => (e.visible = state.showsCar));

		// battery state-of-charge LEDs (5 segments)
		const lit = Math.ceil((state.batterySoc ?? 0) / 20);
		this.batteryLeds.forEach((led, index) => {
			const material = led.material as THREE.MeshStandardMaterial;
			const on = index < lit;
			material.color.setRGB(on ? 0 : 0.2, on ? 0 : 0.22, on ? 0 : 0.24, THREE.SRGBColorSpace);
			material.emissive.copy(on ? palette.battery : new THREE.Color(0));
			material.emissiveIntensity = Math.abs(state.batteryKw) > 0.01 ? 2 : 1.2;
			const glow = led.userData.halo as THREE.Sprite | undefined;
			if (glow) glow.visible = on;
		});
		if (this.wallboxLed) {
			const material = this.wallboxLed.material as THREE.MeshStandardMaterial;
			const charging = state.carKw > 0.01;
			const color = charging
				? carColor(state.carSource)
				: new THREE.Color().setRGB(0.3, 0.85, 0.5, THREE.SRGBColorSpace);
			material.emissive.copy(color);
			material.emissiveIntensity = charging ? 2.5 : 0.8;
			const glow = this.wallboxLed.userData.halo as THREE.Sprite | undefined;
			glow?.material.color.copy(color);
		}
	}

	private configure(
		flow: Flow,
		kw: number,
		forward: boolean,
		color: THREE.Color,
		state: EnergyFlowState
	) {
		const visible =
			flow === 'battery' ? state.showsBattery : flow === 'car' ? state.showsCar : true;
		this.tracks.get(flow)?.configure(visible ? kw : 0, forward, color);
	}

	/** Pulse pool per route (pulses ride just above conduits and lanes). */
	addTrack(flow: Flow, points: Vec3[], pool: number) {
		const geometry = new RoundedBoxGeometry(0.11, 0.11, 0.5, 2, 0.05);
		const pulses = Array.from({ length: pool }, () => {
			const mesh = new THREE.Mesh(geometry, this.glow(palette.solar, 2.2));
			mesh.userData.noShadow = true;
			const halo = this.halo(palette.solar, 1.1, 0.55);
			mesh.add(halo);
			this.root.add(mesh);
			return mesh;
		});
		this.tracks.set(flow, new FlowTrack(new PolyPath(points), pulses));
	}

	drawConduit(points: Vec3[], flow: Flow, radius = 0.026) {
		const material = this.pbr(0.62, 0.63, 0.66, { roughness: 0.4, metallic: 0.3 });
		for (let i = 1; i < points.length; i++) {
			this.lane(flow).push(this.rod(points[i - 1], points[i], radius, material));
		}
	}

	/** Flat cable slot in the lawn / pavers. */
	drawLane(points: Vec3[], flow: Flow) {
		const material = this.pbr(0.13, 0.14, 0.15, { roughness: 0.7 });
		for (let i = 1; i < points.length; i++) {
			const a = v3(points[i - 1]);
			const b = v3(points[i]);
			const mesh = new THREE.Mesh(
				new THREE.BoxGeometry(0.1, 0.012, a.distanceTo(b) + 0.1),
				material
			);
			mesh.position
				.addVectors(a, b)
				.multiplyScalar(0.5)
				.add(new THREE.Vector3(0, -0.04, 0));
			mesh.quaternion.copy(
				rotation(new THREE.Vector3(0, 0, 1), new THREE.Vector3().subVectors(b, a).normalize())
			);
			mesh.userData.noShadow = true;
			this.root.add(mesh);
			this.lane(flow).push(mesh);
		}
	}

	private lane(flow: Flow) {
		let list = this.laneEntities.get(flow);
		if (!list) {
			list = [];
			this.laneEntities.set(flow, list);
		}
		return list;
	}

	// MARK: geometry helpers

	box(
		size: Vec3,
		position: Vec3,
		material: THREE.Material,
		radius = 0,
		parent: THREE.Object3D = this.root
	) {
		const r = Math.min(radius, Math.min(...size) / 2 - 1e-4);
		const geometry =
			r > 0.001
				? new RoundedBoxGeometry(size[0], size[1], size[2], 2, r)
				: new THREE.BoxGeometry(size[0], size[1], size[2]);
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(...position);
		parent.add(mesh);
		return mesh;
	}

	/** Cylinder between two points (shared unit geometry, scaled). */
	rod(
		from: Vec3,
		to: Vec3,
		radius: number,
		material: THREE.Material,
		parent: THREE.Object3D = this.root
	) {
		const a = v3(from);
		const b = v3(to);
		const delta = new THREE.Vector3().subVectors(b, a);
		const length = Math.max(delta.length(), 0.001);
		const mesh = new THREE.Mesh(this.unitCylinder, material);
		mesh.position.addVectors(a, b).multiplyScalar(0.5);
		mesh.quaternion.copy(rotation(new THREE.Vector3(0, 1, 0), delta.divideScalar(length)));
		mesh.scale.set(radius, length, radius);
		parent.add(mesh);
		return mesh;
	}

	sphere(radius: number, position: Vec3, material: THREE.Material) {
		const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 22, 16), material);
		mesh.position.set(...position);
		this.root.add(mesh);
		return mesh;
	}

	/** Horizontal plane facing +y (RealityKit `generatePlane(width:depth:)`). */
	plane(
		width: number,
		depth: number,
		material: THREE.Material,
		parent: THREE.Object3D = this.root
	) {
		const mesh = new THREE.Mesh(
			new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2),
			material
		);
		parent.add(mesh);
		return mesh;
	}

	/** Additive glow sprite (the web's stand-in for RealityKit bloom). */
	halo(color: THREE.Color, size: number, opacity = 0.7) {
		const sprite = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: this.textures.halo,
				color,
				transparent: true,
				opacity,
				depthWrite: false,
				blending: THREE.AdditiveBlending
			})
		);
		sprite.scale.set(size, size, 1);
		sprite.userData.noShadow = true;
		return sprite;
	}

	/** Night-only light: emissive bulb + warm point light (off by day). */
	lamp(bulb: Vec3, light: Vec3, radius: number, bulbSize: Vec3) {
		const warm = new THREE.Color().setRGB(1, 0.78, 0.48, THREE.SRGBColorSpace);
		const bulbMesh = this.box(
			bulbSize,
			bulb,
			this.glow(warm, 2.5),
			Math.min(bulbSize[0], bulbSize[1]) / 2.5
		);
		bulbMesh.userData.noShadow = true;
		bulbMesh.add(this.halo(warm, Math.max(...bulbSize) * 3, 0.6));
		bulbMesh.visible = false;
		this.nightBulbs.push(bulbMesh);
		const point = new THREE.PointLight(warm, 0, radius, 2);
		point.position.set(...light);
		this.root.add(point);
		this.nightLamps.push(point);
	}

	// MARK: materials

	pbr(r: number, g: number, b: number, options: PbrOptions): THREE.MeshStandardMaterial {
		const parameters = {
			color: new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace),
			roughness: options.roughness,
			metalness: options.metallic ?? 0,
			side: options.doubleSided ? THREE.DoubleSide : THREE.FrontSide
		};
		const material =
			(options.clearcoat ?? 0) > 0
				? new THREE.MeshPhysicalMaterial({
						...parameters,
						clearcoat: options.clearcoat,
						clearcoatRoughness: 0.05
					})
				: new THREE.MeshStandardMaterial(parameters);
		if (options.map) {
			const map = options.tiling ? options.map.clone() : options.map;
			if (options.tiling) {
				map.repeat.set(options.tiling[0], options.tiling[1]);
				map.needsUpdate = true;
			}
			material.map = map;
		}
		return material;
	}

	/** Emissive material for self-lit parts. */
	glow(color: THREE.Color, intensity: number): THREE.MeshStandardMaterial {
		return new THREE.MeshStandardMaterial({
			color: 0x000000,
			roughness: 1,
			emissive: color,
			emissiveIntensity: intensity
		});
	}

	/** Window glass with the teal tint of the real windows (cloned per pane for the night glow). */
	glass() {
		return this.pbr(0.07, 0.15, 0.17, { roughness: 0.04, clearcoat: 1 });
	}
}

function surfaceState(weather: CurrentWeather | undefined): SurfaceState {
	if (!weather) return 'dry';
	if (hasSnowCover(weather)) return 'snowy';
	if (isRaining(weather) || weather.precipitation > 0.05) return 'wet';
	return 'dry';
}

/** Pulses travelling along one flow route. */
export class FlowTrack {
	private active = 0;
	private forward = true;
	private speed = 1.5;
	private spacing = 1;
	private travelled = 0;
	private readonly position = new THREE.Vector3();
	private readonly tangent = new THREE.Vector3();
	private readonly zAxis = new THREE.Vector3(0, 0, 1);

	constructor(
		readonly path: PolyPath,
		private readonly pulses: THREE.Mesh[]
	) {
		pulses.forEach((p) => (p.visible = false));
	}

	/** More power = denser and faster pulses (log-scaled so 0.3 kW and 9 kW both read well). */
	configure(kw: number, forward: boolean, color: THREE.Color) {
		const power = Math.max(0, kw);
		if (power < 0.02 || this.path.length <= 0) {
			this.active = 0;
			this.pulses.forEach((p) => (p.visible = false));
			return;
		}
		this.forward = forward;
		this.speed = 1.3 + 1.2 * Math.log2(1 + power);
		const desiredSpacing = Math.max(0.55, 2.4 - 0.3 * power);
		this.active = Math.min(
			this.pulses.length,
			Math.max(2, Math.floor(this.path.length / desiredSpacing))
		);
		this.spacing = this.path.length / this.active;
		this.pulses.forEach((pulse, index) => {
			pulse.visible = index < this.active;
			(pulse.material as THREE.MeshStandardMaterial).emissive.copy(color);
			const halo = pulse.children[0] as THREE.Sprite | undefined;
			halo?.material.color.copy(color);
		});
	}

	tick(dt: number) {
		if (this.active === 0) return;
		this.travelled = (this.travelled + this.speed * dt) % this.spacing;
		for (let index = 0; index < this.active; index++) {
			const distance = this.travelled + index * this.spacing;
			const s = this.forward ? distance : this.path.length - distance;
			this.path.sample(s, this.position, this.tangent);
			const pulse = this.pulses[index];
			pulse.position.copy(this.position);
			if (!this.forward) this.tangent.negate();
			pulse.quaternion.copy(rotation(this.zAxis, this.tangent));
			// shrink in/out at the route ends instead of popping
			const edge = Math.min(s, this.path.length - s);
			pulse.scale.setScalar(Math.max(0.05, Math.min(1, edge / 0.4)));
		}
	}
}

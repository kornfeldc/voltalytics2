<script lang="ts">
	// Dashboard hero (FEATURES.md #3) — port of iOS EnergyHeroView.swift: the 3D
	// model of the user's property (three.js, lazy-loaded) on a time-of-day +
	// live-weather sky, with value callouts, a live header and the current
	// conditions. Fills the whole viewport behind the dashboard (FEATURES.md #5):
	// `focus` is the part the cards and the TopBar leave free — the camera frames
	// the property into it (lens shift), callouts and header chips stay inside it.
	// Narrow focus areas (< 500 px) use single-line chips and move the header to
	// the bottom, so the roof and pole callouts keep the sky to themselves.
	import { onMount } from 'svelte';
	import moment from 'moment';
	import {
		BatteryMediumIcon,
		CarIcon,
		CloudDrizzleIcon,
		CloudFogIcon,
		CloudHailIcon,
		CloudIcon,
		CloudLightningIcon,
		CloudMoonIcon,
		CloudRainIcon,
		CloudSnowIcon,
		CloudSunIcon,
		HomeIcon,
		MoonIcon,
		SunIcon,
		ZapIcon
	} from 'lucide-svelte';
	import type { IInverterRealTimeData } from '$lib/classes/interver';
	import { Lot, type Vec3 } from '$lib/energyScene/lot';
	import {
		dayAmount,
		daylightAt,
		flowState,
		framing,
		project,
		type CarSource,
		type Rect
	} from '$lib/energyScene/model';
	import {
		drawHaze,
		drawSeasonSky,
		drawSky,
		drawWeatherEffects,
		hasAnimatedEffects,
		seasonSkyAnimates
	} from '$lib/energyScene/sky';
	import { activeSeason, seasonEmoji } from '$lib/energyScene/season';
	import {
		condition,
		conditionLabel,
		currentWeather,
		eisenstadt,
		resolvePlace,
		type CurrentWeather,
		type WeatherCondition,
		type WeatherPlace
	} from '$lib/energyScene/weather';
	import { liveCharging, sceneState } from '$lib/state/sceneState.svelte';
	import type { EnergyScene } from '$lib/energyScene/scene';

	interface Props {
		hasWallbox: boolean;
		/** Part of the hero not covered by the TopBar or the cards (hero px); default: all of it. */
		focus?: Rect;
	}

	let { hasWallbox, focus }: Props = $props();

	let width = $state(0);
	let height = $state(0);
	// header pill sizes (callouts keep clear of them)
	let liveWidth = $state(0);
	let liveHeight = $state(0);
	let weatherWidth = $state(0);
	let weatherHeight = $state(0);
	let container: HTMLDivElement;
	let skyCanvas: HTMLCanvasElement;
	let sceneCanvas: HTMLCanvasElement;
	let fxCanvas: HTMLCanvasElement;

	let realtime = $state.raw<IInverterRealTimeData | undefined>(undefined);
	let weather = $state.raw<CurrentWeather | undefined>(undefined);
	let place = $state.raw<WeatherPlace>(eisenstadt);
	let now = $state(new Date());
	let sceneReady = $state(false);
	let sceneVisible = $state(false);
	let onScreen = true;
	let scene: EnergyScene | undefined;

	const safe = $derived(
		focus ?? { x: 0, y: 0, width: Math.max(1, width), height: Math.max(1, height) }
	);
	const compact = $derived(safe.width < 500);
	const pixelRatio = () => Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2);
	const rig = $derived(framing({ width, height }, safe));
	const daylight = $derived(daylightAt(sceneDate(now), place.latitude, place.longitude));
	/** Dev-only `?qaSkyTime=5.6` freezes the holiday sky at that moment (screenshots). */
	const qaSkyTime =
		import.meta.env.DEV && typeof location !== 'undefined'
			? Number(new URLSearchParams(location.search).get('qaSkyTime') ?? NaN)
			: NaN;
	/** Holiday mode (FEATURES.md #4), re-evaluated with the scene clock. */
	const season = $derived(activeSeason(sceneDate(now)));
	const flows = $derived(
		flowState(realtime, { kw: liveCharging.kw, status: liveCharging.status }, hasWallbox)
	);
	const isDay = $derived(dayAmount(daylight) > 0.45);

	/** Dev-only `?qaHour=21.5` renders the scene at that local hour (iOS `-voltalytics-qa-hour`). */
	function sceneDate(date: Date): Date {
		if (import.meta.env.DEV && typeof location !== 'undefined') {
			const hour = Number(new URLSearchParams(location.search).get('qaHour') ?? NaN);
			if (Number.isFinite(hour)) return moment(date).startOf('day').add(hour, 'hours').toDate();
		}
		return date;
	}

	// MARK: data

	const loadRealtime = async () => {
		if (document.hidden) return;
		try {
			const response = await fetch('/api/inverter/realtime');
			if (!response.ok) return;
			const result = await response.json();
			if (result?.realTimeData) realtime = result.realTimeData;
		} catch {
			// keep the last values; the next poll retries
		}
	};

	const loadWeather = async () => {
		const current = await currentWeather(place);
		if (current) weather = current;
	};

	// address typed in Settings: resolve debounced (Nominatim allows 1 req/s)
	let firstAddress = true;
	$effect(() => {
		const address = sceneState.weatherAddress;
		const timer = setTimeout(
			async () => {
				const resolved = await resolvePlace(address.trim().length >= 3 ? address : '');
				if (
					resolved.latitude !== place.latitude ||
					resolved.longitude !== place.longitude ||
					resolved.name !== place.name
				) {
					place = resolved;
				}
				await loadWeather();
			},
			firstAddress ? 0 : 900
		);
		firstAddress = false;
		return () => clearTimeout(timer);
	});

	// MARK: drawing

	function sizeCanvas(canvas: HTMLCanvasElement | undefined) {
		if (!canvas) return undefined;
		const ratio = pixelRatio();
		const w = Math.round(width * ratio);
		const h = Math.round(height * ratio);
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		const ctx = canvas.getContext('2d');
		ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
		ctx?.clearRect(0, 0, width, height);
		return ctx ?? undefined;
	}

	function drawEffects(time: number) {
		const ctx = sizeCanvas(fxCanvas);
		if (!ctx) return;
		drawWeatherEffects(ctx, rig, daylight, weather, time);
		drawSeasonSky(ctx, rig, daylight, season, Number.isFinite(qaSkyTime) ? qaSkyTime : time);
	}

	$effect(() => {
		if (width <= 0 || height <= 0) return;
		const ctx = sizeCanvas(skyCanvas);
		if (ctx) {
			drawSky(ctx, rig, daylight, weather, season);
			// behind the scene (iOS draws it over): the 3D fog fades the far ground
			drawHaze(ctx, rig, daylight, weather);
		}
		drawEffects(performance.now() / 1000);
	});

	let sceneSize = '';
	function resizeScene(target: EnergyScene) {
		const ratio = pixelRatio();
		const key = `${width}x${height}@${ratio}`;
		if (key === sceneSize) return;
		sceneSize = key;
		target.resize({ width, height }, ratio);
	}

	$effect(() => {
		if (!sceneReady || !scene || width <= 0 || height <= 0) return;
		resizeScene(scene);
		scene.apply(flows, daylight, weather, rig);
		scene.setSeason(season);
	});

	// MARK: lifecycle

	onMount(() => {
		let frame = 0;
		let disposed = false;
		let last = performance.now();
		let lastRender = 0;

		const loop = (time: number) => {
			frame = requestAnimationFrame(loop);
			if (!onScreen || document.hidden) {
				last = time;
				return;
			}
			// ~60 fps is plenty for the pulses (120 Hz displays would double the GPU work)
			if (time - lastRender < 15) return;
			lastRender = time;
			const dt = (time - last) / 1000;
			last = time;
			if (scene && sceneReady) {
				scene.tick(dt);
				scene.render();
			}
			if (hasAnimatedEffects(weather) || seasonSkyAnimates(season, daylight))
				drawEffects(time / 1000);
		};
		frame = requestAnimationFrame(loop);

		// mount the 3D scene after the cards are on screen; fade it in on its first frames
		const mountTimer = setTimeout(async () => {
			try {
				const { EnergyScene } = await import('$lib/energyScene/scene');
				if (disposed) return;
				const created = new EnergyScene(sceneCanvas);
				created.build();
				resizeScene(created);
				created.apply(flows, daylight, weather, rig);
				created.setSeason(season);
				await created.renderer.compileAsync(created.scene, created.camera).catch(() => undefined);
				if (disposed) {
					created.dispose();
					return;
				}
				scene = created;
				sceneReady = true;
				requestAnimationFrame(() => requestAnimationFrame(() => (sceneVisible = true)));
			} catch (error) {
				// no WebGL: sky, callouts and header still work
				console.warn('energy scene unavailable', error);
			}
		}, 150);

		const observer = new IntersectionObserver(
			(entries) => {
				onScreen = entries.some((entry) => entry.isIntersecting);
				scene?.setPaused(!onScreen);
			},
			{ threshold: 0.02 }
		);
		observer.observe(container);

		loadRealtime();
		const realtimeTimer = setInterval(loadRealtime, 120 * 1000);
		const weatherTimer = setInterval(loadWeather, 600 * 1000);
		const clockTimer = setInterval(() => (now = new Date()), 60 * 1000);

		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			clearTimeout(mountTimer);
			clearInterval(realtimeTimer);
			clearInterval(weatherTimer);
			clearInterval(clockTimer);
			observer.disconnect();
			scene?.dispose();
			scene = undefined;
		};
	});

	// MARK: callouts

	interface Callout {
		id: string;
		anchor: Vec3;
		icon: typeof SunIcon;
		value: string;
		caption: string;
		color: string;
		active: boolean;
		hangsBelow: boolean;
		lineHeight: number;
		/** Battery: state of charge 0…1 — drawn as a battery pack filled to it. */
		level?: number;
	}

	const colors = {
		solar: 'rgb(255, 189, 41)',
		battery: 'rgb(33, 212, 237)',
		export: 'rgb(20, 184, 166)',
		gridImport: 'rgb(244, 63, 94)',
		mixed: 'rgb(158, 166, 255)',
		home: 'rgb(251, 146, 60)',
		inactive: 'rgb(148, 163, 184)'
	};

	const carColor = (source: CarSource) =>
		source === 'solar'
			? colors.solar
			: source === 'battery'
				? colors.battery
				: source === 'grid'
					? colors.gridImport
					: colors.mixed;

	const formatKw = (value: number) =>
		new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
			value
		) + ' kW';

	/** Roof and pole callouts rise into the sky; ground-level ones hang down onto lawn and pavers. */
	const callouts = $derived.by((): Callout[] => {
		if (!flows.hasData) return [];
		const items: Callout[] = [
			{
				id: 'solar',
				anchor: Lot.solarCallout,
				icon: SunIcon,
				value: formatKw(flows.solarKw),
				caption: 'Solar',
				color: colors.solar,
				active: flows.solarKw > 0.01,
				hangsBelow: false,
				lineHeight: 26
			},
			{
				id: 'home',
				anchor: Lot.homeCallout,
				icon: HomeIcon,
				value: formatKw(flows.homeKw),
				caption: 'Home',
				color: colors.home,
				active: flows.homeKw > 0.01,
				hangsBelow: true,
				lineHeight: 14
			},
			{
				id: 'grid',
				anchor: Lot.gridCallout,
				icon: ZapIcon,
				value: formatKw(Math.abs(flows.gridKw)),
				caption: flows.gridKw > 0.01 ? 'To grid' : flows.gridKw < -0.01 ? 'From grid' : 'Grid',
				color: flows.gridKw >= 0 ? colors.export : colors.gridImport,
				active: Math.abs(flows.gridKw) > 0.01,
				hangsBelow: false,
				lineHeight: 22
			}
		];
		if (flows.showsBattery) {
			items.push({
				id: 'battery',
				anchor: Lot.batteryCallout,
				icon: BatteryMediumIcon,
				value: flows.batterySoc != null ? `${Math.round(flows.batterySoc)} %` : '–',
				caption:
					flows.batteryKw > 0.01
						? `Charging ${formatKw(flows.batteryKw)}`
						: flows.batteryKw < -0.01
							? `Discharging ${formatKw(-flows.batteryKw)}`
							: 'Idle',
				color: colors.battery,
				active: Math.abs(flows.batteryKw) > 0.01,
				hangsBelow: true,
				lineHeight: 14,
				level:
					flows.batterySoc != null ? Math.min(1, Math.max(0, flows.batterySoc / 100)) : undefined
			});
		}
		if (flows.showsCar) {
			items.push({
				id: 'car',
				anchor: Lot.carCallout,
				icon: CarIcon,
				value: flows.carKw > 0.01 ? formatKw(flows.carKw) : '–',
				caption: flows.carKw > 0.01 ? 'Model Y charging' : 'Model Y',
				color: carColor(flows.carSource),
				active: flows.carKw > 0.01,
				hangsBelow: true,
				lineHeight: 16
			});
		}
		return items;
	});

	/** Header pills in hero px (the header row sits in the focus area, see the markup). */
	const pills = $derived.by((): Rect[] => {
		const rowHeight = Math.max(liveHeight, weather ? weatherHeight : 0);
		const top = compact ? safe.y + safe.height - 10 - rowHeight : safe.y + 8;
		return [
			{ x: safe.x + 16, y: top, width: liveWidth, height: liveHeight },
			...(weather
				? [
						{
							x: safe.x + safe.width - 16 - weatherWidth,
							y: top,
							width: weatherWidth,
							height: weatherHeight
						}
					]
				: [])
		];
	});

	/**
	 * Whether the chip hangs below its anchor, and its sideways shift (the leader
	 * stays on the anchor). Chips stay inside the safe area; a rising chip with a
	 * header pill in the way slides sideways a little, and hangs below only when
	 * that is not enough — the solar chip would cover the roof.
	 */
	const placement = (callout: Callout, point: { x: number; y: number }) => {
		const halfChip = compact ? 46 : 72;
		const chipHeight = compact ? 26 : 42;
		const shift =
			Math.max(0, safe.x + halfChip + 6 - point.x) -
			Math.max(0, point.x + halfChip + 6 - (safe.x + safe.width));
		// no room above (wide panes put the pole top near the edge): hang below
		if (callout.hangsBelow || point.y < safe.y + callout.lineHeight + 48) {
			return { below: true, shift };
		}
		const top = point.y + 3 - callout.lineHeight - chipHeight;
		const blocked = (slide: number) =>
			pills.some(
				(pill) =>
					point.x + slide - halfChip - 6 < pill.x + pill.width &&
					point.x + slide + halfChip + 6 > pill.x &&
					top - 6 < pill.y + pill.height &&
					top + chipHeight + 6 > pill.y
			);
		if (!blocked(shift)) return { below: false, shift };
		const slid = pills
			.flatMap((pill) => [
				pill.x + pill.width + 7 + halfChip - point.x,
				pill.x - 7 - halfChip - point.x
			])
			.filter(
				(slide) =>
					Math.abs(slide - shift) <= halfChip * 0.35 &&
					point.x + slide - halfChip >= safe.x + 5 &&
					point.x + slide + halfChip <= safe.x + safe.width - 5 &&
					!blocked(slide)
			)
			.sort((a, b) => Math.abs(a - shift) - Math.abs(b - shift));
		return slid.length > 0 ? { below: false, shift: slid[0] } : { below: true, shift };
	};

	const placed = $derived.by(() => {
		if (width <= 0 || height <= 0) return [];
		return callouts.flatMap((callout) => {
			const point = project(rig, callout.anchor);
			return point ? [{ callout, point, ...placement(callout, point) }] : [];
		});
	});

	// MARK: header

	const weatherIcon = (c: WeatherCondition, day: boolean) => {
		switch (c) {
			case 'clear':
				return day ? SunIcon : MoonIcon;
			case 'mainlyClear':
			case 'partlyCloudy':
				return day ? CloudSunIcon : CloudMoonIcon;
			case 'fog':
				return CloudFogIcon;
			case 'drizzle':
				return CloudDrizzleIcon;
			case 'rain':
			case 'showers':
				return CloudRainIcon;
			case 'freezingRain':
				return CloudHailIcon;
			case 'snow':
			case 'snowShowers':
				return CloudSnowIcon;
			case 'thunderstorm':
				return CloudLightningIcon;
			default:
				return CloudIcon;
		}
	};

	const liveTime = $derived(realtime?.timestamp ? moment(realtime.timestamp).format('HH:mm') : '');
</script>

<div
	class="hero"
	bind:this={container}
	bind:clientWidth={width}
	bind:clientHeight={height}
	data-scene-ready={sceneVisible}
	data-season={season ?? 'none'}
>
	<div class="layers">
		<canvas class="layer" bind:this={skyCanvas}></canvas>
		<canvas class="layer scene" class:visible={sceneVisible} bind:this={sceneCanvas}></canvas>
		<canvas class="layer" bind:this={fxCanvas}></canvas>
	</div>

	<div class="callouts" class:visible={sceneVisible}>
		{#each placed as { callout, point, below, shift } (callout.id)}
			{@const Icon = callout.icon}
			<div class="callout" class:below style:left="{point.x}px" style:top="{point.y}px">
				{#snippet chip()}
					<div class="chip" class:compact style:transform="translateX({shift}px)">
						<span class="chip-icon" style:color={callout.active ? callout.color : colors.inactive}>
							{#if callout.level != null}
								<!-- battery pack: four modules, filled to the state of charge -->
								<svg class="battery-pack" class:compact viewBox="0 0 18 30" aria-hidden="true">
									<rect x="6" y="0.5" width="6" height="3" rx="1" fill="rgba(255,255,255,0.85)" />
									<rect
										x="1.3"
										y="3.3"
										width="15.4"
										height="25.9"
										rx="3"
										fill="none"
										stroke="rgba(255,255,255,0.85)"
										stroke-width="1.6"
									/>
									<rect
										x="3.6"
										y={27 - 21.4 * callout.level}
										width="10.8"
										height={21.4 * callout.level}
										rx="1.4"
										fill={colors.battery}
									/>
									{#each [1, 2, 3] as seam (seam)}
										<line
											x1="3.6"
											x2="14.4"
											y1={5.6 + 5.35 * seam}
											y2={5.6 + 5.35 * seam}
											stroke="rgba(10,14,22,0.55)"
											stroke-width="0.9"
										/>
									{/each}
								</svg>
							{:else}
								<Icon size={compact ? 11 : 13} strokeWidth={2.6} />
							{/if}
						</span>
						<span class="chip-text">
							<span class="chip-value">{callout.value}</span>
							{#if !compact}<span class="chip-caption">{callout.caption}</span>{/if}
						</span>
					</div>
				{/snippet}
				{#snippet leader()}
					<div
						class="leader"
						style:background={callout.color}
						style:height="{compact ? callout.lineHeight * 0.6 : callout.lineHeight}px"
					></div>
				{/snippet}
				{#snippet dot()}
					<div
						class="dot"
						style:background={callout.color}
						style:box-shadow="0 0 6px {callout.color}"
					></div>
				{/snippet}
				{#if below}
					{@render dot()}{@render leader()}{@render chip()}
				{:else}
					{@render chip()}{@render leader()}{@render dot()}
				{/if}
			</div>
		{/each}
	</div>

	<div
		class="header"
		style:left="{safe.x}px"
		style:width="{safe.width}px"
		style:top={compact ? 'auto' : `${safe.y + 8}px`}
		style:bottom={compact ? `${height - safe.y - safe.height + 10}px` : 'auto'}
	>
		<div class="pill live" bind:clientWidth={liveWidth} bind:clientHeight={liveHeight}>
			<span class="live-dot" class:on={!!realtime}></span>
			<span class="live-label">Live</span>
			{#if liveTime}<span class="live-time">{liveTime}</span>{/if}
			{#if season}<span class="live-season">{seasonEmoji[season]}</span>{/if}
		</div>
		{#if weather}
			{@const c = condition(weather)}
			{@const WeatherIcon = weatherIcon(c, isDay)}
			<div class="pill weather" bind:clientWidth={weatherWidth} bind:clientHeight={weatherHeight}>
				<span class="weather-icon" class:sunny={isDay && (c === 'clear' || c === 'mainlyClear')}>
					<WeatherIcon size={20} />
				</span>
				<span class="weather-text">
					<span class="weather-temp">{Math.round(weather.temperature)}°</span>
					<span class="weather-caption">{conditionLabel[c]} · {place.name}</span>
				</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.hero {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		color: white;
	}

	.layers,
	.layer,
	.callouts {
		position: absolute;
		inset: 0;
	}

	.layer {
		width: 100%;
		height: 100%;
		display: block;
	}

	.scene {
		opacity: 0;
		transition: opacity 0.7s ease-out;
	}

	.callouts {
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.7s ease-out;
	}

	.scene.visible,
	.callouts.visible {
		opacity: 1;
	}

	.callout {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		/* the dot's centre sits on the anchor */
		transform: translate(-50%, calc(-100% + 3px));
	}

	.callout.below {
		transform: translate(-50%, -3px);
	}

	.chip,
	.pill {
		display: flex;
		align-items: center;
		white-space: nowrap;
		border-radius: 999px;
		background: rgba(10, 14, 22, 0.42);
		border: 1px solid rgba(255, 255, 255, 0.14);
		backdrop-filter: blur(14px) saturate(1.5);
		-webkit-backdrop-filter: blur(14px) saturate(1.5);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
	}

	.chip {
		gap: 6px;
		padding: 5px 10px;
	}

	.chip.compact {
		gap: 4px;
		padding: 4px 7px;
	}

	.chip-icon {
		display: flex;
	}

	.battery-pack {
		width: 18px;
		height: 30px;
	}

	.battery-pack.compact {
		width: 12px;
		height: 20px;
	}

	.chip-text {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
	}

	.chip-value,
	.weather-temp {
		font-family: ui-rounded, 'SF Pro Rounded', system-ui, sans-serif;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.chip-value {
		font-size: 14px;
	}

	.chip.compact .chip-value {
		font-size: 12px;
	}

	.chip-caption {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.72);
	}

	.leader {
		width: 1.5px;
		opacity: 0.9;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.header {
		position: absolute;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
		padding: 0 16px;
		pointer-events: none;
	}

	.live {
		gap: 6px;
		padding: 6px 12px;
		font-size: 14px;
	}

	.live-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: rgb(148, 163, 184);
	}

	.live-dot.on {
		background: rgb(20, 184, 166);
	}

	.live-label {
		font-weight: 600;
	}

	.live-season {
		font-size: 15px;
		line-height: 1;
	}

	.live-time {
		color: rgba(255, 255, 255, 0.75);
		font-variant-numeric: tabular-nums;
	}

	.weather {
		gap: 8px;
		padding: 4px 14px 4px 11px;
		min-width: 0;
	}

	.weather-icon {
		display: flex;
		color: rgba(255, 255, 255, 0.92);
	}

	.weather-icon.sunny {
		color: rgb(255, 196, 61);
	}

	.weather-text {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
		min-width: 0;
	}

	.weather-temp {
		font-size: 18px;
	}

	.weather-caption {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.75);
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>

import type { ChargingStatus } from '$lib/energyScene/model';

/**
 * Optional 3D house view on the dashboard (FEATURES.md #3). Per browser only:
 * the toggle and the weather address live in localStorage, never in the
 * Supabase `user` row (iOS keeps its own copy in UserDefaults).
 */
const enabledKey = 'voltalytics_sceneEnabled';
const addressKey = 'voltalytics_weatherAddress';

const stored = (key: string) => {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
	} catch {
		return null;
	}
};

export type SceneLayout = 'off' | 'stacked' | 'split';

export const sceneState = $state({
	/** "3D house view" switch in Settings — off until the user turns it on. */
	enabled: stored(enabledKey) === 'true',
	/** Address for weather + sun position; empty = Eisenstadt. */
	weatherAddress: stored(addressKey) ?? '',
	/** Set by the dashboard: the layout hides its TopBar in `split` and lifts the width limit. */
	layout: 'off' as SceneLayout,
	/** Stacked layout scrolled to the top: the TopBar floats transparent over the scene. */
	heroUnderBar: false,
	/** Measured TopBar height (the stacked hero extends under it). */
	topBarHeight: 56
});

// Settings binds the two per-browser values directly; persist every change.
if (typeof window !== 'undefined') {
	$effect.root(() => {
		$effect(() => {
			const enabled = String(sceneState.enabled);
			const address = sceneState.weatherAddress;
			try {
				localStorage.setItem(enabledKey, enabled);
				localStorage.setItem(addressKey, address);
			} catch {
				// private mode / storage full: the setting just doesn't survive a reload
			}
		});
	});
}

/** go-e status published by ChargingOverview for the scene's car flow (iOS: ChargingOverviewModel). */
export const liveCharging = $state({
	kw: 0,
	status: 'no_car' as ChargingStatus
});

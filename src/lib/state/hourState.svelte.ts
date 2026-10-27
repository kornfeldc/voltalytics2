import moment from 'moment';

/**
 * Start of the current hour (epoch ms). Price views key their fetch on it so
 * the current price and the highlighted hour never go stale - neither when the
 * app stays open across a full hour nor when a backgrounded PWA resumes.
 */
export const hourState = $state({ hour: moment().startOf('hour').valueOf() });

if (typeof window !== 'undefined') {
	const sync = () => {
		const hour = moment().startOf('hour').valueOf();
		if (hour !== hourState.hour) hourState.hour = hour;
	};
	setInterval(sync, 60 * 1000);
	document.addEventListener('visibilitychange', sync);
}

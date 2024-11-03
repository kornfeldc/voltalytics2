import moment from 'moment';

export class vConsole {
	static now(): string {
		return moment().format('HH:mm:ss');
	}
	static log(title: string, params?: any) {
		console.log(vConsole.now() + ' ' + title, params);
	}
}

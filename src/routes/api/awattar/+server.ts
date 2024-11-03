import { json } from '@sveltejs/kit';
import { AwattarApi } from '$lib/classes/awattar';
import { vConsole } from '$lib/classes/vconsole';

export async function GET({ url }) {
	const hours = parseInt(url.searchParams.get('hours') ?? '5');
	const offsetHours = parseInt(url.searchParams.get('offsetHours') ?? '1');
	vConsole.log('api call - awattar', url.href);
	const awattarEntries = await AwattarApi.getData({ hours, offsetHours });
	return json(awattarEntries);
}

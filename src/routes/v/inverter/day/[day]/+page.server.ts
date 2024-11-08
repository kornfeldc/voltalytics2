import { redirect } from '@sveltejs/kit';
import { Db } from '$lib/classes/db';

export async function load({ locals, params }) {
	return params;
}

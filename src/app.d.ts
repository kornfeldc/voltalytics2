import { DefaultSession } from '@auth/core/types';

declare const __APP_VERSION__: string;

declare module '@auth/core/types' {
	interface Session {
		userId: string;
		legacySync: boolean;
		user: DefaultSession['user'];
	}
}

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

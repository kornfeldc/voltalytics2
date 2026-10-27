// Vercel runs functions in UTC and reserves the TZ variable. All local-time logic
// (fixed-tariff hours, calculator target hour, morning auto-off) must use the same
// clock as the browser and the iOS app (FEATURES.md #2). Node applies a runtime
// TZ change to every later Date/moment call.
process.env.TZ = 'Europe/Vienna';

export { handle } from './auth';

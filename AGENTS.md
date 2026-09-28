# AGENTS.md — voltalytics2

Guidance for AI coding agents working in this repository.

## Project

PWA for home PV energy management ("Voltalytics"). It reads PV production/battery data from a solar inverter, monitors an aWATTar spot-price energy market, and controls a go-e Charger wallbox to charge an EV at the best time:

- **Excess charging**: charge with surplus solar power.
- **Force charging**: charge at high power when spot price is below a cent threshold.
- **Battery-target charging**: ensure the car reaches a target % by a target hour.

| Aspect | Value |
|---|---|
| Stack | SvelteKit 2, Svelte 5 (runes), TypeScript (strict), Vite 5, Tailwind 3 |
| UI kit | shadcn-svelte (new-york style, slate base), bits-ui, vaul-svelte, lucide-svelte, chart.js |
| Auth | Auth.js (`@auth/sveltekit`), Google provider only, configured in `src/auth.ts` |
| Database | Supabase (Postgres), table `user`, keyed by email, anon client (`VITE_SUPABASE_URL/KEY`) |
| Package manager | **pnpm** (pnpm-lock.yaml) |
| Time | `moment` everywhere |
| State | Svelte 5 runes modules in `src/lib/state/*.svelte.ts` |
| Version | `package.json` version is inlined as `__APP_VERSION__` via Vite `define` |
| Tests/CI | **None**. Verification = `pnpm run build` + manual/dev-server smoke test |

## Commands

```bash
pnpm install            # after dependency changes
pnpm run dev            # dev server (localhost:5173); requires .env
pnpm run build          # production build — the only fully green gate
pnpm run preview        # serve the build
pnpm run check          # svelte-check  ⚠ RED BASELINE: ~27 pre-existing errors, 10 warnings
pnpm run lint           # prettier --check && eslint  ⚠ RED BASELINE: prettier fails (91 files unformatted)
pnpm run format         # prettier --write .
```

Known broken-gate details (do not "fix" unrelated reds when touching other work; do not cite them as proof of your change):

- `pnpm run check`: 27 errors / 10 warnings pre-exist, e.g. implicit `any` snippet param in `src/routes/v/+layout.svelte`. Treat **zero new errors in files you touched** as the bar.
- `pnpm run lint`: `eslint.config.js` imports `@eslint/js`, which is **not in devDependencies** — eslint cannot even start (ERR_MODULE_NOT_FOUND). Prettier also flags 91 files. Running `pnpm run format` reformats the whole repo — **avoid**, it creates huge diffs.

Practical verification per change:

1. `pnpm run build` must succeed.
2. `npx svelte-check --tsconfig ./tsconfig.json` — error count must not increase; open files you touched must be clean.
3. `npx prettier --check <files you touched>` on those files only.
4. For behavior: run `pnpm run dev` and exercise the route/endpoint (needs real `.env`; see env section).

## Environment (`.env`, see `.env.example`)

- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_TRUST_HOST` — server-side, Auth.js.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` — anon key; **all `VITE_*` vars are client-exposed by design**. Per-user third-party credentials (Solarman/SolarEdge/go-e) live in the Supabase `user` row, not in env.
- `VITE_SOLARMAN_URL`, `VITE_SOLAREDGE_URL`, `VITE_GOE_URL`, `VITE_AWATTAR_API` — external API base URLs (aWATTar defaults to Austria `api.awattar.at`).
- Do not rename `AUTH_*`; Auth.js reads them. Never print or commit `.env`.

## Architecture

### Layers

```
src/
├── auth.ts                     # Auth.js SvelteKitAuth({ providers: [Google], trustHost: true }) → exports handle
├── hooks.server.ts             # re-exports handle from auth.ts
├── routes/
│   ├── +page.svelte            # public landing / login (redirect target for unauthenticated users)
│   ├── v/                      # authenticated app shell
│   │   ├── +layout.server.ts   # session check + Db.getUserSettings() (returns unawaited promise!)
│   │   ├── +layout.svelte      # TopBar, Settings drawer, pull-to-refresh, max-w-[800px]
│   │   ├── dashboard/          # main view
│   │   ├── awattar/            # price chart/list view
│   │   └── inverter/{day,month,year}/[param]  # production history (server +page.ts loaders)
│   └── api/                    # JSON endpoints, all follow the same auth+settings prologue
├── lib/
│   ├── classes/                # domain layer (see below)
│   ├── components/             # app components (awattar/, dashboard/, system/Settings, TopBar…)
│   ├── components/ui/          # shadcn-svelte generated components — DO NOT hand-edit
│   ├── state/                  # rune stores: awattarState.svelte.ts, drawerState.svelte.js
│   └── utils.ts                # cn() for tailwind-merge/clsx
└── app.css, app.d.ts, app.html
```

### Domain classes (`src/lib/classes/`)

| File | Role |
|---|---|
| `db.ts` | `Db` — Supabase `user` table CRUD. `IUserSettings` is THE central settings type. `getUserSettings(email)` **auto-inserts a row** for unknown users and recurses once. `mapFromDb` maps DB columns (`solarManIsOn`, `goEIsOn`…) to `IUserSettings` (`currentInverter`, `currentWallbox`); `FixedUserSettings` (charging constants: min/max kW, 1-phase limit 3 kW, fallbacks) are spread last and are **not persisted**. `saveUserSettings` maps back; `resetForceCharge`, `setPauseCharging`, `saveUserSolarManToken` are targeted updates. |
| `interver.ts` (typo — keep the name) | `InverterApi` facade over `IInverterMethods`: dispatches to `SolarmanApi` or `SolarEdgeApi` based on `userSettings.currentInverter`. Returns `IInverterRealTimeData` (powerFrom/ToGrid, powerTo/FromBattery, powerProduction, powerUsage, batterySoc), `IInverterStatistic[]`, time-frame data. |
| `solarman.ts`, `solaredge.ts` | Vendor implementations. Solarman: login token flow, token persisted via `Db.saveUserSolarManToken`. |
| `wallBox.ts` | `WallBoxApi` facade over `IWallBoxMethods` → `GoeApi` when `currentWallbox === 'goe'`. `IWallBoxRealTimeData` has `carStatus: 'waiting' | 'charging' | 'charged' | 'unknown'`. |
| `goe.ts` | go-e Charger HTTP API. `setChargingSpeed(kw)` converts kW→(phase, ampere), honors `pauseCharging` (forces 0/0 → `frc=1` stop), stop uses `frc=1`, charge `frc=2` with `amp`+`psm` params. |
| `awattar.ts` | `AwattarApi.getData({hours=5, offsetHours=1})` → `AwattarEntry[] {time: Moment, netPrice, grossPrice}`. Prices = `marketprice/10` (EUR/MWh→ct/kWh), gross ×1.2 (AT VAT). Cached via `VoltCache` 1 h. `getCurrentPrice()` picks the current hour's gross price. |
| `charging.ts` | `ChargingApi` — the decision engine. `getChargingInfo()` aggregates inverter + wallbox realtime + price into `IChargingInfo`; `calculateChargingSuggestion` picks reason `force | excess | battery | paused` and `suggestedKw`; `getCalculationSuggestion()` plans cheapest charging window (`calculateBestForceChargingValues`) against aWATTar prices. |
| `voltCache.ts` | `VoltCache.get(key, user, seconds, promise, force)` — **localStorage-based**; returns data only on the client (falls back to calling `promise()` when `localStorage` is missing, i.e. on the server). Clears everything on quota exceeded. |
| `vconsole.ts` | Logging helper used across endpoints. |

### API endpoints (`src/routes/api/**/+server.ts`)

All authenticated ones share the prologue:

```ts
const session = await locals.auth();
if (!session?.user?.email) redirect(307, '/');        // or throw json({error}, {status:401})
const userSettings = await Db.getUserSettings(session.user.email);
```

| Endpoint | Method | Purpose |
|---|---|---|
| `api/charging` | GET / POST | GET: `ChargingApi.getChargingInfo()`. POST `{kw}`: `WallBoxApi.setChargingSpeed(kw)`. |
| `api/calculation` | GET | Planned cheapest charge plan (`getCalculationSuggestion`). |
| `api/charging_to_suggestion` | POST `{kw}` | Applies suggestion; refuses to go *above* suggested kW ("Nothing to change" if `suggestedKw < kw`). |
| `api/setsuggestion` | GET `?hash=` | **Session-less** automation hook: looks up user by `hash` query param instead of Auth.js session (for cron/shortcuts). Honors `autoExecuteSuggestions`; resets force charge when stale (`minMinutesOldForAction` semantics via `shouldResetForceCharge`). |
| `api/save_settings` | POST | Body = full `IUserSettings` JSON → `Db.saveUserSettings`. |
| `api/set_pause_charging` | POST `?pauseCharging=true\|false` | Toggles `pauseCharging`. |
| `api/manual_charging` | POST `{on, kw?, durationMinutes?}` | Manual boost: persists override state, applies kW to wallbox immediately; `on:false` stops and re-applies engine suggestion. Overrules pause/price/excess/battery. |
| `api/awattar` | GET `?hours=&offsetHours=` | Raw aWATTar entries. |
| `api/inverter/{realtime,statistics,timeframe}` | GET | Inverter data for charts/views. |

### Data flow / settings round-trip

1. `/v/+layout.server.ts` loads `userSettings` (**intentionally unawaited** — a Promise passed to the client, awaited in `+layout.svelte` via `data.userSettings`; don't "fix" this blindly, it keeps SSR fast).
2. Settings drawer (`Settings.svelte`) edits a copy → `POST /api/save_settings` → `Db.saveUserSettings`.
3. On save the client dispatches `document.dispatchEvent(new Event('settingsChanged'))` + `invalidateAll()` — components listen to the `settingsChanged` DOM event to re-fetch; preserve this pattern for settings-dependent components.
4. Reactive price state: `awattarState.svelte.ts` (`$state` module store); drawer visibility: `drawerState.svelte.js`.

## Conventions

- **Svelte 5 runes only**: `$state`, `$props`, snippets `{@render children?.()}` — never legacy `export let` / slots.
- **TypeScript strict**; `.svelte` files use `lang="ts"`.
- **Formatting**: prettier — tabs, single quotes, no trailing commas, print width 100, `prettier-plugin-svelte` + `prettier-plugin-tailwindcss` (class order is enforced; run `npx prettier --write <file>` on files you touch).
- **UI components**: add shadcn-svelte pieces with `npx shadcn-svelte@latest add <component>` into `src/lib/components/ui`; never hand-edit generated files; app code goes to `src/lib/components/<feature>/`.
- Server endpoints return `json(...)` and use `redirect(307, '/')` for auth failures (some older ones `throw json(..., {status:401})` — both patterns exist).
- Git history mixes conventional-ish subjects; write short imperative messages.

## Gotchas

- **Filename `interver.ts`** (sic) — the inverter module; don't rename casually, imports across routes reference it.
- **Per-call Supabase clients**: `Db.getClient()` creates a new client on every call; fine at this scale, but don't cache tokens/state on it.
- `Db.getUserSettingsByHash` uses a `neq('hash', Math.random())` guard — hash lookups are string comparisons; keep query semantics in mind when touching it.
- aWATTar `hours=0` means "from valid start onward, no end bound" (`showEntry`).
- kW→phase/amp conversion (`GoeApi.getPhaseAndAmpFromKw`): 3-phase mapped to `psm=2` payload quirk; 1-phase capped by `maxKwFor1Phase` (3 kW).
- `FixedUserSettings` override DB values on every `mapFromDb` — changing charging constants means editing `db.ts`, not the DB.
- Manual boost (`manualChargeIsOn/manualChargeKw/manualChargeUntil`) is the highest-priority branch in `calculateChargingSuggestion` (above `pauseCharging`). Its columns are deliberately **excluded** from `Db.saveUserSettings` — mutate only via `Db.setManualCharging` / `POST /api/manual_charging`, or a stale Settings-drawer save would clear an active boost. Expired boosts are cleaned by `Db.expireManualCharge` (called from `GET /api/charging` and `setsuggestion`), while the engine independently ignores expired boosts via `isManualChargeActive`.
- `moment` objects inside `AwattarEntry.time` get serialized through `VoltCache` JSON — timestamps come back as strings; code re-wraps with `moment(...)`.
- Vite `__APP_VERSION__` global is injected from `package.json` (see `vite.config.ts`); bump the version intentionally.
- `components.json`/prettier config came from a Windows setup (`src\\app.css` path) — irrelevant on macOS, ignore.
- No lint-staged/husky; nothing blocks commits — discipline is on you.

## Workflow for agents

1. **Scope first**: read the route + the domain class involved; endpoints share the auth prologue — copy the nearest sibling when adding one.
2. **Type changes**: `IUserSettings` (db.ts) ↔ Supabase `user` columns ↔ `Settings.svelte` must stay in sync in all three places when adding a setting.
3. **Verify**: build green + touched-file svelte-check clean + prettier on touched files + run the dev server and exercise the endpoint/page. No test suite exists; report what you actually exercised.
4. **Don't** hand-edit `src/lib/components/ui/**`, don't run repo-wide `pnpm run format`, don't chase pre-existing check/lint reds outside your change.
# FEATURES.md — Voltalytics feature ledger (web + iOS)

**One spec per feature, implemented on BOTH platforms.** The web app
(this repo, SvelteKit PWA) is the source of truth; the iOS app
(`../voltalyticsIos`, SwiftUI) is the native port.

**How to use:** when a feature is requested — in chat, in either repo, or as a
GitHub issue — an agent creates an entry here with the template below BEFORE
writing code, implements it on both platforms, exercises the parity checklist on
each, and moves the entry to Done. Platform-specific differences are documented
in the entry itself (and in the iOS README "Deliberate design deviations").

Statuses: `backlog` → `in-progress (web / ios)` → `done` · or `web-only` / `ios-only` with a reason.

---

## Template

```markdown
### <N>. <Feature title> — <status>

**Goal:** one sentence, user-visible outcome.

**Contract** (write once, implement identically on both platforms):

- DB: new/changed `user` columns (name, type, default)
- API: new/changed endpoints (web `src/routes/api/**`, iOS = in-process call in
  the corresponding Domain class) — request/response JSON shapes
- Engine: changed decision semantics in `charging.ts` / `ChargingApi.swift`

**Web:**

- Files to touch: <routes, components, classes>
- Notes/quirks: <auth prologue, settingsChanged event, shadcn usage…>

**iOS:**

- Files to touch: <Domain/, Views/, Components/>
- Native treatment: <glass, drawer, Swift Charts…>

**Settings sync:** does it add a setting? If yes — all three places on both
platforms (`IUserSettings`/`UserSettings` ↔ Supabase columns ↔ settings UI).

**Parity checklist:**

- [ ] web build green + touched-route smoke test
- [ ] iOS build green + simulator/device smoke test
- [ ] engine semantics identical (if touched)
- [ ] deviations documented (entry + iOS README)
- [ ] ledger status updated
```

---

## Backlog

(park ideas here with a one-liner; promote to a full entry when picked up)

---

## In progress

### 2. Calculated force-charge plan stops on its own + price display fixes — in-progress (implemented web + ios, migration done; production check + iOS device install pending)

**Goal:** a plan from the calculator ("Use as force charging parameters" /
"Calculate & set") charges only during its planned hours and then stops, even
when the price never rises above the threshold (flat fixed-tariff nights).
Opening the web app shows the configured provider's prices immediately.

**Bug reports (2026-10-27, fixed tariff 10–16 → 9.90, 16–10 → 13.90):**

- Calculator: 40 → 70 %, target 06:00 → "2 h at ~8 kW", threshold 14.0
  (13.9 + 0.1). Every night hour is 13.9 < 14, so force charging ran all night
  and the car was at 100 % by 06:00.
- Web: on open the dashboard/prices page shows aWATTar prices until
  pull-to-refresh.

**Root causes:**

- Engine: the calculator only persists a price threshold, and the engine charges
  whenever price < threshold. With equal prices nothing ever stops it (the morning
  auto-off was the only stop).
- Web prices: `/v/dashboard` and `/v/awattar` rendered the price components while
  `userSettings` was still `undefined` (set later by `$effect`). `PriceApi` treats
  undefined settings as aWATTar (meant for the public landing page). After each full
  hour the aWATTar cache key misses, so that request goes to the network and
  finishes last. Its side effects (`awattarState.currentPrice`, chart `entries`)
  then overwrite the fixed prices. On pull-to-refresh the localStorage cache is warm,
  so the stale request finishes first and the correct one wins.
- Web server timezone: Vercel runs in UTC (evidence: `lastForceChargeReset`
  written at 06:00:03 UTC = 07:00 Vienna). As a result, these were 1 h (CET) / 2 h
  (CEST) late on the server: fixed-tariff hour rules for the engine/cron, the
  calculator's target hour and the morning auto-off.

**Contract** (implemented identically on both platforms unless marked):

- DB: `user.forceChargeFrom timestamptz null`, `user.forceChargeUntil timestamptz
  null` hold the window of a calculated plan. Both null = unlimited (manual
  force charging, unchanged semantics). **Run before deploying** — both apps write
  these columns on every settings save:

  ```sql
  alter table public."user"
    add column if not exists "forceChargeFrom" timestamptz,
    add column if not exists "forceChargeUntil" timestamptz;
  ```

- Calculation (`getCalculationSuggestion` / `calculateBestForceChargingValues`):
  price selection is unchanged. The result adds `chargingFrom` (start of the first
  planned hour) and `chargingUntil` (end of the last planned hour). The greedy pass
  picks every hour ≤ threshold in chronological order until the kWh are reached.
  So "price < threshold inside `[from, until)`" reproduces exactly the planned
  hours. **Unreachable target** (all hours at max power are not enough): fall back
  to all hours at `maxChargingPower`, threshold = highest price (+0.1 as always).
  The old code returned an all-zero result, which applied as "force charging on
  with 0 kW".
- Engine (`getForceChargeSuggestion`): after the `forceChargeIsOn` guard, return 0
  outside `[forceChargeFrom, forceChargeUntil)` — helper `isInForceChargeWindow`
  (web `charging.ts`, iOS `UserSettings`), next to `isManualChargeActive`. The window
  applies regardless of provider.
- Apply plan: one regular settings save writes `forceChargeIsOn = true`,
  `forceChargeKw`, `forceChargeUnderCent`, `forceChargeFrom` and `forceChargeUntil`.
  The window is part of the force-charge unit (unlike the boost columns), so a
  stale drawer save can never write "on" without its window.
- Manual toggle of "Activate Force Charging" (either direction) clears the window,
  so manual force charging stays unlimited.
- Expiry: `Db.expireForceChargeWindow(email)` sets `forceChargeIsOn = false` and
  the window to null where `forceChargeUntil < now`. It is called next to
  `expireManualCharge` (web `GET /api/charging`, `GET /api/setsuggestion`; iOS
  `ChargingOverviewModel.loadChargingInfo`). `Db.resetForceCharge` also clears the
  window.
- Morning auto-off (`shouldResetForceCharge`, web cron only): skipped while a plan
  window is set, because the plan ends itself. A target hour after 06:00 would
  otherwise be cut off.
- Display: the calculator result gets a "Charging window HH:mm – HH:mm" row. The
  force-charge status line gets a ", HH:mm–HH:mm" suffix. The force-charge settings
  section gets the caption "Calculated plan: HH:mm – HH:mm, then off".
- Web-only: `process.env.TZ = 'Europe/Vienna'` in `hooks.server.ts` (Vercel
  reserves the `TZ` env var), so the server computes in the same local time as the
  browser and the iOS app.
- Price views: never fetch with unresolved settings. Stale responses must not
  touch shared state (current price, chart entries). The current price is cleared
  when the current hour has no entry. Price views reload on provider/tariff change
  and right after every full hour, so a long-open app or a resumed PWA never shows
  an old hour's price.
  - Web: `lib/state/hourState.svelte.ts` (60 s check + `visibilitychange`) keys
    `{#key}` around the price fetches.
  - iOS: `.task(id:)` loop sleeping until the next full hour (`PriceRefresh`), no
    `scenePhase` (Always-On reload loops). iOS had no opening race because
    settings load before the price views appear.

**Web:** `lib/classes/{charging,db}.ts`, `routes/api/{charging,setsuggestion}`,
`hooks.server.ts`, `lib/state/hourState.svelte.ts`,
`routes/v/{dashboard,awattar}/+page.svelte`,
`components/awattar/{AwattarList,AwattarChart}.svelte`,
`components/system/Settings.svelte`, `components/charging/ChargingOverview.svelte`.
Regression scripts: `pnpm test:prices` (browser, real page components, slow
aWATTar stub), `pnpm test:charging-plan` (engine vectors + simulated UTC server
clock, plus the calculator/apply/toggle UI flow against stubbed endpoints).

**iOS:** `Domain/{ChargingApi,ChargingModels,UserSettings,SupabaseDb}.swift`,
`Components/AwattarComponents.swift`, `Views/Prices/PricesView.swift`,
`Views/Settings/{CalculatorSection,SettingsSheet}.swift`,
`Views/Dashboard/{ChargeSettingsSheet,ChargingOverviewView}.swift`, DEBUG launch
arg `-voltalytics-preview-force-window` (`App/AppModel.swift`).

**Settings sync:** `forceChargeFrom` / `forceChargeUntil` are in
`IUserSettings`/`UserSettings` ↔ columns ↔ settings UI. The UI shows them
read-only, the toggle clears them and the calculator writes them.

**Parity checklist:**

- [x] migration executed (user, 2026-10-27; both columns readable via PostgREST)
- [x] web: `pnpm run build` green; svelte-check unchanged at 27 errors / 10 warnings
      (none new in touched files); Prettier 3.6.2 clean on touched lines.
      `test:prices` 5/5 (4 failed before the fix) and `test:charging-plan` 17/17
      (8 of its 12 engine checks failed before; the 5 UI checks were added after
      the fix). Not exercised against the live app: login needs Google,
      and a forged session would drive the real wallbox.
- [x] iOS: iPhone 17 simulator build green. Engine self-check (swiftc harness over
      the Foundation-only Domain files, same vectors V1–V5) 27/27, 12 failed
      against HEAD. Simulator screenshots (DEBUG preview + fixed prices + mock data
      + plan window): status-line suffix, drawer caption, fixed prices on
      dashboard + prices tab.
- [x] engine semantics identical (vectors V1–V4 pass on both platforms)
- [x] deviations documented (iOS README: price-view refresh mechanism, window
      columns always saved)
- [ ] ledger status → done after migration + deploy

---

## Done

- **1. Alternative electricity provider with fixed prices** — `in-progress (rev 2)`
  Revision after user feedback: **three exclusive provider states** (`none` /
  `awattar` / `fixed`) — the "Use Awattar" toggle is removed on both platforms,
  and the tariff is edited via a **structured editor**, not raw JSON paste.
  - Contract rev 2:
    - `priceProvider` ∈ `'none'` | `'awattar'` | `'fixed'` — exactly one.
    - Legacy DB compat: `useAwattar` column stays as a **derived mirror**
      (`= priceProvider != 'none'`). Derivation on read (identical both apps):
      `useAwattar == false` → `'none'` (legacy master switch wins over the DB
      column default `'awattar'`); else the `priceProvider` column, with
      `'none'`/missing → `'awattar'`.
    - Engine gates keep reading the derived `useAwattar` (= "any provider") —
      semantics unchanged: `'none'` → no price data, no price-based charging.
    - `fixedPriceData`: edited via a structured editor (title, ranges with
      validFrom, rules with month/hour chip toggles + price field), serialized
      as canonical strict JSON (quoted keys, months/hours sorted); parsers
      tolerate JS-style unquoted keys on read.
    - Save/reload regression (web): month/hour lists must remain comma-separated
      strings, matching the existing DB format and both platform parsers. Preserve
      every selected hour (0–23), month (1–12), price and range when saving unrelated
      settings or editing a tariff. Derive `useAwattar` from `priceProvider` on save
      as on iOS; switching providers retains the tariff for later reuse.
      Web reads also accept the arrays emitted by the broken editor, then write
      strings on the next editor save to restore iOS compatibility. This cannot
      restore hours already dropped by the old editor or rules overwritten later.
      Fix status is `web-only` (complete): the iOS editor already writes this format and derives
      the legacy flag. Browser regression: `node scripts/test-tariff-roundtrip.mjs`.
      Verified: web production build + browser editor/save/reload regression with
      a mocked Supabase transport; svelte-check unchanged at 27 errors / 10 warnings
      (no new errors in touched files). iOS build + iPhone 17 simulator launch of
      fixed-tariff settings and prices using DEBUG fixtures; no live account writes.
      No new native design deviations. Svelte formatting checked with Prettier
      3.6.2 because the installed 3.8.0 crashes with the existing Svelte plugin.
  - UI: both settings drawers get the 3-state provider picker; `'fixed'` shows
    the structured tariff editor with inline validation + example prefill.
    Provider-neutral labels ("prices", not "awattar prices") where the facade
    feeds.
  - v1 partial state (verified before rev 2): web `pnpm build` green /
    svelte-check at baseline; iOS build green + simulator smoke (chip 9,90
    midday rule, prices-tab stair pattern). Supabase migration executed.

- **0. Base parity (pre-ledger baseline)** — dashboard (live flow diagram, day
  chart, statistics today/month, aWATTar prices), inverter day/month/year
  history, settings (setup/charging/calculator), charging engine
  (excess/force/battery/boost/pause), go-e + Solarman/SolarEdge integration,
  Google sign-in. Known deliberate deviations are documented in
  `../voltalyticsIos/README.md` ("Deliberate design deviations from the web app").

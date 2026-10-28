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

### 5. Full-screen 3D scene with the dashboard as an overlay — in-progress (web + ios implemented, kept by the user; device + live checks pending)

**Goal:** with the 3D scene on (iOS: always; web: the per-browser toggle), the
scene fills the whole screen on every size and shape — under status bar,
navigation/tab bars and cards — and everything else (top bar, cards) floats
over it as an overlay. The camera frames the property into the part the overlay
leaves free, so no card or bar covers the house, its callouts or the
live/weather pills.

**Scope:** both platforms (user, 2026-10-28: "i wanna try something, on web and
on ios … make the visualizaton (if enabled) full screen, on any screen size and
shape. all the other controls/cards should just be an overlay … make sure that
the overlay doesnt cover something important"). Started as an experiment on top
of #3; the user kept it ("looks really nice now") — it replaces #3's
stacked/split layouts.

**Contract** (implemented identically on both platforms):

- No DB columns, API or engine changes; no new setting.
- **Camera rig = pinhole with lens shift** (`CameraRig` / `framing`): focal
  length `f = min(focusW / (2·14.5/38), focusH / (2·10/38))` points, optical
  axis through the centre of the **focus rect** (the free area), pitch
  `clamp(atan(0.25·focusH / f), 5°, 15°)` — #3's framing (29 m across, horizon a
  quarter down), now for any rect inside a full-screen view. Off-axis
  projection: iOS `ProjectiveTransformCameraComponent` (reverse-Z matrix from
  the rig, the RealityView is exactly the screen), web `camera.setViewOffset`
  around a symmetric frustum (`lensFrame`). Callouts and sky use the same rig.
- **Layouts**, by the window's shape (not orientation):
  - _split_ — at least 700 wide and wider than tall: card column
    `min(max(40 % width, 340), 460)` with its own header (logo, avatar) over the
    left part of the scene, focus = the rest at full height, from 64 beyond the
    column (its tint's fade). iPhone Duo half open like a book: the column ends
    at the crease, focus right of it (and of the fade).
  - _stacked_ — otherwise: focus = the band below the top bar, as tall as
    `min(max(56 % of the height, 320), max(560, 50 % of the width))` (web: of
    the viewport, iOS: of the safe area); the cards start below it and scroll
    up over the fixed scene, the bar gets its background back once cards pass
    under it. Duo half open like a laptop: focus above the fold, cards below it.
  - Sky (user: "the sky is missing" on a tall desktop window — a 560 px strip
    across 1524 px squeezed the house to the top): the focus grows with the
    width up to half of it, and the rig keeps ±10 m (was 7.5) of height, so
    wide, short areas show sky with the sun above the roof.
  - Web stacked cards use the split column's grid (one column, today + month
    side by side): the chart-only live card is shorter than today + month and
    left a gap under it in the two-column grid. iOS stacks its two columns
    independently.
  - One scene instance across the layouts: resizing, rotating or folding never
    remounts it.
- **Inside the focus rect:** header pills at its top (< 500 wide: at its bottom,
  single-line chips); callouts clamped into it; sun arc, moon and the witch /
  sleigh flights span it, not the whole screen. A rising chip that would hit a
  header pill first slides sideways (up to 0.35 × the half chip width, the
  leader keeps its anchor) and hangs below only when that is not enough — the
  solar chip must not cover the roof (short focus areas, e.g. phone landscape).
- Cards over the scene are frosted: iOS regular Liquid Glass with the card tint
  (clear glass needs a dimming layer over busy content; the other tabs keep
  clear glass), web `bg-card/70 backdrop-blur-xl`.
- **Card-area tint** (user, 2026-10-28: "a slight purple translucent tint (like
  the base background color before)", then "more purple", then "the middle
  ground" with a softer fade): HSL 268 90% 11% at 52 % behind the area where
  the cards are (light: 268 40% 93% at 48 %) — the web dark theme's hue, richer
  than its near-black base — on both platforms. The cards sit completely on
  it; its edges are eased (smoothstep) and it never covers the free area.
  Split: solid behind the whole column, fading out over 64 pt/px beyond it —
  the free area starts after the fade (user: the cards must be completely
  inside the tint). Stacked: a sheet that fades in over 140 pt/px below the
  free area, scrolls up with the cards and reaches at least the bottom of the
  screen. Tabletop: below the fold, like the stacked sheet.

**Web:** `src/lib/energyScene/model.ts` (rig, `lensFrame`), `scene.ts`
(projection from the rig), `sky.ts` (sun, moon and flights in the focus rect),
`EnergyHero.svelte` (`focus` prop replaces `topInset`/`fadesOut`/`fadesLeft`;
measured pill rects; slide-or-hang placement), dashboard `+page.svelte` (fixed
full-viewport scene — `100vh`, so a collapsing mobile toolbar doesn't resize
it — under the column/stacked overlay; split threshold 900 px → 700 px and
landscape-shaped), `TopBar.svelte` (embedded bar frosted, opaque backdrop band
removed). #3's eased left-edge fade of the split scene is gone: the scene now
runs behind the column.

**iOS:** `EnergySceneModel.swift` (rig, `projectionMatrix`), `EnergyScene.swift`
(projective camera), `EnergyHeroView.swift` (`focus` replaces `topInset`,
`fadesOut` and the oversized lens-shift render; pill avoidance with slide),
`DashboardView.swift` (scene + overlay per layout, column header as
`safeAreaBar`), `Theme.swift` (`overScene` environment → regular glass). DEBUG
`-voltalytics-qa-window <W>x<H>` (replaces `-voltalytics-qa-hero`) lays the whole
dashboard out for that window size and scales it to fit — Duo inner-display
shapes on a phone simulator; combines with `-voltalytics-qa-fold`.

**Settings sync:** none.

**Parity checklist:**

- [x] web: `pnpm run build` green (three.js only in the lazy chunk);
      svelte-check unchanged (27 errors / 10 warnings, none new); Prettier clean
      on touched files; harness 150/150 incl. a new check per at-rest scene case
      that no callout or header pill sits under a card, the TopBar or the
      card-area tint, or outside the viewport, and that the tinted sheet
      reaches the bottom of the viewport; new cases tablet landscape 1180×820,
      phone landscape 874×402, tall window 1520×1820 (sunny, sky + sun check),
      flow tolerance (0,03 kW to grid → "0,00 kW", no direction)
- [x] iOS: iPhone 17 simulator build green; stacked day/night/scrolled in light
      and dark, rain, snow; `-voltalytics-qa-window` 951×669 (split), 669×951
      (stacked, two columns), book + tabletop folds, 874×402, Halloween and
      Christmas nights
- [x] parity: iPhone 17 simulator vs web 402×874 — same framing (the web stacked
      hero now gets the lens shift iOS always had)
- [x] scroll bench, simulator (HEAD 16.7 ms/s hitches, now 6–12 ms/s)
- [ ] iOS device: scroll bench + feel (full-screen RealityKit under glass)
- [ ] real iPhone Duo (inner display, folds) and the web against the live app
- [x] user verdict (2026-10-28): keep it

### 4. Holiday modes for the 3D scene (Halloween, Christmas, Easter) — in-progress (web + ios implemented; production check pending)

**Goal:** around Halloween, Christmas and Easter the 3D house scene decorates
itself automatically — pumpkins and bats, Christmas lights and Santa, Easter
bunny and eggs — with animations and night glow; no setting, no data change.

**Scope:** both platforms (user, 2026-10-27: "now affecting both ios and web …
be creative"). Wherever the scene shows (iOS always, web when the 3D view is on).

**Contract** (implemented identically on both platforms):

- Activation by **local calendar date**, inclusive — from a week before the
  holiday to the day after: Halloween **Oct 24 – Nov 1**; Christmas
  **Dec 17 – Dec 27**; Easter **Palm Sunday – Easter Monday** (Easter Sunday by
  the Gregorian anonymous computus, e.g. 2027-03-28). Re-evaluated with the
  scene clock (every minute), so a season starts/ends at local midnight.
- QA overrides (dev/DEBUG only): web `?qaSeason=halloween|christmas|easter|none`,
  iOS `-voltalytics-qa-season <name>`.
- No DB columns, API or engine changes; no setting (automatic). The decorations
  live in their own scene group, built when the season changes, absent outside
  the windows. Animated pieces cast no shadows (the shadow map is static).
- Live pill gets the season's emoji: 🎃 / 🎄 / 🐣.
- Decorations (same `Lot` coordinates, sizes and colours on both platforms):
  - **Halloween:** lobed jack-o'-lanterns (entrance step ×2, gate post + first
    fence pillars ×3, a big one on the west lawn) with faces toward the camera
    that glow and flicker after dusk (plus one flickering light at the door);
    5 bats circling the chimney; 3 crooked tombstones on the lawn east of the
    driveway with a ghost floating above them; orange/purple string lights
    along the front eave and the carport fascia. Sky: big orange harvest moon at
    night, a witch on her broom crossing in front of it every 30 s.
  - **Christmas:** twinkling multicolour lights along the front eave + carport
    fascia, icicle lights under the fascia; decorated Christmas tree by the
    entrance path (ornaments, twinkling lights, glowing star, presents); snowman
    with top hat, carrot nose and scarf east of the driveway; Santa sitting on the
    ridge waving, his sack beside him; wreath with a red bow on the front door.
    Sky: Santa's sleigh with reindeer crossing every 26 s (Rudolph's nose glows
    at night).
  - **Easter:** pastel egg garland along the front eave + carport fascia;
    storybook-size Easter bunny hopping a loop across the front lawn and path
    (hop runs, pauses); big coloured eggs in the lawn; Easter egg tree (eggs
    hanging in the front fruit tree) and blossoms on both fruit trees; tulips
    along the façade and inside the fence; big Easter basket on the front lawn;
    3 butterflies fluttering around the beds and the egg tree.

**Web:** `src/lib/energyScene/{season,decorations}.ts` (+ hooks in `scene.ts`,
sky overlays in `sky.ts`), `EnergyHero.svelte` (season from the scene clock,
emoji, `data-season`); glow = halo sprites; dev-only `?qaSkyTime=5.6` freezes
the witch/sleigh for screenshots. QA: 7 holiday cases + 3 iPhone 17 parity
cases in `scripts/qa-energy-scene.mjs`.

**iOS:** `Views/Dashboard/EnergyHero/EnergySceneSeason.swift` (dates),
`EnergyScene+Decorations.swift` (builders + animation), hooks in
`EnergyScene.swift`, `SeasonSky` + harvest moon in `EnergyHeroView.swift`.
Native treatment: glow = bloom on the lit parts; emissive levels = web × 2
(RealityKit exposure; night clears the bloom threshold, day doesn't);
glow materials are re-assigned at most 20×/s (RealityKit materials are
values). DEBUG `-voltalytics-qa-sky-time 5.6` freezes the sky.

**Settings sync:** none (automatic).

**Parity checklist:**

- [x] web: `pnpm run build` green; svelte-check unchanged (27 errors / 10
      warnings, none in touched files); Prettier clean on touched lines;
      harness 102/102 checks incl. Halloween/Christmas/Easter day + night,
      phone Halloween night, `data-season` per case
- [x] iOS: iPhone 17 simulator build green; screenshots Halloween night,
      Christmas night, Easter day side by side with the web parity cases
- [x] activation dates identical: computus vectors (2008, 2019, 2024–2028,
      2038, 2285) pass in JS and Swift; window rule shared
- [ ] production check (today, Oct 24 – Nov 1, Halloween is live)
- [ ] ledger status → done after the production check

### 3. 3D energy scene dashboard (iPhone Duo / large screens, web) — in-progress (ios + web implemented; Duo portrait check + production run pending)

**Goal:** on the iPhone Duo inner display (and other regular-width screens) the
dashboard becomes a two-pane layout like the Tesla app's tablet/Duo redesign
(Oct 2026): cards (day chart, go-e, today, month, prices) on the left, a large
animated 3D visualization of the house — sun, solar roof, battery, grid, car —
with live power flows on the right. Rev 3 (user feedback): phones (and the
Duo outer display) show the same scene full-width on top with all cards below
on one scrolling screen — the 2D flow diagram is replaced on iOS. Rev 4:
half-open postures follow the fold (iOS 27.1 `.division` reserved region):
book posture splits 50/50 at the crease, laptop posture stacks scene above
cards; fully unfolded keeps the regular split. Rev 2: the house is modelled on the user's own (drone photo:
terracotta roof, black PV array + skylight, carport with second PV block), the
car is a black Tesla Model Y, and the scene reflects the live weather at the
user's address (fallback Eisenstadt) with temperature + conditions shown. Rev 5:
open double carport — Model Y (nose in, left, at the go-e) + BYD Atto 2 (nose
out, right), PV strip front to back. Rev 6 (2026-10-27): the same scene, layouts
and weather on the web — **optional** there, toggled per browser. Rev 7: off by
default on the web (user). Rev 8 (2026-10-28, experiment): the scene full-screen with the
dashboard as an overlay — see #5. Rev 9 (2026-10-28, user): flows below
0.1 kW count as 0, the battery callout shows a battery pack filled to the
state of charge, the street fence runs the whole front west of the
driveway (none east of it), and the carport PV strip faces east (west edge
raised 6°; it faced west).

**Scope:** both platforms. Started iOS-only ("regarding the ios version"); the
user then asked for the exact same visualization on the web, optional and not
persisted ("just in cache").

**Contract:** no DB columns, API shapes or engine semantics change. The scene
visualizes data the dashboard already loads (inverter realtime, go-e charging
status, current price) plus live weather:

- Weather: Open-Meteo `GET /v1/forecast` with `latitude`, `longitude` and
  `current=temperature_2m,weather_code,cloud_cover,precipitation,snowfall,snow_depth,wind_speed_10m,is_day`
  (free, no key, CC BY 4.0 — attribution in Settings), cached 10 min. Only
  coordinates rounded to 2 decimals (~1 km) leave the device.
- Location: Settings address geocoded and cached on the client — iOS: Apple
  MapKit (`MKGeocodingRequest`); web: OpenStreetMap Nominatim (no MapKit in the
  browser; the address goes to OSM). Empty or unresolvable → Eisenstadt
  (47.8457, 16.5232). The same coordinates drive the scene's sun position.
- Scene semantics shared by both ports: `Lot` layout (meters, front façade +z),
  routes into the façade gateway, pulse speed `1.3 + 1.2·log2(1+kW)` m/s and
  spacing `max(0.55, 2.4 − 0.3·kW)` m, colors per source (solar amber, battery
  cyan, export teal, import rose, car = its charge source), roof/carport PV
  share 80/20, Vienna-independent sun from the weather place, camera framing
  (~29 m span, horizon a quarter down the safe area, lens shift below bars).
  Flow tolerance: readings below 0.1 kW are rounding noise and count as 0 —
  no value, no direction, no pulses (`flowTolerance`; e.g. 0,03 kW "to grid"
  showed as an export). Battery callout: a battery pack of four modules filled
  to the state of charge (18 × 30, compact 12 × 20). Fence: slat panels from
  the west hedge (x −15.5) along the front garden to the entrance gate and on
  to the driveway; nothing east of the driveway.

**iOS:**

- Files: `Views/Dashboard/DashboardView.swift` (stacked/split switch by size
  class + width; split from 700 pt regular width), `Views/Dashboard/EnergyHero/*` (RealityKit scene: `Lot` layout of the
  property, car, textures, sky/weather overlays, callouts),
  `Domain/WeatherApi.swift` (Open-Meteo + geocoding), `LiveEnergyModel.swift`
  (realtime polling hoisted out of the removed 2D `LiveFlowView` so every
  layout shares one poll and survives fold/unfold), `SettingsSheet.swift`
  (address).
- Native treatment: procedural RealityKit scene (no 3D assets), bloom on iOS 27,
  sun position from time of day + place; weather drives sky, clouds, sun
  strength, rain/snow/fog/lightning overlays and wet/snow-covered surfaces;
  layout decisions use size classes, not orientation (Apple's iPhone Duo
  guidance — the inner display ignores supported orientations).

**Web:**

- Files: `src/lib/energyScene/*` (Three.js port of the RealityKit scene:
  lot, model, palette, textures, geometry, scene, property, cars, sky, weather),
  `src/components/energy/EnergyHero.svelte` (canvases, callouts, header chips),
  `src/lib/state/sceneState.svelte.ts` (toggle + address in localStorage, layout
  flags, go-e status published by `ChargingOverview.svelte`), dashboard page +
  `/v/+layout.svelte` + `TopBar.svelte` (stacked/split layouts),
  `Settings.svelte` (switch + address), `DashboardLive.svelte` (chart only while
  the scene is on).
- Layouts: stacked below 900 px viewport width — scene full width on top,
  height `min(max(56 % of the viewport, 320), 560)` + TopBar, the TopBar floats
  transparent over the sky until the page scrolls past the scene, the street
  fades into the page background, cards below (existing grid). Split from
  900 px — card column `min(max(40 % width, 340), 460)` px with its own TopBar
  styled as a card (pinned; cards fade out beneath it — the layout hides its
  bar and lifts the 800 px limit), scene sticky at full
  height on the right; its left edge fades into the card column (eased, 12 %
  of its width, max 180 px — user request; the iOS split keeps a hard edge).
  No fold postures on the web.
- Notes: Three.js is loaded lazily (dynamic import, own ~565 kB chunk) only
  when the scene mounts; glow = additive halo sprites instead of a bloom pass
  (transparent canvas); the 2D sky/weather overlays are canvas layers like the
  SwiftUI ones; the render loop is capped at ~60 fps and pauses off-screen.
  With the toggle off the dashboard is unchanged (no scene code or weather
  requests). Dev-only QA params: `?qaHour=21`, `?qaWeather=rain&qaTemp=9`.
- Deliberate web deviations (look-alike, not value-alike — don't "fix"):
  - Horizon haze: Three.js fog in the sky's horizon colour (120–1200 m, apron
    r 2000 m vs iOS 600 m) plus the haze band drawn _behind_ the scene. iOS
    draws the band over the scene, which crossed the roof on wide stacked heroes.
  - Wide stacked heroes (500–899 px) keep the header on top: a callout whose
    chip would rise into a header pill hangs below instead (#5: on both
    platforms, sliding sideways first).
  - Light calibrated against iPhone 17 simulator screenshots (day, night,
    snow; RealityKit lux/exposure ≠ Three.js units): sun
    `(0.85 + 4.6·day)·(1 − 0.78·clouds)`, sky light
    `(0.5 + 0.9·day)·(1 − 0.25·clouds)`, asphalt albedo 0.35 (iOS 0.17 +
    grazing sky reflection), window lights `1.5 + 2·usage`, lamps 7. The day light probe greys with cloud
    cover (iOS blends toward its night probe).
  - Pulses keep their flow colour; iOS bloom whitens their cores.
- QA: `node scripts/qa-energy-scene.mjs [outDir]` mounts `/v` layout +
  dashboard (`scripts/qa/SceneHarness.svelte`) with mocked API + Open-Meteo
  (fixtures = iOS `MockData.swift`) and screenshots 17 scene cases (+ #4's holiday
  cases): phone/tablet
  stacked, desktop split (also scrolled), 1920 px split at night, night, rain,
  snow, toggle off,
  fresh browser (default off), settings, and three 402×874 parity cases against
  the iOS simulator. A
  settings flow types an address (one debounced Nominatim call, chip follows)
  and switches the view off; a drawer check swipes the Settings sheet on a phone
  (it must fit the screen and scroll instead of closing).

**Settings sync:** deliberate deviation from the rule of three — the scene
settings are **per device/browser**, never Supabase columns: iOS `UserDefaults`
(`weatherAddress`; the scene is always on), web `localStorage` (`scene enabled`
toggle, default off, + weather address — "not persisted, just in cache"; cleared
with the browser cache). Revisit (columns + `IUserSettings`/Settings.svelte/
`UserSettings.swift`) if it should sync across devices.

**Parity checklist:**

- [x] iOS build green + iPhone Duo simulator: unfolded inner display in
      landscape (split, vertical bars) + scene panes via `-voltalytics-qa-hero`
- [ ] inner display in portrait (stacked, two card columns) — needs a rotate
- [x] stacked layout with the scene on an iPhone 17 simulator (light mode)
- [x] deviations documented (entry + iOS README)
- [x] web: `pnpm run build` green (Three.js only in the lazy chunk);
      svelte-check unchanged at 27 errors / 10 warnings (none in touched files);
      Prettier clean on touched lines. Harness 17 scene cases + settings flow, all
      checks pass: one hero + callouts, no live graph duplicate, split = one
      TopBar, stacked bar transparent → opaque after scrolling, toggle off and
      fresh browser = classic dashboard with no weather request, no geocoding
      without an address, address → one geocoding call, switch off → classic
      dashboard, no page errors.
- [x] parity: iPhone 17 simulator (`-voltalytics-preview`, `-voltalytics-mock-data`,
      `-voltalytics-qa-hour …`) vs web 402×874 — day, night, snow side by side
- [ ] web against the live app (needs a Google login; the harness mocks the API)
- [ ] ledger status updated (→ done after the inner-display check + a live web run)

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

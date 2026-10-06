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

(none)

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

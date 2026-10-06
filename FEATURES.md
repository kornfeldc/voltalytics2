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

- **0. Base parity (pre-ledger baseline)** — dashboard (live flow diagram, day
  chart, statistics today/month, aWATTar prices), inverter day/month/year
  history, settings (setup/charging/calculator), charging engine
  (excess/force/battery/boost/pause), go-e + Solarman/SolarEdge integration,
  Google sign-in. Known deliberate deviations are documented in
  `../voltalyticsIos/README.md` ("Deliberate design deviations from the web app").

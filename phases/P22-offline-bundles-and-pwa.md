# P22 — Offline bundles & PWA hardening

**Goal.** Build the one-tap trip bundle and offline runtime: plan/cards/deep-texts/City-Brief/photos/PMTiles basemap/style/fonts (NO audio), OPFS/Cache Storage/IndexedDB, `storage.persist()`, reachability heartbeat, automated SW versioning, manifest reconciliation, install prompts, a <150MB budget, and an airplane-mode E2E test.

**Milestone.** M5 — Travel day.
**Depends on.** P18 (plan view to make offline), P21 (deep texts to bundle).
**Parallel-safe with.** Phases on disjoint areas. Owns `src/{offline,sw}`, `src/sw.ts`.
**Size.** L.

## In scope (§6.17)
- **One-tap trip bundle** (auto-prompted before trip start): plan + place cards + **deep place texts** + City Brief + photos + **city PMTiles basemap (20–80 MB)** + style/fonts. **NO audio in bundles** (owner decision — audio streams online only; offline falls back to deep text).
- **Storage:** PMTiles in **OPFS**; media in **Cache Storage** (iOS renders native Responses — 🧭 ET); metadata in **IndexedDB**; `storage.persist()` to protect from eviction.
- **Reachability heartbeat** (🧭 ET debt #6): never `navigator.onLine` alone; a real reachability probe drives the offline banner + "last synced".
- **Automated SW cache versioning on deploy** (🧭 ET debt #10): cache buste automatically, no manual version bump.
- **Manifest reconciliation** for cross-device deletions (🧭 ET): reconcile the bundle manifest so a deletion on one device propagates.
- **Full PWA installability** (🧭 ET debt #5): 192/512 + maskable icons, `beforeinstallprompt`, iOS nudge.
- **`/offline` vault** (public route so the SW can pre-cache without an auth bounce — 🧭 ET): list bundles, manage storage.
- **Budget <150 MB/trip**; clear offline banner + "last synced".
- **Airplane-mode E2E test** (Playwright + SW): map renders, cards + deep texts readable, cautions visible, plan edits queue and sync (queue via P19's offline path).

## Out of scope
- The on-device solver (P19). Narration audio (P21 — deliberately excluded from bundles). Documents vault (P26 — separate, though it also lives at `/offline`; coordinate area ownership: P22 owns the trip-bundle vault, P26 adds documents).

## Key constraints
- **Offline is never paywalled** (the market wedge) — bundles work on the free tier.
- **No audio in bundles** (superseded decision must not be reintroduced).
- Reachability heartbeat, never `navigator.onLine` alone. Automated SW versioning, never manual. App never opens empty offline (app-shell model).
- <150 MB/trip budget.

## Files/areas touched
- `frontend/src/{offline}`, `frontend/src/sw.ts`, PWA manifest/icons (coordinate with P01's manifest groundwork).

## Acceptance criteria
1. One-tap bundle stores plan/cards/deep-texts/City-Brief/photos/PMTiles/style/fonts and **excludes audio** (assertion).
2. PMTiles in OPFS, media in Cache Storage, metadata in IndexedDB; `storage.persist()` requested.
3. Reachability heartbeat drives the offline banner (not `navigator.onLine`); "last synced" shown.
4. SW cache version busts automatically on a simulated deploy (no manual bump); manifest reconciliation propagates a cross-device deletion.
5. PWA is installable (icons + prompt + iOS nudge); `/offline` is a public route.
6. A fixture-city bundle is ≤150 MB.
7. Airplane-mode Playwright E2E passes: map renders, cards + deep texts readable, edits queue and sync.

## Verification commands
```
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
cd frontend && npm run test:e2e:offline   # Playwright airplane-mode suite
```

## Resume checklist
- [ ] One-tap bundle assembly (no audio) + auto-prompt.
- [ ] OPFS PMTiles + Cache Storage media + IndexedDB metadata + `storage.persist()`.
- [ ] Reachability heartbeat + offline banner + last-synced.
- [ ] Automated SW versioning + manifest reconciliation.
- [ ] Installability (icons, prompt, iOS nudge) + public `/offline` vault.
- [ ] <150 MB budget check.
- [ ] Airplane-mode Playwright E2E; Verification commands green.

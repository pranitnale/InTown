# P01 — Design system & app shell

**Goal.** Build the InTown Color System v2 as OKLCH-derived light+dark tokens with CI-enforced contrast, the UI primitives, the map-context bottom sheet, the 13-route skeleton with auth-gate stubs, the responsive shell, and the single mutually-exclusive selection state machine. Every later frontend phase consumes this.

**Milestone.** M1 — Foundation.
**Depends on.** P00 (contracts: `design-tokens.json`, route contracts, entity types for typed props).
**Parallel-safe with.** All backend phases (P02, P04, P06, P08, P09, P10, P11, P16, P17); other frontend phases only after this merges (they depend on it).
**Size.** L.

## In scope (§17, §4)
- **Tokens (§17.1–17.3):** consume `contracts/design-tokens.json`; generate 50–900 ramps in **OKLCH** (fixed hue+chroma, stepped lightness — never HSL/hand-picked hex). Five seeds: InTown Blue `#2563EB` (primary/function), Sand `#FAF7F2` (light ground), Ink `#1C1917` (warm-neutral text/dark surface — never brown, never cold slate), Terracotta `#C2410C` (peaks ONLY: must-see, golden hour, celebration), Jade `#047857` (positive affordances). Gamut-check every generated color for sRGB; never generate into the disliked dark yellow-green zone (HCT hue 90–111, chroma >16, tone <65).
- **Light + dark tokens verbatim from §17.2/§17.3** (the file ships the exact hex + verified ratios). Theme default = **system** (`prefers-color-scheme`) + in-app override. Basemap gets a true dark tile style, never CSS inversion.
- **Contrast enforcement (§17.9):** the CI contrast-assertion test (from P00) must stay green; any new text pair introduced here is re-verified (body ≥4.5:1 & Lc 75; large/semibold ≥3:1 & Lc 45; non-text ≥3:1). Build fails otherwise.
- **UI primitives:** buttons/CTAs, chips (incl. "because you said X", disagreement, citation, must-see, caution, verified-visit), cards (photo-led, one "why" line, one metadata row, **max 2 badges**), inputs, toggles, tabs, tables (tabular-nums for prices/times). Typography: `system-ui` stack, body ≥16px (companion ≥17px per P20), respect OS scaling.
- **Bottom sheet (§17.7, UI_UX §3.B):** M3 standard non-modal 3-detent sheet (peek/half/full, half ratio 0.5), 28dp top radius, 1dp elevation, max width 640dp, drag-settle 500 px/s, **48dp drag handle** with tap-to-cycle + accessible alternatives; co-exists with an interactive map; selected pin stays visible when open.
- **13-route skeleton (§4):** `/`, `/auth/*`, `/onboarding`, `/trips`, `/trips/new`, `/join/:code`, `/trips/:id`, `/trips/:id/curate`, `/trips/:id/city-brief`, `/trips/:id/generating`, `/settings`, `/offline` (public), `/reviews-policy` + `/moderation` (public). Auth-gate **stubs** (real auth wired in P03). Empty screens owned later by their phases.
- **Responsive shell:** desktop = fixed right side-panel; mobile = bottom drawer; one codebase.
- **Single mutually-exclusive selection state machine:** one of {stop, POI, leg, day} selected at a time (🧭 ET carried lesson).
- PWA installability groundwork: manifest, 192/512 + maskable icons, `beforeinstallprompt`, iOS nudge (🧭 ET debt #5).
- Motion: springy sheet physics, shimmer (left→right) skeletons, `prefers-reduced-motion` honored; CSS Scroll Snap for tabs.

## Out of scope
- Real auth logic (P02/P03), map rendering (P17/P18/F2 map lives in P18's area? — map platform UI is P18), curation/plan/companion screens (their phases fill the skeletons). Pin-category final ramp is generated here and **returned to contracts via a contract-change request** (not edited on this branch).

## Key constraints
- 60/30/10 with warmth budget; **max one terracotta element per view**. Blue = function, terracotta = emotion — never cross. Error = `#B91C1C` family + icon, never terracotta. Never white body text on jade/amber/success fills (v1 failures). Amber = warning only, always dark text. Lightness before hue for adjacent meaningful colors.
- Aesthetic polish is functional (perceived beauty → perceived usability) — invest.

## Files/areas touched
- `frontend/src/{design-system,app-shell,routes-scaffold}`, `frontend/ui-tokens/`, `frontend/public/`. Contract-change request for the final pin ramp only.

## Acceptance criteria
1. Every primitive renders in both light and dark themes (Storybook/ladle catalog).
2. §17.9 contrast test green; a seeded token that breaks a floor fails the build.
3. OKLCH ramps generated from seeds; all sRGB-gamut-valid; no color in the disliked yellow-green zone.
4. 3-detent bottom sheet with 28dp radius, 48dp handle, selected-pin-visible rule, accessible cycle.
5. All 13 routes exist with auth-gate stubs; responsive shell switches side-panel↔drawer.
6. Selection state machine enforces exactly one of {stop, POI, leg, day}.
7. Lighthouse reports the PWA installable (manifest + icons + prompt).
8. Theme defaults to system, override works, dark basemap style is a real dark style (not inversion).

## Verification commands
```
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
# contrast-assertion + selection-state-machine unit tests inside npm run test
```

## Resume checklist
- [ ] Generate OKLCH ramps from the five seeds; gamut + disliked-zone checks.
- [ ] Wire light/dark tokens (§17.2/§17.3) + theme system (system default + override).
- [ ] Ensure §17.9 contrast test passes with any new pairs.
- [ ] Build primitives (buttons, chips, cards, inputs, tabs, tables).
- [ ] Build the 3-detent non-modal bottom sheet.
- [ ] Scaffold all 13 routes with auth-gate stubs; responsive shell.
- [ ] Selection state machine.
- [ ] PWA manifest/icons/install prompts; reduced-motion; scroll-snap tabs.
- [ ] File contract-change request for final pin-category ramp.
- [ ] Run Verification commands green.

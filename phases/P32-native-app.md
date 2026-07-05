# P32 — Native app (React Native/Expo)

**Goal.** The P3 native app. **Large; must be decomposed into its own sub-phase set in a dedicated planning session before implementation starts** — this file is a placeholder scope, not an implementable single-session phase.

**Milestone.** M8 — P3 expansion.
**Depends on.** MVP complete (P00–P25 merged).
**Parallel-safe with.** P33 and any post-MVP work not touching the same new folder.
**Size.** XL — decompose before building.

## In scope (§ decisions D1, §12, §6.18)
- A **React Native / Expo** native app as a **third top-level folder** (`native/`) when it starts — the PWA stays; native adds what the PWA can't: **background GPS** and **no storage eviction** (the two PWA limits called out in D1).
- Reuse the frozen `contracts/` seam (same API/types/tokens) — the backend does not change.
- Native share extension for social import (§6.22 — the P30 iOS paste-box replacement).
- Companion-mode background location + push parity.

## Out of scope (until decomposed)
- Everything concrete — this phase is not built directly. A planning session must produce `phases/native/` sub-phases (shell, auth, map, plan, companion+background-GPS, offline, share-extension, store submission) each single-session-sized, before any implementation branch is cut.

## Key constraints
- **Do not start implementation from this file** — decompose first (explicit owner instruction).
- Backend/contracts unchanged; native is a new folder, never edits `frontend/` or `backend/`.
- PWA is not deleted — native is additive (D1).

## Files/areas touched
- Future `native/` folder only (created by the decomposition's foundation sub-phase).

## Acceptance criteria
1. A dedicated planning session has produced a `phases/native/` sub-phase set, each sub-phase single-session-sized with its own acceptance criteria, before any implementation.
2. (Deferred to sub-phases) native app consumes the unchanged `contracts/` seam; background GPS + push parity; store submission.

## Verification commands
```
# defined per native sub-phase after decomposition (expo build, eas submit, detox e2e, etc.)
```

## Resume checklist
- [ ] Run a planning session to decompose P32 into `phases/native/` sub-phases.
- [ ] Only then cut implementation branches per those sub-phases.

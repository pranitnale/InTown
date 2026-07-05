# P21 — Narration

**Goal.** Build the two-layer narration system: deep cited text per (place, language) always bundled, and 60–90s TTS audio generated on first request, cached forever backend-side, streamed, never bundled — with an offline fallback to the deep text.

**Milestone.** M5 — Travel day.
**Depends on.** P11 (LLM pipeline / fact access for text generation).
**Parallel-safe with.** Phases on disjoint areas. Full-stack: backend narration + `src/narration-player`.
**Size.** M.

## In scope (§6.13)
- **Deep text (backend):** a detailed readable account per (place, language) — history, significance, why famous, what happened there, what to look for — written once from cited City Brain facts, stored on the place (`poi_enrichment`), **always included in cards and offline bundles**. This is what a traveler reads with no signal.
- **Audio (backend, on demand only):** generated **only when a user taps "Generate/Play narration"** — a 60–90s spoken rendition (script derived from the deep text, one "look for…" cue). Synthesized on first request per (place, language), then **cached on the backend forever** and **streamed** to every later listener — paid for at most once globally. `POST /api/pois/:id/narration` (generate) + `GET` (stream cached MP3). TTS: Piper/Kokoro self-hosted → Google Cloud TTS free-tier fallback; MP3s immutable in object storage, streamed same-origin.
- **Audio is NEVER placed in offline bundles** (owner decision — browser-cache weight). Playing audio requires connectivity.
- **Narration player (frontend, `src/narration-player`):** play/pause/seek + text toggle; **offline fallback shows the deep text, never a silent gap** (🧭 ET debt #4) — "You're offline — here's the full story to read".
- Framing rules (§16.4) apply to generated text: attributed, dated; a framing linter rejects "safe"-certifying language.

## Out of scope
- Offline bundle assembly (P22 — bundles the deep text, excludes audio). Companion mode's narration button (P20 — triggers this). City Brief (P12).

## Key constraints
- **No prefetched/speculative audio; audio never in offline bundles** (superseded decision must not be reintroduced — deep text is the offline answer).
- Audio generated once per (place, language) globally, cached forever, streamed same-origin.
- Offline → graceful text fallback, never a silent gap.
- Framing linter on generated text (no "safe" certification).

## Files/areas touched
- `backend/workers/pipeline/narration`, `backend/api/src/narration`, `frontend/src/narration-player`.

## Acceptance criteria
1. Deep text generated per (place, language) from fixture facts, cited, and stored for card + bundle inclusion.
2. Audio generates only on first request; a second request streams the cached MP3 without re-synthesizing (cached-once test).
3. Audio is same-origin streamed; TTS falls back to Google Cloud TTS when the self-hosted engine is unavailable.
4. Audio is never written into an offline bundle (assertion test — P22 consumes this rule).
5. Player supports play/pause/seek + text toggle; offline shows the deep text with the honest message, never a silent gap.
6. Framing linter rejects a seeded "safe" string in generated text.

## Verification commands
```
cd backend && npm run test && npm run lint && npm run typecheck
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Deep-text generation per (place, language) from cited facts.
- [ ] On-demand TTS (Piper/Kokoro → Google Cloud TTS fallback), MP3 immutable in object storage.
- [ ] Cached-once-globally semantics + same-origin streaming.
- [ ] Assert audio never enters bundles.
- [ ] Player (play/pause/seek + text toggle) + offline deep-text fallback.
- [ ] Framing linter on generated text; tests both sides; Verification commands green.

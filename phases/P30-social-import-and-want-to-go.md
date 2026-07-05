# P30 — Social import & Want-to-go

**Goal.** Build the share-a-Reel/TikTok → Want-to-go loop: the video-first extraction pipeline, the confirmation-card UX, the personal Want-to-go list, and its highlighted resurfacing at trip creation.

**Milestone.** M7 — P2 depth.
**Depends on.** P11 (LLM pipeline / grounding + City Brain resolution).
**Parallel-safe with.** Other P2 phases on disjoint areas. Full-stack.
**Size.** M.

## In scope (§6.22)
- **Ingest:** Android PWA `share_target` manifest entry (parse both `url` and `text` — Android apps are inconsistent); **iOS = "Paste link" box** with clipboard detection (Safari has no share_target in 2026). Native share extension arrives with P32.
- **Video-first pipeline (§6.22 ⚙️, D43):**
  1. Fetch the video via an Apify extractor for the shared IG/TikTok URL (caption/metadata come along as context).
  2. **Gemini video understanding:** upload the clip + caption/hashtags → extract places (spoken mentions, on-screen text, AND **visual landmark recognition** for purely-visual reels).
  3. Ground & disambiguate: candidate names + city anchoring (caption/hashtags/geotag/visual cues) → city-biased place search → confidence scores.
  4. Confirm & save: a **confirmation card queue** (name, photo, mini-map pin, source attribution) — nothing saves silently.
  - **Fast path:** if the caption alone yields high-confidence places (listicle reels), skip video processing.
- **Want-to-go list:** `want_to_go(user_id, poi_id | unresolved_name, city, source_url, creator_handle, saved_at)`; grouped by city, browsable on a "dream map"; **unresolved names retry** against the City Brain when that city is next researched.
- **Resurfacing at trip creation:** planning Paris → "You saved 7 places for Paris 💫" → injected into the longlist **highlighted as "saved by you"**, boosted in priority, curated with the group like everything else; the solver treats kept ones like any curated place.
- **Honest failure UX:** "couldn't find places in this video — paste the names?"

## Out of scope
- Native share extension (P32). oEmbed caption endpoints (optional clean-tier optimization, not a launch dependency — do not make it the primary path). The curation/solve machinery (P14/P15/P16 — Want-to-go injects into it).

## Key constraints
- **Video-first, not oEmbed-first** (superseded decision must not be reintroduced — captions are the fast path only).
- Nothing saves silently — confirmation queue required.
- Coordinates via grounding/geo-sources, never LLM-emitted; confidence scores attached.
- iOS is paste-first (no share_target).

## Files/areas touched
- `backend/api/src/import` + `services/pipeline/social-import` (contract-approved), `frontend/src/want-to-go`.

## Acceptance criteria
1. Android share_target (url + text) and iOS paste-box both feed the pipeline.
2. Video-first extraction returns candidate places incl. a purely-visual reel resolved via visual landmark recognition (fixture test).
3. Fast path skips video processing for a high-confidence caption fixture.
4. Confirmation card queue shows name/photo/mini-map/attribution; nothing saves without confirmation.
5. Want-to-go list groups by city + "dream map"; unresolved names retry on next city research.
6. At trip creation, saved places resurface highlighted, priority-boosted, and curate with the group.
7. Honest failure UX renders when nothing is extractable.

## Verification commands
```
cd backend && npm run test && npm run lint && npm run typecheck
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Ingest: Android share_target (url+text) + iOS paste box.
- [ ] Video-first pipeline (Apify fetch → Gemini extract → ground → confirm).
- [ ] Caption fast path.
- [ ] Confirmation card queue (no silent saves).
- [ ] Want-to-go list + dream map + unresolved retry.
- [ ] Resurfacing highlighted + priority-boosted at trip creation.
- [ ] Honest failure UX; tests both sides; Verification commands green.

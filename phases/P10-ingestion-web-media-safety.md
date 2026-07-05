# P10 — Ingestion II: web, media & safety sources

**Goal.** Add the deep-enrichment and safety layers to the City Brain: official sites, blogs/forums/Reddit, YouTube via Gemini, government advisories, open crime data, holidays, Google verification-only, restaurant authenticity, DEM viewshed view-verification, out-of-town access facts, TTL refresh + nightly janitor, and a labeled degrade path for every external source.

**Milestone.** M3 — Intelligence spine.
**Depends on.** P09 (structured skeleton, ingestion scaffolding).
**Parallel-safe with.** P16, frontend phases, backend phases on disjoint areas. P12 depends on it.
**Size.** L.

## In scope (§5.2, §5.4, §5.5)
- **Official sites** (attraction/city/transit operator): hours, prices, pre-booking rules, transit passes → `facts` with source URL + retrieved-at date (operational facts win per §5.3 hierarchy).
- **Blogs / forums / Reddit:** hidden gems, best-time reasoning, scams, tips, scenic routes → **atomic facts only**, never republished prose; ≥2 independent sources for experience claims; per-claim citation.
- **YouTube via Gemini (§5.2, D24):** search-grounded LLM analysis of YouTube coverage as the primary path; Gemini native URL ingestion (paid, low-res, ~$1–4/city) as escalation for thin cities. Store **only derived atomic facts + attribution links**, never transcripts, quotes ≤1 sentence. No yt-dlp / transcript scraping.
- **Gov travel advisories:** US State Dept (public domain), UK FCDO + German AA (open licenses, attributed) → country/city safety baselines.
- **Open crime data:** data.police.uk, Berlin Kriminalitätsatlas, data.gouv.fr → area-level caution shading where available.
- **Public-holiday API:** Nager.Date / OpenHolidays → holiday closures into solver time windows.
- **Google Places verification-only (§5.2):** field-masked, used only where open data fails; **store only `place_id`** (indefinite) + resolve to a genuine OSM/Wikidata record and store *that*; other content never persisted beyond ToS 30-day cache; log fallback rate.
- **Restaurant authenticity doctrine (§5.4, D30):** authenticity score with evidence (local-language review share, local food blogs/forums, "where locals eat"); penalize tourist-trap signals (monument-adjacent + weak local rep, tout multilingual picture menus, one-time-visitor review skew); below threshold → not shown. "What to order" (signature dishes tied to city food identity, cited). Cuisine, dietary flags, price tier, reservation flag, local meal-time customs.
- **DEM viewshed view-verification (§5.5, D55):** line-of-sight from candidate coord toward the claimed target over Copernicus DEM / SRTM (~30 m, offline); terrain blocks → "view unconfirmed", single-source rejected as navigable; store `viewshed_ok`, target, checked_at as facts.
- **Out-of-town access facts (§5.5, D54):** reach modes (car/transit/hike), last-leg distance/surface, parking, seasonal/night closures, land-access constraints; ≥2 sources to state confidently, single → "single report", none → "access unverified — research your route"; solver never auto-schedules access-unverified stops (user-forced only).
- **TTL refresh + nightly janitor (§5.1):** per-fact TTLs (hours 7–30 d, prices 12 mo, best-time/scam 6–12 mo, advisories on source update); nightly janitor re-researches expired high-traffic facts + purges expired ToS-limited geo-observations.
- **Labeled degrade paths for every external source (§13 — mandatory):** Overpass→Geoapify Places; official site miss→"check official site"; advisory feed down→last-known + dated; etc. Missing/failed source → label, never a blank.

## Out of scope
- The LLM pipeline orchestration + job queue + SSE (P11 — this phase provides the source adapters + fact producers it calls). City Brief assembly + screen (P12). Solver consumption of access/holiday facts (P16).

## Key constraints
- YouTube only via Gemini URL ingestion / search-grounded; store only atomic facts + attribution; quotes ≤1 sentence.
- Google content never persisted beyond ToS; only `place_id` durable; never relabeled as open data.
- Safety framing (§16.4): attributed, dated, "commonly reported" language; never certify "safe".
- Recorded HTTP fixtures in CI — no live calls.

## Files/areas touched
- `backend/workers/pipeline/ingestion` (web/media/safety sub-areas), viewshed util, janitor job.

## Acceptance criteria
1. Official-site facts stored with URL + retrieved-at; operational facts win over blogs (integration with P08 resolver).
2. Blog/forum facts are atomic + cited; experience claims below 2 sources are labeled "single report"; no prose stored.
3. YouTube path stores derived facts + attribution only; no transcript stored; quotes ≤1 sentence (test).
4. Advisories/crime/holidays ingested + attributed; holidays feed a closure fact usable by the solver.
5. Google verification stores only `place_id` (+ resolved open-data record); fallback rate logged; ToS 30-day cache enforced.
6. Restaurant authenticity scores computed with evidence; a seeded tourist-trap fixture is excluded; "what to order" cited.
7. Viewshed test flags a terrain-blocked single-source view as "view unconfirmed"/non-navigable (test).
8. Out-of-town access facts produce navigability labels; "access unverified" never auto-scheduled.
9. TTL janitor re-researches expired facts and purges expired ToS-limited observations.
10. Every external source has a labeled degrade path exercised by a failure-injection test.

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate
cd backend && npm run test && npm run lint && npm run typecheck
```

## Resume checklist
- [ ] Official-site fact adapter (hours/prices/passes, cited, dated).
- [ ] Blog/forum/Reddit atomic-fact extraction (≥2-source corroboration, no prose).
- [ ] YouTube via Gemini (facts + attribution only, ≤1-sentence quotes).
- [ ] Advisories + crime data + holidays adapters (attributed).
- [ ] Google verification-only (place_id storage rules, fallback meter).
- [ ] Restaurant authenticity doctrine + "what to order".
- [ ] DEM viewshed view-verification.
- [ ] Out-of-town access facts + navigability labels.
- [ ] TTL refresh + nightly janitor (facts + geo-observation purge).
- [ ] Labeled degrade path per source + failure-injection tests.
- [ ] Verification commands green.

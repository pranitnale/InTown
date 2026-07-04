# InTown — The Ultimate AI Trip Companion — Final PRD

> **Status:** Production specification — the single authoritative PRD, **ready to implement**. Grounded in ten deep-research rounds, both parent apps (the original InTown PRD and the as-built Europe Trip Map app), a survey of the current codebase, and all owner decisions. The complete reasoning trail lives in `LEARNINGS.md`; the verified UI/UX evidence base lives in `UI_UX_RESEARCH.md` (all claims adversarially verified 2026-07-04 — zero refuted).
> **Date:** 2026-07-04 (v2: verified Color System v2 in §17, corrected research claims, parallel work-package implementation plan in §18).
> **⚠️ Codebase directive:** the existing `Frontend_Website/` is a design-era mock (placeholder map, fake generation, hardcoded data) whose only value — the UX flow ideas and lessons — is already absorbed into this document. **It is scrap. WP-0 (§18) deletes it entirely and the architecture starts from scratch.** No code in this repository is to be treated as a foundation; this PRD is the foundation.
> **Vision in one line:** *A traveler normally needs 100+ hours of YouTube videos and blog posts to plan the perfect city trip. InTown reads all of it, verifies it, personalizes it, schedules it, and then walks the trip with you — offline.*

---

## 0. How to read this document

- **📐 Behavior** — the requirement.
- **⚙️ Mechanics** — implementation approach.
- **🧭 Lesson** — carried from a parent app (ET = Europe Trip app, IT = InTown v1) or research, and why.
- **[P1] [P2] [P3]** — delivery phase tags. Everything is specified now; phases only sequence the build.
- **[WP-n]** — work-package assignment (§18): the independently-implementable unit that owns this feature.

**For the implementing model (the "workhorse"):** this PRD is written to be executed without interpretation. The rules of engagement are in §18.2 and are binding: implement exactly what is specified, only inside your work package's file ownership, mocking everything outside it against the frozen contracts. **Never assume, never invent, never "improve" beyond the spec.** If something is genuinely ambiguous or contradictory, stop and return a numbered question list to the supervising session ("conductor") instead of guessing.

---

## 1. Product overview

### 1.1 What it is

A **map-first, multi-user, offline-first AI trip companion** (PWA first, native later). A trip owner invites companions; the group's merged preferences drive a **deep research pipeline** that reads the internet about the city (blogs, forums, YouTube, official sites, open data) and produces a **prioritized longlist of places with rich decision cards** — significance, photos, entry prices, pre-booking needs, best time to visit, safety cautions, all cited. The group **curates** (drag-to-reorder, remove, vote, lock must-dos). The app then **solves** day-by-day itineraries from a chosen start point and time — respecting priorities, geography, opening hours, golden light, weather, meals, and hard departure deadlines — and travels along: offline map, on-demand audio narration, one-tap mid-day replanning, and Google Maps deep links for every leg. Every user action feeds a **learning system**; every trip makes the app smarter. Cities chain into multi-city trips.

### 1.2 Permanent non-goals

- **No booking of any kind** — no trains, flights, hotels, restaurant reservations, tours, tickets, checkout. The app records what users booked elsewhere and links out (official sites, Google Maps) for everything transactional.
- No turn-by-turn navigation of our own — **delegated to Google Maps deep links** (owner decision; Google is better at it, and it removes our hardest infra problem).
- No selling user data. No dark patterns. Trust is the moat.

### 1.3 Positioning

| Competitor | Strength | The gap InTown exploits |
|---|---|---|
| Mindtrip | Best AI grounding | Weak on-the-ground logistics; no real offline; pivoted to agentic *booking* (2026) — leaving our lane |
| Wanderlog | Best maps + group editing | Offline & optimization paywalled; AI bolted-on; no deep research |
| Troupe | Group voting | "Ends where the work begins" — votes never become an itinerary |
| TripIt | Post-booking organization | No discovery, no intelligence |
| Google Gemini | Free research | No persistent itinerary artifact; pushes booking |

**Open lane:** deep verified research + free full offline + group curation that flows straight into an optimized, adaptable itinerary. Nobody does all three.

### 1.4 Decisions of record (owner-confirmed)

| # | Decision |
|---|---|
| 1 | **PWA first**, polished/production-grade; React Native/Expo native app later. Backend is the center of gravity. |
| 2 | **Open-source-first stack** (MapLibre + PMTiles, OSM/Wikidata backbone, self-hosted routing/solver), with Google-Maps-grade map interactions. |
| 3 | **Single city, multi-day** per city plan; **multi-city = chained city plans** connected by user-entered transport legs. |
| 4 | **Full offline in v1 including the interactive basemap.** |
| 5 | **Accounts required** (magic link + Google OAuth). |
| 6 | **Multi-user core:** creator = owner; invite links; roles. **One shared curation list + per-member votes**; disagreement surfaced. |
| 7 | **Ticket links: official sites only** in v1; affiliate links deferred as a labeled later experiment. |
| 8 | **Audio narration generated on demand only** — never speculatively. Cached per (place, language) **on our backend** forever and shared across all users, so each narration is paid for at most once globally. **Audio is never put in offline bundles** (browser-cache bloat) — it streams when online; offline users get the **detailed narration text** instead (full history & significance, §6.13). |
| 9 | **The places database is built on the go** — no world-scale pre-ingestion. Each city's first deep research creates that city's knowledge base ("City Brain"); later trips reuse and enrich it. |
| 10 | **Best-time / crowd knowledge comes from deep research** (blogs, videos, forums — *why* a time is good: light, queues, atmosphere), not from foot-traffic APIs. Cited, corroborated, labeled. |
| 11 | **Turn-by-turn delegated to Google Maps** via per-leg deep links; we own the overview, timing, and *advice* ("take tram T6 — Eiffel views"). |
| 12 | **Safety layer** (scams, thefts, cautions) per city and per area, from openly-licensed government advisories + corroborated community reports, with careful liability framing. |
| 13 | **User feedback loop is first-class:** post-visit prompts to confirm/update prices and info, report closures, rate and review. Community corrections improve the City Brain. |
| 14 | **Traveler data collected at onboarding** (incl. age band, mobility) to curate plans and set smart defaults (e.g., station arrival buffers). Consent-gated personalization (GDPR). |
| 15 | All Eurotrip killer features (ticket/document vault, per-traveler tagging) fully specified here, phase-tagged. |
| 16 | **Source hierarchy is law in deep research** (encoded in prompts + fact model): official sources always win for operational facts (hours, prices, passes); among non-official sources the **newest wins for time-sensitive facts**; stable experiential insights (what to see, photo angles) may still come from older sources. Per-fact-type, not per-source (§5.3). |
| 17 | **Monetization: pay per city.** The user pays once per city itinerary; that purchase covers the deep research (done once) and **unlimited reconfigures/re-solves for that city** (solver runs are near-free). |
| 18 | **Gamification of the on-the-go database:** territory opening ("first InTown traveler here"), themed badges, and community roles (Explorer, Knowledge Keeper, Pathfinder) reward the behaviors that grow the City Brain (§6.21). |
| 19 | **Social import → "Want to go":** users share an Instagram Reel / TikTok link; the app extracts the places into a personal Want-to-go list that resurfaces (highlighted) in the longlist when a matching trip is planned (§6.22). |
| 20 | **Self-hosted on the owner's own VPS(s); no third-party BaaS cloud.** All infrastructure runs on VPS servers we control. Supabase *cloud* is not used (data residency, cost control, no vendor lock-in). (§12.1) |
| 21 | **Backend = the "plainer path": plain PostgreSQL + PostGIS + our own API (Fastify/Next) + Auth.js (a library, not a separate auth server) + object storage (disk/MinIO) + *only* the self-hosted Supabase **Realtime** container** for live collaboration (Broadcast/Presence). The full Supabase stack is **not** run, and Supabase source is **never forked or stripped** — load is reduced by running fewer services, not by editing their code. (§12, §12.1) |
| 22 | **Geocoding: Geoapify (OSM-based) free tier as primary at launch** — free, storable, accurate enough for European cities; self-hosted Photon/Nominatim deferred (RAM/disk heavy). **Google Geocoding/Places used only as fallback-on-miss** verification, storing **only `place_id`** (permitted indefinitely); all other Google content is never persisted beyond the ToS 30-day cache. (§5.2, §12) |
| 23 | **Coordinate-integrity doctrine (anti-fake-location — a traveler must never be sent to a wrong/fake location).** The LLM **never emits coordinates** (hallucination risk). Every coordinate carries a source + confidence; a place is shown as a **precise pin only when ≥2 independent geo-sources agree within ~100 m**, else labeled **"approximate — verify on arrival,"** and unverifiable places are not offered as navigable destinations. First-traveler GPS confirmation closes the loop. **Provenance is a fact, not a relabelable tag — a Google-derived coordinate is never stored as OSM.** (§5.5, §7, §14) |
| 25 | **Two dedicated deployable folders: `Frontend/` (React PWA → Vercel) and `Backend/` (API + Python services + data → owner's VPS), joined only by a shared frozen `contracts/` seam.** Every build work package is purely frontend or purely backend (§18), matching the `frontend-implementer`/`backend-implementer` role split and letting the two deploy independently now (Vercel + VPS) or co-locate on one server later with zero code change. No user data/API/DB ever lives on Vercel (§12.1). |
| 24 | **Out-of-town scenic places: existence is not the whole promise — reachability and the view itself are verified too.** A hidden viewpoint outside the city (the classic Instagram-photo-spot case) can have a correct coordinate and still burn a traveler's afternoon. So: (a) navigable out-of-town destinations require corroborated **access facts** (reach modes — car/transit/hike, last-leg distance, seasonal closures, private-land constraints) or carry an explicit **"access unverified"** label and are never auto-scheduled; (b) claimed views are sanity-checked with a **DEM viewshed line-of-sight test** (free, open elevation data). (§5.4, §5.5, §8, §14) |

---

## 2. Goals & success criteria

1. **Replace 100+ hours of research.** A user gets a curated, cited, personality-matched longlist in minutes (warm city) or under ~15 minutes (first-ever research of a city).
2. **Zero manual cross-checking needed:** hours, prices, pre-book requirements verified + cited or honestly marked unknown. ≥95% of displayed facts cited-or-N/A (hard validation gate).
3. **Plans feel personally authored:** every place carries "why this fits you/your group."
4. **Most reliable on-the-ground companion in the category:** the entire plan — map included — works in airplane mode; mid-day replans in ≤5s.
5. **The app compounds:** every trip enriches the City Brain and the ranking algorithm, measurably (replay-harness metrics, §9.4).
6. Success metrics: edits-per-longlist ↓ over algorithm versions; top-5 visited rate ↑; % facts later corrected by users ↓; D7 retention of trip-completers; cold-city research cost ≤ $5, warm-city marginal plan cost ≤ $0.05.

---

## 3. Personas & core journeys

**Personas:** the Planner-Owner (organizes, invites, curates hardest), the Companion (joins, votes, follows along), the Spontaneist (lands, wants a great *today* in minutes), the Curious Walker (stands before a monument, plays narration, asks "what's around?"), the Senior Traveler (larger buffers, lower pace, mobility filters — served by profile defaults, never stereotyped: all defaults editable).

**Core journeys:**
1. **Onboard:** sign up → traveler profile (age band, mobility, languages, pace) → taste profile (ranked interests, dislikes, dining rules, budget) → personalization consent choice.
2. **Group forms:** owner creates trip (city, dates) → shares invite link → members join with their own profiles → app shows the merged constraint/preference picture.
3. **Research:** staged, visible pipeline ("reading 34 blog posts and 22 videos about Lisbon… verifying opening hours… found 61 candidates") → prioritized longlist.
4. **Curate together:** drag, remove, vote, lock must-dos, open decision cards, add own finds; disagreement chips; live presence.
5. **Build days:** start anchor (current location / accommodation / custom) + start time; departure anchor if leaving ("train at 16:00, station X") → solved itinerary on the map.
6. **Download trip** → fully offline bundle.
7. **Travel the day:** you-are-here, leave-by countdowns, tap stop → card + on-demand narration; per-leg "Open in Google Maps"; "I'm hungry now"; weather nudge; **"Take me to #1 NOW"**; "It's closed!" → instant replan + report feeds the Brain.
8. **Wrap the day:** sliders + per-stop 👍/👎; post-visit micro-prompts ("Did you visit X? Price still €22? Quick review?").
9. **Chain the next city** → repeat; the trip becomes the whole vacation.

---

## 4. Information architecture

| Route | Auth | Purpose |
|---|---|---|
| `/` | public | Landing. |
| `/auth/*` | public | Sign-in/up. |
| `/onboarding` | gated | Traveler + taste profile, consent. |
| `/trips` | gated | Trip list; "New trip." |
| `/trips/new` | gated | Setup wizard. |
| `/join/:code` | public→auth | Invite landing (role preview → sign-in → join). |
| `/trips/:id` | gated | Main surface: map + day tabs + timeline; companion mode on travel days. Offline-capable. |
| `/trips/:id/curate` | gated | Longlist curation (list + map split). |
| `/trips/:id/city-brief` | gated | City essentials (safety, scams, transit passes, etiquette, holidays, emergency numbers). |
| `/trips/:id/generating` | gated | Research/solve progress (SSE-streamed stages). |
| `/settings` | gated | Profiles, language, consent, storage/offline manager, data export/delete. |
| `/offline` | public | Offline vault (bundles, documents). 🧭 ET: public so the SW can pre-cache without an auth bounce. |
| `/reviews-policy`, `/moderation` | public | Omnibus/DSA disclosure pages (§16). |

Responsive model (🧭 ET): one codebase; desktop = fixed right side-panel, mobile = bottom drawer; **single mutually-exclusive selection state machine** (one of {stop, POI, leg, day} selected at a time).

---

## 5. The City Brain — the per-city knowledge base [P1, grows forever]

The central asset. **Built on demand, city by city, by the first trip that needs it; enriched by every subsequent trip and by user feedback.** No global pre-ingestion.

### 5.1 Lifecycle

1. **Cold city** (first request ever): pipeline builds the Brain — quick skeleton from open data (OSM/Wikidata/Wikipedia: places, geos, hours, photos) in ~1–2 min, then deep enrichment (blogs, forums, videos, official sites, advisories) streams in over ~5–15 min. User sees honest staged progress; can start curating from the skeleton; push notification when full research lands.
2. **Warm city:** subsequent trips read the Brain instantly; the pipeline only personalizes + verifies staleness. Marginal cost ≈ LLM scoring only.
3. **Refresh policy:** per-fact TTLs — opening hours 7–30 days (re-verified near each trip's dates), prices 12 months (prices change each January), best-time/scenic/scam facts 6–12 months, advisories on source update. A nightly janitor re-researches expired high-traffic facts.
4. **Growth:** every trip's grounding pass, every user correction, every review enriches the Brain. The moat compounds.

### 5.2 Sources & ingestion

| Source | What it provides | Method & posture |
|---|---|---|
| OSM — **bulk tag sweep via the Overpass API** (Overpass QL over a live OSM mirror; kumi.systems primary, overpass-api.de fallback) | Places, geos, categories, `fee` flag, wheelchair tags, viewpoint `direction` — **including unnamed nodes no geocoder can surface** (e.g. an unnamed `tourism=viewpoint` outside the city — the hidden-scenic case, §5.5) | Bulk, legally storable. One-time per cold city → a handful of queries per Brain build, well within public-instance fair use; **degrade path: Geoapify Places API** (same open data, managed) → self-hosted Overpass later if volume demands |
| Wikidata / Wikipedia | Significance, facts, images (P18), prominence | API, storable, attributed |
| Wikimedia Commons (GeoSearch) | Photo galleries | Storable + attribution per license |
| Official sites (attraction, city, transit operator) | Hours, prices, pre-booking rules, transit passes | LLM web research; **facts stored with source URL + retrieved-at date** |
| Travel blogs & forums (incl. Reddit) | Hidden gems, best-time reasoning, scams, tips, scenic routes | LLM research; **atomic facts only** (never republished prose); ≥2 independent sources for experience claims (corroboration threshold); per-claim citation |
| **YouTube** (as a research source) | The richest "what's it actually like" signal; best-time, queue tips, scams, which places matter | **Primary (owner decision): the deep-research prompt explicitly instructs the search-grounded LLM to analyze YouTube coverage** of the city (video titles, descriptions, surfaced transcript content, comments) alongside blogs — cheap, part of the same research pass. **Escalation for thin-coverage cities:** Gemini native YouTube-URL ingestion of the top ~10–20 videos (paid tier, low-res, ~$1–4/city). Either way: extract structured facts with video URL attribution, **never store or display transcripts**, quotes ≤1 sentence. yt-dlp/transcript-scraping explicitly rejected (ToS + active litigation). |
| Gov travel advisories (US State Dept — public domain; UK FCDO + German AA — open licenses with attribution) | Country/city safety baselines | API/feeds, storable, attributed |
| Open city crime data (data.police.uk, Berlin Kriminalitätsatlas, data.gouv.fr…) | Area-level caution shading where available | Per-city, openly licensed |
| Public-holiday API (Nager.Date / OpenHolidays — free) | Holiday closures into solver time windows | API, storable |
| **Geoapify** (OSM/OpenAddresses/GeoNames), free tier | **Primary geocoding + search-to-add + name resolution** (forward/reverse); coordinates for user-typed addresses and researched place names | Free tier ~3,000 credits/day (~90k/mo), 1 credit/geocode; **results storable (open data)**; debounce autocomplete. Self-hosted Photon/Nominatim deferred (RAM/disk heavy). |
| Google Places / Geocoding (New), field-masked | Verification of hours where open data fails; live photo fallback; **fallback-on-miss geolocation** where no open-data place exists | **Only `place_id` stored (permitted indefinitely); all other content never persisted beyond ToS's 30-day cache.** Used as a *search hint* → resolve to a genuine OSM/Wikidata record and store **that** (never relabel Google coordinates as OSM); log fallback rate. Verification layer only. |
| **Users** (§6.15) | Corrections, closures, price updates, ratings, reviews, visit durations | First-party, verified-visit labeled |

### 5.3 The atomic-fact model

⚙️ Every researched claim is stored as an **atomic fact**: `(entity, attribute, value, source_url, source_kind, observed_at, confidence, corroboration_count, status)`. Display rules: facts shown only with citation; experience claims (best-time, scams, "worth it") require ≥2 independent sources or get a "single report" label; user corrections create competing facts resolved by moderation rules (§6.15). This model is what makes "read the whole internet" safe: we never assert — we attribute.

**Conflict-resolution hierarchy (owner decision #16, enforced in the research prompts AND in fact selection):**
1. **Official source always wins for operational facts** — opening hours, prices, pass tariffs, booking rules from the venue's/operator's own site beat any blog, however recent.
2. **Among non-official sources, recency wins for time-sensitive attributes** — a March blog says hours are 7–9, an April blog says 9–10 → the April value is taken (and flagged for official verification).
3. **Stable experiential insights are recency-tolerant** — "the crypt is the highlight," "best photo angle from the west terrace" may come from the older source even when its hours are discarded. Selection is **per fact type, never per source**: one blog can win on crowds and lose on hours.
4. Verified-visitor corrections (§6.15) outrank stale citations of any kind after N confirmations.
The deep-research prompt states these rules explicitly and requires the model to record which rule selected each value.

### 5.4 What the Brain knows per place

Identity (name, aliases, geo, category — **one unified enum**: SIGHT, MUSEUM, VIEWPOINT, PARK_NATURE, ENTERTAINMENT, NIGHTLIFE, SHOPPING, RESTAURANT, CAFE, OTHER; 🧭 ET gap: three conflicting taxonomies), significance + description, photos, opening hours + holiday exceptions, **entry: free/paid + price + currency + source + as-of** — sourced in layers (D26: no structured global admission-price source exists — verified dead ends: Wikidata fee ≈ 4.4K items, Google priceLevel food/retail-only): OSM `fee` flag for free/paid at scale → **LLM-cited official prices for the top ~500 attractions per city, refreshed yearly** (prices change each January) → post-visit user corrections → long tail honestly shows "check official site", never guessed — **booking requirement enum** (walk-up OK / recommended / timed entry / sells out weeks ahead + advance window) — backed by a **curated pre-booking knowledge base** (D27: no structured source exists; only ~200–400 attractions worldwide need the flag → a quarterly-refreshed curated table, which also feeds the §6.16 booking-deadline push notifications), **best-time windows with reasons** ("sunrise: empty + best light on the east façade — 3 sources"), typical visit duration (category prior → Bayesian per-place posterior from real visits), indoor/outdoor/mixed, effort/accessibility (wheelchair, stairs, stroller), **cautions** (pickpocket hotspot, common scam patterns — attributed), scenic-approach notes, **access facts for out-of-town / remote places** (owner decision #24: reach modes — car/transit/hike — with last-leg distance, seasonal closures, land-access constraints; corroborated like any experience claim, else "access unverified" — §5.5), official links, user rating aggregate + reviews, web-sentiment score (until own ratings reach critical mass).

**Restaurants — the authenticity doctrine (owner decision):** the app recommends **only places where locals actually eat**; tourist traps are explicitly hunted and excluded, not just deprioritized. Per restaurant the Brain stores:
- **Authenticity score with evidence** — the research prompt is instructed to weigh *where locals recommend eating* (local-language reviews and their share vs tourist-language reviews, local food blogs/forums, "where locals eat in {city}" coverage) and to **penalize tourist-trap signals** (front-of-monument location + weak local reputation, tout-style multilingual picture menus, review patterns skewed to one-time visitors). Below threshold → not shown, period.
- **"What to order"** — the signature dishes of *this* place and how they connect to the city's food identity, cited ("order the cacio e pepe — the Roman classic this trattoria is known for; 3 sources"). Most travelers want to eat authentic — every restaurant card answers *what* and *why*.
- Cuisine, dietary compatibility flags (per §6.2 rules), price tier, reservation-needed flag, local meal-time customs (dinner at 21:00 in Spain — feeds the solver's meal windows).
The **City Brief** (§5.6) additionally carries the city's **food identity**: the dishes this city is famous for, and the best cited place in the plan (or Brain) to try each one.

### 5.5 Entity resolution (the on-the-go DB's hard problem)

⚙️ Every ingest path (OSM import, LLM research mention, user add, Google verification) resolves to one canonical place: match by external IDs (osm_id, wikidata_id, google place_id) first, else fuzzy name similarity + geo distance (<150m) + category compatibility; below threshold → new place flagged `unverified` until grounded. Merges keep all source_refs; unmerge tooling for mistakes. Without this, the Brain fills with duplicates and the learning system's signals fragment.

**Coordinate provenance & confidence — the anti-fake-location doctrine (owner decision #23).** The worst failure the app can commit is sending a traveler to a wrong or non-existent location; false precision is worse than an honest "approximate." Two rules make this bulletproof:

1. **The LLM never emits coordinates.** Deep research may *name* a place and describe its rough area, but a coordinate must always come from a geospatial source — models hallucinate plausible-but-wrong lat/lng. Encoded as an architecture law (§7) and a validation gate (§14).
2. **Every coordinate stores `source`, `confidence`, and `verified_by`** (open-data / cross-referenced / first-traveler-GPS). Provenance is a *fact*, never a relabelable tag: a coordinate that came from Google is Google-derived even if a matching OSM node is later found — you store the *genuine OSM value you read from OSM*, not Google's number under an OSM label.

**Resolution cascade for a researched or obscure place** (e.g., a scenic viewpoint outside the city, a spot from a Reel), tried in order, each attaching source + confidence:
1. **OSM** — viewpoints are first-class (`tourism=viewpoint`); coverage in Europe is excellent.
2. **Geotagged photos** — Wikimedia Commons / Flickr-CC GPS clusters (huge for scenic spots; storable, attributed).
3. **The source's own geodata** — a Google-Maps link or embedded geotag scraped from the blog/reel (the author's own pin).
4. **Visual landmark recognition** from the shared video (§6.22 Gemini pipeline) → grounded against place search with a confidence score.
5. **Google fallback-on-miss** (§5.2) — store only `place_id`, hydrate live; where possible resolve to a genuine OSM/Wikidata record and store that.

**Display gate (parallels the citation-or-N/A gate, §14):** precise pin only when **≥2 independent sources agree within ~100 m**; single/weak source → **"approximate area — verify on arrival"** (never a confident point); unverifiable → not offered as a navigable destination. The **first traveler's GPS confirmation** (§6.15) promotes an approximate place to verified and is rewarded via territory-opening (§6.21) — obscure spots get confirmed by the people who actually go, and the Brain grows more accurate.

**Accuracy compounds over time — the append-only geo-observation log (owner decision).** Every geolocation signal we ever see for a place is kept as an **observation**, never overwritten: `poi_geo_observations(poi_id, source_kind, lat, lng, accuracy_m, observed_at, expires_at, confidence)` — OSM/Wikidata nodes, geotagged Commons/Flickr photo clusters, scraped source map-links, visual-recognition hits, and **first-traveler GPS fixes**. The **canonical coordinate + confidence on `pois` is derived** from this log (consensus of independent, in-license observations, recency-weighted for GPS), and it **tightens with every trip** — the same compounding-moat logic as the City Brain's facts (§5.1) and the learning system (§9), applied to *location*. Two provenance rules keep it clean and legal:
- **ToS-limited sources carry an `expires_at`.** A Google fallback lat/lng may be held **only as a temporary cache where the applicable Google service terms allow it (≤30 days), then purged** — it is an *observation with an expiry*, never the persisted canonical value. The durable Google reference is the `place_id` (storable indefinitely); the durable coordinate is the consensus derived from storable sources + user GPS.
- **Provenance is never rewritten.** An observation keeps its true `source_kind` forever — a Google-derived fix is never relabeled as OSM (a ToS breach *and* silent data poisoning). This is also what lets us audit and, later, learn *which sources are most reliable per region*.

**Out-of-town scenic places — reachability & view verification (owner decision #24).** The coordinate doctrine guarantees a place *exists at that coordinate*; for the remote-scenic case (a free hidden viewpoint outside Prague, a hilltop outside an Indian city — the Instagram-photo-spot scenario), existence isn't the whole promise. A real coordinate on a ridge can still burn an afternoon if the last 2 km are a private road, the trail is seasonally gated, or the blog assumed a car and there's no transit. Two additional checks apply to any place beyond the city's walkable core:

1. **Access facts are required for navigability.** Deep research must extract *how to get there* as atomic facts (§5.3): reach modes (car / transit / hike / combination), last-leg distance and surface ("bus 361 to Třebaň, then 1.8 km uphill on unpaved trail"), parking reality, seasonal or time-of-day closures (gated at night), and land-access constraints (private property, permits). These are experience claims — **≥2 independent sources to state confidently, single source → labeled "single report"; no access information at all → the place carries an explicit "access unverified — research your route before going" label.** The solver never auto-schedules an access-unverified out-of-town stop (§8); a user can still force-add it, with the label shown. Access facts are corrected by the same post-visit loop as everything else (§6.15) — the first traveler who reaches it confirms both the pin *and* the route.
2. **The view itself is verified — the DEM viewshed test.** For places whose claimed value is a view ("panorama of the city," "sunset over the old town"), run a **line-of-sight check from the candidate coordinate toward the claimed target** using open elevation data (Copernicus DEM / SRTM, ~30 m resolution — free, storable, computable offline). Terrain blocking the sightline → the claim is flagged, the place is demoted to "view unconfirmed," and single-source cases are rejected as navigable destinations. A coordinate that passes both the ≥2-source gate *and* the viewshed test is as fake-proof as pre-visit verification gets; geotagged photo clusters (cascade source #2) already prove the view where they exist, so the viewshed test mainly hardens the single-source "approximate" cases. Results are stored as verification facts (`viewshed_ok`, target, checked_at) on the POI, in the same fact model as everything else.

📐 One screen per city, researched with the Brain [P1]: safety overview + common scams ("commonly reported by travelers," attributed, dated), pickpocket hotspots, **transit-pass advisor** (cards/passes with cited prices; §6.11), **the city's food identity** (the dishes it's famous for + the best cited local place to try each — §5.4 authenticity doctrine), etiquette + tipping + local meal times, tap-water safety, public holidays during the trip ("Monday is a holiday — many museums closed"), emergency numbers, local SIM/connectivity note. Framing rules (§16.4): warn freely, never certify anything "safe."

---

## 6. Feature specifications

### 6.1 Accounts & traveler profile [P1]

📐 Sign-in required (magic link + Google OAuth). **Traveler profile:** name, **age band aligned to European pricing boundaries** — <18 / 18–25 / 26–44 / 45–64 / 65+ (data-minimized: band, never birthdate) — plus **EU/EEA residency** (yes/no) and **student status**, because attraction discounts hinge on all three (under-26 EEA free at French national museums; 65+ reduced in Italy but *not* France; ISIC student rates); mobility (full / limited / wheelchair / stroller), languages, home currency. Drives editable defaults: pace preset, dwell padding, walking budget, **departure buffers** (§6.8), heat-aware scheduling, accessibility filtering, and the **price engine** ("free for you" detection). **Anti-ageism rule (research: 61% of families report grandparents more active than expected; most design research carries ageist assumptions): age pre-selects a pace preset the user sees and can change — it never caps anything.** Full GDPR export + deletion.
⚙️ Supabase Auth (or Auth.js + Postgres); httpOnly sessions, revocable server-side (🧭 ET gap: constant-payload cookie), rate-limited auth + research endpoints. RLS multi-tenant from day one (🧭 ET gap: hardcoded trip, no scope checks).

### 6.2 Taste profile [P1]

📐 Drag-ranked interests + custom; **anti-preferences first-class** ("skip museums," "no crowds"); dining rules; budget tier; pace; companions default. Evolves from feedback events, transparently ("Your profile learned: museums ↓ — undo?"). Consent-gated (§16.1) with a functional non-personalized mode.

**Progressive profiling — the friction law (research-backed, claim corrected 2026-07-04):** no successful travel app front-loads a profile form (Mindtrip, Wanderlog, Airbnb all collect at trip time or infer from behavior). **Field count adds friction directionally, but no universal per-field percentage exists** — the once-cited "~3–5% per field" is unsourced practitioner folklore (verification: UI_UX_RESEARCH.md §8.2 Q5; Baymard's finding is that what matters is *default-visible* fields — typical checkouts show ~2× the fields needed). Meanwhile a *quiz whose every answer visibly changes the output* increases engagement (Headspace: +7.6pp course starts from a short personalization quiz; Duolingo's long onboarding works because each answer alters the experience). The rule: **ask a question only at the moment its answer visibly changes what the user gets, and never ask at signup what can wait.** **Endowed-progress rule (verified — Nunes & Drèze 2006, 34% vs 19% completion):** the quiz progress bar starts with a *genuinely earned* first step pre-completed ("City selected ✓ — 1 of 6") — never an arbitrary fake head-start; a real reason for the endowment is what makes the effect work.

| Moment | Collect | Why here |
|---|---|---|
| First open (pre-signup) | **Nothing.** Beautiful sample itinerary + "Plan my trip" CTA | Value before ask |
| Trip creation ("the quiz") | Destination, dates, companions (incl. kids' ages) + **adult age bands** (chips, skippable, "helps us with ticket prices & pacing"), pace (packed↔relaxed), budget band, **dietary rules** (one multi-select screen) — **5–6 one-tap screens, progress bar, one question per screen** | Trip-scoped and each answer visibly shapes the research. Dietary is asked here (owner decision): it's a hard group veto users expect in a travel quiz — though architecturally it's a *filter over the City Brain's restaurant pool*, so it can be changed anytime with instant re-ranking, no re-research. Age unlocks tiered ticket prices + pacing defaults (§6.7, §8). |
| Same flow, gamified | Interests via **10–15 photo-card swipes** ("into this?") instead of checkbox lists; drag-rank only the survivors | Pairwise/swipe elicitation beats ratings for cold start and feels like play |
| Sign-in gate | Email/SSO only — placed **when research starts / to save the trip** (peak motivation) | Accounts are required (decision #5), but the gate sits *after* momentum builds, never before the quiz |
| During curation | Interest refinement from keep/remove/tier behavior; dietary edits welcome (instant re-filter) | Behavior > declaration |
| First plan / on the go | Walking tolerance & mobility (asked when a day exceeds ~8 km: "how does ~8 km of walking sound?"), start-time preference | Walking is a *solved* problem post-research — the solver just re-clusters; safe to ask late |
| Post-trip / second city | Ratings of visited places, profile confirmations | Deepest data after trust is earned |

**Interest weights vs exclusions (the museum problem, owner-raised):** a low interest ranking is a **soft weight, never an omission** — "museums ranked low" means fewer museums and only exceptional ones; the city's defining sights can override a *low* weight on prominence ("shown despite low museum interest — it's Paris's defining collection. Remove?"). A hard **exclusion is a separate, explicit control** ("Never show me: ☑ museums") and is honored absolutely. Photo swipes initialize the soft weights; the curation tiers + drag set the real per-trip priorities; nothing is silently dropped, everything explains itself.

Every stored answer must later surface as a visible **"because you said X" chip** — personalization users can see is personalization users believe (the Headspace effect).

### 6.3 Trips, membership & collaboration [P1]

📐
- Creator = **Owner** (delete trip, dates/city, manage members + roles, transfer). **Editors** curate, vote, generate, edit stops, upload docs. **Viewers** read + download offline bundle (documents only if shared to them — TripIt pattern).
- **Invites:** share link with embedded role, expiring + revocable; email optional. Covers the "6 people in a group chat" reality.
- **One shared curation list + votes** (owner decision): anyone with edit rights reorders/removes; every member votes 👍/👎 per place; attribution on every action ("moved up by Ana").
- **Preference merge:** hard constraints (dietary, mobility, budget caps) = **filters** — anyone's "no pork" governs all meal picks; trivially explainable veto. Soft interests = **average-with-misery-threshold** (a place any member vetoes or scores very low is excluded or flagged — the empirically user-preferred strategy in tourism group-recommender studies; Masthoff line). **Disagreement always displayed** ("3 of 4 want this") — **claim corrected 2026-07-04 (UI_UX_RESEARCH.md §8.3 Q1): the fairness carrier is the merge *strategy* itself, not explanation prose** (Barile et al., UMUAI 2023, N=399+288: explanations added no measurable fairness benefit; dictatorship-like strategies are punished — Najafian et al., ACM Hypertext 2020). The chips are kept as *transparency*, with two hard rules: (a) **preference disclosures are aggregate counts only** ("3 of 4"), never named attribution ("Ana vetoed this") — naming the dissenter raises privacy concern, worst for a minority-of-one (Najafian et al., UMAP 2021); (b) collaboration *actions* (who dragged, who added) remain attributed — that's edit history, not preference exposure. Optional misery chip ("nobody rated this below 2") maps onto users' native fairness intuitions. Fairness rotation across days ("today leans Alice") designed-for, shipped [P3].
- One shared itinerary per trip (the group moves together).
⚙️ Supabase Realtime **Broadcast** (broadcast-from-DB triggers, sub-50ms) + **Presence** (avatars, "viewing" indicators). Postgres is the single source of truth; per-column LWW with server timestamps; optimistic UI reconciled on broadcast; **fractional indexing** for order (string keys, only the moved row written, jitter against concurrent inserts, periodic rebalance — the Figma pattern; `fractional-indexing` npm). **CRDTs deliberately rejected** — unneeded for row lists.

### 6.4 Trip setup [P1]

📐 Redesigned to the progressive-profiling map (§6.2): city + dates + arrival/departure times → companions → pace → budget band (one-tap screens, progress bar with endowed first step per §6.2) → **photo-swipe taste round** (first trip only; later trips show the profile pre-filled with a "still you?" confirmation) → accommodation anchor (location / address / skip) → transport mode → must-see + avoid lists (optional, skippable). Luggage-storage flag and departure deadline collected on the departure-day sheet, not upfront. Under 2 minutes for returning users. **Built from scratch per this spec** — the old `Frontend_Website` wizard is deleted with the rest of the mock frontend (WP-0); its only surviving contribution is the flow idea, which this section now fully specifies: one question per screen, visible plan-shaping feedback ("family mode: shorter walks, playground stops ✓").

### 6.5 Research pipeline UX [P1]

📐 Staged and visible, never a blind spinner — this is the **Labor Illusion** deployed deliberately (Buell & Norton, Management Science 2011, verified: users can *prefer* a travel search showing its work over instant identical results and value the result more; tested waits were 10–60s; the effect requires the shown work to be *real* — fake-looking waits backfire). Stream a live research log echoing the user's own interests — "Reading 34 blog posts and 22 videos about Lisbon…", "Cross-checking opening hours on official sites…", "Checking safety notes and common scams…", "Scoring 61 candidates against your group's tastes…" — **with pins dropping onto the map live as places are found**, and results streaming into skeleton cards day-by-day. **Skeleton claim corrected 2026-07-04 (UI_UX_RESEARCH.md §8.2 Q3): "skeletons feel faster" is folklore-grade (mixed, weak evidence)** — skeletons are used here for *layout stability* and as scaffolding that **populates with genuine partial results** (which shifts the mechanism onto the well-evidenced labor illusion, not perceived-speed claims); use a left-to-right shimmer (beats pulsing in the only empirical comparisons), never an empty pulsing skeleton for long waits. The slowest moment becomes the most persuasive one. **Peak engineering (peak-end rule, verified):** the "your itinerary is ready" reveal is a designed peak moment — camera flyover of the pinned days + the one-line "why this trip fits your group" — not a plain list render. **Cold city:** the honest, simple message (owner decision): *"InTown is researching {city} — we'll notify you as soon as your itinerary is ready."* The user can leave; a push lands on completion. (A skeleton preview may still render early where useful, clearly marked "research in progress.") **Warm city:** longlist in seconds; only staleness re-verification runs. Partial source failures degrade gracefully (labels, not blanks; 🧭 ET reliability doctrine).

### 6.6 The curation stage [P1]

📐 The product's heart. The pipeline outputs a **prioritized longlist** (~2× plannable count; e.g., 30–40 for 3 days), best-fit first.
- **Rows:** photo, name, category, one-line significance, "why it fits you/your group," fee badge (Free / €12 / ?), pre-book warning badge, est. duration, caution badge if applicable, vote chips (group).
- **Interactions:** **priority tiers + drag**: the list is grouped into **Must-see / Want / Maybe** tiers (tier judgments are cognitively cheaper than globally ordering 40 items — pairwise-elicitation research), with **drag-to-reorder** inside and across tiers as the fine-grained priority signal (explicit **drag handles**, never whole-card long-press — it fights scrolling; haptic bump on grab, elevation lift, ~100ms settle, auto-scroll at edges, plus an accessible non-drag fallback "move to…" menu). Also: **remove** (undo tray + restore), **lock must-do** (terracotta must-see badge, §17.4 — hard solver constraint), **vote**, tap → decision card, **add own places** (search or map tap → appended, attributed), map/list split with numbered pins mirroring the list.
- The list is the contract: **only kept places enter the itinerary; the order is a priority weight, not a visit sequence** (the solver decides sequence — §8).
- Every interaction becomes a learning event (§9). Footer CTA: **"Build my days."** Curation is revisitable anytime; changes re-solve.

### 6.7 Decision cards [P1]

📐 Everything needed to decide, one screen: photo gallery (Commons-first, attributed) · full description + significance (cited) · "why this fits" · opening hours for the trip dates (cited or "N/A + official link", holiday exceptions flagged) · **Entry: full age/status tariff table where published** — stored as `{tier, age_range, residency_condition, price, ID_required}` (adult / child / youth / senior / student + free-entry rules: EU under-26, first-Sunday-free, 65+ reductions — residency and ID requirements are first-class, since most discounts are conditional on them), with the **group's own price** computed from member profiles and **"Free for you" highlighted** ("Maria enters free — under-26 EEA; bring ID") · price source + "as of" date · **Booking:** walk-up OK / book recommended / **timed entry — book ~6 weeks ahead** + official ticket link (only) · **Best time to visit** with the *reason* ("sunrise: empty + golden light — per 3 blogs & 2 videos") · computed golden-hour window for photo spots (suncalc, offline) · typical duration (editable) · cautions ("pickpocket hotspot — commonly reported") · accessibility notes · user ratings + reviews (+ web-sentiment until critical mass) · website · all citations tappable.
Actions: remove / must-do / vote / note / share. Honesty rule everywhere: **unknown = "unknown — check official site," never guessed.**

**Citation & uncertainty UX doctrine (verified evidence, 2026-07-04 — UI_UX_RESEARCH.md §8.2 Q1–Q2):**
- Citations raise trust even superficially, **and trust collapses when a user checks a citation and it doesn't support the claim** (Ding et al., AAAI 2025). The §14 citation gate is therefore a *trust* feature, not just a quality gate: a displayed citation must actually contain the displayed fact.
- **Medium transparency beats maximal:** default display = source name + one-line rationale ("per the official site, March 2026"); full provenance (all sources, retrieved-at dates, which conflict rule selected the value) lives one tap deeper (Kizilcec CHI 2016: raw-detail dumps erode trust).
- **Honest uncertainty does not erode trust — it inoculates it against errors** (Joslyn & LeClerc 2012; van der Bles PNAS 2020). Rules: labels are *specific and numeric*, never vague hedges — "hours unconfirmed as of {date}", "±10 min", "approximate — verify on arrival" — and attach only to decision-relevant facts (hours, prices, departure times, coordinates); no blanket hedging.

### 6.8 Building the days: anchors, times, deadlines [P1]

📐
- **Start anchor:** current GPS location / accommodation / any picked point. **Start time:** explicit for day 1 ("start from here at 13:30"); later days default from accommodation at the profile's pace-based start time; all editable per day.
- **Departure anchor (hard deadline):** "I must be at Gare de Lyon at 16:00" → the last day's route **ends at the station with arrival at 16:00 minus buffer**. **Buffer defaults by transport kind and age band** (baseline: train 45 min, flight 2h30, bus/ferry 40 min; +15–30 min for 60+ or limited mobility, −10 min for 18–29 fast pace) — always shown and editable ("arrive 45 min early — change?"). Missing a booked train is the worst failure the app can cause; buffers are conservative by default. Same mechanism for any hard appointment mid-trip (booked timed-entry tickets become locked time windows).
- **Departure-day logistics:** the user declares whether they'll have **luggage to store** that day (simple toggle at trip setup / departure-day sheet). If yes, the solver knows checkout time vs departure time and schedules **luggage storage** (lockers/staffed storage are first-class POIs in the Brain) or keeps the last stops near the station, and says so ("stored luggage at Central Lockers 11:00, €8/day — cited"). If no, no storage stop is forced.

### 6.9 The plan view [P1]

📐 As v2, confirmed: full-bleed MapLibre map, **day tabs that actually filter content** (🧭 ET gap), Now/Next timeline linked to the map (tap ↔ fly, time-scrub), colored+patterned mode segments with direction arrows, numbered category pins + terracotta must-see badges (§17.4) + strikethrough closed states, meal slots as first-class entries with one-tap alternates, weather ribbon with proactive nudges, you-are-here dot (ref-counted watchPosition — 🧭 ET), **budget line per day** ("~€47 in entries today") summing cited prices. Every plan change appends a **plan revision** (restore anytime — 🧭 ET gap #1, clobbering made structurally impossible).

### 6.10 The map platform [P1]

📐 Google-Maps-grade interactions on open source: tap **any** POI → place card (Brain-backed; add-to-day, navigate) · "places around" category browse ranked by fit · city-biased search-to-add (🧭 ET: search is an *add* action) · long-press ad-hoc route preview.
⚙️ MapLibre GL JS + Protomaps PMTiles (self-hosted/CDN); our POI layer served as vector tiles from PostGIS; `queryRenderedFeatures` for basemap POIs; Geoapify geocoding at launch (self-hosted Photon/Nominatim deferred), Google fallback-on-miss (§5.2); OSRM/Valhalla self-hosted for walk/drive times **feeding the solver matrix**; transit *times* approximated (Transitous/OTP where available, else conservative estimates) because step-by-step transit is delegated (§6.11).

### 6.11 Getting around: Google Maps delegation + scenic legs + pass advisor [P1]

📐
- Each leg shows our summary (mode, est. duration, leave-by) and an **"Open in Google Maps" deep link** with origin, destination, and travelmode (transit/walking/driving) — Google handles live departures, platforms, and turn-by-turn. ⚙️ `https://www.google.com/maps/dir/?api=1&origin=…&destination=…&travelmode=transit` (+ `destination_place_id` when known). Caveat stated in-app: Google chooses the exact line; our advice may differ.
- **Scenic-leg annotations:** the Brain stores researched scenic routes ("Tram 28 crosses Alfama — the classic ride," "Line T6 has direct Eiffel views") as leg-level facts; the solver gives scenic legs a small prize bonus, and the leg card shows the tip with citation.
- **Transit-pass advisor** — its own section in the app (reachable from City Brief and the plan), researched **as part of the city deep research** (a dedicated LLM research step against the transit operator's official site): all pass tariffs (single, 24h, 48h, 72h, weekly, tourist cards), **where and how to buy** (machines, apps, kiosks — including how to buy offline/without a local SIM), validation rules. The plan view then does the math: counts the plan's transit legs → "12 rides across 3 days → the 72h pass at €22 beats €1.90 singles — source: operator site," with official purchase link. All prices cited + as-of dated.

### 6.12 Adaptation [P1]

📐
- **Reconfigure:** solver-only re-solve of the remaining day from current time+location; diff shown; ≤5s.
- **"Take me to #1 NOW":** route to the pinned place renders instantly; the rest of the day re-solves in the background with that place forced next (warm-started, <1s solve); diff sheet ("Dropped 2 stops; dinner → 20:00") + undo + "re-add tomorrow" for dropped must-sees.
- **"It's closed!":** one tap on arrival → instant replan around it **and** a user-report fact into the Brain (`closed_now`, dated, user-attributed) that warns the next traveler ("reported closed yesterday — verify").
- **"I'm hungry now":** nearest dining-rule-compliant option from the candidate pool, slotted in.
- **Weather nudges:** forecast crossing thresholds → "swap outdoor stops after 14:00 for covered options?" — one tap; never auto-applied.
- All direct manipulations (remove/reorder/move day/add) re-solve instantly; offline edits use the on-device greedy/2-opt re-solver and sync later.

### 6.13 Narration: deep place text (offline) + audio (online, on demand) [P1]

📐 Two layers, deliberately split (owner decision):
- **The deep text** — a detailed, readable account of the place: its history, its significance, why it is famous, what happened there, what to look for. Written once per (place, language) from cited City Brain facts, stored with the place, and **always included in cards and offline bundles**. This is what a traveler reads standing in front of the monument with no signal.
- **The audio** — generated **only when a user taps "Generate/Play narration"**: a 60–90s spoken rendition (script derived from the deep text, one "look for…" cue). Synthesized on first request per (place, language), then **cached on our backend forever** and **streamed** to every later listener — each narration is paid for at most once globally. **Audio is never placed in offline bundles** (needless browser-cache weight); playing audio requires connectivity, and the UI says so gracefully offline ("You're offline — here's the full story to read"), falling back to the deep text.
⚙️ Piper/Kokoro self-hosted (≈$0) → Google Cloud TTS free tier fallback; MP3s immutable in object storage, streamed same-origin; player: play/pause/seek + text toggle.

### 6.14 Safety & cautions surfacing [P1]

📐 Three levels: **City Brief** (overview, scams, hotspots — §5.6) · **place-level caution badges** on cards ("pickpocket hotspot — commonly reported near the funicular, 4 sources 2025") · **contextual nudges** in companion mode (entering a flagged area at night → gentle notice). Framing rules are law (§16.4): attributed, dated, "commonly reported" language; never rank anything "safe"; prominent aggregated-third-party-information disclaimer.

### 6.15 Post-visit feedback, corrections, ratings & reviews [P1 capture / P2 public reviews]

📐
- **Post-visit micro-prompt** (geofence-detected visit, end-of-day batch, ≤20s): "Did you visit X? · Was the price still €22? [✓ / new price] · Anything wrong? (closed / moved / not worth it / doesn't exist) · Rate ★ · Optional short review."
- **Corrections** create competing atomic facts: price updates from verified visitors outrank stale citations after N confirmations; "doesn't exist / permanently closed" reports quarantine a place pending re-verification. Contributors see impact ("your price update is now shown to travelers").
- **Ratings & reviews:** own ★ aggregate + text reviews, **"Verified visit" label** (GPS-confirmed) vs unverified (disclosed); web-sentiment score fills in until critical mass. **Cold-start display rule (owner decision): when a place has no ratings yet, simply show nothing** — no "no ratings yet" placeholder drawing attention to the gap. Reviews carry report buttons; moderation per §16.2–16.3 (DSA notice-and-action, statement of reasons, audit log; Omnibus disclosure of verification method).
- End-of-day sliders + per-stop 👍/👎 feed the learning system (§9).

### 6.16 Notifications & reminders [P1 core / P2 rich]

📐 Web push (Android; iOS ≥16.4 installed PWA) + in-app notification center: **pre-trip booking-deadline alerts** ("Alhambra sells out — book ~6 weeks ahead; your trip is in 7 weeks") · cold-city research-complete · morning-of weather replan suggestion · **leave-by alerts** in companion mode · departure-day timeline ("leave for the station by 15:10") · group activity digests (batched, quiet by default). All opt-in per category. **[P1] in-app + push; [P2] email digests once SMTP is wired** ("tickets you should book now" summary mail).

### 6.17 Offline [P1]

📐 One-tap **trip bundle** (auto-prompted before trip start): plan + place cards + **deep place texts** (§6.13) + City Brief + photos + **city PMTiles basemap (20–80 MB)** + style/fonts. **No audio in bundles** (owner decision — audio streams online only). Everything a traveler needs works in airplane mode: map, pins, routes, cards, cautions, full place reading material, plan edits (on-device re-solve, queued sync). Requires connectivity: new research, narration audio, Google Maps deep links (labeled), live weather. Clear offline banner + "last synced"; **reachability heartbeat**, never `navigator.onLine` alone (🧭 ET gap).
⚙️ PMTiles in OPFS; media in Cache Storage (iOS renders native Responses — 🧭 ET); metadata in IndexedDB; `storage.persist()`; SW strategies per ET's proven design with **automated cache versioning on deploy** (🧭 ET gap); bundle manifest reconciliation for cross-device deletions (🧭 ET); full PWA installability (192/512 + maskable icons, `beforeinstallprompt`, iOS nudge — 🧭 ET gap). Budget <150 MB/trip.

### 6.18 Companion mode [P1]

📐 On travel days `/trips/:id` opens as companion: pinned Now/Next card with leave-by countdown; arrival detection surfaces card + narration button; quick actions (running late → reconfigure, skip, hungry, closed, go-to-#1); battery discipline (throttled foreground-only GPS, high-accuracy toggle).
**Glanceability rules (verified — Oulasvirta CHI 2005: attention on the move fragments into 4–8s bursts; Schildbach & Rukzio MobileHCI 2010: walking impairs reading and larger text does NOT fix it, larger targets do):** one primary card per glance; body text ≥17px (§17.6) but the walking fix is **shorter, chunked content** — the Now/Next card carries max 3 information items (destination, leave-by, one transit/context cue); quick actions bottom-anchored in the thumb zone, ≥48dp targets; everything readable in a single 4-second glance.

### 6.19 Documents & ticket vault [P2 — spec complete, ET-proven]

📐 **TicketLink** (external URL: PDF / booking page / QR / other; online-only) vs **TripDocument** (uploaded file: PDF/JPG/PNG/WEBP/HEIC, ≤15 MB, offline-cached) — deliberately distinct. Attach to stops, days, accommodations, inter-city legs, or the trip. Multi-file upload with editable labels + **per-member tagging** (empty = shared; defaults to the uploader); document lists filter by "me." Offline vault at `/offline`.
⚙️ Port ET wholesale: same-origin streaming with path-traversal guard, SW CacheFirst, manifest reconciliation, rollback on failed insert, orphan self-healing, private bucket `<kind>/<parentId>/<docId>.<ext>`.

### 6.20 Multi-city trips [P2]

📐 **A trip = ordered city stays chained by user-entered transport legs** (mode, date/time, stations/airports, booking ref — recorded, never booked; ticket files attach to legs via the vault).
- Each city stay is a full city plan (research → curate → days) — the single-city machinery, reused.
- The connecting leg drives both ends: the departing city's last day gets the **hard departure anchor + buffer** (§6.8); the arriving city's first day starts from the arrival station/time.
- "Complete city" advances focus; a trip overview map shows the whole chain (🧭 ET's trip-scale view, now generated instead of hand-built).
- Per-city offline bundles download independently (storage-friendly).

### 6.21 Gamification & community roles [P2]

📐 The on-the-go database becomes a game (owner decision #18): the behaviors that grow the City Brain are the behaviors we celebrate.
- **Territory opening:** when a user is the first InTown traveler ever to visit a place (or a city), the app celebrates it — "You just opened {place} for every future InTown traveler 🎉" — and permanently credits them ("First explored by Ana, May 2027").
- **Roles, earned by behavior archetypes** (multiple can be held):
  - **Explorer** — first visits, territory openings, off-longlist discoveries.
  - **Knowledge Keeper** — reads deep texts, plays narrations, opens citations (the learner archetype).
  - **Pathfinder** — corrections, price updates, closure reports, reviews (the contributor archetype whose feedback makes the Brain trustworthy).
- **Themed badge sets** (per city, per season, per milestone: "10 golden-hour summits," "5 cities opened") — collectible, shareable, never pay-to-earn.
- Design rules: celebration, never coercion (no streak guilt, no dark patterns); contribution impact always shown ("your price update has helped 214 travelers"); leaderboards optional and friends-only by default.
- **Streak law (verified causal evidence, 2026-07-04 — UI_UX_RESEARCH.md §8.3 Q4):** calendar streaks are structurally wrong for episodic travel and highlighting a *broken* streak measurably reduces engagement vs saying nothing (Silverman & Barasch, JCR 2023). InTown uses **per-trip progress and cumulative lifetime totals** (places opened, cities explored, corrections contributed) — numbers that only ever go up. If any streak-like mechanic is ever added: never headline a break; offer earned freezes/repair windows (Sharif & Shu: costly slack beats rigid goals on persistence, especially after lapses).
- **Peak-end engineering (verified):** territory-opening celebration and the end-of-trip wrap ("your trip in numbers + memories") are the designed *peak* and *end* of the trip memory — invest polish there disproportionately; achievement + social mechanics are the evidence-backed levers (Xi & Hamari 2019: achievement features are the strongest SDT-need satisfiers; immersion/theming alone is weak).
⚙️ Derived entirely from the §9 event log (visits, narration plays, corrections) — zero extra tracking; badge rules are server-side config evaluated on events.

### 6.22 "Want to go" & social import (Reel/TikTok → places) [P2]

📐 The dream-now-plan-later loop (owner decision #19):
- A user sees a "places to visit in Paris" Reel or TikTok months before any trip → **shares the link to InTown** (Android: native share sheet; iOS: paste box with clipboard detection) → within ~10s the app shows a **confirmation list**: one card per extracted place (name, photo, matched location on a mini-map, source attribution) → keep/discard → kept places land in the personal **Want-to-go list**, each linked back to the original Reel + creator.
- Want-to-go places are grouped by city, browsable on a world map ("your dream map"), and **resurface automatically at trip creation**: planning Paris → "You saved 7 places for Paris 💫" → they're injected into the longlist **highlighted as "saved by you,"** boosted in priority, and curated with the group like everything else. The solver treats kept ones like any curated place.
- Honest failure UX: if nothing extractable, say so ("couldn't find places in this video — paste the names?").
- Competitive note: Mindtrip has this ("Start Anywhere"); Wanderlog does not; Google Maps only does screenshots. Table stakes for an AI planner, still a gap in incumbents.

⚙️ Pipeline — **video-first (owner decision):** captions are often incomplete or wrong, and many reels are purely visual (no speech, no place list); the video itself is the ground truth, and reels are short (60s–3min) so full video analysis is cheap.
1. **Ingest:** Android PWA `share_target` manifest entry (parse both `url` and `text` fields — Android apps are inconsistent); **iOS = "Paste link" box** with clipboard detection (Safari still doesn't support share_target in 2026); native share extension arrives with the P3 app.
2. **Fetch the video:** Apify extractor for the shared IG/TikTok URL (~$0.002–0.01/link, vendor-held scraping risk; our posture — a single user-initiated fetch of a public post the user explicitly shared — is materially weaker legal territory *against us* than bulk scraping; Meta v. Bright Data 2024 helps for IG, TikTok ToS is stricter, the vendor carries it). Caption/metadata come along free and feed step 3 as context.
3. **Gemini video understanding:** upload the clip (Files API) + caption/hashtags as context → extract places: spoken mentions, on-screen text, AND **visual landmark recognition** (identifies unlabeled purely-visual reels — the case captions can never solve). Cost at reel length: a 60–180s clip ≈ 18–55K tokens ≈ **$0.005–0.02 per import** at Flash pricing — video-first is affordable as the *primary* path, not just a fallback.
4. **Ground & disambiguate:** candidate names + city anchoring (caption/hashtags/geotag/visual cues) → city-biased place search → confidence scores.
5. **Confirm & save:** the card queue (name, photo, mini-map pin, source attribution — the exact UX Google's Gemini screenshot feature validated); nothing saves silently. Total ≈ **$0.01–0.03 per import**, comparable to caption-only but far more accurate.
Fast path: if the caption alone yields high-confidence places (classic listicle reels), skip video processing and save the cost. oEmbed caption endpoints (TikTok open; Instagram behind Meta App Review) remain an optional clean-tier optimization, no longer a launch dependency.
Data: `want_to_go(user_id, poi_id | unresolved_name, city, source_url, creator_handle, saved_at)`; unresolved names retry against the City Brain when that city is next researched.

---

## 7. The AI pipeline

**Architecture law (TravelPlanner benchmark: LLM-only ≈ 0.6–4.4% feasible; LLM+solver ≈ 97%):** *the LLM researches, personalizes, and narrates; the solver schedules. The LLM never emits arrival times **and never emits coordinates** — geolocation always comes from a geospatial source (OSM/Wikidata, geotagged photos, source map-links, Google fallback), never from the model (hallucination risk; see the coordinate-integrity doctrine §5.5).*

```
0 BRAIN CHECK   city cold? → build City Brain (§5.2: open-data skeleton fast,
                deep enrichment streamed: blogs/forums/YouTube-via-Gemini/official
                sites/advisories → atomic facts w/ citations). Warm? → staleness pass.
1 INTAKE        LLM (reasoning tier): trip request + merged group profile →
                interest vector, hard constraints, must-sees. Strict JSON.
2 CANDIDATES    Brain query (PostGIS + fact filters) → 3–5× oversupply; LLM scores
                each vs profile (+ per-user preference summaries §9.2) with
                one-line justifications → prioritized longlist.
3 GROUND        per-candidate verification for THESE dates: hours (holiday-aware),
                price staleness, closure reports; auto-substitute failures
                (Mindtrip pattern); Google Places field-masked only where open
                data fails. Nothing unverified reaches a card.
   ── CURATION GATE (humans in the loop: §6.6–6.7; edits stream back as events) ──
4 SOLVE         OR-Tools TOPTW (§8) on kept places + anchors + deadlines.
5 ENRICH        LLM (fast tier): day intros, leg tips (scenic notes), fit-line
                polish. Narration NOT generated here — on demand only (§6.13).
```

Model strategy: provider-agnostic tiers — reasoning tier for intake/scoring (Claude Sonnet-class), fast tier for enrichment (Haiku-class), **Gemini specifically for YouTube URL ingestion** (the sanctioned path), no model in the solver. All LLM I/O schema-validated (zod) with bounded retries → degrade, never fail. Per-user research quotas + per-city cost meters (§15).

---

## 8. The itinerary engine (solver spec)

**Formulation:** Team Orienteering Problem with Time Windows — one "vehicle" per day. Well-surveyed (Gavalas 2014; Ruiz-Meza 2022); at 20–60 places × 1–7 days, solve times are sub-second.

| Requirement | Encoding |
|---|---|
| Curated priority order | Rank → prize, **exponential decay** (linear lets the solver trade a top-3 pick for two mediocre ones). Prizes scaled against travel-time units so "skip vs 40-min detour" is explicit. Geographic sensibility ("nearby #4 first") **emerges** — order is weight, not sequence. |
| Must-do ("Priority 1 anyhow") | Mandatory node (not in any disjunction) + pre-solve feasibility check with plain-language explanation on impossibility. |
| Opening hours / holidays / timed tickets | Hard time windows; lunch closures = duplicated node, pick ≤1; booked timed entries = locked windows. |
| **Golden hour / best-time targeting** | **Node duplication over time buckets:** "Viewpoint@golden-hour (19:30–20:30, prize 150)" vs "@anytime (prize 80)", disjunction ≤1. Windows from suncalc + Brain best-time facts. 2–3× node inflation — trivial at this scale. |
| **Weather** | Indoor/outdoor/mixed tags × hourly prize multipliers (rain prob >70% → ×0 outdoor; 40–70% → ×0.5; temperature analogous). Rainy-bucket clones ≈ 0 prize → outdoor stops slide to dry hours **or drier days automatically** (each day-vehicle sees different multipliers). Re-solve on forecast refresh (3–6h, Open-Meteo). |
| Crowd/experience windows | Soft time windows (earliness/lateness penalties) around Brain-researched best windows. |
| Meals (1–2/day per dining rules) | Mandatory dummy meal nodes (soft windows following **local meal customs** from the City Brief, e.g. late dinner in Spain; dwell 60) snapped to rule-compliant, **authenticity-vetted** restaurants (§5.4) near the day's cluster. |
| Start/departure anchors | Per-day start/end depots; **departure deadline = hard end-window minus profile buffer** (§6.8). |
| Walking budget | Second dimension (meters) with per-day capacity from walking preference. |
| **Age-aware pacing (editable defaults, never caps)** | Pace preset pre-selected by age band, research-backed: 18–29 → "packed" (4–5 stops/day, later starts, nightlife weighting); 60+ → "relaxed" (2 anchor sights + optional third, ~1:1 activity-to-rest, **rest-break dummy nodes** at cafés/benches, max continuous walk ~15 min → prefer transit legs, outdoor sights in morning slots + indoor/shade midday under summer heat). Shown to the user as relaxed/balanced/packed — age only pre-selects, the user decides. |
| Multi-day balance | Span cost / soft load bounds per day-vehicle. |
| Scenic legs | Small arc-level prize bonus on Brain-flagged scenic connections. |
| **Out-of-town stops (owner decision #24)** | Enter the model **only with an estimable leg**: routable by OSRM/Valhalla or covered by a corroborated access fact (§5.5) that yields a conservative time estimate. **"Access unverified" places are never auto-inserted** — user-forced only, label shown, generous buffer applied. |
| **Replan ≤5s (reconfigure / go-now / closed-now)** | Pin completed prefix, force pinned place first (go-now), **warm start** (`ReadAssignmentFromRoutes` → `SolveFromAssignmentWithParameters`, 2s cap); matrix cached from generation, only rows near current location refreshed. Expected <1s. |

**Solver: Google OR-Tools routing** (Apache 2.0, Python) — natively expresses all of the above. VROOM rejected (cost-min objective, weak prize semantics); Timefold noted as the upgrade path for daemon-mode continuous planning + group-fairness constraints [P3]; CP-SAT used offline as an exactness auditor in CI; greedy cheapest-insertion + 2-opt as the on-device offline re-solver.
**Engine self-improvement (§9.3):** dwell-time posteriors from real visits, skip-propensity prize discounts, weather-multiplier calibration from observed skips — parameters learned from data, deterministic solve.

---

## 9. The learning system

*(Direct answer recorded: "semantic chunking" is a RAG document-splitting technique — the correct discipline is event capture + implicit-feedback preference learning. A drag-and-drop reorder IS training data: "X above Y" is a pairwise preference.)*

### 9.1 Event capture [P1]
Append-only, never UPDATE: `events(event_id, user_id, trip_id, event_type, event_data jsonb, occurred_at, algo_version, consent_flag)`, time-partitioned, pseudonymized (user_id as FK column for erasure). Segment-style object-action events: `list_shown` (**full ranking + algo version — impressions are required to learn**), `place_reordered` (from_rank, to_rank, list before/after), `place_removed` (rank), `card_opened`+dwell, `must_do_locked`, `vote_cast`, `place_visited/skipped` (geofence), `narration_generated/completed`, `go_now_triggered`, `closed_reported`, `price_corrected`, `plan_regenerated`(reason), `day_feedback`, `list_finalized` (**ground-truth label**).

**Location-derived signals (owner decision, consent-gated):** when the user shares location during travel, the client converts the trace into **derived events on-device** — arrival/departure per stop (→ actual dwell), inter-stop movement pace, route deviations, stops lingered at vs rushed — and sends only those; **raw GPS traces are never stored server-side** (consistent with §16.1). These power both personal learning (this traveler's true pace and dwell patterns) and **aggregate product learning**: what travelers in general linger on vs skip, real visit durations per place, realistic walking speeds per city terrain, which plan shapes get followed vs abandoned — the evidence base for improving defaults, the solver, and the recommendations over time.

### 9.2 Personal + global learning [P1 → P3]
- **v1 (day one):** per-user feature weights over place attributes, deterministically updated (explainable, reversible) · compact behavioral **preference summary** injected into LLM scoring (in-context personalization — Spotify/Roblox pattern) · **global Bayesian-smoothed quality priors** per (place × interest segment): `(C·m+Σs)/(C+n)` — three removals can't nuke a place; "80% of history-lovers demote X" lowers X for that segment only.
- **v2 (~10⁴+ events):** LambdaMART (LightGBM lambdarank) trained on finalized orders; ε-greedy exploration slot (one wildcard/list); **interleaving** for online eval.
- **v3 (>10k users):** BPR/two-tower retrieval + contextual bandits; LLM as top-k reranker. (Below ~10⁵ interactions embeddings don't beat features + GBDT — don't build early.)

### 9.3 Engine learning [P1 basic → P2]
Dwell-time hierarchical Bayesian shrinkage (global→category→place) from visit events · **per-user and per-cohort pace models from location-derived signals** (§9.1: real walking speeds, dwell vs planned as an enjoyment proxy — long lingering = the plan undershot, rushing = it overshot) · skip-propensity logistic model discounting prizes · weather/buffer calibration from outcomes ("60+ users arrive 20 min earlier than needed → tighten? never below safety floor").

### 9.4 Evaluation [P1]
Replay harness from day one: NDCG@k + Kendall-τ (proposed vs finalized order) per session, per algo_version · product metrics: edits-per-list ↓, removal rate ↓, top-5 visited rate ↑, fact-correction rate ↓ · nightly **golden-city evals** (10 cities × 5 profiles: 100% solver feasibility, citation coverage, alignment score) gating deploys.

---

## 10. Data model (Postgres + PostGIS; one canonical migration chain — 🧭 ET gap #2)

**Identity/preferences:** `users`, `traveler_profiles` (age_band, mobility, languages, currency), `taste_profiles` (versioned), `consents`.
**Trips:** `trips` (owner_id, city_stays[] via `trip_cities`(ord, city_id, arrive/depart, accommodation, start_defaults)), `trip_members`(role), `trip_invites`(code, role, expires, revoked), `intercity_legs`(mode, dep/arr time+place, booking_ref) [P2].
**Curation/plan:** `trip_places`(trip_city_id, poi_id, **position** text-fractional, state: suggested|kept|removed|must_do, added_by, est_duration), `place_votes`, `plan_revisions`(append-only, reason incl. go_now|closed_now, created_by), `stops`(materialized current revision).
**City Brain:** `cities`(bbox, pmtiles_path, brain_status, warmed_at), `pois`(canonical, source_refs jsonb, category enum, geog **+ derived canonical coord + coord_confidence + coord_verified_by**, prominence, indoor_outdoor, accessibility), `poi_geo_observations`(**append-only geo log §5.5** — poi_id, source_kind, lat, lng, accuracy_m, observed_at, **expires_at** for ToS-limited sources e.g. Google ≤30d, confidence), `facts`(**atomic-fact table** §5.3 — entity_id, attribute, value jsonb, source_url, source_kind, observed_at, confidence, corroboration, status), `poi_hours`, `poi_enrichment`(per-language significance/scripts/audio_path, generated_at), `city_briefs`, `scenic_legs`, `transit_passes`.
**Community:** `reviews`(rating, text, verified_visit, status), `moderation_actions`(notice, decision, statement_of_reasons, timestamps — the DSA audit log), `corrections`(fact_id, proposed_value, reporter, confirmations), `want_to_go`(user_id, poi_id | unresolved_name, city, source_url, creator_handle, saved_at), `badges`/`user_badges` (server-config rules over events).
**Learning:** `events`(partitioned), projections `user_pref_profiles`, `item_stats`.
**Vault [P2]:** `trip_documents`(parent_kind incl. INTERCITY_LEG, member_ids[], storage_path unique), ticket_links jsonb on parents.
RLS on everything user-scoped; `set_updated_at` triggers; facts and events append-only.

## 11. API surface (typed, contract-first; all routes auth + ownership-checked, rate-limited)

Auth/profile: `/api/auth/*`, `/api/profile`, `/api/profile/traveler`, `/api/consents`.
Trips: `/api/trips` CRUD · `/api/trips/:id/members|invites`, `/api/join/:code` · `/api/trips/:id/cities` [P2].
Research/curation: `POST /api/trips/:id/research` (SSE stages) · `/api/trips/:id/places` (list/add/patch position|state/vote) · `GET /api/pois/:id/card` · `GET /api/pois` (viewport/category) · `/api/pois/search`.
Plan: `POST /api/trips/:id/plan` (anchors+times body, SSE) · `POST .../reconfigure` · `POST .../go-now` · `POST .../closed-now` · `/api/trips/:id/revisions(+restore)` · `GET .../bundle` (manifest).
Content: `POST /api/pois/:id/narration` (on-demand generate; GET streams cached MP3) · `GET /api/cities/:id/brief`.
Community: `POST /api/reviews`, `POST /api/corrections`, `POST /api/reports` (DSA notice), moderation queue (admin) · `POST /api/import/social` (Reel/TikTok URL → extracted place candidates) · `/api/want-to-go` (list/save/discard).
Learning: `POST /api/events` (batch, consent-gated).
Geo: `GET /api/geo/route` (overview polyline + ETA; deep-link params).
Realtime channels: `trip:{id}` broadcast + presence.

## 12. Technical stack

| Layer | Choice |
|---|---|
| Frontend | React + TS + Vite PWA in the top-level **`Frontend/`** folder — **built from scratch; the existing `Frontend_Website/` is deleted in WP-0 (mock-era code, zero reuse)**; Zustand; SW + OPFS/Cache Storage/IndexedDB. Deploys to **Vercel** (static/edge build; decision #25) |
| Map | MapLibre GL JS + Protomaps PMTiles (self-hosted/R2); own PostGIS vector-tile POI layer |
| Geocoding/search | **Geoapify (OSM-based) as primary at launch — free tier, results storable; Google Geocoding/Places as fallback-on-miss (`place_id`-only storage). Self-hosted Photon/Nominatim deferred** (RAM/disk heavy) to a later dedicated box |
| POI ingestion (City Brain build) | **Overpass API** (Overpass QL bulk tag sweep per city bbox — viewpoints/museums/parks/historic, incl. unnamed nodes geocoding can't reach): kumi.systems primary, overpass-api.de fallback; **Geoapify Places API** as the degrade path (same open data, managed); self-hosted Overpass deferred (like Nominatim/Photon). Distinct from geocoding — this is the bulk sweep that seeds each Brain (§5.2) |
| Routing (times for solver) | Self-hosted OSRM/Valhalla (walk/drive); Transitous/OTP transit estimates where available; **step-by-step delegated to Google Maps deep links** |
| Weather | Open-Meteo (free) |
| Holidays | Nager.Date / OpenHolidays (free) |
| LLM | Tiered, provider-agnostic (reasoning + fast); **Gemini paid tier for YouTube URL ingestion**; zod-validated I/O |
| Solver | OR-Tools routing (Python service); CP-SAT offline auditor; JS/WASM greedy+2-opt on device |
| TTS | Piper/Kokoro self-hosted → Google Cloud TTS free-tier fallback |
| DB/Auth/Storage/Realtime | **Self-hosted on VPS (owner decision #20–21): PostgreSQL + PostGIS · Auth.js (library in the API, not a separate auth server) · object storage on disk / MinIO · *only* the self-hosted Supabase **Realtime** container for Broadcast+Presence.** Full Supabase cloud/stack not used; source never forked |
| Backend | TypeScript API (Fastify) + Python pipeline/solver workers + job queue in the top-level **`Backend/`** folder; SSE for progress; **self-hosted on the owner's VPS** (§12.1) |
| Repo shape | Two dedicated deployable folders — `Frontend/` (Vercel) and `Backend/` (VPS) — joined only by a shared, frozen `contracts/` seam (types, API schemas, design tokens, fixtures). Neither folder imports the other; CI enforces the boundary (§18.3). Decision #25 |
| Push | Web Push (VAPID) — Android + iOS ≥16.4 installed PWA |
| Ranking [P2] | LightGBM LambdaMART; replay harness in CI |
| Observability | Structured logs, Sentry, per-stage pipeline metrics, per-API cost meters + alerts |

### 12.1 Deployment & hosting — self-hosted VPS (owner decisions #20–21)

**Posture:** the **`Backend/` folder** (API, Python services, Postgres/PostGIS, object storage, Realtime, OSRM, TTS, solver) runs on the owner's own VPS(s) (e.g., Hetzner/OVH/DigitalOcean); no third-party BaaS cloud for data/API/DB. This gives data residency (EU hosting, §16.1), cost control, and no vendor lock-in — at the cost of owning backups, patching, uptime, and scaling ourselves. The **`Frontend/` folder** is a static PWA build deployed to **Vercel** (decision #25) — this is compatible with the "no BaaS" posture because Vercel hosts only the static/edge frontend bundle; **no user data, API, or database ever lives there** (all of that is on the VPS, reached over HTTPS via the `contracts/` API). The two folders are independently deployable, so moving the frontend onto the same VPS later (or anywhere else) is a deploy-target change, not a code change.

**The "plainer path" (chosen over self-hosting the full Supabase stack).** Self-hosted Supabase is ~10 Docker containers (Postgres, GoTrue, PostGREST, Realtime, Storage, Kong, Studio, postgres-meta, imgproxy, Analytics/Logflare+Vector); the genuinely heavy piece besides Postgres is the Analytics/Logflare stack. Rather than run all of it — or fork and strip its source (rejected: components are separate repos in different languages; the overhead is *processes*, not code bloat, so deleting source doesn't help, and a fork forfeits upstream security patches for auth/storage) — we **compose from standard parts and libraries**:

- **PostgreSQL + PostGIS** — installed directly (unavoidable core; light at our scale).
- **Our own API** (Fastify/Next) — replaces PostgREST + Kong entirely.
- **Auth.js** — a library inside the API (near-zero extra process), lighter than running GoTrue.
- **Object storage** — disk + API, or MinIO (S3-style) when needed.
- **Realtime** — the *one* Supabase piece worth borrowing as-is: run just the self-hosted **Realtime** container (Elixir, memory-efficient) for the live curation list's Broadcast + Presence (§6.3, D47). Fallback: a small WebSocket handler in our API.

**Load reality:** at ~50 users, interactive concurrency (API/DB/auth/realtime) is trivial — the VPS footprint is dominated by the **geo/AI infrastructure** (OSRM routing, PMTiles serving, TTS, Python solver/AI workers), not by user count. LLMs run on **external APIs** (Claude/Gemini) — no VPS load, but the real variable cost (§15). Geocoding is offloaded to **Geoapify's free tier** so the RAM/disk-heavy Nominatim/Photon can be deferred.

**Sizing — starting point for a ~50-user beta (eigene Schätzung, validate on a test box; §20):** a single **~4 vCPU / 16 GB RAM / 160 GB SSD** VPS comfortably holds the whole stack for a handful of launch cities, with headroom for OSRM spikes. Rough per-service RAM: Postgres+PostGIS 1–2 GB · API ~0.5 GB · Realtime ~0.3–0.5 GB · Python workers 1–2 GB · **OSRM 1–4 GB (the main variable — scales with loaded region size)** · PMTiles negligible RAM (disk-bound, 20–80 MB/city) · TTS ~0.3–0.7 GB. Split into an app+DB box and a geo/worker box when self-hosted geocoding is added or many cities are loaded.

## 13. Non-functional requirements

**Latency:** warm-city longlist ≤ 30s; cold-city skeleton ≤ 2 min (full brain 5–15 min, notified); solve ≤ 3s; replans ≤ 5s end-to-end; card open < 300ms cached; 60fps map on mid-range Android.
**Accuracy:** ≥95% displayed facts cited-or-N/A (hard gate); solver feasibility 100% (independent checker); price staleness ≤ 12 months or labeled.
**Reliability:** every external dependency has a degrade path; missing config → instructional error (🧭 ET); on-device error console in dev builds.
**Cost ceilings:** §15. **Privacy/GDPR & content law:** §16. **Accessibility:** WCAG 2.2 AA as the legal floor **plus APCA-4g as the perceptual check on every text pair** (Color System v2, §17 — WCAG-2-only checks are provably unreliable near black; two v1 pairs passed WCAG while failing APCA); pattern+color route encoding (CVD-safe, hue never the only channel); transcripts for audio; formal audit pre-launch.
**Security:** revocable sessions, RLS, rate limits (auth + research + events), server-only keys, path-traversal guards, sanitized rich text, moderation audit log.

## 14. Guardrails, testing & evaluation

Schema validation at every LLM boundary (bounded retries → degrade) · citation-or-N/A validator rejects non-compliant cards/plans pre-display · **coordinate-provenance gate (§5.5): LLM-emitted coordinates rejected outright; a precise pin requires ≥2 independent geo-sources agreeing within ~100 m, else the place is labeled "approximate" and never offered as a navigable destination** · **out-of-town gate (§5.5, decision #24): navigable out-of-town destinations require corroborated access facts (else "access unverified," never auto-scheduled), and claimed views must pass the DEM viewshed line-of-sight test or be labeled "view unconfirmed"** · corroboration threshold (≥2 sources) for experience claims · independent solve-feasibility checker · **golden-city eval suite** (nightly, deploy-gating) · replay harness (§9.4) · reconfigure determinism tests · airplane-mode E2E (Playwright + SW): map renders, audio plays, edits queue/sync · moderation-flow tests (notice → decision → statement of reasons) · cost regression alarms · rollback: feature flags per pipeline stage; tool outages degrade narration/research gracefully, static plan survives.

## 15. Cost model & controls

**City Brain build (one-time per city, amortized across all users forever):** YouTube via Gemini low-res ~$1–4 (30h video) + blog/forum research ~$1–3 + advisories/open data ≈ $0 → **≤ ~$5–8/city cold**, trending to ~$1/refresh cycle.
**Per trip:** warm city ≤ $0.05 (scoring + solve); cold city bears the Brain build once. Narration ≈ $0 (self-hosted TTS, generated on demand, globally cached). Verification (Google field-masked) $0.20–0.60/trip worst-case cold.
**Fixed:** self-hosted on VPS (§12.1) — OSRM + tiles + TTS + solver + DB/API/Realtime ~$50–150/mo initial (starting box ~4 vCPU/16 GB); storage/CDN cheap. BestTime.app **removed** from the plan (owner decision — research-derived timing instead): −$29+/mo.
**Geocoding:** Geoapify **free tier ≈ $0** at beta scale (~90k/mo free; a 50-user beta consumes a small fraction — debounce autocomplete). Google fallback near-free (fires only on OSM misses; watch the fallback-rate meter — Geocoding 10k free/mo then ~$5/1k; **Places API is pricier and field-mask-controlled**, so mask to `id`/`location` only).
**OSM POI ingestion (Overpass):** **$0** on public instances (fair-use ~10k queries/day); Brains build once per city, so it's a handful of queries per cold city — comfortably within limits. If volume ever demands it, self-host Overpass (same deferral logic as Nominatim/Photon); Geoapify Places is the managed degrade path.
**Controls:** per-city and per-API cost meters with alerts, model tiering, cache-first everything; the pricing model itself is the primary cost control (below).
**Monetization (owner decision #17): pay per city.**
- The user **pays once per city itinerary**. That purchase funds the one expensive event — the deep research — and includes **unlimited reconfigures, go-nows, and re-solves for that city** (solver runs cost fractions of a cent; weather and all raw context feed the solver freely).
- Deep research runs **once per city per purchase**: it produces the prioritized longlist + decision data; everything after is curation + solving on cached results. City Brain reuse across users means the *marginal* research for a warm city is far below the price — healthy unit economics that improve with scale.
- **First city free (owner decision): the freemium hook is "first city free, in exchange for personalization data opt-in."** Free-tier users consent to behavioral learning as part of claiming the free city; **paying users get the full opt-out option.** ⚠️ Legal note: this is the "consent-or-pay" pattern — defensible for a small business with a reasonably-priced paid alternative, but the EDPB has scrutinized it (Opinion 08/2024, aimed at large platforms); mitigations: (a) using the preferences a user *explicitly gives* (interests, diet, pace) to build their itinerary is **contractual necessity** (Art. 6(1)(b)) and needs no consent at all — only cross-trip *behavioral learning* rides on the consent; (b) keep the paid opt-out genuinely equivalent in features; (c) legal review before launch (§20).
- Price point and regional pricing remain open business questions (§20). Offline is always included, never an upsell (the wedge). Affiliate links remain a labeled later experiment per owner decision #7.

## 16. Compliance & legal

1. **GDPR:** personalization consent asked **once at first login** with plain, warm copy (owner decision): *"Allow InTown to learn from how you plan and travel — this only improves your experience. We never sell your data and never send spam."* Opt-out anytime in Settings, with an honest note about what degrades ("recommendations won't adapt to you"). Functional non-personalized mode; pseudonymized events; age band not birthdate (minimization); EU hosting; export + erasure (user rows deleted; anonymous aggregates survive); precise location never stored server-side post-session.
2. **DSA (micro/small platform):** exempt from Section-3 platform obligations (Art. 19) but implementing: Art. 16 notice-and-action (report button + receipt + decision), Art. 17 statement of reasons on removals/demotions, Art. 14 plain-language moderation policy in T&Cs, Arts. 11–13 contact points, Art. 24(3) user-count reporting. Expeditious action on notices preserves the hosting liability shield.
3. **Omnibus Directive (fake reviews — applies regardless of size):** public disclosure of whether/how reviews are verified ("Verified visit" = GPS-confirmed; unverified labeled), how collected/processed, whether all published, how averages computed. Never commission or suppress reviews. Moderation stack: report button → LLM pre-moderation → human queue → append-only audit log.
4. **Safety-content framing:** attributed, dated, "commonly reported by travelers / according to [source]" language; advisories quoted with attribution (State Dept public domain; FCDO/AA open licenses); **never rank anything "safe"**; prominent disclaimer (aggregated third-party information, not advice). Risk is asymmetric — warn freely, certify nothing.
5. **Content ingestion posture:** YouTube only via Gemini URL ingestion (paid tier — contractually cleanest; no yt-dlp, no transcript scraping); store only derived atomic facts with attribution + links (facts aren't copyrightable — Feist); quotes ≤1 sentence; blog/forum prose never republished; **Google Maps content never persisted beyond ToS — only `place_id` stored (permitted indefinitely); lat/lng and other content cached ≤30 days then re-fetched, and never relabeled as open data (§5.5)**; Geoapify/OSM/Commons/Wikidata data is open-licensed and storable, attributed per license. Freedom-to-operate glance at US 9,127,957 (weather-based indoor/outdoor scheduling) before launch.

## 17. Design system — InTown Color System v2 (verified, owner-approved 2026-07-04) [F1 owns; every frontend WP consumes]

> **Supersedes v1 entirely.** The v1 palette (inherited from the original InTown PRD) had three text/fill combinations that failed WCAG AA outright (white on `#10B981` = 2.54:1, on `#F59E0B` = 2.15:1, on `#22C55E` = 2.28:1) and two dark-mode pairs that passed WCAG 2 while failing perceptual contrast (APCA) — the audit is in `UI_UX_RESEARCH.md` §8.4. v2 is the owner-approved **"A×C hybrid": trusted blue on warm sand, terracotta saved for the peaks.** Every pair below is computed-verified against **WCAG 2.2 AA (legal floor) + APCA-4g (perceptual check)**; the ratios are stated so CI can re-assert them (§17.9). Evidence base: saturated blue is the best-supported trust/calm hue; lightness carries positive valence (warm *light* ground); warm hues raise arousal — correct for celebration peaks, wrong for chrome (`UI_UX_RESEARCH.md` §3.C, §4, §8).

### 17.1 The five seeds & the derivation law

| Seed | Hex | Role |
|---|---|---|
| **InTown Blue** | `#2563EB` | Primary: every CTA, link, selection ring, transit route. The single trust-carrying hue. |
| **Sand** | `#FAF7F2` | The light-mode ground. This is where the warmth lives — never in chrome saturation. |
| **Ink** | `#1C1917` | Text and dark-mode surfaces. Warm-neutral (stone family), never cold slate, never brown. |
| **Terracotta** | `#C2410C` | The peak color: must-see badges, golden-hour chips, territory-opening + "plan ready" celebrations. **Nothing else.** |
| **Jade** | `#047857` | Positive affordances: group-agreement chips, success, walking routes. |

**Derivation law:** all tints/shades (50–900 ramps) are generated in **OKLCH** — fixed hue + chroma, stepped lightness — never hand-picked hex or HSL (HSL lightness is hue-dependent and silently breaks contrast; verified). Gamut-check every generated color for sRGB. Never generate into the universally-disliked dark yellow-green zone (HCT hue 90–111, chroma >16, tone <65 — Material's dislike-analyzer bound, relevant when tinting jade). Any new color pair used for text must be re-verified against §17.9 thresholds before merge.

### 17.2 Light mode tokens (the daylight default)

| Token | Value | Verified contrast |
|---|---|---|
| `bg` | `#FAF7F2` (sand) | — |
| `surface` (cards) | `#FFFFFF` | — |
| `text` | `#1C1917` | 16.4:1 on bg / 17.5:1 on surface · Lc 100/104 |
| `text-secondary` | `#57534E` | 7.1:1 / 7.6:1 · Lc 82/87 |
| `text-tertiary` (metadata rows only) | `#79716B` | 4.5:1 · Lc 69 |
| `border` | `#E7E5E4` | non-text |
| `primary` + `on-primary` | `#2563EB` + `#FFFFFF` | 5.2:1 · Lc 80 |
| `primary-pressed` | `#1E40AF` + `#FFFFFF` | 8.7:1 · Lc 94 |
| `link` / primary-as-text | `#1D4ED8` | 6.3:1 on sand · Lc 78 |
| `jade` fill + label | `#047857` + `#FFFFFF` | 5.5:1 · Lc 82 |
| `jade-chip` | bg `#D1FAE5` + text `#065F46` | 6.8:1 · Lc 78 |
| `terracotta` fill + label | `#C2410C` + `#FFFFFF` | 5.2:1 · Lc 80 |
| `terracotta-chip` | bg `#FFEDD5` + text `#9A3412` | 6.4:1 · Lc 75 |
| `warning` | `#F59E0B` + **dark text `#451A03`** (never white) | 7.0:1 · Lc 58 (≥14px bold) |
| `error` | `#B91C1C` + `#FFFFFF`; as text `#B91C1C` on sand | 6.5:1 · Lc 85 / 6.1:1 · Lc 76 |
| `success` | `#15803D` + `#FFFFFF` | 5.0:1 · Lc 80 |

### 17.3 Dark mode tokens (night & OLED)

**Theme default = system (`prefers-color-scheme`) with an in-app override** — evidence: positive polarity (light) reads better, especially at small sizes and in daylight; dark saves meaningful OLED battery only at high brightness; preference splits roughly in thirds (verified, `UI_UX_RESEARCH.md` §8.3 Q3). **Dark surfaces stay warm-neutral, never brown** — warmth survives as glowing text accents. The basemap gets a **true dark tile style, never CSS inversion**.

| Token | Value | Verified contrast |
|---|---|---|
| `bg` | `#0C0A09` | — |
| `surface` | `#1C1917` | — |
| `text` | `#FAFAF9` | 18.9:1 / 16.7:1 · Lc 104/103 |
| `text-secondary` | `#D6D3D1` | 13.3:1 / 11.7:1 · Lc 80/79 |
| `text-tertiary` (metadata) | `#BFB8B2` | 8.9:1 on surface · Lc 63 |
| `border` | `#292524` | non-text |
| `primary` CTA fill + label | `#60A5FA` + `#0C0A09` | 7.8:1 · Lc 54 — **CTA labels ≥16px semibold** (APCA large-text tier) |
| `primary-pressed` | `#3B82F6` + `#FFFFFF` (white label, not dark) | 3.7:1 (transient state; passes 3:1 UI/large) · Lc 69 |
| `link` / primary-as-text | `#93C5FD` | 9.7:1 · Lc 68 |
| `jade` as text/icon | `#34D399` | 9.1:1 · Lc 65 |
| `jade-chip` | bg `#064E3B` + text `#A7F3D0` | high |
| `terracotta` as text | `#FDBA74` | 10.4:1 · Lc 72 |
| `terracotta` fill + label | `#C2410C` + `#FFFFFF` (fills keep light-mode pair) | 5.2:1 · Lc 80 |
| `terracotta-chip` | bg `#7C2D12` + text `#FED7AA` | high |
| `warning` as text | `#FBBF24` | 10.5:1 · Lc 72 |
| `error` as body text | `#FCA5A5` (icons/large may use `#F87171`) | 9.2:1 · Lc 65 |
| `success` as text | `#4ADE80` | Lc ~80 |

### 17.4 Map layer: routes, pins, badges (CVD-safe — hue is never the only channel)

Verified basis: color-vision deficiency does not reduce text readability (luminance contrast does that) but does impair map hue discrimination — so every categorical encoding pairs color with **shape/pattern/weight**, anchored on the Okabe–Ito CVD-safe set and OKLCH-tuned to the brand:

- **Route segments:** walking = jade **dashed** (`#15803D` light / `#34D399` dark) · public transit = blue **solid** (`#2563EB` / `#60A5FA`) · driving = ochre **thick** (`#B45309` / `#FBBF24`) · bike = **dotted** teal `#0F766E` · ferry = **wave-dashed** sky `#56B4E9`. Active route 85% opacity, future steps 45%. Adjacent modes must differ in lightness, not only hue.
- **Pins (category color + distinct icon glyph, always):** photo spots `#D55E00`-derived · viewpoints `#56B4E9`-derived · art `#E69F00`-derived · history `#7C3AED`-derived · museum `#2563EB` · food `#047857`. Selected ring `#2563EB` + white inner (light) / `#1C1917` inner (dark); closed = `#79716B` fill + strikethrough label. Final pin ramp is generated in F1 by the §17.1 derivation law with lightness separation between adjacent categories, then returned to `contracts/design-tokens.json` via a contract-change request.
- **Must-see badge = terracotta `#C2410C` + white** (v1's gold is retired — amber now means *warning only*, one meaning per color). Caution badge = `warning` tokens. Verified-visit badge = `jade` tokens. Fact-citation chips (with as-of dates) = neutral surface + `link`-colored source name. Disagreement chips = `jade-chip` (agree-count) / neutral (split). Presence avatars = neutral ring, `primary` ring for the active editor.
- **Basemap:** desaturated/muted under any overlay UI (verified Apple HIG rule) so pins, routes, and cards pop; controls over the map get a thin stroke or light drop shadow for contrast at any zoom.

### 17.5 Usage laws (what keeps it professional)

1. **60/30/10 with a warmth budget:** ground ≈60%, text/structure ≈30%, all accent color ≤10% of any screen — and **max one warm (terracotta) element per view**; a second warm signal drops to its pale chip form.
2. **Blue = function, terracotta = emotion.** Blue is always tappable/actionable; terracotta always announces something special (must-see, golden hour, celebration). Never cross these. Iris/violet `#7C3AED` survives only inside the history-pin category — it is no longer a UI accent.
3. **Error ≠ terracotta:** error is the deeper `#B91C1C` red family and always carries an icon; terracotta never appears on destructive or failure UI.
4. **Never white body text on jade/amber/success fills** (the v1 failures). Fills that carry white text must be ≥ the 700-shade (`#047857`, `#B91C1C`, `#15803D`); amber always takes dark text.
5. **Lightness before hue:** any two adjacent meaningful colors (route modes, chip states) must differ in perceived lightness (OKLCH L), not only hue.

### 17.6 Typography & ergonomics (verified)

- **Face:** `system-ui` stack (native feel per the PWA doctrine — verified web.dev guidance); `ui-monospace` for numbers that align (prices, times in tables); `font-variant-numeric: tabular-nums` on all time/price columns.
- **Sizes:** body ≥16px (M3 Body Large) — **companion mode ≥17px**; metadata rows ≥13px only in `text-tertiary` roles; type scale fixed in the tokens package. Respect OS text scaling (rem/sp everywhere, Dynamic-Type-compatible).
- **Walking law (verified — Schildbach & Rukzio):** bigger text does *not* fix reading-while-walking; bigger targets and shorter content do. Companion-mode content is chunked to ≤3 items per card; line length 30–45 characters on phones, never shorter.
- **Touch:** every interactive target ≥48dp (≥9.2mm verified floor); primary actions bottom-anchored in the thumb zone (bottom/center = highest reach comfort; top corners = worst, reserved for rare/destructive actions); edge controls sit flush to the edge.

### 17.7 Structure & motion

- **Bottom sheet (M3 tokens, verified against Google's component source):** standard (non-modal) sheet co-existing with the interactive map; **three detents** (peek / half / full, half ratio 0.5); container `surfaceContainerLow`-equivalent (`surface` token); **28dp top corner radius**; 1dp elevation; max width 640dp on large screens; drag-settle velocity threshold 500 px/s; **48dp drag handle** with tap-to-cycle + accessible alternatives; peek state tall enough to signal content; **the selected pin stays visible when the sheet opens** (offset the camera or point the card at the pin — verified HIG rule).
- **Motion:** springy sheet physics, pin-drop animations during research streaming, map-camera choreography on day switch, haptics on reorder; shimmer (left→right) on loading skeletons; `prefers-reduced-motion` honored everywhere; CSS Scroll Snap for day tabs/carousels.
- **PWA native feel (verified web.dev):** app-shell model — the app *never* opens empty offline; `user-select:none` on chrome only (never content); `overscroll-behavior` for pull-to-refresh; manifest `display: standalone` + `theme-color` per theme; Persistent Storage API for bundles.

**The itinerary UI pattern (research-validated — "this is a UI play"):**
- **Macro-layout:** full-bleed map canvas + **persistent non-modal bottom sheet with three detents** (peek / half / full — Google Maps model; the map stays interactive behind the sheet, scroll-up expands, drag-down collapses, grabber affordance per Apple HIG / Material 3). Desktop: split map/list (the most design-praised pattern — Wanderlog's "standing ovation" layout).
- **Sheet content:** vertical **day timeline** — numbered stops with travel-time connectors between them ("🚶 12 min"), meal slots inline, horizontal **day tabs pinned at sheet top**; switching days choreographs the map camera. On travel days the sheet leads with the **Now/Next card** (plan mode ↔ live mode).
- **Pins:** numbered + day-color-coded, matching list numbering; clustered at low zoom; selected pin ↔ selected card two-way sync.
- **Cards (decision-dense without clutter):** photo-led, one-line "why for you," one metadata row (price band · open state · duration), **max 2 badges**; everything else behind the tap (Mindtrip's tabbed place card is the reference).
- **Micro-delight checklist:** haptics on reorder, springy sheet physics, pin-drop animations during research streaming, map camera choreography on day switch, "because you said X" chips — the details reviewers actually reward.

### 17.8 Cross-cutting UX doctrine (each rule verified; details in `UI_UX_RESEARCH.md` §8)

| Rule | Evidence anchor | Where it binds |
|---|---|---|
| Citations must actually support the displayed fact; source + one-line rationale by default, full provenance one tap deeper | Ding AAAI 2025; Kizilcec CHI 2016 | §6.7, §14 gate |
| Uncertainty labels: specific + numeric, decision-relevant facts only, never vague hedges | Joslyn & LeClerc 2012; van der Bles PNAS 2020 | §5.5, §6.7, §6.8 |
| Waiting: show real work (labor illusion); skeletons for layout stability filled with genuine partial results; shimmer not pulse; never claim/rely on "skeletons feel faster" | Buell & Norton 2011 (verified); skeleton evidence mixed | §6.5 |
| Endowed progress with a real reason ("City selected ✓ — 1 of 6") | Nunes & Drèze 2006 (34% vs 19%) | §6.2, §6.4 |
| Peaks & endings get disproportionate polish: plan-ready reveal, territory celebration, trip wrap | Peak-end rule (Redelmeier & Kahneman 1996) | §6.5, §6.21 |
| No punitive streaks; cumulative/per-trip progress instead; achievement + social mechanics over theming | Silverman & Barasch JCR 2023; Sharif & Shu; Xi & Hamari 2019 | §6.21 |
| Group fairness lives in the merge strategy; preference disclosures aggregate-only, never named | Barile UMUAI 2023; Najafian UMAP 2021 | §6.3 |
| One-handed reality: primary controls bottom/center, ≥48dp, glanceable 4–8s bursts | Hoober 2013; Parhi 2006; Oulasvirta 2005 | §6.18, §17.6 |
| Aesthetic polish is functional: perceived beauty → perceived usability (r≈.59–.92) | Kurosu & Kashimura 1995; Tractinsky 1997 | everywhere |

### 17.9 Design-system enforcement (CI)

The shared `contracts/` seam (§18.3) ships the tokens as data (`design-tokens.json`) **plus a contrast-assertion test** (run in Frontend CI): every declared text/background pair is recomputed (WCAG 2.2 relative luminance + APCA-4g) on every CI run and must meet its declared role's floor — body text ≥4.5:1 **and** ≥Lc 75; large/semibold ≥3:1 **and** ≥Lc 45; non-text UI ≥3:1. A token change that breaks a floor fails the build. This makes §17.2–17.4 self-verifying rather than aspirational (the v1 palette shipped "all combinations WCAG AA" as prose and was wrong; v2 makes it a test).

## 18. Implementation plan — independent work packages, parallel-safe by construction

> **This section replaces the old linear roadmap.** The build is decomposed into **work packages (WPs)**: units sized for one focused implementation session each, with **disjoint file ownership** and **frozen shared contracts**, so any two WPs can be built in parallel sessions (or one by one — the structure supports both) and merged later with near-zero conflict surface. P1/P2/P3 phase tags still describe *product* sequencing; WPs describe *build* sequencing.

### 18.1 Operating model: conductor and workhorse

- **Conductor** (supervising session — Fable 5): owns this PRD, the contracts, WP assignment, contract-change approval, merge sessions, and acceptance.
- **Workhorse** (implementing session — Opus 4.8): executes exactly one WP per session, per §18.2. The workhorse's job is faithful execution, not product judgment. **Every WP is purely frontend or purely backend** (§18.3) — a frontend WP is run by the `frontend-implementer` agent and touches only `Frontend/`; a backend WP is run by the `backend-implementer` agent and touches only `Backend/`. No WP ever spans both folders (this is what makes the CLAUDE.md role separation and the Vercel/VPS deployment split both hold).
- Typical usage: *"Implement B2 per FINAL_PRD.md §18. Follow §18.2 strictly."* — one backend session. In parallel, *"Implement F5 …"* — one frontend session. A third session later runs *"Merge B5 and F4 per §18.6."*

### 18.2 Workhorse rules of engagement (binding, non-negotiable)

1. **Scope is law.** Write only inside your WP's **Owns** paths (§18.4), which live entirely within your one folder (`Frontend/` or `Backend/`). Never create, edit, or delete a file outside them — and **never touch the other folder**. If your WP seems to need a change elsewhere, stop and report — do not make it.
2. **Contracts are frozen.** `contracts/**` is read-only for every WP except WP-0. It is the *only* shared code either folder may import. If a contract is wrong or missing, stop and produce a **contract-change request** (what, why, exact proposed diff) for the conductor. Never work around a contract, never fork a type locally, never reach into the other folder's source.
3. **No assumptions, no inventions.** Everything you need is specified in this PRD (the referenced §§ per WP) or in the contracts. If something is genuinely ambiguous, underspecified, or contradictory: **stop and return a numbered question list.** Do not pick "the reasonable option" silently. Do not add features, options, settings, or "improvements" that are not in the spec. Do not upgrade/downgrade specified libraries or swap specified technologies.
4. **Mock across the seam.** The frontend↔backend boundary is the API contract in `contracts/`. A frontend WP consumes the contract's types + fixtures and **never calls a live backend**; a backend WP produces responses that satisfy the contract + fixtures and **never imports frontend code**. Never stub a contract with invented shapes — use the fixtures.
5. **Branch discipline.** Frontend WPs on `fe/<n>-<slug>` (e.g., `fe/5-plan-view`), backend WPs on `be/<n>-<slug>` (e.g., `be/2-city-brain`); WP-0 on `wp/0-foundations`. Branch from the commit where WP-0 landed on `main` (or latest `main` if later WPs have merged — never from another unmerged WP branch). Commit messages: `<WP-id>: <imperative summary>`. Push only your own branch.
6. **Definition of done is a gate, not a suggestion.** A WP is complete only when every DoD item (§18.4) passes locally: typecheck, lint, unit tests, the WP's own verification script, and the §17.9 contrast test where UI is touched. Report results honestly — a failing test is reported as failing, never papered over.
7. **Self-contained proof.** Every WP ships a `VERIFY.md` in its owned area: exact commands to run its tests/demo against fixtures, so the merge session can validate it without re-reading the diff.

### 18.3 Repository layout — two dedicated deployable folders + a shared contract seam

The build is decomposed into **work packages (WPs)**: units sized for one focused implementation session, with **disjoint file ownership** and **frozen shared contracts**, so any two WPs run in parallel (or one by one) and merge with near-zero conflict surface. The layout is built for the owner's hosting model — **`Frontend/` deploys to Vercel, `Backend/` deploys to the VPS** (decision #25) — so the two are independent, separately-deployable folders; putting both on one server later changes nothing.

```
/contracts               ← THE frozen seam (WP-0 / conductor only writes). The ONLY code
                           shared across the folder boundary; imported read-only by both sides.
    types/               TS types + zod schemas for every entity (§10)
    api/                 route contracts: method, path, auth, request/response schemas, SSE shapes (§11)
    events/              §9.1 event-type catalog (names + payload schemas + consent flags)
    design-tokens.json   §17.2–17.4 tokens verbatim + role→floor declarations (§17.9)
    fixtures/            golden fixtures — the decoupling mechanism: 1 City Brain slice
                         (POIs+facts+geo-observations), 1 longlist (30 places), 1 solved 3-day
                         plan, profiles, trip+members, SSE research-progress event stream,
                         solver request/response pairs
    python/              generated pydantic models + JSON Schemas mirroring types/ + fixtures/,
                         so the Python services validate against the SAME contract (generated, not hand-written)

/Frontend                ← Vercel-deployable PWA (React + TS + Vite). Frontend WPs write ONLY here.
    src/{design-system,app-shell,routes-scaffold,map,auth,onboarding,settings,
         trips,curation,plan,cards,companion,research-progress,
         offline,offline-solver,brief,safety,narration-player,notifications}
    src/sw.ts · public/ (manifest, icons) · ui-tokens/ (generated from ../contracts/design-tokens.json)
    vercel.json

/Backend                 ← VPS-deployable. Backend WPs write ONLY here.
    api/src/{auth,profile,consents,pois,research,trips,members,invites,places,
             votes,geo,plan,narration,events,push}      (TypeScript Fastify API)
    services/pipeline/{brain,research,narration,learning}  (Python workers)
    services/solver/                                       (Python OR-Tools service)
    db/migrations/       the complete §10 schema as the baseline chain (append-only; post-WP-0
                         schema changes are contract changes — conductor-approved, written by the
                         owning backend WP)
    infra/               docker-compose.dev (Postgres+PostGIS, MinIO, Supabase Realtime, OSRM),
                         osrm/ config, deploy scripts (§12.1)

/  (root)                pnpm-workspace.yaml (globs: contracts, Frontend, Backend/api) + CI workflows only.
                         No app code at the root. Vercel builds with Root Directory = Frontend
                         (pulls contracts as a workspace dep); the VPS builds/ships Backend/.
```

**Why a shared `contracts/` and not duplicated copies:** a single source of truth for types/API/tokens/fixtures is what guarantees the frontend and backend agree without ever seeing each other's code. It is small, frozen, and conductor-owned. The Python services don't import TS — they consume `contracts/python/` (generated from the same source in WP-0), so the seam is one contract in two emitted forms, never two hand-maintained truths.

#### WP-0 — Foundations (the one serializing step; must land first)

One session, conductor-reviewed, merged to `main` before any parallel WP starts.

- **Scrap the mock frontend:** `git rm -r Frontend_Website/` — per the §0 directive, zero code reuse. Create the empty `Frontend/` and `Backend/` trees above.
- **Scaffold** the pnpm workspace + Python service skeletons + the full `contracts/` (types, API/SSE schemas, event catalog, design tokens, fixtures, and the generated `python/` mirror) + the complete §10 schema as the baseline migration chain.
- **CI skeleton:** typecheck + lint + unit tests per package; §17.9 contrast assertion (Frontend); migration-chain check (Backend); golden-fixture schema validation against both `contracts/types` (TS) and `contracts/python` (the honesty check that keeps mocks real); a **boundary guard** that fails CI if `Frontend/` imports from `Backend/` or vice-versa (only `contracts/` may cross).
- **DoD:** `cd Backend && docker compose up` gives a healthy dev stack; `pnpm -w test` green; `Frontend` builds a deployable static bundle; fixtures validate on both sides; boundary guard active; `Frontend_Website/` gone; root `README.md` maps every path to its owning WP.

### 18.4 The work packages (P1 scope) — Backend and Frontend blocks

Each entry: **Owns** (exclusive write paths, all inside one folder) · **Implements** (binding spec §§) · **DoD** (beyond §18.2's universal gates). All WPs run **in parallel** after WP-0. Each backend WP is paired to a frontend WP across the API contract (the "↔ pairs" in §18.5); the pair builds independently and merges together.

**Backend work packages** — `backend-implementer`, write only under `Backend/`:

| WP | Name | Owns (write paths under `Backend/`) | Implements | DoD highlights |
|---|---|---|---|---|
| **B1** | Auth, profile & consent API | `api/src/{auth,profile,consents}` | §6.1, §6.2 (server), §16.1 consent, GDPR export/delete | Magic-link + Google OAuth on dev stack; revocable server-side sessions (🧭 ET gap #8); consent flag written to events pipeline; RLS scaffolding |
| **B2** | City Brain | `services/pipeline/brain`, `api/src/pois` | §5 complete: ingestion (Overpass/Wikidata/Commons/advisories/holidays), atomic facts + conflict hierarchy (§5.3), entity resolution, geo-observation log + expiry purge (§5.5), viewshed test, TTL janitor; `GET /api/pois*` + brief data | Builds a real Brain for 1 golden city from recorded HTTP fixtures (no live calls in CI); resolution/dedup tests; provenance-never-rewritten test; coordinate display-gate unit tests (≥2-source/100m) |
| **B3** | Research pipeline | `services/pipeline/research`, `api/src/research` | §7 stages 0–3+5; §5.3 prompts (source hierarchy verbatim); §6.5 SSE stage events (shape from contracts); citation + coordinate gates (§14); cost meters (§15) | Zod-validated LLM I/O, bounded retries→degrade; SSE stream matches fixture event shapes; gate tests (uncited fact rejected, LLM coordinate rejected); per-stage cost metering emits |
| **B4** | Solver service | `services/solver` | §8 complete (every encoding-table row), warm-start replans, independent feasibility checker, CP-SAT auditor (CI) | Solves fixture request <3s incl. golden-hour clones, weather multipliers, deadline buffers; replan warm-start <1s; feasibility checker rejects a seeded-infeasible fixture; determinism test |
| **B5** | Trips, collaboration & realtime API | `api/src/{trips,members,invites,places,votes}` + realtime handler | §6.3 (roles/invites/merge incl. aggregate-only disclosure), §6.6 server side (fractional indexing, tiers/state), broadcast + presence | Fractional-index conflict test; misery-threshold merge unit tests; aggregate-only disclosure enforced server-side; RLS/ownership checks (🧭 ET gap #11); two-client realtime demo script |
| **B6** | Geo & adaptation APIs | `api/src/{geo,plan}`, `infra/osrm` | §6.8 anchors/buffers, §6.11 (deep-link params, scenic legs, pass-advisor math), §6.12 orchestration (reconfigure/go-now/closed-now calling B4), plan revisions (append-only, 🧭 gap #1), `GET .../bundle` manifest | Replan round-trip ≤5s against B4 fixture-service; deep-link URLs match §6.11 format exactly; revision append+restore tests; age-band buffer defaults unit-tested |
| **B7** | Narration & content API | `services/pipeline/narration`, `api/src/narration` | §6.13 (deep text + on-demand TTS + global cache), §5.6/§6.14 data side, §16.4 framing rules | Deep text generated from fixture facts with citations; MP3 cached-once semantics test; framing linter (no "safe" language) on generated text |
| **B8** | Events, learning v1 & replay harness | `api/src/events`, `services/pipeline/learning` | §9.1 (catalog from contracts), §9.2 v1 (weights, preference summary, Bayesian priors), §9.4 harness + golden-city eval skeleton, §6.15 capture side | Append-only enforced (no UPDATE grant test); impression logging with algo_version; NDCG@k / Kendall-τ on fixture sessions; consent-flag respected end-to-end |
| **B9** | Notifications API | `api/src/push` | §6.16 P1 server (web push VAPID, deadline scheduler, opt-in categories) | Push round-trip in dev stack; deadline scheduler unit test (6-week Alhambra fixture); categories opt-in-default-off |

**Frontend work packages** — `frontend-implementer`, write only under `Frontend/`:

| WP | Name | Owns (write paths under `Frontend/`) | Implements | DoD highlights |
|---|---|---|---|---|
| **F1** | Design system & app shell | `src/{design-system,app-shell,routes-scaffold}`, `ui-tokens/`, `public/` | §17 complete; §4 route scaffold (empty screens); theme system (system default + override); PWA manifest/icons/install prompts (🧭 ET gap #5) | Storybook/ladle renders every component in both themes; §17.9 contrast test green; pin-category ramp generated + returned to contracts via change request; Lighthouse PWA installable |
| **F2** | Map platform | `src/map` | §6.10; §17.4 map layer; §17.7 bottom sheet ↔ map behavior; muted + true-dark basemap styles | Renders fixture city PMTiles offline; pins/clusters/routes from fixture longlist+plan; 3-detent sheet with selected-pin-visible rule; 60fps pan on mid-range Android profile |
| **F3** | Auth, profile & onboarding UI | `src/{auth,onboarding,settings}` | §6.1/§6.2/§6.4 UI (quiz incl. photo-swipes, endowed progress), consent UI, GDPR export/delete UI | Full quiz flow against fixtures; sign-in gate placement (§6.2); "because you said X" chips; consent screen copy (§16.1) — all against fixtures, no live backend |
| **F4** | Trips & curation UI | `src/{trips,curation}` | §6.3 UI (roles/invites), §6.6 curation (tiers + drag w/ handles + undo tray), realtime client (broadcast/presence consumer) | Drag/tier flow against fixtures; disagreement chips aggregate-only (assertion test); optimistic reconcile against a mocked broadcast stream; accessible "move to…" fallback |
| **F5** | Plan, cards & companion | `src/{plan,cards,companion,research-progress}` | §6.5 progress UX (incl. peak reveal), §6.7 cards (citation/uncertainty doctrine), §6.9, §6.12 UI, §6.18 glanceability | Full plan/companion flows against fixtures incl. SSE replay; day tabs filter (🧭 ET gap #7); selection state machine (§4); citation tap-through renders provenance layer; leave-by countdown unit-tested |
| **F6** | Offline, PWA runtime & on-device solver | `src/{offline,sw}`, `src/sw.ts`, `src/offline-solver` | §6.17 complete (bundles, OPFS PMTiles, Cache Storage media, IndexedDB, `storage.persist()`, reachability heartbeat 🧭 gap #6, automated SW versioning 🧭 gap #10, manifest reconciliation, `/offline` vault); on-device greedy+2-opt re-solver | Playwright airplane-mode E2E: map renders, cards+deep texts readable, edits queue and sync; bundle ≤150MB on fixture city; **offline-solver verified against the SAME `contracts/fixtures` solver request/response pairs as B4** |
| **F7** | City Brief, safety UI & narration player | `src/{brief,safety,narration-player}` | §5.6/§6.14 surfaces, §6.13 player (play/seek + text toggle + offline fallback), §16.4 framing in UI | Brief/safety render from fixture data with citations; offline fallback shows deep text, never a silent gap (🧭 gap #4); player state machine unit-tested against a fixture MP3 URL |
| **F8** | Notifications UI | `src/notifications` | §6.16 P1 client (in-app notification center, per-category opt-in toggles, push subscription UX) | Categories opt-in-default-off in UI; notification center renders fixture notifications; subscription prompt flow tested |

**P2/P3 work packages** (same protocol, same FE/BE split, defined when scheduled): vault (§6.19, BE+FE) · multi-city (§6.20, BE+FE) · payments (§15, BE+FE) · reviews+moderation (§6.15/§16.2–3, BE+FE) · gamification (§6.21, BE+FE) · social import (§6.22, BE+FE) · LambdaMART+interleaving (§9.2, BE) · TWA/Play Store (FE/build) · P3: native app, embeddings/bandits, fairness rotation.

### 18.5 Dependency truth (what parallel really means)

- **Hard order:** WP-0 → everything. Nothing else is hard-ordered: every WP builds and tests against `contracts/` + fixtures, never against another WP.
- **The frontend↔backend pairs** (build independently, merge together): B1↔F3 (auth/onboarding) · B5↔F4 (trips/curation) · B2+B3↔F5+F2 (brain/research → plan/cards/map) · B4↔F6 (authoritative solver ↔ on-device re-solver, joined by shared solver fixtures) · B6↔F5/F6 (geo/adaptation) · B7↔F7 (narration) · B8↔F4/F5 (events emitted by the UIs) · B9↔F8 (notifications).
- **Fixtures are the decoupling mechanism.** F5 builds the plan view against the fixture plan long before B4 exists; B3 emits SSE events matching the fixture stream F5 already replays. If a fixture proves wrong, that's a contract change (§18.2 rule 2) — fixed once, centrally, by the conductor, and both sides pick it up.

### 18.6 Merge sessions (also run by a workhorse, different rules)

A merge session integrates 2+ completed WP branches into `main`:

1. **Order within the session:** rebase each WP branch onto current `main` — backend branches (`be/*`) then frontend (`fe/*`), each in ascending number. Expect near-zero conflicts (disjoint folders + ownership); any conflict outside `pnpm-lock`/generated files is a protocol violation to report, not silently resolve. A conflict *between* a `Frontend/` and a `Backend/` branch is impossible by construction — if one appears, a WP violated its scope.
2. **Gates, in order:** per-WP suites (via each `VERIFY.md`) → the boundary guard (no cross-folder imports) → cross-WP integration for the pairs being merged (the contract lists an integration checklist per pair, e.g. B3×F5: live SSE replaces fixture replay identically; B4×F6: both solvers agree on shared fixtures) → relevant §14 gates (golden-city eval once B2+B3+B4+B8 are in; airplane-mode E2E once F2+F5+F6 are in).
3. **Write scope of a merge session:** integration/wiring/config glue only — a frontend↔backend wiring change touches the API client config in `Frontend/` and route registration in `Backend/`, never a WP's owned logic. Bug fixes inside a WP's area are allowed **only** with a logged note per fix (file, cause, why it couldn't wait for the owning WP's session).
4. **Milestones (suggested):** M1 = F1+F2 (visual shell on real map) · M2 = +B1+F3 (accounts live) · M3 = B2+B3+B4 (the intelligence spine, backend demo) · M4 = M2+M3+B5+B6+F4+F5 (**the vertical slice: create trip → research → curate → solve → plan view for one golden city — the product exists**) · M5 = +F6+B7+F7 (offline + narration: the companion promise) · M6 = +B8+B9+F8 (learning + push: the compounding promise) → P1 feature-complete, §14 full gate suite, beta.

### 18.7 Product phases (unchanged scope, expressed in WPs)

**P1 — the core product** = WP-0 + B1…B9 + F1…F8 (everything tagged [P1] in §5–§16; launches free/beta to seed City Brains and validate willingness-to-pay). **P2 — depth & community** = the P2 work packages above (payments live, vault, public reviews + moderation surface, multi-city, gamification, social import, email digests, LambdaMART, TWA, shareable read-only links). **P3 — expansion** = native app (React Native/Expo — a third top-level folder when it starts), embeddings + bandits, group-fairness rotation, trip journal/memories, community guides, affiliate experiment (if ever).

## 19. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Research quality varies by city (thin blog/video coverage) | Coverage score per Brain; below threshold → wider source net + honest "limited research" label; golden-city evals catch regressions. |
| Cold-city wait disappoints | Skeleton-in-2-min UX + push on completion + pre-warm top ~50 launch cities. |
| Wrong price/hours shown | Citation gate, as-of labels, near-date re-verification, post-visit correction loop. |
| Missed train/flight (worst failure) | Conservative age-aware buffers, hard solver deadline, leave-by push, "verify with operator" label on departure day. |
| UGC abuse / fake reviews | Verified-visit labeling, LLM pre-moderation + human queue, DSA/Omnibus compliance (§16), rate limits. |
| Copyright/ToS exposure from ingestion | §16.5 posture: sanctioned APIs, atomic facts + attribution, no transcript/prose storage. |
| LLM infeasible plans | Structurally impossible — solver owns the schedule; independent checker. |
| Group conflict | Constraint vetoes + misery threshold + visible disagreement + append-only restorable revisions. |
| iOS PWA storage eviction | persist() + <150MB bundles + re-download UX; native app P3. |
| Cost runaway (research/LLM) | Quotas, meters, tiering, Brain amortization; cost regression alarms in CI. |
| Repeating ET debt | All 11 documented gaps structurally fixed (revisions, single schema, one taxonomy, honest offline audio states, installability, reachability, filtering day tabs, revocable auth, leg creation UX, automated SW versioning, multi-tenant). |

## 20. Open questions

1. Launch cities (recommend EU top-50 pre-warm; the 10 golden eval cities). 2. Narration voice identity. 3. Free-tier quota numbers (cold researches/month, trips). 4. Review publication timing: launch capture-only [P1] and publish reviews at [P2], or publish immediately? (Recommended: capture-first — accumulate before display.) 5. Age-band buffer defaults — validate with real users before hardening. 6. Whether "Prepare narration for my trip" pre-generation should be free-tier-limited (cost is small but nonzero). 7. VPS sizing validation under real beta load (starting point ~4 vCPU/16 GB/160 GB; geo/AI services dominate the footprint — confirm on a test box before committing) and when to split into app+DB vs geo/worker boxes. 8. Geoapify accuracy spot-checks in target regions (fine for European cities; thinner outside Europe — measure before relying on it there).

---

*End of PRD. §5–§16 are the build spec; §17 is the design system (verified, CI-enforced); §18 decomposes the build into independently-implementable, parallel-safe work packages and defines the conductor/workhorse protocol. Companion documents: `LEARNINGS.md` — the full decision log and reasoning; `UI_UX_RESEARCH.md` — the verified UI/UX evidence archive.*

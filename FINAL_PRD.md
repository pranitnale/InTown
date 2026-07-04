# InTown — The Ultimate AI Trip Companion — Final PRD

> **Status:** Production specification — the single authoritative PRD. Grounded in ten deep-research rounds, both parent apps (the original InTown PRD and the as-built Europe Trip Map app), a survey of the current codebase, and all owner decisions. The complete reasoning trail behind every choice here lives in `LEARNINGS.md`.
> **Date:** 2026-07-04.
> **Vision in one line:** *A traveler normally needs 100+ hours of YouTube videos and blog posts to plan the perfect city trip. InTown reads all of it, verifies it, personalizes it, schedules it, and then walks the trip with you — offline.*

---

## 0. How to read this document

- **📐 Behavior** — the requirement.
- **⚙️ Mechanics** — implementation approach.
- **🧭 Lesson** — carried from a parent app (ET = Europe Trip app, IT = InTown v1) or research, and why.
- **[P1] [P2] [P3]** — delivery phase tags (§18). Everything is specified now; phases only sequence the build.

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
| OSM (+ Geoapify/Overpass) | Places, geos, categories, `fee` flag, wheelchair tags, viewpoint `direction` | Bulk, legally storable |
| Wikidata / Wikipedia | Significance, facts, images (P18), prominence | API, storable, attributed |
| Wikimedia Commons (GeoSearch) | Photo galleries | Storable + attribution per license |
| Official sites (attraction, city, transit operator) | Hours, prices, pre-booking rules, transit passes | LLM web research; **facts stored with source URL + retrieved-at date** |
| Travel blogs & forums (incl. Reddit) | Hidden gems, best-time reasoning, scams, tips, scenic routes | LLM research; **atomic facts only** (never republished prose); ≥2 independent sources for experience claims (corroboration threshold); per-claim citation |
| **YouTube** (as a research source) | The richest "what's it actually like" signal; best-time, queue tips, scams, which places matter | **Primary (owner decision): the deep-research prompt explicitly instructs the search-grounded LLM to analyze YouTube coverage** of the city (video titles, descriptions, surfaced transcript content, comments) alongside blogs — cheap, part of the same research pass. **Escalation for thin-coverage cities:** Gemini native YouTube-URL ingestion of the top ~10–20 videos (paid tier, low-res, ~$1–4/city). Either way: extract structured facts with video URL attribution, **never store or display transcripts**, quotes ≤1 sentence. yt-dlp/transcript-scraping explicitly rejected (ToS + active litigation). |
| Gov travel advisories (US State Dept — public domain; UK FCDO + German AA — open licenses with attribution) | Country/city safety baselines | API/feeds, storable, attributed |
| Open city crime data (data.police.uk, Berlin Kriminalitätsatlas, data.gouv.fr…) | Area-level caution shading where available | Per-city, openly licensed |
| Public-holiday API (Nager.Date / OpenHolidays — free) | Holiday closures into solver time windows | API, storable |
| Google Places (New), field-masked | Verification of hours where open data fails; live photo fallback | **Never stored beyond ToS**; verification layer only |
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

Identity (name, aliases, geo, category — **one unified enum**: SIGHT, MUSEUM, VIEWPOINT, PARK_NATURE, ENTERTAINMENT, NIGHTLIFE, SHOPPING, RESTAURANT, CAFE, OTHER; 🧭 ET gap: three conflicting taxonomies), significance + description, photos, opening hours + holiday exceptions, **entry: free/paid + price + currency + source + as-of**, **booking requirement enum** (walk-up OK / recommended / timed entry / sells out weeks ahead + advance window), **best-time windows with reasons** ("sunrise: empty + best light on the east façade — 3 sources"), typical visit duration (category prior → Bayesian per-place posterior from real visits), indoor/outdoor/mixed, effort/accessibility (wheelchair, stairs, stroller), **cautions** (pickpocket hotspot, common scam patterns — attributed), scenic-approach notes, official links, user rating aggregate + reviews, web-sentiment score (until own ratings reach critical mass).

**Restaurants — the authenticity doctrine (owner decision):** the app recommends **only places where locals actually eat**; tourist traps are explicitly hunted and excluded, not just deprioritized. Per restaurant the Brain stores:
- **Authenticity score with evidence** — the research prompt is instructed to weigh *where locals recommend eating* (local-language reviews and their share vs tourist-language reviews, local food blogs/forums, "where locals eat in {city}" coverage) and to **penalize tourist-trap signals** (front-of-monument location + weak local reputation, tout-style multilingual picture menus, review patterns skewed to one-time visitors). Below threshold → not shown, period.
- **"What to order"** — the signature dishes of *this* place and how they connect to the city's food identity, cited ("order the cacio e pepe — the Roman classic this trattoria is known for; 3 sources"). Most travelers want to eat authentic — every restaurant card answers *what* and *why*.
- Cuisine, dietary compatibility flags (per §6.2 rules), price tier, reservation-needed flag, local meal-time customs (dinner at 21:00 in Spain — feeds the solver's meal windows).
The **City Brief** (§5.6) additionally carries the city's **food identity**: the dishes this city is famous for, and the best cited place in the plan (or Brain) to try each one.

### 5.5 Entity resolution (the on-the-go DB's hard problem)

⚙️ Every ingest path (OSM import, LLM research mention, user add, Google verification) resolves to one canonical place: match by external IDs (osm_id, wikidata_id, google place_id) first, else fuzzy name similarity + geo distance (<150m) + category compatibility; below threshold → new place flagged `unverified` until grounded. Merges keep all source_refs; unmerge tooling for mistakes. Without this, the Brain fills with duplicates and the learning system's signals fragment.

### 5.6 The City Essentials brief

📐 One screen per city, researched with the Brain [P1]: safety overview + common scams ("commonly reported by travelers," attributed, dated), pickpocket hotspots, **transit-pass advisor** (cards/passes with cited prices; §6.11), **the city's food identity** (the dishes it's famous for + the best cited local place to try each — §5.4 authenticity doctrine), etiquette + tipping + local meal times, tap-water safety, public holidays during the trip ("Monday is a holiday — many museums closed"), emergency numbers, local SIM/connectivity note. Framing rules (§16.4): warn freely, never certify anything "safe."

---

## 6. Feature specifications

### 6.1 Accounts & traveler profile [P1]

📐 Sign-in required (magic link + Google OAuth). **Traveler profile:** name, **age band aligned to European pricing boundaries** — <18 / 18–25 / 26–44 / 45–64 / 65+ (data-minimized: band, never birthdate) — plus **EU/EEA residency** (yes/no) and **student status**, because attraction discounts hinge on all three (under-26 EEA free at French national museums; 65+ reduced in Italy but *not* France; ISIC student rates); mobility (full / limited / wheelchair / stroller), languages, home currency. Drives editable defaults: pace preset, dwell padding, walking budget, **departure buffers** (§6.8), heat-aware scheduling, accessibility filtering, and the **price engine** ("free for you" detection). **Anti-ageism rule (research: 61% of families report grandparents more active than expected; most design research carries ageist assumptions): age pre-selects a pace preset the user sees and can change — it never caps anything.** Full GDPR export + deletion.
⚙️ Supabase Auth (or Auth.js + Postgres); httpOnly sessions, revocable server-side (🧭 ET gap: constant-payload cookie), rate-limited auth + research endpoints. RLS multi-tenant from day one (🧭 ET gap: hardcoded trip, no scope checks).

### 6.2 Taste profile [P1]

📐 Drag-ranked interests + custom; **anti-preferences first-class** ("skip museums," "no crowds"); dining rules; budget tier; pace; companions default. Evolves from feedback events, transparently ("Your profile learned: museums ↓ — undo?"). Consent-gated (§16.1) with a functional non-personalized mode.

**Progressive profiling — the friction law (research-backed):** no successful travel app front-loads a profile form (Mindtrip, Wanderlog, Airbnb all collect at trip time or infer from behavior); every added required field costs ~3–5% completion, yet a *quiz whose every answer visibly changes the output* increases engagement (Headspace: +7.6pp course starts from a short personalization quiz; Duolingo's long onboarding works because each answer alters the experience). The rule: **ask a question only at the moment its answer visibly changes what the user gets, and never ask at signup what can wait.**

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
- **Preference merge:** hard constraints (dietary, mobility, budget caps) = **filters** — anyone's "no pork" governs all meal picks; trivially explainable veto. Soft interests = **average-with-misery-threshold** (a place any member vetoes or scores very low is excluded or flagged — the empirically user-preferred strategy in tourism group-recommender studies). **Disagreement always displayed** ("3 of 4 want this") — research: the explanation drives perceived fairness more than the algorithm. Fairness rotation across days ("today leans Alice") designed-for, shipped [P3].
- One shared itinerary per trip (the group moves together).
⚙️ Supabase Realtime **Broadcast** (broadcast-from-DB triggers, sub-50ms) + **Presence** (avatars, "viewing" indicators). Postgres is the single source of truth; per-column LWW with server timestamps; optimistic UI reconciled on broadcast; **fractional indexing** for order (string keys, only the moved row written, jitter against concurrent inserts, periodic rebalance — the Figma pattern; `fractional-indexing` npm). **CRDTs deliberately rejected** — unneeded for row lists.

### 6.4 Trip setup [P1]

📐 Redesigned to the progressive-profiling map (§6.2): city + dates + arrival/departure times → companions → pace → budget band (one-tap screens, progress bar) → **photo-swipe taste round** (first trip only; later trips show the profile pre-filled with a "still you?" confirmation) → accommodation anchor (location / address / skip) → transport mode → must-see + avoid lists (optional, skippable). Luggage-storage flag and departure deadline collected on the departure-day sheet, not upfront. Under 2 minutes for returning users; the existing `Frontend_Website` wizard is the skeleton, restructured to one-question-per-screen with visible plan-shaping feedback ("family mode: shorter walks, playground stops ✓").

### 6.5 Research pipeline UX [P1]

📐 Staged and visible, never a blind spinner — this is the **Labor Illusion** deployed deliberately (Buell & Norton: users *prefer* a travel search that takes 60s while showing its work over instant identical results, and value the result more). Stream a live research log echoing the user's own interests — "Reading 34 blog posts and 22 videos about Lisbon…", "Cross-checking opening hours on official sites…", "Checking safety notes and common scams…", "Scoring 61 candidates against your group's tastes…" — **with pins dropping onto the map live as places are found**, and results streaming into skeleton cards day-by-day (skeletons with slow shimmer, never spinners — measurably higher perceived speed). The slowest moment becomes the most persuasive one. **Cold city:** the honest, simple message (owner decision): *"InTown is researching {city} — we'll notify you as soon as your itinerary is ready."* The user can leave; a push lands on completion. (A skeleton preview may still render early where useful, clearly marked "research in progress.") **Warm city:** longlist in seconds; only staleness re-verification runs. Partial source failures degrade gracefully (labels, not blanks; 🧭 ET reliability doctrine).

### 6.6 The curation stage [P1]

📐 The product's heart. The pipeline outputs a **prioritized longlist** (~2× plannable count; e.g., 30–40 for 3 days), best-fit first.
- **Rows:** photo, name, category, one-line significance, "why it fits you/your group," fee badge (Free / €12 / ?), pre-book warning badge, est. duration, caution badge if applicable, vote chips (group).
- **Interactions:** **priority tiers + drag**: the list is grouped into **Must-see / Want / Maybe** tiers (tier judgments are cognitively cheaper than globally ordering 40 items — pairwise-elicitation research), with **drag-to-reorder** inside and across tiers as the fine-grained priority signal (explicit **drag handles**, never whole-card long-press — it fights scrolling; haptic bump on grab, elevation lift, ~100ms settle, auto-scroll at edges, plus an accessible non-drag fallback "move to…" menu). Also: **remove** (undo tray + restore), **lock must-do** (gold badge — hard solver constraint), **vote**, tap → decision card, **add own places** (search or map tap → appended, attributed), map/list split with numbered pins mirroring the list.
- The list is the contract: **only kept places enter the itinerary; the order is a priority weight, not a visit sequence** (the solver decides sequence — §8).
- Every interaction becomes a learning event (§9). Footer CTA: **"Build my days."** Curation is revisitable anytime; changes re-solve.

### 6.7 Decision cards [P1]

📐 Everything needed to decide, one screen: photo gallery (Commons-first, attributed) · full description + significance (cited) · "why this fits" · opening hours for the trip dates (cited or "N/A + official link", holiday exceptions flagged) · **Entry: full age/status tariff table where published** — stored as `{tier, age_range, residency_condition, price, ID_required}` (adult / child / youth / senior / student + free-entry rules: EU under-26, first-Sunday-free, 65+ reductions — residency and ID requirements are first-class, since most discounts are conditional on them), with the **group's own price** computed from member profiles and **"Free for you" highlighted** ("Maria enters free — under-26 EEA; bring ID") · price source + "as of" date · **Booking:** walk-up OK / book recommended / **timed entry — book ~6 weeks ahead** + official ticket link (only) · **Best time to visit** with the *reason* ("sunrise: empty + golden light — per 3 blogs & 2 videos") · computed golden-hour window for photo spots (suncalc, offline) · typical duration (editable) · cautions ("pickpocket hotspot — commonly reported") · accessibility notes · user ratings + reviews (+ web-sentiment until critical mass) · website · all citations tappable.
Actions: remove / must-do / vote / note / share. Honesty rule everywhere: **unknown = "unknown — check official site," never guessed.**

### 6.8 Building the days: anchors, times, deadlines [P1]

📐
- **Start anchor:** current GPS location / accommodation / any picked point. **Start time:** explicit for day 1 ("start from here at 13:30"); later days default from accommodation at the profile's pace-based start time; all editable per day.
- **Departure anchor (hard deadline):** "I must be at Gare de Lyon at 16:00" → the last day's route **ends at the station with arrival at 16:00 minus buffer**. **Buffer defaults by transport kind and age band** (baseline: train 45 min, flight 2h30, bus/ferry 40 min; +15–30 min for 60+ or limited mobility, −10 min for 18–29 fast pace) — always shown and editable ("arrive 45 min early — change?"). Missing a booked train is the worst failure the app can cause; buffers are conservative by default. Same mechanism for any hard appointment mid-trip (booked timed-entry tickets become locked time windows).
- **Departure-day logistics:** the user declares whether they'll have **luggage to store** that day (simple toggle at trip setup / departure-day sheet). If yes, the solver knows checkout time vs departure time and schedules **luggage storage** (lockers/staffed storage are first-class POIs in the Brain) or keeps the last stops near the station, and says so ("stored luggage at Central Lockers 11:00, €8/day — cited"). If no, no storage stop is forced.

### 6.9 The plan view [P1]

📐 As v2, confirmed: full-bleed MapLibre map, **day tabs that actually filter content** (🧭 ET gap), Now/Next timeline linked to the map (tap ↔ fly, time-scrub), colored+patterned mode segments with direction arrows, numbered category pins + gold must-do badges + strikethrough closed states, meal slots as first-class entries with one-tap alternates, weather ribbon with proactive nudges, you-are-here dot (ref-counted watchPosition — 🧭 ET), **budget line per day** ("~€47 in entries today") summing cited prices. Every plan change appends a **plan revision** (restore anytime — 🧭 ET gap #1, clobbering made structurally impossible).

### 6.10 The map platform [P1]

📐 Google-Maps-grade interactions on open source: tap **any** POI → place card (Brain-backed; add-to-day, navigate) · "places around" category browse ranked by fit · city-biased search-to-add (🧭 ET: search is an *add* action) · long-press ad-hoc route preview.
⚙️ MapLibre GL JS + Protomaps PMTiles (self-hosted/CDN); our POI layer served as vector tiles from PostGIS; `queryRenderedFeatures` for basemap POIs; Photon/Nominatim geocoding (Geoapify fallback); OSRM/Valhalla self-hosted for walk/drive times **feeding the solver matrix**; transit *times* approximated (Transitous/OTP where available, else conservative estimates) because step-by-step transit is delegated (§6.11).

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

**Architecture law (TravelPlanner benchmark: LLM-only ≈ 0.6–4.4% feasible; LLM+solver ≈ 97%):** *the LLM researches, personalizes, and narrates; the solver schedules. The LLM never emits arrival times.*

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
**City Brain:** `cities`(bbox, pmtiles_path, brain_status, warmed_at), `pois`(canonical, source_refs jsonb, category enum, geog, prominence, indoor_outdoor, accessibility), `facts`(**atomic-fact table** §5.3 — entity_id, attribute, value jsonb, source_url, source_kind, observed_at, confidence, corroboration, status), `poi_hours`, `poi_enrichment`(per-language significance/scripts/audio_path, generated_at), `city_briefs`, `scenic_legs`, `transit_passes`.
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
| Frontend | React + TS + Vite PWA (evolve existing `Frontend_Website`); Zustand; SW + OPFS/Cache Storage/IndexedDB |
| Map | MapLibre GL JS + Protomaps PMTiles (self-hosted/R2); own PostGIS vector-tile POI layer |
| Geocoding/search | Photon/Nominatim self-hosted → Geoapify fallback |
| Routing (times for solver) | Self-hosted OSRM/Valhalla (walk/drive); Transitous/OTP transit estimates where available; **step-by-step delegated to Google Maps deep links** |
| Weather | Open-Meteo (free) |
| Holidays | Nager.Date / OpenHolidays (free) |
| LLM | Tiered, provider-agnostic (reasoning + fast); **Gemini paid tier for YouTube URL ingestion**; zod-validated I/O |
| Solver | OR-Tools routing (Python service); CP-SAT offline auditor; JS/WASM greedy+2-opt on device |
| TTS | Piper/Kokoro self-hosted → Google Cloud TTS free-tier fallback |
| DB/Auth/Storage/Realtime | Supabase (Postgres+PostGIS, Auth, Storage, Broadcast+Presence) or self-hosted equivalents |
| Backend | TypeScript API (Fastify/Next) + Python pipeline/solver workers + job queue; SSE for progress |
| Push | Web Push (VAPID) — Android + iOS ≥16.4 installed PWA |
| Ranking [P2] | LightGBM LambdaMART; replay harness in CI |
| Observability | Structured logs, Sentry, per-stage pipeline metrics, per-API cost meters + alerts |

## 13. Non-functional requirements

**Latency:** warm-city longlist ≤ 30s; cold-city skeleton ≤ 2 min (full brain 5–15 min, notified); solve ≤ 3s; replans ≤ 5s end-to-end; card open < 300ms cached; 60fps map on mid-range Android.
**Accuracy:** ≥95% displayed facts cited-or-N/A (hard gate); solver feasibility 100% (independent checker); price staleness ≤ 12 months or labeled.
**Reliability:** every external dependency has a degrade path; missing config → instructional error (🧭 ET); on-device error console in dev builds.
**Cost ceilings:** §15. **Privacy/GDPR & content law:** §16. **Accessibility:** WCAG AA (IT color system), pattern+color route encoding, transcripts for audio, formal audit pre-launch.
**Security:** revocable sessions, RLS, rate limits (auth + research + events), server-only keys, path-traversal guards, sanitized rich text, moderation audit log.

## 14. Guardrails, testing & evaluation

Schema validation at every LLM boundary (bounded retries → degrade) · citation-or-N/A validator rejects non-compliant cards/plans pre-display · corroboration threshold (≥2 sources) for experience claims · independent solve-feasibility checker · **golden-city eval suite** (nightly, deploy-gating) · replay harness (§9.4) · reconfigure determinism tests · airplane-mode E2E (Playwright + SW): map renders, audio plays, edits queue/sync · moderation-flow tests (notice → decision → statement of reasons) · cost regression alarms · rollback: feature flags per pipeline stage; tool outages degrade narration/research gracefully, static plan survives.

## 15. Cost model & controls

**City Brain build (one-time per city, amortized across all users forever):** YouTube via Gemini low-res ~$1–4 (30h video) + blog/forum research ~$1–3 + advisories/open data ≈ $0 → **≤ ~$5–8/city cold**, trending to ~$1/refresh cycle.
**Per trip:** warm city ≤ $0.05 (scoring + solve); cold city bears the Brain build once. Narration ≈ $0 (self-hosted TTS, generated on demand, globally cached). Verification (Google field-masked) $0.20–0.60/trip worst-case cold.
**Fixed:** OSRM + tiles + TTS + solver hosting ~$50–150/mo initial; storage/CDN cheap. BestTime.app **removed** from the plan (owner decision — research-derived timing instead): −$29+/mo.
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
5. **Content ingestion posture:** YouTube only via Gemini URL ingestion (paid tier — contractually cleanest; no yt-dlp, no transcript scraping); store only derived atomic facts with attribution + links (facts aren't copyrightable — Feist); quotes ≤1 sentence; blog/forum prose never republished; Google Places data never persisted beyond ToS; Commons/Wikidata images attributed per license. Freedom-to-operate glance at US 9,127,957 (weather-based indoor/outdoor scheduling) before launch.

## 17. Design system

**InTown Color System v1** (inherited from the original InTown PRD, inlined here as the source of truth):
- **Brand:** Primary InTown Blue `#2563EB` · Accent Jade `#10B981` · Highlight Iris `#7C3AED` (sparingly) · Slate neutrals `#F8FAFC / #FFFFFF / #E2E8F0 / #94A3B8 / #0F172A` · Semantic: success `#22C55E`, warning `#F59E0B`, error `#EF4444`.
- **Light mode:** bg `#F8FAFC`, surface `#FFFFFF`, text `#0F172A` / secondary `#475569`, borders `#E2E8F0`, primary CTA `#2563EB` (pressed `#1E40AF`, on-primary `#FFFFFF`), accent chips `#10B981` (pressed `#047857`).
- **Dark mode:** bg `#0B1220`, surface `#111827`, text `#F8FAFC` / secondary `#94A3B8`, borders `#1F2937`, primary `#60A5FA` (pressed `#3B82F6`, on-primary `#0B1220`), accent `#34D399`.
- **Route segments (color + pattern for color-blind safety):** walking `#22C55E` dashed · public transit `#3B82F6` solid · driving `#F59E0B` solid thicker · bike `#84CC16` / ferry `#06B6D4` optional. Active route 85% opacity, future steps 45%.
- **Pins (category color → icon):** photo spots `#D946EF` · hidden viewpoints `#06B6D4` · art `#F97316` · history `#6366F1` · museum `#3B82F6` · food `#10B981`. Selected ring `#2563EB` + white inner (light) / `#111827` (dark); closed = `#94A3B8` fill + strikethrough label; must-see = gold badge `#F59E0B`.
- **Bars:** frosted bottom bar (white @92% blur light / `#111827` @96% dark); all text/CTA combinations WCAG AA.
The existing frontend implements a close variant — align tokens in the polish pass. New additions needed: caution badge style, verified-visit badge, disagreement chips, fact-citation chips with as-of dates, presence avatars.

**The itinerary UI pattern (research-validated — "this is a UI play"):**
- **Macro-layout:** full-bleed map canvas + **persistent non-modal bottom sheet with three detents** (peek / half / full — Google Maps model; the map stays interactive behind the sheet, scroll-up expands, drag-down collapses, grabber affordance per Apple HIG / Material 3). Desktop: split map/list (the most design-praised pattern — Wanderlog's "standing ovation" layout).
- **Sheet content:** vertical **day timeline** — numbered stops with travel-time connectors between them ("🚶 12 min"), meal slots inline, horizontal **day tabs pinned at sheet top**; switching days choreographs the map camera. On travel days the sheet leads with the **Now/Next card** (plan mode ↔ live mode).
- **Pins:** numbered + day-color-coded, matching list numbering; clustered at low zoom; selected pin ↔ selected card two-way sync.
- **Cards (decision-dense without clutter):** photo-led, one-line "why for you," one metadata row (price band · open state · duration), **max 2 badges**; everything else behind the tap (Mindtrip's tabbed place card is the reference).
- **Micro-delight checklist:** haptics on reorder, springy sheet physics, pin-drop animations during research streaming, map camera choreography on day switch, "because you said X" chips — the details reviewers actually reward.

## 18. Roadmap

**Phase 1 — the core product:** accounts + traveler/taste profiles + consent · trips, invites, roles, shared curation + votes + realtime · City Brain v1 (open-data skeleton + blog/official-site research + YouTube-via-Gemini + advisories; on-the-go, per-city) · longlist + decision cards (prices/pre-book/best-time cited; cautions; Commons photos) · City Brief incl. transit-pass advisor · start/departure anchors + buffers → OR-Tools engine (priorities, hours, holidays, meals, weather, golden hour, deadlines) · plan view + map platform + Google Maps leg deep-links + scenic notes · reconfigure + go-now + closed-now · on-demand narration + "prepare my trip" · **full offline incl. basemap** · post-visit corrections capture + ratings capture · event log + v1 learning + replay harness · push notifications (booking deadlines, research-complete, leave-by) · budget line.
**Phase 2 — depth & community:** **per-city payments go live** (P1 launches as free/beta to seed City Brains and validate willingness-to-pay) · document/ticket vault (ET port) · public reviews + DSA/Omnibus moderation surface · **multi-city chaining** with inter-city legs + luggage logistics · **gamification & roles** (§6.21) · **Want-to-go social import** (§6.22) · email digests (booking deadlines) · LambdaMART + interleaving · multi-language narration · TWA on Play Store · offline reconfigure polish · shareable read-only trip links.
**Phase 3 — expansion:** React Native/Expo native app · embeddings + bandits · group fairness rotation · trip journal/memories · community guides (curated lists from anonymized aggregate behavior) · affiliate experiment (if ever, per decision).

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

1. Launch cities (recommend EU top-50 pre-warm; the 10 golden eval cities). 2. Narration voice identity. 3. Free-tier quota numbers (cold researches/month, trips). 4. Review publication timing: launch capture-only [P1] and publish reviews at [P2], or publish immediately? (Recommended: capture-first — accumulate before display.) 5. Age-band buffer defaults — validate with real users before hardening. 6. Whether "Prepare narration for my trip" pre-generation should be free-tier-limited (cost is small but nonzero).

---

*End of PRD. §5–§9 are the build spec; §18 sequences it. Companion document: `LEARNINGS.md` — the full decision log, research findings with sources, and the reasoning behind every choice in this document.*

### **Known Decisions**

- **Platform:** Android; **English only**.

- **Core:** Map-first, LLM-researched itinerary; no booking; live you-are-here; colored walking/transit/drive segments.

- **Pins/Popups:** Name, one-line fit to preferences, arrival & dwell time + buffer, one-sentence significance, citations, official link, **Generate narration** (60–90s, in-app play).

- **Controls:** Bottom bar → **Looks good** / **Something missing** → then **Reconfigure** (gentle adjust from current time/location) / **New plan** (optionally new prefs).

- **Inputs:** 
  
  1.City, 2. Dates/time of arrival and return, 3. Accommodation (auto-geocode or manual), 4. Transport type (public or car), 5. Walking preferences, 6.  interests (art, history, museum, Instagram, hidden viewpoints, custom) with **drag-to-priority**; restaurant prefs (local, vegan, vegetarian, only chicken, no pork, no beef, everything) to schedule breaks,**buffer time**.

- **Accounts:** **Guest only** in v1 (toggle shown, no sign-in).

- **Connectivity:** Internet required; no offline in v1 (offline pushed to v1.1).

- **Sources & Truth:** Source badges/citations in popups; strict guardrails (never invent hours; if uncertain → **N/A** + official link).

- **APIs:** GPT-5 Thinking for research/plan; Google Maps/Places; Google TTS; simple “tool/mcp internet search” OK.

- **Top Risks:** Poor recommendations; inaccurate hours/weather.



## 📝 Abstract

An Android app called "InTown" that creates and adapts **personalized, map-first city itineraries**. Users input city, dates, accommodation, transport mode, preferences (rank-ordered), buffer time, and restaurant filters. An LLM researches and composes a **route-aware, weather-aware** day plan with colored walking/transit/drive segments. Each stop shows a concise, preference-tuned summary, arrival/dwell times, citations and official links, and a **60–90s narration** (in-app TTS). The user can approve, flag “something missing,” or **reconfigure** mid-day; the plan recalibrates using current time/location without drifting far from the approved plan.

## 🎯 Business Objectives

- Reduce trip-planning time from hours to minutes through automation.

- Increase traveler satisfaction by aligning stops to personal priorities and constraints.

- Build trust via **source transparency** (citations) and strict accuracy guardrails.

## 🏆 Success Criteria

- Users can generate a **complete, approved** daily plan without manual research.

- Reconfigure returns a viable plan that **respects priorities** and current context.

- Popups show **clear, cited** facts; uncertain hours labeled **N/A** with official link.

- Narrations are concise (≤90s), helpful, and consistently available.

- App remains responsive during navigation (no freezes; GPS smoothness acceptable).

## 🚶‍♀️ User Journeys

- **First-time traveler:** Enters trip details, ranks interests, sets buffer time, adds “must-see,” gets a plan, approves, and starts navigating.

- **Mid-day detour:** Weather shifts; taps **Reconfigure**; plan swaps to covered options, keeps top priorities, adjusts times, and continues.

- **Preference change:** Taps **Something missing**, adds “hidden viewpoint near Old Town” + “no pork,” gets **New plan**, approves, continues.

- **On-site learning:** At a pin, taps **Generate narration** for a 60–90s explainer; plays audio in-app.

## 📖 Scenarios

- “Instagram spots, skip museums, local food only” for a 2-day weekend with public transit.

- “Rain from 14:00—switch to covered arcades and café; keep sunset lookout if skies clear.”

- “Rental car day trip; minimize city center parking; cluster stops; one budget lunch.”

- “Tight schedule; remove lower-priority stops while preserving top 3.”

## 🕹️ User Flow

- **Trip Setup → Plan Generation → Review (Looks good / Something missing) → Navigate → Reconfigure/New Plan as needed → End-of-day quick feedback.**

## 🧰 Functional Requirements

Describe features and expected behaviors with user stories and acceptance hints.

| SECTION     | SUB-SECTION                                         | USER STORY & EXPECTED BEHAVIORS                                                                                                                                                                                                | SCREENS       |
| ----------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Trip Setup  | City and Dates & Time of Arrival in city and Return | As a traveler, I enter city, dates, arrival; app validates and infers sunrise/sunset windows.                                                                                                                                  | Trip Setup 1  |
| Trip Setup  | Accommodation                                       | I choose **Use my location (auto-geocode)** or **Enter address manually**; saved only on device.                                                                                                                               | Trip Setup 2  |
| Trip Setup  | Travel Companions                                   | I choose solo, couple, family, friends                                                                                                                                                                                         | Trip Setup 2  |
| Trip Setup  | Transport                                           | I select public transit or rental car; app sets routing mode and colors segments accordingly.                                                                                                                                  | Trip Setup 3  |
| Trip Setup  | Walking Preferences                                 | low,medium, high                                                                                                                                                                                                               | Trip Setup 3  |
| Trip Setup  | Buffer Time (optional)                              | I set a **buffer time** (e.g., more walking/photos); app expands dwell/transition times accordingly.                                                                                                                           | Trip Setup 3  |
| Preferences | Interests & Priority                                | I pick from Art, culture, history, museum, Nature, Entertainment, shooping, sports, adventure, relaxing, food, nighlife, Instagram, hidden viewpoints, etc., **drag to rank**, add **custom**; priorities are sent to the LLM. | Preferences 1 |
| Preferences | Budget                                              | Money to spend on attractions - free, low, normal, luxury                                                                                                                                                                      | Preferences 2 |
| Preferences | Restaurants                                         | I set restaurant filters (local, vegan, vegetarian, only chicken, no pork, no beef, everything); app schedules 1–2 meal breaks/day.                                                                                            | Preferences 3 |
| Generation  | Plan Compose                                        | App composes day plan respecting hours, weather, clustering, golden hour; returns in one view with **Now/Next** timeline.                                                                                                      | Plan          |
| Map & Pins  | Route Visualization                                 | **You-are-here** dot; segments colored by mode; pins show order.                                                                                                                                                               | Map           |
| Map & Pins  | Popup Content                                       | Popup shows name, category, **one-line fit to prefs**, arrival & dwell + buffer, **Significance (1 line)**, **citations**, official link.                                                                                      | Map           |
| Narration   | TTS                                                 | Button generates **60–90s** narration; plays **in-app**; transcript snippet visible; respects system audio focus.                                                                                                              | Popup         |
| Review      | Looks good / Missing                                | Bottom bar prompts **Looks good** or **Something missing**; missing opens text input field; submission triggers **New plan**.                                                                                                  | Plan          |
| Adaptation  | Reconfigure                                         | Uses current time/location; adjusts ordering/removes low-priority to keep core intent; returns within target latency (see Model req).                                                                                          | Plan          |
| Adaptation  | New Plan                                            | Optional new preferences; otherwise fresh plan with same constraints.                                                                                                                                                          | Plan          |
| Navigation  | Maps                                                | Integrated interactive map into app, option to open in google maps                                                                                                                                                             | Map           |
| Accounts    | Guest Only                                          | No sign-in in v1; show a non-functional “Create profile” toggle (for future), but **store locally only**.                                                                                                                      | Settings      |
| Feedback    | End-of-day                                          | Quick sliders (route quality, discovery, timing) update on-device prefs.                                                                                                                                                       | Wrap-up       |

## 📐 Model Requirements

| SPECIFICATION  | REQUIREMENT                                                                       | RATIONALE                                                     |
| -------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Open           | (GPT-5 Thinking) via API                                                          | Best planning/reasoning quality for itinerary synthesis       |
| Context Window | Maxium                                                                            | Fit city facts, hours snippets, constraints, and JSON schemas |
| Modalities     | **Text + Tool Calls**                                                             | Use tools for Places, routing, weather, and web search        |
| Latency        | **Plan gen:** P50 ≤10s / P95 ≤20s; **Reconfigure:** P50 ≤3s / P95 ≤5s             | Keep UX snappy during on-day changes                          |
| Parameters     | **Determinism high** (low temperature) for facts; slightly higher for POI variety | Balance accuracy and discovery                                |

## 🧮 Data Requirements

- **No server-side account data in v1**; store trip and preferences **on-device** (guest mode).

- **Inputs captured:** city, dates, accommodation, transport, buffer time, ranked interests, restaurant filters, must-see/avoid list.

- **Live facts via tools:** Google Places (POIs, hours), weather API, transit/traffic as available; lightweight general web search for descriptions.

- **Citations required** in popups (source + timestamp).

- **Retention:** plan data persists on device until user deletes; no cloud sync in v1.

- **Telemetry (minimal):** anonymized performance metrics (latency, errors) if allowed; no precise location stored post-session. *(Assumption)*

## 💬 Prompt Requirements

- **Policy & refusals:** Never fabricate hours/closures; if uncertain → show **N/A** and official link.

- **Personalization:** Honor ranked interests and restaurant filters; avoid disallowed cuisines per user.

- **Output contract:** LLM returns **strict JSON** for plans (eg schema includes stop id, name, lat/lon, category, arrival, dwell, buffer, significance, sources[], priority).

- **Tone:** Plain, friendly, concise; narration script ≤90s before TTS.

- **Accuracy target:** ≥95% of displayed hours must match cited source or be marked N/A.

## 🧪 Testing & Measurement

- **Functional tests:** JSON schema validation; tool-call fallbacks when APIs fail; deterministic reconfigure tests with synthetic delays.

- **Guardrails:** Automated check that any displayed hour has a citation or N/A; reject plan otherwise.

- **Rollback:** If tool outages detected, disable narration and reconfigure gracefully; keep static plan.

## ⚠️ Risks & Mitigations

| RISK                            | MITIGATION                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Poor recommendations            | Rank by user priorities; diversify with clustering; allow quick feedback → regenerate |
| Inaccurate hours/weather        | Strict citations; N/A when uncertain; timestamped source badges; weather rechecks     |
| Latency spikes                  | Cache geocodes; parallelize tool calls; degrade narration first                       |
| Battery drain / GPS             | Throttle location updates; foreground-only tracking; toggle high-accuracy             |
| API limits / quotas             | Monitor quotas; backoff & retry                                                       |
| Hallucinated facts in narration | Narration limited to cited facts; include source list per script                      |

## 💰 Costs

- **Development:** LLM integration, map UI, narration pipeline, plan JSON schema, reconfigure logic, QA.

- **Operational:**
  
  - LLM tokens for **generation + reconfigure**.
  
  - **Google Maps/Places** usage (geocoding, details, routes).
  
  - **TTS** minutes for narration.
  
  - Weather/transit API calls.

- **Monitoring:** Logging, crash analytics.

## 🔗 Assumptions & Dependencies

- **Assumptions:** Internet required; no sign-in; English only; 1–2 meal breaks/day unless user sets otherwise; telemetry minimal.

- **Dependencies:** GPT-5 Thinking API; Google Maps/Places; Weather API; Google TTS; optional general web search tool.

## 🔒 Compliance/Privacy/Legal

- **Data access:** Users can delete trips/preferences from settings.

- **Content:** Cite sources; avoid copyrighted long-form content in narration.

Love the name—**InTown** feels crisp and modern. Here’s a clean, accessible color system (light + dark) that matches the style in your screenshot while staying legible on maps.

# InTown Color System (v1)

### Brand palette (use across UI)

- **Primary – InTown Blue:** `#2563EB`

- **Accent – Jade:** `#10B981`

- **Highlight – Iris:** `#7C3AED` (sparingly, for special moments)

- **Neutrals (Slate):** `#F8FAFC`, `#FFFFFF`, `#E2E8F0`, `#94A3B8`, `#0F172A`

- **Semantic:** Success `#22C55E`, Warning `#F59E0B`, Error `#EF4444`

---

## Light mode tokens

- **Background:** `#F8FAFC`

- **Surface / Card:** `#FFFFFF`

- **Primary text:** `#0F172A`

- **Secondary text:** `#475569`

- **Border / Dividers:** `#E2E8F0`

- **Primary (buttons/CTA):** `#2563EB`
  
  - Pressed: `#1E40AF`
  
  - On-primary text/icons: `#FFFFFF`

- **Accent (chips/active states):** `#10B981`
  
  - Pressed: `#047857`
  
  - On-accent: `#06221A`

- **Disabled:** Text `#94A3B8` @ 60% opacity; Surfaces `#E2E8F0`

## Dark mode tokens

- **Background:** `#0B1220`

- **Surface / Card:** `#111827`

- **Primary text:** `#F8FAFC`

- **Secondary text:** `#94A3B8`

- **Border / Dividers:** `#1F2937`

- **Primary (buttons/CTA):** `#60A5FA`
  
  - Pressed: `#3B82F6`
  
  - On-primary: `#0B1220`

- **Accent (chips/active states):** `#34D399`
  
  - Pressed: `#10B981`
  
  - On-accent: `#052018`

- **Disabled:** Text `#94A3B8` @ 40% opacity; Surfaces `#0F172A`

> Accessibility: all primary/secondary text and CTAs above hit **WCAG AA** on their backgrounds. Use 14–16pt + medium weight on colored chips for guaranteed contrast.

---

## Map & route colors (consistent in both modes)

Use color **+ pattern** for color-blind safety.

**Segments**

- **Walking:** `#22C55E` (solid line, **dashed** pattern)

- **Public transit:** `#3B82F6` (solid)

- **Driving (rental car):** `#F59E0B` (solid, slightly thicker)

- **Alternative (bike/ferry, optional):** Bike `#84CC16`, Ferry `#06B6D4`

**Pins (category color → icon shape)**

- **Instagram/photo spots:** `#D946EF` (camera/star icon)

- **Hidden viewpoints:** `#06B6D4` (binoculars)

- **Art:** `#F97316` (palette)

- **History:** `#6366F1` (column/landmark)

- **Museum:** `#3B82F6` (museum icon)

- **Food stop (from preferences):** `#10B981` (cutlery)

**States**

- **Selected pin ring:** `#2563EB` with inner white ring (light) / `#111827` (dark)

- **Closed/Unavailable:** fill `#94A3B8`, strike-through label

- **Must-see:** add small **gold badge** `#F59E0B` to any pin

**Overlays**

- Route opacity 85% (active), 45% (future steps).

- Heat/cluster dots for popular zones: Iris `#7C3AED` @ 24% alpha.

---

## Bottom bar & controls

- **Bottom bar (light):** Frosted white `#FFFFFF` @ 92% with blur; icons `#475569` (active `#2563EB`).

- **Bottom bar (dark):** `#111827` @ 96% with subtle elevation; icons `#94A3B8` (active `#60A5FA`).

- **Primary actions:** “Looks good” uses **InTown Blue**; “Something missing” is outline with **InTown Blue** text.

- **Reconfigure / New plan**: filled primary / outline accent, respectively.

---

## Narration & info popups

- **Popup surface (light/dark):** same as Card tokens.

- **Title:** primary text; **one-line fit** badge uses Accent Jade.

- **Citations:** small chips using neutral `#E2E8F0` (light) or `#1F2937` (dark) with text `#475569` / `#CBD5E1`.

- **Narration button:** Iris `#7C3AED` (play) → to active Jade `#10B981` when playing.

---

## Brand & app identity (InTown)

- **Wordmark:** InTown (capital T), geometric sans (Inter or Google Sans).

- **Icon:** Rounded square, **pin + path** mark with a diagonal gradient **InTown Blue → Jade**; inner path dot in **Iris**.

- **Splash:** Neutral background with oversized gradient pin, subtle map grid at 8% opacity.

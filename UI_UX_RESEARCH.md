# InTown — UI/UX & Color-Science Research Dossier

> **Purpose.** This is a **research handoff + resume document**. It captures *everything* the deep-research pass found before it hit an API rate limit, maps every finding to its source, gives concrete design/palette recommendations for InTown, and — critically — **documents the exact research actions that were planned but not yet executed** so the next deep-research session can resume from this precise point instead of re-doing the groundwork.
> **Date:** 2026-07-04.
> **Companion documents:** `FINAL_PRD.md` (§17 Design system is the current source of truth this dossier evaluates), `LEARNINGS.md`.
> **Scope of the question:** Evidence-based, science-first UI best practices, color palette, and low-friction/high-personalization engagement (without dark patterns) for InTown — a map-first, offline-first, multi-user AI trip companion (PWA now, Android native later; European traveler audience).

---

## 0. Status of the research — READ FIRST

The research ran as a fan-out pipeline (scope → search → fetch → extract → **verify** → synthesize) plus five supplementary academic agents. Here is exactly what completed and what did not:

| Stage | Status | Notes |
|---|---|---|
| **Scope** (decompose into search angles) | ✅ done | 5 angles across UI, color, engagement, platform, case studies |
| **Search** (parallel web searches) | ✅ done | 5 angle-searches returned source lists |
| **Fetch + extract** (read sources, pull falsifiable claims) | ✅ done | **31 unique sources fetched; 103 atomic claims extracted with inline citations** (author/year/venue/quantified result) |
| **Adversarial verification** (3-vote refute panel per claim) | ❌ **NOT DONE** | All 25 verifier panels that started **failed on the Fable 5 rate limit** — an infrastructure failure, *not* a research refutation. The 25 claims in the queue are **extracted but not yet adversarially verified.** |
| **5 supplementary academic agents** (tourism-app UX, color science, map/outdoor UX, waiting/AI-trust, engagement/habit/gamification) | ❌ **NOT DONE** | All five were **killed by the same rate limit** before returning. Their full task briefs are preserved verbatim in §7 so they can be relaunched exactly. |

**Integrity rule for this document:** every finding below is labelled with its verification state:
- **[EXTRACTED]** — pulled from a real, fetched source with an inline citation, but **not yet run through adversarial verification.** Treat as a strong lead, not a settled fact, until re-verified.
- **[BLOCKED-SOURCE]** — the claim's primary source could not be fetched directly (paywall / gateway block); the value was corroborated via a secondary route, which the extractor flagged. Needs primary-source confirmation.
- **[FOLKLORE-FLAG]** — the research itself surfaced that this is weaker or more contested than design practitioners usually assume. Carry the caveat into the PRD.

Nothing here was invented. Where a number could not be verified against a primary source, that is stated.

---

## 1. Executive summary — what the evidence supports so far

1. **The current InTown palette direction is scientifically defensible, with caveats.** A **saturated blue primary is the single best-supported hue choice** for a trust-oriented app: multiple peer-reviewed sources link blue to trust and quality, and blue/green to calm, low-arousal positive emotion. *But* the literature is explicit that **"blue = trust" is an oversimplification** — lightness and saturation matter as much as hue, and effects are contested and culturally graded. So the recommendation is "keep blue, but engineer it perceptually," not "blue guarantees trust." (§3.C, §4)
2. **Rebuild the palette in a perceptually uniform color space (OKLCH or Material HCT), not HSL/hex.** This is the strongest, most actionable UI finding: perceptual spaces let you *guarantee* contrast by construction (Material HCT: tone-difference ≥40 ⇒ WCAG 3:1; ≥50 ⇒ 4.5:1) and produce accent ramps (blue/jade/iris) that look equally light at equal L. Stripe and Material both did exactly this. (§3.D, §4)
3. **The map-first + bottom-sheet architecture in the PRD is directly endorsed by the evidence.** Thumb-reach ergonomics, Material 3's standard (non-modal) bottom-sheet spec, and Apple HIG's map rules all converge on the layout §17 already specifies. There are concrete tokens to adopt (28dp top radius, 48dp drag-handle target, keep the selected pin visible). (§3.A, §3.B, §3.H)
4. **The research-progress screen is a genuine asset, not a wait to hide.** Buell & Norton's labor illusion — tested *specifically in a travel-search context* — shows users can value a transparent, work-showing wait *more* than an instant result. The PRD's "reading 34 blogs…" streaming log is the right instinct. Caveat: the effect has boundary conditions; fake-looking waits backfire. (§3.F)
5. **Engagement should lean on achievement + social mechanics and endowed progress, and explicitly avoid punitive streaks.** Self-determination-theory evidence favors achievement/social gamification; the endowed-progress effect (pre-filled steps) lifts completion; and habit-formation science shows a *single missed day does not harm* habit formation — so Duolingo-style streak-punishment is *not* evidence-based and conflicts with the PRD's no-dark-patterns stance. (§3.G)
6. **Aesthetic polish has measured ROI.** The aesthetic-usability effect (perceived beauty → perceived usability) replicates cross-culturally with large correlations — the PRD's "highly polished" goal is not vanity, it changes perceived usability and error tolerance. (§3.G)

---

## 2. Source bibliography (31 sources actually fetched)

Grouped by theme. These are the verified-to-exist sources behind every finding in §3. IDs (S1…) are referenced throughout.

### One-handed use, touch targets, map & pedestrian UX
- **S1** — Bergstrom-Lehtovirta & Oulasvirta, *Modeling the Functional Area of the Thumb on Mobile Touchscreen Surfaces*, **CHI 2014**. https://dl.acm.org/doi/10.1145/2556288.2557354
- **S2** — Parhi, Karlson & Bederson, *Target Size Study for One-Handed Thumb Use on Small Touchscreen Devices*, **MobileHCI 2006**. https://dl.acm.org/doi/10.1145/1152215.1152260
- **S3** — Steven Hoober, *How Do Users Really Hold Mobile Devices?* / *How We Hold Our Gadgets* (field observation, 1,333 users; A List Apart / UXmatters, 2013–2015). https://alistapart.com/article/how-we-hold-our-gadgets/
- **S4** — *Evaluating Route Preview as an Alternative to Turn-by-Turn Navigation in Pedestrian Mobility*, **PLOS One**. https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0340711
- **S5** — Oulasvirta, Tamminen, Roto & Kuorelahti, *Interaction in 4-Second Bursts: The Fragmented Nature of Attentional Resources in Mobile HCI*, **CHI 2005**. https://www.interruptions.net/literature/Oulasvirta-CHI05-p919-oulasvirta.pdf
- **S6** — *Adapting Mobile Map Application Designs to Map Use Context: A Review and Call for Action*, **Cartography and Geographic Information Science, 2022**. https://www.tandfonline.com/doi/full/10.1080/15230406.2021.2015720

### Color science — emotion, trust, arousal
- **S7** — Jonauskaite et al., *Universal Patterns in Color-Emotion Associations Are Further Shaped by Linguistic and Geographic Proximity*, **Psychological Science, 2020** (4,598 participants, 30 nations). https://journals.sagepub.com/doi/10.1177/0956797620948810
- **S8** — Jonauskaite & Mohr, *Do we feel colours? A systematic review of 128 years of psychological research linking colours and emotions*, **Psychonomic Bulletin & Review, 2024** (132 articles, 42,266 participants, 64 countries). https://link.springer.com/article/10.3758/s13423-024-02615-z
- **S9** — Wilms & Oberfeld, *Color and emotion: effects of hue, saturation, and brightness*, **Psychological Research, 2018** (N=62, factorial + skin-conductance/HR). https://pubmed.ncbi.nlm.nih.gov/28612080/ · full text PDF: https://www.staff.uni-mainz.de/oberfeld/downloads/Wilms-Oberfeld2018_Article_ColorAndEmotionEffectsOfHueSat.pdf
- **S10** — Elliot, *Color and psychological functioning: a review of theoretical and empirical work*, **Frontiers in Psychology, 2015** (color-in-context theory; maturity caveats). https://pmc.ncbi.nlm.nih.gov/articles/PMC4383146/
- **S11** — *Colours of Emotion, Trust, and Exclusivity: A Cross-Cultural Study*, **Color Culture and Science Journal** (1,218 participants; Dutch/French/Greek/Russian). https://jcolore.gruppodelcolore.it/ojs/index.php/CCSJ/article/view/290
- **S12** — Su, Cui & Walsh, *Trustworthy Blue or Untrustworthy Red: The Influence of Colors on Trust*, **Journal of Marketing Theory and Practice 27(3), 2019** (blue > red for trust, implicit + explicit measures). https://www.researchgate.net/publication/334550253_Trustworthy_Blue_or_Untrustworthy_Red_The_Influence_of_Colors_on_Trust

### Perceptual color spaces, contrast, color-blindness
- **S13** — *The science of color & design*, **Material Design 3** (HCT color space; tone→contrast guarantees). https://m3.material.io/blog/science-of-color-design
- **S14** — Stripe Engineering, *Designing accessible color systems* (CIELAB rebuild; scale-distance contrast guarantees). https://stripe.com/blog/accessible-color-systems
- **S15** — Sitnik & Turner (Evil Martians), *OKLCH in CSS: why we moved from RGB and HSL*. https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
- **S16** — *OKLCH in CSS: consistent, accessible color palettes*, LogRocket. https://blog.logrocket.com/oklch-css-consistent-accessible-color-palettes
- **S17** — Andrew Somers (Myndex), *The Easy Intro to the APCA Contrast Method* (WCAG 3 candidate; Lc thresholds; WCAG 2 dark-mode critique). https://git.apcacontrast.com/documentation/APCAeasyIntro.html
- **S18** — Wong, B., *Points of view: Color blindness*, **Nature Methods 8:441, 2011** (Okabe–Ito CVD-safe palette). https://www.nature.com/articles/nmeth.1618

### Waiting, engagement, habit, gamification
- **S19** — Buell & Norton, *The Labor Illusion: How Operational Transparency Increases Perceived Value*, **Management Science 57(9), 2011** (5 experiments; travel + dating contexts). https://pubsonline.informs.org/doi/10.1287/mnsc.1110.1376
- **S20** — Nunes & Drèze, *The Endowed Progress Effect*, **Journal of Consumer Research 32(4), 2006** (car-wash field study; 34% vs 19%). https://academic.oup.com/jcr/article-abstract/32/4/504/1787425
- **S21** — Tractinsky, *Aesthetics and Apparent Usability: Empirically Assessing Cultural and Methodological Issues*, **CHI 1997** (replication of Kurosu & Kashimura 1995). https://www.semanticscholar.org/paper/536a5136eaf69bea96ba015d0a36b327c16909af
- **S22** — Lally et al., *How are habits formed: Modelling habit formation in the real world*, **European Journal of Social Psychology, 2010** (median 66 days, range 18–254). https://onlinelibrary.wiley.com/doi/abs/10.1002/ejsp.674
- **S23** — Xi & Hamari, *Does gamification satisfy needs? … Gamification features and intrinsic need satisfaction*, **International Journal of Information Management, 2019** (SDT; N=824). https://www.sciencedirect.com/science/article/abs/pii/S0268401218307436
- **S24** — NN/g, *The Peak-End Rule: How Impressions Become Memories*. https://www.nngroup.com/articles/peak-end-rule/

### Platform / PWA / practitioner design guidance
- **S25** — *Bottom sheets*, **Material Design 3** guidelines. https://m3.material.io/components/bottom-sheets/guidelines
- **S26** — NN/g, *Bottom Sheets: Definition and UX Guidelines*. https://www.nngroup.com/articles/bottom-sheet/
- **S27** — *Maps*, **Apple Human Interface Guidelines**. https://developer.apple.com/design/human-interface-guidelines/maps
- **S28** — *Make your PWA feel more like an app*, **web.dev (Google)**. https://web.dev/app-like-pwas/index.html
- **S29** — Baymard Institute, *Travel Site UX: Best Practices*. https://baymard.com/blog/travel-site-ux-best-practices
- **S30** — *How Airbnb Designs Their UI: A Design System Breakdown (2026)*, Superdesign. https://superdesign.dev/blog/airbnb-design-system

> **Note on source tiers.** S1–S24 are peer-reviewed papers or first-party engineering/standards documents (the priority the brief demanded). S25–S28 are official platform guidelines. S29–S30 are practitioner teardowns included only for competitive/pattern context, weighted lowest.

---

## 3. Findings by theme (all [EXTRACTED] unless flagged)

### 3.A — One-handed use, thumb reach & touch targets

- **Thumbs drive ~75% of phone interaction; ~one-third of the screen is comfortably thumb-reachable, and that zone is the *bottom* of the screen.** Hoober's field observation of 1,333 users: 49% one-handed, 36% cradled, 15% two-handed. *[EXTRACTED — S3; observational, not peer-reviewed]*
- **Thumb reach is a curved arc, not a fixed zone** — it varies with device size, hand size, and back-of-device grip; bottom and bottom-edge regions near the gripping hand are most reliably reachable. Peer-reviewed kinematic model, validated on 20 participants (small-N). *[EXTRACTED — S1, CHI 2014]*
- **Minimum touch targets:** ≥9.2 mm for discrete taps, ≥9.6 mm for serial taps; error rate plateaus above ~9.6 mm (larger buys speed, not accuracy). Corroborates (as a lower bound) Material's 48dp and Apple's 44pt. *[EXTRACTED — S2; caveat: 2006 resistive PDA, 20 right-handed users standing still — predates capacitive phones and walking use]*
- **Comfort is highest at screen center (5.7/7), lowest in NW/SW corners (3.7/7).** Place primary controls central/bottom; put rare or destructive actions top. Right-handed thumb taps land slightly right of target on the rightmost column → edge controls should sit flush to the edge. *[EXTRACTED — S2]*
- **Design implication for InTown:** bottom sheet, its drag handle, the primary CTA, and map controls all belong in the bottom/central thumb zone — exactly the §17 layout. Companion-mode quick actions (running late, hungry, closed, go-to-#1) must be bottom-anchored and ≥48dp.

### 3.B — Map-first UI, bottom sheets, pedestrian navigation

- **Route *preview* (map overview) is a mainstream preference, not a fallback:** in a survey (n=222), 44% preferred simple route-preview over full turn-by-turn, rising to **76% in familiar environments**; in a performance study (n=195), route-preview showed **no significant disadvantage** vs turn-by-turn on errors, phone glances, or spatial learning. Directly supports InTown's "overview + Google Maps for turn-by-turn" delegation. *[EXTRACTED — S4, PLOS One]*
- **Turn-by-turn is a car-navigation paradigm ill-matched to pedestrians;** co-design work prioritized **landmark integration, intention-based routing, and subtle orientation cues** for walking UIs. Feeds InTown's scenic-leg annotations and landmark-based guidance. *[EXTRACTED — S4]*
- **Attention on the move comes in ~4-second bursts** — mobile users glance, act, and look up repeatedly; continuous attention is rare outdoors. Companion mode must be *glanceable*: one primary card, large type, minimal reading per glance. *[EXTRACTED — S5, CHI 2005]*
- **Material 3 standard (non-modal) bottom sheet** co-exists with the map and allows simultaneous interaction with both — the recommended pattern when the main region is panned/scrolled. Modal sheets (scrim, block background, dismiss by tap-outside/drag-down) are for quick actions/filters only. *[EXTRACTED — S25]*
- **Concrete M3 bottom-sheet tokens:** container `surfaceContainerLow`; **28dp top corner radius** (extra-large); 1dp elevation; max width **640dp** on large screens; half-expanded ratio **0.5**; drag-settle velocity threshold **500 px/s**; **48dp minimum drag-handle touch target** responsive to TalkBack/Voice/Switch Access with tap-to-cycle and double-tap-to-hide; peek state must be tall enough to signal more content. *[EXTRACTED — S25]*
- **Apple HIG map rules (adopt directly):** keep the map interactive; **never fully obscure it**; use a **desaturated/muted basemap** when overlaying information-rich content so content stands out; **cluster overlapping POIs** and expand on zoom; ensure control-over-map contrast via thin stroke / light drop shadow / blend modes; **keep the selected location visible** when a detail sheet is open (offset the sheet or point to the pin). *[EXTRACTED — S27]*
- **NN/g bottom-sheet guidance** corroborates the three-detent, grabber-affordance, non-modal pattern for map contexts. *[EXTRACTED — S26]*

### 3.C — Color and emotion / trust (the "why blue" evidence)

- **Blue increases trust more than red**, shown with *both* implicit and explicit measures (so not just a reported stereotype). Peer-reviewed, though context is brand/logo trust, not app chrome — generalization to UI is an inference. *[EXTRACTED — S12, JMTP 2019; BLOCKED-SOURCE: effect/sample sizes not retrievable from full text]*
- **Blue on stores/logos raises perceived quality and trustworthiness** (Elliot 2015 review, citing Labrecque & Milne 2012). *[EXTRACTED — S10]*
- **Blue is associated with trust across all four European groups** (Dutch/French/Greek/Russian; n=1,218); associations are **largely universal, varying mainly in strength/shade** — but Russians notably tied *pure yellow* to emotion, a caveat that accent colors don't read identically across markets. *[EXTRACTED — S11]*
- **Blue, green, green-blue and white → positive, low-arousal emotions** (calm, relaxation, contentment). Supports blue primary + jade accent for a calm, welcoming feel. *[EXTRACTED — S8, systematic review]*
- **Arousal rises blue→green→red; blue is the calmest hue and had the highest *valence* (pleasantness) — but only when highly saturated.** Saturated + bright colors raise *both* pleasantness and arousal (confirmed physiologically via skin conductance and heart-rate). So a **saturated** blue is the most-pleasant choice; muted blue loses the advantage. *[EXTRACTED — S9, Wilms & Oberfeld 2018]*
- **Color-emotion associations are ~universal (cross-national similarity r=.88, 30 nations) but culturally graded** — a classifier can predict nationality from association patterns, and closer nations agree more. A Europe-tuned palette generalizes best within Europe. *[EXTRACTED — S7, Psychological Science 2020]*
- **Lightness carries valence largely independent of hue** — light colors read positive, dark negative. The tint/shade of surfaces shifts felt tone, not just the brand hue. *[EXTRACTED — S8]*
- **CRITICAL CAVEAT — "one hue = one emotion" is folklore.** Correspondences are many-to-many, driven by lightness + saturation + hue together. Elliot explicitly warns the color-psychology literature is **immature**, often under-controlled for lightness/chroma and underpowered, and that strong "color X causes emotion Y" design claims **exceed the evidence**. The red-impairs-cognition finding is **contested** (2020 meta-analysis found only limited support). *[FOLKLORE-FLAG — S8, S9, S10]*

### 3.D — Perceptual color spaces & contrast engineering (highest-leverage UI finding)

- **HSL/hex are unsafe for palette generation:** HSL lightness is hue-dependent (a "lightness 50" can span measured tones ~33–96), silently producing bad contrast; HSL/RGB/hex also can't express wide-gamut Display-P3. *[EXTRACTED — S15]*
- **OKLCH's L = perceived lightness, consistent across hues** → equal-L accent ramps (blue/jade/iris) look equally light; hue can change while L/C hold, giving predictable contrast and letting you **generate the whole palette from a formula + seed colors**. Caveats: young tooling, and high-chroma L/C/H combos can be out-of-gamut (must gamut-check for sRGB). *[EXTRACTED — S15, S16]*
- **Material HCT gives contrast guarantees by construction:** built from CAM16 hue/chroma + CIELAB L* as tone; **tone-difference ≥40 ⇒ WCAG ≥3.0; ≥50 ⇒ ≥4.5.** M3 generates full accessible light+dark schemes algorithmically from a seed. It also ships a "universally disliked colors" detector (dark yellow-greens) — relevant when tuning the jade range. *[EXTRACTED — S13]*
- **Stripe's CIELAB rebuild** encodes contrast in scale distance: colors ≥5 levels apart pass small-text (4.5:1), ≥4 levels pass large-text/icon (3:1). A directly reusable token pattern. *[EXTRACTED — S14]*
- **WCAG 2.x contrast math is non-uniform and overstates contrast near black** — a "passing" 4.5:1 pair can be unreadable in dark mode. APCA (WCAG 3 candidate) gives polarity-aware, perceptually-uniform Lc thresholds: **Lc 90 preferred body text, Lc 75 min for body columns, Lc 60 min non-body, Lc 45 min headlines, Lc 30 min placeholder/disabled, Lc 15 min for any discernible element.** APCA is **not yet a finalized standard** — use as a supplementary check, keep WCAG 2.2 AA as the legal target. *[EXTRACTED — S17; FOLKLORE-FLAG: the "86% of sites fail WCAG 2" figure is stated without inline citation]*
- **Implication for InTown dark mode:** validate `#0F172A`/`#0B1220` surfaces with **both** WCAG 2.2 and APCA, because WCAG-2-only checks are unreliable near black.

### 3.E — Color-vision deficiency (CVD)

- **CVD does not reduce text readability** (readability = luminance/lightness contrast, not hue) **but it does impair map/dataviz hue discrimination.** A map-first app must **encode meaning with lightness contrast + shape/pattern, never hue alone.** This is the scientific backing for §17's "color + pattern" route encoding and category pins. *[EXTRACTED — S17]*
- **Use a CVD-safe qualitative palette** (Okabe–Ito is the canonical, deuteranopia/protanopia-safe 8-color set) for any categorical encoding (route modes, pin categories). *[EXTRACTED — S18, Nature Methods 2011]*

### 3.F — Waiting psychology & the research-progress screen

- **The labor illusion:** when a service *shows it is working*, users can prefer a longer wait over instant results and **value the outcome more**, even when results are identical. Tested in **5 experiments including a travel-search context** (live list of airlines being searched vs a plain progress bar). Mechanism: shown effort → perceived effort → reciprocity → higher valuation → so **show concrete work items** (sources being read), not just a timer. *[EXTRACTED — S19, Management Science 2011]*
- **Boundary conditions exist** — the paper explicitly studies them; **fake or arbitrary-looking waits can backfire.** The often-quoted "~8%" lift and exact 0–60s durations are practitioner retellings **not verifiable against the paywalled full text.** *[FOLKLORE-FLAG / BLOCKED-SOURCE — S19]*
- **Implication for InTown:** the PRD's streaming research log ("reading 34 blogs and 22 videos…, verifying hours…, scoring 61 candidates…") is the correct, evidence-backed design — but the shown work must be *real* (echo the user's actual interests/city), and skeleton cards should populate with genuine partial results.

### 3.G — Engagement, aesthetics, habit, gamification (ethical levers)

- **Endowed progress effect:** artificial unearned progress toward a goal raises persistence and completion. Field study: a 10-slot loyalty card with **2 slots pre-stamped** (same 8 purchases required) got **34% redemption vs 19%** for a plain 8-slot card, and faster completion. Works via *feeling the task is underway*, and is stronger **when a plausible reason for the head-start is given.** *[EXTRACTED — S20; BLOCKED-SOURCE: figures corroborated via reproductions, publisher full text unreachable]*
  - **Apply to InTown:** the onboarding quiz/progress bar should show the task as *already begun* with a real justification — e.g., "City selected ✓ — 1 of 6 done," never an arbitrary fake head-start.
- **Aesthetic-usability effect:** perceived beauty strongly predicts perceived usability *before* use. Cross-cultural replication found **r≈.92 (Israel) vs r≈.59 (original Japanese study)** — a large effect that runs even opposite the predicted direction cross-culturally. Justifies InTown's "highly polished" investment as functional, not cosmetic. *[EXTRACTED — S21; BLOCKED-SOURCE: exact r-values via secondary snippets, paper full text blocked]*
- **Habit formation is slow and forgiving:** automaticity plateau reached in **18–254 days (median 66)**; early repetitions matter most; and **missing a single day did *not* harm the habit trajectory.** → Anchor use to **stable contextual cues** (e.g., an evening "plan tomorrow" moment, an arrival-in-city trigger), invest in early-experience quality, and **do not build punitive streak mechanics** — one-missed-day punishment is unsupported by the evidence and conflicts with the no-dark-patterns stance. *[EXTRACTED — S22; caveat: model fit only 39/82 participants, so "66 days" is indicative]*
- **Gamification via self-determination theory:** *achievement* features (points/badges/levels/challenges) were the **strongest predictor of autonomy + competence** satisfaction; *social* features (shared/group) satisfied **all three needs** (autonomy, competence, relatedness); *immersion* features (avatars/narrative) satisfied **only autonomy**. → Prioritize **achievement + social** mechanics (InTown's territory-opening, roles, group curation are well-chosen); theming alone is weak. *[EXTRACTED — S23; caveat: N=824 Chinese brand-community users, cross-cultural/domain generalization]*
- **Peak-end rule:** memory of an experience is dominated by its **peak** and its **end**, not its average or duration. → Engineer a deliberate high point (the "your itinerary is ready" reveal; a territory-opening celebration) and a strong ending to each session/trip (a satisfying day-wrap, a trip-memories moment). *[EXTRACTED — S24, NN/g summary of Kahneman et al.]*
- **Travel-site UX (practitioner):** Baymard patterns for travel flows; Airbnb's design-system discipline (tokenization, spacing scale, restrained color). Context only, lowest weight. *[EXTRACTED — S29, S30]*

### 3.H — PWA "feel native" & platform guidance

- **App-shell model:** a native-feeling PWA **never shows an empty offline state** — cache the shell/icons/core screens locally so the app always opens, with cached fallbacks for dynamic content. Matches InTown's offline-first requirement. *[EXTRACTED — S28]*
- **Three concrete "feel native" CSS techniques:** `user-select: none` on chrome only (never content); `font-family: system-ui` to adopt the OS font; honor `prefers-color-scheme` with an optional in-app override; `overscroll-behavior` for custom pull-to-refresh; set manifest `display` + `theme-color`. *[EXTRACTED — S28]*
- **Persistent Storage API** protects offline trip data/tiles from eviction under storage pressure (on top of Cache/IndexedDB). *[EXTRACTED — S28]*
- **Distribution reality:** iOS does not allow PWAs in the App Store; Android PWAs can ship via Play Store as a Trusted Web Activity (bubblewrap/PWABuilder) — matches the PWA-now/Android-later roadmap. *[EXTRACTED — S28]*
- **Motion:** CSS Scroll Snap for paginated/carousel content, Web Animations API for programmatic control. Practitioner guidance, no effect sizes. *[EXTRACTED — S28]*

---

## 4. Applied recommendation — InTown palette & tokens (evidence-based)

**Verdict on the current §17 palette:** the *direction* is right (saturated blue primary, jade accent, slate neutrals, semantic set). Two evidence-driven upgrades are warranted:

1. **Re-derive every token in OKLCH or HCT** so contrast is guaranteed by construction and accent ramps are perceptually even. Keep the current hex values as *seeds*, but generate the 50–900 ramps by fixed tone/L steps (HCT tone-step ≥50 between text and background guarantees AA). *(S13, S14, S15)*
2. **Keep the brand blue saturated** (the valence advantage is saturation-dependent) and **avoid dark yellow-greens** in the jade range (universally-disliked zone). *(S9, S13)*

**Concrete rules to write into the PRD design system:**
- Primary = saturated blue (current `#2563EB` is a good seed; validate its OKLCH L and chroma, ensure on-white and on-dark pass AA + APCA Lc≥75 for body). *(S9, S12, S17)*
- Accent = jade/green for calm-positive affordances (`#10B981` seed), **not** in the dark yellow-green disliked band. *(S8, S13)*
- Iris/violet (`#7C3AED`) sparingly — no strong trust/calm evidence; treat as a tertiary highlight only.
- **Route modes & category pins: color + pattern/shape, from a CVD-safe set** (Okabe–Ito-style). Never rely on hue alone. *(S17, S18)*
- **Dark mode:** validate `#0B1220`/`#0F172A` surfaces with **both WCAG 2.2 AA and APCA** (WCAG-2 alone is unreliable near black). *(S17)*
- **Muted/desaturated basemap** under the plan/curation overlay so cards and pins pop. *(S27)*
- Contrast targets: WCAG 2.2 AA as the legal floor (4.5:1 body, 3:1 large/icon) **and** APCA Lc 75+ for body text as the perceptual check. *(S14, S17)*

**Per-surface do/don't (from §3):**
- **Onboarding quiz:** endowed progress ("City selected ✓ — 1 of 6") with a real reason; one question per screen; progress bar; each answer visibly changes output. *(S20)*
- **Research-progress screen:** show real work items streaming + skeleton cards + live pins; never a blank spinner; keep the shown labor genuine. *(S19)*
- **Curation list:** achievement/social cues; drag handles ≥48dp in thumb zone; disagreement made visible. *(S2, S23)*
- **Map + bottom sheet:** non-modal 3-detent sheet, 28dp radius, 48dp handle, keep selected pin visible, muted basemap, clustered pins. *(S25, S27)*
- **Companion mode:** glanceable single Now/Next card, large type, bottom-anchored quick actions (4-second-burst attention). *(S5, S3)*
- **Post-trip feedback:** exploit peak-end — a satisfying wrap and a celebration peak (territory opening); forgiving, non-punitive streaks. *(S22, S24)*

---

## 5. What was PLANNED but NOT executed — the resume backlog

This is the section to hand the next deep-research session. Two bodies of work were queued and killed by the rate limit.

### 5.1 — Adversarial verification queue (25 claims, 0 verified)

The verify stage was to run a **3-vote refute panel per claim (kill if ≥2/3 refute)**. It started on these 25 claims and **all panels errored out on the rate limit** — so none are confirmed *or* refuted. **Next session: re-run verification on these first** (they are the highest-value, already-extracted claims). The claims and their source URLs:

1–2. Touch-target minimums (9.2mm / 9.6mm; error-rate plateau F-stats) — S2 (dl.acm.org/doi/10.1145/1152215.1152260)
3–4. Route-preview preference (44%/76%; no perf disadvantage n=195) — S4 (PLOS One 10.1371/journal.pone.0340711)
5–6. Color-emotion universality (r=.88; nationality-predictable) — S7 (10.1177/0956797620948810)
7–9. Systematic-review color-emotion findings (blue/green calm; lightness valence; many-to-many) — S8 (10.3758/s13423-024-02615-z)
10–13. Wilms & Oberfeld hue/saturation/brightness arousal + physiology — S9 (pubmed 28612080)
14–16. Elliot review (color-in-context; immaturity caveat; methodological weakness) — S10 (PMC4383146)
17–18. Cross-cultural trust/emotion/exclusivity (blue=trust across 4 EU groups) — S11 (jcolore …/290)
19. Blue > red trust (implicit+explicit) — S12 (researchgate 334550253)
20–21. Material HCT (tone-diff ≥40⇒3.0, ≥50⇒4.5; algorithmic schemes) — S13 (m3 science-of-color-design)
22–24. APCA Lc thresholds; WCAG-2 near-black critique; CVD = luminance not hue — S17 (git.apcacontrast.com)
25. Endowed progress effect definition — S20 (oup jcr 32/4/504)

### 5.2 — Five supplementary academic agents (0 of 5 completed) — RELAUNCH THESE VERBATIM

Each was a dedicated academic-literature sweep on a sub-topic the generic fan-out under-covered. All were killed before returning. Relaunch each with the exact brief below.

**Agent 1 — Tourism-app academic UX literature.** Venues: Tourism Management, Annals of Tourism Research, Journal of Travel Research, Information Technology & Tourism, ENTER/IFITT, CHI trip-planning. Cover: (1) adoption/continued-use/satisfaction of trip-planning apps (TAM/UTAUT, effect sizes); (2) group trip planning & group recommender UX — perceived fairness, explanation of group recs, misery/least-misery preference (Masthoff); (3) on-trip/in-destination app use, context-aware recs, smart guides; (4) personalization: effect of visible "why this fits you" explanations on trust/acceptance (Tintarev & Masthoff); (5) tourist decision fatigue/choice overload in itinerary planning. *Status: partial — hit Springer block, was pivoting to Semantic Scholar API when killed.*

**Agent 2 — Color-science academic literature.** Cover: (1) Ou & Luo color-emotion model; Palmer & Schloss ecological valence theory (PNAS 2010); Jonauskaite/Mohr cross-cultural; Elliot & Maier color-in-context; (2) blue & trust/competence — Cyr et al. website color/trust across cultures, banking/brand studies, effect sizes + replication concerns; (3) Labrecque & Milne (2012) hue→brand-personality; (4) perceptually uniform spaces — CIELAB limits, OKLab/OKLCH (Ottosson), Material HCT rationale, APCA vs WCAG 2 math; (5) CVD prevalence stats + redundant-encoding research; (6) dark-mode legibility/halation/OLED/preference peer-reviewed sources. *Status: not started before kill.*

**Agent 3 — Mobile map UX & outdoor usability.** Cover: (1) mobile map interaction research (pan/zoom, POI selection, cartographic UX — AutoCarto/ICA/CHI); (2) bottom-sheet specs (M3, Apple detents, Google Maps 3-detent teardowns); (3) thumb-zone/one-handed (Hoober percentages, Fitts's law, MIT Touch Lab finger data, min target sizes); (4) outdoor/sunlight glare + walking attention fragmentation (Oulasvirta 4-second bursts); (5) glanceability & pedestrian navigation (turn-by-turn vs overview, landmark-based superiority); (6) mobile typography (min legible sizes, system stack, variable fonts, line-length, M3/Apple type scales). *Status: partial — got some findings (thumb, route-preview), hit curl block, was moving to WebFetch mirrors when killed.*

**Agent 4 — Waiting, AI trust, perceived performance.** Cover: (1) Buell & Norton labor illusion + follow-up operational-transparency work, exact effect sizes; (2) progress indicators — Harrison/Amento CHI (rewinding/accelerating bars), Myers 1985 percent-done, skeleton-screen empirical tests; (3) response-time thresholds — Miller 1968, Card/Newell, Nielsen 0.1/1/10s, **the real Doherty-threshold IBM evidence vs folklore**, Nah 2004 tolerable wait, latency→abandonment data; (4) trust in AI/recommenders — explanation effects (Tintarev & Masthoff, Kizilcec 2016 CHI), citation/source-display credibility effects; (5) uncertainty communication — does honesty about "approximate/unverified" raise or lower trust (Joslyn & LeClerc weather-forecast uncertainty); (6) optimistic-UI empirical grounding. *Status: partial — had a start, was fetching primary sources + next search batch when killed.*

**Agent 5 — Engagement, habit, gamification science.** Cover: (1) peak-end originals (Kahneman; Redelmeier & Kahneman 1996; Do/Rupert/Wolford 2008) + UX-ending applications; (2) goal-gradient & endowed progress (Hull 1932; Kivetz/Urminsky/Zheng 2006 café numbers); (3) aesthetic-usability (Kurosu & Kashimura 1995; Tractinsky 1997/2000; Lindgaard 2006 50ms; Moshagen & Thielsch VisAWI; halo effect); (4) onboarding friction — quantified field-cost/form-field data, Baymard checkout, A/B signup-step numbers, progressive disclosure, value-before-signup; (5) gamification meta-analyses (Hamari/Koivisto/Sarsa 2014; Koivisto & Hamari 2019; Sailer & Homner 2020 effect sizes; SDT; overjustification Deci 1971/Lepper 1973); (6) habit formation (Lally 2010; implementation intentions Gollwitzer; fresh-start effect Dai/Milkman/Riis 2014; streaks incl. Duolingo data + loss-aversion downsides); (7) dark-pattern taxonomies to AVOID (Gray 2018; Mathur 2019; Brignull; EU DSA Art. 25) for bright-pattern boundaries; (8) variable rewards (Skinner schedules; Eyal Hooked + academic critiques); (9) micro-celebration/delight empirical work. *Status: not started before kill.*

### 5.3 — Specific sources that were blocked and need a retry route

These were named/needed but could not be fetched from this environment (paywall or egress-proxy block). Next session should try Semantic Scholar API, institutional mirrors, or author PDFs:
- Buell & Norton 2011 full text (Management Science) — for exact effect size / durations. *(S19)*
- Su, Cui & Walsh 2019 full text (JMTP) — for sample/effect sizes. *(S12)*
- Nunes & Drèze 2006 full text (JCR) — publisher blocked; figures came from reproductions. *(S20)*
- Tractinsky 1997 full text — exact r-values came from secondary snippets. *(S21)*
- Springer/Elsevier articles generally blocked → use Semantic Scholar / PMC / author self-archives.
- Material 3 bottom-sheet guidelines page (m3.material.io) — proxy-blocked; content came from the mirrored Material Components Android docs. *(S25)*

---

## 6. Open questions to resolve in the next round

1. **Do cited/source-labeled AI answers measurably increase user trust?** (Directly relevant to InTown's citation-everywhere doctrine — Agent 4, topic 4.) Not yet answered.
2. **Does honest uncertainty labeling ("approximate — verify on arrival") raise or erode trust?** (Agent 4, topic 5.) Critical for the coordinate-integrity UX; not yet answered.
3. **Group-recommendation explanation & fairness perception** — which explanation style maximizes perceived fairness for InTown's shared curation? (Agent 1.) Not yet answered.
4. **Onboarding friction — quantified per-field completion costs** to justify the progressive-profiling schedule with hard numbers. (Agent 5.) The PRD cites ~3–5%/field; needs primary sourcing.
5. **Skeleton screens vs progress bars — empirical perceived-speed deltas.** (Agent 4.) The PRD asserts skeletons feel faster; find the study or flag as folklore.
6. **Typography specifics** — min legible size on-the-move, line length, variable-font performance on mid-range Android. (Agent 3.) Not yet covered.
7. **Doherty threshold provenance** — confirm what the 1982 IBM report actually measured vs the "400ms magic" folklore before citing it in the PRD. (Agent 4.)

---

## 7. How to resume (for the next session/agent)

1. **First**, re-run the §5.1 verification queue (25 claims) on a model/quota that isn't rate-limited — that converts the strongest [EXTRACTED] leads into confirmed findings cheaply.
2. **Then** relaunch the five §5.2 agent briefs verbatim (in parallel if quota allows) to fill the coverage gaps.
3. **Then** chase the §5.3 blocked sources via Semantic Scholar / PMC / author PDFs to attach exact effect sizes.
4. **Finally** fold confirmed findings into `FINAL_PRD.md §17` (design system) and §6.2/§6.5/§6.21 (onboarding, research UX, gamification), upgrading the palette to OKLCH/HCT-derived tokens per §4.

---

*End of dossier. This document is a snapshot of an incomplete research run — everything here is real and sourced, but the verification pass and five deep-dive agents in §5 remain outstanding. Do not treat [EXTRACTED] claims as settled until re-verified.*

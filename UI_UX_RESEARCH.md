# InTown — UI/UX & Color-Science Research Dossier

> **Purpose.** This is a **research handoff + resume document**. It captures *everything* the deep-research pass found before it hit an API rate limit, maps every finding to its source, gives concrete design/palette recommendations for InTown, and — critically — **documents the exact research actions that were planned but not yet executed** so the next deep-research session can resume from this precise point instead of re-doing the groundwork.
> **Date:** 2026-07-04. **Verification pass completed 2026-07-04 (second session)** — see §0 status, inline `[VERIFICATION 2026-07-04: …]` notes, and §8 for the full results (no claim refuted; several corrections; all §6 open questions answered).
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
| **Adversarial verification** (3-vote refute panel per claim) | ✅ **DONE (second session, 2026-07-04)** | All 25 queued claims re-verified by 4 adversarial fact-check agents. **Zero claims refuted.** Verdict mix: primary-source-confirmed where the source was reachable, secondary-triangulated (multiple concordant search-index reproductions) where publishers were proxy-blocked. ~15 corrections/precision fixes found — folded in as inline `[VERIFICATION 2026-07-04: …]` notes and summarized in §8.1. |
| **5 supplementary academic agents** (tourism-app UX, color science, map/outdoor UX, waiting/AI-trust, engagement/habit/gamification) | ✅ **LARGELY COVERED (second session)** | Instead of relaunching all 5 verbatim, 2 targeted agents answered every §6 open question (AI-citation trust, uncertainty labeling, skeleton screens, Doherty provenance, form-field friction, group-rec fairness, walking typography, dark mode, streaks). Results in §8.2–§8.3. Remaining genuinely-uncovered sub-topics listed in §8.5. |

**Integrity rule for this document:** every finding below is labelled with its verification state:
- **[EXTRACTED]** — pulled from a real, fetched source with an inline citation, but **not yet run through adversarial verification.** Treat as a strong lead, not a settled fact, until re-verified.
- **[BLOCKED-SOURCE]** — the claim's primary source could not be fetched directly (paywall / gateway block); the value was corroborated via a secondary route, which the extractor flagged. Needs primary-source confirmation.
- **[FOLKLORE-FLAG]** — the research itself surfaced that this is weaker or more contested than design practitioners usually assume. Carry the caveat into the PRD.

**Verification pass (second session, 2026-07-04):** every [EXTRACTED] claim in the §5.1 queue was adversarially re-checked. **No claim was refuted.** Where the check produced a correction, an inline **`[VERIFICATION 2026-07-04: …]`** note follows the claim; §8.1 has the full verdict table. Upgraded states used in §8:
- **VERIFIED-PRIMARY** — primary source (paper PDF, official docs, or canonical source code) fetched and numbers matched.
- **VERIFIED-SECONDARY** — primary host proxy-blocked; numbers triangulated across multiple independent, concordant reproductions of the primary text. Strong, but literal quotes unchecked.

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
- **S3** — Steven Hoober, *How Do Users Really Hold Mobile Devices?*, **UXmatters, Feb 2013** (field observation, 1,333 users) — https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php · synthesized in Josh Clark, *How We Hold Our Gadgets*, A List Apart 2015 (excerpt from *Designing for Touch*). https://alistapart.com/article/how-we-hold-our-gadgets/ *[VERIFICATION 2026-07-04: the dossier originally conflated these — the 1,333-user observation is Hoober/UXmatters 2013; the ALA article is by Josh Clark (2015), and the "~75% thumb" figure is Clark's synthesis of Hoober's data.]*
- **S4** — *Evaluating Route Preview as an Alternative to Turn-by-Turn Navigation in Pedestrian Mobility*, **PLOS One**. https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0340711
- **S5** — Oulasvirta, Tamminen, Roto & Kuorelahti, *Interaction in 4-Second Bursts: The Fragmented Nature of Attentional Resources in Mobile HCI*, **CHI 2005**. https://www.interruptions.net/literature/Oulasvirta-CHI05-p919-oulasvirta.pdf
- **S6** — *Adapting Mobile Map Application Designs to Map Use Context: A Review and Call for Action*, **Cartography and Geographic Information Science, 2022**. https://www.tandfonline.com/doi/full/10.1080/15230406.2021.2015720

### Color science — emotion, trust, arousal
- **S7** — Jonauskaite et al., *Universal Patterns in Color-Emotion Associations Are Further Shaped by Linguistic and Geographic Proximity*, **Psychological Science, 2020** (4,598 participants, 30 nations). https://journals.sagepub.com/doi/10.1177/0956797620948810
- **S8** — Jonauskaite & Mohr, *Do we feel colours? A systematic review of 128 years of psychological research linking colours and emotions*, **Psychonomic Bulletin & Review, 2025** (132 articles, 42,266 participants, 64 countries). https://link.springer.com/article/10.3758/s13423-024-02615-z *[VERIFICATION 2026-07-04: publication year is 2025 (online 2025-01-13, vol. 32), not 2024 — only the DOI string contains "2024".]*
- **S9** — Wilms & Oberfeld, *Color and emotion: effects of hue, saturation, and brightness*, **Psychological Research, 2018** (N=62, factorial + skin-conductance/HR). https://pubmed.ncbi.nlm.nih.gov/28612080/ · full text PDF: https://www.staff.uni-mainz.de/oberfeld/downloads/Wilms-Oberfeld2018_Article_ColorAndEmotionEffectsOfHueSat.pdf
- **S10** — Elliot, *Color and psychological functioning: a review of theoretical and empirical work*, **Frontiers in Psychology, 2015** (color-in-context theory; maturity caveats). https://pmc.ncbi.nlm.nih.gov/articles/PMC4383146/
- **S11** — Broeder, P., *Colours of Emotion, Trust, and Exclusivity: A Cross-Cultural Study*, **Color Culture and Science Journal 14(2), 2022, 14–21** (1,218 participants; Dutch/French/Greek/Russian). https://jcolore.gruppodelcolore.it/ojs/index.php/CCSJ/article/view/290 *[VERIFICATION 2026-07-04: author/year added — Broeder 2022, Tilburg University.]*
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

- **Thumbs drive ~75% of phone interaction; ~one-third of the screen is comfortably thumb-reachable, and that zone is the *bottom* of the screen.** Hoober's field observation of 1,333 users: 49% one-handed, 36% cradled, 15% two-handed. *[VERIFIED-SECONDARY — S3; observational, not peer-reviewed. VERIFICATION 2026-07-04: numbers corroborated across multiple concordant sources; attribution fixed in S3 — observation is Hoober/UXmatters 2013, the "~75%" synthesis is Josh Clark/ALA 2015.]*
- **Thumb reach is a curved arc, not a fixed zone** — it varies with device size, hand size, and back-of-device grip; bottom and bottom-edge regions near the gripping hand are most reliably reachable. Peer-reviewed kinematic model, validated on 20 participants (small-N). *[EXTRACTED — S1, CHI 2014]*
- **Minimum touch targets:** ≥9.2 mm for discrete taps, ≥9.6 mm for serial taps. Corroborates (as a lower bound) Material's 48dp and Apple's 44pt. *[VERIFIED-PRIMARY — S2, full paper PDF read (Microsoft Research mirror); caveat: 2006 HP iPAQ PDA, 20 right-handed users standing still — predates capacitive phones and walking use. VERIFICATION 2026-07-04: the error-rate plateau at ≥9.6 mm holds for discrete tasks only; for serial tasks the statistical plateau starts at ≥7.7 mm — the 9.6 mm serial recommendation combines error data with subjective comfort. "Resistive" is externally true of the h4155 but not stated in the paper.]*
- **Comfort is highest at screen center (5.7/7), lowest in NW/SW corners (3.7/7).** Place primary controls central/bottom; put rare or destructive actions top. Right-handed thumb taps land slightly right of target on the rightmost column → edge controls should sit flush to the edge. *[VERIFIED-PRIMARY — S2; exact match. VERIFICATION 2026-07-04: the paper also flags the left side and bottom-right (SE) as difficult regions, not only NW/SW.]*
- **Design implication for InTown:** bottom sheet, its drag handle, the primary CTA, and map controls all belong in the bottom/central thumb zone — exactly the §17 layout. Companion-mode quick actions (running late, hungry, closed, go-to-#1) must be bottom-anchored and ≥48dp.

### 3.B — Map-first UI, bottom sheets, pedestrian navigation

- **Route *preview* (map overview) is a mainstream preference, not a fallback:** in a survey (n=222), 44% preferred simple route-preview over full turn-by-turn, rising to **76% in familiar environments**; in a performance study (n=195), route-preview showed **no significant disadvantage** vs turn-by-turn on errors, phone glances, or spatial learning. Directly supports InTown's "overview + Google Maps for turn-by-turn" delegation. *[VERIFIED-SECONDARY — S4, PLOS One (published 2026-03-23; co-author Johannes Schöning, Univ. Bremen); all numbers matched the search-indexed article text; it is a three-part mixed-methods design.]*
- **Turn-by-turn is a car-navigation paradigm ill-matched to pedestrians;** co-design work prioritized **landmark integration, intention-based routing, and subtle orientation cues** for walking UIs. Feeds InTown's scenic-leg annotations and landmark-based guidance. *[EXTRACTED — S4]*
- **Attention on the move comes in bursts of ~4–8 seconds** — mobile users glance, act, and look up repeatedly; continuous attention is rare outdoors. Companion mode must be *glanceable*: one primary card, large type, minimal reading per glance. *[VERIFIED-SECONDARY — S5, CHI 2005. VERIFICATION 2026-07-04: the finding is 4–8 s bursts; "4-second" is the title's lower-bound shorthand.]*
- **Material 3 standard (non-modal) bottom sheet** co-exists with the map and allows simultaneous interaction with both — the recommended pattern when the main region is panned/scrolled. Modal sheets (scrim, block background, dismiss by tap-outside/drag-down) are for quick actions/filters only. *[EXTRACTED — S25]*
- **Concrete M3 bottom-sheet tokens:** container `surfaceContainerLow`; **28dp top corner radius** (extra-large); 1dp elevation; max width **640dp** on large screens; half-expanded ratio **0.5**; drag-settle velocity threshold **500 px/s**; **48dp minimum drag-handle touch target** responsive to TalkBack/Voice/Switch Access with tap-to-cycle and double-tap-to-hide; peek state must be tall enough to signal more content. *[VERIFIED-PRIMARY — S25, every token confirmed against Google's material-components-android BottomSheet.md + tokens.xml (28dp = ShapeAppearance Corner.ExtraLarge; 500 px/s = `behavior_significantVelocityThreshold` default).]*
- **Apple HIG map rules (adopt directly):** keep the map interactive; avoid **noninteractive elements that obscure the map** (they "interfere with people's expectations for how maps behave"); use a **desaturated/muted basemap** when overlaying information-rich content so content stands out; **cluster overlapping POIs** and expand on zoom; ensure control-over-map contrast via thin stroke / light drop shadow / blend modes; **keep the selected location visible** when a detail sheet is open (offset the sheet or point to the pin). *[VERIFIED-PRIMARY — S27, fetched via Apple's HIG data endpoint. VERIFICATION 2026-07-04: the original "never fully obscure the map" overgeneralized — the HIG's actual rules are the noninteractive-elements statement above plus "keep at least part of your indoor map visible" (indoor maps only). Muted basemap, clustering, and keep-selected-pin-visible confirmed verbatim.]*
- **NN/g bottom-sheet guidance** corroborates the three-detent, grabber-affordance, non-modal pattern for map contexts. *[EXTRACTED — S26]*

### 3.C — Color and emotion / trust (the "why blue" evidence)

- **Blue increases trust more than red**, shown with *both* implicit (IAT) and explicit measures across three studies (so not just a reported stereotype). Peer-reviewed, though context is brand/logo trust, not app chrome — generalization to UI is an inference. *[VERIFIED-SECONDARY — S12, JMTP 27(3) 2019, 269–281, DOI 10.1080/10696679.2019.1616560; core finding confirmed. BLOCKED-SOURCE still: per-study N and effect sizes remain unretrievable (paywalled).]*
- **Blue on stores/logos raises perceived quality and trustworthiness** (Elliot 2015 review, citing Labrecque & Milne 2012). *[EXTRACTED — S10]*
- **Blue is associated with trust across all four European groups** (Dutch/French/Greek/Russian; n=1,218); associations are **largely universal, varying mainly in strength/shade** — but Russians notably tied *pure yellow* to emotion, a caveat that accent colors don't read identically across markets. *[VERIFIED-SECONDARY — S11 (Broeder 2022); confirmed incl. pure blue top for trust (~35% among Russians), dark blue second everywhere.]*
- **Blue, green, green-blue and white → positive, low-arousal emotions** (calm, relaxation, contentment). Supports blue primary + jade accent for a calm, welcoming feel. *[EXTRACTED — S8, systematic review]*
- **Arousal rises from blue and green to red; blue is the calmest hue and had the highest *valence* (pleasantness) — but only when highly saturated.** Saturated + bright colors raise *both* pleasantness and arousal. So a **saturated** blue is the most-pleasant choice; muted blue loses the advantage. *[VERIFIED-SECONDARY — S9, Wilms & Oberfeld 2018. VERIFICATION 2026-07-04: two precision fixes — (1) the physiological measures (skin conductance, heart rate) confirmed only the AROUSAL effects; pleasantness/valence was self-report (SAM ratings) only. (2) The abstract supports red > blue/green on arousal; a strictly monotone blue<green<red ordering is not abstract-verifiable.]*
- **Color-emotion associations are ~universal (cross-national similarity r=.88, 30 nations) but culturally graded** — a classifier can predict nationality from association patterns, and closer nations agree more. A Europe-tuned palette generalizes best within Europe. *[VERIFIED-SECONDARY — S7, Psychological Science 31(10) 2020; all figures exact (4,598 participants, 30 nations, 22 native languages, r=.88, ML nationality prediction).]*
- **Lightness carries valence largely independent of hue** — light colors read positive, dark negative. The tint/shade of surfaces shifts felt tone, not just the brand hue. *[EXTRACTED — S8]*
- **CRITICAL CAVEAT — "one hue = one emotion" is folklore.** Correspondences are many-to-many, driven by lightness + saturation + hue together. Elliot explicitly warns the color-psychology literature is **immature** ("nascent stage"), with hue/lightness/chroma confounds uncontrolled in nearly all prior work, and that strong "color X causes emotion Y" design claims **exceed the evidence**. The red-impairs-cognition finding is **contested**: the meta-analysis is **Gnambs 2020, Psychon Bull Rev 27:1374–1382** (67 effect sizes / 38 samples; anagram d=−0.06 and knowledge-test d=−0.04 n.s.; reasoning d=−0.34 CI [−0.61,−0.06]; effects shrink in later studies and vanish after publication-bias correction). *[FOLKLORE-FLAG — S8, S9, S10; VERIFICATION 2026-07-04: caveat confirmed; meta-analysis identified and pinned. The "underpowered" wording is plausible but not literally verified against Elliot's full text.]*

### 3.D — Perceptual color spaces & contrast engineering (highest-leverage UI finding)

- **HSL/hex are unsafe for palette generation:** HSL lightness is hue-dependent (hsl(H,100%,50%) spans measured CIELAB L* ≈ 32 for blue to ≈ 97 for yellow), silently producing bad contrast; HSL/RGB/hex also can't express wide-gamut Display-P3. *[VERIFIED-PRIMARY — S15, article text confirmed via mirror. VERIFICATION 2026-07-04: the "~33–96" range is not stated in the article — it is a (numerically correct, own-computation ≈32–97) derivation; cite the principle to the article, the numbers as own computation.]*
- **OKLCH's L = perceived lightness, consistent across hues** → equal-L accent ramps (blue/jade/iris) look equally light; hue can change while L/C hold, giving predictable contrast and letting you **generate the whole palette from a formula + seed colors**. Caveats: young tooling, and high-chroma L/C/H combos can be out-of-gamut (must gamut-check for sRGB). *[EXTRACTED — S15, S16]*
- **Material HCT gives contrast guarantees by construction:** built from CAM16 hue/chroma + CIELAB L* as tone; **tone-difference ≥40 ⇒ WCAG ≥3.0; ≥50 ⇒ ≥4.5.** M3 generates full accessible light+dark schemes algorithmically from a seed. It also ships a "universally disliked colors" detector (dark yellow-greens: hue 90–111, chroma >16, tone <65 — grounded in Palmer & Schloss 2010) — relevant when tuning the jade range. *[VERIFIED-PRIMARY — S13, confirmed against Google's canonical material-color-utilities source code (hct.ts, dislike_analyzer.ts). VERIFICATION 2026-07-04: one boundary caveat — at the extreme (tones 50↔100) the WCAG math gives 4.48:1, marginally under 4.5; treat "≥50 ⇒ 4.5:1" as approximately exact and re-check final pairs.]*
- **Stripe's CIELAB rebuild** encodes contrast in scale distance: colors ≥5 levels apart pass small-text (4.5:1), ≥4 levels pass large-text/icon (3:1). A directly reusable token pattern. *[EXTRACTED — S14]*
- **WCAG 2.x contrast math is non-uniform and overstates contrast near black** — a "passing" 4.5:1 pair can be unreadable in dark mode. APCA (WCAG 3 candidate) gives polarity-aware, perceptually-uniform Lc thresholds: **Lc 90 preferred body text, Lc 75 min for body columns, Lc 60 min non-body, Lc 45 min headlines, Lc 30 min placeholder/disabled, Lc 15 min for any discernible element.** APCA is **not yet a finalized standard** — use as a supplementary check, keep WCAG 2.2 AA as the legal target. *[VERIFIED-PRIMARY — S17, confirmed verbatim against the Myndex/SAPC-APCA repo (source of git.apcacontrast.com): all six Lc thresholds match; the near-black WCAG-2 critique and "candidate for WCAG 3, still in development" confirmed. Added nuances: Lc 45 is also the minimum for fine-detail pictograms; Lc 30 also for large solid semantic non-text elements; AAA-equivalent ≈ each level +15; thresholds assume Helvetica/Arial-class reference fonts. FOLKLORE-FLAG on the "86% of sites fail WCAG 2" figure stands.]*
- **Implication for InTown dark mode:** validate `#0F172A`/`#0B1220` surfaces with **both** WCAG 2.2 and APCA, because WCAG-2-only checks are unreliable near black.

### 3.E — Color-vision deficiency (CVD)

- **CVD does not reduce text readability** (readability = luminance/lightness contrast, not hue) **but it does impair map/dataviz hue discrimination.** A map-first app must **encode meaning with lightness contrast + shape/pattern, never hue alone.** This is the scientific backing for §17's "color + pattern" route encoding and category pins. *[VERIFIED-PRIMARY — S17, confirmed verbatim: "CVD does not impact readability per se. But CVD affects visual tasks such as reading a map or charts."]*
- **Use a CVD-safe qualitative palette** (Okabe–Ito is the canonical, deuteranopia/protanopia-safe 8-color set) for any categorical encoding (route modes, pin categories). *[VERIFIED-PRIMARY — S18, Nature Methods 2011. VERIFICATION 2026-07-04: Wong 2011 presents the 8 colors (identical to Okabe–Ito); the explicit credit to Ito & Okabe's 2002 Color Universal Design work was only added via a 2023 Nature Author Correction (s41592-023-01974-0) — cite both.]*

### 3.F — Waiting psychology & the research-progress screen

- **The labor illusion:** when a service *shows it is working*, users can prefer a longer wait over instant results and **value the outcome more**, even when results are identical. Tested in **5 experiments including a travel-search context** (live list of airlines being searched vs a plain progress bar). Mechanism: shown effort → perceived effort → reciprocity → higher valuation → so **show concrete work items** (sources being read), not just a timer. *[VERIFIED-SECONDARY — S19, Management Science 57(9) 2011, 1564–1579; abstract + HBS records match all core claims.]*
- **Boundary conditions exist** — the paper explicitly studies them; **fake or arbitrary-looking waits can backfire.** The often-quoted "~8%" lift remains **unverifiable folklore**. *[FOLKLORE-FLAG / BLOCKED-SOURCE — S19. VERIFICATION 2026-07-04: Experiment 1 used waits of **10–60 s in 10-s steps (no 0-s cell)** — the "0–60s" retelling is wrong as stated; the instantaneous comparison came from a separate preference experiment. "~8%" still unconfirmed against the full text.]*
- **Implication for InTown:** the PRD's streaming research log ("reading 34 blogs and 22 videos…, verifying hours…, scoring 61 candidates…") is the correct, evidence-backed design — but the shown work must be *real* (echo the user's actual interests/city), and skeleton cards should populate with genuine partial results.

### 3.G — Engagement, aesthetics, habit, gamification (ethical levers)

- **Endowed progress effect:** artificial unearned progress toward a goal raises persistence and completion. Field study: a 10-slot loyalty card with **2 slots pre-stamped** (same 8 purchases required) got **34% redemption vs 19%** for a plain 8-slot card, and faster completion. Works via *feeling the task is underway*, and is stronger **when a plausible reason for the head-start is given.** *[VERIFIED-SECONDARY — S20. VERIFICATION 2026-07-04: all figures confirmed (34% vs 19%, both cards requiring 8 purchases, faster completion); abstract confirms the reason-for-endowment moderator — "however specious" the reason.]*
  - **Apply to InTown:** the onboarding quiz/progress bar should show the task as *already begun* with a real justification — e.g., "City selected ✓ — 1 of 6 done," never an arbitrary fake head-start.
- **Aesthetic-usability effect:** perceived beauty strongly predicts perceived usability *before* use. Cross-cultural replication found **r≈.92 (Israel, reported as .921) vs r=.589 (original Japanese study, Kurosu & Kashimura 1995, 26 ATM layouts)** — a large effect that ran opposite Tractinsky's predicted cultural direction. Justifies InTown's "highly polished" investment as functional, not cosmetic. *[VERIFIED-SECONDARY — S21; r-values confirmed via Tractinsky's own 2000 self-archived follow-up and independent replication papers. Caveat: correlations are between mean beauty and mean *apparent* (pre-use) usability ratings — not measured usability.]*
- **Habit formation is slow and forgiving:** automaticity plateau reached in **18–254 days (median 66)**; early repetitions matter most; and **missing a single day did *not* harm the habit trajectory.** → Anchor use to **stable contextual cues** (e.g., an evening "plan tomorrow" moment, an arrival-in-city trigger), invest in early-experience quality, and **do not build punitive streak mechanics** — one-missed-day punishment is unsupported by the evidence and conflicts with the no-dark-patterns stance. *[VERIFIED-SECONDARY — S22. VERIFICATION 2026-07-04: 96 volunteers, 82 with sufficient data; the model **fitted for 62 of 82** individuals, of which **39 were good fits** — the original "39/82" conflated the two; "66 days" remains indicative.]*
- **Gamification via self-determination theory:** *achievement* features (points/badges/levels/challenges) were the **strongest predictor of autonomy + competence** satisfaction; *social* features (shared/group) satisfied **all three needs** (autonomy, competence, relatedness); *immersion* features (avatars/narrative) satisfied **only autonomy**. → Prioritize **achievement + social** mechanics (InTown's territory-opening, roles, group curation are well-chosen); theming alone is weak. *[VERIFIED-SECONDARY — S23; exact match incl. N=824 (Xiaomi & Huawei communities). Caveats: cross-sectional SEM survey — "predictor" ≠ causal; cross-cultural/domain generalization open.]*
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

## 5. The resume backlog — ✅ EXECUTED 2026-07-04 (second session)

> **Status update:** both bodies of work below were completed in the second session. §5.1's 25 claims were all adversarially re-checked (**zero refuted** — verdicts and corrections in §8.1 and inline above). §5.2's five agent briefs were covered by targeted agents answering every §6 open question (results in §8.2–§8.3); genuinely-remaining sub-topics are listed in §8.5. The §5.3 blocked sources were largely reached via mirrors (Microsoft Research PDF for S2, GitHub-hosted primaries for S13/S15/S17/S25/S28, Apple's HIG data endpoint for S27); the still-paywalled ones are flagged in §8.1.

### 5.1 — Adversarial verification queue (25 claims — ✅ all verified, none refuted)

The verify stage was to run a **3-vote refute panel per claim (kill if ≥2/3 refute)**. Original queue (kept for traceability; see §8.1 for verdicts):

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

### 5.2 — Five supplementary academic agents — ✅ core topics covered by targeted agents (see §8.2–§8.3)

Each was a dedicated academic-literature sweep on a sub-topic the generic fan-out under-covered. The second session covered their highest-value questions with two targeted agents instead of full verbatim relaunches; briefs kept below for traceability and for the residual gaps in §8.5.

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

## 6. Open questions — ✅ ALL ANSWERED 2026-07-04 (details in §8.2–§8.3)

1. **Do cited/source-labeled AI answers measurably increase user trust?** → **Yes, robustly — but superficially.** Citations raise trust even when random (Ding et al., AAAI 2025), and trust *drops* when users check citations and find mismatches. Generative search engines were measured at only 51.5% citation recall (Liu et al., EMNLP 2023). And transparency follows an inverted-U: medium explanation beats full provenance dumps (Kizilcec, CHI 2016). → InTown's citation-everywhere doctrine is validated **and** creates a hard duty of citation accuracy. (§8.2 Q1)
2. **Does honest uncertainty labeling raise or erode trust?** → **It does not erode trust and improves decisions.** Probabilistic forecasts raised trust and made it robust to errors (Joslyn & LeClerc 2012); numeric/specific uncertainty preserves source trust while vague verbal hedging slightly harms it (van der Bles et al., PNAS 2020); first-person hedges reduce overreliance and improve user accuracy (Kim et al., FAccT 2024). → "approximate — verify on arrival" is evidence-backed; be *specific*, label where decision-relevant. (§8.2 Q2)
3. **Group-recommendation explanation & fairness** → **Corrected picture:** the "You Do Not Decide for Me!" paper is **ACM Hypertext 2020** (not CHIIR), and its UMUAI-2023 follow-up (N=399+288) found **no measurable benefit of social-choice explanations on perceived fairness** — the aggregation *strategy* and group configuration carry fairness. Aggregate count chips ("3 of 4 want this") are safer than named attributions (privacy risk, UMAP 2021). (§8.3 Q1)
4. **Onboarding per-field completion cost** → **The "~3–5%/field" figure is unsourced practitioner folklore** (genealogy: Expedia 2010 one-field anecdote, 2009–2011 single-site case studies; CXL documents counterexamples). Direction is supported (Baymard: checkouts show ~2× the needed fields). → PRD must replace the number with the directional claim. (§8.2 Q5)
5. **Skeleton screens vs progress bars** → **"Skeletons feel faster" is folklore-grade.** Evidence is mixed and weak (Viget n=136: skeletons *worst*; Chung 2018: slightly better, n.s.; Mejtoft ECCE'18 n≈90: mildly better subjective ratings). → Use skeletons for layout stability, not on a perceived-speed claim; prefer shimmer over pulse; keep durations short. (§8.2 Q3)
6. **Typography on-the-move** → Walking impairs reading, and **bigger text does NOT fix it (bigger targets do)** — Schildbach & Rukzio, MobileHCI 2010; adaptive font size helps (Kong et al., CHI 2025). Floors: M3 Body Large 16sp / Apple 17pt body as *minimum* for companion-mode content; ~45–75 cpl line length (~30–45 natural on phones). Variable-font performance on mid-range Android: gray literature only. (§8.3 Q2)
7. **Doherty threshold provenance** → **Economic-productivity argument, not a perceptual threshold.** The 1982 IBM report (GE20-0752-0) synthesizes internal mainframe studies; no experiment isolating 400ms; productivity kept improving below 400ms. → Do not cite "the Doherty threshold (400ms)" in the PRD as science; use Miller 1968 / Nielsen 0.1s–1s–10s as heuristics, attributed as guidelines. (§8.2 Q4)

---

## 7. How to resume (for the next session/agent) — status after second session

1. ~~Re-run the §5.1 verification queue~~ ✅ **Done** — all 25 claims checked, none refuted, corrections inline + §8.1.
2. ~~Relaunch the five §5.2 agent briefs~~ ✅ **Core questions answered** via targeted agents (§8.2–§8.3); residual gaps in §8.5 are optional nice-to-haves, not blockers.
3. ~~Chase the §5.3 blocked sources~~ ✅ **Mostly done via mirrors**; still paywalled: Buell & Norton full text (the "~8%" number), Su/Cui/Walsh per-study Ns. Both flagged; neither blocks any design decision.
4. **Remaining action (the real next step):** fold the verified findings into `FINAL_PRD.md` — §17 (design system: OKLCH/HCT-derived tokens per §4, plus the §8.4 palette audit fixes), §6.2/§6.5/§6.21 (onboarding, research UX, gamification), and correct the PRD's "~3–5%/field" and "skeletons feel faster" assertions per §6 above. Also fix `LEARNINGS.md` D8's venue/claim (see §8.3 Q1).

---

## 8. Verification pass results (second session, 2026-07-04)

**Method.** Six parallel adversarial agents: four re-verified the §5.1 claim queue (grouped: touch/map, color-emotion, color-engineering, engagement/waiting), two answered the §6 open questions. Each verifier was instructed to *refute*. Environment constraint: the egress proxy blocked most publisher hosts; agents used reachable primaries (Microsoft Research PDF, Apple HIG data endpoint, GitHub-hosted canonical sources: material-color-utilities, material-components-android, Myndex/SAPC-APCA, GoogleChrome/web.dev) and triangulated the rest across multiple independent search-index reproductions. Additionally, the §17 palette was audited computationally (WCAG 2.x + APCA formulas, own implementation) — no research needed, just math (§8.4).

### 8.1 — Verdict table for the 25-claim queue

| Queue # | Claim cluster | Verdict | Corrections |
|---|---|---|---|
| 1–2 | Touch-target minimums (S2) | **VERIFIED-PRIMARY** (full PDF) | Serial-task error plateau starts at ≥7.7 mm (9.6 mm rec = error + comfort combined); "resistive" not in-paper; left + SE also hard regions |
| 3–4 | Route-preview 44%/76%, n=195 no-disadvantage (S4) | **VERIFIED-SECONDARY** | None; three-part design; published 2026-03-23 |
| 5–6 | Color-emotion universality r=.88, nationality-predictable (S7) | **VERIFIED-SECONDARY** | None — all figures exact |
| 7–9 | Systematic review: blue/green calm, lightness→valence, many-to-many (S8) | **VERIFIED-SECONDARY** | Year = **2025**; "largely independent of hue" slightly stronger than abstract wording |
| 10–13 | Wilms & Oberfeld arousal/valence + physiology (S9) | **VERIFIED-SECONDARY** | Physiology confirms **arousal only**, valence was self-report; monotone hue order not abstract-verifiable |
| 14–16 | Elliot review: color-in-context, immaturity (S10) | **VERIFIED-SECONDARY** | "Underpowered" wording plausible, not literal; red-cognition meta = **Gnambs 2020** (identified) |
| 17–18 | Blue=trust across 4 EU groups (S11) | **VERIFIED-SECONDARY** | Author/year added: **Broeder 2022** |
| 19 | Blue > red trust, implicit+explicit (S12) | **VERIFIED-SECONDARY** | Per-study Ns/effect sizes still paywalled |
| 20–21 | Material HCT tone→contrast guarantees (S13) | **VERIFIED-PRIMARY** (source code) | Boundary case: tones 50↔100 → 4.48:1 (marginally <4.5) |
| 22–24 | APCA thresholds, near-black critique, CVD=luminance (S17) | **VERIFIED-PRIMARY** (repo) | Verbatim matches; added threshold nuances |
| 25 | Endowed progress definition + figures (S20) | **VERIFIED-SECONDARY** | None — 34%/19% exact; "however specious" reason moderator confirmed |

Also re-checked outside the queue: S3 (attribution fixed: Hoober data / Clark article), S5 (4–8 s), S14 Stripe (verbatim confirmed: ≥5 levels ⇒ 4.5:1, ≥4 ⇒ 3:1), S15 (principle confirmed; "~33–96" is own-computation), S18 (Okabe–Ito attribution via 2023 correction), S19 (waits were **10–60 s**, no 0-s cell; "~8%" stays folklore), S21 (r=.921/.589 confirmed; "apparent usability" caveat), S22 (**62/82 fitted, 39 good fits** — not "39/82"), S23 (exact; SEM ≠ causal), S25 (all tokens confirmed in code/docs), S27 ("never fully obscure" reworded to the HIG's actual statements), S28 (verbatim confirmed). **Bottom line: 0 of 25 claims refuted; the dossier's §1 executive summary and §4 recommendations stand unchanged in substance.**

### 8.2 — Open questions answered: waiting, AI trust, friction (ex-Agent 4/5 territory)

- **Q1 · Citations → trust (strong evidence).** Ding, Facciani, Poudel et al., *Citations and Trust in LLM Generated Responses*, **AAAI 2025** (arXiv:2501.01303): trust rises whenever citations are present — **even random ones** — and **falls when users actually check** citations that don't support the claim. Liu, Zhang & Liang, **EMNLP Findings 2023** (arXiv:2304.09848): generative search engines averaged **51.5% citation recall / 74.5% precision** — the cautionary tale. Kizilcec, **CHI 2016** (N=103): transparency–trust is an **inverted U** — medium explanation optimal, raw-detail dumps erode trust again. Tintarev & Masthoff (UMUAI 2012): persuasive explanations can conflict with *effective* ones — measure separately. **Design:** keep citations everywhere; make them *actually support* the claim (InTown's citation gate is the right control); default to source + one-line rationale, full provenance behind a tap.
- **Q2 · Honest uncertainty → trust (strong evidence).** Joslyn & LeClerc, *J. Exp. Psych: Applied* 2012: probabilistic forecasts → better decisions, **higher trust, trust robust to forecast errors**. van der Bles et al., **PNAS 2020** (5 experiments + BBC field): **numeric ranges don't damage source trust; vague verbal hedges slightly do**. Kim et al., **FAccT 2024** (pre-registered, N=404): first-person hedges ("I'm not sure, but…") → less overreliance, **higher user accuracy**; generic phrasing weaker. Vasconcelos et al., TOCHI 2024: highlight uncertainty **where the user must act/verify**, not everywhere. **Design:** "approximate — verify on arrival" is correct; make labels specific ("±10 min", "hours unconfirmed as of {date}"), attach them to decision-relevant facts (hours, prices, departure times), don't blanket-hedge.
- **Q3 · Skeleton screens (weak/mixed evidence).** Viget test (n=136): skeletons **worst** of three conditions; Chung 2018 (mobile, real devices): slightly better, **not significant**; shimmer (left→right wave) beats pulse; Mejtoft et al., ECCE 2018 (n≈90): mild subjective advantage. **Design:** keep skeletons for layout stability and populate them with *real* partial results (which shifts the mechanism to the labor illusion, S19 — which *is* well-evidenced); never claim or rely on "feels faster."
- **Q4 · Doherty threshold (provenance settled).** Doherty & Thadani 1982 (IBM GE20-0752-0) = economic synthesis of internal studies (Thadani 1981; Doherty & Kelisky 1979): sub-second response → transactions/hour rise more than proportionally; **no 400ms psychophysical threshold was ever isolated**; gains continue below 400ms. The "400ms magic number" is design-blog distillation (lawsofux.com). **Design:** use Miller 1968 / Nielsen's 0.1s / 1s / 10s as engineering guidelines (attributed as heuristics); target sub-second for interactive feedback; never cite "Doherty threshold" as evidence.
- **Q5 · Form-field friction (folklore confirmed).** No primary source for "~3–5% conversion drop per field." Genealogy: Expedia 2010 ($12M from removing one *confusing* field — a mislabeling fix), Imaginary Landscape 2009 (11→4 fields, ~120% more submissions, single site), HubSpot 2010–11 correlations. CXL documents cases where *adding* fields raised conversion. Baymard (proprietary corpus): what matters is **default-visible fields** — typical checkouts show ~2× the fields needed; complexity is a top abandonment reason. **Design:** keep progressive profiling as best practice; PRD wording must become "field count adds friction; effect size context-dependent and unquantified in primary literature."

### 8.3 — Open questions answered: group fairness, typography, dark mode, streaks (ex-Agent 1/3 territory)

- **Q1 · Group-rec explanations & fairness (correction to LEARNINGS D8).** The anchor study is Najafian, Herzog, Qiu, Inel & Tintarev, *"You Do Not Decide for Me!"*, **ACM Hypertext 2020** (N=200) — **not CHIIR 2020**. It found all aggregation strategies scored well on fairness; users punished dictatorship-like strategies. The larger follow-up — Barile, Najafian, Draws & Tintarev, **UMUAI 2023** (N=399 + N=288) — found **no measurable benefit of adding social-choice explanations** on perceived fairness/consensus/satisfaction: the *strategy* and the group's internal disagreement configuration carry the effect. Privacy: Najafian et al., **UMAP 2021** (N=114): disclosing *whose* preference drove an outcome raises privacy concern, worst for minorities-of-one in loose groups. Masthoff UMUAI 2004: users natively think in Average / Average-Without-Misery / Least-Misery and care about preventing misery. **Design:** keep "3 of 4 want this" **aggregate-count** chips (never "Anna vetoed this"); consider a misery chip ("nobody rated this below 2"); the fairness lever is the merge strategy itself (already D8's average-with-misery-threshold), not explanation prose. **Fix LEARNINGS D8:** venue → HT '20, and soften "the explanation drives perceived fairness more than the algorithm" — the 2023 follow-up contradicts it.
- **Q2 · Typography on the move.** Schildbach & Rukzio, **MobileHCI 2010** (N=16): walking hurts both selection and reading; **larger targets compensate selection; larger text does NOT compensate reading** (scrolling cost eats the gain). Kong et al., **CHI 2025** (N=45): automatic font-size adaptation while walking reduces degradation; big individual differences → auto + easy override. Baselines: M3 Body Large **16sp**, Apple body **17pt** (11pt absolute floor); line length 45–75 cpl (empirical support ~55; phones naturally 30–45). Variable fonts on mid-range Android: no peer-reviewed performance data — engineering trade-off (single file ~72% smaller in practitioner reports; animating axes costs). **Design:** companion mode = ≥16sp/17pt body, short chunked lines, big targets; *shorten* content for walking contexts instead of enlarging text.
- **Q3 · Dark mode.** Positive polarity (dark-on-light) reads better: Buchner & Baumgartner, Ergonomics 2007 (holds regardless of ambient light); Piepenbrock et al. 2013 (young + old), Human Factors 2014 (**advantage largest at small font sizes**; mechanism = pupil constriction → sharper retinal image). Battery (Dash & Hu, **MobiSys 2021**, OLED): dark saves only **3–9% at 30–50% brightness**, but **~39–47% at 100% brightness** — i.e., meaningful exactly in the outdoor-sunlight travel scenario, where legibility argues for light. Preference data is tech-skewed (70–82% in Android-enthusiast polls; NN/g n=115 ≈ one-third dark / one-third light / one-third mixed). Halation-for-astigmatism: mechanistically plausible, **no strong direct peer-reviewed test** — label plausible-unverified. **Design:** ship both; **default = system** (`prefers-color-scheme`, per S28) with in-app override; treat light as the effective daylight/companion default; the map needs a true dark tile style, not inversion. (This resolves §4's dark-mode item; combined with the §8.4 audit below.)
- **Q4 · Streaks (dossier stance confirmed).** Silverman & Barasch, **JCR 49(6) 2023** (7 studies): highlighting an *intact* streak boosts engagement; highlighting a *broken* one **reduces** it vs saying nothing — users disengage or switch. Sharif & Shu, **JMR 2017 + OBHDP 2019**: goals with **costly emergency slack** ("freeze") beat rigid and easy goals on preference *and* persistence, specifically after lapses (the academic basis Duolingo cites for Streak Freeze; Duolingo's own ~48%-longer-streak numbers are company gray data). **Design:** for InTown, calendar streaks are a poor fit anyway (episodic travel); prefer per-trip progress + cumulative totals; if any streak exists: never headline a break, offer earned freezes, allow repair windows. Confirms §3.G's no-punitive-streaks recommendation with direct causal evidence.

### 8.4 — Computed palette audit (own calculations, WCAG 2.x + APCA-4g formulas — action items for FINAL_PRD §17)

The §17 palette was checked pair-by-pair. Passing pairs omitted; **failures/risks:**

| Pair (§17) | WCAG | APCA Lc | Verdict |
|---|---|---|---|
| Dark secondary text `#94A3B8` on bg `#0B1220` | 7.30 ✅ | −51.1 ❌ | **Fails APCA Lc 60 (non-body) and Lc 75 (body)** despite passing WCAG AA — the exact near-black WCAG failure mode S17 predicts. Lighten toward `#CBD5E1`-range for body-size secondary text. |
| Dark secondary on surface `#111827` | 6.92 ✅ | −50.6 ❌ | Same fix. |
| White on jade `#10B981` (accent chips) | **2.54 ❌** | −54.2 ❌ | **Fails WCAG AA outright, even the 3:1 large-text floor.** Use dark text (`#0F172A`) on jade, or darken the fill (e.g., `#047857` region) for white text. |
| White on warning `#F59E0B` | **2.15 ❌** | −46.4 ❌ | Same: dark text on amber (the standard fix). |
| White on success `#22C55E` | **2.28 ❌** | −49.2 ❌ | Same: dark text or darker green fill. |
| White on error `#EF4444` | 3.76 ⚠️ | −69.3 | Passes large-text/icon 3:1 only — fine for badges/icons, **not** for body-size text; use `#DC2626`/`#B91C1C` fills for white body text. |
| Dark pressed-primary `#3B82F6` + on-primary `#0B1220` | 5.09 ✅ | 39.4 ❌ | Below APCA Lc 45; acceptable for a transient pressed state, but prefer keeping on-primary white-ish on pressed, or a darker pressed fill. |

**Healthy pairs (for the record):** light text/bg 17.1 / Lc 101; light secondary `#475569` 7.2 / Lc 83; `#2563EB` + white 5.17 / Lc ~75–80 (passes AA body and ~meets APCA body minimum); dark text/bg 17.9 / Lc −104; dark primary `#60A5FA` + `#0B1220` 7.36 / Lc 53.6 (fine for large CTA text, below Lc 60 for small text — keep CTA labels ≥ large-text size or lighten). This audit **concretely validates** the dossier's core §3.D warning: two §17 combinations pass WCAG 2 while failing perceptual contrast, and three semantic-color combinations fail even WCAG. The PRD's "all text/CTA combinations WCAG AA" assertion is currently false and must be fixed alongside the OKLCH/HCT re-derivation (§4).

### 8.5 — Residual gaps (optional follow-ups, none blocking)

1. **Tourism-app adoption literature** (TAM/UTAUT effect sizes, choice-overload in itinerary planning — ex-Agent 1 topics 1/5) — untouched; nice-to-have context, no design decision hinges on it.
2. **Ou & Luo color-emotion model; Palmer & Schloss ecological valence details** (ex-Agent 2 topic 1) — the practical conclusions already rest on S7–S13; Palmer & Schloss 2010 is now indirectly confirmed as the basis of HCT's dislike-analyzer.
3. **Sunlight-glare quantification** (ex-Agent 3 topic 4) — partially covered via polarity studies (§8.3 Q3); no direct outdoor-glare contrast study fetched.
4. **Paywalled exact numbers:** Buell & Norton "~8%", Su/Cui/Walsh per-study Ns — flagged; do not quote either in the PRD.
5. **Micro-celebration/delight empirical work; variable-reward critique depth** (ex-Agent 5 topics 8/9) — peak-end + SDT + streak evidence suffices for current PRD decisions.

---

*End of dossier. Updated 2026-07-04 (second session): the verification pass and the open-question research are complete — 0 of 25 claims refuted, ~15 corrections folded in inline, all §6 questions answered in §8.2–§8.3, and a computed palette audit added in §8.4. The remaining work is integration into `FINAL_PRD.md` (§7 step 4), not more research.*

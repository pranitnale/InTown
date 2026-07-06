# Contract-change request — final pin-category ramp (P01 → `contracts/design-tokens.json`)

**Status:** proposed (not yet applied to `contracts/`).
**Origin phase:** P01 (Design system & app shell).
**Target:** `contracts/design-tokens.json` → `map.pins`.
**Requested by:** P01 implementation, per the phase's out-of-scope note ("Pin-category
final ramp is generated here and returned to contracts via a contract-change request").

## Why

`contracts/design-tokens.json` ships `map.pins` as an explicit **placeholder**
(`"placeholder": true`) whose `anchors` are the Okabe–Ito CVD-safe seed hues
(§17.4). Its own note asks P01/F1 to "generate the final OKLCH pin ramp with
lightness separation between adjacent categories and return it via a
contract-change request." This document is that request.

The final ramp is derived deterministically in `frontend/scripts/oklch.mts`
(`generatePinRamp`) and unit-tested in `frontend/tests/oklch.test.ts`. It is
already emitted into `frontend/ui-tokens/` (`--pin-*` CSS vars and the `pinRamp`
export) so the frontend can consume it now; this request lets it become the
canonical contract value.

## Method

For each category we keep the anchor's **OKLCH hue and chroma** (so the category
color identity is preserved) but reassign **OKLCH lightness** on a zig-zag scale
so that every *adjacent* category pair is well separated in lightness. Chroma is
gamut-clamped to sRGB. Rationale: CVD users (and small 20–28 px map pins at a
distance) distinguish adjacent categories reliably by **lightness contrast**, not
hue alone ("lightness before hue for adjacent meaningful colors", §17). Every
proposed value is verified sRGB-in-gamut and confirmed **outside** the disliked
dark yellow-green HCT zone (hue 90–111 ∧ chroma > 16 ∧ tone < 65).

## Proposed values

| Category  | Anchor (seed) | Proposed pin | OKLCH L target | HCT hue |
|-----------|---------------|--------------|----------------|---------|
| photo     | `#D55E00`     | `#F1772E`    | 0.70           | ~46     |
| viewpoint | `#56B4E9`     | `#0071A0`    | 0.52           | ~239    |
| art       | `#E69F00`     | `#EFA81C`    | 0.78           | ~78     |
| history   | `#7C3AED`     | `#6407CD`    | 0.45           | ~304    |
| museum    | `#2563EB`     | `#4581FF`    | 0.63           | ~270    |
| food      | `#047857`     | `#004F38`    | 0.38           | ~168    |

**Adjacent OKLCH-lightness gaps** (photo→viewpoint→art→history→museum→food):
`0.182, 0.261, 0.330, 0.180, 0.252` — all ≥ the `0.12` minimum separation
threshold (`PIN_MIN_LIGHTNESS_GAP`).

## Suggested contract shape

Replace the placeholder `map.pins.anchors` derivation with a resolved ramp,
e.g. add a `map.pins.ramp` object and drop `"placeholder": true`:

```json
"ramp": {
  "photo": "#F1772E",
  "viewpoint": "#0071A0",
  "art": "#EFA81C",
  "history": "#6407CD",
  "museum": "#4581FF",
  "food": "#004F38"
}
```

The `anchors`, `selectedRing`, and `closed` entries stay as-is. Adjacent order in
the enum must be preserved for the lightness-separation guarantee to hold; if the
category order changes, regenerate via `generatePinRamp` and re-verify.

## Verification

- `frontend/tests/oklch.test.ts` → "pin-category ramp": in-gamut, not in disliked
  zone, adjacent lightness separation ≥ 0.12, deterministic.
- Regeneration is idempotent: `npm run generate:tokens` reproduces the same
  `--pin-*` values byte-for-byte.

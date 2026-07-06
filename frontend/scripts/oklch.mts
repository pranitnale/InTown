/**
 * OKLCH ramp generator + gamut/HCT guards for the InTown Color System v2 (§17.1).
 *
 * Pure, dependency-free color math (no filesystem / node imports) so it can be
 * imported both by `generate-tokens.mts` (build-time emitter) and by
 * `tests/oklch.test.ts` (vitest). Everything here is deterministic: same input
 * always yields byte-identical output.
 *
 * Ramp method (§17.1): each seed is converted to OKLCH; hue and chroma are held
 * fixed while lightness is stepped across the 50→900 scale. Chroma is clamped
 * per step (bisection) so every generated color stays inside the sRGB gamut.
 * A disliked-zone guard rejects the dark yellow-green HCT band
 * (hue 90–111 ∧ chroma > 16 ∧ tone < 65).
 *
 * The HCT model below is a faithful port of the CAM16 forward transform + CIE
 * L* used by Google's Material Color Utilities; it reproduces the library's
 * published reference values (e.g. #FF0000 → H 27.41 / C 113.36 / T 53.24),
 * which `tests/oklch.test.ts` asserts.
 */

export type Rgb = readonly [number, number, number];
/** [L (0..1), C (≥0), H (deg 0..360)] */
export type Oklch = readonly [number, number, number];

// ---------------------------------------------------------------------------
// sRGB <-> OKLCH (Björn Ottosson's Oklab)
// ---------------------------------------------------------------------------

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

export function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  const digits = match?.[1];
  if (!digits) throw new Error(`Expected 6-digit hex color, got "${hex}"`);
  const int = Number.parseInt(digits, 16);
  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
}

export function rgbToHex(rgb: Rgb): string {
  const [r, g, b] = rgb;
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.round(c).toString(16).padStart(2, '0').toUpperCase())
      .join('')
  );
}

function rgbToOklab(rgb: Rgb): Oklch {
  const [r, g, b] = rgb;
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function oklabToLinearRgb(lab: Oklch): Oklch {
  const [L, a, b] = lab;
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const [L, a, b] = rgbToOklab(rgb);
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, c, h];
}

function oklchToOklab(oklch: Oklch): Oklch {
  const [L, c, h] = oklch;
  const hr = (h * Math.PI) / 180;
  return [L, c * Math.cos(hr), c * Math.sin(hr)];
}

function oklchToLinearRgb(oklch: Oklch): Oklch {
  return oklabToLinearRgb(oklchToOklab(oklch));
}

/** True when the (L, C, H) triple maps to a color inside the sRGB gamut. */
export function oklchInSrgbGamut(oklch: Oklch, epsilon = 1e-4): boolean {
  const [r, g, b] = oklchToLinearRgb(oklch);
  const ok = (v: number): boolean => v >= -epsilon && v <= 1 + epsilon;
  return ok(r) && ok(g) && ok(b);
}

/**
 * Largest chroma ≤ `chroma` (holding L and H) that stays in the sRGB gamut.
 * Returns `chroma` unchanged when it is already in-gamut; otherwise bisects.
 * Fixed iteration count keeps the result deterministic.
 */
export function clampChromaToGamut(l: number, chroma: number, h: number): number {
  if (oklchInSrgbGamut([l, chroma, h])) return chroma;
  let lo = 0;
  let hi = chroma;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (oklchInSrgbGamut([l, mid, h])) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function oklchToHex(oklch: Oklch): string {
  const [r, g, b] = oklchToLinearRgb(oklch);
  const to255 = (channel: number): number => {
    const clamped = Math.min(1, Math.max(0, channel));
    return Math.round(Math.min(1, Math.max(0, linearToSrgb(clamped))) * 255);
  };
  return rgbToHex([to255(r), to255(g), to255(b)]);
}

// ---------------------------------------------------------------------------
// WCAG relative luminance (for monotonic-lightness assertions)
// ---------------------------------------------------------------------------

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const lin = (c: number): number => srgbToLinear(c / 255);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// ---------------------------------------------------------------------------
// HCT (CAM16 forward + CIE L*) — for the disliked-zone guard
// ---------------------------------------------------------------------------

export interface Hct {
  hue: number;
  chroma: number;
  tone: number;
}

function srgbToLinear100(channel: number): number {
  const s = channel / 255;
  return s <= 0.040449936 ? (s / 12.92) * 100 : Math.pow((s + 0.055) / 1.055, 2.4) * 100;
}

function xyzFromRgb(rgb: Rgb): Oklch {
  const [r, g, b] = rgb;
  const rl = srgbToLinear100(r);
  const gl = srgbToLinear100(g);
  const bl = srgbToLinear100(b);
  return [
    rl * 0.41233895 + gl * 0.35762064 + bl * 0.18051042,
    rl * 0.2126 + gl * 0.7152 + bl * 0.0722,
    rl * 0.01932141 + gl * 0.11916382 + bl * 0.95034478,
  ];
}

function yFromLstar(lstar: number): number {
  const ft = (lstar + 16) / 116;
  const ft3 = ft * ft * ft;
  const epsilon = 216 / 24389;
  return 100 * (ft3 > epsilon ? ft3 : (116 * ft - 16) / (24389 / 27));
}

function lstarFromY(y: number): number {
  const yn = y / 100;
  const epsilon = 216 / 24389;
  const f = yn > epsilon ? Math.cbrt(yn) : ((24389 / 27) * yn + 16) / 116;
  return 116 * f - 16;
}

interface ViewingConditions {
  rgbD: Oklch;
  fl: number;
  n: number;
  z: number;
  nbb: number;
  ncb: number;
  c: number;
  nc: number;
  aw: number;
}

function makeDefaultViewingConditions(): ViewingConditions {
  const whitePoint: Oklch = [95.047, 100.0, 108.883];
  const [wx, wy, wz] = whitePoint;
  const adaptingLuminance = ((200 / Math.PI) * yFromLstar(50)) / 100;
  const surround = 2;

  const rW = wx * 0.401288 + wy * 0.650173 + wz * -0.051461;
  const gW = wx * -0.250268 + wy * 1.204414 + wz * 0.045854;
  const bW = wx * -0.002079 + wy * 0.048952 + wz * 0.953127;

  const f = 0.8 + surround / 10;
  const c = f >= 0.9 ? 0.59 + (0.69 - 0.59) * ((f - 0.9) * 10) : 0.525 + (0.59 - 0.525) * ((f - 0.8) * 10);
  let d = f * (1 - (1 / 3.6) * Math.exp((-adaptingLuminance - 42) / 92));
  d = d > 1 ? 1 : d < 0 ? 0 : d;
  const nc = f;

  const rgbD: Oklch = [
    d * (100 / rW) + 1 - d,
    d * (100 / gW) + 1 - d,
    d * (100 / bW) + 1 - d,
  ];
  const k = 1 / (5 * adaptingLuminance + 1);
  const k4 = k * k * k * k;
  const k4F = 1 - k4;
  const fl = k4 * adaptingLuminance + 0.1 * k4F * k4F * Math.cbrt(5 * adaptingLuminance);
  const n = yFromLstar(50) / wy;
  const z = 1.48 + Math.sqrt(n);
  const nbb = 0.725 / Math.pow(n, 0.2);
  const ncb = nbb;

  const [dr, dg, db] = rgbD;
  const rAF = Math.pow((fl * dr * rW) / 100, 0.42);
  const gAF = Math.pow((fl * dg * gW) / 100, 0.42);
  const bAF = Math.pow((fl * db * bW) / 100, 0.42);
  const rA = (400 * rAF) / (rAF + 27.13);
  const gA = (400 * gAF) / (gAF + 27.13);
  const bA = (400 * bAF) / (bAF + 27.13);
  const aw = (2 * rA + gA + 0.05 * bA) * nbb;

  return { rgbD, fl, n, z, nbb, ncb, c, nc, aw };
}

const VIEWING_CONDITIONS = makeDefaultViewingConditions();

export function hctFromRgb(rgb: Rgb): Hct {
  const vc = VIEWING_CONDITIONS;
  const [x, y, zc] = xyzFromRgb(rgb);

  const rC = 0.401288 * x + 0.650173 * y - 0.051461 * zc;
  const gC = -0.250268 * x + 1.204414 * y + 0.045854 * zc;
  const bC = -0.002079 * x + 0.048952 * y + 0.953127 * zc;

  const [dr, dg, db] = vc.rgbD;
  const rD = dr * rC;
  const gD = dg * gC;
  const bD = db * bC;

  const rAF = Math.pow((vc.fl * Math.abs(rD)) / 100, 0.42);
  const gAF = Math.pow((vc.fl * Math.abs(gD)) / 100, 0.42);
  const bAF = Math.pow((vc.fl * Math.abs(bD)) / 100, 0.42);
  const rA = (Math.sign(rD) * 400 * rAF) / (rAF + 27.13);
  const gA = (Math.sign(gD) * 400 * gAF) / (gAF + 27.13);
  const bA = (Math.sign(bD) * 400 * bAF) / (bAF + 27.13);

  const a = (11 * rA - 12 * gA + bA) / 11;
  const b = (rA + gA - 2 * bA) / 9;
  const u = (20 * rA + 20 * gA + 21 * bA) / 20;
  const p2 = (40 * rA + 20 * gA + bA) / 20;

  const atanDegrees = (Math.atan2(b, a) * 180) / Math.PI;
  const hue = atanDegrees < 0 ? atanDegrees + 360 : atanDegrees >= 360 ? atanDegrees - 360 : atanDegrees;

  const ac = p2 * vc.nbb;
  const j = 100 * Math.pow(ac / vc.aw, vc.c * vc.z);

  const huePrime = hue < 20.14 ? hue + 360 : hue;
  const eHue = 0.25 * (Math.cos((huePrime * Math.PI) / 180 + 2) + 3.8);
  const p1 = (50000 / 13) * eHue * vc.nc * vc.ncb;
  const t = (p1 * Math.hypot(a, b)) / (u + 0.305);
  const alpha = Math.pow(t, 0.9) * Math.pow(1.64 - Math.pow(0.29, vc.n), 0.73);
  const chroma = alpha * Math.sqrt(j / 100);

  return { hue, chroma, tone: lstarFromY(y) };
}

export function hctFromHex(hex: string): Hct {
  return hctFromRgb(hexToRgb(hex));
}

/** Disliked dark yellow-green HCT band (§17.1). */
export const DISLIKED_ZONE = {
  hueMin: 90,
  hueMax: 111,
  chromaMin: 16,
  toneMax: 65,
} as const;

export function isInDislikedZone(hex: string): boolean {
  const { hue, chroma, tone } = hctFromHex(hex);
  return (
    hue >= DISLIKED_ZONE.hueMin &&
    hue <= DISLIKED_ZONE.hueMax &&
    chroma > DISLIKED_ZONE.chromaMin &&
    tone < DISLIKED_ZONE.toneMax
  );
}

// ---------------------------------------------------------------------------
// Ramp definitions & generation
// ---------------------------------------------------------------------------

/** The 50→900 scale: fixed OKLCH lightness targets per step. */
const RAMP_SCALE = [
  { step: 50, l: 0.972 },
  { step: 100, l: 0.93 },
  { step: 200, l: 0.855 },
  { step: 300, l: 0.775 },
  { step: 400, l: 0.685 },
  { step: 500, l: 0.585 },
  { step: 600, l: 0.505 },
  { step: 700, l: 0.425 },
  { step: 800, l: 0.345 },
  { step: 900, l: 0.265 },
] as const;

export const RAMP_STEPS = RAMP_SCALE.map((s) => s.step);

/**
 * The five seeds (§17.1). Blue = primary/function, Sand = light ground,
 * Ink = warm-neutral text/dark surface, Terracotta = peaks only, Jade = positive.
 */
export const SEEDS = {
  blue: '#2563EB',
  sand: '#FAF7F2',
  ink: '#1C1917',
  terracotta: '#C2410C',
  jade: '#047857',
} as const;

export type SeedName = keyof typeof SEEDS;

export interface RampColor {
  step: number;
  hex: string;
  l: number;
  c: number;
  h: number;
  luminance: number;
  inGamut: boolean;
  dislikedZone: boolean;
}

export function generateRamp(seedHex: string): RampColor[] {
  const [, seedChroma, seedHue] = rgbToOklch(hexToRgb(seedHex));
  return RAMP_SCALE.map(({ step, l }) => {
    const c = clampChromaToGamut(l, seedChroma, seedHue);
    const hex = oklchToHex([l, c, seedHue]);
    return {
      step,
      hex,
      l,
      c,
      h: seedHue,
      luminance: relativeLuminance(hex),
      inGamut: oklchInSrgbGamut([l, c, seedHue]),
      dislikedZone: isInDislikedZone(hex),
    };
  });
}

export function generateRamps(): Record<SeedName, RampColor[]> {
  const out = {} as Record<SeedName, RampColor[]>;
  for (const name of Object.keys(SEEDS) as SeedName[]) {
    out[name] = generateRamp(SEEDS[name]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pin-category ramp (CVD lightness separation between adjacent categories)
// ---------------------------------------------------------------------------

/** Category order (matches contracts `map.pins.anchors`); adjacency matters. */
export const PIN_ORDER = ['photo', 'viewpoint', 'art', 'history', 'museum', 'food'] as const;
export type PinCategory = (typeof PIN_ORDER)[number];

/**
 * Target OKLCH lightness per category, arranged as a zig-zag so that every
 * adjacent pair is separated in lightness (CVD users distinguish neighbours by
 * lightness, not hue alone). Hue and chroma come from each anchor.
 */
const PIN_LIGHTNESS: Record<PinCategory, number> = {
  photo: 0.7,
  viewpoint: 0.52,
  art: 0.78,
  history: 0.45,
  museum: 0.63,
  food: 0.38,
};

/** Minimum required OKLCH-lightness gap between adjacent pin categories. */
export const PIN_MIN_LIGHTNESS_GAP = 0.12;

export interface PinColor {
  category: PinCategory;
  hex: string;
  l: number;
  c: number;
  h: number;
  luminance: number;
  inGamut: boolean;
  dislikedZone: boolean;
}

export function generatePinRamp(anchors: Readonly<Record<string, string>>): PinColor[] {
  return PIN_ORDER.map((category) => {
    const anchorHex = anchors[category];
    if (!anchorHex) throw new Error(`Missing pin anchor for category "${category}"`);
    const [, anchorChroma, anchorHue] = rgbToOklch(hexToRgb(anchorHex));
    const l = PIN_LIGHTNESS[category];
    const c = clampChromaToGamut(l, anchorChroma, anchorHue);
    const hex = oklchToHex([l, c, anchorHue]);
    return {
      category,
      hex,
      l,
      c,
      h: anchorHue,
      luminance: relativeLuminance(hex),
      inGamut: oklchInSrgbGamut([l, c, anchorHue]),
      dislikedZone: isInDislikedZone(hex),
    };
  });
}

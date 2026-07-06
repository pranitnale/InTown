import { describe, it, expect } from 'vitest';
import designTokens from '@intown/contracts/design-tokens.json';
import {
  generateRamps,
  generateRamp,
  generatePinRamp,
  hctFromHex,
  isInDislikedZone,
  oklchInSrgbGamut,
  rgbToOklch,
  hexToRgb,
  SEEDS,
  RAMP_STEPS,
  PIN_ORDER,
  PIN_MIN_LIGHTNESS_GAP,
  DISLIKED_ZONE,
} from '../scripts/oklch.mts';

/**
 * P01 AC #3 — OKLCH ramps generated from the five seeds: every color is
 * sRGB-gamut-valid, none in the disliked dark yellow-green HCT zone, ramps are
 * monotonic in lightness, and generation is deterministic.
 */

const HEX_RE = /^#[0-9A-F]{6}$/;
const pinAnchors = designTokens.map.pins.anchors as Record<string, string>;

describe('HCT model (validation against Material Color Utilities reference values)', () => {
  // Published reference values; proves the disliked-zone guard uses a real HCT.
  const cases: ReadonlyArray<[string, number, number, number]> = [
    ['#FF0000', 27.41, 113.36, 53.24],
    ['#00FF00', 142.14, 108.41, 87.74],
    ['#0000FF', 282.79, 87.23, 32.3],
  ];
  for (const [hex, hue, chroma, tone] of cases) {
    it(`${hex} matches reference H/C/T`, () => {
      const hct = hctFromHex(hex);
      expect(hct.hue).toBeCloseTo(hue, 1);
      expect(hct.chroma).toBeCloseTo(chroma, 1);
      expect(hct.tone).toBeCloseTo(tone, 1);
    });
  }
});

describe('disliked-zone guard', () => {
  it('flags a color squarely inside the zone', () => {
    // #5A5406 → HCT hue ~106, chroma ~36, tone ~35: dark yellow-green.
    const hct = hctFromHex('#5A5406');
    expect(hct.hue).toBeGreaterThanOrEqual(DISLIKED_ZONE.hueMin);
    expect(hct.hue).toBeLessThanOrEqual(DISLIKED_ZONE.hueMax);
    expect(hct.chroma).toBeGreaterThan(DISLIKED_ZONE.chromaMin);
    expect(hct.tone).toBeLessThan(DISLIKED_ZONE.toneMax);
    expect(isInDislikedZone('#5A5406')).toBe(true);
  });

  it('does not flag the InTown seeds', () => {
    for (const hex of Object.values(SEEDS)) {
      expect(isInDislikedZone(hex)).toBe(false);
    }
  });
});

describe('OKLCH seed ramps', () => {
  const ramps = generateRamps();
  const seedNames = Object.keys(SEEDS) as (keyof typeof SEEDS)[];

  it('produces a full 50→900 ramp per seed', () => {
    for (const seed of seedNames) {
      expect(ramps[seed].map((c) => c.step)).toEqual(RAMP_STEPS);
    }
  });

  it('every generated color is a valid hex and sRGB-gamut-valid', () => {
    for (const seed of seedNames) {
      for (const color of ramps[seed]) {
        expect(color.hex).toMatch(HEX_RE);
        expect(color.inGamut).toBe(true);
        expect(oklchInSrgbGamut([color.l, color.c, color.h])).toBe(true);
      }
    }
  });

  it('no generated color falls in the disliked yellow-green zone', () => {
    for (const seed of seedNames) {
      for (const color of ramps[seed]) {
        expect(color.dislikedZone).toBe(false);
        expect(isInDislikedZone(color.hex)).toBe(false);
      }
    }
  });

  it('is monotonically decreasing in lightness (50 = lightest, 900 = darkest)', () => {
    for (const seed of seedNames) {
      const ramp = ramps[seed];
      // OKLCH lightness targets strictly decrease.
      for (let i = 1; i < ramp.length; i++) {
        expect(ramp[i]!.l).toBeLessThan(ramp[i - 1]!.l);
      }
      // Observed relative luminance of the output hex strictly decreases too.
      for (let i = 1; i < ramp.length; i++) {
        expect(ramp[i]!.luminance).toBeLessThan(ramp[i - 1]!.luminance);
      }
    }
  });

  it('is deterministic (same input → byte-identical output)', () => {
    expect(generateRamps()).toEqual(ramps);
    expect(generateRamp(SEEDS.blue)).toEqual(ramps.blue);
  });
});

describe('pin-category ramp', () => {
  const pins = generatePinRamp(pinAnchors);

  it('covers every category in order', () => {
    expect(pins.map((p) => p.category)).toEqual([...PIN_ORDER]);
  });

  it('every pin color is valid hex, in-gamut, and not in the disliked zone', () => {
    for (const pin of pins) {
      expect(pin.hex).toMatch(HEX_RE);
      expect(pin.inGamut).toBe(true);
      expect(pin.dislikedZone).toBe(false);
    }
  });

  it('separates adjacent categories in lightness (CVD legibility)', () => {
    for (let i = 1; i < pins.length; i++) {
      const prev = rgbToOklch(hexToRgb(pins[i - 1]!.hex))[0];
      const curr = rgbToOklch(hexToRgb(pins[i]!.hex))[0];
      expect(Math.abs(curr - prev)).toBeGreaterThanOrEqual(PIN_MIN_LIGHTNESS_GAP);
    }
  });

  it('is deterministic', () => {
    expect(generatePinRamp(pinAnchors)).toEqual(pins);
  });
});

import { describe, it, expect } from 'vitest';
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import designTokens from '@intown/contracts/design-tokens.json';

/**
 * §17.9 contrast-assertion test. For EVERY declared text/UI color pair, recompute
 *   (a) the WCAG 2.2 relative-luminance contrast ratio (spec formula inline), and
 *   (b) the APCA-4g Lc via the apca-w3 package (|APCAcontrast(sRGBtoY(...))|),
 * and assert each meets its role floor from `roleFloors`. We assert against the
 * declared floors only — never the PRD prose Lc values. APCA is skipped when the
 * role's apcaLc floor is null (non-text UI).
 */

type Mode = 'light' | 'dark';
type Rgb = [number, number, number];

const palettes: Record<Mode, Record<string, string>> = {
  light: designTokens.light,
  dark: designTokens.dark,
};
const roleFloors = designTokens.roleFloors as Record<
  string,
  { wcag: number; apcaLc: number | null }
>;
const pairs = designTokens.pairs as unknown as ReadonlyArray<{
  id: string;
  mode: Mode;
  fg: string;
  bg: string;
  role: string;
}>;

function resolveColor(mode: Mode, name: string): string {
  const value = palettes[mode][name];
  if (typeof value !== 'string') {
    throw new Error(`Token "${name}" not found in ${mode} palette`);
  }
  return value;
}

function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  const digits = m?.[1];
  if (!digits) throw new Error(`Expected 6-digit hex color, got "${hex}"`);
  const int = parseInt(digits, 16);
  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
}

// WCAG 2.2 relative luminance (sRGB, D65) — https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function wcagRatio(fg: Rgb, bg: Rgb): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function apcaLc(fg: Rgb, bg: Rgb): number {
  return Math.abs(APCAcontrast(sRGBtoY(fg), sRGBtoY(bg)));
}

describe('§17.9 token contrast floors', () => {
  it('declares at least one pair', () => {
    expect(pairs.length).toBeGreaterThan(0);
  });

  for (const pair of pairs) {
    it(`${pair.id} (${pair.role}) meets its floor`, () => {
      const floor = roleFloors[pair.role];
      if (!floor) throw new Error(`unknown role "${pair.role}" for pair ${pair.id}`);

      const fg = hexToRgb(resolveColor(pair.mode, pair.fg));
      const bg = hexToRgb(resolveColor(pair.mode, pair.bg));

      const ratio = wcagRatio(fg, bg);
      expect(
        ratio,
        `${pair.id}: WCAG ${ratio.toFixed(2)}:1 < floor ${floor.wcag}:1`,
      ).toBeGreaterThanOrEqual(floor.wcag);

      if (floor.apcaLc !== null) {
        const lc = apcaLc(fg, bg);
        expect(
          lc,
          `${pair.id}: APCA Lc ${lc.toFixed(1)} < floor ${floor.apcaLc}`,
        ).toBeGreaterThanOrEqual(floor.apcaLc);
      }
    });
  }
});

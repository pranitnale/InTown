import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/**
 * Structural well-formedness of `design-tokens.json` (P00 AC #2, §17.9). This is
 * NOT the contrast-assertion test (that lives in frontend CI and recomputes WCAG
 * + APCA on every pair); here we only assert the data shape the frontend contrast
 * test depends on: every pair references existing token keys in its mode palette,
 * `roleFloors` is complete, and every pair carries a valid role.
 */

const tokens = JSON.parse(
  readFileSync(fileURLToPath(new URL('../design-tokens.json', import.meta.url)), 'utf8'),
) as {
  light: Record<string, string>;
  dark: Record<string, string>;
  map: { routes: Record<string, unknown>; pins: { placeholder: boolean } };
  pairs: Array<{ id: string; mode: 'light' | 'dark'; fg: string; bg: string; role: string }>;
  roleFloors: Record<string, { wcag: number; apcaLc: number | null }>;
};

const ROLES = ['body', 'large', 'nonText'] as const;

describe('design-tokens.json', () => {
  it('has light + dark palettes and a placeholder pin ramp', () => {
    expect(Object.keys(tokens.light).length).toBeGreaterThan(0);
    expect(Object.keys(tokens.dark).length).toBeGreaterThan(0);
    expect(tokens.map.pins.placeholder).toBe(true);
  });

  it('roleFloors is complete (body / large / nonText)', () => {
    for (const role of ROLES) {
      expect(tokens.roleFloors[role]).toBeDefined();
      expect(typeof tokens.roleFloors[role]!.wcag).toBe('number');
      const lc = tokens.roleFloors[role]!.apcaLc;
      expect(lc === null || typeof lc === 'number').toBe(true);
    }
  });

  it('every pair has a valid role and references existing token keys in its mode', () => {
    expect(tokens.pairs.length).toBeGreaterThan(0);
    for (const pair of tokens.pairs) {
      expect(ROLES).toContain(pair.role as (typeof ROLES)[number]);
      expect(pair.mode === 'light' || pair.mode === 'dark').toBe(true);
      const palette = tokens[pair.mode];
      expect(palette[pair.fg], `${pair.id} fg=${pair.fg}`).toBeDefined();
      expect(palette[pair.bg], `${pair.id} bg=${pair.bg}`).toBeDefined();
    }
  });

  it('every hex token in each palette is a valid #RRGGBB string', () => {
    for (const mode of ['light', 'dark'] as const) {
      for (const [key, value] of Object.entries(tokens[mode])) {
        expect(/^#[0-9A-Fa-f]{6}$/.test(value), `${mode}.${key}=${value}`).toBe(true);
      }
    }
  });
});

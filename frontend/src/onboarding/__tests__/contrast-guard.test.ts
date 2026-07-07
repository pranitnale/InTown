import { describe, it, expect } from 'vitest';

/**
 * §17.9 guard-by-construction (AC #8). Every color in the onboarding module
 * comes from a token-backed Tailwind utility (bg-*, text-*, border-*, ring-*,
 * accent-*), so the declared token pairs that `tests/contrast.test.ts` recomputes
 * against the WCAG/APCA floors cover these components too. This test proves the
 * premise: NO raw hex color literal appears in any onboarding source file.
 */

const HEX = /#[0-9a-fA-F]{3,8}\b/;

const rawModules = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sources = Object.entries(rawModules).filter(([path]) => !path.includes('__tests__'));

describe('§17.9 no raw hex in onboarding sources', () => {
  it('scans the module sources', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  for (const [path, source] of sources) {
    it(`${path} uses only token utilities (no hex)`, () => {
      const offenders = source
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => HEX.test(line));
      expect(offenders, offenders.map((o) => `L${o.n}: ${o.line.trim()}`).join('\n')).toHaveLength(0);
    });
  }
});

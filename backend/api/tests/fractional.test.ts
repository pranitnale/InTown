import { describe, expect, it } from 'vitest';
import {
  DIGITS,
  isValidKey,
  jitter,
  keyAfter,
  keyBefore,
  keyBetween,
  needsRebalance,
  rebalanceKeys,
} from '../src/ordering/fractional.ts';

/**
 * P06 AC5 (pure half) — the base62 midpoint fractional-index utility. No DB: this
 * pins the ordering invariants of `keyBetween` and that same-slot jittered
 * generations (with the retry the handler uses) never collide. The DB half —
 * "patch writes only the moved row", the 23505 retry path, and rebalance
 * shortening keys — lives in places.ordering.test.ts.
 *
 * Keys are compared with plain JS string `<`, which for this ASCII alphabet is
 * codepoint order — exactly what `ORDER BY position COLLATE "C"` yields in SQL.
 */

const ZERO = DIGITS[0]!;

describe('keyBetween ordering invariants (AC5)', () => {
  it('an unbounded generation is a single valid non-zero-terminated digit', () => {
    const k = keyBetween(null, null);
    expect(isValidKey(k)).toBe(true);
    expect(k.endsWith(ZERO)).toBe(false);
  });

  it('keyAfter sorts strictly after, keyBefore strictly before', () => {
    const mid = keyBetween(null, null);
    const after = keyAfter(mid);
    const before = keyBefore(mid);
    expect(before < mid).toBe(true);
    expect(mid < after).toBe(true);
    expect(isValidKey(after)).toBe(true);
    expect(isValidKey(before)).toBe(true);
  });

  it('keyBetween returns a valid key strictly between its bounds', () => {
    const a = keyBetween(null, null);
    const b = keyAfter(a);
    const mid = keyBetween(a, b);
    expect(a < mid && mid < b).toBe(true);
    expect(isValidKey(mid)).toBe(true);
  });

  it('rejects an inverted or equal range', () => {
    const a = keyBetween(null, null);
    const b = keyAfter(a);
    expect(() => keyBetween(b, a)).toThrow();
    expect(() => keyBetween(a, a)).toThrow();
  });

  it('rejects an illegal bound (empty, out-of-alphabet, or trailing zero)', () => {
    expect(() => keyBetween('A0', null)).toThrow(); // trailing minimum digit
    expect(() => keyBetween('', null)).toThrow();
    expect(() => keyBetween('A!', null)).toThrow();
    expect(isValidKey('A0')).toBe(false);
    expect(isValidKey('')).toBe(false);
    expect(isValidKey('A!')).toBe(false);
    expect(isValidKey('a0V')).toBe(true);
  });

  it('stays sorted, unique, and valid under randomized inserts (500 rounds)', () => {
    const list: string[] = [keyBetween(null, null)];
    for (let round = 0; round < 500; round += 1) {
      const i = Math.floor(Math.random() * (list.length + 1));
      const lo = i === 0 ? null : list[i - 1]!;
      const hi = i === list.length ? null : list[i]!;
      const k = keyBetween(lo, hi);
      if (lo !== null) expect(lo < k).toBe(true);
      if (hi !== null) expect(k < hi).toBe(true);
      expect(isValidKey(k)).toBe(true);
      list.splice(i, 0, k);
    }
    const sorted = [...list].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    expect(list).toEqual(sorted);
    expect(new Set(list).size).toBe(list.length);
  });

  it('keys grow but stay valid when a gap is bisected repeatedly', () => {
    // Repeatedly insert just above a fixed lower bound (upper bound closes in each
    // round). This is the pattern that lengthens keys and, at scale, trips the
    // rebalance backstop the handlers apply.
    const lo = keyBetween(null, null);
    let hi = keyAfter(lo);
    let maxLen = 0;
    for (let n = 0; n < 120; n += 1) {
      const k = keyBetween(lo, hi);
      expect(lo < k && k < hi).toBe(true);
      expect(isValidKey(k)).toBe(true);
      maxLen = Math.max(maxLen, k.length);
      hi = k; // narrow the gap → keys lengthen
    }
    expect(maxLen).toBeGreaterThan(5); // keys demonstrably grew from length 1
  });

  it('needsRebalance fires only past the length threshold', () => {
    expect(needsRebalance('a'.repeat(40))).toBe(false);
    expect(needsRebalance('a'.repeat(41))).toBe(true);
  });
});

describe('jitter (AC5)', () => {
  it('appends 1–2 non-zero digits, keeping the key valid and sorted after its base', () => {
    for (let i = 0; i < 200; i += 1) {
      const base = keyBetween(null, null);
      const j = jitter(base);
      expect(j.startsWith(base)).toBe(true);
      expect(j.length - base.length).toBeGreaterThanOrEqual(1);
      expect(j.length - base.length).toBeLessThanOrEqual(2);
      expect(isValidKey(j)).toBe(true);
      expect(base < j).toBe(true); // appended → sorts after the base prefix
    }
  });

  it('200 same-slot generations are collision-free with the retry the handler uses', () => {
    // Mirrors add/patch: jitter an append key, and on a clash re-jitter (the DB's
    // unique-index + retry, modelled here with an in-memory taken set). The loop
    // always converges because a re-jitter only ever extends the key.
    const base = keyAfter(keyBetween(null, null));
    const taken = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      let k = jitter(base);
      while (taken.has(k)) k = jitter(k);
      expect(isValidKey(k)).toBe(true);
      expect(base < k).toBe(true);
      taken.add(k);
    }
    expect(taken.size).toBe(200);
  });
});

describe('rebalanceKeys (AC5)', () => {
  it('returns count short, strictly increasing, valid keys', () => {
    for (const count of [1, 2, 3, 10, 61, 62, 100, 500]) {
      const keys = rebalanceKeys(count);
      expect(keys).toHaveLength(count);
      for (const k of keys) {
        expect(isValidKey(k)).toBe(true);
        expect(k.length).toBeLessThanOrEqual(4); // short — the whole point of a rebalance
      }
      for (let i = 1; i < keys.length; i += 1) expect(keys[i - 1]! < keys[i]!).toBe(true);
      expect(new Set(keys).size).toBe(count);
    }
  });

  it('returns an empty list for a non-positive count', () => {
    expect(rebalanceKeys(0)).toEqual([]);
    expect(rebalanceKeys(-5)).toEqual([]);
  });
});

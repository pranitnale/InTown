import { describe, it, expect } from 'vitest';
import {
  addKid,
  emptyCompanions,
  hasKids,
  removeKid,
  setAdults,
  setKidAge,
  toggleAdultAgeBand,
  travelerCount,
} from '../logic/companions.ts';

describe('companions model (AC #2)', () => {
  it('starts with one adult, no kids, no age bands', () => {
    expect(emptyCompanions()).toEqual({ adults: 1, kids: [], adultAgeBands: [] });
  });

  it('clamps the adult count to at least 1', () => {
    expect(setAdults(emptyCompanions(), 0).adults).toBe(1);
    expect(setAdults(emptyCompanions(), 4).adults).toBe(4);
  });

  it('adds, edits, and removes kids with a clamped 0–17 age', () => {
    let s = addKid(emptyCompanions(), 25); // clamps to 17
    expect(s.kids).toEqual([17]);
    s = addKid(s, -3); // clamps to 0
    expect(s.kids).toEqual([17, 0]);
    s = setKidAge(s, 1, 9);
    expect(s.kids).toEqual([17, 9]);
    s = removeKid(s, 0);
    expect(s.kids).toEqual([9]);
    // out-of-range ops are no-ops
    expect(removeKid(s, 5)).toBe(s);
  });

  it('is immutable — helpers never mutate the input', () => {
    const s0 = emptyCompanions();
    addKid(s0, 5);
    expect(s0.kids).toEqual([]);
  });

  it('toggles adult age bands on and off (skippable, never a cap)', () => {
    let s = toggleAdultAgeBand(emptyCompanions(), '65+');
    expect(s.adultAgeBands).toEqual(['65+']);
    s = toggleAdultAgeBand(s, '65+');
    expect(s.adultAgeBands).toEqual([]);
  });

  it('reports family mode + total head count', () => {
    expect(hasKids(emptyCompanions())).toBe(false);
    const family = addKid(setAdults(emptyCompanions(), 2), 8);
    expect(hasKids(family)).toBe(true);
    expect(travelerCount(family)).toBe(3);
  });
});

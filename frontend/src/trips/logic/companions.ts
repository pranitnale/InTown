import type { AgeBand } from '@intown/contracts/types';

/**
 * Companions model (§6.4). Pure, DOM-free, unit-tested. Collects who is
 * travelling — adults, kids (by age, for ticket pricing & pacing), and the
 * adults' age bands. Age bands are SKIPPABLE and never a cap: selecting one
 * pre-selects an editable pace preset (`pacePresetFor`) that the pace step
 * shows and the plan-shaping feedback reflects, and which the user can freely
 * change to any pace (§6.2 anti-ageism law). See {@link activeAgeBand}.
 */
export interface CompanionsState {
  /** Number of adults on the trip (at least 1 — the traveller themselves). */
  adults: number;
  /** Ages of accompanying kids, in years. Presence drives "family mode". */
  kids: number[];
  /** Optional adult age bands — helps with ticket prices & pacing, skippable. */
  adultAgeBands: AgeBand[];
}

export function emptyCompanions(): CompanionsState {
  return { adults: 1, kids: [], adultAgeBands: [] };
}

/** Set the adult count, clamped to at least 1. */
export function setAdults(state: CompanionsState, adults: number): CompanionsState {
  return { ...state, adults: Math.max(1, Math.floor(adults)) };
}

/** Add a kid with the given age (clamped to a sane 0–17 range). */
export function addKid(state: CompanionsState, age: number): CompanionsState {
  const clamped = Math.min(17, Math.max(0, Math.floor(age)));
  return { ...state, kids: [...state.kids, clamped] };
}

/** Remove the kid at `index` (no-op if out of range). */
export function removeKid(state: CompanionsState, index: number): CompanionsState {
  if (index < 0 || index >= state.kids.length) return state;
  return { ...state, kids: state.kids.filter((_, i) => i !== index) };
}

/** Set the age of the kid at `index` (clamped 0–17; no-op if out of range). */
export function setKidAge(state: CompanionsState, index: number, age: number): CompanionsState {
  if (index < 0 || index >= state.kids.length) return state;
  const clamped = Math.min(17, Math.max(0, Math.floor(age)));
  return { ...state, kids: state.kids.map((a, i) => (i === index ? clamped : a)) };
}

/**
 * The age band currently driving the (editable) pace suggestion — the most
 * recently selected band, or null when none is selected. Feeds
 * `pacePresetFor` / `pacePresetReason` so the pace step pre-selects an editable
 * default with a stated "starting point" reason (§6.2 — a suggestion, never a
 * cap).
 */
export function activeAgeBand(state: CompanionsState): AgeBand | null {
  const bands = state.adultAgeBands;
  return bands.length > 0 ? (bands[bands.length - 1] ?? null) : null;
}

/** Toggle an adult age band on/off (skippable chips). */
export function toggleAdultAgeBand(state: CompanionsState, band: AgeBand): CompanionsState {
  const present = state.adultAgeBands.includes(band);
  return {
    ...state,
    adultAgeBands: present
      ? state.adultAgeBands.filter((b) => b !== band)
      : [...state.adultAgeBands, band],
  };
}

/** True when any kids are travelling — the "family mode" trigger. */
export function hasKids(state: CompanionsState): boolean {
  return state.kids.length > 0;
}

/** Total heads on the trip (adults + kids). */
export function travelerCount(state: CompanionsState): number {
  return state.adults + state.kids.length;
}

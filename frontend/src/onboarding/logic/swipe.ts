import { INTEREST_CARDS, cardOrderIndex } from './interests.ts';

/**
 * Photo-swipe taste elicitation (AC #6).
 *
 * Swipes are CHOICE-based (beats star ratings for cold start): each card is
 * answered `pass` / `like` / `love`, which INITIALIZES a soft interest weight:
 *   pass → 0, like → 1, love → 2.
 * Only survivors (weight ≥ 1) advance to the drag-rank step.
 *
 * Weight↔rank serialization (the crux of AC #6 — no invented contract field):
 *  - weights → interests[] : take survivors (weight ≥ 1), sort by weight DESC,
 *    break ties by the fixed deck order ({@link cardOrderIndex}). The resulting
 *    array order IS the ranking (most-preferred first) the contract stores.
 *  - interests[] → weights : `weight(tag) = interests.length - index`, so rank 0
 *    maps to the highest weight and the mapping is strictly monotonic. This
 *    rehydrates a stored profile back into an editable soft-weight model with no
 *    extra persisted field — the ordered `interests[]` is the sole source.
 */

export type SwipeVerdict = 'pass' | 'like' | 'love';

export const SWIPE_WEIGHT: Record<SwipeVerdict, number> = {
  pass: 0,
  like: 1,
  love: 2,
};

/** Accumulated soft weights, keyed by interest tag. */
export type WeightMap = Readonly<Record<string, number>>;

/** Record a verdict for one card, returning a new immutable weight map. */
export function applySwipe(weights: WeightMap, tag: string, verdict: SwipeVerdict): WeightMap {
  return { ...weights, [tag]: SWIPE_WEIGHT[verdict] };
}

/** Tags that survived the swipe round (weight ≥ 1), unordered. */
export function survivors(weights: WeightMap): string[] {
  return Object.keys(weights).filter((tag) => (weights[tag] ?? 0) >= 1);
}

/**
 * Serialize soft weights → the ranked `interests[]` the contract stores.
 * Survivors only, weight DESC, deck-order tie-break.
 */
export function weightsToInterests(weights: WeightMap): string[] {
  return survivors(weights).sort((a, b) => {
    const wa = weights[a] ?? 0;
    const wb = weights[b] ?? 0;
    if (wb !== wa) return wb - wa;
    return cardOrderIndex(a) - cardOrderIndex(b);
  });
}

/**
 * Rehydrate a stored ranked `interests[]` → soft weights. Rank 0 → highest
 * weight (`length`), strictly decreasing. Inverse of {@link weightsToInterests}
 * up to rank order (the only thing the contract preserves).
 */
export function interestsToWeights(interests: readonly string[]): WeightMap {
  const out: Record<string, number> = {};
  const n = interests.length;
  interests.forEach((tag, i) => {
    out[tag] = n - i;
  });
  return out;
}

/** A fresh deck order (deck is the declared card order). */
export function freshDeck(): string[] {
  return INTEREST_CARDS.map((c) => c.tag);
}

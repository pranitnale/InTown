import type { Category } from '@intown/contracts/types';

/**
 * P05 client-side interest taxonomy — the SINGLE source of truth mapping
 * photo-swipe cards to interest tag strings.
 *
 * The contract stores interests as a free-form `string[]` (there is no canonical
 * interest enum in `contracts/`), so every tag the UI can produce is declared
 * exactly once here to prevent casing/typo drift. Tags reuse the fixture
 * vocabulary (`architecture`, `coffee`, …); each card also carries the coherent
 * `contracts` {@link Category} it seeds from, so downstream category-aware code
 * can relate a tag back to the unified taxonomy. The PERSISTED value is still a
 * plain lower-snake string — the category is metadata, never serialized.
 */
export interface InterestCard {
  /** The stored interest tag (lower_snake_case). One source of truth. */
  readonly tag: string;
  /** Human label shown on the swipe card. */
  readonly label: string;
  /** One-line "into this?" blurb. */
  readonly blurb: string;
  /** Coherent seed category from the unified `contracts` enum. */
  readonly category: Category;
}

/**
 * 14 cards (spec: 10–15). Order here is the STABLE tie-break order used when
 * serializing equal-weight survivors, so the deck order is deterministic.
 */
export const INTEREST_CARDS: readonly InterestCard[] = [
  { tag: 'architecture', label: 'Architecture', blurb: 'Historic facades and bold buildings', category: 'SIGHT' },
  { tag: 'history', label: 'History', blurb: 'Old towns, ruins and the stories behind them', category: 'SIGHT' },
  { tag: 'museums', label: 'Museums', blurb: 'Galleries and collections worth the time', category: 'MUSEUM' },
  { tag: 'viewpoints', label: 'Viewpoints', blurb: 'Rooftops and lookouts over the city', category: 'VIEWPOINT' },
  { tag: 'parks', label: 'Parks & nature', blurb: 'Green space and a slower pace', category: 'PARK_NATURE' },
  { tag: 'riverside_walks', label: 'Riverside walks', blurb: 'Waterfront strolls', category: 'PARK_NATURE' },
  { tag: 'street_art', label: 'Street art', blurb: 'Murals and neighbourhood character', category: 'OTHER' },
  { tag: 'live_music', label: 'Live music', blurb: 'Gigs, jazz bars and venues', category: 'ENTERTAINMENT' },
  { tag: 'nightlife', label: 'Nightlife', blurb: 'Bars and late nights out', category: 'NIGHTLIFE' },
  { tag: 'shopping', label: 'Shopping', blurb: 'Markets, boutiques and design stores', category: 'SHOPPING' },
  { tag: 'food', label: 'Food', blurb: 'Local dishes and where to find them', category: 'RESTAURANT' },
  { tag: 'fine_dining', label: 'Fine dining', blurb: 'Standout tables worth booking', category: 'RESTAURANT' },
  { tag: 'cheap_eats', label: 'Cheap eats', blurb: 'Great value, no fuss', category: 'RESTAURANT' },
  { tag: 'coffee', label: 'Coffee', blurb: 'Specialty roasters and good espresso', category: 'CAFE' },
] as const;

/** Fast lookup: tag → card. */
export const INTEREST_CARD_BY_TAG: ReadonlyMap<string, InterestCard> = new Map(
  INTEREST_CARDS.map((card) => [card.tag, card]),
);

/** Stable deck-order index for a tag (used as the serialization tie-break). */
export function cardOrderIndex(tag: string): number {
  const idx = INTEREST_CARDS.findIndex((c) => c.tag === tag);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

/** Human label for a tag; falls back to a de-snaked form for unknown tags. */
export function interestLabel(tag: string): string {
  const card = INTEREST_CARD_BY_TAG.get(tag);
  if (card) return card.label;
  return tag
    .split('_')
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

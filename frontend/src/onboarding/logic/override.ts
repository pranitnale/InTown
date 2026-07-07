import type { TasteProfile } from '@intown/contracts/types';

/**
 * The museum problem (AC #3, §6.2).
 *
 * A LOW soft weight means "fewer / exceptional only" — NOT "never". So a
 * *defining* sight (a city's signature collection/landmark) may still surface
 * even when its interest tag is ranked low, and when it does it must carry an
 * honest explanation plus an explicit Remove affordance. Nothing is ever
 * silently dropped: low rank quietly reduces frequency, and the one exceptional
 * item that breaks through is always labelled.
 *
 * A HARD exclusion is categorically different: an absolute veto. If the tag is
 * hard-excluded the item is NEVER shown, so no override banner appears — the
 * distinction is visible in behaviour, not just wording.
 */

/** Minimal shape of a candidate the recommender wants to surface. */
export interface DefiningSight {
  id: string;
  title: string;
  /** The interest tag this sight belongs to (e.g. `museums`). */
  interestTag: string;
  /** City-specific justification (e.g. "Paris's defining collection"). */
  reason: string;
}

export interface OverrideDecision {
  /** Whether the "shown despite low interest — Remove?" banner should render. */
  show: boolean;
  /** Full sentence shown to the user when `show` is true. */
  explanation: string;
}

/** Portion of taste needed by the decision (subset of {@link TasteProfile}). */
export type TasteRanking = Pick<TasteProfile, 'interests' | 'anti_preferences' | 'hard_exclusions'>;

/**
 * Is a tag "low interest" for this user? True when it is an anti-preference, or
 * ranked in the bottom half of the interest list, or never expressed at all.
 */
export function isLowInterest(taste: TasteRanking, tag: string): boolean {
  if (taste.anti_preferences.includes(tag)) return true;
  const idx = taste.interests.indexOf(tag);
  if (idx === -1) return true; // never expressed → low by default
  const half = Math.ceil(taste.interests.length / 2);
  return idx >= half;
}

/**
 * Decide whether to surface the override banner for a defining sight. A
 * hard-excluded tag is an absolute veto → the sight is not shown and no banner
 * appears. Otherwise the banner shows only when interest is low (a
 * well-liked tag needs no justification).
 */
export function overrideDecision(taste: TasteRanking, sight: DefiningSight): OverrideDecision {
  if (taste.hard_exclusions.includes(sight.interestTag)) {
    return { show: false, explanation: '' };
  }
  if (!isLowInterest(taste, sight.interestTag)) {
    return { show: false, explanation: '' };
  }
  return {
    show: true,
    explanation: `Shown despite low interest — ${sight.reason}.`,
  };
}

/**
 * The Remove action. Promotes the sight's tag to an ABSOLUTE hard exclusion
 * (so it is never surfaced again) and clears any soft signals for that tag from
 * `interests` / `anti_preferences`. Returns a new taste-ranking; the caller
 * persists it as a new profile version. This is the ONLY path that drops the
 * item, and it is always user-initiated.
 */
export function applyRemove(taste: TasteRanking, sight: DefiningSight): TasteRanking {
  const tag = sight.interestTag;
  return {
    interests: taste.interests.filter((t) => t !== tag),
    anti_preferences: taste.anti_preferences.filter((t) => t !== tag),
    hard_exclusions: taste.hard_exclusions.includes(tag)
      ? taste.hard_exclusions
      : [...taste.hard_exclusions, tag],
  };
}

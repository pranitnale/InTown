import type { BudgetTier, Category, Mobility, Pace, VoteValue } from '@intown/contracts/types';

/**
 * Preference-merge engine (P06, §6.3, D8). PURE + synchronous — no I/O, no DB, no
 * HTTP route (contracts define none; the consumers are P14 curation and P11). Given
 * each member's preference slice and the per-member votes on every candidate POI, it
 * produces a group ranking.
 *
 * TWO-LAYER MODEL (§6.3):
 *   HARD CONSTRAINTS are FILTERS — anyone's veto governs. A candidate is excluded if
 *   it trips ANY of: the union of members' hard exclusions; a dietary need unmet on a
 *   meal-category pick; a price above the group's budget cap (the LEAST-affording
 *   member); or the accessibility required by the STRICTEST member's mobility.
 *   SOFT INTERESTS are AVERAGED WITH A MISERY THRESHOLD — each member scores a
 *   candidate in [-1, 1] (interest match +1, anti-preference −0.5, own vote ±1); the
 *   group score is the mean. If any member is miserable (score ≤ −0.6 or a down-vote)
 *   the candidate is excluded when the group mean is low, or merely FLAGGED 'misery'
 *   when the rest of the group loves it enough to clear the keep threshold.
 *
 * AGGREGATE-ONLY DISCLOSURE (§6.3): the per-member scores/votes are consumed here and
 * NEVER surface. Every output row carries only `poi_id`, the group `score`, the
 * exclusion decision, reason `flags`, and vote `disagreement` as COUNTS
 * ({up, down, member_count}). There is deliberately no member/user field on the
 * output type — "3 of 4 want this", never "Ana vetoed this".
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** One member's preference slice (mirrors taste_profiles + traveler_profiles). */
export interface MergeMember {
  interests: readonly string[];
  anti_preferences: readonly string[];
  hard_exclusions: readonly string[];
  dietary: readonly string[];
  budget_tier: BudgetTier;
  pace: Pace;
  mobility: Mobility;
}

/**
 * One candidate POI. `descriptors` (see below) are matched against interests /
 * anti-preferences / hard exclusions; `tags` also supplies the dietary-accommodation
 * and accessibility vocabulary the meal + mobility filters read. `votes` is aligned
 * BY INDEX to the members array passed to {@link scoreCandidates} (null = no vote).
 * `price_tier` is omitted when unknown, in which case the budget filter is a no-op
 * for this candidate (P14 enriches candidates with tags/price before calling).
 */
export interface MergeCandidate {
  poi_id: string;
  category: Category;
  tags?: readonly string[];
  price_tier?: BudgetTier;
  votes: ReadonlyArray<VoteValue | null>;
}

// ---------------------------------------------------------------------------
// Output — aggregate only, NO per-member / user-id field.
// ---------------------------------------------------------------------------

export type MergeFlag = 'hard_exclusion' | 'dietary' | 'budget' | 'mobility' | 'misery';

export interface MergeDisagreement {
  up: number;
  down: number;
  member_count: number;
}

export interface CandidateScore {
  poi_id: string;
  /** Group mean soft score in [-1, 1]. */
  score: number;
  excluded: boolean;
  /** Why it was excluded / flagged (empty when a clean keep). */
  flags: MergeFlag[];
  disagreement: MergeDisagreement;
}

// ---------------------------------------------------------------------------
// Tunables + orderings (documented so P14 can reason about the strategy).
// ---------------------------------------------------------------------------

/** Budget ordinal — a candidate priced above the group cap (min tier) is filtered. */
const BUDGET_RANK: Record<BudgetTier, number> = { budget: 0, moderate: 1, comfort: 2, luxury: 3 };

/** Mobility strictness — the group requirement is the MAX (strictest) member's. */
const MOBILITY_RANK: Record<Mobility, number> = { full: 0, limited: 1, stroller: 2, wheelchair: 3 };

/**
 * Accessibility tag a candidate must carry to satisfy a given mobility need. `full`
 * imposes nothing. This tiny vocabulary is the engine's contract with the candidate
 * builder (P14): tag POIs with these when the underlying data supports it.
 */
const MOBILITY_REQUIRED_TAG: Record<Mobility, string | null> = {
  full: null,
  limited: 'step_free',
  stroller: 'stroller_friendly',
  wheelchair: 'wheelchair_accessible',
};

/** Meal categories the dietary filter applies to (§6.3 — diet governs food picks). */
const MEAL_CATEGORIES: ReadonlySet<Category> = new Set<Category>(['RESTAURANT', 'CAFE']);

/** A miserable member scores at/below this on a candidate. */
const MISERY_MEMBER_THRESHOLD = -0.6;
/**
 * When a member is miserable, the candidate is kept-but-flagged only if the group
 * mean is at least this high; otherwise it is excluded. A positive bar means "a
 * clear majority must love it to override one member's misery".
 */
const MISERY_GROUP_KEEP_THRESHOLD = 0.34;

const INTEREST_WEIGHT = 1;
const ANTI_PREFERENCE_WEIGHT = -0.5;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

function intersects(a: readonly string[], b: ReadonlySet<string>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

/**
 * The set an interest / anti-preference / hard-exclusion token is matched against:
 * the candidate's free tags plus its category label. So a hard exclusion of
 * `'NIGHTLIFE'` filters nightlife POIs, and a `'cemetery'` tag filters by tag.
 */
function descriptorsOf(candidate: MergeCandidate): ReadonlySet<string> {
  const set = new Set<string>(candidate.tags ?? []);
  set.add(candidate.category);
  return set;
}

/**
 * Score every candidate for the group. `candidate.votes[i]` must correspond to
 * `members[i]`. Returns one {@link CandidateScore} per candidate, input order
 * preserved.
 */
export function scoreCandidates(
  members: readonly MergeMember[],
  candidates: readonly MergeCandidate[],
): CandidateScore[] {
  const memberCount = members.length;

  // Group-level hard-constraint aggregates, computed once.
  const unionHardExclusions = new Set<string>();
  const unionDietary = new Set<string>();
  let budgetCapRank = Number.POSITIVE_INFINITY; // min over members (least-affording)
  let strictestMobility: Mobility = 'full';
  for (const m of members) {
    for (const h of m.hard_exclusions) unionHardExclusions.add(h);
    for (const d of m.dietary) unionDietary.add(d);
    budgetCapRank = Math.min(budgetCapRank, BUDGET_RANK[m.budget_tier]);
    if (MOBILITY_RANK[m.mobility] > MOBILITY_RANK[strictestMobility]) strictestMobility = m.mobility;
  }
  const mobilityRequiredTag = MOBILITY_REQUIRED_TAG[strictestMobility];

  return candidates.map((candidate) => {
    const descriptors = descriptorsOf(candidate);
    const tagSet = new Set<string>(candidate.tags ?? []);
    const flags: MergeFlag[] = [];
    let excluded = false;

    // --- HARD FILTERS (anyone's veto governs) -------------------------------
    if (intersects([...unionHardExclusions], descriptors)) {
      excluded = true;
      flags.push('hard_exclusion');
    }
    // Dietary: only meal categories; every member's dietary need must be met.
    if (MEAL_CATEGORIES.has(candidate.category) && unionDietary.size > 0) {
      let unmet = false;
      for (const d of unionDietary) if (!tagSet.has(d)) unmet = true;
      if (unmet) {
        excluded = true;
        flags.push('dietary');
      }
    }
    // Budget cap: candidate priced above the least-affording member is out.
    if (candidate.price_tier !== undefined && BUDGET_RANK[candidate.price_tier] > budgetCapRank) {
      excluded = true;
      flags.push('budget');
    }
    // Mobility: must carry the tag the strictest member needs.
    if (mobilityRequiredTag !== null && !tagSet.has(mobilityRequiredTag)) {
      excluded = true;
      flags.push('mobility');
    }

    // --- SOFT SCORES (per member, then averaged) ----------------------------
    let scoreSum = 0;
    let up = 0;
    let down = 0;
    let anyMiserable = false;
    for (let i = 0; i < memberCount; i += 1) {
      const m = members[i]!;
      const vote = candidate.votes[i] ?? null;
      let s = 0;
      if (intersects(m.interests, descriptors)) s += INTEREST_WEIGHT;
      if (intersects(m.anti_preferences, descriptors)) s += ANTI_PREFERENCE_WEIGHT;
      if (vote === 'up') {
        s += 1;
        up += 1;
      } else if (vote === 'down') {
        s -= 1;
        down += 1;
      }
      s = clamp(s, -1, 1);
      if (s <= MISERY_MEMBER_THRESHOLD || vote === 'down') anyMiserable = true;
      scoreSum += s;
    }
    const groupScore = memberCount === 0 ? 0 : clamp(scoreSum / memberCount, -1, 1);

    // --- MISERY THRESHOLD ---------------------------------------------------
    // A miserable member excludes a low-scoring candidate; a high-enough group mean
    // keeps it but raises the 'misery' flag. Already-hard-excluded candidates just
    // pick up the flag (the exclusion stands regardless).
    if (anyMiserable) {
      flags.push('misery');
      if (groupScore < MISERY_GROUP_KEEP_THRESHOLD) excluded = true;
    }

    return {
      poi_id: candidate.poi_id,
      score: groupScore,
      excluded,
      flags,
      disagreement: { up, down, member_count: memberCount },
    };
  });
}

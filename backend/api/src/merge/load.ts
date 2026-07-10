import type pg from 'pg';
import type { BudgetTier, Category, Mobility, Pace, VoteValue } from '@intown/contracts/types';
import type { MergeCandidate, MergeMember } from './engine.ts';

/**
 * Assemble {@link scoreCandidates} inputs for a trip from the database (P06, §6.3).
 *
 * WHY AN ADMIN / INFRA POOL: the merge deliberately reads ACROSS members — every
 * member's latest taste + traveler profile and everyone's raw votes. Under the app
 * RLS role those are invisible (taste_profiles_self, place_votes_self in 0011/0013),
 * so this loader must run on a BYPASSRLS/superuser pool. That is safe precisely
 * because the engine's output is aggregate-only: the per-member rows are consumed
 * into group scores + vote COUNTS and never re-exposed. This module has no HTTP route
 * of its own; P14 (curation longlist) drives it behind its own membership checks.
 *
 * Candidates here carry only what today's schema knows — `poi_id` + `category` +
 * per-member votes. `tags` / `price_tier` (which drive the dietary / budget /
 * mobility hard filters) are left for P14 to enrich from the POI knowledge base;
 * until then those filters are inert and scoring rests on interests/anti/votes.
 */

/** Neutral defaults for a member with no taste/traveler profile yet. */
const DEFAULT_BUDGET: BudgetTier = 'moderate';
const DEFAULT_PACE: Pace = 'moderate';
const DEFAULT_MOBILITY: Mobility = 'full';

export interface MergeInputs {
  members: MergeMember[];
  candidates: MergeCandidate[];
}

interface MemberRow {
  user_id: string;
  interests: string[] | null;
  anti_preferences: string[] | null;
  hard_exclusions: string[] | null;
  dietary: string[] | null;
  budget_tier: BudgetTier | null;
  pace: Pace | null;
  mobility: Mobility | null;
}

interface CandidateRow {
  trip_place_id: string;
  poi_id: string;
  category: Category;
}

interface VoteRow {
  trip_place_id: string;
  user_id: string;
  vote: VoteValue;
}

/**
 * Load members + candidate POIs + per-member votes for `tripId`, optionally scoped to
 * one city stay via `tripCityId`. Member order is stable (joined_at, then user_id) and
 * every candidate's `votes` array is aligned to that same order.
 */
export async function loadMergeInputs(
  admin: pg.Pool,
  tripId: string,
  opts: { tripCityId?: string } = {},
): Promise<MergeInputs> {
  const { rows: memberRows } = await admin.query<MemberRow>(
    `SELECT m.user_id,
            tp.interests, tp.anti_preferences, tp.hard_exclusions, tp.dietary,
            tp.budget_tier, tp.pace,
            tr.mobility
       FROM trip_members m
       LEFT JOIN LATERAL (
         SELECT interests, anti_preferences, hard_exclusions, dietary, budget_tier, pace
           FROM taste_profiles t
          WHERE t.user_id = m.user_id
          ORDER BY t.version DESC
          LIMIT 1
       ) tp ON true
       LEFT JOIN traveler_profiles tr ON tr.user_id = m.user_id
      WHERE m.trip_id = $1
      ORDER BY m.joined_at, m.user_id`,
    [tripId],
  );

  const members: MergeMember[] = memberRows.map((r) => ({
    interests: r.interests ?? [],
    anti_preferences: r.anti_preferences ?? [],
    hard_exclusions: r.hard_exclusions ?? [],
    dietary: r.dietary ?? [],
    budget_tier: r.budget_tier ?? DEFAULT_BUDGET,
    pace: r.pace ?? DEFAULT_PACE,
    mobility: r.mobility ?? DEFAULT_MOBILITY,
  }));
  // Index each member's position so votes can be aligned by index.
  const memberIndex = new Map<string, number>();
  memberRows.forEach((r, i) => memberIndex.set(r.user_id, i));

  const { rows: candidateRows } = await admin.query<CandidateRow>(
    `SELECT tp.id AS trip_place_id, tp.poi_id, p.category
       FROM trip_places tp
       JOIN trip_cities tc ON tc.id = tp.trip_city_id
       JOIN pois p ON p.id = tp.poi_id
      WHERE tc.trip_id = $1
        AND ($2::uuid IS NULL OR tp.trip_city_id = $2)
      ORDER BY tp.trip_city_id, tp.position`,
    [tripId, opts.tripCityId ?? null],
  );

  const placeIds = candidateRows.map((r) => r.trip_place_id);
  const { rows: voteRows } = placeIds.length
    ? await admin.query<VoteRow>(
        `SELECT trip_place_id, user_id, vote FROM place_votes WHERE trip_place_id = ANY($1::uuid[])`,
        [placeIds],
      )
    : { rows: [] as VoteRow[] };

  // votesByPlace[trip_place_id][memberIndex] = vote
  const votesByPlace = new Map<string, Array<VoteValue | null>>();
  for (const r of voteRows) {
    const idx = memberIndex.get(r.user_id);
    if (idx === undefined) continue; // a vote from a since-removed member — ignore
    let arr = votesByPlace.get(r.trip_place_id);
    if (!arr) {
      arr = new Array<VoteValue | null>(members.length).fill(null);
      votesByPlace.set(r.trip_place_id, arr);
    }
    arr[idx] = r.vote;
  }

  const candidates: MergeCandidate[] = candidateRows.map((r) => ({
    poi_id: r.poi_id,
    category: r.category,
    votes: votesByPlace.get(r.trip_place_id) ?? new Array<VoteValue | null>(members.length).fill(null),
  }));

  return { members, candidates };
}

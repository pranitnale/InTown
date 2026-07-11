import { describe, expect, it } from 'vitest';
import { scoreCandidates, type MergeCandidate, type MergeMember } from '../src/merge/engine.ts';

/**
 * P06 AC7 (+ the AC4 aggregate-only half) — the pure preference-merge engine.
 * Hard constraints are filters (anyone's veto governs); soft interests are averaged
 * with a misery threshold; disclosure is aggregate counts only. No DB, no I/O.
 */

/** A permissive member (no constraints, neutral tiers) unless overridden. */
function member(over: Partial<MergeMember> = {}): MergeMember {
  return {
    interests: [],
    anti_preferences: [],
    hard_exclusions: [],
    dietary: [],
    budget_tier: 'luxury', // most permissive budget by default
    pace: 'moderate',
    mobility: 'full',
    ...over,
  };
}

describe('merge engine: hard filters (AC7)', () => {
  it('a dietary need filters ALL meal-category picks that do not accommodate it', () => {
    const members = [member(), member({ dietary: ['vegetarian'] })];
    const noVotes = [null, null] as const;
    const candidates: MergeCandidate[] = [
      { poi_id: 'r-no', category: 'RESTAURANT', tags: [], votes: [...noVotes] },
      { poi_id: 'c-no', category: 'CAFE', tags: [], votes: [...noVotes] },
      { poi_id: 'r-yes', category: 'RESTAURANT', tags: ['vegetarian'], votes: [...noVotes] },
      { poi_id: 'museum', category: 'MUSEUM', tags: [], votes: [...noVotes] }, // non-meal: unaffected
    ];
    const byId = Object.fromEntries(scoreCandidates(members, candidates).map((r) => [r.poi_id, r]));

    expect(byId['r-no']!.excluded).toBe(true);
    expect(byId['r-no']!.flags).toContain('dietary');
    expect(byId['c-no']!.excluded).toBe(true);
    expect(byId['c-no']!.flags).toContain('dietary');
    // A meal that carries the accommodation is NOT dietary-excluded.
    expect(byId['r-yes']!.flags).not.toContain('dietary');
    // A non-meal category is never dietary-filtered.
    expect(byId['museum']!.flags).not.toContain('dietary');
  });

  it('a hard exclusion beats a high average (veto wins over love)', () => {
    // Both members interest-match AND up-vote → soft score would be maxed (+1),
    // but one member hard-excludes the category. Exclusion must still win.
    const members = [
      member({ interests: ['MUSEUM'] }),
      member({ interests: ['MUSEUM'], hard_exclusions: ['MUSEUM'] }),
    ];
    const [row] = scoreCandidates(members, [
      { poi_id: 'm', category: 'MUSEUM', tags: [], votes: ['up', 'up'] },
    ]);
    expect(row!.score).toBeGreaterThan(0.9); // genuinely loved on the soft axis
    expect(row!.excluded).toBe(true);
    expect(row!.flags).toContain('hard_exclusion');
  });

  it('filters a candidate priced above the group budget cap (least-affording member)', () => {
    const members = [member({ budget_tier: 'luxury' }), member({ budget_tier: 'budget' })];
    const noVotes = [null, null] as const;
    const [lux, cheap] = scoreCandidates(members, [
      { poi_id: 'lux', category: 'RESTAURANT', tags: ['vegetarian'], price_tier: 'luxury', votes: [...noVotes] },
      { poi_id: 'cheap', category: 'RESTAURANT', tags: ['vegetarian'], price_tier: 'budget', votes: [...noVotes] },
    ]);
    expect(lux!.excluded).toBe(true);
    expect(lux!.flags).toContain('budget');
    expect(cheap!.flags).not.toContain('budget');
  });

  it('filters a candidate lacking access for the strictest member mobility', () => {
    const members = [member({ mobility: 'full' }), member({ mobility: 'wheelchair' })];
    const noVotes = [null, null] as const;
    const [inaccessible, accessible] = scoreCandidates(members, [
      { poi_id: 'stairs', category: 'MUSEUM', tags: [], votes: [...noVotes] },
      { poi_id: 'ramp', category: 'MUSEUM', tags: ['wheelchair_accessible'], votes: [...noVotes] },
    ]);
    expect(inaccessible!.excluded).toBe(true);
    expect(inaccessible!.flags).toContain('mobility');
    expect(accessible!.flags).not.toContain('mobility');
  });

  it('undefined tags fail OPEN — tag-based hard filters are skipped (not-yet-enriched)', () => {
    // A dietary need + a strict mobility member. A candidate with UNKNOWN tags (field
    // omitted) must NOT be dietary/mobility-excluded — enrichment is P14's job, and
    // failing closed would wrongly wipe out every un-enriched meal/POI. Mirrors the
    // omitted-price_tier budget no-op.
    const members = [member({ dietary: ['vegetarian'], mobility: 'wheelchair' })];
    const [meal, sight] = scoreCandidates(members, [
      { poi_id: 'meal', category: 'RESTAURANT', votes: [null] }, // tags undefined
      { poi_id: 'sight', category: 'MUSEUM', votes: [null] }, // tags undefined
    ]);
    expect(meal!.excluded).toBe(false);
    expect(meal!.flags).not.toContain('dietary');
    expect(meal!.flags).not.toContain('mobility');
    expect(sight!.excluded).toBe(false);
    expect(sight!.flags).not.toContain('mobility');
  });

  it('explicit empty tags fail CLOSED — known-no-tags trips the tag-based filters', () => {
    // The SAME member set as above, but candidates now assert `tags: []` (known: this
    // POI carries no accommodation/accessibility tags). Now the filters run and veto.
    const members = [member({ dietary: ['vegetarian'], mobility: 'wheelchair' })];
    const [meal, sight] = scoreCandidates(members, [
      { poi_id: 'meal', category: 'RESTAURANT', tags: [], votes: [null] },
      { poi_id: 'sight', category: 'MUSEUM', tags: [], votes: [null] },
    ]);
    expect(meal!.excluded).toBe(true);
    expect(meal!.flags).toContain('dietary');
    expect(meal!.flags).toContain('mobility');
    expect(sight!.excluded).toBe(true);
    expect(sight!.flags).toContain('mobility');
  });

  it('a category-level hard exclusion still applies when tags are undefined', () => {
    // Fail-open covers only the TAG-based filters; the category is always known, so a
    // hard exclusion on the category must still veto even with tags unknown.
    const members = [member({ hard_exclusions: ['NIGHTLIFE'] })];
    const [row] = scoreCandidates(members, [
      { poi_id: 'club', category: 'NIGHTLIFE', votes: [null] }, // tags undefined
    ]);
    expect(row!.excluded).toBe(true);
    expect(row!.flags).toContain('hard_exclusion');
  });
});

describe('merge engine: soft scoring + misery threshold (AC7)', () => {
  it('a very-low member score with a low group mean is EXCLUDED with a misery flag', () => {
    // member0 down-votes AND anti-prefers → clamps to -1 (≤ -0.6, miserable);
    // member1 is neutral. Group mean = -0.5 (< keep threshold) → excluded.
    const members = [member({ anti_preferences: ['NIGHTLIFE'] }), member()];
    const [row] = scoreCandidates(members, [
      { poi_id: 'club', category: 'NIGHTLIFE', tags: [], votes: ['down', null] },
    ]);
    expect(row!.score).toBeLessThan(0);
    expect(row!.flags).toContain('misery');
    expect(row!.excluded).toBe(true);
  });

  it('a single miserable member is only FLAGGED (not excluded) when the group loves it', () => {
    // member0 down-votes (miserable); members1-3 interest-match AND up-vote (+1 each).
    // Group mean = (-1 + 1 + 1 + 1)/4 = 0.5 ≥ keep threshold → kept but flagged.
    const members = [
      member(),
      member({ interests: ['MUSEUM'] }),
      member({ interests: ['MUSEUM'] }),
      member({ interests: ['MUSEUM'] }),
    ];
    const [row] = scoreCandidates(members, [
      { poi_id: 'm', category: 'MUSEUM', tags: [], votes: ['down', 'up', 'up', 'up'] },
    ]);
    expect(row!.score).toBeGreaterThanOrEqual(0.34);
    expect(row!.flags).toContain('misery');
    expect(row!.excluded).toBe(false);
  });

  it('a clean, well-liked candidate is kept with no flags', () => {
    const members = [member({ interests: ['PARK_NATURE'] }), member({ interests: ['PARK_NATURE'] })];
    const [row] = scoreCandidates(members, [
      { poi_id: 'park', category: 'PARK_NATURE', tags: [], votes: ['up', null] },
    ]);
    expect(row!.excluded).toBe(false);
    expect(row!.flags).toEqual([]);
    expect(row!.score).toBeGreaterThan(0);
  });
});

describe('merge engine: aggregate-only disclosure (AC4 half)', () => {
  it('emits only counts — the serialized output leaks no per-member identity', () => {
    // Three members with distinct votes; the output must reveal totals, never WHO.
    const members = [member(), member(), member()];
    const result = scoreCandidates(members, [
      { poi_id: 'poi-abc', category: 'SIGHT', tags: [], votes: ['up', 'down', 'up'] },
    ]);
    const [row] = result;

    // Structural guarantee: exactly the aggregate keys, nothing member-scoped.
    expect(Object.keys(row!).sort()).toEqual(['disagreement', 'excluded', 'flags', 'poi_id', 'score']);
    expect(Object.keys(row!.disagreement).sort()).toEqual(['down', 'member_count', 'up']);
    expect(row!.disagreement).toEqual({ up: 2, down: 1, member_count: 3 });

    // The vote array indices (a stand-in for member identity) never surface — the
    // serialized payload carries no member/user/voter/index field.
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/user_id|"member"|voter|"votes"|"index"/i);
    // 'member_count' is the ONLY 'member…' token allowed (no member_id, members, …).
    expect(json.match(/member[a-z_]*/gi)).toEqual(['member_count']);
  });
});

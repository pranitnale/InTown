import { describe, it, expect } from 'vitest';
import {
  applySwipe,
  survivors,
  weightsToInterests,
  interestsToWeights,
  freshDeck,
  SWIPE_WEIGHT,
} from '../logic/swipe.ts';
import { reorder, moveUp, moveDown, removeAt, addUnique, removeValue, toggleValue } from '../logic/dragRank.ts';
import {
  initQuiz,
  answer,
  back,
  currentQuestion,
  progress,
  type QuizConfig,
} from '../logic/quiz.ts';
import {
  isLowInterest,
  overrideDecision,
  applyRemove,
  type TasteRanking,
  type DefiningSight,
} from '../logic/override.ts';
import { pacePresetFor, pacePresetReason } from '../logic/pace.ts';
import { INTEREST_CARDS } from '../logic/interests.ts';

describe('swipe → weight → rank serialization (AC #6)', () => {
  it('maps verdicts to soft weights', () => {
    expect(SWIPE_WEIGHT).toEqual({ pass: 0, like: 1, love: 2 });
  });

  it('applySwipe is immutable and records the weight', () => {
    const w0 = {};
    const w1 = applySwipe(w0, 'coffee', 'love');
    expect(w0).toEqual({});
    expect(w1).toEqual({ coffee: 2 });
  });

  it('only survivors (weight ≥ 1) advance', () => {
    const w = { architecture: 2, museums: 0, coffee: 1 };
    expect(survivors(w).sort()).toEqual(['architecture', 'coffee']);
  });

  it('serializes survivors by weight desc, deck-order tie-break', () => {
    // architecture (deck 0) and coffee (deck 13) both weight 2 → deck order wins.
    const w = { architecture: 2, coffee: 2, museums: 1 };
    expect(weightsToInterests(w)).toEqual(['architecture', 'coffee', 'museums']);
  });

  it('rank → weight is strictly monotonic (rank 0 highest)', () => {
    const weights = interestsToWeights(['architecture', 'coffee', 'museums']);
    expect(weights).toEqual({ architecture: 3, coffee: 2, museums: 1 });
  });

  it('round-trips rank order (the only thing the contract preserves)', () => {
    const ranked = ['museums', 'architecture', 'coffee'];
    expect(weightsToInterests(interestsToWeights(ranked))).toEqual(ranked);
  });

  it('freshDeck has 10–15 cards (spec) and matches the taxonomy', () => {
    expect(freshDeck().length).toBe(INTEREST_CARDS.length);
    expect(freshDeck().length).toBeGreaterThanOrEqual(10);
    expect(freshDeck().length).toBeLessThanOrEqual(15);
  });
});

describe('drag-rank reducers (AC #2)', () => {
  it('reorder moves an item and is immutable', () => {
    const list = ['a', 'b', 'c'];
    expect(reorder(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(list).toEqual(['a', 'b', 'c']);
  });
  it('moveUp/moveDown respect boundaries', () => {
    expect(moveUp(['a', 'b', 'c'], 0)).toEqual(['a', 'b', 'c']);
    expect(moveUp(['a', 'b', 'c'], 2)).toEqual(['a', 'c', 'b']);
    expect(moveDown(['a', 'b', 'c'], 2)).toEqual(['a', 'b', 'c']);
    expect(moveDown(['a', 'b', 'c'], 0)).toEqual(['b', 'a', 'c']);
  });
  it('removeAt / addUnique / removeValue / toggleValue', () => {
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(addUnique(['a'], 'a')).toEqual(['a']);
    expect(addUnique(['a'], 'b')).toEqual(['a', 'b']);
    expect(addUnique(['a'], '  ')).toEqual(['a']);
    expect(removeValue(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleValue(['a'], 'a')).toEqual([]);
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
  });
});

describe('quiz framework (AC #4)', () => {
  const config: QuizConfig = {
    endowed: { label: 'Account created', reason: 'You already created your account.' },
    questions: [
      { id: 'q1', prompt: 'One?', options: [] } as never,
      { id: 'q2', prompt: 'Two?', options: [] } as never,
    ],
  };

  it('rejects a fake head-start (empty reason)', () => {
    expect(() => initQuiz({ ...config, endowed: { label: 'x', reason: '  ' } })).toThrow();
  });

  it('progress starts at 1 of total (endowed step earned)', () => {
    const s = initQuiz(config);
    const p = progress(config, s);
    expect(p.total).toBe(3); // 1 endowed + 2 questions
    expect(p.completed).toBe(1);
    expect(p.currentStep).toBe(2);
    expect(p.label).toBe('Account created ✓ — 1 of 3');
  });

  it('answers one at a time and advances, then completes', () => {
    let s = initQuiz(config);
    expect(currentQuestion(config, s)?.id).toBe('q1');
    s = answer(config, s, 'q1', 'a');
    expect(currentQuestion(config, s)?.id).toBe('q2');
    expect(progress(config, s).completed).toBe(2);
    s = answer(config, s, 'q2', 'b');
    expect(s.done).toBe(true);
    expect(s.answers).toEqual({ q1: 'a', q2: 'b' });
    expect(progress(config, s).completed).toBe(3);
  });

  it('back steps to the previous question', () => {
    let s = initQuiz(config);
    s = answer(config, s, 'q1', 'a');
    s = back(s);
    expect(currentQuestion(config, s)?.id).toBe('q1');
  });
});

describe('museum-problem override (AC #3)', () => {
  const taste: TasteRanking = {
    interests: ['architecture', 'coffee', 'viewpoints', 'history'],
    anti_preferences: ['crowded_nightlife'],
    hard_exclusions: [],
  };
  const louvre: DefiningSight = {
    id: 'louvre',
    title: 'The Louvre',
    interestTag: 'museums',
    reason: "it's Paris's defining collection",
  };

  it('a never-expressed tag is low interest', () => {
    expect(isLowInterest(taste, 'museums')).toBe(true);
  });
  it('a top-ranked tag is NOT low interest', () => {
    expect(isLowInterest(taste, 'architecture')).toBe(false);
  });
  it('anti-preference counts as low interest', () => {
    expect(isLowInterest(taste, 'crowded_nightlife')).toBe(true);
  });
  it('shows the override for a defining sight with low interest', () => {
    const d = overrideDecision(taste, louvre);
    expect(d.show).toBe(true);
    expect(d.explanation).toContain('Shown despite low interest');
  });
  it('a hard-excluded tag is an absolute veto → no banner', () => {
    const excluded: TasteRanking = { ...taste, hard_exclusions: ['museums'] };
    expect(overrideDecision(excluded, louvre).show).toBe(false);
  });
  it('a well-liked tag needs no banner', () => {
    const likesMuseums: TasteRanking = { ...taste, interests: ['museums', 'architecture'] };
    expect(overrideDecision(likesMuseums, louvre).show).toBe(false);
  });
  it('Remove promotes the tag to hard exclusion and clears soft signals (nothing silent)', () => {
    const next = applyRemove(taste, louvre);
    expect(next.hard_exclusions).toContain('museums');
    expect(next.interests).not.toContain('museums');
    expect(next.anti_preferences).not.toContain('museums');
  });
});

describe('age → pace preset (AC #7)', () => {
  it('maps every age band to a pace (default suggestion)', () => {
    expect(pacePresetFor('<18')).toBe('packed');
    expect(pacePresetFor('18-25')).toBe('packed');
    expect(pacePresetFor('26-44')).toBe('moderate');
    expect(pacePresetFor('45-64')).toBe('moderate');
    expect(pacePresetFor('65+')).toBe('relaxed');
  });
  it('frames it as an editable starting point, not a cap', () => {
    const reason = pacePresetReason('65+');
    expect(reason).toContain('starting point');
    expect(reason.toLowerCase()).toContain('change it anytime');
  });
});

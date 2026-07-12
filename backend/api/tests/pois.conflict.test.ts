import { describe, expect, it } from 'vitest';
import type { Fact } from '@intown/contracts/types';
import {
  ATTRIBUTE_CLASS,
  STALE_DAYS,
  USER_CORRECTION_MIN_CORROBORATION,
  selectFact,
  selectFactsByAttribute,
} from '../src/pois/conflict.ts';

/**
 * P08 AC2 — the pure per-fact-type conflict resolver (§5.3, D23). Facts are
 * selected by the ATTRIBUTE's class (never per source), and the SELECTING RULE
 * is asserted alongside the winner: official beats a newer blog on hours; the
 * same blog can win on crowds; a corroborated user correction overrides stale
 * citations only above the N-confirmation threshold. No DB, no I/O — a fixed
 * `now` is injected so staleness is deterministic.
 */

/** 2026-07-01 — the fixed clock every case measures staleness against. */
const NOW = new Date('2026-07-01T00:00:00Z');

/** A neutral active fact (hours, web_review) unless overridden. */
function makeFact(over: Partial<Fact> = {}): Fact {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    entity_kind: 'poi',
    entity_id: '11111111-1111-1111-1111-111111111111',
    attribute: 'hours',
    value: null,
    source_url: null,
    source_kind: 'web_review',
    observed_at: '2026-01-01T00:00:00Z',
    confidence: 0.5,
    corroboration_count: 0,
    status: 'active',
    ...over,
  };
}

describe('selectFact: operational (rule 1 / rule 2)', () => {
  it('official beats a NEWER blog on hours — rule official_operational (AC2 first half)', () => {
    const official = makeFact({
      id: 'a',
      attribute: 'hours',
      source_kind: 'official_site',
      observed_at: '2026-03-01T00:00:00Z',
    });
    const blog = makeFact({
      id: 'b',
      attribute: 'hours',
      source_kind: 'web_review',
      observed_at: '2026-05-01T00:00:00Z',
    });
    const r = selectFact([official, blog], NOW)!;
    expect(r.fact.id).toBe('a');
    expect(r.rule).toBe('official_operational');
  });

  it('newest official wins when several officials disagree', () => {
    const older = makeFact({
      id: 'o1',
      attribute: 'price',
      source_kind: 'official_site',
      observed_at: '2026-01-01T00:00:00Z',
    });
    const newer = makeFact({
      id: 'o2',
      attribute: 'price',
      source_kind: 'open_data',
      observed_at: '2026-06-01T00:00:00Z',
    });
    const r = selectFact([older, newer], NOW)!;
    expect(r.fact.id).toBe('o2');
    expect(r.rule).toBe('official_operational');
  });

  it('no official on an operational attribute falls through to newest — rule newest_time_sensitive', () => {
    const oldBlog = makeFact({
      id: 'x',
      attribute: 'hours',
      source_kind: 'web_review',
      observed_at: '2026-02-01T00:00:00Z',
    });
    const newBlog = makeFact({
      id: 'y',
      attribute: 'hours',
      source_kind: 'advisory',
      observed_at: '2026-05-01T00:00:00Z',
    });
    const r = selectFact([oldBlog, newBlog], NOW)!;
    expect(r.fact.id).toBe('y');
    expect(r.rule).toBe('newest_time_sensitive');
  });
});

describe('selectFact: time-sensitive (rule 2)', () => {
  it('the same blog can win on crowds — newest wins, rule newest_time_sensitive (AC2 second half)', () => {
    const blog = makeFact({
      id: 'b',
      attribute: 'crowd_level',
      source_kind: 'web_review',
      observed_at: '2026-05-01T00:00:00Z',
    });
    const wiki = makeFact({
      id: 'w',
      attribute: 'crowd_level',
      source_kind: 'wikidata',
      observed_at: '2026-01-01T00:00:00Z',
    });
    const r = selectFact([blog, wiki], NOW)!;
    expect(r.fact.id).toBe('b');
    expect(r.rule).toBe('newest_time_sensitive');
  });
});

describe('selectFact: experiential (rule 3)', () => {
  it('an older HIGHER-confidence insight beats a newer lower-confidence one — rule recency_tolerant_experiential', () => {
    const oldHigh = makeFact({
      id: 'h',
      attribute: 'vibe',
      source_kind: 'web_review',
      observed_at: '2026-01-01T00:00:00Z',
      confidence: 0.9,
    });
    const newLow = makeFact({
      id: 'l',
      attribute: 'vibe',
      source_kind: 'web_review',
      observed_at: '2026-06-01T00:00:00Z',
      confidence: 0.4,
    });
    const r = selectFact([oldHigh, newLow], NOW)!;
    expect(r.fact.id).toBe('h');
    expect(r.rule).toBe('recency_tolerant_experiential');
  });
});

describe('selectFact: verified visitor correction (rule 4)', () => {
  it('a NEWER corroborated correction outranks a recent official — rule verified_visitor_correction', () => {
    const official = makeFact({
      id: 'o',
      attribute: 'hours',
      source_kind: 'official_site',
      observed_at: '2026-05-01T00:00:00Z',
    });
    const correction = makeFact({
      id: 'c',
      attribute: 'hours',
      source_kind: 'user_correction',
      observed_at: '2026-06-15T00:00:00Z',
      corroboration_count: USER_CORRECTION_MIN_CORROBORATION,
    });
    const r = selectFact([official, correction], NOW)!;
    expect(r.fact.id).toBe('c');
    expect(r.rule).toBe('verified_visitor_correction');
  });

  it('a corroborated correction OLDER than a fresh (non-stale) official does NOT win', () => {
    const official = makeFact({
      id: 'o',
      attribute: 'hours',
      source_kind: 'official_site',
      observed_at: '2026-06-01T00:00:00Z',
    });
    const correction = makeFact({
      id: 'c',
      attribute: 'hours',
      source_kind: 'user_correction',
      observed_at: '2026-02-01T00:00:00Z',
      corroboration_count: USER_CORRECTION_MIN_CORROBORATION,
    });
    const r = selectFact([official, correction], NOW)!;
    expect(r.fact.id).toBe('o');
    expect(r.rule).toBe('official_operational');
  });

  it('a correction BELOW the N-confirmation threshold never wins via rule 4', () => {
    const official = makeFact({
      id: 'o',
      attribute: 'hours',
      source_kind: 'official_site',
      observed_at: '2026-05-01T00:00:00Z',
    });
    // Newer than the official, but only 1 confirmation (< N).
    const correction = makeFact({
      id: 'c',
      attribute: 'hours',
      source_kind: 'user_correction',
      observed_at: '2026-06-20T00:00:00Z',
      corroboration_count: USER_CORRECTION_MIN_CORROBORATION - 1,
    });
    const r = selectFact([official, correction], NOW)!;
    expect(r.fact.id).toBe('o');
    expect(r.rule).toBe('official_operational');
    expect(r.rule).not.toBe('verified_visitor_correction');
  });

  it('a corroborated correction beats a STALE official citation (> STALE_DAYS) even without being newer', () => {
    // official older than STALE_DAYS before NOW; correction older still, so ONLY
    // the staleness branch (not recency) can select it.
    const staleOfficial = makeFact({
      id: 'o',
      attribute: 'hours',
      source_kind: 'official_site',
      observed_at: '2025-01-15T00:00:00Z',
    });
    const correction = makeFact({
      id: 'c',
      attribute: 'hours',
      source_kind: 'user_correction',
      observed_at: '2025-01-01T00:00:00Z',
      corroboration_count: USER_CORRECTION_MIN_CORROBORATION,
    });
    // Sanity: the official really is stale relative to NOW.
    expect(Date.parse(staleOfficial.observed_at)).toBeLessThan(
      NOW.getTime() - STALE_DAYS * 86_400_000,
    );
    const r = selectFact([staleOfficial, correction], NOW)!;
    expect(r.fact.id).toBe('c');
    expect(r.rule).toBe('verified_visitor_correction');
  });

  it('when ALL facts are corroborated corrections, the newest wins via rule 4', () => {
    const older = makeFact({
      id: 'c1',
      attribute: 'vibe',
      source_kind: 'user_correction',
      observed_at: '2026-01-01T00:00:00Z',
      corroboration_count: USER_CORRECTION_MIN_CORROBORATION,
      confidence: 0.9,
    });
    const newer = makeFact({
      id: 'c2',
      attribute: 'vibe',
      source_kind: 'user_correction',
      observed_at: '2026-06-01T00:00:00Z',
      corroboration_count: USER_CORRECTION_MIN_CORROBORATION,
      confidence: 0.4,
    });
    const r = selectFact([older, newer], NOW)!;
    expect(r.fact.id).toBe('c2');
    expect(r.rule).toBe('verified_visitor_correction');
  });
});

describe('selectFact: exclusion, defaults, guards, determinism', () => {
  it('excludes rejected facts — a rejected official must not win', () => {
    const rejectedOfficial = makeFact({
      id: 'o',
      attribute: 'hours',
      source_kind: 'official_site',
      observed_at: '2026-06-01T00:00:00Z',
      status: 'rejected',
    });
    const blog = makeFact({
      id: 'b',
      attribute: 'hours',
      source_kind: 'web_review',
      observed_at: '2026-05-01T00:00:00Z',
      status: 'active',
    });
    const r = selectFact([rejectedOfficial, blog], NOW)!;
    expect(r.fact.id).toBe('b');
    // The rejected official is gone, so no official remains → fall-through rule.
    expect(r.rule).toBe('newest_time_sensitive');
  });

  it('returns null when all facts are rejected, and when the list is empty', () => {
    const allRejected = [
      makeFact({ id: 'r1', status: 'rejected' }),
      makeFact({ id: 'r2', status: 'rejected' }),
    ];
    expect(selectFact(allRejected, NOW)).toBeNull();
    expect(selectFact([], NOW)).toBeNull();
  });

  it('defaults an unknown attribute to experiential (confidence-led)', () => {
    expect(ATTRIBUTE_CLASS['mystery_attr']).toBeUndefined();
    const high = makeFact({
      id: 'a',
      attribute: 'mystery_attr',
      confidence: 0.9,
      observed_at: '2026-01-01T00:00:00Z',
    });
    const low = makeFact({
      id: 'b',
      attribute: 'mystery_attr',
      confidence: 0.3,
      observed_at: '2026-06-01T00:00:00Z',
    });
    const r = selectFact([high, low], NOW)!;
    expect(r.fact.id).toBe('a');
    expect(r.rule).toBe('recency_tolerant_experiential');
  });

  it('throws on a mixed-attribute input', () => {
    expect(() =>
      selectFact([makeFact({ attribute: 'hours' }), makeFact({ attribute: 'crowd_level' })], NOW),
    ).toThrow(/mixed attributes/);
  });

  it('is deterministic: exact duplicates except id resolve to a stable id tie-break', () => {
    const f1 = makeFact({
      id: 'aaa',
      attribute: 'vibe',
      confidence: 0.7,
      observed_at: '2026-01-01T00:00:00Z',
    });
    const f2 = makeFact({
      id: 'bbb',
      attribute: 'vibe',
      confidence: 0.7,
      observed_at: '2026-01-01T00:00:00Z',
    });
    const forward = selectFact([f1, f2], NOW)!;
    const reversed = selectFact([f2, f1], NOW)!;
    expect(forward.fact.id).toBe('aaa');
    expect(reversed.fact.id).toBe('aaa');
  });
});

describe('selectFactsByAttribute', () => {
  it('resolves each attribute independently — official wins hours, newest blog wins crowds (AC2)', () => {
    const facts = [
      makeFact({
        id: 'ho',
        attribute: 'hours',
        source_kind: 'official_site',
        observed_at: '2026-03-01T00:00:00Z',
      }),
      makeFact({
        id: 'hb',
        attribute: 'hours',
        source_kind: 'web_review',
        observed_at: '2026-05-01T00:00:00Z',
      }),
      makeFact({
        id: 'cb',
        attribute: 'crowd_level',
        source_kind: 'web_review',
        observed_at: '2026-05-01T00:00:00Z',
      }),
      makeFact({
        id: 'cw',
        attribute: 'crowd_level',
        source_kind: 'wikidata',
        observed_at: '2026-01-01T00:00:00Z',
      }),
    ];
    const m = selectFactsByAttribute(facts, NOW);
    expect(m.size).toBe(2);
    expect(m.get('hours')!.fact.id).toBe('ho');
    expect(m.get('hours')!.rule).toBe('official_operational');
    expect(m.get('crowd_level')!.fact.id).toBe('cb');
    expect(m.get('crowd_level')!.rule).toBe('newest_time_sensitive');
  });

  it('drops an attribute whose facts are all rejected', () => {
    const facts = [
      makeFact({ id: 'a', attribute: 'hours', status: 'rejected' }),
      makeFact({ id: 'b', attribute: 'vibe', confidence: 0.8, status: 'active' }),
    ];
    const m = selectFactsByAttribute(facts, NOW);
    expect(m.has('hours')).toBe(false);
    expect(m.get('vibe')!.fact.id).toBe('b');
  });
});

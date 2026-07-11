import { describe, it, expect } from 'vitest';
import { planShapingFeedback } from '../logic/feedback.ts';
import { addKid, emptyCompanions } from '../logic/companions.ts';

describe('plan-shaping feedback (AC #4)', () => {
  it('returns nothing before any shaping answer', () => {
    expect(planShapingFeedback({})).toEqual([]);
    expect(planShapingFeedback({ companions: emptyCompanions() })).toEqual([]);
  });

  it('surfaces family mode when kids are travelling', () => {
    const companions = addKid(emptyCompanions(), 6);
    expect(planShapingFeedback({ companions })).toContain(
      'Family mode: shorter walks, playground stops ✓',
    );
  });

  it('surfaces a line for pace, budget, and transport', () => {
    const lines = planShapingFeedback({ pace: 'relaxed', budget: 'budget', transport: 'walk' });
    expect(lines).toEqual([
      'Relaxed pace: fewer stops, longer breaks ✓',
      'Budget-friendly: free & low-cost picks first ✓',
      'On foot: tight, walkable clusters ✓',
    ]);
  });

  it('composes every shaping answer in a stable order (family → pace → budget → transport)', () => {
    const companions = addKid(emptyCompanions(), 4);
    const lines = planShapingFeedback({
      companions,
      pace: 'packed',
      budget: 'luxury',
      transport: 'transit',
    });
    expect(lines).toEqual([
      'Family mode: shorter walks, playground stops ✓',
      'Packed pace: more stops, tighter timing ✓',
      'Premium: standout, splurge-worthy picks surfaced ✓',
      'Transit-friendly: stops kept near lines ✓',
    ]);
  });

  it('ignores an unknown transport value', () => {
    expect(planShapingFeedback({ transport: 'teleport' })).toEqual([]);
  });
});

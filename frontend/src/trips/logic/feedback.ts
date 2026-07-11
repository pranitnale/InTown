import type { BudgetTier, Pace } from '@intown/contracts/types';
import { hasKids, type CompanionsState } from './companions.ts';

/**
 * Visible plan-shaping feedback (AC #4, §6.4). As the user answers, we surface
 * short, concrete lines telling them HOW each answer will change the plan —
 * "family mode: shorter walks, playground stops ✓". This is the friction-law
 * payoff: every question that earns a screen must visibly shape the output, and
 * this is where the user SEES it. Pure and unit-tested; the input is a plain
 * shape (not the wizard state) so there is no import cycle with `wizard.ts`.
 */
export interface PlanShapingInput {
  companions?: CompanionsState;
  pace?: Pace;
  budget?: BudgetTier;
  /** In-city transport preference (see `TRANSPORT_MODES` in `wizard.ts`). */
  transport?: string;
}

const PACE_FEEDBACK: Record<Pace, string> = {
  relaxed: 'Relaxed pace: fewer stops, longer breaks ✓',
  moderate: 'Balanced pace: a comfortable few stops a day ✓',
  packed: 'Packed pace: more stops, tighter timing ✓',
};

const BUDGET_FEEDBACK: Record<BudgetTier, string> = {
  budget: 'Budget-friendly: free & low-cost picks first ✓',
  moderate: 'Mid-range: a mix of free and paid picks ✓',
  comfort: 'Comfort-first: fewer, better picks ✓',
  luxury: 'Premium: standout, splurge-worthy picks surfaced ✓',
};

const TRANSPORT_FEEDBACK: Record<string, string> = {
  walk: 'On foot: tight, walkable clusters ✓',
  transit: 'Transit-friendly: stops kept near lines ✓',
  car: 'Driving: parking-aware stops, wider spread ✓',
  bike: 'Cycling: flat, bike-friendly routing ✓',
  mixed: 'Mixed transport: routed for the easiest hop ✓',
};

/**
 * The feedback lines earned by the answers so far, in a stable order. Returns
 * `[]` before anything shaping has been answered.
 */
export function planShapingFeedback(input: PlanShapingInput): string[] {
  const lines: string[] = [];
  if (input.companions && hasKids(input.companions)) {
    lines.push('Family mode: shorter walks, playground stops ✓');
  }
  if (input.pace) lines.push(PACE_FEEDBACK[input.pace]);
  if (input.budget) lines.push(BUDGET_FEEDBACK[input.budget]);
  const transportLine = input.transport ? TRANSPORT_FEEDBACK[input.transport] : undefined;
  if (transportLine) lines.push(transportLine);
  return lines;
}

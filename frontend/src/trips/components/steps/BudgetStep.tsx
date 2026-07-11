import type { BudgetTier } from '@intown/contracts/types';
import { Card } from '../../../design-system/index.ts';
import { ChoiceList, type Choice } from './ChoiceList.tsx';

const BUDGET_OPTIONS: readonly Choice<BudgetTier>[] = [
  { value: 'budget', label: 'Budget', hint: 'Free & low-cost picks first.' },
  { value: 'moderate', label: 'Moderate', hint: 'A mix of free and paid.' },
  { value: 'comfort', label: 'Comfort', hint: 'Fewer, better picks.' },
  { value: 'luxury', label: 'Luxury', hint: 'Standout, splurge-worthy picks.' },
];

export interface BudgetStepProps {
  value: BudgetTier | undefined;
  onChange: (value: BudgetTier) => void;
}

/** Step 4 — budget band (§6.4). */
export function BudgetStep({ value, onChange }: BudgetStepProps) {
  return (
    <Card why="Budget sets which places and prices we surface first." className="p-5">
      <h2 className="mb-1 text-lg font-semibold leading-tight text-text">What’s your budget?</h2>
      <p className="mb-4 text-sm text-text-secondary">
        We’ll bias picks toward this band — you’ll still see the occasional standout.
      </p>
      <ChoiceList options={BUDGET_OPTIONS} value={value} onChange={onChange} ariaLabel="Budget band" />
    </Card>
  );
}

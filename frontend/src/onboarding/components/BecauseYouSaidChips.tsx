import type { TasteProfile } from '@intown/contracts/types';
import { Chip, cn } from '../../design-system/index.ts';
import { interestLabel } from '../logic/interests.ts';

export interface BecauseYouSaidChipsProps {
  /** The stored taste answers to resurface. */
  taste: Pick<TasteProfile, 'interests' | 'dietary' | 'pace' | 'budget_tier'>;
  /** Cap the number of interest chips (default 6). */
  maxInterests?: number;
  className?: string;
}

/**
 * "Because you said X" chips (AC #5). Every stored taste answer resurfaces as a
 * visible `because-you-said` chip, so personalization users can SEE what the app
 * remembers (they see it, they believe it). Uses the design-system chip variant.
 */
export function BecauseYouSaidChips({ taste, maxInterests = 6, className }: BecauseYouSaidChipsProps) {
  const chips: string[] = [
    ...taste.interests.slice(0, maxInterests).map((t) => interestLabel(t)),
    ...taste.dietary.map((d) => interestLabel(d)),
    `${taste.pace} pace`,
    `${taste.budget_tier} budget`,
  ];

  if (chips.length === 0) return null;

  return (
    <ul className={cn('flex flex-wrap gap-2', className)} aria-label="What you told us">
      {chips.map((label, i) => (
        <li key={`${label}-${i}`}>
          <Chip variant="because-you-said">Because you said: {label}</Chip>
        </li>
      ))}
    </ul>
  );
}

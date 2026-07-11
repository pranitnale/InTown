import { Chip, cn } from '../../design-system/index.ts';

export interface PlanShapingFeedbackProps {
  /** Feedback lines from `logic/feedback.ts` (each already ends with " ✓"). */
  lines: string[];
  className?: string;
}

/**
 * Visible plan-shaping feedback (AC #4). Renders the earned feedback lines as
 * `verified-visit` chips so the user SEES how each answer changes the plan. Null
 * until something shaping has been answered.
 */
export function PlanShapingFeedback({ lines, className }: PlanShapingFeedbackProps) {
  if (lines.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-2', className)} aria-label="How this shapes your plan">
      {lines.map((line) => (
        <li key={line}>
          <Chip variant="verified-visit">{line}</Chip>
        </li>
      ))}
    </ul>
  );
}

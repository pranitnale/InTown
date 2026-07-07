import type { QuizProgress } from '../logic/quiz.ts';
import { cn } from '../../design-system/index.ts';

export interface ProgressBarProps {
  progress: QuizProgress;
  /** The genuinely-earned reason for the pre-completed first step (AC #4). */
  earnedReason: string;
  className?: string;
}

/**
 * Endowed-progress bar (AC #4). Renders the earned first step's label + a REAL
 * reason, so the head-start is honest, not fabricated. The fill reflects
 * `completed / total`, which starts at 1/total because the endowed step is
 * genuinely done.
 */
export function ProgressBar({ progress, earnedReason, className }: ProgressBarProps) {
  const pct = Math.round((progress.completed / progress.total) * 100);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-text">{progress.label}</span>
        <span className="text-xs text-text-tertiary tabular-nums">
          Step {progress.currentStep} of {progress.total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.completed}
        aria-label={progress.label}
        className="h-2 w-full overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-text-secondary">{earnedReason}</p>
    </div>
  );
}

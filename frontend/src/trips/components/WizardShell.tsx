import type { ReactNode } from 'react';
import { Button } from '../../design-system/index.ts';
import { ProgressBar } from '../../onboarding/index.ts';
import type { WizardProgress } from '../logic/wizard.ts';
import { PlanShapingFeedback } from './PlanShapingFeedback.tsx';

export interface WizardShellProps {
  progress: WizardProgress;
  /** The genuinely-earned reason for the endowed first step. */
  earnedReason: string;
  /** Visible plan-shaping feedback lines (AC #4). */
  feedback: string[];
  /** The active step's content (one question per screen). */
  children: ReactNode;
  canBack: boolean;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  /** Busy flag on the primary action (e.g. saving). */
  busy?: boolean;
  /** Save/create error to surface with `role="alert"`. */
  error?: string | null;
}

/**
 * Presentation chrome for the trip-setup wizard (§6.4). Renders the endowed
 * progress bar (reusing the onboarding `ProgressBar`), the visible plan-shaping
 * feedback, the single on-screen step, and Back / Next(or Save) navigation.
 * All progression logic lives in `logic/wizard.ts`; this is the shell.
 */
export function WizardShell({
  progress,
  earnedReason,
  feedback,
  children,
  canBack,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  busy,
  error,
}: WizardShellProps) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <ProgressBar progress={progress} earnedReason={earnedReason} />
      <PlanShapingFeedback lines={feedback} />
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
      <div>{children}</div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} disabled={!canBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext} disabled={nextDisabled || busy}>
          {busy ? 'Saving…' : nextLabel}
        </Button>
      </div>
    </section>
  );
}

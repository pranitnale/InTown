import { useMemo, useState } from 'react';
import { Button, Card, cn, FOCUS_RING } from '../../design-system/index.ts';
import {
  answer as answerReducer,
  back as backReducer,
  currentQuestion,
  initQuiz,
  progress as computeProgress,
  type EndowedStep,
  type QuizConfig,
  type QuizQuestion,
  type QuizState,
} from '../logic/quiz.ts';
import { ProgressBar } from './ProgressBar.tsx';

export interface QuizChoice {
  value: string;
  label: string;
}

export interface QuizChoiceQuestion extends QuizQuestion {
  options: readonly QuizChoice[];
}

export interface QuizFrameworkProps {
  endowed: EndowedStep;
  questions: readonly QuizChoiceQuestion[];
  /** Fired with all answers once the last question is answered. */
  onComplete: (answers: Record<string, string>) => void;
  className?: string;
}

/**
 * Reusable progressive-profiling quiz (AC #4). ONE question per screen, an
 * endowed progress bar with a genuinely-earned first step, and Back navigation.
 * All progression logic lives in `logic/quiz.ts` (pure, unit-tested); this is
 * the presentation shell. P07 reuses it for the trip-scoped flow.
 */
export function QuizFramework({ endowed, questions, onComplete, className }: QuizFrameworkProps) {
  const config: QuizConfig = useMemo(() => ({ endowed, questions }), [endowed, questions]);
  const [state, setState] = useState<QuizState>(() => initQuiz(config));

  const active = currentQuestion(config, state);
  const prog = computeProgress(config, state);
  const uiQuestion = active
    ? questions.find((q) => q.id === active.id) ?? null
    : null;

  function choose(value: string) {
    if (!active) return;
    const next = answerReducer(config, state, active.id, value);
    setState(next);
    if (next.done) onComplete(next.answers);
  }

  return (
    <section className={cn('mx-auto flex w-full max-w-md flex-col gap-6', className)}>
      <ProgressBar progress={prog} earnedReason={endowed.reason} />

      {uiQuestion ? (
        <Card
          why={uiQuestion.rationale ?? 'This changes what we suggest.'}
          className="p-5"
        >
          <h2 className="mb-1 text-lg font-semibold leading-tight text-text">{uiQuestion.prompt}</h2>
          {uiQuestion.rationale ? (
            <p className="mb-4 text-sm text-text-secondary">{uiQuestion.rationale}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            {uiQuestion.options.map((opt) => {
              const selected = state.answers[uiQuestion.id] === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => choose(opt.value)}
                  aria-pressed={selected}
                  className={cn(
                    'w-full rounded-lg border px-4 py-3 text-left text-base',
                    'transition-colors motion-reduce:transition-none',
                    selected
                      ? 'border-primary bg-primary/10 text-text'
                      : 'border-border bg-surface text-text hover:bg-bg',
                    FOCUS_RING,
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card why="All set." className="p-5">
          <p className="text-base text-text">Thanks — that all shapes what we suggest.</p>
        </Card>
      )}

      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={() => setState(backReducer(state))}
          disabled={state.cursor === 0 && !state.done}
        >
          Back
        </Button>
      </div>
    </section>
  );
}

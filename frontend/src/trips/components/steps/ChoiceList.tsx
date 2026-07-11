import { cn, FOCUS_RING } from '../../../design-system/index.ts';

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export interface ChoiceListProps<T extends string> {
  options: readonly Choice<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/**
 * One-question-per-screen single-select list, matching the onboarding
 * `QuizFramework` option styling (selected = primary tint, `aria-pressed`).
 * Shared by the pace / budget / transport steps.
 */
export function ChoiceList<T extends string>({ options, value, onChange, ariaLabel }: ChoiceListProps<T>) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'w-full rounded-lg border px-4 py-3 text-left',
              'transition-colors motion-reduce:transition-none',
              selected
                ? 'border-primary bg-primary/10 text-text'
                : 'border-border bg-surface text-text hover:bg-bg',
              FOCUS_RING,
            )}
          >
            <span className="block text-base font-medium">{opt.label}</span>
            {opt.hint ? <span className="block text-sm text-text-secondary">{opt.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

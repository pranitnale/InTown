import { useState } from 'react';
import { cn, FOCUS_RING } from '../../design-system/index.ts';
import { addUnique, removeValue } from '../logic/dragRank.ts';
import { interestLabel } from '../logic/interests.ts';

export interface AntiPreferenceControlProps {
  /** Soft "skip" tags (down-weight, NOT a veto). */
  values: string[];
  onChange: (next: string[]) => void;
  /** Suggested tags offered as quick-add chips. */
  suggestions?: readonly string[];
  className?: string;
}

const DEFAULT_SUGGESTIONS = ['crowded_nightlife', 'long_hikes', 'queues', 'guided_tours'] as const;

/**
 * Anti-preferences (AC #2) — SOFT down-weight. Semantically distinct from a hard
 * exclusion: these reduce how often something appears ("skip museums") but never
 * veto it, so an exceptional item can still surface. Neutral styling
 * deliberately reads as "less of this", not "never".
 */
export function AntiPreferenceControl({
  values,
  onChange,
  suggestions = DEFAULT_SUGGESTIONS,
  className,
}: AntiPreferenceControlProps) {
  const [draft, setDraft] = useState('');
  const available = suggestions.filter((s) => !values.includes(s));

  function addDraft() {
    const tag = draft.trim().toLowerCase().replace(/\s+/g, '_');
    if (tag) onChange(addUnique(values, tag));
    setDraft('');
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div>
        <h3 className="text-sm font-semibold text-text">Less of this, please</h3>
        <p className="text-xs text-text-secondary">
          Soft preference — we&rsquo;ll show fewer of these, but a standout can still appear.
        </p>
      </div>

      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Current anti-preferences">
          {values.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onChange(removeValue(values, tag))}
                aria-label={`Remove skip preference ${interestLabel(tag)}`}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-sm text-text-secondary',
                  FOCUS_RING,
                )}
              >
                {interestLabel(tag)}
                <span aria-hidden className="text-text-tertiary">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {available.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {available.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(addUnique(values, tag))}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-sm text-text-secondary hover:text-text',
                FOCUS_RING,
              )}
            >
              <span aria-hidden>+</span>
              {interestLabel(tag)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder="Add your own…"
          aria-label="Add an anti-preference"
          className={cn(
            'min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-base text-text placeholder:text-text-tertiary',
            FOCUS_RING,
          )}
        />
        <button
          type="button"
          onClick={addDraft}
          className={cn('rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text', FOCUS_RING)}
        >
          Add
        </button>
      </div>
    </div>
  );
}

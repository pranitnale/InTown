import { useState } from 'react';
import { cn, FOCUS_RING, IconAlertTriangle } from '../../design-system/index.ts';
import { addUnique, toggleValue } from '../logic/dragRank.ts';
import { interestLabel } from '../logic/interests.ts';

export interface HardExclusionControlProps {
  /** Absolute-veto tags. Honored absolutely — never surfaced, no override. */
  values: string[];
  onChange: (next: string[]) => void;
  /** Checkbox options offered ("Never show me: ☑ …"). */
  options?: readonly string[];
  className?: string;
}

const DEFAULT_OPTIONS = ['casinos', 'nightlife', 'museums', 'shopping', 'religious_sites'] as const;

/**
 * Hard exclusions (AC #2) — an ABSOLUTE veto, semantically and visually distinct
 * from soft anti-preferences. Rendered as a "Never show me" checkbox list with a
 * caution treatment (warning border + icon) so the different, stronger meaning
 * is unmistakable: a hard-excluded tag is NEVER surfaced (no museum-problem
 * override applies).
 */
export function HardExclusionControl({
  values,
  onChange,
  options = DEFAULT_OPTIONS,
  className,
}: HardExclusionControlProps) {
  const [draft, setDraft] = useState('');
  // Union of preset options and any custom-added exclusions, so custom ones show too.
  const rows = [...options, ...values.filter((v) => !options.includes(v))];

  function addDraft() {
    const tag = draft.trim().toLowerCase().replace(/\s+/g, '_');
    if (tag) onChange(addUnique(values, tag));
    setDraft('');
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-warning bg-warning/10 p-4',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-0.5 text-warning">
          <IconAlertTriangle />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-text">Never show me</h3>
          <p className="text-xs text-text-secondary">
            An absolute rule — these are never suggested, no exceptions.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5" aria-label="Hard exclusions">
        {rows.map((tag) => {
          const checked = values.includes(tag);
          return (
            <li key={tag}>
              <label className="flex cursor-pointer items-center gap-2.5 py-1 text-base text-text">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(toggleValue(values, tag))}
                  className={cn('h-4 w-4 shrink-0 accent-warning', FOCUS_RING)}
                />
                <span>{interestLabel(tag)}</span>
                {checked ? (
                  <span className="ml-auto text-xs font-medium text-text-secondary">excluded</span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>

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
          placeholder="Add something to never show…"
          aria-label="Add a hard exclusion"
          className={cn(
            'min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-base text-text placeholder:text-text-tertiary',
            FOCUS_RING,
          )}
        />
        <button
          type="button"
          onClick={addDraft}
          className={cn('rounded-lg border border-warning bg-surface px-3 py-2 text-sm font-medium text-text', FOCUS_RING)}
        >
          Add
        </button>
      </div>
    </div>
  );
}

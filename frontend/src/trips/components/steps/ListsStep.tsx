import { useState } from 'react';
import { Button, Card, Chip, Input, cn, FOCUS_RING } from '../../../design-system/index.ts';
import type { WizardAnswers } from '../../logic/wizard.ts';

export interface ListsStepProps {
  answers: WizardAnswers;
  patch: (patch: Partial<WizardAnswers>) => void;
}

function TagList({
  label,
  hint,
  items,
  onAdd,
  onRemove,
  variant,
}: {
  label: string;
  hint: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  variant: 'must-see' | 'caution';
}) {
  const [draft, setDraft] = useState('');
  function commit() {
    const value = draft.trim();
    if (value.length === 0) return;
    onAdd(value);
    setDraft('');
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={label}
            helperText={hint}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
          />
        </div>
        <Button variant="secondary" onClick={commit} aria-label={`Add to ${label}`}>
          Add
        </Button>
      </div>
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <li key={`${item}-${i}`}>
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => onRemove(i)}
                className={cn('rounded-full', FOCUS_RING)}
              >
                <Chip variant={variant}>{item} ✕</Chip>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Step 8 — must-see + avoid lists (§6.4). Both optional and skippable. Must-see
 * items are honoured even against a low taste weight; avoid items are soft
 * down-weights the plan respects.
 */
export function ListsStep({ answers, patch }: ListsStepProps) {
  return (
    <Card why="Must-sees are always honoured; avoids are respected as soft down-weights." className="p-5">
      <h2 className="mb-1 text-lg font-semibold leading-tight text-text">Anything specific?</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Optional. Add anything you must see, or anything to avoid. Skip and we’ll go on your taste.
      </p>
      <div className="flex flex-col gap-5">
        <TagList
          label="Must see"
          hint="We’ll make sure these make the plan."
          items={answers.mustSee}
          variant="must-see"
          onAdd={(value) => patch({ mustSee: [...answers.mustSee, value] })}
          onRemove={(i) => patch({ mustSee: answers.mustSee.filter((_, idx) => idx !== i) })}
        />
        <TagList
          label="Avoid"
          hint="We’ll steer the plan away from these."
          items={answers.avoid}
          variant="caution"
          onAdd={(value) => patch({ avoid: [...answers.avoid, value] })}
          onRemove={(i) => patch({ avoid: answers.avoid.filter((_, idx) => idx !== i) })}
        />
      </div>
    </Card>
  );
}

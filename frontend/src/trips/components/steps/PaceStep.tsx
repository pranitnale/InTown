import type { Pace } from '@intown/contracts/types';
import { Card } from '../../../design-system/index.ts';
import { ChoiceList, type Choice } from './ChoiceList.tsx';

const PACE_OPTIONS: readonly Choice<Pace>[] = [
  { value: 'relaxed', label: 'Relaxed', hint: 'Fewer stops, longer breaks — packed ↔ relaxed.' },
  { value: 'moderate', label: 'Balanced', hint: 'A comfortable few stops a day.' },
  { value: 'packed', label: 'Packed', hint: 'See as much as possible.' },
];

export interface PaceStepProps {
  value: Pace | undefined;
  onChange: (value: Pace) => void;
  /**
   * "Starting point" copy when a pace was pre-selected from an adult age band
   * (`pacePresetReason`). Shown to explain the editable default — never a cap.
   */
  presetReason?: string;
}

/** Step 3 — pace (packed ↔ relaxed) (§6.4). */
export function PaceStep({ value, onChange, presetReason }: PaceStepProps) {
  return (
    <Card why="Pace decides how many stops we fit into each day." className="p-5">
      <h2 className="mb-1 text-lg font-semibold leading-tight text-text">What’s your pace?</h2>
      <p className="mb-4 text-sm text-text-secondary">
        This sets how densely we schedule your days. Change it anytime.
      </p>
      {presetReason ? (
        <p className="mb-4 text-xs text-text-secondary">{presetReason}</p>
      ) : null}
      <ChoiceList options={PACE_OPTIONS} value={value} onChange={onChange} ariaLabel="Trip pace" />
    </Card>
  );
}

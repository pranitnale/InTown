import { Card } from '../../../design-system/index.ts';
import type { TransportMode } from '../../logic/wizard.ts';
import { ChoiceList, type Choice } from './ChoiceList.tsx';

const TRANSPORT_OPTIONS: readonly Choice<TransportMode>[] = [
  { value: 'walk', label: 'On foot', hint: 'Tight, walkable clusters.' },
  { value: 'transit', label: 'Public transit', hint: 'Stops near lines.' },
  { value: 'car', label: 'Car', hint: 'Parking-aware, wider spread.' },
  { value: 'bike', label: 'Bike', hint: 'Flat, bike-friendly routing.' },
  { value: 'mixed', label: 'A mix', hint: 'Whatever’s easiest per hop.' },
];

export interface TransportStepProps {
  value: TransportMode | undefined;
  onChange: (value: TransportMode) => void;
}

/** Step 7 — in-city transport mode (§6.4). */
export function TransportStep({ value, onChange }: TransportStepProps) {
  return (
    <Card why="How you get around decides how far apart stops can be." className="p-5">
      <h2 className="mb-1 text-lg font-semibold leading-tight text-text">How will you get around?</h2>
      <p className="mb-4 text-sm text-text-secondary">
        We route your days around this. Skip it and we’ll assume mostly on foot.
      </p>
      <ChoiceList
        options={TRANSPORT_OPTIONS}
        value={value}
        onChange={onChange}
        ariaLabel="In-city transport"
      />
    </Card>
  );
}

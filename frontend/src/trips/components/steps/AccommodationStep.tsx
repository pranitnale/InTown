import { Button, Card, Input } from '../../../design-system/index.ts';
import type { WizardAnswers } from '../../logic/wizard.ts';

export interface AccommodationStepProps {
  answers: WizardAnswers;
  patch: (patch: Partial<WizardAnswers>) => void;
}

/**
 * Step 6 — accommodation anchor (location/address/skip) (§6.4). The anchor lets
 * day plans start and end near where you’re staying. Fully skippable.
 */
export function AccommodationStep({ answers, patch }: AccommodationStepProps) {
  const label = answers.accommodation?.label ?? '';
  return (
    <Card why="An anchor lets each day start and end near where you’re staying." className="p-5">
      <h2 className="mb-1 text-lg font-semibold leading-tight text-text">Where are you staying?</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Optional — an area or address is enough. We’ll anchor your days near it.
      </p>
      <div className="flex flex-col gap-3">
        <Input
          label="Area or address"
          placeholder="e.g. Ribeira, or a street address"
          value={label}
          onChange={(e) =>
            patch({ accommodation: { label: e.target.value }, accommodationSkipped: false })
          }
        />
        <div>
          <Button
            variant={answers.accommodationSkipped ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={answers.accommodationSkipped}
            onClick={() => patch({ accommodation: null, accommodationSkipped: true })}
          >
            Skip for now
          </Button>
        </div>
      </div>
    </Card>
  );
}

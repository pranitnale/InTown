import { Card, Input } from '../../../design-system/index.ts';
import { dateRangeError, type WizardAnswers } from '../../logic/wizard.ts';

export interface CityDatesStepProps {
  answers: WizardAnswers;
  patch: (patch: Partial<WizardAnswers>) => void;
}

const FIELD =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-text ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

/**
 * Step 1 — city + dates + arrival/departure times (§6.4). The one REQUIRED
 * step: choosing a real destination and dates is what genuinely earns the
 * endowed first step of the progress bar. Times shape the arrival/departure-day
 * plans downstream.
 */
export function CityDatesStep({ answers, patch }: CityDatesStepProps) {
  const rangeError = dateRangeError(answers);
  return (
    <Card why="Your destination and dates are the only things we truly need." className="p-5">
      <h2 className="mb-1 text-lg font-semibold leading-tight text-text">Where and when?</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Pick your city and dates. Everything after this is optional — but each answer visibly shapes
        your plan.
      </p>
      <div className="flex flex-col gap-4">
        <Input
          label="City"
          placeholder="e.g. Porto"
          value={answers.city}
          onChange={(e) => patch({ city: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Arrive</span>
            <input
              type="date"
              className={FIELD}
              value={answers.arrive}
              onChange={(e) => patch({ arrive: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Depart</span>
            <input
              type="date"
              className={FIELD}
              value={answers.depart}
              onChange={(e) => patch({ depart: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Arrival time</span>
            <input
              type="time"
              className={FIELD}
              value={answers.arriveTime}
              onChange={(e) => patch({ arriveTime: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Departure time</span>
            <input
              type="time"
              className={FIELD}
              value={answers.departTime}
              onChange={(e) => patch({ departTime: e.target.value })}
            />
          </label>
        </div>
        {rangeError ? (
          <p role="alert" className="text-sm text-error">
            {rangeError}
          </p>
        ) : null}
        <p className="text-xs text-text-tertiary">
          Times help us shape a lighter arrival day and a realistic departure day.
        </p>
      </div>
    </Card>
  );
}

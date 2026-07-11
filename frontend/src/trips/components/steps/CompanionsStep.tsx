import { AGE_BAND_VALUES } from '@intown/contracts/types';
import { Button, Card, Chip, cn, FOCUS_RING } from '../../../design-system/index.ts';
import {
  addKid,
  removeKid,
  setAdults,
  setKidAge,
  toggleAdultAgeBand,
  type CompanionsState,
} from '../../logic/companions.ts';

export interface CompanionsStepProps {
  companions: CompanionsState;
  onChange: (next: CompanionsState) => void;
}

/**
 * Step 2 — companions (incl. kids' ages) + adult age bands (§6.4). Age chips
 * are SKIPPABLE and only pre-select an editable pace preset — never a cap
 * (§6.2 anti-ageism). Kids' ages help with ticket pricing & pacing.
 */
export function CompanionsStep({ companions, onChange }: CompanionsStepProps) {
  return (
    <Card why="Who’s coming shapes pacing, ticket prices, and family-friendly picks." className="p-5">
      <h2 className="mb-1 text-lg font-semibold leading-tight text-text">Who’s coming?</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Optional — it helps with ticket prices &amp; pacing. Skip anything that doesn’t apply.
      </p>

      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">Adults</span>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Fewer adults"
              onClick={() => onChange(setAdults(companions, companions.adults - 1))}
            >
              −
            </Button>
            <span className="min-w-6 text-center text-base tabular-nums text-text">
              {companions.adults}
            </span>
            <Button
              variant="secondary"
              size="sm"
              aria-label="More adults"
              onClick={() => onChange(setAdults(companions, companions.adults + 1))}
            >
              +
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">Kids</span>
            <Button variant="secondary" size="sm" onClick={() => onChange(addKid(companions, 8))}>
              Add a kid
            </Button>
          </div>
          {companions.kids.length === 0 ? (
            <p className="text-xs text-text-tertiary">No kids on this trip.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {companions.kids.map((age, i) => (
                <li key={i} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-text">
                    Age
                    <input
                      type="number"
                      min={0}
                      max={17}
                      value={age}
                      aria-label={`Age of kid ${i + 1}`}
                      onChange={(e) => onChange(setKidAge(companions, i, Number(e.target.value)))}
                      className={cn(
                        'w-16 rounded-lg border border-border bg-surface px-2 py-1 text-base text-text',
                        FOCUS_RING,
                      )}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove kid ${i + 1}`}
                    onClick={() => onChange(removeKid(companions, i))}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text">Adult age bands (optional)</span>
          <p className="text-xs text-text-tertiary">
            Helps with ticket prices &amp; pacing — a starting suggestion, never a limit.
          </p>
          <div className="flex flex-wrap gap-2">
            {AGE_BAND_VALUES.map((band) => {
              const selected = companions.adultAgeBands.includes(band);
              return (
                <button
                  key={band}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(toggleAdultAgeBand(companions, band))}
                  className={cn('rounded-full', FOCUS_RING)}
                >
                  <Chip variant={selected ? 'verified-visit' : 'because-you-said'} icon={null}>
                    {band}
                  </Chip>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

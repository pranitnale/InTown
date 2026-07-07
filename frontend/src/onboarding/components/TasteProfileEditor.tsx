import { useEffect, useState } from 'react';
import {
  BUDGET_TIER_VALUES,
  PACE_VALUES,
  type AgeBand,
  type BudgetTier,
  type Pace,
  type TasteProfile,
} from '@intown/contracts/types';
import type { UpdateTasteProfileBody } from '@intown/contracts/api';
import { Button, cn, FOCUS_RING } from '../../design-system/index.ts';
import { DragRankList } from './DragRankList.tsx';
import { AntiPreferenceControl } from './AntiPreferenceControl.tsx';
import { HardExclusionControl } from './HardExclusionControl.tsx';
import { BecauseYouSaidChips } from './BecauseYouSaidChips.tsx';
import { DefiningSightOverride } from './DefiningSightOverride.tsx';
import { pacePresetFor, pacePresetReason } from '../logic/pace.ts';
import { addUnique, removeValue } from '../logic/dragRank.ts';
import { interestLabel } from '../logic/interests.ts';
import type { DefiningSight, TasteRanking } from '../logic/override.ts';

export interface TasteProfileEditorProps {
  value: TasteProfile | null;
  /** Seeds the interest ranking when there's no saved profile yet (from swipe). */
  initialInterests?: string[];
  /** Seeds the budget tier when there's no saved profile yet (from the quiz). */
  initialBudget?: BudgetTier;
  /** Age band from the traveler profile — drives the editable pace preset (AC #7). */
  ageBand?: AgeBand;
  onSave: (body: UpdateTasteProfileBody) => Promise<void> | void;
  className?: string;
}

const BUDGET_LABELS: Record<BudgetTier, string> = {
  budget: 'Budget',
  moderate: 'Moderate',
  comfort: 'Comfort',
  luxury: 'Luxury',
};

const PACE_LABELS: Record<Pace, string> = {
  relaxed: 'Relaxed',
  moderate: 'Moderate',
  packed: 'Packed',
};

const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'halal', 'gluten_free', 'kosher'] as const;

/** A tiny sample catalog of city-defining sights used to demo the museum-problem
 *  override live in the editor (AC #3). */
const DEFINING_SIGHTS: readonly DefiningSight[] = [
  { id: 'louvre', title: 'The Louvre', interestTag: 'museums', reason: "it's this city's defining collection" },
  { id: 'skyline', title: 'Skyline viewpoint', interestTag: 'viewpoints', reason: 'it is the definitive view of the city' },
];

export function TasteProfileEditor({
  value,
  initialInterests,
  initialBudget,
  ageBand,
  onSave,
  className,
}: TasteProfileEditorProps) {
  const [interests, setInterests] = useState<string[]>(value?.interests ?? initialInterests ?? []);
  const [antiPrefs, setAntiPrefs] = useState<string[]>(value?.anti_preferences ?? []);
  const [hardExclusions, setHardExclusions] = useState<string[]>(value?.hard_exclusions ?? []);
  const [dietary, setDietary] = useState<string[]>(value?.dietary ?? []);
  const [budget, setBudget] = useState<BudgetTier>(value?.budget_tier ?? initialBudget ?? 'moderate');
  const [pace, setPace] = useState<Pace>(
    value?.pace ?? (ageBand ? pacePresetFor(ageBand) : 'moderate'),
  );
  const [paceTouched, setPaceTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  // AC #7: age band pre-selects an editable pace preset. If the user hasn't
  // explicitly changed the pace, follow the age-band preset; once touched, the
  // user's choice wins (never a cap).
  useEffect(() => {
    if (ageBand && !paceTouched && !value?.pace) {
      setPace(pacePresetFor(ageBand));
    }
  }, [ageBand, paceTouched, value?.pace]);

  const taste: TasteRanking = { interests, anti_preferences: antiPrefs, hard_exclusions: hardExclusions };

  function applyRanking(next: TasteRanking) {
    setInterests(next.interests);
    setAntiPrefs(next.anti_preferences);
    setHardExclusions(next.hard_exclusions);
  }

  async function save() {
    setBusy(true);
    try {
      await onSave({
        interests,
        anti_preferences: antiPrefs,
        hard_exclusions: hardExclusions,
        dietary,
        budget_tier: budget,
        pace,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn('flex flex-col gap-7', className)}>
      {value ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-text">What we remember</h3>
          <BecauseYouSaidChips taste={value} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text">Rank your interests</h3>
          <p className="text-xs text-text-secondary">
            Drag to order — higher = we lean into it more. Order is the whole story; there&rsquo;s no
            hidden score.
          </p>
        </div>
        <DragRankList values={interests} onChange={setInterests} label="Ranked interests" />
      </section>

      {DEFINING_SIGHTS.map((sight) => (
        <DefiningSightOverride key={sight.id} taste={taste} sight={sight} onRemove={applyRanking} />
      ))}

      <section>
        <AntiPreferenceControl values={antiPrefs} onChange={setAntiPrefs} />
      </section>

      <section>
        <HardExclusionControl values={hardExclusions} onChange={setHardExclusions} />
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-text">Dietary</legend>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((d) => {
            const on = dietary.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDietary(on ? removeValue(dietary, d) : addUnique(dietary, d))}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium',
                  on
                    ? 'border-primary bg-primary/10 text-text'
                    : 'border-border bg-surface text-text-secondary hover:text-text',
                  FOCUS_RING,
                )}
              >
                {interestLabel(d)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-text">Budget</legend>
        <div className="flex flex-wrap gap-2">
          {BUDGET_TIER_VALUES.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={budget === b}
              onClick={() => setBudget(b)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium',
                budget === b
                  ? 'border-primary bg-primary/10 text-text'
                  : 'border-border bg-surface text-text-secondary hover:text-text',
                FOCUS_RING,
              )}
            >
              {BUDGET_LABELS[b]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-text">Pace</legend>
        {ageBand ? (
          <p className="text-xs text-text-secondary">{pacePresetReason(ageBand)}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {PACE_VALUES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={pace === p}
              onClick={() => {
                setPace(p);
                setPaceTouched(true);
              }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium',
                pace === p
                  ? 'border-primary bg-primary/10 text-text'
                  : 'border-border bg-surface text-text-secondary hover:text-text',
                FOCUS_RING,
              )}
            >
              {PACE_LABELS[p]}
            </button>
          ))}
        </div>
        {ageBand && paceTouched ? (
          <button
            type="button"
            onClick={() => {
              setPace(pacePresetFor(ageBand));
              setPaceTouched(false);
            }}
            className={cn('self-start text-xs font-medium text-link underline-offset-2 hover:underline', FOCUS_RING)}
          >
            Reset to suggested
          </button>
        ) : null}
      </fieldset>

      <div>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save taste profile'}
        </Button>
      </div>
    </div>
  );
}

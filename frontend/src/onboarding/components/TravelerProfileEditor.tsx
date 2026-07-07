import { useState } from 'react';
import {
  AGE_BAND_VALUES,
  MOBILITY_VALUES,
  type AgeBand,
  type Mobility,
  type TravelerProfile,
} from '@intown/contracts/types';
import type { UpdateTravelerProfileBody } from '@intown/contracts/api';
import { Button, Toggle, cn, FOCUS_RING } from '../../design-system/index.ts';
import { addUnique, removeValue } from '../logic/dragRank.ts';

export interface TravelerProfileEditorProps {
  value: TravelerProfile | null;
  onSave: (body: UpdateTravelerProfileBody) => Promise<void> | void;
  /** Notified whenever the age band changes (drives the pace preset, AC #7). */
  onAgeBandChange?: (band: AgeBand) => void;
  className?: string;
}

const AGE_LABELS: Record<AgeBand, string> = {
  '<18': 'Under 18',
  '18-25': '18–25',
  '26-44': '26–44',
  '45-64': '45–64',
  '65+': '65+',
};

const MOBILITY_LABELS: Record<Mobility, string> = {
  full: 'No constraints',
  limited: 'Limited walking',
  wheelchair: 'Wheelchair',
  stroller: 'Stroller / pram',
};

/**
 * Traveler profile editor (AC #1). Age band, mobility, EU residency, student,
 * languages (BCP-47), currency. Age band selection notifies `onAgeBandChange`
 * so a pace preset can be suggested (never enforced — AC #7). Saves via the
 * partial PUT upsert body.
 */
export function TravelerProfileEditor({
  value,
  onSave,
  onAgeBandChange,
  className,
}: TravelerProfileEditorProps) {
  const [ageBand, setAgeBand] = useState<AgeBand>(value?.age_band ?? '26-44');
  const [mobility, setMobility] = useState<Mobility>(value?.mobility ?? 'full');
  const [euResidency, setEuResidency] = useState(value?.eu_residency ?? false);
  const [student, setStudent] = useState(value?.student ?? false);
  const [languages, setLanguages] = useState<string[]>(value?.languages ?? ['en']);
  const [currency, setCurrency] = useState(value?.currency ?? 'EUR');
  const [langDraft, setLangDraft] = useState('');
  const [busy, setBusy] = useState(false);

  function pickAge(band: AgeBand) {
    setAgeBand(band);
    onAgeBandChange?.(band);
  }

  async function save() {
    setBusy(true);
    try {
      await onSave({
        age_band: ageBand,
        mobility,
        eu_residency: euResidency,
        student,
        languages,
        currency: currency.toUpperCase(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-text">Age band</legend>
        <p className="text-xs text-text-secondary">
          Used to suggest a pace — never to limit what you can do.
        </p>
        <div className="flex flex-wrap gap-2">
          {AGE_BAND_VALUES.map((band) => (
            <button
              key={band}
              type="button"
              aria-pressed={ageBand === band}
              onClick={() => pickAge(band)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium',
                ageBand === band
                  ? 'border-primary bg-primary/10 text-text'
                  : 'border-border bg-surface text-text-secondary hover:text-text',
                FOCUS_RING,
              )}
            >
              {AGE_LABELS[band]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-text">Getting around</legend>
        <div className="flex flex-wrap gap-2">
          {MOBILITY_VALUES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mobility === m}
              onClick={() => setMobility(m)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium',
                mobility === m
                  ? 'border-primary bg-primary/10 text-text'
                  : 'border-border bg-surface text-text-secondary hover:text-text',
                FOCUS_RING,
              )}
            >
              {MOBILITY_LABELS[m]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <Toggle checked={euResidency} onCheckedChange={setEuResidency} label="EU resident" />
        <Toggle checked={student} onCheckedChange={setStudent} label="Student" />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-text">Languages</legend>
        <p className="text-xs text-text-secondary">BCP-47 tags, most fluent first.</p>
        {languages.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Languages">
            {languages.map((lang) => (
              <li key={lang}>
                <button
                  type="button"
                  onClick={() => setLanguages(removeValue(languages, lang))}
                  aria-label={`Remove language ${lang}`}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-sm text-text',
                    FOCUS_RING,
                  )}
                >
                  {lang}
                  <span aria-hidden className="text-text-tertiary">×</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex gap-2">
          <input
            type="text"
            value={langDraft}
            onChange={(e) => setLangDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (langDraft.trim()) setLanguages(addUnique(languages, langDraft.trim()));
                setLangDraft('');
              }
            }}
            placeholder="e.g. fr, es, ja"
            aria-label="Add a language"
            className={cn(
              'min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-base text-text placeholder:text-text-tertiary',
              FOCUS_RING,
            )}
          />
          <button
            type="button"
            onClick={() => {
              if (langDraft.trim()) setLanguages(addUnique(languages, langDraft.trim()));
              setLangDraft('');
            }}
            className={cn('rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text', FOCUS_RING)}
          >
            Add
          </button>
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-text">Currency</span>
        <input
          type="text"
          value={currency}
          maxLength={3}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          aria-label="Currency code"
          className={cn(
            'w-28 rounded-lg border border-border bg-surface px-3 py-2 text-base uppercase tracking-wide text-text',
            FOCUS_RING,
          )}
        />
      </label>

      <div>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save traveler profile'}
        </Button>
      </div>
    </div>
  );
}

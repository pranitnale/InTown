import { useMemo, useState } from 'react';
import { AGE_BAND_VALUES, type AgeBand, type BudgetTier } from '@intown/contracts/types';
import type { UpdateTravelerProfileBody } from '@intown/contracts/api';
import { Button, Card } from '../../design-system/index.ts';
import { PhotoSwipeDeck } from '../components/PhotoSwipeDeck.tsx';
import { QuizFramework, type QuizChoiceQuestion } from '../components/QuizFramework.tsx';
import { TasteProfileEditor } from '../components/TasteProfileEditor.tsx';
import { weightsToInterests, type WeightMap } from '../logic/swipe.ts';
import type { EndowedStep } from '../logic/quiz.ts';
import { ProfileProvider } from '../store/ProfileProvider.tsx';
import { useProfile } from '../store/useProfile.ts';
import { createProfileApi } from '../api/index.ts';

type Stage = 'intro' | 'swipe' | 'quiz' | 'rank' | 'done';

/** Endowed progress: genuinely earned — the user has already created an account
 *  (they have a session), so step 1 is really done. Not a fake head-start. */
const ENDOWED: EndowedStep = {
  label: 'Account created',
  reason: 'You already created your account — that counts as step one.',
};

/**
 * Sensible non-age defaults for the FIRST-TIME traveler create. Onboarding only
 * collects the age band here, but the backend rejects a partial create (it needs
 * every NOT NULL field: age_band, mobility, eu_residency, student, currency —
 * `backend/api/src/profile/routes.ts`). So a first create sends a full valid body
 * with these defaults; the user tunes them later in Settings. An update of an
 * existing profile stays partial (just the age band).
 */
const TRAVELER_CREATE_DEFAULTS: Omit<UpdateTravelerProfileBody, 'age_band'> = {
  mobility: 'full',
  eu_residency: false,
  student: false,
  languages: [],
  currency: 'EUR',
};

const QUIZ_QUESTIONS: readonly QuizChoiceQuestion[] = [
  {
    id: 'age_band',
    prompt: 'Which age band fits you?',
    rationale: 'We use it to suggest a day pace — never to limit what you can do.',
    options: AGE_BAND_VALUES.map((b) => ({ value: b, label: b })),
  },
  {
    id: 'budget',
    prompt: "What's your typical budget?",
    rationale: 'This shapes which places and prices we suggest.',
    options: [
      { value: 'budget', label: 'Budget' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'comfort', label: 'Comfort' },
      { value: 'luxury', label: 'Luxury' },
    ],
  },
];

/**
 * Profile-scoped onboarding flow (P05). Ordered to honour the friction law: no
 * front-loaded form — the user picks what they're into (swipe), answers only the
 * two questions that visibly change output (quiz, endowed progress), then ranks
 * the survivors and fine-tunes anti-preferences / hard exclusions / pace.
 */
export function OnboardingFlow() {
  const { store } = useProfile();
  const [stage, setStage] = useState<Stage>('intro');
  const [interests, setInterests] = useState<string[]>([]);
  const [ageBand, setAgeBand] = useState<AgeBand | undefined>(undefined);
  const [budget, setBudget] = useState<BudgetTier | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);

  function onSwipeDone(weights: WeightMap) {
    setInterests(weightsToInterests(weights));
    setStage('quiz');
  }

  /**
   * Persist the traveler age band (drives pricing + pace defaults). On a
   * first-time create there is no traveler row yet, so a partial body would 400
   * against the live backend — send a full valid body with sensible defaults. On
   * an update of an existing profile a partial body (just the age band) is fine.
   * Errors surface as an alert rather than being swallowed as a fire-and-forget.
   */
  async function persistAgeBand(band: AgeBand) {
    const existing = store.getState().traveler;
    const body: UpdateTravelerProfileBody = existing
      ? { age_band: band }
      : { ...TRAVELER_CREATE_DEFAULTS, age_band: band };
    try {
      await store.getState().saveTraveler(body);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your age band');
    }
  }

  function onQuizDone(answers: Record<string, string>) {
    const band = answers['age_band'];
    const validBand = band && (AGE_BAND_VALUES as readonly string[]).includes(band);
    if (validBand) setAgeBand(band as AgeBand);
    const b = answers['budget'];
    if (b) setBudget(b as BudgetTier);
    if (validBand) {
      setSaveError(null);
      void persistAgeBand(band as AgeBand);
    }
    setStage('rank');
  }

  const content = useMemo(() => {
    switch (stage) {
      case 'intro':
        return (
          <Card why="A couple of taps, then you're planning." className="p-5">
            <h1 className="mb-1 text-2xl font-bold leading-tight text-text">Let&rsquo;s tune InTown to you</h1>
            <p className="mb-4 text-base text-text-secondary">
              No long form. Swipe a few cards, answer two quick questions, and rank what matters.
            </p>
            <Button onClick={() => setStage('swipe')}>Start</Button>
          </Card>
        );
      case 'swipe':
        return <PhotoSwipeDeck onComplete={onSwipeDone} />;
      case 'quiz':
        return <QuizFramework endowed={ENDOWED} questions={QUIZ_QUESTIONS} onComplete={onQuizDone} />;
      case 'rank':
        return (
          <TasteProfileEditor
            value={null}
            initialInterests={interests}
            initialBudget={budget}
            ageBand={ageBand}
            onSave={async (body) => {
              await store.getState().saveTaste(body);
              setStage('done');
            }}
          />
        );
      case 'done':
        return (
          <Card why="Your profile is saved." className="p-5">
            <h1 className="mb-1 text-2xl font-bold leading-tight text-text">You&rsquo;re all set</h1>
            <p className="text-base text-text-secondary">
              We&rsquo;ll use this to shape what you see — and you can change any of it in Settings.
            </p>
          </Card>
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stage-driven view; deps are stable setters/store
  }, [stage, interests, ageBand, budget]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      {saveError ? (
        <p role="alert" className="text-sm text-error">
          {saveError}
        </p>
      ) : null}
      {content}
    </div>
  );
}

/**
 * Mountable route: wires a {@link ProfileProvider} around {@link OnboardingFlow}.
 * Uses the fixture-backed mock intentionally: P04's live client is already
 * merged, but wiring it here needs P03's SessionProvider/auth integration (the
 * live client relies on the session-bound credentials), which is out of P05
 * scope. The flip to the live client is deferred to that auth-integration work
 * (P03 session mount), NOT gated on P04. A fresh onboarding starts with no saved
 * taste/traveler profile.
 */
export function OnboardingRoute() {
  const api = useMemo(
    () => createProfileApi({ mock: true, emptyTaste: true, emptyTraveler: true }),
    [],
  );
  return (
    <ProfileProvider api={api}>
      <OnboardingFlow />
    </ProfileProvider>
  );
}

import { useMemo, useState, type ReactNode } from 'react';
import type { AgeBand, BudgetTier } from '@intown/contracts/types';
import { Button, Card, Skeleton } from '../../design-system/index.ts';
import { getRuntimeConfig } from '../../config/runtime.ts';
import { useSession } from '../../auth/index.ts';
import { PhotoSwipeDeck } from '../components/PhotoSwipeDeck.tsx';
import { QuizFramework, type QuizChoiceQuestion } from '../components/QuizFramework.tsx';
import { TasteProfileEditor } from '../components/TasteProfileEditor.tsx';
import { TravelerProfileEditor } from '../components/TravelerProfileEditor.tsx';
import { weightsToInterests, type WeightMap } from '../logic/swipe.ts';
import type { EndowedStep } from '../logic/quiz.ts';
import { ProfileProvider } from '../store/ProfileProvider.tsx';
import { useProfile } from '../store/useProfile.ts';
import { createProfileApi } from '../api/index.ts';

type Stage = 'intro' | 'traveler' | 'swipe' | 'quiz' | 'rank' | 'done';

const ENDOWED: EndowedStep = {
  label: 'Account created',
  reason: 'You already created your account - that counts as step one.',
};

const QUIZ_QUESTIONS: readonly QuizChoiceQuestion[] = [
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
 * Profile onboarding. Server data is fully loaded before any editor mounts, so
 * a returning profile can never be mistaken for a first-time profile. Every
 * required traveler field is visible and saved only after explicit confirmation.
 */
export function OnboardingFlow() {
  const { status, error, traveler, taste, store } = useProfile();
  const [stage, setStage] = useState<Stage>('intro');
  const [interests, setInterests] = useState<string[]>([]);
  const [ageBand, setAgeBand] = useState<AgeBand | undefined>(traveler?.age_band);
  const [budget, setBudget] = useState<BudgetTier | undefined>(undefined);

  if (status === 'idle' || status === 'loading') {
    return (
      <section className="mx-auto flex max-w-2xl flex-col gap-4 p-6" aria-busy="true">
        <h1 className="text-2xl font-bold leading-tight text-text">Let&rsquo;s tune InTown to you</h1>
        <span className="sr-only">Loading your saved profile...</span>
        <Skeleton height={28} width="55%" />
        <Skeleton height={180} />
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="mx-auto flex max-w-md flex-col gap-3 p-6">
        <h1 className="text-xl font-semibold text-text">We couldn&rsquo;t load your profile</h1>
        <p className="text-sm text-text-secondary" role="alert">
          {error ?? 'Check your connection and try again.'}
        </p>
        <Button variant="secondary" onClick={() => void store.getState().load()}>
          Try again
        </Button>
      </section>
    );
  }

  function onSwipeDone(weights: WeightMap) {
    setInterests(weightsToInterests(weights));
    setStage('quiz');
  }

  function onQuizDone(answers: Record<string, string>) {
    const selectedBudget = answers.budget;
    if (selectedBudget) setBudget(selectedBudget as BudgetTier);
    setStage('rank');
  }

  let content: ReactNode;
  switch (stage) {
    case 'intro':
      content = (
        <Card why="A couple of taps, then you're planning." className="p-5">
          <h1 className="mb-1 text-2xl font-bold leading-tight text-text">
            Let&rsquo;s tune InTown to you
          </h1>
          <p className="mb-4 text-base text-text-secondary">
            Confirm your traveler details, swipe a few cards, then rank what matters.
          </p>
          <Button onClick={() => setStage('traveler')}>Start</Button>
        </Card>
      );
      break;
    case 'traveler':
      content = (
        <Card why="These details shape prices, pace, and accessibility." className="p-5">
          <h2 className="mb-1 text-xl font-semibold text-text">Confirm your traveler details</h2>
          <p className="mb-5 text-sm text-text-secondary">
            Review every field below. The selected values are saved only when you confirm them.
          </p>
          <TravelerProfileEditor
            value={traveler}
            onSave={async (body) => {
              const saved = await store.getState().saveTraveler(body);
              setAgeBand(saved.age_band);
              setStage('swipe');
            }}
          />
        </Card>
      );
      break;
    case 'swipe':
      content = <PhotoSwipeDeck onComplete={onSwipeDone} />;
      break;
    case 'quiz':
      content = (
        <QuizFramework endowed={ENDOWED} questions={QUIZ_QUESTIONS} onComplete={onQuizDone} />
      );
      break;
    case 'rank':
      content = (
        <TasteProfileEditor
          value={taste}
          initialInterests={interests}
          initialBudget={budget}
          ageBand={ageBand}
          onSave={async (body) => {
            await store.getState().saveTaste(body);
            setStage('done');
          }}
        />
      );
      break;
    case 'done':
      content = (
        <Card why="Your profile is saved." className="p-5">
          <h1 className="mb-1 text-2xl font-bold leading-tight text-text">You&rsquo;re all set</h1>
          <p className="text-base text-text-secondary">
            We&rsquo;ll use the preferences you gave us to shape your plans. Behavioral learning is
            controlled separately by your personalization choice.
          </p>
        </Card>
      );
      break;
  }

  return <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">{content}</div>;
}

/** Production route uses the global API base; fixtures require explicit dev opt-in. */
export function OnboardingRoute() {
  const { reportExpired } = useSession();
  const api = useMemo(() => {
    const config = getRuntimeConfig();
    return createProfileApi({
      mock: config.mockApi,
      baseUrl: config.apiBaseUrl,
      ...(config.mockApi ? { emptyTaste: true, emptyTraveler: true } : {}),
    });
  }, []);
  return (
    <ProfileProvider api={api} onSessionExpired={reportExpired}>
      <OnboardingFlow />
    </ProfileProvider>
  );
}

import type { ReactNode } from 'react';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import type { Trip } from '@intown/contracts/types';
import { Button, Card } from '../../design-system/index.ts';
import {
  AuthFlow,
  SessionProvider,
  createAuthApi,
  createMemoryNavigator,
  useAuthGate,
  useSession,
} from '../../auth/index.ts';
import { createTripsApi } from '../api/index.ts';
import { WizardShell } from '../components/WizardShell.tsx';
import { AccommodationStep } from '../components/steps/AccommodationStep.tsx';
import { BudgetStep } from '../components/steps/BudgetStep.tsx';
import { CityDatesStep } from '../components/steps/CityDatesStep.tsx';
import { CompanionsStep } from '../components/steps/CompanionsStep.tsx';
import { ListsStep } from '../components/steps/ListsStep.tsx';
import { PaceStep } from '../components/steps/PaceStep.tsx';
import { TasteStep } from '../components/steps/TasteStep.tsx';
import { TransportStep } from '../components/steps/TransportStep.tsx';
import { pacePresetReason } from '../../onboarding/index.ts';
import { activeAgeBand } from '../logic/companions.ts';
import { planShapingFeedback } from '../logic/feedback.ts';
import { guardedSave, performSave } from '../logic/saveTrip.ts';
import {
  buildCreateTripBody,
  canAdvance,
  currentStepId,
  endowedReason,
  isLastStep,
  wizardProgress,
} from '../logic/wizard.ts';
import { createTripWizardStore, type TripWizardStore } from '../store/tripWizardStore.ts';
import { TripsProvider } from '../store/TripsProvider.tsx';
import { useTrips } from '../store/useTrips.ts';

const noopSubscribe = () => () => {};

/**
 * `/trips/new` full setup wizard (§6.4, AC #2–#5). Runs the whole quiz
 * anonymously — the sign-in gate sits at SAVE (peak motivation), never before
 * the quiz. A local memory navigator drives an inline auth sub-flow: when an
 * anonymous user hits Save, `requireAuth` routes to sign-in and the create
 * replays after a successful sign-in.
 */
function TripNew() {
  const trips = useTrips();
  const { requireAuth } = useAuthGate();
  const { navigator } = useSession();

  const storeRef = useRef<TripWizardStore | null>(null);
  if (storeRef.current === null) storeRef.current = createTripWizardStore();
  const store = storeRef.current;
  const wz = store();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Trip | null>(null);

  const authPath = useSyncExternalStore(
    navigator.subscribe ?? noopSubscribe,
    () => navigator.currentPath,
    () => navigator.currentPath,
  );
  const inAuth = authPath.startsWith('/auth');

  const a = wz.wizard.answers;
  const firstTrip = trips.taste === null;
  const step = currentStepId(wz.wizard);
  const progress = wizardProgress(wz.wizard);
  const feedback = planShapingFeedback({
    companions: a.companions,
    pace: a.pace,
    budget: a.budget,
    transport: a.transport,
  });
  const last = isLastStep(wz.wizard);

  function doSave() {
    guardedSave(requireAuth, () => {
      void performSave(
        async () => {
          const trip = await trips.store.getState().createTrip(buildCreateTripBody(a));
          setSaved(trip);
        },
        { setBusy, setError },
        'Could not save your trip',
      );
    });
  }

  if (saved) {
    return (
      <section className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <Card why="Your trip is saved — next we’ll research your city." className="p-5">
          <h1 className="mb-1 text-2xl font-bold leading-tight text-text">{saved.name} is ready</h1>
          <p className="mb-4 text-base text-text-secondary">
            We saved your trip. Start planning whenever you’re ready.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to={`/trips/${saved.id}`}>
              <Button variant="primary">Open trip</Button>
            </Link>
            <Link to="/trips">
              <Button variant="secondary">All trips</Button>
            </Link>
          </div>
        </Card>
      </section>
    );
  }

  if (inAuth) {
    return (
      <section className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <p className="text-sm text-text-secondary">
          Sign in to save your trip — your answers are kept.
        </p>
        <AuthFlow />
      </section>
    );
  }

  let content: ReactNode;
  switch (step) {
    case 'city':
      content = <CityDatesStep answers={a} patch={wz.patch} />;
      break;
    case 'companions':
      content = (
        <CompanionsStep
          companions={a.companions}
          onChange={(c, preset) =>
            // Age band pre-selects an EDITABLE pace preset — never a cap (§6.2).
            // Only fill an unset pace, so we never clobber a user's own choice.
            wz.patch(
              preset !== undefined && a.pace === undefined
                ? { companions: c, pace: preset }
                : { companions: c },
            )
          }
        />
      );
      break;
    case 'pace': {
      const band = activeAgeBand(a.companions);
      content = (
        <PaceStep
          value={a.pace}
          onChange={(p) => wz.patch({ pace: p })}
          presetReason={band ? pacePresetReason(band) : undefined}
        />
      );
      break;
    }
    case 'budget':
      content = <BudgetStep value={a.budget} onChange={(b) => wz.patch({ budget: b })} />;
      break;
    case 'taste':
      content = (
        <TasteStep
          firstTrip={firstTrip}
          taste={trips.taste}
          confirmed={a.tasteConfirmed}
          onComplete={(interests) => wz.patch({ tasteInterests: interests, tasteConfirmed: true })}
          onConfirm={() => wz.patch({ tasteConfirmed: true })}
        />
      );
      break;
    case 'accommodation':
      content = <AccommodationStep answers={a} patch={wz.patch} />;
      break;
    case 'transport':
      content = <TransportStep value={a.transport} onChange={(t) => wz.patch({ transport: t })} />;
      break;
    case 'lists':
      content = <ListsStep answers={a} patch={wz.patch} />;
      break;
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <WizardShell
        progress={progress}
        // Endowment is honest only once the city step is genuinely completed
        // (left behind); before that there is nothing earned to state.
        earnedReason={progress.completed >= 1 ? endowedReason() : ''}
        feedback={feedback}
        canBack={wz.wizard.cursor > 0}
        onBack={() => wz.prev()}
        onNext={() => (last ? doSave() : wz.next())}
        nextLabel={last ? 'Save & start planning' : 'Next'}
        nextDisabled={!canAdvance(wz.wizard)}
        busy={busy}
        error={error}
      >
        {content}
      </WizardShell>
    </section>
  );
}

/**
 * Mountable route: wires the mock auth session (with an isolated memory
 * navigator for the inline sign-in sub-flow) and the fixture-backed trips store
 * around {@link TripNew}. Mock intentionally — this phase builds against
 * fixtures; the live wiring lands at the P06+P07 integration merge.
 */
export function TripNewRoute() {
  const navigatorRef = useRef(createMemoryNavigator('/trips/new'));
  const authApi = useMemo(() => createAuthApi({ mock: true }), []);
  const tripsApi = useMemo(() => createTripsApi({ mock: true }), []);
  return (
    <SessionProvider api={authApi} navigator={navigatorRef.current}>
      <TripsProvider api={tripsApi}>
        <TripNew />
      </TripsProvider>
    </SessionProvider>
  );
}

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { RoleBadge } from '../components/RoleBadge.tsx';
import { PlanShapingFeedback } from '../components/PlanShapingFeedback.tsx';
import { StillYouCard } from '../components/StillYouCard.tsx';
import { WizardShell } from '../components/WizardShell.tsx';
import { CityDatesStep } from '../components/steps/CityDatesStep.tsx';
import { CompanionsStep } from '../components/steps/CompanionsStep.tsx';
import { PaceStep } from '../components/steps/PaceStep.tsx';
import { BudgetStep } from '../components/steps/BudgetStep.tsx';
import { TransportStep } from '../components/steps/TransportStep.tsx';
import { ListsStep } from '../components/steps/ListsStep.tsx';
import { TasteStep } from '../components/steps/TasteStep.tsx';
import { TripsListView } from '../screens/TripsList.tsx';
import { TripNewRoute } from '../screens/TripNew.tsx';
import { JoinRoute, InvitePreviewCard } from '../screens/JoinLanding.tsx';
import { createMockTripsApi, type InvitePreview, type TasteSummary } from '../api/index.ts';
import { emptyCompanions } from '../logic/companions.ts';
import { initWizard } from '../logic/wizard.ts';
import { SessionProvider, createMemoryNavigator, createMockAuthApi } from '../../auth/index.ts';

const render = (node: ReactElement): string => renderToStaticMarkup(node);
const noop = () => {};

const RETURNING_TASTE: TasteSummary = {
  interests: ['architecture', 'coffee'],
  dietary: ['vegetarian'],
  pace: 'moderate',
  budget_tier: 'comfort',
};

describe('trips components render (AC #1–#7)', () => {
  it('RoleBadge renders the three role labels', () => {
    expect(render(<RoleBadge role="owner" />)).toContain('Owner');
    expect(render(<RoleBadge role="editor" />)).toContain('Editor');
    expect(render(<RoleBadge role="viewer" />)).toContain('Viewer');
  });

  it('PlanShapingFeedback renders the earned lines (AC #4)', () => {
    const html = render(<PlanShapingFeedback lines={['Family mode: shorter walks ✓']} />);
    expect(html).toContain('Family mode: shorter walks ✓');
    expect(render(<PlanShapingFeedback lines={[]} />)).toBe('');
  });

  it('StillYouCard resurfaces the saved taste with confirm/update (AC #3)', () => {
    const html = render(
      <StillYouCard taste={RETURNING_TASTE} onConfirm={noop} onUpdate={noop} />,
    );
    expect(html).toContain('Still you?');
    expect(html).toContain('Because you said: Architecture');
    expect(html).toContain('Yes, still me');
    expect(html).toContain('Update my picks');
  });

  it('WizardShell shows endowed progress + feedback + Back/Next (AC #2/#4)', () => {
    const html = render(
      <WizardShell
        progress={{ completed: 1, total: 8, currentStep: 2, label: 'City selected ✓ — 1 of 8' }}
        earnedReason="You picked your destination."
        feedback={['Relaxed pace ✓']}
        canBack
        onBack={noop}
        onNext={noop}
        nextLabel="Next"
      >
        <div>step body</div>
      </WizardShell>,
    );
    expect(html).toContain('City selected ✓ — 1 of 8');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('Relaxed pace ✓');
    expect(html).toContain('Back');
    expect(html).toContain('Next');
  });

  it('CityDatesStep collects city, dates, and times (AC #2)', () => {
    const html = render(<CityDatesStep answers={initWizard().answers} patch={noop} />);
    expect(html).toContain('Where and when?');
    expect(html).toContain('City');
    expect(html).toContain('type="date"');
    expect(html).toContain('type="time"');
  });

  it('CompanionsStep offers adults, kids, and skippable age bands (AC #2)', () => {
    const html = render(<CompanionsStep companions={emptyCompanions()} onChange={noop} />);
    expect(html).toContain('Who’s coming?');
    expect(html).toContain('Adults');
    expect(html).toContain('ticket prices');
    expect(html).toContain('65+');
  });

  it('pace / budget / transport steps render their choices (AC #2)', () => {
    expect(render(<PaceStep value={undefined} onChange={noop} />)).toContain('What’s your pace?');
    expect(render(<PaceStep value={undefined} onChange={noop} />)).toContain('Relaxed');
    expect(render(<BudgetStep value={undefined} onChange={noop} />)).toContain('What’s your budget?');
    expect(render(<TransportStep value={undefined} onChange={noop} />)).toContain('On foot');
  });

  it('ListsStep collects optional must-see + avoid lists (AC #2)', () => {
    const html = render(<ListsStep answers={initWizard().answers} patch={noop} />);
    expect(html).toContain('Must see');
    expect(html).toContain('Avoid');
  });

  it('TasteStep swipes on a first trip and offers "still you?" for a returning user (AC #3)', () => {
    const firstTrip = render(
      <TasteStep firstTrip taste={null} confirmed={false} onComplete={noop} onConfirm={noop} />,
    );
    expect(firstTrip).toContain('What are you into?');
    expect(firstTrip).toContain('Into this?'); // reused PhotoSwipeDeck

    const returning = render(
      <TasteStep
        firstTrip={false}
        taste={RETURNING_TASTE}
        confirmed={false}
        onComplete={noop}
        onConfirm={noop}
      />,
    );
    expect(returning).toContain('Still you?');
    expect(returning).not.toContain('Into this?');
  });

  it('InvitePreviewCard previews the role before sign-in, then offers join (AC #6)', () => {
    const preview: InvitePreview = {
      code: 'PORTO-7QF2K9',
      tripName: 'Porto long weekend',
      role: 'editor',
      expiresAt: '2026-07-20T23:59:59Z',
      usable: true,
    };
    const html = render(<InvitePreviewCard preview={preview} busy={false} error={null} onJoin={noop} />);
    expect(html).toContain('Join Porto long weekend');
    expect(html).toContain('Editor');
    expect(html).toContain('Sign in &amp; join');

    const unusable = render(
      <InvitePreviewCard preview={{ ...preview, usable: false }} busy={false} error={null} onJoin={noop} />,
    );
    expect(unusable).toContain('no longer valid');
  });
});

describe('trips list (AC #1)', () => {
  it('lists loaded trips with the correct role badges + New-trip CTA', async () => {
    const trips = await createMockTripsApi().listTrips();
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TripsListView status="ready" error={null} trips={trips} />
      </MemoryRouter>,
    );
    expect(html).toContain('Your trips');
    expect(html).toContain('New trip');
    expect(html).toContain('Porto long weekend');
    expect(html).toContain('Lisbon food crawl');
    expect(html).toContain('Berlin museums week');
    expect(html).toContain('Owner');
    expect(html).toContain('Editor');
    expect(html).toContain('Viewer');
  });
});

describe('trip routes (AC #2/#5/#6)', () => {
  it('TripNewRoute mounts the wizard at the city step with NO sign-in gate before the quiz', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/trips/new']}>
        <SessionProvider
          api={createMockAuthApi()}
          navigator={createMemoryNavigator('/trips/new')}
          autoRefresh={false}
        >
          <Routes>
            <Route path="/trips/new" element={<TripNewRoute />} />
          </Routes>
        </SessionProvider>
      </MemoryRouter>,
    );
    expect(html).toContain('Where and when?');
    expect(html).toContain('role="progressbar"');
    // The gate sits at save — the quiz must not open with a sign-in screen.
    expect(html).not.toContain('Send magic link');
  });

  it('JoinRoute mounts the invite landing (public → auth flow)', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/join/PORTO-7QF2K9']}>
        <SessionProvider
          api={createMockAuthApi()}
          navigator={createMemoryNavigator('/join/PORTO-7QF2K9')}
          autoRefresh={false}
        >
          <Routes>
            <Route path="/join/:code" element={<JoinRoute />} />
          </Routes>
        </SessionProvider>
      </MemoryRouter>,
    );
    expect(html).toContain('Checking your invite');
  });
});

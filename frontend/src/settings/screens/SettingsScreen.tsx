import { useMemo } from 'react';
import { Skeleton, Tabs, type TabItem } from '../../design-system/index.ts';
import {
  ProfileProvider,
  TravelerProfileEditor,
  TasteProfileEditor,
  useProfile,
  createProfileApi,
} from '../../onboarding/index.ts';
import { GdprControls } from '../components/GdprControls.tsx';

/** The settings body — assumes a mounted {@link ProfileProvider}. */
export function SettingsBody() {
  const { status, traveler, taste, store } = useProfile();

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton height={28} width="40%" />
        <Skeleton height={200} />
      </div>
    );
  }

  if (status === 'error') {
    return <p className="text-sm text-error">Couldn&rsquo;t load your profile. Please try again.</p>;
  }

  const tabs: TabItem[] = [
    {
      id: 'traveler',
      label: 'Traveler',
      content: (
        <div className="pt-4">
          <TravelerProfileEditor
            value={traveler}
            onSave={async (body) => {
              await store.getState().saveTraveler(body);
            }}
          />
        </div>
      ),
    },
    {
      id: 'taste',
      label: 'Taste',
      content: (
        <div className="pt-4">
          <TasteProfileEditor
            value={taste}
            ageBand={traveler?.age_band}
            onSave={async (body) => {
              await store.getState().saveTaste(body);
            }}
          />
        </div>
      ),
    },
    {
      id: 'data',
      label: 'Your data',
      content: (
        <div className="pt-4">
          <GdprControls />
        </div>
      ),
    },
  ];

  return <Tabs tabs={tabs} />;
}

/** Settings screen chrome + tabs. */
export function SettingsScreenInner() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold leading-tight text-text">Settings</h1>
      <p className="text-base text-text-secondary">
        Your traveler and taste profiles, and control over your data.
      </p>
      <SettingsBody />
    </section>
  );
}

/**
 * Mountable route: wires a fixture-backed {@link ProfileProvider} around the
 * settings screen. The mock is intentional for P05: the live P04 client is
 * already merged, but wiring it needs P03's SessionProvider/auth integration
 * (the live client relies on session-bound credentials), which is out of P05
 * scope. The flip to the live client is deferred to that auth-integration work
 * (P03 session mount), NOT gated on P04.
 */
export function SettingsRoute() {
  const api = useMemo(() => createProfileApi({ mock: true }), []);
  return (
    <ProfileProvider api={api}>
      <SettingsScreenInner />
    </ProfileProvider>
  );
}

import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { BottomSheet } from '../app-shell/BottomSheet.tsx';
import { Card } from '../design-system/index.ts';

/**
 * Placeholder screens for the P01 route skeleton (AC #5). Each screen states
 * its title and the phase that owns its real content (per phases/INDEX.md §4
 * route→phase mapping). No real behavior lives here.
 */
function Placeholder({
  title,
  owner,
  children,
}: {
  title: string;
  owner: string;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-2 p-6">
      <h1 className="text-2xl font-bold leading-tight">{title}</h1>
      <p className="text-base text-text-secondary">
        Placeholder screen — real content owned by <span className="font-semibold">{owner}</span>.
      </p>
      {children}
    </section>
  );
}

export function HomeScreen() {
  const [sheetHeight, setSheetHeight] = useState(0);
  return (
    <>
      <Placeholder title="Home" owner="P07 (trips)">
        <p className="text-sm text-text-tertiary">
          Demonstrating the non-modal bottom sheet below: the map/content here stays interactive,
          and the sheet reports its occupied height ({Math.round(sheetHeight)}px) so a later phase
          can keep a selected pin visible.
        </p>
      </Placeholder>
      <BottomSheet title="Nearby" initialDetent="peek" onHeightChange={setSheetHeight}>
        <div className="flex flex-col gap-3">
          <Card title="Sample place" why="One reason this place is shown." />
          <Card title="Another place" why="Another single why-line." />
        </div>
      </BottomSheet>
    </>
  );
}

export function AuthScreen() {
  return <Placeholder title="Sign in" owner="P03 (auth & consent)" />;
}

export function OnboardingScreen() {
  return <Placeholder title="Onboarding" owner="P05 (onboarding & profiles)" />;
}

export function TripsScreen() {
  return <Placeholder title="Trips" owner="P07 (trips & join)" />;
}

export function TripNewScreen() {
  return <Placeholder title="New trip" owner="P07 (trip creation)" />;
}

export function JoinScreen() {
  const { code } = useParams();
  return <Placeholder title={`Join trip · ${code ?? ''}`} owner="P07 (trip join)" />;
}

export function TripDetailScreen() {
  const { id } = useParams();
  return <Placeholder title={`Trip · ${id ?? ''}`} owner="P18 (plan view)" />;
}

export function TripCurateScreen() {
  const { id } = useParams();
  return <Placeholder title={`Curate · ${id ?? ''}`} owner="P15 (curation UI)" />;
}

export function TripCityBriefScreen() {
  const { id } = useParams();
  return <Placeholder title={`City Brief · ${id ?? ''}`} owner="P12 (City Brief)" />;
}

export function TripGeneratingScreen() {
  const { id } = useParams();
  return <Placeholder title={`Generating · ${id ?? ''}`} owner="P13 (research pipeline UX)" />;
}

export function SettingsScreen() {
  return <Placeholder title="Settings" owner="P05 (profiles & settings)" />;
}

export function OfflineScreen() {
  return <Placeholder title="Offline" owner="P22 (offline bundles & PWA)" />;
}

export function ReviewsPolicyScreen() {
  return <Placeholder title="Reviews policy" owner="P27 (public reviews & DSA)" />;
}

export function ModerationScreen() {
  return <Placeholder title="Moderation" owner="P27 (moderation & DSA)" />;
}

import { useMemo } from 'react';
import { Link } from 'react-router';
import { Button, Card } from '../../design-system/index.ts';
import { createTripsApi, type TripSummary } from '../api/index.ts';
import { RoleBadge } from '../components/RoleBadge.tsx';
import { roleDescription } from '../logic/roles.ts';
import type { TripsStatus } from '../store/tripsStore.ts';
import { TripsProvider } from '../store/TripsProvider.tsx';
import { useTrips } from '../store/useTrips.ts';

export interface TripsListViewProps {
  status: TripsStatus;
  error: string | null;
  trips: TripSummary[];
}

/**
 * Presentational `/trips` list (AC #1). Effect-free + prop-driven so it renders
 * deterministically under `renderToStaticMarkup` (the zustand store returns its
 * INITIAL state on the server, so the loaded list must be tested through props).
 * The user's trips, each with a role badge, plus the "New trip" CTA.
 */
export function TripsListView({ status, error, trips }: TripsListViewProps) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold leading-tight text-text">Your trips</h1>
        <Link to="/trips/new">
          <Button variant="primary">New trip</Button>
        </Link>
      </header>

      {status === 'loading' ? (
        <p className="text-sm text-text-secondary">Loading your trips…</p>
      ) : null}

      {status === 'error' ? (
        <p role="alert" className="text-sm text-error">
          {error ?? 'Could not load your trips.'}
        </p>
      ) : null}

      {status === 'ready' && trips.length === 0 ? (
        <Card why="Start your first trip — it takes about two minutes." className="p-5">
          <p className="text-base text-text">No trips yet.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Create your first trip and we’ll shape a plan around your taste.
          </p>
        </Card>
      ) : null}

      {trips.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {trips.map(({ trip, role }) => (
            <li key={trip.id}>
              <Link to={`/trips/${trip.id}`} className="block">
                <Card
                  title={trip.name}
                  why={roleDescription(role)}
                  badges={[<RoleBadge key="role" role={role} />]}
                  className="p-4 transition-colors hover:bg-bg"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * `/trips` list container: subscribes to the trips store and hands its state to
 * {@link TripsListView}. Data comes from the fixture-backed mock; the live
 * client is wired at the P06+P07 integration merge.
 */
export function TripsList() {
  const { status, error, trips } = useTrips();
  return <TripsListView status={status} error={error} trips={trips} />;
}

/**
 * Mountable route: wires a {@link TripsProvider} (fixture-backed mock) around
 * {@link TripsList}.
 */
export function TripsRoute() {
  const api = useMemo(() => createTripsApi({ mock: true }), []);
  return (
    <TripsProvider api={api}>
      <TripsList />
    </TripsProvider>
  );
}

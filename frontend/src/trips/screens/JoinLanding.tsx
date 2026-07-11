import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router';
import type { TripMember } from '@intown/contracts/types';
import { Button, Card } from '../../design-system/index.ts';
import {
  AuthFlow,
  SessionProvider,
  createAuthApi,
  createMemoryNavigator,
  useAuthGate,
  useSession,
} from '../../auth/index.ts';
import { createTripsApi, type InvitePreview } from '../api/index.ts';
import { RoleBadge } from '../components/RoleBadge.tsx';
import { roleDescription } from '../logic/roles.ts';
import { guardedSave, performSave } from '../logic/saveTrip.ts';
import { TripsProvider } from '../store/TripsProvider.tsx';
import { useTrips } from '../store/useTrips.ts';

const noopSubscribe = () => () => {};

type JoinStatus = 'loading' | 'ready' | 'notfound';

/**
 * `/join/:code` landing (§6.3, AC #6). Public → auth flow: the invite's role is
 * PREVIEWED before sign-in (role → sign-in → join). The gate sits at the Join
 * action — an anonymous visitor sees who they'd become first, then signs in,
 * then the join replays.
 */
function JoinLanding() {
  const { code } = useParams();
  const trips = useTrips();
  const { requireAuth } = useAuthGate();
  const { navigator } = useSession();

  const [status, setStatus] = useState<JoinStatus>('loading');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [joined, setJoined] = useState<TripMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authPath = useSyncExternalStore(
    navigator.subscribe ?? noopSubscribe,
    () => navigator.currentPath,
    () => navigator.currentPath,
  );
  const inAuth = authPath.startsWith('/auth');

  useEffect(() => {
    let active = true;
    if (!code) {
      setStatus('notfound');
      return;
    }
    void trips.api.getInvite(code).then((p) => {
      if (!active) return;
      if (!p) {
        setStatus('notfound');
      } else {
        setPreview(p);
        setStatus('ready');
      }
    });
    return () => {
      active = false;
    };
  }, [code, trips.api]);

  function doJoin() {
    if (!code) return;
    guardedSave(requireAuth, () => {
      void performSave(
        async () => {
          const member = await trips.api.joinTrip(code);
          setJoined(member);
        },
        { setBusy, setError },
        'Could not join this trip',
      );
    });
  }

  const wrap = (children: ReactNode) => (
    <section className="mx-auto flex max-w-md flex-col gap-4 p-6">{children}</section>
  );

  if (joined) {
    return wrap(
      <Card why="You’re on the trip — you can view and shape the plan." className="p-5">
        <h1 className="mb-1 text-2xl font-bold leading-tight text-text">You’re in</h1>
        <p className="mb-3 text-base text-text-secondary">
          You joined {preview?.tripName ?? 'the trip'} as <RoleBadge role={joined.role} />.
        </p>
        <Link to="/trips">
          <Button variant="primary">Go to your trips</Button>
        </Link>
      </Card>,
    );
  }

  if (inAuth) {
    return wrap(
      <>
        <p className="text-sm text-text-secondary">Sign in to join {preview?.tripName ?? 'this trip'}.</p>
        <AuthFlow />
      </>,
    );
  }

  if (status === 'loading') {
    return wrap(<p className="text-sm text-text-secondary">Checking your invite…</p>);
  }

  if (status === 'notfound' || !preview) {
    return wrap(
      <Card why="This invite link didn’t resolve to a trip." className="p-5">
        <h1 className="mb-1 text-2xl font-bold leading-tight text-text">Invite not found</h1>
        <p className="text-base text-text-secondary">
          We couldn’t find that invite. Ask the trip owner for a fresh link.
        </p>
      </Card>,
    );
  }

  return wrap(<InvitePreviewCard preview={preview} busy={busy} error={error} onJoin={doJoin} />);
}

export interface InvitePreviewCardProps {
  preview: InvitePreview;
  busy: boolean;
  error: string | null;
  /** Guarded join action (routes through sign-in when anonymous). */
  onJoin: () => void;
}

/**
 * Role-preview card for `/join/:code` (AC #6). Presentational + effect-free so
 * it renders under `renderToStaticMarkup` in tests: it previews the role the
 * invite grants BEFORE sign-in, then offers the guarded "Sign in & join"
 * action (or an honest "no longer valid" note for a revoked/expired invite).
 */
export function InvitePreviewCard({ preview, busy, error, onJoin }: InvitePreviewCardProps) {
  return (
    <Card why="Preview the role you’d get before you sign in and join." className="p-5">
      <h1 className="mb-1 text-2xl font-bold leading-tight text-text">Join {preview.tripName}</h1>
      <p className="mb-3 flex flex-wrap items-center gap-2 text-base text-text-secondary">
        You’ve been invited as <RoleBadge role={preview.role} />
      </p>
      <p className="mb-4 text-sm text-text-tertiary">
        {roleDescription(preview.role)} Expires {preview.expiresAt.slice(0, 10)}.
      </p>
      {error ? (
        <p role="alert" className="mb-3 text-sm text-error">
          {error}
        </p>
      ) : null}
      {preview.usable ? (
        <Button variant="primary" onClick={onJoin} disabled={busy}>
          {busy ? 'Joining…' : 'Sign in & join'}
        </Button>
      ) : (
        <p role="alert" className="text-sm text-error">
          This invite link is no longer valid.
        </p>
      )}
    </Card>
  );
}

/**
 * Mountable route: wires the mock auth session (with an isolated memory
 * navigator for the inline sign-in sub-flow) and the fixture-backed trips store
 * around {@link JoinLanding}.
 */
export function JoinRoute() {
  const navigatorRef = useRef(createMemoryNavigator('/join'));
  const authApi = useMemo(() => createAuthApi({ mock: true }), []);
  const tripsApi = useMemo(() => createTripsApi({ mock: true }), []);
  return (
    <SessionProvider api={authApi} navigator={navigatorRef.current}>
      <TripsProvider api={tripsApi}>
        <JoinLanding />
      </TripsProvider>
    </SessionProvider>
  );
}

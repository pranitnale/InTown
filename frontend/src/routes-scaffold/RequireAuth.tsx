import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '../auth/index.ts';
import { reconcileSessionOnMount } from '../auth/session/store.ts';
import { Button, Skeleton } from '../design-system/index.ts';

/**
 * Visibility boundary for genuinely private pages. Public trip setup and invite
 * previews remain outside it and gate only their protected actions.
 */
export function RequireAuth() {
  const { status, store } = useSession();
  const location = useLocation();
  const [returnPathSaved, setReturnPathSaved] = useState(false);
  const returnPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (status !== 'anonymous' && status !== 'expired') {
      setReturnPathSaved(false);
      return;
    }
    store.getState().beginAuth(returnPath);
    setReturnPathSaved(true);
  }, [returnPath, status, store]);

  if (status === 'loading') {
    return (
      <section className="mx-auto flex max-w-2xl flex-col gap-3 p-6" aria-busy="true">
        <span className="sr-only">Checking your session...</span>
        <Skeleton height={28} width="45%" />
        <Skeleton height={120} />
      </section>
    );
  }

  if (status === 'unavailable') {
    return (
      <section className="mx-auto flex max-w-md flex-col gap-3 p-6" role="status">
        <h1 className="text-xl font-semibold text-text">You appear to be offline</h1>
        <p className="text-sm text-text-secondary">
          We couldn&rsquo;t check your session. Reconnect and try again; your current page is
          preserved.
        </p>
        <Button variant="secondary" onClick={() => void reconcileSessionOnMount(store)}>
          Try again
        </Button>
      </section>
    );
  }

  if (status !== 'authenticated') {
    if (!returnPathSaved) return <span className="sr-only">Preparing sign in...</span>;
    return <Navigate to="/auth/sign-in" replace state={{ from: returnPath }} />;
  }

  return <Outlet />;
}

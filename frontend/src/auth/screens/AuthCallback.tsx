import { useEffect, useRef } from 'react';
import { Card } from '../ui/Card.tsx';
import { useSession } from '../session/useSession.ts';

function parseParams(path: string): Record<string, string> {
  const q = path.indexOf('?');
  if (q === -1) return {};
  return Object.fromEntries(new URLSearchParams(path.slice(q + 1)));
}

/**
 * OAuth / magic-link return. Establishes the session from the callback params
 * then replays the captured `redirectTo` (handled inside `completeAuth`). On
 * failure it routes to the auth error screen.
 */
export function AuthCallback() {
  const { store, navigator } = useSession();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = parseParams(navigator.currentPath);
    store
      .getState()
      .completeAuth(params)
      .catch(() => navigator.navigate('/auth/error'));
  }, [store, navigator]);

  return (
    <Card className="mx-auto max-w-md text-center">
      <div aria-hidden="true" className="mb-3 text-3xl">
        ⏳
      </div>
      <h1 className="mb-2 text-xl font-semibold text-text">Signing you in…</h1>
      <p className="text-sm text-text-secondary">Hold tight while we finish setting things up.</p>
    </Card>
  );
}

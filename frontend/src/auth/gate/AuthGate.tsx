import type { ReactNode } from 'react';
import { useSession } from '../session/useSession.ts';
import { useAuthGate } from './useAuthGate.ts';

export interface AuthGateRenderProps {
  /** Guard an action; runs it now if authed, else routes through auth then replays. */
  requireAuth: (resumeAction?: () => void) => void;
  /** True once the user is authenticated. */
  authenticated: boolean;
}

export interface AuthGateProps {
  children: (props: AuthGateRenderProps) => ReactNode;
}

/**
 * Render-prop wrapper a caller uses to guard a specific action/button at the
 * peak-motivation moment, e.g.:
 *
 *   <AuthGate>{({ requireAuth }) =>
 *     <Button onClick={() => requireAuth(saveTrip)}>Save trip</Button>}
 *   </AuthGate>
 *
 * It renders its children unconditionally and never redirects on mount — auth is
 * only triggered when `requireAuth` is invoked.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { requireAuth } = useAuthGate();
  const { status } = useSession();
  return <>{children({ requireAuth, authenticated: status === 'authenticated' })}</>;
}

import { useCallback } from 'react';
import { useSession } from '../session/useSession.ts';
import { performRequireAuth } from './performRequireAuth.ts';

export interface UseAuthGateResult {
  /**
   * Peak-motivation gate. If the user is authenticated, runs `resumeAction`
   * immediately. Otherwise it stashes the action + current path and opens the
   * auth flow; the action replays automatically after a successful auth.
   *
   * This is action-invoked by design — it does nothing until called, so it is
   * NEVER a global route guard that front-loads auth before the quiz (§ gate).
   */
  requireAuth: (resumeAction?: () => void) => void;
}

export function useAuthGate(): UseAuthGateResult {
  const { store, navigator } = useSession();

  const requireAuth = useCallback(
    (resumeAction?: () => void) => {
      performRequireAuth(store, navigator, resumeAction);
    },
    [store, navigator],
  );

  return { requireAuth };
}

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { AuthApi } from '../api/index.ts';
import type { AuthNavigator } from '../navigation.ts';
import { createSessionStore, reconcileSessionOnMount } from './store.ts';
import { SessionContext, type SessionContextValue } from './context.ts';

export interface SessionProviderProps {
  api: AuthApi;
  navigator: AuthNavigator;
  /** Probe the server session on mount (default true). Off for pure render tests. */
  autoRefresh?: boolean;
  children: ReactNode;
}

/**
 * Wires the AuthApi + AuthNavigator into a per-instance session store and
 * exposes them through context. On mount it reconciles the local session with
 * the server (unless disabled).
 */
export function SessionProvider({
  api,
  navigator,
  autoRefresh = true,
  children,
}: SessionProviderProps) {
  // One store per provider; deps are captured at first render.
  const valueRef = useRef<SessionContextValue | null>(null);
  if (valueRef.current === null) {
    valueRef.current = { store: createSessionStore({ api, navigator }), api, navigator };
  }
  const value = valueRef.current;

  useEffect(() => {
    if (!autoRefresh) return;
    void reconcileSessionOnMount(value.store);
  }, [autoRefresh, value]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

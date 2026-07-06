import { useContext } from 'react';
import type { AuthApi } from '../api/index.ts';
import type { AuthNavigator } from '../navigation.ts';
import { SessionContext } from './context.ts';
import type { SessionState, SessionStore } from './store.ts';

export interface UseSessionResult extends SessionState {
  api: AuthApi;
  navigator: AuthNavigator;
  /** The underlying store (for imperative reads without subscribing). */
  store: SessionStore;
}

/** Subscribe to the session store + reach the api/navigator. Throws outside a provider. */
export function useSession(): UseSessionResult {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a <SessionProvider>');
  const state = ctx.store();
  return { ...state, api: ctx.api, navigator: ctx.navigator, store: ctx.store };
}

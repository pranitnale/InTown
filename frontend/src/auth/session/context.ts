import { createContext } from 'react';
import type { AuthApi } from '../api/index.ts';
import type { AuthNavigator } from '../navigation.ts';
import type { SessionStore } from './store.ts';

export interface SessionContextValue {
  store: SessionStore;
  api: AuthApi;
  navigator: AuthNavigator;
}

/** Null until a SessionProvider mounts; useSession throws if read outside one. */
export const SessionContext = createContext<SessionContextValue | null>(null);

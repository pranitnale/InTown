import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { ProfileApi } from '../api/index.ts';
import { createProfileStore } from './profileStore.ts';
import { ProfileContext, type ProfileContextValue } from './context.ts';

export interface ProfileProviderProps {
  api: ProfileApi;
  /** Load profile data on mount (default true). Off for pure render tests. */
  autoLoad?: boolean;
  children: ReactNode;
}

/**
 * Wires a {@link ProfileApi} into a per-instance profile store exposed through
 * context. On mount it loads the profile (unless disabled). Mirrors
 * `SessionProvider`.
 */
export function ProfileProvider({ api, autoLoad = true, children }: ProfileProviderProps) {
  const valueRef = useRef<ProfileContextValue | null>(null);
  if (valueRef.current === null) {
    valueRef.current = { store: createProfileStore(api), api };
  }
  const value = valueRef.current;

  useEffect(() => {
    if (!autoLoad) return;
    void value.store.getState().load();
  }, [autoLoad, value]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

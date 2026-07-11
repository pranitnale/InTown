import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { TripsApi } from '../api/index.ts';
import { createTripsStore } from './tripsStore.ts';
import { TripsContext, type TripsContextValue } from './context.ts';

export interface TripsProviderProps {
  api: TripsApi;
  /** Load the trip list on mount (default true). Off for pure render tests. */
  autoLoad?: boolean;
  children: ReactNode;
}

/**
 * Wires a {@link TripsApi} into a per-instance trips store exposed through
 * context. On mount it loads the list (unless disabled). Mirrors
 * `ProfileProvider`.
 */
export function TripsProvider({ api, autoLoad = true, children }: TripsProviderProps) {
  const valueRef = useRef<TripsContextValue | null>(null);
  if (valueRef.current === null) {
    valueRef.current = { store: createTripsStore(api), api };
  }
  const value = valueRef.current;

  useEffect(() => {
    if (!autoLoad) return;
    void value.store.getState().load();
  }, [autoLoad, value]);

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

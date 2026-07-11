import { createContext } from 'react';
import type { TripsApi } from '../api/index.ts';
import type { TripsStore } from './tripsStore.ts';

export interface TripsContextValue {
  store: TripsStore;
  api: TripsApi;
}

/** Per-instance trips store + api. Consumed via `useTrips`. Mirrors `ProfileContext`. */
export const TripsContext = createContext<TripsContextValue | null>(null);

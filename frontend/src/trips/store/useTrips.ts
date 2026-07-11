import { useContext } from 'react';
import type { TripsApi } from '../api/index.ts';
import { TripsContext } from './context.ts';
import type { TripsState, TripsStore } from './tripsStore.ts';

export interface UseTripsResult extends TripsState {
  api: TripsApi;
  /** The underlying store (for imperative reads without subscribing). */
  store: TripsStore;
}

/** Subscribe to the trips store + reach the api. Throws outside a provider. */
export function useTrips(): UseTripsResult {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error('useTrips must be used within a <TripsProvider>');
  const state = ctx.store();
  return { ...state, api: ctx.api, store: ctx.store };
}

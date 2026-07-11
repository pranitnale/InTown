import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { Trip } from '@intown/contracts/types';
import type { CreateTripBody } from '@intown/contracts/api';
import type { TripsApi, TripSummary, TasteSummary } from '../api/index.ts';

export type TripsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface TripsState {
  status: TripsStatus;
  error: string | null;
  trips: TripSummary[];
  /** Returning-user taste, or null on a first-ever trip (drives the swipe vs "still you?" fork). */
  taste: TasteSummary | null;

  /** Load the trip list + taste summary in parallel. Never rejects; sets `error`. */
  load: () => Promise<void>;
  /** Create a trip and prepend it to the list. */
  createTrip: (body: CreateTripBody) => Promise<Trip>;
}

export type TripsStore = UseBoundStore<StoreApi<TripsState>>;

/**
 * P07-LOCAL trips store (own Zustand instance — never touches
 * `src/store/app.ts`). One instance per {@link TripsProvider}. Mirrors the P05
 * profile store.
 */
export function createTripsStore(api: TripsApi): TripsStore {
  return create<TripsState>((set, get) => ({
    status: 'idle',
    error: null,
    trips: [],
    taste: null,

    async load() {
      set({ status: 'loading', error: null });
      try {
        const [trips, taste] = await Promise.all([api.listTrips(), api.getTasteSummary()]);
        set({ status: 'ready', trips, taste });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : 'Failed to load trips' });
      }
    },

    async createTrip(body) {
      const trip = await api.createTrip(body);
      set({ trips: [{ trip, role: 'owner' }, ...get().trips] });
      return trip;
    },
  }));
}

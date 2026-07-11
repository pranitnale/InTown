import { createMockTripsApi, type MockTripsOptions } from './mock.ts';
import type { TripsApi } from './types.ts';

export type {
  TripsApi,
  TripSummary,
  TasteSummary,
  InvitePreview,
} from './types.ts';
export { TripsSessionExpiredError, InviteUnusableError } from './types.ts';
export { createMockTripsApi } from './mock.ts';
export type { MockTripsOptions } from './mock.ts';

export interface CreateTripsApiOptions extends MockTripsOptions {
  /**
   * Use the in-memory mock. The live client lands with the P06 trips backend at
   * merge; until then only the mock exists, so this switch always resolves to
   * it. Kept as an explicit option so the merge that wires the live client
   * changes only this factory, never a call site.
   */
  mock?: boolean;
}

/**
 * Single switch the app/harness uses to obtain a {@link TripsApi}. Mock-only in
 * this phase (build against fixtures, no live backend — P07 key constraint);
 * the live client is wired at the P06+P07 integration merge.
 */
export function createTripsApi(options: CreateTripsApiOptions = {}): TripsApi {
  return createMockTripsApi({
    currentUserId: options.currentUserId,
    emptyTrips: options.emptyTrips,
    returning: options.returning,
    now: options.now,
  });
}

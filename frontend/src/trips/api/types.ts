import type { Trip, TripMember, TripRole, TasteProfile } from '@intown/contracts/types';
import type { CreateTripBody } from '@intown/contracts/api';

/**
 * Trips transport the P07 UI talks to. Typed against the frozen §11 trips
 * contract (`Trip`, `TripMember`, `TripRole`) plus a couple of small UI view
 * models the contract does not carry (the list needs the caller's role per
 * trip; the join landing needs a human invite preview). The live client lands
 * with the P06 backend at merge; this phase runs entirely against the mock, so
 * the merge flips one transport for the other with no UI change — mirroring
 * `ProfileApi` / `AuthApi`.
 */

/** A trip plus the current user's role in it — the shape the `/trips` list needs. */
export interface TripSummary {
  trip: Trip;
  role: TripRole;
}

/** The subset of a taste profile the returning-user "still you?" card resurfaces. */
export type TasteSummary = Pick<TasteProfile, 'interests' | 'dietary' | 'pace' | 'budget_tier'>;

/**
 * Human-facing preview of an invite code, resolved for the `/join/:code`
 * landing BEFORE the user authenticates (role preview → sign-in → join). Built
 * from a `TripInvite` + its `Trip` name; `usable` folds the revoked/expired
 * checks so the UI shows one clear state.
 */
export interface InvitePreview {
  code: string;
  tripName: string;
  role: TripRole;
  expiresAt: string;
  usable: boolean;
}

export interface TripsApi {
  /** List the trips the current user owns or is a member of, each with their role. */
  listTrips(): Promise<TripSummary[]>;
  /** Latest taste profile for the current user, or null on a first-ever trip. */
  getTasteSummary(): Promise<TasteSummary | null>;
  /** Create a trip (caller becomes owner). */
  createTrip(body: CreateTripBody): Promise<Trip>;
  /** Resolve an invite code to a preview, or null when the code is unknown. */
  getInvite(code: string): Promise<InvitePreview | null>;
  /** Redeem an invite code and join the trip; rejects when the code is unusable. */
  joinTrip(code: string): Promise<TripMember>;
}

/** Thrown when a protected call reports the session is gone (401). */
export class TripsSessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'TripsSessionExpiredError';
  }
}

/** Thrown when an invite code cannot be redeemed (unknown, expired, or revoked). */
export class InviteUnusableError extends Error {
  constructor(message = 'This invite link is no longer valid') {
    super(message);
    this.name = 'InviteUnusableError';
  }
}

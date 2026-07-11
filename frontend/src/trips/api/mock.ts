import { Trip, TripMember, TripInvite, TasteProfile } from '@intown/contracts/types';
import type { CreateTripBody } from '@intown/contracts/api';
import fixture from '../fixtures/trips.json';
import { isInviteUsable } from '../logic/invite.ts';
import {
  InviteUnusableError,
  type InvitePreview,
  type TasteSummary,
  type TripsApi,
  type TripSummary,
} from './types.ts';

export interface MockTripsOptions {
  /**
   * Whose trips/role to seed. Defaults to the fixture's `currentUserId` (Mara,
   * who owns one trip and is editor/viewer on two others — exercises all role
   * badges).
   */
  currentUserId?: string;
  /** Start with no trips (drives the empty-list path). */
  emptyTrips?: boolean;
  /**
   * Seed a returning taste profile so `/trips/new` shows the "still you?"
   * confirmation instead of the first-trip photo-swipe round. Default false
   * (first-ever trip → swipe).
   */
  returning?: boolean;
  /** Injected clock for invite expiry checks (never `Date.now()`). */
  now?: string;
}

const NOW = '2026-07-07T12:00:00Z';
/** Deterministic id for the trip a mock create returns. */
const CREATED_TRIP_ID = 'bb000000-0000-4000-8000-0000000000ff';

/**
 * In-memory {@link TripsApi} seeded from the frozen `trips.json` fixture. Every
 * returned object is validated with the contract zod schemas (`.parse`), so
 * tests exercising the mock also prove the UI consumes contract-shaped data.
 * Mirrors `createMockProfileApi` / `createMockAuthApi`.
 */
export function createMockTripsApi(opts: MockTripsOptions = {}): TripsApi {
  const currentUserId = opts.currentUserId ?? fixture.currentUserId;
  const now = opts.now ?? NOW;

  const trips: Trip[] = fixture.trips.map((t) => Trip.parse(t));
  const members: TripMember[] = fixture.members.map((m) => TripMember.parse(m));
  const invites: TripInvite[] = fixture.invites.map((i) => TripInvite.parse(i));

  let created: Trip[] = [];

  function summariesFor(userId: string): TripSummary[] {
    const mine = members.filter((m) => m.user_id === userId);
    const summaries: TripSummary[] = [];
    for (const member of mine) {
      const trip = trips.find((t) => t.id === member.trip_id);
      if (trip) summaries.push({ trip, role: member.role });
    }
    // Trips created this session belong to the caller as owner.
    for (const trip of created) summaries.push({ trip, role: 'owner' });
    return summaries;
  }

  return {
    async listTrips(): Promise<TripSummary[]> {
      if (opts.emptyTrips) return [...created].map((trip) => ({ trip, role: 'owner' as const }));
      return summariesFor(currentUserId);
    },

    async getTasteSummary(): Promise<TasteSummary | null> {
      if (!opts.returning) return null;
      // Zod-parse the fixture through the frozen contract schema (no `as`
      // casts) so the mock proves the UI consumes contract-shaped, validated
      // taste data — matching this module's contract-validation claim above.
      return TasteProfile.pick({
        interests: true,
        dietary: true,
        pace: true,
        budget_tier: true,
      }).parse(fixture.returningTaste);
    },

    async createTrip(body: CreateTripBody): Promise<Trip> {
      const trip = Trip.parse({
        id: CREATED_TRIP_ID,
        owner_id: currentUserId,
        name: body.name,
        created_at: now,
        updated_at: now,
      });
      created = [...created, trip];
      return trip;
    },

    async getInvite(code: string): Promise<InvitePreview | null> {
      const invite = invites.find((i) => i.code === code);
      if (!invite) return null;
      const trip = trips.find((t) => t.id === invite.trip_id);
      return {
        code: invite.code,
        tripName: trip?.name ?? 'a trip',
        role: invite.role,
        expiresAt: invite.expires_at,
        usable: isInviteUsable(invite, now),
      };
    },

    async joinTrip(code: string): Promise<TripMember> {
      const invite = invites.find((i) => i.code === code);
      if (!invite || !isInviteUsable(invite, now)) {
        throw new InviteUnusableError();
      }
      return TripMember.parse({
        id: 'dd000000-0000-4000-8000-0000000000ff',
        trip_id: invite.trip_id,
        user_id: currentUserId,
        role: invite.role,
        joined_at: now,
      });
    },
  };
}

import { z } from 'zod';
import { Uuid, IsoDateTime, TripRole, PlaceState, PlanRevisionReason, VoteValue } from '../types/index.ts';

/**
 * §11 / §6.4 — realtime collaboration channel `trip:{id}` (self-hosted Supabase
 * Realtime: Broadcast + Presence). Postgres is the source of truth; broadcasts
 * are per-column LWW with server timestamps, reconciled optimistically on the
 * client. Payloads reference ids only — **no coordinates** cross this channel.
 */

/** Channel name for a trip's realtime room. */
export const TRIP_CHANNEL_PREFIX = 'trip:' as const;
export function tripChannel(tripId: string): string {
  return `${TRIP_CHANNEL_PREFIX}${tripId}`;
}

/**
 * Presence metadata a member publishes while viewing a trip (avatars, "viewing"
 * indicators). Preference exposure is aggregate-only elsewhere; presence is
 * collaboration state (who is here), which is attributed (§6.4).
 */
export const TripPresence = z.object({
  user_id: Uuid,
  display_name: z.string().nullable(),
  handle: z.string().nullable(),
  /** What the member is currently viewing (screen key or place id), if shared. */
  viewing: z.string().nullable(),
  joined_at: IsoDateTime,
});
export type TripPresence = z.infer<typeof TripPresence>;

/** Server timestamp carried on every broadcast for LWW reconciliation. */
const at = IsoDateTime;

export const BroadcastPlaceAdded = z.object({
  type: z.literal('place_added'),
  trip_place_id: Uuid,
  trip_city_id: Uuid,
  poi_id: Uuid,
  position: z.string(),
  state: PlaceState,
  added_by: Uuid,
  at,
});

export const BroadcastPlaceUpdated = z.object({
  type: z.literal('place_updated'),
  trip_place_id: Uuid,
  position: z.string().nullable(),
  state: PlaceState.nullable(),
  updated_by: Uuid,
  at,
});

export const BroadcastPlaceRemoved = z.object({
  type: z.literal('place_removed'),
  trip_place_id: Uuid,
  removed_by: Uuid,
  at,
});

export const BroadcastVoteCast = z.object({
  type: z.literal('vote_cast'),
  trip_place_id: Uuid,
  user_id: Uuid,
  vote: VoteValue,
  at,
});

export const BroadcastPlanUpdated = z.object({
  type: z.literal('plan_updated'),
  trip_city_id: Uuid,
  plan_revision_id: Uuid,
  reason: PlanRevisionReason,
  at,
});

export const BroadcastMemberJoined = z.object({
  type: z.literal('member_joined'),
  user_id: Uuid,
  role: TripRole,
  at,
});

/** Every message broadcast on a `trip:{id}` channel. */
export const TripBroadcast = z.discriminatedUnion('type', [
  BroadcastPlaceAdded,
  BroadcastPlaceUpdated,
  BroadcastPlaceRemoved,
  BroadcastVoteCast,
  BroadcastPlanUpdated,
  BroadcastMemberJoined,
]);
export type TripBroadcast = z.infer<typeof TripBroadcast>;

/** The `trip:{id}` channel contract: name pattern + presence + broadcast schemas. */
export const tripRealtimeChannel = {
  namePattern: 'trip:{id}',
  prefix: TRIP_CHANNEL_PREFIX,
  presence: TripPresence,
  broadcast: TripBroadcast,
} as const;

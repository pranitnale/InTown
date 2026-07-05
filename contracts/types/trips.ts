import { z } from 'zod';
import { Uuid, IsoDate, IsoDateTime, JsonObject } from './common.ts';

/** Trips (§10). `city_stays[]` are modeled relationally as `trip_cities`. */
export const Trip = z.object({
  id: Uuid,
  owner_id: Uuid,
  name: z.string(),
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
});
export type Trip = z.infer<typeof Trip>;

/**
 * A city stay within a trip (§10). `ord` is the stay's position in the trip.
 * `accommodation` and `start_defaults` are freeform JSON (the PRD is terse) —
 * note: no coordinate field here; canonical coordinates live only on `pois`.
 */
export const TripCity = z.object({
  id: Uuid,
  trip_id: Uuid,
  /** Order of this stay within the trip (0-based). */
  ord: z.number().int().nonnegative(),
  city_id: Uuid,
  arrive: IsoDate,
  depart: IsoDate,
  accommodation: JsonObject.nullable(),
  /** Per-stay defaults (e.g. daily start time, wake/sleep windows). */
  start_defaults: JsonObject.nullable(),
});
export type TripCity = z.infer<typeof TripCity>;

export const TRIP_ROLE_VALUES = ['owner', 'editor', 'viewer'] as const;
export const TripRole = z.enum(TRIP_ROLE_VALUES);
export type TripRole = z.infer<typeof TripRole>;

export const TripMember = z.object({
  id: Uuid,
  trip_id: Uuid,
  user_id: Uuid,
  role: TripRole,
  joined_at: IsoDateTime,
});
export type TripMember = z.infer<typeof TripMember>;

/** Shareable invite (§10): a code granting a role until it expires or is revoked. */
export const TripInvite = z.object({
  id: Uuid,
  trip_id: Uuid,
  code: z.string(),
  role: TripRole,
  expires_at: IsoDateTime,
  revoked: z.boolean(),
  created_by: Uuid,
  created_at: IsoDateTime,
});
export type TripInvite = z.infer<typeof TripInvite>;

/**
 * Inter-city leg (§10) [P2]. Travel between two stays. Mode set is a sensible
 * minimal enum (noted in the WP-A capsule).
 */
export const INTERCITY_MODE_VALUES = ['train', 'bus', 'flight', 'car', 'ferry', 'other'] as const;
export const IntercityMode = z.enum(INTERCITY_MODE_VALUES);
export type IntercityMode = z.infer<typeof IntercityMode>;

export const IntercityLeg = z.object({
  id: Uuid,
  trip_id: Uuid,
  from_trip_city_id: Uuid.nullable(),
  to_trip_city_id: Uuid.nullable(),
  mode: IntercityMode,
  dep_time: IsoDateTime.nullable(),
  arr_time: IsoDateTime.nullable(),
  dep_place: z.string().nullable(),
  arr_place: z.string().nullable(),
  booking_ref: z.string().nullable(),
});
export type IntercityLeg = z.infer<typeof IntercityLeg>;

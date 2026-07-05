import { z } from 'zod';
import { Uuid, IsoDateTime } from './common.ts';

/**
 * A place on a trip city's curation list (§10, §6.3).
 *
 * `position` is a TEXT-FRACTIONAL string (fractional-indexing key, e.g.
 * `"a0"`, `"a0V"`) — NEVER a number — so reorders never renumber siblings.
 */
export const PLACE_STATE_VALUES = ['suggested', 'kept', 'removed', 'must_do'] as const;
export const PlaceState = z.enum(PLACE_STATE_VALUES);
export type PlaceState = z.infer<typeof PlaceState>;

export const TripPlace = z.object({
  id: Uuid,
  trip_city_id: Uuid,
  poi_id: Uuid,
  /** Text-fractional ordering key (string, not a number). */
  position: z.string(),
  state: PlaceState,
  added_by: Uuid,
  /** Estimated visit duration in minutes. */
  est_duration: z.number().int().positive().nullable(),
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
});
export type TripPlace = z.infer<typeof TripPlace>;

/** A member's vote on a place (§6.3 group fairness). */
export const VOTE_VALUE_VALUES = ['up', 'down'] as const;
export const VoteValue = z.enum(VOTE_VALUE_VALUES);
export type VoteValue = z.infer<typeof VoteValue>;

export const PlaceVote = z.object({
  id: Uuid,
  trip_place_id: Uuid,
  user_id: Uuid,
  vote: VoteValue,
  created_at: IsoDateTime,
});
export type PlaceVote = z.infer<typeof PlaceVote>;

/**
 * Append-only plan revision log (§10). Each re-solve/edit creates a new row;
 * rows are never mutated. `reason` includes the live-mode triggers
 * `go_now` / `closed_now`.
 */
export const PLAN_REVISION_REASON_VALUES = [
  'initial',
  'manual_edit',
  'reconfigure',
  'regenerated',
  'go_now',
  'closed_now',
  'restore',
] as const;
export const PlanRevisionReason = z.enum(PLAN_REVISION_REASON_VALUES);
export type PlanRevisionReason = z.infer<typeof PlanRevisionReason>;

export const PlanRevision = z.object({
  id: Uuid,
  trip_city_id: Uuid,
  /** Monotonic revision index within the trip city (0-based). */
  revision_index: z.number().int().nonnegative(),
  reason: PlanRevisionReason,
  created_by: Uuid,
  created_at: IsoDateTime,
});
export type PlanRevision = z.infer<typeof PlanRevision>;

/**
 * A scheduled stop in the materialized current revision (§10). One row per
 * scheduled item; the schedule for a revision is the set of its stops.
 * `stop_kind` distinguishes POI visits from meal/break slots (noted as a
 * sensible minimal shape in the WP-A capsule).
 */
export const STOP_KIND_VALUES = ['poi', 'meal', 'break'] as const;
export const StopKind = z.enum(STOP_KIND_VALUES);
export type StopKind = z.infer<typeof StopKind>;

export const Stop = z.object({
  id: Uuid,
  trip_city_id: Uuid,
  plan_revision_id: Uuid,
  /** Null for meal/break slots that are not tied to a specific POI. */
  poi_id: Uuid.nullable(),
  stop_kind: StopKind,
  /** 0-based day within the stay. */
  day_index: z.number().int().nonnegative(),
  /** 0-based order within the day. */
  ord: z.number().int().nonnegative(),
  start_time: IsoDateTime.nullable(),
  end_time: IsoDateTime.nullable(),
  est_duration: z.number().int().positive().nullable(),
});
export type Stop = z.infer<typeof Stop>;

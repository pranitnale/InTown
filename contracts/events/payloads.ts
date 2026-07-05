import { z } from 'zod';
import { Uuid, IsoDateTime, Money, VoteValue, PlanRevisionReason } from '../types/index.ts';

/**
 * §9.1 event payload schemas. Events are append-only, pseudonymized, and
 * time-partitioned; the envelope (`event_id`, `user_id`, `trip_id`,
 * `event_type`, `event_data`, `occurred_at`, `algo_version`, `consent_flag`)
 * lives on the `Event` entity — these schemas type the `event_data` per type.
 *
 * **No coordinates** appear in any payload (§5.5, §9.1): location-derived
 * signals are converted to derived events on-device (arrival/departure, dwell,
 * pace) — raw GPS traces are never sent or stored server-side.
 */

/** One ranked item in a shown list impression. */
export const RankedItem = z.object({
  trip_place_id: Uuid,
  poi_id: Uuid,
  rank: z.number().int().nonnegative(),
  tier: z.enum(['must_see', 'want', 'maybe']).nullable().optional(),
  score: z.number().nullable().optional(),
});
export type RankedItem = z.infer<typeof RankedItem>;

/** `list_shown` — impressions are required to learn: full ranking + algo version. */
export const ListShownPayload = z.object({
  trip_city_id: Uuid,
  ranking: z.array(RankedItem),
});
export type ListShownPayload = z.infer<typeof ListShownPayload>;

/** `place_reordered` — a pairwise preference signal (X above Y). */
export const PlaceReorderedPayload = z.object({
  trip_place_id: Uuid,
  poi_id: Uuid,
  from_rank: z.number().int().nonnegative(),
  to_rank: z.number().int().nonnegative(),
  /** Ordered trip_place_ids before/after the move (list context). */
  list_before: z.array(Uuid),
  list_after: z.array(Uuid),
});
export type PlaceReorderedPayload = z.infer<typeof PlaceReorderedPayload>;

export const PlaceRemovedPayload = z.object({
  trip_place_id: Uuid,
  poi_id: Uuid,
  rank: z.number().int().nonnegative(),
});
export type PlaceRemovedPayload = z.infer<typeof PlaceRemovedPayload>;

/** `card_opened` — with dwell time on the decision card. */
export const CardOpenedPayload = z.object({
  poi_id: Uuid,
  trip_place_id: Uuid.nullable().optional(),
  dwell_ms: z.number().int().nonnegative(),
});
export type CardOpenedPayload = z.infer<typeof CardOpenedPayload>;

export const MustDoLockedPayload = z.object({
  trip_place_id: Uuid,
  poi_id: Uuid,
});
export type MustDoLockedPayload = z.infer<typeof MustDoLockedPayload>;

export const VoteCastPayload = z.object({
  trip_place_id: Uuid,
  poi_id: Uuid,
  vote: VoteValue,
});
export type VoteCastPayload = z.infer<typeof VoteCastPayload>;

/** `place_visited` — geofence-derived actual dwell (no raw GPS, no coordinate). */
export const PlaceVisitedPayload = z.object({
  poi_id: Uuid,
  trip_place_id: Uuid.nullable().optional(),
  stop_id: Uuid.nullable().optional(),
  arrival_at: IsoDateTime.nullable().optional(),
  departure_at: IsoDateTime.nullable().optional(),
  dwell_ms: z.number().int().nonnegative().nullable().optional(),
});
export type PlaceVisitedPayload = z.infer<typeof PlaceVisitedPayload>;

/** `place_skipped` — geofence-derived skip of a planned stop. */
export const PlaceSkippedPayload = z.object({
  poi_id: Uuid,
  trip_place_id: Uuid.nullable().optional(),
  stop_id: Uuid.nullable().optional(),
});
export type PlaceSkippedPayload = z.infer<typeof PlaceSkippedPayload>;

export const NarrationGeneratedPayload = z.object({
  poi_id: Uuid,
  language: z.string(),
});
export type NarrationGeneratedPayload = z.infer<typeof NarrationGeneratedPayload>;

export const NarrationCompletedPayload = z.object({
  poi_id: Uuid,
  language: z.string(),
  listened_ms: z.number().int().nonnegative().nullable().optional(),
  completed: z.boolean(),
});
export type NarrationCompletedPayload = z.infer<typeof NarrationCompletedPayload>;

/** `go_now_triggered` — "Take me to #1 NOW". */
export const GoNowTriggeredPayload = z.object({
  poi_id: Uuid,
  trip_city_id: Uuid,
});
export type GoNowTriggeredPayload = z.infer<typeof GoNowTriggeredPayload>;

/** `closed_reported` — "It's closed!"; feeds a dated, attributed Brain fact. */
export const ClosedReportedPayload = z.object({
  poi_id: Uuid,
  trip_place_id: Uuid.nullable().optional(),
  reported_at: IsoDateTime,
});
export type ClosedReportedPayload = z.infer<typeof ClosedReportedPayload>;

/** `price_corrected` — post-visit price correction into the Brain. */
export const PriceCorrectedPayload = z.object({
  poi_id: Uuid,
  fact_id: Uuid.nullable().optional(),
  old_price: Money.nullable().optional(),
  proposed_price: Money,
});
export type PriceCorrectedPayload = z.infer<typeof PriceCorrectedPayload>;

export const PlanRegeneratedPayload = z.object({
  trip_city_id: Uuid,
  plan_revision_id: Uuid.nullable().optional(),
  reason: PlanRevisionReason,
});
export type PlanRegeneratedPayload = z.infer<typeof PlanRegeneratedPayload>;

/** `day_feedback` — end-of-day sentiment on a scheduled day. */
export const DayFeedbackPayload = z.object({
  trip_city_id: Uuid,
  day_index: z.number().int().nonnegative(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).nullable().optional(),
  note: z.string().nullable().optional(),
});
export type DayFeedbackPayload = z.infer<typeof DayFeedbackPayload>;

/** `list_finalized` — the ground-truth label (finalized order). */
export const ListFinalizedPayload = z.object({
  trip_city_id: Uuid,
  /** Final ordered trip_place_ids (the learning target). */
  ordered_place_ids: z.array(Uuid),
});
export type ListFinalizedPayload = z.infer<typeof ListFinalizedPayload>;

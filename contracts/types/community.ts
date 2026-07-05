import { z } from 'zod';
import { Uuid, IsoDateTime, Url, Json, JsonObject } from './common.ts';

/**
 * Reviews (§10, §16.3 Omnibus). `verified_visit` = GPS-confirmed presence.
 * Review status lifecycle is a sensible minimal set (noted in the WP-A capsule).
 */
export const REVIEW_STATUS_VALUES = ['pending', 'published', 'removed'] as const;
export const ReviewStatus = z.enum(REVIEW_STATUS_VALUES);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const Review = z.object({
  id: Uuid,
  poi_id: Uuid,
  user_id: Uuid,
  /** 1–5 star rating. */
  rating: z.number().int().min(1).max(5),
  text: z.string().nullable(),
  verified_visit: z.boolean(),
  status: ReviewStatus,
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
});
export type Review = z.infer<typeof Review>;

/**
 * DSA moderation audit log (§10, §16.2). Append-only record of a notice and the
 * decision + statement of reasons. `target_kind`/`decision` are sensible
 * minimal enums (noted in the WP-A capsule).
 */
export const MODERATION_TARGET_KIND_VALUES = [
  'review',
  'correction',
  'poi',
  'fact',
  'import',
] as const;
export const ModerationTargetKind = z.enum(MODERATION_TARGET_KIND_VALUES);
export type ModerationTargetKind = z.infer<typeof ModerationTargetKind>;

export const MODERATION_DECISION_VALUES = [
  'pending',
  'no_action',
  'content_removed',
  'content_demoted',
  'rejected',
] as const;
export const ModerationDecision = z.enum(MODERATION_DECISION_VALUES);
export type ModerationDecision = z.infer<typeof ModerationDecision>;

export const ModerationAction = z.object({
  id: Uuid,
  target_kind: ModerationTargetKind,
  target_id: Uuid,
  /** The Art. 16 notice text / report content. */
  notice: z.string(),
  decision: ModerationDecision,
  /** Art. 17 statement of reasons; null while pending. */
  statement_of_reasons: z.string().nullable(),
  reporter_id: Uuid.nullable(),
  moderator_id: Uuid.nullable(),
  noticed_at: IsoDateTime,
  decided_at: IsoDateTime.nullable(),
  created_at: IsoDateTime,
});
export type ModerationAction = z.infer<typeof ModerationAction>;

/**
 * A proposed correction to an atomic fact (§10, §6.15). `confirmations` counts
 * corroborating reports. Status lifecycle is a sensible minimal set (noted).
 */
export const CORRECTION_STATUS_VALUES = ['pending', 'accepted', 'rejected'] as const;
export const CorrectionStatus = z.enum(CORRECTION_STATUS_VALUES);
export type CorrectionStatus = z.infer<typeof CorrectionStatus>;

export const Correction = z.object({
  id: Uuid,
  fact_id: Uuid,
  proposed_value: Json,
  reporter_id: Uuid,
  confirmations: z.number().int().nonnegative(),
  status: CorrectionStatus,
  created_at: IsoDateTime,
});
export type Correction = z.infer<typeof Correction>;

/**
 * Saved "want to go" place (§10, §6.22 social import). Either resolves to a POI
 * (`poi_id`) or holds an `unresolved_name` until grounded. Status lets a saved
 * item be discarded (noted minimal set).
 */
export const WANT_TO_GO_STATUS_VALUES = ['saved', 'discarded', 'resolved'] as const;
export const WantToGoStatus = z.enum(WANT_TO_GO_STATUS_VALUES);
export type WantToGoStatus = z.infer<typeof WantToGoStatus>;

export const WantToGo = z.object({
  id: Uuid,
  user_id: Uuid,
  poi_id: Uuid.nullable(),
  unresolved_name: z.string().nullable(),
  /** Free-text city context (place may not be resolved to a city_id yet). */
  city: z.string().nullable(),
  source_url: Url.nullable(),
  /** Handle of the reel/post creator the place came from. */
  creator_handle: z.string().nullable(),
  status: WantToGoStatus,
  saved_at: IsoDateTime,
});
export type WantToGo = z.infer<typeof WantToGo>;

/**
 * Badge definition (§10, §6.21). `rule` is a server-config rule expression over
 * events (freeform JSON).
 */
export const Badge = z.object({
  id: Uuid,
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  rule: JsonObject,
  created_at: IsoDateTime,
});
export type Badge = z.infer<typeof Badge>;

/** A badge awarded to a user (§10). */
export const UserBadge = z.object({
  id: Uuid,
  user_id: Uuid,
  badge_id: Uuid,
  /** Trip the badge was earned on, if trip-scoped. */
  trip_id: Uuid.nullable(),
  awarded_at: IsoDateTime,
});
export type UserBadge = z.infer<typeof UserBadge>;

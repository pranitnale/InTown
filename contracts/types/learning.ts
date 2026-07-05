import { z } from 'zod';
import { Uuid, IsoDateTime, JsonObject } from './common.ts';

/**
 * Append-only event capture (§9.1, §10). Never UPDATEd, time-partitioned,
 * pseudonymized (`user_id` is the FK used for erasure). `event_type` is a free
 * string here — the authoritative name+payload catalog lives in
 * `contracts/events` (WP-B); `event_data` carries the typed payload as JSON.
 * `consent_flag` records whether learning consent was active at capture time.
 */
export const Event = z.object({
  id: Uuid,
  user_id: Uuid.nullable(),
  trip_id: Uuid.nullable(),
  event_type: z.string(),
  event_data: JsonObject,
  occurred_at: IsoDateTime,
  algo_version: z.string().nullable(),
  consent_flag: z.boolean(),
});
export type Event = z.infer<typeof Event>;

/**
 * Per-user preference projection (§9.2 v1). Deterministic per-feature weights
 * plus a compact behavioral summary injected into LLM scoring.
 */
export const UserPrefProfile = z.object({
  user_id: Uuid,
  /** Per-feature weights over place attributes (freeform JSON). */
  weights: JsonObject,
  /** Compact behavioral summary injected into LLM scoring; null if none yet. */
  preference_summary: z.string().nullable(),
  algo_version: z.string(),
  updated_at: IsoDateTime,
});
export type UserPrefProfile = z.infer<typeof UserPrefProfile>;

/**
 * Global quality-prior projection per (place × interest segment) (§9.2 v1):
 * Bayesian-smoothed posterior `(C·m + Σs) / (C + n)`. `segment` is null for the
 * global prior.
 */
export const ItemStats = z.object({
  id: Uuid,
  poi_id: Uuid,
  /** Interest segment (e.g. `history`); null = global prior. */
  segment: z.string().nullable(),
  /** Number of observations (n). */
  n: z.number().int().nonnegative(),
  /** Sum of scores (Σs). */
  sum_score: z.number(),
  /** Posterior mean after Bayesian smoothing. */
  posterior: z.number(),
  algo_version: z.string(),
  updated_at: IsoDateTime,
});
export type ItemStats = z.infer<typeof ItemStats>;

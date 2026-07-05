import { z } from 'zod';
import type { RouteContract } from './route.ts';
import { defineRoute } from './route.ts';
import { sseMessage, SseError } from './sse.ts';
import {
  Uuid,
  IsoDateTime,
  Url,
  Coordinate,
  IntercityMode,
  PlanRevision,
  Stop,
  StopKind,
} from '../types/index.ts';

/**
 * §11 / §6.8 / §8 — plan solving: `POST /plan` (anchors+times, SSE), plus
 * reconfigure / go-now / closed-now, revision history (+restore), and the
 * offline bundle manifest.
 *
 * Anchor coordinates here originate from the client (GPS / map tap /
 * accommodation), never from an LLM — the coordinate-integrity law (§5.5)
 * constrains pipeline *output*, not user-supplied navigation input. The solver
 * (OR-Tools), not any model, emits arrival times.
 */

const TripIdParams = z.object({ id: Uuid });
const RevisionParams = z.object({ id: Uuid, revisionId: Uuid });

/** Where a day starts from (§6.8). */
export const START_ANCHOR_KIND_VALUES = ['current_location', 'accommodation', 'custom'] as const;
export const StartAnchorKind = z.enum(START_ANCHOR_KIND_VALUES);
export type StartAnchorKind = z.infer<typeof StartAnchorKind>;

export const StartAnchor = z.object({
  kind: StartAnchorKind,
  /** Client-supplied coordinate (GPS / picked point); null for a known POI. */
  coord: Coordinate.nullable().optional(),
  /** Anchor a known place instead of a raw coordinate. */
  poi_id: Uuid.nullable().optional(),
  label: z.string().nullable().optional(),
});
export type StartAnchor = z.infer<typeof StartAnchor>;

/** Hard departure deadline (§6.8): the last day ends here at `deadline − buffer`. */
export const DepartureAnchor = z.object({
  coord: Coordinate.nullable().optional(),
  poi_id: Uuid.nullable().optional(),
  label: z.string().nullable().optional(),
  /** Must-be-there time. */
  deadline: IsoDateTime,
  mode: IntercityMode,
  /** Buffer before the deadline; server applies a profile default when omitted. */
  buffer_minutes: z.number().int().nonnegative().nullable().optional(),
});
export type DepartureAnchor = z.infer<typeof DepartureAnchor>;

/** Per-day configuration (§6.8). */
export const DayPlanConfig = z.object({
  day_index: z.number().int().nonnegative(),
  start_time: IsoDateTime.nullable().optional(),
  start_anchor: StartAnchor.nullable().optional(),
  /** Per-day walking budget in metres (§8 second dimension). */
  walking_budget_m: z.number().nonnegative().nullable().optional(),
});
export type DayPlanConfig = z.infer<typeof DayPlanConfig>;

/** Body for a full solve. */
export const PlanRequest = z.object({
  trip_city_id: Uuid,
  /** Default start anchor when a day omits its own. */
  start_anchor: StartAnchor,
  days: z.array(DayPlanConfig),
  departure_anchor: DepartureAnchor.nullable().optional(),
});
export type PlanRequest = z.infer<typeof PlanRequest>;

/** Terminal solve result (also carried by `plan_completed`). */
export const PlanResult = z.object({
  plan_revision_id: Uuid,
  trip_city_id: Uuid,
  day_count: z.number().int().nonnegative(),
});
export type PlanResult = z.infer<typeof PlanResult>;

/** Solve stages surfaced to the client (§7 stages 4–5). */
export const PLAN_STAGE_VALUES = ['solve', 'enrich'] as const;
export const PlanStage = z.enum(PLAN_STAGE_VALUES);
export type PlanStage = z.infer<typeof PlanStage>;

export const PlanStageStarted = sseMessage('stage_started', {
  stage: PlanStage,
  label: z.string(),
});

export const PlanStageLog = sseMessage('stage_log', {
  stage: PlanStage,
  message: z.string(),
});

/** A stop placed on the schedule. No coordinate — resolve from the POI (§5.5). */
export const PlanStopScheduled = sseMessage('stop_scheduled', {
  poi_id: Uuid.nullable(),
  stop_kind: StopKind,
  day_index: z.number().int().nonnegative(),
  ord: z.number().int().nonnegative(),
  start_time: IsoDateTime.nullable(),
  end_time: IsoDateTime.nullable(),
});

export const PlanDayReady = sseMessage('day_ready', {
  day_index: z.number().int().nonnegative(),
  stop_count: z.number().int().nonnegative(),
});

export const PlanCompleted = sseMessage('plan_completed', PlanResult.shape);

export const PlanStreamMessage = z.discriminatedUnion('type', [
  PlanStageStarted,
  PlanStageLog,
  PlanStopScheduled,
  PlanDayReady,
  PlanCompleted,
  SseError,
]);
export type PlanStreamMessage = z.infer<typeof PlanStreamMessage>;

/** Mid-day re-solve of the remaining day from now (§6.10, ≤5s). */
export const ReconfigureRequest = z.object({
  trip_city_id: Uuid,
  from_time: IsoDateTime,
  from_anchor: StartAnchor.nullable().optional(),
});
export type ReconfigureRequest = z.infer<typeof ReconfigureRequest>;

/** "Take me to #1 NOW" (§6.10) — replan around an immediate target. */
export const GoNowRequest = z.object({
  trip_city_id: Uuid,
  poi_id: Uuid,
  from_anchor: StartAnchor.nullable().optional(),
});
export type GoNowRequest = z.infer<typeof GoNowRequest>;

/** "It's closed!" (§6.10) — replan around a closure and file a closure report. */
export const ClosedNowRequest = z.object({
  trip_city_id: Uuid,
  poi_id: Uuid,
  trip_place_id: Uuid.nullable().optional(),
  from_time: IsoDateTime.nullable().optional(),
  from_anchor: StartAnchor.nullable().optional(),
});
export type ClosedNowRequest = z.infer<typeof ClosedNowRequest>;

export const ListRevisionsQuery = z.object({
  trip_city_id: Uuid.optional(),
});
export type ListRevisionsQuery = z.infer<typeof ListRevisionsQuery>;

/** A revision plus its materialized stops (revision history view). */
export const RevisionWithStops = z.object({
  revision: PlanRevision,
  stops: z.array(Stop),
});
export type RevisionWithStops = z.infer<typeof RevisionWithStops>;

/** Kinds of asset in an offline bundle (§6.20). Audio is intentionally absent. */
export const BUNDLE_ASSET_KIND_VALUES = [
  'plan',
  'place_card',
  'deep_text',
  'city_brief',
  'photo',
  'pmtiles',
  'style',
  'font',
] as const;
export const BundleAssetKind = z.enum(BUNDLE_ASSET_KIND_VALUES);
export type BundleAssetKind = z.infer<typeof BundleAssetKind>;

export const BundleAsset = z.object({
  kind: BundleAssetKind,
  /** Fetchable URL (or storage path) for the asset. */
  url: Url,
  bytes: z.number().int().nonnegative().nullable().optional(),
  /** Present for POI-scoped assets (place_card, deep_text, photo). */
  poi_id: Uuid.nullable().optional(),
});
export type BundleAsset = z.infer<typeof BundleAsset>;

/**
 * Offline bundle manifest (§6.20). Everything a traveler needs in airplane mode;
 * **no audio** (owner decision — narration streams online only).
 */
export const BundleManifest = z.object({
  trip_id: Uuid,
  trip_city_id: Uuid,
  plan_revision_id: Uuid,
  generated_at: IsoDateTime,
  /** City PMTiles basemap slice path (the largest asset, ~20–80 MB). */
  pmtiles_path: z.string().nullable(),
  assets: z.array(BundleAsset),
  total_bytes: z.number().int().nonnegative(),
});
export type BundleManifest = z.infer<typeof BundleManifest>;

export const planRoutes = {
  'plan.solve': defineRoute({
    method: 'POST',
    path: '/api/trips/:id/plan',
    auth: 'member',
    summary: 'Solve day-by-day itineraries from anchors + times (SSE).',
    params: TripIdParams,
    body: PlanRequest,
    response: PlanResult,
    sse: PlanStreamMessage,
  }),
  'plan.reconfigure': defineRoute({
    method: 'POST',
    path: '/api/trips/:id/plan/reconfigure',
    auth: 'member',
    summary: 'Re-solve the remaining day from the current time/location (SSE).',
    params: TripIdParams,
    body: ReconfigureRequest,
    response: PlanResult,
    sse: PlanStreamMessage,
  }),
  'plan.goNow': defineRoute({
    method: 'POST',
    path: '/api/trips/:id/plan/go-now',
    auth: 'member',
    summary: 'Replan around an immediate target ("Take me to #1 NOW") (SSE).',
    params: TripIdParams,
    body: GoNowRequest,
    response: PlanResult,
    sse: PlanStreamMessage,
  }),
  'plan.closedNow': defineRoute({
    method: 'POST',
    path: '/api/trips/:id/plan/closed-now',
    auth: 'member',
    summary: 'Replan around a closure and file a closure report ("It\'s closed!") (SSE).',
    params: TripIdParams,
    body: ClosedNowRequest,
    response: PlanResult,
    sse: PlanStreamMessage,
  }),
  'plan.listRevisions': defineRoute({
    method: 'GET',
    path: '/api/trips/:id/revisions',
    auth: 'member',
    summary: 'List append-only plan revisions with their stops.',
    params: TripIdParams,
    query: ListRevisionsQuery,
    response: z.array(RevisionWithStops),
  }),
  'plan.restoreRevision': defineRoute({
    method: 'POST',
    path: '/api/trips/:id/revisions/:revisionId/restore',
    auth: 'member',
    summary: 'Restore a prior revision (appends a new `restore` revision).',
    params: RevisionParams,
    response: PlanResult,
  }),
  'plan.bundle': defineRoute({
    method: 'GET',
    path: '/api/trips/:id/bundle',
    auth: 'member',
    summary: 'Offline bundle manifest (plan, cards, texts, brief, tiles — no audio).',
    params: TripIdParams,
    query: z.object({ trip_city_id: Uuid.optional() }),
    response: BundleManifest,
  }),
} satisfies Record<string, RouteContract>;

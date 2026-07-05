import { z } from 'zod';
import { Uuid, IsoDateTime } from '../types/index.ts';
import {
  ListShownPayload,
  PlaceReorderedPayload,
  PlaceRemovedPayload,
  CardOpenedPayload,
  MustDoLockedPayload,
  VoteCastPayload,
  PlaceVisitedPayload,
  PlaceSkippedPayload,
  NarrationGeneratedPayload,
  NarrationCompletedPayload,
  GoNowTriggeredPayload,
  ClosedReportedPayload,
  PriceCorrectedPayload,
  PlanRegeneratedPayload,
  DayFeedbackPayload,
  ListFinalizedPayload,
} from './payloads.ts';

export * from './payloads.ts';

/**
 * `@intown/contracts/events` — the frozen §9.1 event-type catalog.
 *
 * Each entry pairs the event's `event_data` payload schema with a `consent`
 * flag: `true` = capture/use for learning requires `personalization_learning`
 * consent (§16.1); `false` = a functional or safety/brain-integrity event
 * recorded regardless. The flags are sensible defaults per §9.1/§16.1 — the
 * authoritative gate is enforced server-side at ingest.
 */
export interface EventDef<P extends z.ZodType = z.ZodType> {
  payload: P;
  consent: boolean;
}
export type EventCatalog = Record<string, EventDef>;

/**
 * All §9.1 event types (the two slashed bullets — `place_visited/skipped` and
 * `narration_generated/completed` — are modeled as distinct event types).
 */
export const eventCatalog = {
  list_shown: { payload: ListShownPayload, consent: true },
  place_reordered: { payload: PlaceReorderedPayload, consent: true },
  place_removed: { payload: PlaceRemovedPayload, consent: true },
  card_opened: { payload: CardOpenedPayload, consent: true },
  must_do_locked: { payload: MustDoLockedPayload, consent: true },
  vote_cast: { payload: VoteCastPayload, consent: true },
  place_visited: { payload: PlaceVisitedPayload, consent: true },
  place_skipped: { payload: PlaceSkippedPayload, consent: true },
  narration_generated: { payload: NarrationGeneratedPayload, consent: false },
  narration_completed: { payload: NarrationCompletedPayload, consent: true },
  go_now_triggered: { payload: GoNowTriggeredPayload, consent: false },
  closed_reported: { payload: ClosedReportedPayload, consent: false },
  price_corrected: { payload: PriceCorrectedPayload, consent: false },
  plan_regenerated: { payload: PlanRegeneratedPayload, consent: true },
  day_feedback: { payload: DayFeedbackPayload, consent: true },
  list_finalized: { payload: ListFinalizedPayload, consent: true },
} as const satisfies EventCatalog;

/** The canonical event-type names (catalog keys). */
export const EVENT_TYPE_VALUES = Object.keys(eventCatalog) as [
  keyof typeof eventCatalog,
  ...(keyof typeof eventCatalog)[],
];
export const EventType = z.enum(
  Object.keys(eventCatalog) as [string, ...string[]],
);
export type EventType = keyof typeof eventCatalog;

/**
 * Wrap a payload in the client-supplied analytics envelope for `POST /events`.
 * The server fills `event_id`, resolves `user_id`, and stamps `consent_flag`.
 */
function analyticsEnvelope<T extends string, P extends z.ZodType>(event_type: T, payload: P) {
  return z.object({
    event_type: z.literal(event_type),
    occurred_at: IsoDateTime,
    trip_id: Uuid.nullish(),
    algo_version: z.string().nullish(),
    payload,
  });
}

/**
 * Discriminated union of every analytics event a client may submit in a
 * `POST /api/events` batch (§11), discriminated on `event_type`.
 */
export const AnalyticsEvent = z.discriminatedUnion('event_type', [
  analyticsEnvelope('list_shown', eventCatalog.list_shown.payload),
  analyticsEnvelope('place_reordered', eventCatalog.place_reordered.payload),
  analyticsEnvelope('place_removed', eventCatalog.place_removed.payload),
  analyticsEnvelope('card_opened', eventCatalog.card_opened.payload),
  analyticsEnvelope('must_do_locked', eventCatalog.must_do_locked.payload),
  analyticsEnvelope('vote_cast', eventCatalog.vote_cast.payload),
  analyticsEnvelope('place_visited', eventCatalog.place_visited.payload),
  analyticsEnvelope('place_skipped', eventCatalog.place_skipped.payload),
  analyticsEnvelope('narration_generated', eventCatalog.narration_generated.payload),
  analyticsEnvelope('narration_completed', eventCatalog.narration_completed.payload),
  analyticsEnvelope('go_now_triggered', eventCatalog.go_now_triggered.payload),
  analyticsEnvelope('closed_reported', eventCatalog.closed_reported.payload),
  analyticsEnvelope('price_corrected', eventCatalog.price_corrected.payload),
  analyticsEnvelope('plan_regenerated', eventCatalog.plan_regenerated.payload),
  analyticsEnvelope('day_feedback', eventCatalog.day_feedback.payload),
  analyticsEnvelope('list_finalized', eventCatalog.list_finalized.payload),
]);
export type AnalyticsEvent = z.infer<typeof AnalyticsEvent>;

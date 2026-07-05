import { z } from 'zod';

/**
 * SSE helpers. A streaming endpoint (research, plan) emits a sequence of JSON
 * messages over `text/event-stream`. Each message is a zod object discriminated
 * by a `type` literal; a stream schema is the {@link z.discriminatedUnion} over
 * all of a channel's message shapes.
 *
 * PRD law reflected here: research/plan SSE payloads carry **no coordinates**
 * (§5.5 — the LLM never emits geolocation). Streams reference `poi_id`; the
 * client resolves coordinates from the POI record via `GET /api/pois`.
 */

/**
 * Build one SSE message schema: a `type` discriminant literal plus payload
 * fields. Use the results as members of {@link z.discriminatedUnion}.
 */
export function sseMessage<T extends string, S extends Record<string, z.ZodType>>(
  type: T,
  shape: S,
) {
  return z.object({ type: z.literal(type), ...shape });
}

/**
 * Terminal/interstitial error message shared by every stream. `fatal: true`
 * means the stream ends after this message; `false` is a recoverable,
 * degrade-not-fail notice (🧭 reliability doctrine: labels, not blanks).
 */
export const SseError = sseMessage('error', {
  code: z.string(),
  message: z.string(),
  fatal: z.boolean(),
});
export type SseError = z.infer<typeof SseError>;

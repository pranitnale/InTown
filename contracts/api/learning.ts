import { z } from 'zod';
import type { RouteContract } from './route.ts';
import { defineRoute } from './route.ts';
import { Uuid, Url, Category, WantToGo, WantToGoStatus } from '../types/index.ts';
import { AnalyticsEvent } from '../events/index.ts';

/**
 * §11 / §6.22 / §9.1 — social import (Reel/TikTok → candidates), the personal
 * Want-to-go list, and the consent-gated analytics event batch.
 *
 * **No coordinates** appear in import output (§5.5): a candidate references a
 * grounded `poi_id` (resolved via a geospatial source) or an `unresolved_name`
 * — never a model-emitted lat/lng.
 */

const WantToGoIdParams = z.object({ id: Uuid });

/** Share an Instagram Reel / TikTok URL to extract place candidates. */
export const ImportSocialRequest = z.object({
  url: Url,
});
export type ImportSocialRequest = z.infer<typeof ImportSocialRequest>;

/** One extracted place candidate (no coordinate — see file header). */
export const ImportCandidate = z.object({
  /** Set when grounded to a known place via a geospatial source. */
  poi_id: Uuid.nullable(),
  /** Raw extracted name held until grounded. */
  unresolved_name: z.string().nullable(),
  city: z.string().nullable(),
  category: Category.nullable(),
  /** Preview photo URL (from the source or the resolved place). */
  photo_url: Url.nullable(),
  confidence: z.number().min(0).max(1),
});
export type ImportCandidate = z.infer<typeof ImportCandidate>;

export const ImportSocialResult = z.object({
  source_url: Url,
  creator_handle: z.string().nullable(),
  candidates: z.array(ImportCandidate),
});
export type ImportSocialResult = z.infer<typeof ImportSocialResult>;

/** Save a place to the Want-to-go list. */
export const SaveWantToGoBody = z.object({
  poi_id: Uuid.nullable().optional(),
  unresolved_name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  source_url: Url.nullable().optional(),
  creator_handle: z.string().nullable().optional(),
});
export type SaveWantToGoBody = z.infer<typeof SaveWantToGoBody>;

/** Change a saved item's status (discard / resolve). */
export const UpdateWantToGoBody = z.object({
  status: WantToGoStatus,
  /** Set when resolving an unresolved item to a grounded place. */
  poi_id: Uuid.nullable().optional(),
});
export type UpdateWantToGoBody = z.infer<typeof UpdateWantToGoBody>;

/** Consent-gated event batch (§9.1); `event_data` is validated per event_type. */
export const IngestEventsBody = z.object({
  events: z.array(AnalyticsEvent),
});
export type IngestEventsBody = z.infer<typeof IngestEventsBody>;

export const IngestEventsResult = z.object({
  accepted: z.number().int().nonnegative(),
});
export type IngestEventsResult = z.infer<typeof IngestEventsResult>;

export const learningRoutes = {
  'learning.importSocial': defineRoute({
    method: 'POST',
    path: '/api/import/social',
    auth: 'user',
    summary: 'Extract place candidates from a shared Reel/TikTok URL.',
    body: ImportSocialRequest,
    response: ImportSocialResult,
  }),
  'learning.listWantToGo': defineRoute({
    method: 'GET',
    path: '/api/want-to-go',
    auth: 'user',
    summary: 'List the personal Want-to-go items.',
    response: z.array(WantToGo),
  }),
  'learning.saveWantToGo': defineRoute({
    method: 'POST',
    path: '/api/want-to-go',
    auth: 'user',
    summary: 'Save a place to the Want-to-go list.',
    body: SaveWantToGoBody,
    response: WantToGo,
  }),
  'learning.updateWantToGo': defineRoute({
    method: 'PATCH',
    path: '/api/want-to-go/:id',
    auth: 'user',
    summary: 'Discard or resolve a Want-to-go item.',
    params: WantToGoIdParams,
    body: UpdateWantToGoBody,
    response: WantToGo,
  }),
  'learning.ingestEvents': defineRoute({
    method: 'POST',
    path: '/api/events',
    auth: 'user',
    summary: 'Ingest a batch of analytics events (consent-gated, append-only).',
    body: IngestEventsBody,
    response: IngestEventsResult,
  }),
} satisfies Record<string, RouteContract>;

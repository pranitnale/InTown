import { z } from 'zod';
import type { RouteContract } from './route.ts';
import { defineRoute } from './route.ts';
import { Uuid, CityBrief } from '../types/index.ts';

/**
 * §11 / §6.13 — narration (on-demand generate + cached MP3 stream) and the
 * per-language City Brief (§5.6). Audio is generated on demand only, cached per
 * (place, language) on the backend forever, and never bundled offline (owner
 * decision #8) — offline users read the deep place text instead.
 */

const PoiIdParams = z.object({ id: Uuid });
const CityIdParams = z.object({ id: Uuid });

/** Request narration generation for a place in a language. */
export const NarrationRequest = z.object({
  language: z.string(),
});
export type NarrationRequest = z.infer<typeof NarrationRequest>;

/** Lifecycle of a narration generation request. */
export const NARRATION_STATUS_VALUES = ['ready', 'generating', 'failed'] as const;
export const NarrationStatus = z.enum(NARRATION_STATUS_VALUES);
export type NarrationStatus = z.infer<typeof NarrationStatus>;

/** Result of a generate request; `audio_url` is set once `status: ready`. */
export const NarrationResult = z.object({
  poi_id: Uuid,
  language: z.string(),
  status: NarrationStatus,
  /** Streamable MP3 URL when ready (served by the GET stream route). */
  audio_url: z.string().nullable(),
});
export type NarrationResult = z.infer<typeof NarrationResult>;

export const contentRoutes = {
  'content.generateNarration': defineRoute({
    method: 'POST',
    path: '/api/pois/:id/narration',
    auth: 'user',
    summary: 'Generate (or return cached) narration audio for a place + language.',
    params: PoiIdParams,
    body: NarrationRequest,
    response: NarrationResult,
  }),
  'content.streamNarration': defineRoute({
    method: 'GET',
    path: '/api/pois/:id/narration',
    auth: 'user',
    summary: 'Stream the cached narration MP3 (audio/mpeg).',
    params: PoiIdParams,
    query: z.object({ language: z.string() }),
    // Binary audio/mpeg stream — no JSON body shape.
    response: z.unknown(),
  }),
  'content.cityBrief': defineRoute({
    method: 'GET',
    path: '/api/cities/:id/brief',
    auth: 'user',
    summary: 'City Brief (safety, scams, transit passes, etiquette, holidays).',
    params: CityIdParams,
    query: z.object({ language: z.string().optional() }),
    response: CityBrief,
  }),
} satisfies Record<string, RouteContract>;

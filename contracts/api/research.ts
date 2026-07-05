import { z } from 'zod';
import type { RouteContract } from './route.ts';
import { defineRoute } from './route.ts';
import { sseMessage, SseError } from './sse.ts';
import { Uuid, Category } from '../types/index.ts';

/**
 * §11 / §7 — `POST /api/trips/:id/research` (SSE staged pipeline).
 *
 * Streams the visible research log (§6.5 Labor Illusion): the pipeline stages
 * 0 BRAIN CHECK → 1 INTAKE → 2 CANDIDATES → 3 GROUND (the curation gate follows
 * in the UI). **No coordinates are ever streamed** (§5.5); `place_found`
 * references `poi_id` and the client resolves the pin from the POI record.
 */

const TripIdParams = z.object({ id: Uuid });

/** Research pipeline stages surfaced to the client (§7). */
export const RESEARCH_STAGE_VALUES = [
  'brain_check',
  'intake',
  'candidates',
  'ground',
] as const;
export const ResearchStage = z.enum(RESEARCH_STAGE_VALUES);
export type ResearchStage = z.infer<typeof ResearchStage>;

/** Body for a research run. */
export const ResearchRequest = z.object({
  /** Which city stay to research; omit for a single-city trip's only stay. */
  trip_city_id: Uuid.nullable().optional(),
  /** Force a fresh deep-research pass even if the City Brain is warm. */
  force_refresh: z.boolean().optional(),
});
export type ResearchRequest = z.infer<typeof ResearchRequest>;

/** Terminal result shape (also carried by the `research_completed` message). */
export const ResearchResult = z.object({
  trip_city_id: Uuid,
  candidate_count: z.number().int().nonnegative(),
  longlist_ready: z.boolean(),
});
export type ResearchResult = z.infer<typeof ResearchResult>;

/** A stage begins. */
export const ResearchStageStarted = sseMessage('stage_started', {
  stage: ResearchStage,
  label: z.string(),
});

/** A live research-log line ("Reading 34 blog posts about Lisbon…"). */
export const ResearchStageLog = sseMessage('stage_log', {
  stage: ResearchStage,
  message: z.string(),
});

/**
 * A place resolved into the Brain (a pin drops on the map). No coordinate is
 * streamed — the client fetches it from the POI record (§5.5).
 */
export const ResearchPlaceFound = sseMessage('place_found', {
  poi_id: Uuid,
  name: z.string(),
  category: Category,
});

/** A candidate scored against the merged group profile (§7 stage 2). */
export const ResearchCandidateScored = sseMessage('candidate_scored', {
  poi_id: Uuid,
  score: z.number(),
  tier: z.enum(['must_see', 'want', 'maybe']).nullable().optional(),
  justification: z.string().nullable().optional(),
});

/** A stage completes. */
export const ResearchStageCompleted = sseMessage('stage_completed', {
  stage: ResearchStage,
  summary: z.string().nullable().optional(),
});

/** The longlist is ready. */
export const ResearchCompleted = sseMessage('research_completed', ResearchResult.shape);

/** Every message the research stream can emit. */
export const ResearchStreamMessage = z.discriminatedUnion('type', [
  ResearchStageStarted,
  ResearchStageLog,
  ResearchPlaceFound,
  ResearchCandidateScored,
  ResearchStageCompleted,
  ResearchCompleted,
  SseError,
]);
export type ResearchStreamMessage = z.infer<typeof ResearchStreamMessage>;

export const researchRoutes = {
  'research.run': defineRoute({
    method: 'POST',
    path: '/api/trips/:id/research',
    auth: 'member',
    summary: 'Run the deep-research pipeline (SSE staged progress) for a city stay.',
    params: TripIdParams,
    body: ResearchRequest,
    response: ResearchResult,
    sse: ResearchStreamMessage,
  }),
} satisfies Record<string, RouteContract>;

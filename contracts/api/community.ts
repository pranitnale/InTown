import { z } from 'zod';
import type { RouteContract } from './route.ts';
import { defineRoute } from './route.ts';
import {
  Uuid,
  Json,
  Review,
  Correction,
  ModerationAction,
  ModerationTargetKind,
  ModerationDecision,
} from '../types/index.ts';

/**
 * §11 / §6.15 / §16.2 — reviews, fact corrections, DSA notice reports, and the
 * admin moderation queue (the Art. 16/17 audit surface).
 */

const ModerationIdParams = z.object({ id: Uuid });

export const CreateReviewBody = z.object({
  poi_id: Uuid,
  rating: z.number().int().min(1).max(5),
  text: z.string().nullable().optional(),
});
export type CreateReviewBody = z.infer<typeof CreateReviewBody>;

/** Propose a competing value for an atomic fact (§6.15). */
export const CreateCorrectionBody = z.object({
  fact_id: Uuid,
  proposed_value: Json,
});
export type CreateCorrectionBody = z.infer<typeof CreateCorrectionBody>;

/** DSA Art. 16 notice against any moderatable target. */
export const CreateReportBody = z.object({
  target_kind: ModerationTargetKind,
  target_id: Uuid,
  notice: z.string().min(1),
});
export type CreateReportBody = z.infer<typeof CreateReportBody>;

/** Admin decision on a queued notice (Art. 17 statement of reasons). */
export const ModerationDecisionBody = z.object({
  decision: ModerationDecision,
  statement_of_reasons: z.string().nullable().optional(),
});
export type ModerationDecisionBody = z.infer<typeof ModerationDecisionBody>;

export const ModerationQueueQuery = z.object({
  decision: ModerationDecision.optional(),
  target_kind: ModerationTargetKind.optional(),
});
export type ModerationQueueQuery = z.infer<typeof ModerationQueueQuery>;

export const communityRoutes = {
  'community.createReview': defineRoute({
    method: 'POST',
    path: '/api/reviews',
    auth: 'user',
    summary: 'Post a review (verified_visit set server-side from geofence).',
    body: CreateReviewBody,
    response: Review,
  }),
  'community.createCorrection': defineRoute({
    method: 'POST',
    path: '/api/corrections',
    auth: 'user',
    summary: 'Propose a correction to an atomic fact.',
    body: CreateCorrectionBody,
    response: Correction,
  }),
  'community.createReport': defineRoute({
    method: 'POST',
    path: '/api/reports',
    auth: 'user',
    summary: 'File a DSA notice; creates a pending moderation action.',
    body: CreateReportBody,
    response: ModerationAction,
  }),
  'community.moderationQueue': defineRoute({
    method: 'GET',
    path: '/api/moderation',
    auth: 'admin',
    summary: 'List moderation actions (admin queue).',
    query: ModerationQueueQuery,
    response: z.array(ModerationAction),
  }),
  'community.moderationDecide': defineRoute({
    method: 'PATCH',
    path: '/api/moderation/:id',
    auth: 'admin',
    summary: 'Record a moderation decision + statement of reasons (admin).',
    params: ModerationIdParams,
    body: ModerationDecisionBody,
    response: ModerationAction,
  }),
} satisfies Record<string, RouteContract>;

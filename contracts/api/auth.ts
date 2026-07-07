import { z } from 'zod';
import type { RouteContract } from './route.ts';
import { defineRoute } from './route.ts';
import {
  User,
  TravelerProfile,
  TasteProfile,
  AccountExport,
  Consent,
  AgeBand,
  Mobility,
  CurrencyCode,
  ConsentType,
  BudgetTier,
  Pace,
} from '../types/index.ts';

/**
 * §11 — Auth / profile / consents.
 *
 * `/api/auth/*` is served by Auth.js (a library inside the API, decision #21),
 * so its request/response shapes are opaque here (passthrough). Profile and
 * consent routes are typed against the §10 entities.
 */

/** Editable subset of the user record. */
export const UpdateProfileBody = z
  .object({
    display_name: z.string().nullable(),
    handle: z.string().nullable(),
    locale: z.string().nullable(),
  })
  .partial();
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

/** Editable traveler-profile fields (id/user_id/timestamps are server-owned). */
export const UpdateTravelerProfileBody = z
  .object({
    age_band: AgeBand,
    mobility: Mobility,
    eu_residency: z.boolean(),
    student: z.boolean(),
    languages: z.array(z.string()),
    currency: CurrencyCode,
  })
  .partial();
export type UpdateTravelerProfileBody = z.infer<typeof UpdateTravelerProfileBody>;

/**
 * A new taste-profile version (§10). All list fields are required (send the full
 * desired state); the server assigns the next `version` and never edits an
 * existing row. `anti_preferences` are soft (down-weight) and `hard_exclusions`
 * are absolute vetoes — distinct fields with distinct semantics (the museum
 * problem, §6.2).
 */
export const UpdateTasteProfileBody = z.object({
  /** Ranked interest tags, most-preferred first. */
  interests: z.array(z.string()),
  anti_preferences: z.array(z.string()),
  hard_exclusions: z.array(z.string()),
  dietary: z.array(z.string()),
  budget_tier: BudgetTier,
  pace: Pace,
});
export type UpdateTasteProfileBody = z.infer<typeof UpdateTasteProfileBody>;

/** Set/revoke a single consent (consent-or-pay, §16.1). */
export const SetConsentBody = z.object({
  consent_type: ConsentType,
  granted: z.boolean(),
  policy_version: z.string(),
});
export type SetConsentBody = z.infer<typeof SetConsentBody>;

export const authRoutes = {
  'auth.handlerGet': defineRoute({
    method: 'GET',
    path: '/api/auth/*',
    auth: 'public',
    summary: 'Auth.js catch-all (session, callback, providers).',
    response: z.unknown(),
  }),
  'auth.handlerPost': defineRoute({
    method: 'POST',
    path: '/api/auth/*',
    auth: 'public',
    summary: 'Auth.js catch-all (sign-in, sign-out, callback).',
    response: z.unknown(),
  }),
  'auth.getProfile': defineRoute({
    method: 'GET',
    path: '/api/profile',
    auth: 'user',
    summary: 'Current user record.',
    response: User,
  }),
  'auth.updateProfile': defineRoute({
    method: 'PATCH',
    path: '/api/profile',
    auth: 'user',
    summary: 'Update editable profile fields.',
    body: UpdateProfileBody,
    response: User,
  }),
  'auth.getTravelerProfile': defineRoute({
    method: 'GET',
    path: '/api/profile/traveler',
    auth: 'user',
    summary: 'Current traveler profile (age band, mobility, languages, currency).',
    response: TravelerProfile.nullable(),
  }),
  'auth.updateTravelerProfile': defineRoute({
    method: 'PUT',
    path: '/api/profile/traveler',
    auth: 'user',
    summary: 'Upsert the traveler profile (drives pricing + pacing defaults).',
    body: UpdateTravelerProfileBody,
    response: TravelerProfile,
  }),
  'auth.getTasteProfile': defineRoute({
    method: 'GET',
    path: '/api/profile/taste',
    auth: 'user',
    summary: 'Latest taste-profile version (ranks, anti-preferences, exclusions, dietary, budget, pace).',
    response: TasteProfile.nullable(),
  }),
  'auth.updateTasteProfile': defineRoute({
    method: 'PUT',
    path: '/api/profile/taste',
    auth: 'user',
    summary: 'Append a new taste-profile version (history is never edited in place).',
    body: UpdateTasteProfileBody,
    response: TasteProfile,
  }),
  'auth.exportAccount': defineRoute({
    method: 'GET',
    path: '/api/account/export',
    auth: 'user',
    summary: 'GDPR subject-access export: user, traveler profile, all taste versions, consents.',
    response: AccountExport,
  }),
  'auth.eraseAccount': defineRoute({
    method: 'DELETE',
    path: '/api/account',
    auth: 'user',
    summary: 'GDPR erasure: delete the user + cascaded personal rows; anonymous aggregates survive.',
    response: z.object({ erased: z.boolean() }),
  }),
  'auth.getConsents': defineRoute({
    method: 'GET',
    path: '/api/consents',
    auth: 'user',
    summary: 'List the current user consent records.',
    response: z.array(Consent),
  }),
  'auth.setConsent': defineRoute({
    method: 'PUT',
    path: '/api/consents',
    auth: 'user',
    summary: 'Grant or revoke a consent; appends a new consent state row.',
    body: SetConsentBody,
    response: Consent,
  }),
} satisfies Record<string, RouteContract>;

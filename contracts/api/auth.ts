import { z } from 'zod';
import type { RouteContract } from './route.ts';
import { defineRoute } from './route.ts';
import {
  User,
  TravelerProfile,
  Consent,
  AgeBand,
  Mobility,
  CurrencyCode,
  ConsentType,
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

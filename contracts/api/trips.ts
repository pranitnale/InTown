import { z } from 'zod';
import type { RouteContract } from './route.ts';
import { defineRoute } from './route.ts';
import {
  Uuid,
  IsoDate,
  Trip,
  TripCity,
  TripMember,
  TripInvite,
  TripRole,
  JsonObject,
} from '../types/index.ts';

/**
 * §11 — Trips CRUD + members / invites / join + cities [P2].
 */

/** `:id` = trip id. */
export const TripIdParams = z.object({ id: Uuid });
export type TripIdParams = z.infer<typeof TripIdParams>;

export const CreateTripBody = z.object({
  name: z.string().min(1),
});
export type CreateTripBody = z.infer<typeof CreateTripBody>;

export const UpdateTripBody = z
  .object({
    name: z.string().min(1),
  })
  .partial();
export type UpdateTripBody = z.infer<typeof UpdateTripBody>;

/** Create an invite code granting a role until it expires. */
export const CreateInviteBody = z.object({
  role: TripRole,
  expires_at: z.iso.datetime({ offset: true }),
});
export type CreateInviteBody = z.infer<typeof CreateInviteBody>;

/** Change a member's role (owner only). */
export const UpdateMemberBody = z.object({
  role: TripRole,
});
export type UpdateMemberBody = z.infer<typeof UpdateMemberBody>;

/** Add a city stay to a trip [P2]. No coordinate — geo lives on `pois`. */
export const AddTripCityBody = z.object({
  city_id: Uuid,
  ord: z.number().int().nonnegative(),
  arrive: IsoDate,
  depart: IsoDate,
  accommodation: JsonObject.nullable().optional(),
  start_defaults: JsonObject.nullable().optional(),
});
export type AddTripCityBody = z.infer<typeof AddTripCityBody>;

export const UpdateTripCityBody = AddTripCityBody.partial();
export type UpdateTripCityBody = z.infer<typeof UpdateTripCityBody>;

const InviteIdParams = z.object({ id: Uuid, inviteId: Uuid });
const MemberIdParams = z.object({ id: Uuid, userId: Uuid });
const CityIdParams = z.object({ id: Uuid, cityId: Uuid });
const JoinParams = z.object({ code: z.string() });

export const tripsRoutes = {
  'trips.list': defineRoute({
    method: 'GET',
    path: '/api/trips',
    auth: 'user',
    summary: 'List trips the current user owns or is a member of.',
    response: z.array(Trip),
  }),
  'trips.create': defineRoute({
    method: 'POST',
    path: '/api/trips',
    auth: 'user',
    summary: 'Create a trip (caller becomes owner).',
    body: CreateTripBody,
    response: Trip,
  }),
  'trips.get': defineRoute({
    method: 'GET',
    path: '/api/trips/:id',
    auth: 'member',
    summary: 'Fetch a trip.',
    params: TripIdParams,
    response: Trip,
  }),
  'trips.update': defineRoute({
    method: 'PATCH',
    path: '/api/trips/:id',
    auth: 'owner',
    summary: 'Update trip fields (owner).',
    params: TripIdParams,
    body: UpdateTripBody,
    response: Trip,
  }),
  'trips.delete': defineRoute({
    method: 'DELETE',
    path: '/api/trips/:id',
    auth: 'owner',
    summary: 'Delete a trip (owner).',
    params: TripIdParams,
    response: z.object({ deleted: z.literal(true) }),
  }),
  'trips.listMembers': defineRoute({
    method: 'GET',
    path: '/api/trips/:id/members',
    auth: 'member',
    summary: 'List trip members and roles.',
    params: TripIdParams,
    response: z.array(TripMember),
  }),
  'trips.updateMember': defineRoute({
    method: 'PATCH',
    path: '/api/trips/:id/members/:userId',
    auth: 'owner',
    summary: "Change a member's role (owner).",
    params: MemberIdParams,
    body: UpdateMemberBody,
    response: TripMember,
  }),
  'trips.removeMember': defineRoute({
    method: 'DELETE',
    path: '/api/trips/:id/members/:userId',
    auth: 'owner',
    summary: 'Remove a member (owner).',
    params: MemberIdParams,
    response: z.object({ removed: z.literal(true) }),
  }),
  'trips.listInvites': defineRoute({
    method: 'GET',
    path: '/api/trips/:id/invites',
    auth: 'owner',
    summary: 'List active invites (owner).',
    params: TripIdParams,
    response: z.array(TripInvite),
  }),
  'trips.createInvite': defineRoute({
    method: 'POST',
    path: '/api/trips/:id/invites',
    auth: 'owner',
    summary: 'Create an invite code (owner).',
    params: TripIdParams,
    body: CreateInviteBody,
    response: TripInvite,
  }),
  'trips.revokeInvite': defineRoute({
    method: 'DELETE',
    path: '/api/trips/:id/invites/:inviteId',
    auth: 'owner',
    summary: 'Revoke an invite (owner).',
    params: InviteIdParams,
    response: z.object({ revoked: z.literal(true) }),
  }),
  'trips.join': defineRoute({
    method: 'POST',
    path: '/api/join/:code',
    auth: 'user',
    summary: 'Redeem an invite code and join the trip.',
    params: JoinParams,
    response: TripMember,
  }),
  'trips.listCities': defineRoute({
    method: 'GET',
    path: '/api/trips/:id/cities',
    auth: 'member',
    summary: 'List the trip city stays [P2].',
    params: TripIdParams,
    response: z.array(TripCity),
  }),
  'trips.addCity': defineRoute({
    method: 'POST',
    path: '/api/trips/:id/cities',
    auth: 'member',
    summary: 'Add a city stay [P2] (member with editor role).',
    params: TripIdParams,
    body: AddTripCityBody,
    response: TripCity,
  }),
  'trips.updateCity': defineRoute({
    method: 'PATCH',
    path: '/api/trips/:id/cities/:cityId',
    auth: 'member',
    summary: 'Update a city stay [P2].',
    params: CityIdParams,
    body: UpdateTripCityBody,
    response: TripCity,
  }),
  'trips.removeCity': defineRoute({
    method: 'DELETE',
    path: '/api/trips/:id/cities/:cityId',
    auth: 'member',
    summary: 'Remove a city stay [P2].',
    params: CityIdParams,
    response: z.object({ removed: z.literal(true) }),
  }),
} satisfies Record<string, RouteContract>;

import { z } from 'zod';
import type { RouteContract } from './route.ts';
import { defineRoute } from './route.ts';
import { Uuid, TripPlace, PlaceVote, PlaceState, VoteValue } from '../types/index.ts';

/**
 * §11 / §6.6 — curation list: list / add / patch (position|state) / vote.
 * `position` is a text-fractional string (fractional indexing, §6.3) — reorders
 * write only the moved row.
 */

const TripIdParams = z.object({ id: Uuid });
const PlaceParams = z.object({ id: Uuid, placeId: Uuid });

/** Optional filter: restrict the list to one city stay. */
export const ListPlacesQuery = z.object({
  trip_city_id: Uuid.optional(),
});
export type ListPlacesQuery = z.infer<typeof ListPlacesQuery>;

/** Add a place to a city stay's list (attributed to the caller). */
export const AddPlaceBody = z.object({
  trip_city_id: Uuid,
  poi_id: Uuid,
  /** Text-fractional key; server assigns one if omitted (append). */
  position: z.string().optional(),
  state: PlaceState.optional(),
});
export type AddPlaceBody = z.infer<typeof AddPlaceBody>;

/** Patch a place's ordering key and/or curation state (reorder, lock must-do). */
export const PatchPlaceBody = z
  .object({
    position: z.string(),
    state: PlaceState,
  })
  .partial();
export type PatchPlaceBody = z.infer<typeof PatchPlaceBody>;

/** Cast a vote on a place (§6.3 group fairness). */
export const VotePlaceBody = z.object({
  vote: VoteValue,
});
export type VotePlaceBody = z.infer<typeof VotePlaceBody>;

export const placesRoutes = {
  'places.list': defineRoute({
    method: 'GET',
    path: '/api/trips/:id/places',
    auth: 'member',
    summary: 'List curated places for a trip (optionally one city stay).',
    params: TripIdParams,
    query: ListPlacesQuery,
    response: z.array(TripPlace),
  }),
  'places.add': defineRoute({
    method: 'POST',
    path: '/api/trips/:id/places',
    auth: 'member',
    summary: 'Add a place to the curation list (editor role).',
    params: TripIdParams,
    body: AddPlaceBody,
    response: TripPlace,
  }),
  'places.patch': defineRoute({
    method: 'PATCH',
    path: '/api/trips/:id/places/:placeId',
    auth: 'member',
    summary: 'Reorder (position) or restate (kept/removed/must_do) a place.',
    params: PlaceParams,
    body: PatchPlaceBody,
    response: TripPlace,
  }),
  'places.vote': defineRoute({
    method: 'POST',
    path: '/api/trips/:id/places/:placeId/vote',
    auth: 'member',
    summary: 'Cast or update a vote on a place.',
    params: PlaceParams,
    body: VotePlaceBody,
    response: PlaceVote,
  }),
} satisfies Record<string, RouteContract>;

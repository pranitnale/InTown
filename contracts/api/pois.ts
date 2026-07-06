import { z } from 'zod';
import type { RouteContract } from './route.ts';
import { defineRoute } from './route.ts';
import {
  Uuid,
  Category,
  Poi,
  Fact,
  PoiHours,
  PoiEnrichment,
  Review,
  BBox,
} from '../types/index.ts';

/**
 * §11 — POI reads: decision card, viewport/category list, search-to-add.
 * The card is a composite of §10 entities (facts shown only with citation,
 * §5.3). Nothing on a card is guessed — unknowns render "check official site".
 */

const PoiIdParams = z.object({ id: Uuid });

/**
 * The decision card (§6.6): the canonical place plus its cited facts, hours,
 * per-language enrichment summary, and review aggregate. Facts carry their own
 * source_url / source_kind / confidence for the citation UX.
 */
export const PoiCard = z.object({
  poi: Poi,
  facts: z.array(Fact),
  hours: z.array(PoiHours),
  /** Enrichment for the requested language, null if not yet generated. */
  enrichment: PoiEnrichment.nullable(),
  reviews: z.array(Review),
  /** Aggregate own-rating (1–5), null until enough reviews exist. */
  rating_avg: z.number().min(1).max(5).nullable(),
  rating_count: z.number().int().nonnegative(),
});
export type PoiCard = z.infer<typeof PoiCard>;

export const PoiCardQuery = z.object({
  /** BCP-47 language for the enrichment summary. */
  language: z.string().optional(),
});
export type PoiCardQuery = z.infer<typeof PoiCardQuery>;

/**
 * A viewport bounding box, wire-encoded as the CSV string
 * `"minLng,minLat,maxLng,maxLat"` (e.g. `"2.22,48.81,2.47,48.90"`). GET params
 * are always strings, so it arrives flat and is parsed + range-validated here
 * into a {@link BBox}. These coordinates come from the map viewport, never LLM
 * output.
 */
export const BBoxParam = z
  // Strict shape gate first: exactly four numeric components. Guards against
  // `Number('') === 0`, which would otherwise let `",,,"` parse to an all-zero box.
  .string()
  .regex(
    /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/,
    'expected "minLng,minLat,maxLng,maxLat"',
  )
  .transform((value, ctx) => {
    const [min_lng, min_lat, max_lng, max_lat] = value.split(',').map(Number);
    const parsed = BBox.safeParse({ min_lng, min_lat, max_lng, max_lat });
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: 'bbox coordinates out of range' });
      return z.NEVER;
    }
    return parsed.data;
  });
export type BBoxParam = z.infer<typeof BBoxParam>;

/**
 * Viewport / category listing. Either a `city_id` or a `bbox` scopes the query;
 * `bbox` is the CSV `"minLng,minLat,maxLng,maxLat"` string (see {@link BBoxParam}).
 * Numeric filters are `z.coerce.number()` because querystring values arrive as
 * strings.
 */
export const ListPoisQuery = z.object({
  city_id: Uuid.optional(),
  bbox: BBoxParam.optional(),
  category: Category.optional(),
  /** Minimum prominence [0,1] to include (declutter the map at low zoom). */
  min_prominence: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});
export type ListPoisQuery = z.infer<typeof ListPoisQuery>;

/** Free-text search-to-add (§6.6), biased to a city. */
export const SearchPoisQuery = z.object({
  q: z.string().min(1),
  city_id: Uuid.optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});
export type SearchPoisQuery = z.infer<typeof SearchPoisQuery>;

export const poisRoutes = {
  'pois.card': defineRoute({
    method: 'GET',
    path: '/api/pois/:id/card',
    auth: 'user',
    summary: 'Full decision card for a place (cited facts, hours, enrichment, reviews).',
    params: PoiIdParams,
    query: PoiCardQuery,
    response: PoiCard,
  }),
  'pois.list': defineRoute({
    method: 'GET',
    path: '/api/pois',
    auth: 'user',
    summary: 'List places by viewport (bbox) and/or category.',
    query: ListPoisQuery,
    response: z.array(Poi),
  }),
  'pois.search': defineRoute({
    method: 'GET',
    path: '/api/pois/search',
    auth: 'user',
    summary: 'Search places by name (search-to-add), city-biased.',
    query: SearchPoisQuery,
    response: z.array(Poi),
  }),
} satisfies Record<string, RouteContract>;

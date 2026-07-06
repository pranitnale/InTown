import { z } from 'zod';
import type { RouteContract } from './route.ts';
import { defineRoute } from './route.ts';
import { Url, Coordinate } from '../types/index.ts';

/**
 * §11 / §6.9 — `GET /api/geo/route`: overview polyline + ETA for a leg, plus the
 * Google Maps deep-link params (turn-by-turn is delegated to Google, #11).
 *
 * Origin/destination coordinates are client/geospatial-sourced (a solved stop's
 * grounded coordinate or the device GPS), never LLM output (§5.5).
 */

/** Google Maps `travelmode` values we emit deep links for. */
export const GEO_TRAVEL_MODE_VALUES = ['walking', 'transit', 'driving'] as const;
export const GeoTravelMode = z.enum(GEO_TRAVEL_MODE_VALUES);
export type GeoTravelMode = z.infer<typeof GeoTravelMode>;

/**
 * A single querystring coordinate, wire-encoded as `"lat,lng"` (e.g.
 * `"48.8584,2.2945"`). GET params are always strings, so origin/destination
 * arrive flat and are parsed + range-validated here into a {@link Coordinate}.
 */
export const CoordinateParam = z
  // Strict shape gate first: exactly two numeric components. Guards against
  // `Number('') === 0`, which would otherwise let `","` parse to {lat:0,lng:0}.
  .string()
  .regex(/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/, 'expected "lat,lng"')
  .transform((value, ctx) => {
    const [lat, lng] = value.split(',').map(Number);
    const parsed = Coordinate.safeParse({ lat, lng });
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: 'lat/lng out of range' });
      return z.NEVER;
    }
    return parsed.data;
  });
export type CoordinateParam = z.infer<typeof CoordinateParam>;

export const GeoRouteQuery = z.object({
  /** Origin coordinate, wire-encoded as `"lat,lng"`. */
  origin: CoordinateParam,
  /** Destination coordinate, wire-encoded as `"lat,lng"`. */
  destination: CoordinateParam,
  mode: GeoTravelMode,
  /** Google `destination_place_id` when the destination is a known place. */
  destination_place_id: z.string().optional(),
});
export type GeoRouteQuery = z.infer<typeof GeoRouteQuery>;

export const GeoRoute = z.object({
  /** Encoded overview polyline (our summary geometry, not turn-by-turn). */
  polyline: z.string(),
  distance_m: z.number().nonnegative(),
  duration_s: z.number().nonnegative(),
  mode: GeoTravelMode,
  /** `https://www.google.com/maps/dir/?api=1&...` deep link for this leg. */
  deep_link: Url,
});
export type GeoRoute = z.infer<typeof GeoRoute>;

export const geoRoutes = {
  'geo.route': defineRoute({
    method: 'GET',
    path: '/api/geo/route',
    auth: 'user',
    summary: 'Overview polyline + ETA + Google Maps deep link for a leg.',
    query: GeoRouteQuery,
    response: GeoRoute,
  }),
} satisfies Record<string, RouteContract>;

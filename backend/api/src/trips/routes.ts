import { tripsRoutes } from '@intown/contracts/api';
import type {
  CreateTripBody,
  UpdateTripBody,
  AddTripCityBody,
  UpdateTripCityBody,
} from '@intown/contracts/api';
import type { Trip, TripCity, JsonObject } from '@intown/contracts/types';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Pools } from '../db/pool.ts';
import { registerRoute, type RouteHandler } from '../http/router.ts';
import { withUserContext } from '../auth/session.ts';
import { assertEditor } from './authz.ts';

/**
 * Trips CRUD + city-stay routes (P06, §6.3). Every handler runs through
 * `withUserContext` on the RLS-bound app pool, so the trips-domain policies
 * (0013) scope reads/writes to the caller's membership — the queries never trust
 * a trip/user id smuggled in a body. `requireAuth('member' | 'owner')` (the
 * router's preHandler) has already resolved and gated the caller's role and
 * stashed it on `req.tripRole`; the city write paths additionally call
 * `assertEditor` so a viewer (a member who may only read) gets a 403.
 *
 * The owner-is-always-a-member invariant: `trips.create` inserts the trip and an
 * `'owner'` membership row in the SAME transaction. `trips.owner_id` and that
 * `'owner'` membership stay in lockstep (ownership transfer, in `members.ts`,
 * swaps both together); membership is the source of truth the auth level reads.
 */

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

function conflict(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(409).send({ error: 'conflict', detail });
}

function notFound(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(404).send({ error: 'not_found', detail });
}

// ---------------------------------------------------------------------------
// Row shapes + mappers
// ---------------------------------------------------------------------------

export interface TripRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export const TRIP_COLUMNS = 'id, owner_id, name, created_at, updated_at';

export function toTrip(row: TripRow): Trip {
  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export interface TripCityRow {
  id: string;
  trip_id: string;
  ord: number;
  city_id: string;
  /** `date` columns are cast to text in SQL so they arrive as `YYYY-MM-DD`
   * strings (the `IsoDate` wire shape) instead of `Date`s at local midnight. */
  arrive: string;
  depart: string;
  accommodation: JsonObject | null;
  start_defaults: JsonObject | null;
}

export const TRIP_CITY_COLUMNS =
  'id, trip_id, ord, city_id, arrive::text AS arrive, depart::text AS depart, accommodation, start_defaults';

export function toTripCity(row: TripCityRow): TripCity {
  return {
    id: row.id,
    trip_id: row.trip_id,
    ord: row.ord,
    city_id: row.city_id,
    arrive: row.arrive,
    depart: row.depart,
    accommodation: row.accommodation,
    start_defaults: row.start_defaults,
  };
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export function listTripsHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    return withUserContext(pools.appPool, userId, async (client) => {
      // RLS `trips_select` returns only trips the caller owns or is a member of.
      const { rows } = await client.query<TripRow>(
        `SELECT ${TRIP_COLUMNS} FROM trips ORDER BY created_at ASC`,
      );
      return rows.map(toTrip);
    });
  };
}

export function createTripHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    const body = req.body as CreateTripBody;
    return withUserContext(pools.appPool, userId, async (client) => {
      // Insert the trip and the owner's membership row atomically (same txn):
      // the owner-is-always-a-member invariant. `is_trip_owner` admits the
      // membership INSERT via `trips.owner_id` before the row it is inserting
      // exists (see 0013).
      const { rows } = await client.query<TripRow>(
        `INSERT INTO trips (owner_id, name) VALUES (current_user_id(), $1)
         RETURNING ${TRIP_COLUMNS}`,
        [body.name],
      );
      const trip = rows[0]!;
      await client.query(
        `INSERT INTO trip_members (trip_id, user_id, role)
         VALUES ($1, current_user_id(), 'owner')`,
        [trip.id],
      );
      return toTrip(trip);
    });
  };
}

export function getTripHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    return withUserContext(pools.appPool, userId, async (client) => {
      const { rows } = await client.query<TripRow>(
        `SELECT ${TRIP_COLUMNS} FROM trips WHERE id = $1`,
        [id],
      );
      if (!rows[0]) return notFound(reply, 'trip not found');
      return toTrip(rows[0]);
    });
  };
}

export function updateTripHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    const body = req.body as UpdateTripBody;

    // Only touch the columns the caller actually sent; `set_updated_at` (0010)
    // stamps updated_at on every UPDATE.
    const sets: string[] = [];
    const values: unknown[] = [];
    if ('name' in body && body.name !== undefined) {
      values.push(body.name);
      sets.push(`name = $${values.length}`);
    }

    return withUserContext(pools.appPool, userId, async (client) => {
      if (sets.length === 0) {
        const { rows } = await client.query<TripRow>(
          `SELECT ${TRIP_COLUMNS} FROM trips WHERE id = $1`,
          [id],
        );
        if (!rows[0]) return notFound(reply, 'trip not found');
        return toTrip(rows[0]);
      }
      values.push(id);
      const { rows } = await client.query<TripRow>(
        `UPDATE trips SET ${sets.join(', ')} WHERE id = $${values.length}
         RETURNING ${TRIP_COLUMNS}`,
        values,
      );
      if (!rows[0]) return notFound(reply, 'trip not found');
      return toTrip(rows[0]);
    });
  };
}

export function deleteTripHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    return withUserContext(pools.appPool, userId, async (client) => {
      // ON DELETE CASCADE (0004) removes members, cities, invites, places, …
      await client.query(`DELETE FROM trips WHERE id = $1`, [id]);
      return { deleted: true as const };
    });
  };
}

// ---------------------------------------------------------------------------
// City stays
// ---------------------------------------------------------------------------

export function listCitiesHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    return withUserContext(pools.appPool, userId, async (client) => {
      const { rows } = await client.query<TripCityRow>(
        `SELECT ${TRIP_CITY_COLUMNS} FROM trip_cities WHERE trip_id = $1 ORDER BY ord ASC`,
        [id],
      );
      return rows.map(toTripCity);
    });
  };
}

export function addCityHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    if (!(await assertEditor(req, reply))) return;
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    const body = req.body as AddTripCityBody;
    return withUserContext(pools.appPool, userId, async (client) => {
      try {
        const { rows } = await client.query<TripCityRow>(
          `INSERT INTO trip_cities (trip_id, ord, city_id, arrive, depart, accommodation, start_defaults)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING ${TRIP_CITY_COLUMNS}`,
          [id, body.ord, body.city_id, body.arrive, body.depart, body.accommodation ?? null, body.start_defaults ?? null],
        );
        return toTripCity(rows[0]!);
      } catch (err) {
        // UNIQUE (trip_id, ord) (0004): two stays cannot share a slot.
        if (isUniqueViolation(err)) return conflict(reply, 'a city stay already occupies that ord');
        throw err;
      }
    });
  };
}

export function updateCityHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    if (!(await assertEditor(req, reply))) return;
    const userId = req.user!.id;
    const { id, cityId } = req.params as { id: string; cityId: string };
    const body = req.body as UpdateTripCityBody;

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const col of ['city_id', 'ord', 'arrive', 'depart', 'accommodation', 'start_defaults'] as const) {
      if (col in body) {
        values.push(body[col] ?? null);
        sets.push(`${col} = $${values.length}`);
      }
    }

    return withUserContext(pools.appPool, userId, async (client) => {
      if (sets.length === 0) {
        const { rows } = await client.query<TripCityRow>(
          `SELECT ${TRIP_CITY_COLUMNS} FROM trip_cities WHERE id = $1 AND trip_id = $2`,
          [cityId, id],
        );
        if (!rows[0]) return notFound(reply, 'city stay not found');
        return toTripCity(rows[0]);
      }
      values.push(cityId, id);
      try {
        const { rows } = await client.query<TripCityRow>(
          `UPDATE trip_cities SET ${sets.join(', ')}
            WHERE id = $${values.length - 1} AND trip_id = $${values.length}
          RETURNING ${TRIP_CITY_COLUMNS}`,
          values,
        );
        if (!rows[0]) return notFound(reply, 'city stay not found');
        return toTripCity(rows[0]);
      } catch (err) {
        if (isUniqueViolation(err)) return conflict(reply, 'a city stay already occupies that ord');
        throw err;
      }
    });
  };
}

export function removeCityHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    if (!(await assertEditor(req, reply))) return;
    const userId = req.user!.id;
    const { id, cityId } = req.params as { id: string; cityId: string };
    return withUserContext(pools.appPool, userId, async (client) => {
      await client.query(`DELETE FROM trip_cities WHERE id = $1 AND trip_id = $2`, [cityId, id]);
      return { removed: true as const };
    });
  };
}

/**
 * Register the trips CRUD + city-stay routes (P06). Membership and invite routes
 * live in `members.ts` / `invites.ts`; all three groups are wired in `server.ts`.
 */
export function registerTripRoutes(app: FastifyInstance, pools: Pools): void {
  registerRoute(app, tripsRoutes['trips.list'], listTripsHandler(pools));
  registerRoute(app, tripsRoutes['trips.create'], createTripHandler(pools));
  registerRoute(app, tripsRoutes['trips.get'], getTripHandler(pools));
  registerRoute(app, tripsRoutes['trips.update'], updateTripHandler(pools));
  registerRoute(app, tripsRoutes['trips.delete'], deleteTripHandler(pools));
  registerRoute(app, tripsRoutes['trips.listCities'], listCitiesHandler(pools));
  registerRoute(app, tripsRoutes['trips.addCity'], addCityHandler(pools));
  registerRoute(app, tripsRoutes['trips.updateCity'], updateCityHandler(pools));
  registerRoute(app, tripsRoutes['trips.removeCity'], removeCityHandler(pools));
}

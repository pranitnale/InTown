import { placesRoutes } from '@intown/contracts/api';
import type { AddPlaceBody, PatchPlaceBody, ListPlacesQuery } from '@intown/contracts/api';
import type { TripPlace, PlaceState } from '@intown/contracts/types';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import type { Pools } from '../db/pool.ts';
import { registerRoute, type RouteHandler } from '../http/router.ts';
import { withUserContext } from '../auth/session.ts';
import { assertEditor } from '../trips/authz.ts';
import { registerVoteRoutes } from './votes.ts';
import {
  isValidKey,
  jitter,
  keyAfter,
  needsRebalance,
  rebalanceTripCity,
} from '../ordering/fractional.ts';

/**
 * Curation-list routes (P06, §6.6): list / add / patch places on a trip city's
 * ordered list. Ordering is fractional (`ordering/fractional.ts`): an add appends
 * a jittered key, a patch rewrites ONLY the moved row's key, so siblings are never
 * renumbered. Every `ORDER BY position` pins `COLLATE "C"` so the DB's locale
 * collation cannot reshuffle the codepoint ordering the fractional keys rely on.
 *
 * Writes are editor-only: the router's `requireAuth('member')` has confirmed
 * membership and stashed `req.tripRole`; `assertEditor` then 403s a viewer. RLS
 * (0013) re-checks the same editor predicate at the row level.
 *
 * `votes.ts` registers `places.vote` alongside these (wired below).
 */

const PG_UNIQUE_VIOLATION = '23505';
/** The fractional-key backstop index (0013). A clash on it is a same-slot race. */
const POSITION_CONSTRAINT = 'trip_places_trip_city_position_uidx';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

/** The specific constraint a unique violation tripped, if any. */
function violatedConstraint(err: unknown): string | undefined {
  return (err as { constraint?: string }).constraint;
}

function conflict(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(409).send({ error: 'conflict', detail });
}

function notFound(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(404).send({ error: 'not_found', detail });
}

function badRequest(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(400).send({ error: 'bad_request', detail });
}

// ---------------------------------------------------------------------------
// Row shape + mapper
// ---------------------------------------------------------------------------

interface TripPlaceRow {
  id: string;
  trip_city_id: string;
  poi_id: string;
  position: string;
  state: PlaceState;
  added_by: string;
  est_duration: number | null;
  created_at: Date;
  updated_at: Date;
}

const PLACE_COLUMNS =
  'id, trip_city_id, poi_id, position, state, added_by, est_duration, created_at, updated_at';

function toTripPlace(row: TripPlaceRow): TripPlace {
  return {
    id: row.id,
    trip_city_id: row.trip_city_id,
    poi_id: row.poi_id,
    position: row.position,
    state: row.state,
    added_by: row.added_by,
    est_duration: row.est_duration,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/**
 * Outcome of a savepoint-guarded write. `withUserContext` runs the handler inside
 * ONE transaction, so a raw 23505 poisons it (25P02 on the next query); wrapping
 * each attempt in a SAVEPOINT lets us `ROLLBACK TO` and retry a jittered key in
 * the same transaction. `position` = the fractional-key backstop clashed (a
 * same-slot race — retry); `other` = a different unique constraint (the
 * `(trip_city_id, poi_id)` dedupe — surface as a conflict, no retry).
 */
type WriteOutcome =
  | { ok: true; row: TripPlaceRow }
  | { ok: false; reason: 'position' | 'other' };

async function guarded(
  client: PoolClient,
  run: () => Promise<TripPlaceRow>,
): Promise<WriteOutcome> {
  await client.query('SAVEPOINT place_write');
  try {
    const row = await run();
    await client.query('RELEASE SAVEPOINT place_write');
    return { ok: true, row };
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT place_write');
    if (isUniqueViolation(err)) {
      return { ok: false, reason: violatedConstraint(err) === POSITION_CONSTRAINT ? 'position' : 'other' };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export function listPlacesHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    const { trip_city_id } = req.query as ListPlacesQuery;
    return withUserContext(pools.appPool, userId, async (client) => {
      // Scope to THIS trip (RLS alone would also return places of other trips the
      // caller belongs to) and, optionally, one city stay. Codepoint order.
      const params: unknown[] = [id];
      let filter = '';
      if (trip_city_id) {
        params.push(trip_city_id);
        filter = ` AND tp.trip_city_id = $${params.length}`;
      }
      const { rows } = await client.query<TripPlaceRow>(
        `SELECT ${PLACE_COLUMNS.split(', ').map((c) => `tp.${c}`).join(', ')}
           FROM trip_places tp
           JOIN trip_cities tc ON tc.id = tp.trip_city_id
          WHERE tc.trip_id = $1${filter}
          ORDER BY tp.position COLLATE "C", tp.id`,
        params,
      );
      return rows.map(toTripPlace);
    });
  };
}

export function addPlaceHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    if (!(await assertEditor(req, reply))) return;
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    const body = req.body as AddPlaceBody;
    const state: PlaceState = body.state ?? 'suggested';

    return withUserContext(pools.appPool, userId, async (client) => {
      // The city stay must belong to THIS trip (a caller who edits several trips
      // could otherwise smuggle another trip's city id through this URL).
      const city = await client.query(
        `SELECT 1 FROM trip_cities WHERE id = $1 AND trip_id = $2`,
        [body.trip_city_id, id],
      );
      if (city.rowCount === 0) return notFound(reply, 'city stay not found on this trip');

      let key: string;
      if (body.position !== undefined) {
        // Client-supplied key: use as given, only reject an illegal one.
        if (!isValidKey(body.position)) return badRequest(reply, 'position is not a valid ordering key');
        key = body.position;
        // Dense-slot backstop (mirrors patch): an unbounded client key this long is
        // trouble on the position btree in TWO ways pre-fix. An INCOMPRESSIBLE key
        // exceeds the index-row byte limit and errors (54000 → an unhandled 500); a
        // COMPRESSIBLE one (e.g. a long run of the same char, which the index tuple
        // compresses) slips UNDER the limit and is silently ACCEPTED — persisting a
        // pathological unbounded position that bloats the index and starves the key
        // space. Either way, once the key crosses REBALANCE_THRESHOLD we rebalance the
        // city to reclaim precision, then append the new row short — its client-
        // computed target no longer maps to any neighbour.
        if (needsRebalance(key)) {
          await rebalanceTripCity(client, body.trip_city_id);
          key = jitter(keyAfter(await lastPosition(client, body.trip_city_id)));
        }
      } else {
        // Append: mint a jittered key after the current last. If it has grown long
        // (dense tail), rebalance the whole city first, then re-append short.
        key = jitter(keyAfter(await lastPosition(client, body.trip_city_id)));
        if (needsRebalance(key)) {
          await rebalanceTripCity(client, body.trip_city_id);
          key = jitter(keyAfter(await lastPosition(client, body.trip_city_id)));
        }
      }

      const insert = (position: string) => (): Promise<TripPlaceRow> =>
        client
          .query<TripPlaceRow>(
            `INSERT INTO trip_places (trip_city_id, poi_id, position, added_by, state)
             VALUES ($1, $2, $3, current_user_id(), $4::place_state)
             RETURNING ${PLACE_COLUMNS}`,
            [body.trip_city_id, body.poi_id, position, state],
          )
          .then((r) => r.rows[0]!);

      const first = await guarded(client, insert(key));
      if (first.ok) return toTripPlace(first.row);
      if (first.reason === 'other') return conflict(reply, 'that place is already on the list');
      // Same-slot race on the position index: retry ONCE with fresh jitter.
      const second = await guarded(client, insert(jitter(key)));
      if (second.ok) return toTripPlace(second.row);
      if (second.reason === 'other') return conflict(reply, 'that place is already on the list');
      return conflict(reply, 'could not assign a unique position');
    });
  };
}

export function patchPlaceHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    if (!(await assertEditor(req, reply))) return;
    const userId = req.user!.id;
    const { id, placeId } = req.params as { id: string; placeId: string };
    const body = req.body as PatchPlaceBody;
    const hasPosition = 'position' in body && body.position !== undefined;
    const hasState = 'state' in body && body.state !== undefined;

    return withUserContext(pools.appPool, userId, async (client) => {
      const cur = await client.query<{ trip_city_id: string }>(
        `SELECT tp.trip_city_id
           FROM trip_places tp
           JOIN trip_cities tc ON tc.id = tp.trip_city_id
          WHERE tp.id = $1 AND tc.trip_id = $2`,
        [placeId, id],
      );
      if (cur.rowCount === 0) return notFound(reply, 'place not found on this trip');
      const tripCityId = cur.rows[0]!.trip_city_id;

      // Nothing to change: return the row as-is.
      if (!hasPosition && !hasState) {
        const { rows } = await client.query<TripPlaceRow>(
          `SELECT ${PLACE_COLUMNS} FROM trip_places WHERE id = $1`,
          [placeId],
        );
        return toTripPlace(rows[0]!);
      }

      // State-only patch: a plain single-row write, no ordering involved.
      if (!hasPosition) {
        const { rows } = await client.query<TripPlaceRow>(
          `UPDATE trip_places SET state = $2::place_state WHERE id = $1 RETURNING ${PLACE_COLUMNS}`,
          [placeId, body.state],
        );
        return toTripPlace(rows[0]!);
      }

      let position = body.position!;
      if (!isValidKey(position)) return badRequest(reply, 'position is not a valid ordering key');

      // Dense-slot backstop: a key this long means the space around it is
      // exhausted. Rebalance the whole city to reclaim precision, then append the
      // moved row (its client-computed target key no longer maps to any neighbour).
      if (needsRebalance(position)) {
        await rebalanceTripCity(client, tripCityId);
        position = jitter(keyAfter(await lastPosition(client, tripCityId)));
      }

      const update = (pos: string) => (): Promise<TripPlaceRow> => {
        const sets = ['position = $2'];
        const vals: unknown[] = [placeId, pos];
        if (hasState) {
          vals.push(body.state);
          sets.push(`state = $${vals.length}::place_state`);
        }
        return client
          .query<TripPlaceRow>(
            `UPDATE trip_places SET ${sets.join(', ')} WHERE id = $1 RETURNING ${PLACE_COLUMNS}`,
            vals,
          )
          .then((r) => r.rows[0]!);
      };

      const first = await guarded(client, update(position));
      if (first.ok) return toTripPlace(first.row);
      if (first.reason === 'other') return conflict(reply, 'that place is already on the list');
      // Collided with a sibling on the position index: retry ONCE, jittered.
      const second = await guarded(client, update(jitter(position)));
      if (second.ok) return toTripPlace(second.row);
      if (second.reason === 'other') return conflict(reply, 'that place is already on the list');
      return conflict(reply, 'could not assign a unique position');
    });
  };
}

/** The current last (max, codepoint) key in a city stay, or `null` when empty. */
async function lastPosition(client: PoolClient, tripCityId: string): Promise<string | null> {
  const { rows } = await client.query<{ position: string }>(
    `SELECT position FROM trip_places WHERE trip_city_id = $1 ORDER BY position COLLATE "C" DESC LIMIT 1`,
    [tripCityId],
  );
  return rows[0]?.position ?? null;
}

/**
 * Register the curation-list routes (P06): list / add / patch here, plus vote
 * (in `votes.ts`). Wired in `server.ts`.
 */
export function registerPlaceRoutes(app: FastifyInstance, pools: Pools): void {
  registerRoute(app, placesRoutes['places.list'], listPlacesHandler(pools));
  registerRoute(app, placesRoutes['places.add'], addPlaceHandler(pools));
  registerRoute(app, placesRoutes['places.patch'], patchPlaceHandler(pools));
  registerVoteRoutes(app, pools);
}

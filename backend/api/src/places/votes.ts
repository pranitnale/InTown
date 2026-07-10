import { placesRoutes } from '@intown/contracts/api';
import type { VotePlaceBody } from '@intown/contracts/api';
import type { PlaceVote } from '@intown/contracts/types';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import type { Pools } from '../db/pool.ts';
import { registerRoute, type RouteHandler } from '../http/router.ts';
import { withUserContext } from '../auth/session.ts';
import { assertEditor } from '../trips/authz.ts';

/**
 * Per-member votes (P06, §6.3). Voting is EDITOR-ONLY — a viewer is 403'd
 * (`assertEditor`), and the `place_votes_self` RLS policy (0013) re-checks it at
 * the row level. Each member has at most one vote per place: the upsert flips an
 * existing vote instead of stacking rows.
 *
 * AGGREGATE-ONLY DISCLOSURE: a member may read/write ONLY their own vote row (RLS
 * self-rows-only). How the group voted is exposed exclusively through
 * `place_vote_counts()` — counts + member_count, never a user id. `getVoteCounts`
 * wraps that definer function so P14 (and tests) read totals without touching raw
 * rows. The `places.vote` response echoes the CALLER'S OWN vote (self-disclosure),
 * which is not a leak.
 */

interface PlaceVoteRow {
  id: string;
  trip_place_id: string;
  user_id: string;
  vote: PlaceVote['vote'];
  created_at: Date;
}

function toPlaceVote(row: PlaceVoteRow): PlaceVote {
  return {
    id: row.id,
    trip_place_id: row.trip_place_id,
    user_id: row.user_id,
    vote: row.vote,
    created_at: row.created_at.toISOString(),
  };
}

function notFound(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(404).send({ error: 'not_found', detail });
}

/** Aggregate vote tally for a place — counts only, NO user ids (§6.3). */
export interface VoteCounts {
  up: number;
  down: number;
  member_count: number;
}

/**
 * Read a place's vote tally through the `place_vote_counts()` SECURITY DEFINER
 * function (0013): the raw rows are invisible even to fellow members, so this is
 * the only sanctioned path to how the group voted. Runs on the caller's RLS-bound
 * client; the function itself raises `IT403`/`IT404` for a non-member / missing
 * place.
 */
export async function getVoteCounts(client: PoolClient, placeId: string): Promise<VoteCounts> {
  const { rows } = await client.query<VoteCounts>(
    `SELECT up, down, member_count FROM place_vote_counts($1)`,
    [placeId],
  );
  return rows[0]!;
}

export function votePlaceHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    if (!(await assertEditor(req, reply))) return;
    const userId = req.user!.id;
    const { id, placeId } = req.params as { id: string; placeId: string };
    const { vote } = req.body as VotePlaceBody;

    return withUserContext(pools.appPool, userId, async (client) => {
      // The place must belong to THIS trip (guards against a foreign place id in
      // this URL, and yields a clean 404 instead of an FK error).
      const place = await client.query(
        `SELECT 1
           FROM trip_places tp
           JOIN trip_cities tc ON tc.id = tp.trip_city_id
          WHERE tp.id = $1 AND tc.trip_id = $2`,
        [placeId, id],
      );
      if (place.rowCount === 0) return notFound(reply, 'place not found on this trip');

      // One vote per member per place: flip the existing row rather than stack.
      const { rows } = await client.query<PlaceVoteRow>(
        `INSERT INTO place_votes (trip_place_id, user_id, vote)
         VALUES ($1, current_user_id(), $2::vote_value)
         ON CONFLICT (trip_place_id, user_id) DO UPDATE SET vote = EXCLUDED.vote
         RETURNING id, trip_place_id, user_id, vote, created_at`,
        [placeId, vote],
      );
      return toPlaceVote(rows[0]!);
    });
  };
}

/** Register the vote route (P06). Called from `registerPlaceRoutes`. */
export function registerVoteRoutes(app: FastifyInstance, pools: Pools): void {
  registerRoute(app, placesRoutes['places.vote'], votePlaceHandler(pools));
}

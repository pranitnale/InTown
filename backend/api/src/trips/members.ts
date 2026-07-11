import { tripsRoutes } from '@intown/contracts/api';
import type { UpdateMemberBody } from '@intown/contracts/api';
import type { RouteContract } from '@intown/contracts/api';
import type { TripMember } from '@intown/contracts/types';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import type { Pools } from '../db/pool.ts';
import { registerRoute, type RouteHandler } from '../http/router.ts';
import { withUserContext } from '../auth/session.ts';

/**
 * Trip membership routes (P06, §6.3): list members, change a member's role
 * (including the ownership-transfer branch), and remove a member (owner action)
 * or leave (self action).
 *
 * INTERPRETATION FLAGS (frozen contract has no dedicated transfer/leave routes):
 *  - Ownership transfer is `updateMember` with `role: 'owner'` — a single
 *    transaction under a per-trip advisory lock that swaps `trips.owner_id` to
 *    the target and demotes the previous owner's membership to `editor`, keeping
 *    the owner_id ⇔ owner-membership invariant intact.
 *  - Leaving a trip is `removeMember` on one's own membership. The frozen
 *    contract declares `trips.removeMember` as `auth: 'owner'`, but self-leave by
 *    a non-owner member requires a looser gate, so this route is registered at
 *    `member` level and the handler re-tightens to OWNER-OR-SELF (mirroring the
 *    `trip_members_delete` RLS policy in 0013, whose comment names this route as
 *    the owner-or-self path). The current owner cannot be removed through it —
 *    ownership must be transferred first.
 */

const MEMBER_COLUMNS = 'id, trip_id, user_id, role, joined_at';

interface TripMemberRow {
  id: string;
  trip_id: string;
  user_id: string;
  role: TripMember['role'];
  joined_at: Date;
}

function toTripMember(row: TripMemberRow): TripMember {
  return {
    id: row.id,
    trip_id: row.trip_id,
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at.toISOString(),
  };
}

function notFound(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(404).send({ error: 'not_found', detail });
}

function badRequest(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(400).send({ error: 'bad_request', detail });
}

function forbidden(reply: FastifyReply): FastifyReply {
  return reply.code(403).send({ error: 'forbidden' });
}

/**
 * Serialize the ownership-transfer read-modify-write with a transaction-scoped
 * advisory lock keyed on the trip id (auto-released at COMMIT/ROLLBACK), so two
 * concurrent transfers on the same trip run one-after-another instead of racing
 * to a split-brain `owner_id` ⇔ membership state. Mirrors `lockUser` in
 * profile/routes.ts, keyed on the trip rather than the caller.
 */
async function lockTrip(client: PoolClient, tripId: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tripId]);
}

export function listMembersHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    return withUserContext(pools.appPool, userId, async (client) => {
      const { rows } = await client.query<TripMemberRow>(
        `SELECT ${MEMBER_COLUMNS} FROM trip_members WHERE trip_id = $1 ORDER BY joined_at ASC`,
        [id],
      );
      return rows.map(toTripMember);
    });
  };
}

export function updateMemberHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    const ownerUserId = req.user!.id;
    const { id, userId } = req.params as { id: string; userId: string };
    const { role } = req.body as UpdateMemberBody;

    return withUserContext(pools.appPool, ownerUserId, async (client) => {
      if (role === 'owner') {
        // --- Ownership transfer -------------------------------------------
        await lockTrip(client, id);
        const trip = await client.query<{ owner_id: string }>(
          `SELECT owner_id FROM trips WHERE id = $1`,
          [id],
        );
        const prevOwnerId = trip.rows[0]?.owner_id;
        if (!prevOwnerId) return notFound(reply, 'trip not found');

        const target = await client.query<TripMemberRow>(
          `SELECT ${MEMBER_COLUMNS} FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
          [id, userId],
        );
        if (!target.rows[0]) return notFound(reply, 'member not found');
        // Already the owner: idempotent no-op.
        if (userId === prevOwnerId) return toTripMember(target.rows[0]);

        // Ordering keeps the caller authorized at every step: they stay an
        // `'owner'` membership row until the final demotion, and `trips.owner_id`
        // still names them until the trips UPDATE — so `is_trip_owner` (0013)
        // holds for each statement's RLS check.
        const promoted = await client.query<TripMemberRow>(
          `UPDATE trip_members SET role = 'owner' WHERE trip_id = $1 AND user_id = $2
           RETURNING ${MEMBER_COLUMNS}`,
          [id, userId],
        );
        await client.query(`UPDATE trips SET owner_id = $2 WHERE id = $1`, [id, userId]);
        await client.query(
          `UPDATE trip_members SET role = 'editor' WHERE trip_id = $1 AND user_id = $2`,
          [id, prevOwnerId],
        );
        return toTripMember(promoted.rows[0]!);
      }

      // --- Plain role change (editor/viewer) ------------------------------
      // Never demote the current owner in place: that would strand
      // `trips.owner_id` on a non-`owner` membership (split-brain authz).
      const trip = await client.query<{ owner_id: string }>(
        `SELECT owner_id FROM trips WHERE id = $1`,
        [id],
      );
      if (!trip.rows[0]) return notFound(reply, 'trip not found');
      if (userId === trip.rows[0].owner_id) {
        return badRequest(reply, 'cannot change the owner’s role; transfer ownership instead');
      }

      const { rows } = await client.query<TripMemberRow>(
        `UPDATE trip_members SET role = $3 WHERE trip_id = $1 AND user_id = $2
         RETURNING ${MEMBER_COLUMNS}`,
        [id, userId, role],
      );
      if (!rows[0]) return notFound(reply, 'member not found');
      return toTripMember(rows[0]);
    });
  };
}

export function removeMemberHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    const callerId = req.user!.id;
    const { id, userId } = req.params as { id: string; userId: string };
    return withUserContext(pools.appPool, callerId, async (client) => {
      const trip = await client.query<{ owner_id: string }>(
        `SELECT owner_id FROM trips WHERE id = $1`,
        [id],
      );
      const ownerId = trip.rows[0]?.owner_id;
      // Block removing the current owner: transfer ownership first.
      if (userId === ownerId) {
        return badRequest(reply, 'cannot remove the trip owner; transfer ownership first');
      }
      // OWNER-OR-SELF: an owner may remove any other member; any member may leave
      // (remove their own membership). Anyone else is forbidden.
      if (req.tripRole !== 'owner' && userId !== callerId) return forbidden(reply);

      // Idempotent: removing an already-absent membership still reports removed.
      // RLS `trip_members_delete` (0013) enforces owner-or-self at the row level.
      await client.query(`DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2`, [id, userId]);
      return { removed: true as const };
    });
  };
}

/**
 * Register the trip membership routes (P06). `trips.removeMember` is registered
 * at `member` level (see the interpretation flag above) so the handler can honor
 * self-leave; the other two keep their frozen `owner` gate.
 */
export function registerTripMemberRoutes(app: FastifyInstance, pools: Pools): void {
  registerRoute(app, tripsRoutes['trips.listMembers'], listMembersHandler(pools));
  registerRoute(app, tripsRoutes['trips.updateMember'], updateMemberHandler(pools));
  const removeMember: RouteContract = { ...tripsRoutes['trips.removeMember'], auth: 'member' };
  registerRoute(app, removeMember, removeMemberHandler(pools));
}

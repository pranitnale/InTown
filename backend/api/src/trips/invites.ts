import { randomBytes } from 'node:crypto';
import { tripsRoutes } from '@intown/contracts/api';
import type { CreateInviteBody } from '@intown/contracts/api';
import type { TripInvite, TripMember } from '@intown/contracts/types';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Pools } from '../db/pool.ts';
import { registerRoute, type RouteHandler } from '../http/router.ts';
import { withUserContext } from '../auth/session.ts';

/**
 * Trip invite routes (P06, §6.3): list active invites, mint a role-bearing
 * expiring code, revoke one, and redeem one at `POST /api/join/:code`.
 *
 * An invite carries an embedded role and an expiry; the owner can revoke it
 * (soft — `revoked = true`). Redemption goes through the `redeem_invite`
 * SECURITY DEFINER function (0013): a prospective member is not yet a member and
 * so cannot read the invite under `trip_invites` RLS, which is owner-only. The
 * function is UPGRADE-ONLY — it never demotes an existing member (see 0013) — so
 * a double-join is idempotent.
 */

/** 16 random bytes → 22-char base64url string (no padding): ~128 bits of entropy. */
function newInviteCode(): string {
  return randomBytes(16).toString('base64url');
}

const INVITE_COLUMNS =
  'id, trip_id, code, role, expires_at, revoked, created_by, created_at';

interface TripInviteRow {
  id: string;
  trip_id: string;
  code: string;
  role: TripInvite['role'];
  expires_at: Date;
  revoked: boolean;
  created_by: string;
  created_at: Date;
}

function toTripInvite(row: TripInviteRow): TripInvite {
  return {
    id: row.id,
    trip_id: row.trip_id,
    code: row.code,
    role: row.role,
    expires_at: row.expires_at.toISOString(),
    revoked: row.revoked,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
  };
}

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

export function listInvitesHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    return withUserContext(pools.appPool, userId, async (client) => {
      // Active only: not revoked AND not yet expired.
      const { rows } = await client.query<TripInviteRow>(
        `SELECT ${INVITE_COLUMNS} FROM trip_invites
          WHERE trip_id = $1 AND revoked = false AND expires_at > now()
          ORDER BY created_at DESC`,
        [id],
      );
      return rows.map(toTripInvite);
    });
  };
}

export function createInviteHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    const body = req.body as CreateInviteBody;
    return withUserContext(pools.appPool, userId, async (client) => {
      const { rows } = await client.query<TripInviteRow>(
        `INSERT INTO trip_invites (trip_id, code, role, expires_at, created_by)
         VALUES ($1, $2, $3, $4, current_user_id())
         RETURNING ${INVITE_COLUMNS}`,
        [id, newInviteCode(), body.role, body.expires_at],
      );
      return toTripInvite(rows[0]!);
    });
  };
}

export function revokeInviteHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    const userId = req.user!.id;
    const { id, inviteId } = req.params as { id: string; inviteId: string };
    return withUserContext(pools.appPool, userId, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE trip_invites SET revoked = true WHERE id = $1 AND trip_id = $2`,
        [inviteId, id],
      );
      if (!rowCount) return reply.code(404).send({ error: 'not_found', detail: 'invite not found' });
      return { revoked: true as const };
    });
  };
}

export function joinHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    const userId = req.user!.id;
    const { code } = req.params as { code: string };
    try {
      const row = await withUserContext(pools.appPool, userId, async (client) => {
        const { rows } = await client.query<TripMemberRow>(
          `SELECT * FROM redeem_invite($1)`,
          [code],
        );
        return rows[0]!;
      });
      return toTripMember(row);
    } catch (err) {
      // Typed SQLSTATEs from redeem_invite (0013): IT404 unknown → 404,
      // IT410 revoked/expired → 410 gone. Anything else is a real fault.
      const sqlstate = (err as { code?: string }).code;
      if (sqlstate === 'IT404') return notGone(reply, 404, 'not_found', 'invite not found');
      if (sqlstate === 'IT410') return notGone(reply, 410, 'gone', 'invite is revoked or expired');
      throw err;
    }
  };
}

function notGone(reply: FastifyReply, status: number, error: string, detail: string): FastifyReply {
  return reply.code(status).send({ error, detail });
}

/** Register the trip invite + join routes (P06). */
export function registerTripInviteRoutes(app: FastifyInstance, pools: Pools): void {
  registerRoute(app, tripsRoutes['trips.listInvites'], listInvitesHandler(pools));
  registerRoute(app, tripsRoutes['trips.createInvite'], createInviteHandler(pools));
  registerRoute(app, tripsRoutes['trips.revokeInvite'], revokeInviteHandler(pools));
  registerRoute(app, tripsRoutes['trips.join'], joinHandler(pools));
}

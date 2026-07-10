import type { FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import type { TripRole } from '@intown/contracts/types';

/**
 * Trip authorization helpers (P06). The `member` / `owner` auth levels resolve a
 * caller's role here before a handler runs; write-path handlers then call
 * {@link assertEditor} to reject viewers.
 */

/**
 * Resolve the caller's role in a trip, or `null` when they hold no membership.
 *
 * Runs on the BYPASSRLS auth pool by design: authorization must see membership
 * rows regardless of the request user, and the trips-domain RLS policies (0013)
 * are themselves keyed on membership — so an RLS-bound lookup would be circular.
 * This check gates a route *before* its handler opens an RLS-scoped
 * `withUserContext` transaction. Membership role is the source of truth for the
 * role model (the create/transfer paths keep `trips.owner_id` in lockstep with
 * an `'owner'` membership row).
 */
export async function resolveTripRole(
  authPool: pg.Pool,
  tripId: string,
  userId: string,
): Promise<TripRole | null> {
  const { rows } = await authPool.query<{ role: TripRole }>(
    `SELECT role FROM trip_members WHERE trip_id = $1 AND user_id = $2 LIMIT 1`,
    [tripId, userId],
  );
  return rows[0]?.role ?? null;
}

/**
 * Handler-level guard for editor-only write paths (add/patch place, vote, edit
 * city, …). `req.tripRole` is populated by `requireAuth('member')`, which has
 * already confirmed membership; this only distinguishes editor+ from viewer.
 *
 * Returns `true` when the caller may write. On `false` it has already sent a 403,
 * so the handler must stop (the router skips response validation once a reply is
 * sent). Owners are editors for every write.
 */
export async function assertEditor(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (req.tripRole === 'owner' || req.tripRole === 'editor') return true;
  await reply.code(403).send({ error: 'forbidden' });
  return false;
}

import { authRoutes, type SetConsentBody } from '@intown/contracts/api';
import type { Consent } from '@intown/contracts/types';
import type { FastifyInstance } from 'fastify';
import type { Pools } from '../db/pool.ts';
import { registerRoute, type RouteHandler } from '../http/router.ts';
import { withUserContext } from './session.ts';

/**
 * Consent read/write path (§16.1). Consent state is append-only-friendly: each
 * write inserts a NEW row (granted + optional revoked_at), so P03's first-login
 * flow and the P23 events pipeline can record consent changes over time.
 *
 * All access goes through `withUserContext` on the RLS-bound app pool, so the
 * `consents_self` policy scopes reads/writes to the caller.
 */

export interface ConsentRow {
  id: string;
  user_id: string;
  consent_type: Consent['consent_type'];
  granted: boolean;
  policy_version: string;
  granted_at: Date;
  revoked_at: Date | null;
}

export function toConsent(row: ConsentRow): Consent {
  return {
    id: row.id,
    user_id: row.user_id,
    consent_type: row.consent_type,
    granted: row.granted,
    policy_version: row.policy_version,
    granted_at: row.granted_at.toISOString(),
    revoked_at: row.revoked_at ? row.revoked_at.toISOString() : null,
  };
}

export const CONSENT_COLUMNS =
  'id, user_id, consent_type, granted, policy_version, granted_at, revoked_at';

export function getConsentsHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    return withUserContext(pools.appPool, userId, async (client) => {
      const { rows } = await client.query<ConsentRow>(
        `SELECT ${CONSENT_COLUMNS} FROM consents
          WHERE user_id = current_user_id()
          ORDER BY granted_at ASC`,
      );
      return rows.map(toConsent);
    });
  };
}

export function setConsentHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    const body = req.body as SetConsentBody;
    return withUserContext(pools.appPool, userId, async (client) => {
      const { rows } = await client.query<ConsentRow>(
        `INSERT INTO consents (user_id, consent_type, granted, policy_version, revoked_at)
         VALUES (current_user_id(), $1, $2, $3, CASE WHEN $2 THEN NULL ELSE now() END)
         RETURNING ${CONSENT_COLUMNS}`,
        [body.consent_type, body.granted, body.policy_version],
      );
      return toConsent(rows[0]!);
    });
  };
}

/** Register the consent routes (GET + PUT /api/consents). Profile routes are DEFERRED to P04. */
export function registerConsentRoutes(app: FastifyInstance, pools: Pools): void {
  registerRoute(app, authRoutes['auth.getConsents'], getConsentsHandler(pools));
  registerRoute(app, authRoutes['auth.setConsent'], setConsentHandler(pools));
}

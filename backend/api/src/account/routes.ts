import { authRoutes } from '@intown/contracts/api';
import type { AccountExport } from '@intown/contracts/types';
import type { FastifyInstance } from 'fastify';
import type { Pools } from '../db/pool.ts';
import { registerRoute, type RouteHandler } from '../http/router.ts';
import { withUserContext } from '../auth/session.ts';
import {
  toConsent,
  CONSENT_COLUMNS,
  type ConsentRow,
} from '../auth/consents.ts';
import {
  toUser,
  toTravelerProfile,
  toTasteProfile,
  USER_COLUMNS,
  TRAVELER_COLUMNS,
  TASTE_COLUMNS,
  type UserRow,
  type TravelerRow,
  type TasteRow,
} from '../profile/routes.ts';

/**
 * GDPR data-subject rights (P04, §16.1): export and erasure.
 *
 * Both run through `withUserContext` on the RLS-bound app pool, so a caller can
 * only ever export or erase THEIR OWN account — the `*_self` policies (0011)
 * scope every statement to `current_user_id()`.
 *
 * Erasure deletes the `users` row; the ON DELETE CASCADE foreign keys (0003,
 * 0008, 0012) then remove the traveler profile, every taste version, consents,
 * the derived `user_pref_profiles` row, sessions and OAuth accounts. The
 * pseudonymous `events` log carries NO foreign key to `users` (0008): a user
 * delete simply orphans the pseudonym, so anonymous aggregates survive.
 */

export function exportAccountHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    return withUserContext(pools.appPool, userId, async (client): Promise<AccountExport> => {
      const users = await client.query<UserRow>(
        `SELECT ${USER_COLUMNS} FROM users WHERE id = current_user_id()`,
      );
      const traveler = await client.query<TravelerRow>(
        `SELECT ${TRAVELER_COLUMNS} FROM traveler_profiles WHERE user_id = current_user_id()`,
      );
      const taste = await client.query<TasteRow>(
        `SELECT ${TASTE_COLUMNS} FROM taste_profiles
          WHERE user_id = current_user_id()
          ORDER BY version ASC`,
      );
      const consents = await client.query<ConsentRow>(
        `SELECT ${CONSENT_COLUMNS} FROM consents
          WHERE user_id = current_user_id()
          ORDER BY granted_at ASC`,
      );

      return {
        user: toUser(users.rows[0]!),
        traveler_profile: traveler.rows[0] ? toTravelerProfile(traveler.rows[0]) : null,
        taste_profiles: taste.rows.map(toTasteProfile),
        consents: consents.rows.map(toConsent),
      };
    });
  };
}

export function eraseAccountHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    return withUserContext(pools.appPool, userId, async (client) => {
      // RLS `users_self` limits this to the caller's own row; the FK cascades
      // remove all dependent personal rows. `events` (FK-free) is untouched.
      await client.query(`DELETE FROM users WHERE id = current_user_id()`);
      return { erased: true };
    });
  };
}

/** Register the GDPR export + erasure routes (P04, §16.1). */
export function registerAccountRoutes(app: FastifyInstance, pools: Pools): void {
  registerRoute(app, authRoutes['auth.exportAccount'], exportAccountHandler(pools));
  registerRoute(app, authRoutes['auth.eraseAccount'], eraseAccountHandler(pools));
}

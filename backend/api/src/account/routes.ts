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
 * Profile-domain reads and the erasure delete run through `withUserContext` on
 * the RLS-bound app pool, so a caller can only ever touch THEIR OWN account —
 * the `*_self` policies (0011) scope every statement to `current_user_id()`.
 * The export additionally reads auth-infra metadata (linked `accounts` and
 * `sessions`) via the BYPASSRLS `authPool`, because `intown_app` holds no grant
 * on those auth tables (0012); those reads are explicitly scoped to the caller
 * with `WHERE user_id = $1` and select only non-secret columns.
 *
 * Erasure deletes the `users` row; the ON DELETE CASCADE foreign keys (0003,
 * 0008, 0012) then remove the traveler profile, every taste version, consents,
 * the derived `user_pref_profiles` row, sessions and OAuth accounts. The
 * pseudonymous `events` log carries NO foreign key to `users` (0008): a user
 * delete simply orphans the pseudonym, so anonymous aggregates survive.
 */

interface AccountLinkRow {
  provider: string;
  provider_account_id: string;
  type: string;
}

interface SessionMetaRow {
  expires: Date;
}

export function exportAccountHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;

    // Profile-domain data (RLS-scoped app pool): the queries use
    // `current_user_id()` so the *_self policies restrict them to the caller.
    const profile = await withUserContext(pools.appPool, userId, async (client) => {
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

    // Auth-domain metadata (accounts + sessions): `intown_app` has NO grant on
    // these auth tables (0012 grants them to `intown_auth`), so they are read
    // through the BYPASSRLS `authPool` with an explicit `WHERE user_id = $1`
    // scoped to the caller. Only non-secret columns are selected — never the
    // token columns (`access_token`, `refresh_token`, `id_token`, …) or the
    // `session_token` value. This is the intended use of the auth pool for auth
    // tables, not an RLS bypass of profile data.
    const accounts = await pools.authPool.query<AccountLinkRow>(
      `SELECT provider, provider_account_id, type FROM accounts
        WHERE user_id = $1
        ORDER BY provider ASC, provider_account_id ASC`,
      [userId],
    );
    const sessions = await pools.authPool.query<SessionMetaRow>(
      `SELECT expires FROM sessions
        WHERE user_id = $1
        ORDER BY expires ASC`,
      [userId],
    );

    const out: AccountExport = {
      ...profile,
      accounts: accounts.rows.map((r) => ({
        provider: r.provider,
        provider_account_id: r.provider_account_id,
        type: r.type,
      })),
      sessions: sessions.rows.map((r) => ({ expires: r.expires.toISOString() })),
    };
    return out;
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

import { authRoutes } from '@intown/contracts/api';
import type { UpdateProfileBody, UpdateTravelerProfileBody, UpdateTasteProfileBody } from '@intown/contracts/api';
import type { User, TravelerProfile, TasteProfile } from '@intown/contracts/types';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import type { Pools } from '../db/pool.ts';
import { registerRoute, type RouteHandler } from '../http/router.ts';
import { withUserContext } from '../auth/session.ts';

/** Postgres unique-violation SQLSTATE — a duplicate key on a UNIQUE constraint. */
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

/**
 * Serialize concurrent same-user writes with a transaction-scoped advisory lock
 * keyed on the caller's uuid. The lock is auto-released at COMMIT/ROLLBACK. Taken
 * before a read-modify-write (traveler upsert) or a versioned append (taste
 * insert) so two concurrent same-user PUTs run one-after-another instead of
 * racing. `hashtext` is a 32-bit hash, so two different users can occasionally
 * collide on the same lock key — harmless: at worst they briefly serialize, never
 * incorrectness, since each still writes only its own `current_user_id()` rows.
 */
async function lockUser(client: PoolClient): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext(current_user_id()::text))');
}

/**
 * Traveler + taste profile read/write path (P04, §6.1–6.2).
 *
 * Every handler goes through `withUserContext` on the RLS-bound app pool, so the
 * `*_self` policies (0011) scope reads and writes to the caller — the queries
 * use `current_user_id()` rather than trusting a value from the request body.
 *
 * Data minimization (§16.1): the traveler profile stores an AGE BAND, never a
 * birthdate, and no coordinate/GPS field exists anywhere on these models.
 * Taste profiles are VERSIONED — an update appends a new row (never edits in
 * place), so learning (P23) can attribute signals to a version and revert.
 */

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  handle: string | null;
  locale: string | null;
  created_at: Date;
  updated_at: Date;
}

export const USER_COLUMNS = 'id, email, display_name, handle, locale, created_at, updated_at';

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    handle: row.handle,
    locale: row.locale,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function getProfileHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    return withUserContext(pools.appPool, userId, async (client) => {
      const { rows } = await client.query<UserRow>(
        `SELECT ${USER_COLUMNS} FROM users WHERE id = current_user_id()`,
      );
      return toUser(rows[0]!);
    });
  };
}

export function updateProfileHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    const userId = req.user!.id;
    const body = req.body as UpdateProfileBody;

    // Only touch columns the caller actually sent (an absent key is "leave as
    // is"; an explicit null clears the value). `set_updated_at` (0010) stamps
    // updated_at on every UPDATE, so it is never set here.
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const col of ['display_name', 'handle', 'locale'] as const) {
      if (col in body) {
        values.push(body[col] ?? null);
        sets.push(`${col} = $${values.length}`);
      }
    }

    return withUserContext(pools.appPool, userId, async (client) => {
      if (sets.length === 0) {
        const { rows } = await client.query<UserRow>(
          `SELECT ${USER_COLUMNS} FROM users WHERE id = current_user_id()`,
        );
        return toUser(rows[0]!);
      }
      try {
        const { rows } = await client.query<UserRow>(
          `UPDATE users SET ${sets.join(', ')}
            WHERE id = current_user_id()
          RETURNING ${USER_COLUMNS}`,
          values,
        );
        return toUser(rows[0]!);
      } catch (err) {
        // `users.handle` is UNIQUE (0003) and is the only unique column this
        // route can set (UpdateProfileBody has no email field): assigning a
        // handle another user already holds raises 23505. Surface that as a 409
        // conflict rather than letting it bubble up as an unhandled 500.
        if (isUniqueViolation(err)) {
          return conflict(reply, 'that handle is already taken');
        }
        throw err;
      }
    });
  };
}

// ---------------------------------------------------------------------------
// Traveler profile
// ---------------------------------------------------------------------------

export interface TravelerRow {
  id: string;
  user_id: string;
  age_band: TravelerProfile['age_band'];
  mobility: TravelerProfile['mobility'];
  eu_residency: boolean;
  student: boolean;
  languages: string[];
  currency: string;
  created_at: Date;
  updated_at: Date;
}

export const TRAVELER_COLUMNS =
  'id, user_id, age_band, mobility, eu_residency, student, languages, currency, created_at, updated_at';

export function toTravelerProfile(row: TravelerRow): TravelerProfile {
  return {
    id: row.id,
    user_id: row.user_id,
    age_band: row.age_band,
    mobility: row.mobility,
    eu_residency: row.eu_residency,
    student: row.student,
    languages: row.languages,
    currency: row.currency,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export function getTravelerProfileHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    return withUserContext(pools.appPool, userId, async (client) => {
      const { rows } = await client.query<TravelerRow>(
        `SELECT ${TRAVELER_COLUMNS} FROM traveler_profiles WHERE user_id = current_user_id()`,
      );
      return rows[0] ? toTravelerProfile(rows[0]) : null;
    });
  };
}

/**
 * Upsert the single traveler profile. `UpdateTravelerProfileBody` is partial, so
 * the body is merged over the existing row (read-modify-write inside the same
 * txn): an absent key keeps its current value on update. Creating a profile for
 * the first time requires every NOT NULL field (age_band, mobility, eu_residency,
 * student, currency) — a partial create is a 400, not a NOT NULL crash.
 *
 * The read-modify-write is serialized per user via a transaction-scoped advisory
 * lock (`lockUser`) taken before the SELECT: without it, two concurrent same-user
 * partial PUTs at READ COMMITTED could both read the same pre-image and the
 * second write would clobber the first's fields (last-write-wins). The lock
 * makes concurrent same-user merges run sequentially, so no field is lost.
 */
export function updateTravelerProfileHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    const userId = req.user!.id;
    const body = req.body as UpdateTravelerProfileBody;
    return withUserContext(pools.appPool, userId, async (client) => {
      await lockUser(client);
      const existing = await client.query<TravelerRow>(
        `SELECT ${TRAVELER_COLUMNS} FROM traveler_profiles WHERE user_id = current_user_id()`,
      );
      const prev = existing.rows[0];

      const merged = {
        age_band: body.age_band ?? prev?.age_band,
        mobility: body.mobility ?? prev?.mobility,
        eu_residency: body.eu_residency ?? prev?.eu_residency,
        student: body.student ?? prev?.student,
        languages: body.languages ?? prev?.languages ?? [],
        currency: body.currency ?? prev?.currency,
      };

      if (
        merged.age_band === undefined ||
        merged.mobility === undefined ||
        merged.eu_residency === undefined ||
        merged.student === undefined ||
        merged.currency === undefined
      ) {
        return badRequestMissingFields(reply);
      }

      const { rows } = await client.query<TravelerRow>(
        `INSERT INTO traveler_profiles
           (user_id, age_band, mobility, eu_residency, student, languages, currency)
         VALUES (current_user_id(), $1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           age_band = EXCLUDED.age_band,
           mobility = EXCLUDED.mobility,
           eu_residency = EXCLUDED.eu_residency,
           student = EXCLUDED.student,
           languages = EXCLUDED.languages,
           currency = EXCLUDED.currency
         RETURNING ${TRAVELER_COLUMNS}`,
        [
          merged.age_band,
          merged.mobility,
          merged.eu_residency,
          merged.student,
          merged.languages,
          merged.currency,
        ],
      );
      return toTravelerProfile(rows[0]!);
    });
  };
}

function badRequestMissingFields(reply: FastifyReply): FastifyReply {
  return reply.code(400).send({
    error: 'bad_request',
    detail: 'creating a traveler profile requires age_band, mobility, eu_residency, student, and currency',
  });
}

// ---------------------------------------------------------------------------
// Taste profile (versioned)
// ---------------------------------------------------------------------------

export interface TasteRow {
  id: string;
  user_id: string;
  version: number;
  interests: string[];
  anti_preferences: string[];
  hard_exclusions: string[];
  dietary: string[];
  budget_tier: TasteProfile['budget_tier'];
  pace: TasteProfile['pace'];
  created_at: Date;
}

export const TASTE_COLUMNS =
  'id, user_id, version, interests, anti_preferences, hard_exclusions, dietary, budget_tier, pace, created_at';

export function toTasteProfile(row: TasteRow): TasteProfile {
  return {
    id: row.id,
    user_id: row.user_id,
    version: row.version,
    interests: row.interests,
    anti_preferences: row.anti_preferences,
    hard_exclusions: row.hard_exclusions,
    dietary: row.dietary,
    budget_tier: row.budget_tier,
    pace: row.pace,
    created_at: row.created_at.toISOString(),
  };
}

export function getTasteProfileHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    return withUserContext(pools.appPool, userId, async (client) => {
      const { rows } = await client.query<TasteRow>(
        `SELECT ${TASTE_COLUMNS} FROM taste_profiles
          WHERE user_id = current_user_id()
          ORDER BY version DESC
          LIMIT 1`,
      );
      return rows[0] ? toTasteProfile(rows[0]) : null;
    });
  };
}

/**
 * Append a new taste-profile version. The next version is
 * `COALESCE(MAX(version), -1) + 1`. That expression is statement-atomic but NOT
 * concurrency-safe on its own: two same-user PUTs at READ COMMITTED can each read
 * the same MAX and compute the same next version, and the loser then trips
 * `UNIQUE(user_id, version)` with a 23505. A per-user transaction-scoped advisory
 * lock (`lockUser`) taken before the insert serializes concurrent same-user
 * appends, so versions are dense and monotonic (0,1,2,…) with no duplicate or
 * skipped number. Prior versions are preserved (history is never edited in
 * place). `anti_preferences` (soft down-weight) and `hard_exclusions` (absolute
 * veto) are stored as distinct arrays — the museum-problem distinction (§6.2).
 */
export function updateTasteProfileHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const userId = req.user!.id;
    const body = req.body as UpdateTasteProfileBody;
    return withUserContext(pools.appPool, userId, async (client) => {
      await lockUser(client);
      const { rows } = await client.query<TasteRow>(
        `INSERT INTO taste_profiles
           (user_id, version, interests, anti_preferences, hard_exclusions, dietary, budget_tier, pace)
         SELECT current_user_id(), COALESCE(MAX(version), -1) + 1, $1, $2, $3, $4, $5, $6
           FROM taste_profiles
          WHERE user_id = current_user_id()
         RETURNING ${TASTE_COLUMNS}`,
        [
          body.interests,
          body.anti_preferences,
          body.hard_exclusions,
          body.dietary,
          body.budget_tier,
          body.pace,
        ],
      );
      return toTasteProfile(rows[0]!);
    });
  };
}

/**
 * Register the profile routes (P04). Consent routes live in `auth/consents.ts`;
 * these cover the user record, the traveler profile, and the versioned taste
 * profile.
 */
export function registerProfileRoutes(app: FastifyInstance, pools: Pools): void {
  registerRoute(app, authRoutes['auth.getProfile'], getProfileHandler(pools));
  registerRoute(app, authRoutes['auth.updateProfile'], updateProfileHandler(pools));
  registerRoute(app, authRoutes['auth.getTravelerProfile'], getTravelerProfileHandler(pools));
  registerRoute(app, authRoutes['auth.updateTravelerProfile'], updateTravelerProfileHandler(pools));
  registerRoute(app, authRoutes['auth.getTasteProfile'], getTasteProfileHandler(pools));
  registerRoute(app, authRoutes['auth.updateTasteProfile'], updateTasteProfileHandler(pools));
}

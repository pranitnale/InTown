import type pg from 'pg';
import type {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from '@auth/core/adapters';

/**
 * Auth.js database adapter backed by the existing `users` table plus the P02
 * `accounts` / `sessions` / `verification_token` tables (migration 0012).
 *
 * Runs on the BYPASSRLS `intown_auth` pool: Auth.js must read/write across
 * users (session lookup, account linking) without any per-user RLS filter.
 *
 * Column mapping (Auth.js camelCase ↔ our snake_case):
 *   name          ↔ display_name
 *   emailVerified ↔ email_verified
 *   image         ↔ image
 * All Date ↔ timestamptz / bigint conversions live here.
 */

interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  image: string | null;
  email_verified: Date | null;
}

function mapUser(row: UserRow): AdapterUser {
  return {
    id: row.id,
    // AdapterUser types email as string; provider sign-ins always carry one.
    email: row.email ?? '',
    emailVerified: row.email_verified ?? null,
    name: row.display_name,
    image: row.image,
  } as AdapterUser;
}

const USER_COLUMNS = 'id, email, display_name, image, email_verified';

export function pgAdapter(authPool: pg.Pool): Adapter {
  return {
    async createUser(user: AdapterUser): Promise<AdapterUser> {
      const { rows } = await authPool.query<UserRow>(
        `INSERT INTO users (id, email, display_name, image, email_verified)
         VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5)
         RETURNING ${USER_COLUMNS}`,
        [user.id || null, user.email || null, user.name ?? null, user.image ?? null, user.emailVerified ?? null],
      );
      return mapUser(rows[0]!);
    },

    async getUser(id: string): Promise<AdapterUser | null> {
      const { rows } = await authPool.query<UserRow>(
        `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
        [id],
      );
      return rows[0] ? mapUser(rows[0]) : null;
    },

    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const { rows } = await authPool.query<UserRow>(
        `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
        [email],
      );
      return rows[0] ? mapUser(rows[0]) : null;
    },

    async getUserByAccount({
      provider,
      providerAccountId,
    }: Pick<AdapterAccount, 'provider' | 'providerAccountId'>): Promise<AdapterUser | null> {
      const { rows } = await authPool.query<UserRow>(
        `SELECT ${USER_COLUMNS.split(', ')
          .map((c) => `u.${c}`)
          .join(', ')}
           FROM users u
           JOIN accounts a ON a.user_id = u.id
          WHERE a.provider = $1 AND a.provider_account_id = $2`,
        [provider, providerAccountId],
      );
      return rows[0] ? mapUser(rows[0]) : null;
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>): Promise<AdapterUser> {
      const { rows } = await authPool.query<UserRow>(
        `UPDATE users SET
           email          = COALESCE($2, email),
           display_name   = COALESCE($3, display_name),
           image          = COALESCE($4, image),
           email_verified = COALESCE($5, email_verified)
         WHERE id = $1
         RETURNING ${USER_COLUMNS}`,
        [
          user.id,
          user.email ?? null,
          user.name ?? null,
          user.image ?? null,
          user.emailVerified ?? null,
        ],
      );
      return mapUser(rows[0]!);
    },

    async deleteUser(userId: string): Promise<void> {
      await authPool.query('DELETE FROM users WHERE id = $1', [userId]);
    },

    async linkAccount(account: AdapterAccount): Promise<AdapterAccount> {
      await authPool.query(
        `INSERT INTO accounts (
           user_id, type, provider, provider_account_id,
           refresh_token, access_token, expires_at, token_type, scope, id_token, session_state
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token ?? null,
          account.access_token ?? null,
          account.expires_at ?? null,
          account.token_type ?? null,
          account.scope ?? null,
          account.id_token ?? null,
          account.session_state ?? null,
        ],
      );
      return account;
    },

    async unlinkAccount({
      provider,
      providerAccountId,
    }: Pick<AdapterAccount, 'provider' | 'providerAccountId'>): Promise<void> {
      await authPool.query(
        'DELETE FROM accounts WHERE provider = $1 AND provider_account_id = $2',
        [provider, providerAccountId],
      );
    },

    async createSession(session: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }): Promise<AdapterSession> {
      const { rows } = await authPool.query<{
        session_token: string;
        user_id: string;
        expires: Date;
      }>(
        `INSERT INTO sessions (session_token, user_id, expires)
         VALUES ($1, $2, $3)
         RETURNING session_token, user_id, expires`,
        [session.sessionToken, session.userId, session.expires],
      );
      const row = rows[0]!;
      return { sessionToken: row.session_token, userId: row.user_id, expires: row.expires };
    },

    async getSessionAndUser(
      sessionToken: string,
    ): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const { rows } = await authPool.query<
        UserRow & { session_token: string; user_id: string; expires: Date }
      >(
        `SELECT s.session_token, s.user_id, s.expires,
                u.id, u.email, u.display_name, u.image, u.email_verified
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.session_token = $1`,
        [sessionToken],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        session: { sessionToken: row.session_token, userId: row.user_id, expires: row.expires },
        user: mapUser(row),
      };
    },

    async updateSession(
      session: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>,
    ): Promise<AdapterSession | null> {
      const { rows } = await authPool.query<{
        session_token: string;
        user_id: string;
        expires: Date;
      }>(
        `UPDATE sessions SET
           expires = COALESCE($2, expires),
           user_id = COALESCE($3, user_id)
         WHERE session_token = $1
         RETURNING session_token, user_id, expires`,
        [session.sessionToken, session.expires ?? null, session.userId ?? null],
      );
      const row = rows[0];
      return row
        ? { sessionToken: row.session_token, userId: row.user_id, expires: row.expires }
        : null;
    },

    async deleteSession(sessionToken: string): Promise<void> {
      await authPool.query('DELETE FROM sessions WHERE session_token = $1', [sessionToken]);
    },

    async createVerificationToken(
      token: VerificationToken,
    ): Promise<VerificationToken> {
      await authPool.query(
        `INSERT INTO verification_token (identifier, token, expires)
         VALUES ($1, $2, $3)`,
        [token.identifier, token.token, token.expires],
      );
      return token;
    },

    async useVerificationToken({
      identifier,
      token,
    }: {
      identifier: string;
      token: string;
    }): Promise<VerificationToken | null> {
      const { rows } = await authPool.query<{ identifier: string; token: string; expires: Date }>(
        `DELETE FROM verification_token
          WHERE identifier = $1 AND token = $2
          RETURNING identifier, token, expires`,
        [identifier, token],
      );
      const row = rows[0];
      return row ? { identifier: row.identifier, token: row.token, expires: row.expires } : null;
    },
  };
}

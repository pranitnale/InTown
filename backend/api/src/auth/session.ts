import type pg from 'pg';

/**
 * Session + request-context helpers (P02).
 *
 * `withUserContext` is the ONLY sanctioned way for a request handler to touch
 * user data: it opens a transaction on the RLS-bound app pool and sets the
 * `app.current_user_id` GUC so the row-level policies resolve to the caller.
 * Session lookups/revocation use the BYPASSRLS auth pool (they must see rows
 * across users).
 */

export interface SessionUser {
  id: string;
}

/**
 * Run `fn` inside a transaction on `appPool` with `app.current_user_id` set to
 * `userId` (transaction-local). Commits on success, rolls back on throw, and
 * always releases the client.
 */
export async function withUserContext<T>(
  appPool: pg.Pool,
  userId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    // `true` => setting is local to this transaction.
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
    const result = await fn(client);
    await client.query('COMMIT');
    client.release();
    return result;
  } catch (err) {
    // Roll back best-effort. A ROLLBACK that itself throws means the connection
    // is broken: hand the error to `release(err)` so pg discards the client
    // instead of returning a possibly-in-transaction one to the pool. Either
    // way the ORIGINAL error is preserved and rethrown.
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch {
      client.release(err instanceof Error ? err : new Error(String(err)));
    }
    throw err;
  }
}

/**
 * Resolve a session cookie value to its user, or `null` when the token is
 * unknown or expired. Uses the BYPASSRLS auth pool.
 */
export async function getSessionUser(
  authPool: pg.Pool,
  sessionToken: string,
): Promise<SessionUser | null> {
  const { rows } = await authPool.query<{ user_id: string }>(
    `SELECT s.user_id
       FROM sessions s
      WHERE s.session_token = $1
        AND s.expires > now()
      LIMIT 1`,
    [sessionToken],
  );
  const row = rows[0];
  return row ? { id: row.user_id } : null;
}

/** Revoke a single session (server-side). */
export async function revokeSession(authPool: pg.Pool, sessionToken: string): Promise<void> {
  await authPool.query('DELETE FROM sessions WHERE session_token = $1', [sessionToken]);
}

/** Revoke every session for a user (e.g. password reset, account takeover). */
export async function revokeAllSessions(authPool: pg.Pool, userId: string): Promise<void> {
  await authPool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

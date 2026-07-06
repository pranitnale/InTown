import pg from 'pg';
import type { LoadedEnv } from '../config/env.ts';

const { Pool } = pg;

/**
 * The two connection pools that enforce the RLS boundary (P02):
 * - `authPool` connects as `intown_auth` (BYPASSRLS) — Auth.js session/account
 *   reads must not be filtered by any per-user policy.
 * - `appPool` connects as `intown_app` (no BYPASSRLS) — every request handler
 *   runs through it, inside a `withUserContext` transaction, so row-level
 *   security applies to user data.
 */
export interface Pools {
  authPool: pg.Pool;
  appPool: pg.Pool;
}

export function createPools(env: Pick<LoadedEnv, 'AUTH_DATABASE_URL' | 'APP_DATABASE_URL'>): Pools {
  const authPool = new Pool({ connectionString: env.AUTH_DATABASE_URL });
  const appPool = new Pool({ connectionString: env.APP_DATABASE_URL });
  return { authPool, appPool };
}

export async function closePools(pools: Pools): Promise<void> {
  await Promise.all([pools.authPool.end(), pools.appPool.end()]);
}

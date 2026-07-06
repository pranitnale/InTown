import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import { loadEnv, type LoadedEnv } from '../../src/config/env.ts';
import { createPools, type Pools } from '../../src/db/pool.ts';
import { buildServer } from '../../src/server.ts';
import { ArrayLinkSink } from '../../src/auth/providers.ts';

/** Superuser URL used by the harness for seeding + cross-user assertions. */
export function adminUrl(): string {
  return (
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres_dev_password@localhost:5432/intown'
  );
}

/** Build a validated test env: process.env with test-safe defaults, then per-test overrides. */
export function testEnv(overrides: Record<string, string> = {}): LoadedEnv {
  return loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    COOKIE_SECURE: 'false',
    // Deterministic origin for the Fastify↔Web bridge (avoids host-derivation ambiguity under inject).
    AUTH_URL: process.env.AUTH_URL ?? 'http://localhost',
    // Generous by default so multi-step flows don't self-throttle; the rate-limit
    // suite overrides this to a small number.
    AUTH_RATE_LIMIT_MAX: '1000',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? 'test-client-id.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? 'test-client-secret',
    AUTH_SECRET: process.env.AUTH_SECRET ?? 'test-auth-secret-0000000000000000000000000000',
    ...overrides,
  } as NodeJS.ProcessEnv);
}

/** A superuser pool for seeding + tripwire assertions (bypasses RLS via ownership). */
export function createAdminPool(): pg.Pool {
  return new pg.Pool({ connectionString: adminUrl() });
}

export interface SeededUser {
  id: string;
  email: string;
}

export interface SeededUsers {
  a: SeededUser;
  b: SeededUser;
}

// Valid RFC-4122 UUIDs (version + variant nibbles set) so they pass `z.uuid()`.
const USER_A: SeededUser = { id: '11111111-1111-4111-8111-111111111111', email: 'alice@example.com' };
const USER_B: SeededUser = { id: '22222222-2222-4222-8222-222222222222', email: 'bob@example.com' };

/** Insert two distinct users (superuser; bypasses RLS). */
export async function seedTwoUsers(admin: pg.Pool): Promise<SeededUsers> {
  await admin.query(
    `INSERT INTO users (id, email, display_name) VALUES ($1, $2, 'Alice'), ($3, $4, 'Bob')`,
    [USER_A.id, USER_A.email, USER_B.id, USER_B.email],
  );
  return { a: USER_A, b: USER_B };
}

/** Truncate the auth + identity tables between tests. */
export async function resetTables(admin: pg.Pool): Promise<void> {
  await admin.query(
    `TRUNCATE consents, sessions, accounts, verification_token,
              traveler_profiles, taste_profiles, users RESTART IDENTITY CASCADE`,
  );
}

export interface TestServer {
  app: FastifyInstance;
  pools: Pools;
  env: LoadedEnv;
  linkSink: ArrayLinkSink;
}

/**
 * Build a server wired to the dev/CI DB (app pool = intown_app so RLS applies).
 * The returned pools are closed when `app.close()` is called.
 */
export function makeTestServer(overrides: Record<string, string> = {}): TestServer {
  const env = testEnv(overrides);
  const pools = createPools(env);
  const linkSink = new ArrayLinkSink();
  const app = buildServer({ env, pools, linkSink });
  return { app, pools, env, linkSink };
}

/** A minimal cookie jar for driving the multi-step Auth.js flows via `app.inject`. */
export class CookieJar {
  private readonly store = new Map<string, string>();

  /** Update the jar from a light-my-request response's parsed cookies. */
  update(cookies: Array<{ name: string; value: string }>): void {
    for (const { name, value } of cookies) {
      if (value === '') this.store.delete(name);
      else this.store.set(name, value);
    }
  }

  /** The `Cookie` header value, or undefined when empty. */
  header(): string | undefined {
    if (this.store.size === 0) return undefined;
    return [...this.store.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  get(name: string): string | undefined {
    return this.store.get(name);
  }
}

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { createPools, closePools, type Pools } from '../src/db/pool.ts';
import { withUserContext } from '../src/auth/session.ts';
import { createAdminPool, resetTables, seedTwoUsers, testEnv } from './helpers/db.ts';

/**
 * AC4 — RLS blocks a user from reading another user's row.
 *
 * The app pool connects as `intown_app` (no BYPASSRLS), so the per-user policies
 * from migration 0011 apply. The tripwire half asserts the auth pool (BYPASSRLS)
 * still sees every row — proving the isolation comes from RLS, not empty tables.
 */
describe('RLS isolation (AC4)', () => {
  const admin = createAdminPool();
  const pools: Pools = createPools(testEnv());

  beforeEach(async () => {
    await resetTables(admin);
  });

  afterAll(async () => {
    await admin.end();
    await closePools(pools);
  });

  it('under user A context the app role sees only A, never B', async () => {
    const { a, b } = await seedTwoUsers(admin);
    // Give B a consent row to prove cross-user rows are hidden on child tables too.
    await admin.query(
      `INSERT INTO consents (user_id, consent_type, granted, policy_version)
       VALUES ($1, 'marketing', true, 'v1')`,
      [b.id],
    );

    const result = await withUserContext(pools.appPool, a.id, async (client: pg.PoolClient) => {
      const users = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM users');
      const seesB = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM users WHERE id = $1',
        [b.id],
      );
      const consents = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM consents',
      );
      return {
        visibleUsers: Number(users.rows[0]!.count),
        seesB: Number(seesB.rows[0]!.count),
        visibleConsents: Number(consents.rows[0]!.count),
      };
    });

    expect(result.visibleUsers).toBe(1); // only A
    expect(result.seesB).toBe(0); // B's user row is invisible
    expect(result.visibleConsents).toBe(0); // B's consent is invisible

    // Tripwire: the BYPASSRLS auth pool sees everything.
    const allUsers = await pools.authPool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM users',
    );
    const allConsents = await pools.authPool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM consents',
    );
    expect(Number(allUsers.rows[0]!.count)).toBe(2);
    expect(Number(allConsents.rows[0]!.count)).toBe(1);
  });

  it("P04: user A cannot read or write user B's traveler/taste rows", async () => {
    const { a, b } = await seedTwoUsers(admin);
    // Seed B's traveler + taste profiles (superuser bypasses RLS).
    await admin.query(
      `INSERT INTO traveler_profiles (user_id, age_band, mobility, eu_residency, student, currency)
       VALUES ($1, '26-44', 'full', true, false, 'EUR')`,
      [b.id],
    );
    await admin.query(
      `INSERT INTO taste_profiles (user_id, version, budget_tier, pace)
       VALUES ($1, 0, 'moderate', 'relaxed')`,
      [b.id],
    );

    const result = await withUserContext(pools.appPool, a.id, async (client: pg.PoolClient) => {
      const seesTraveler = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM traveler_profiles',
      );
      const seesTaste = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM taste_profiles',
      );
      // A write targeting B's row hits 0 rows: B's rows are invisible under RLS.
      const updB = await client.query(
        `UPDATE traveler_profiles SET currency = 'USD' WHERE user_id = $1`,
        [b.id],
      );
      return {
        visibleTraveler: Number(seesTraveler.rows[0]!.count),
        visibleTaste: Number(seesTaste.rows[0]!.count),
        updatedRows: updB.rowCount,
      };
    });

    expect(result.visibleTraveler).toBe(0); // B's traveler profile hidden
    expect(result.visibleTaste).toBe(0); // B's taste profile hidden
    expect(result.updatedRows).toBe(0); // cannot mutate B's row

    // Tripwire: B's rows are untouched (superuser confirms currency unchanged).
    const bRow = await admin.query<{ currency: string }>(
      'SELECT currency FROM traveler_profiles WHERE user_id = $1',
      [b.id],
    );
    expect(bRow.rows[0]!.currency).toBe('EUR');
  });
});

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { createPools, closePools, type Pools } from '../src/db/pool.ts';
import { withUserContext } from '../src/auth/session.ts';
import {
  createAdminPool,
  resetTables,
  seedTwoUsers,
  seedCityAndPoi,
  seedTrip,
  seedPlace,
  seedVote,
  testEnv,
} from './helpers/db.ts';

/**
 * P06 AC1 (RLS half) + AC4 — trips-domain Row-Level Security (migration 0013).
 *
 * The app pool connects as `intown_app` (no BYPASSRLS), so the per-trip policies
 * apply. Each assertion is paired with a BYPASSRLS tripwire on the auth pool,
 * proving the isolation comes from RLS and not from empty tables.
 */
async function count(client: pg.PoolClient, table: string): Promise<number> {
  const { rows } = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM ${table}`);
  return Number(rows[0]!.c);
}

describe('trips-domain RLS (AC1, AC4)', () => {
  const admin = createAdminPool();
  const pools: Pools = createPools(testEnv());

  beforeEach(async () => {
    await resetTables(admin);
  });

  afterAll(async () => {
    await admin.end();
    await closePools(pools);
  });

  it('a non-member sees zero trips / trip_places / place_votes; the owner sees them', async () => {
    const { a, b } = await seedTwoUsers(admin);
    const { cityId, poiIds } = await seedCityAndPoi(admin, 1);
    const { tripCityId } = await seedTrip(admin, { ownerId: a.id, cityId });
    const placeId = await seedPlace(admin, {
      tripCityId: tripCityId!,
      poiId: poiIds[0]!,
      addedBy: a.id,
    });
    await seedVote(admin, placeId, a.id, 'up');

    // B is NOT a member of the trip — every trips-domain table is invisible.
    const bView = await withUserContext(pools.appPool, b.id, async (client) => ({
      trips: await count(client, 'trips'),
      places: await count(client, 'trip_places'),
      votes: await count(client, 'place_votes'),
    }));
    expect(bView).toEqual({ trips: 0, places: 0, votes: 0 });

    // A (owner-member) sees the trip, the place, and their own vote.
    const aView = await withUserContext(pools.appPool, a.id, async (client) => ({
      trips: await count(client, 'trips'),
      places: await count(client, 'trip_places'),
      votes: await count(client, 'place_votes'),
    }));
    expect(aView).toEqual({ trips: 1, places: 1, votes: 1 });

    // Tripwire: a connection that bypasses RLS (the superuser seeding pool) sees
    // the rows regardless of the caller — the hiding above is RLS, not empty
    // tables. (intown_auth is intentionally granted only trip_members, so the
    // superuser admin pool is the trips-domain bypass witness.)
    const allTrips = await admin.query<{ c: string }>('SELECT count(*)::text AS c FROM trips');
    const allVotes = await admin.query<{ c: string }>('SELECT count(*)::text AS c FROM place_votes');
    expect(Number(allTrips.rows[0]!.c)).toBe(1);
    expect(Number(allVotes.rows[0]!.c)).toBe(1);
  });

  it('place_votes are self-rows-only: a fellow member never reads another member vote', async () => {
    const { a, b } = await seedTwoUsers(admin);
    const { cityId, poiIds } = await seedCityAndPoi(admin, 1);
    // B joins as an editor, so both may vote — yet neither sees the other's row.
    const { tripCityId } = await seedTrip(admin, {
      ownerId: a.id,
      cityId,
      members: [{ userId: b.id, role: 'editor' }],
    });
    const placeId = await seedPlace(admin, {
      tripCityId: tripCityId!,
      poiId: poiIds[0]!,
      addedBy: a.id,
    });
    await seedVote(admin, placeId, a.id, 'up');
    await seedVote(admin, placeId, b.id, 'down');

    const aVotes = await withUserContext(pools.appPool, a.id, async (client) =>
      (await client.query<{ user_id: string; vote: string }>('SELECT user_id, vote FROM place_votes'))
        .rows,
    );
    expect(aVotes).toEqual([{ user_id: a.id, vote: 'up' }]);

    const bVotes = await withUserContext(pools.appPool, b.id, async (client) =>
      (await client.query<{ user_id: string; vote: string }>('SELECT user_id, vote FROM place_votes'))
        .rows,
    );
    expect(bVotes).toEqual([{ user_id: b.id, vote: 'down' }]);

    // The aggregate reader returns totals to a member — counts only, NO user ids.
    const counts = await withUserContext(pools.appPool, b.id, async (client) =>
      (
        await client.query<{ up: number; down: number; member_count: number }>(
          'SELECT up, down, member_count FROM place_vote_counts($1)',
          [placeId],
        )
      ).rows[0],
    );
    expect(counts).toEqual({ up: 1, down: 1, member_count: 2 });

    // Tripwire: the RLS-bypassing superuser pool sees both raw votes — the
    // per-member hiding above is RLS, not missing rows.
    const raw = await admin.query<{ c: string }>('SELECT count(*)::text AS c FROM place_votes');
    expect(Number(raw.rows[0]!.c)).toBe(2);
  });

  it('a non-member calling place_vote_counts is rejected (IT403), not silently answered', async () => {
    const { a, b } = await seedTwoUsers(admin);
    const { cityId, poiIds } = await seedCityAndPoi(admin, 1);
    const { tripCityId } = await seedTrip(admin, { ownerId: a.id, cityId });
    const placeId = await seedPlace(admin, {
      tripCityId: tripCityId!,
      poiId: poiIds[0]!,
      addedBy: a.id,
    });

    await expect(
      withUserContext(pools.appPool, b.id, async (client) =>
        client.query('SELECT up FROM place_vote_counts($1)', [placeId]),
      ),
    ).rejects.toMatchObject({ code: 'IT403' });
  });
});

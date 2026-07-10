import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { createPools, closePools, type Pools } from '../src/db/pool.ts';
import { withUserContext } from '../src/auth/session.ts';
import {
  createAdminPool,
  resetTables,
  seedTwoUsers,
  seedUser,
  seedCityAndPoi,
  seedTrip,
  seedPlace,
  seedVote,
  testEnv,
} from './helpers/db.ts';

/** SQLSTATE for a WITH CHECK / RLS policy violation on write. */
const RLS_VIOLATION = '42501';

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

/**
 * P06 AC2 (DB half) — the write-path WITH CHECK / USING policies from 0013. AC2
 * ("Viewer cannot curate/vote/edit; Editor can") is enforced at two layers: the
 * API guard (assertEditor, covered in trips.authz.test.ts) AND the RLS policies
 * below, so a write that slips past a route still cannot mutate the DB. These
 * assertions run as `intown_app` (RLS applies) via withUserContext.
 */
describe('trips-domain write-path RLS (AC2)', () => {
  const admin = createAdminPool();
  const pools: Pools = createPools(testEnv());

  beforeEach(async () => {
    await resetTables(admin);
  });

  afterAll(async () => {
    await admin.end();
    await closePools(pools);
  });

  it('a viewer is denied INSERT on trip_cities / trip_places / place_votes (editor WITH CHECK)', async () => {
    const { a, b } = await seedTwoUsers(admin);
    const { cityId, poiIds } = await seedCityAndPoi(admin, 1);
    // B joins as a viewer; A owns. Seed one place so a vote target exists.
    const { tripId, tripCityId } = await seedTrip(admin, {
      ownerId: a.id,
      cityId,
      members: [{ userId: b.id, role: 'viewer' }],
    });
    const placeId = await seedPlace(admin, {
      tripCityId: tripCityId!,
      poiId: poiIds[0]!,
      addedBy: a.id,
    });

    // Each failing write gets its own withUserContext: an RLS violation aborts
    // its transaction, so they cannot share one (a later statement would fail
    // with 25P02 rather than its own policy error).

    // trip_cities: editor-only INSERT.
    await expect(
      withUserContext(pools.appPool, b.id, (client) =>
        client.query(
          `INSERT INTO trip_cities (trip_id, ord, city_id, arrive, depart)
           VALUES ($1, 1, $2, '2026-02-01', '2026-02-02')`,
          [tripId, cityId],
        ),
      ),
    ).rejects.toMatchObject({ code: RLS_VIOLATION });

    // trip_places: editor-only INSERT (even attributed to self).
    await expect(
      withUserContext(pools.appPool, b.id, (client) =>
        client.query(
          `INSERT INTO trip_places (trip_city_id, poi_id, position, added_by)
           VALUES ($1, $2, 'b0', $3)`,
          [tripCityId, poiIds[0], b.id],
        ),
      ),
    ).rejects.toMatchObject({ code: RLS_VIOLATION });

    // place_votes: self-row that still requires editor of the parent trip.
    await expect(
      withUserContext(pools.appPool, b.id, (client) =>
        client.query(
          `INSERT INTO place_votes (trip_place_id, user_id, vote) VALUES ($1, $2, 'up')`,
          [placeId, b.id],
        ),
      ),
    ).rejects.toMatchObject({ code: RLS_VIOLATION });
  });

  it('a viewer UPDATE/DELETE of a trip_place affects zero rows (editor USING denies)', async () => {
    const { a, b } = await seedTwoUsers(admin);
    const { cityId, poiIds } = await seedCityAndPoi(admin, 1);
    const { tripCityId } = await seedTrip(admin, {
      ownerId: a.id,
      cityId,
      members: [{ userId: b.id, role: 'viewer' }],
    });
    const placeId = await seedPlace(admin, {
      tripCityId: tripCityId!,
      poiId: poiIds[0]!,
      addedBy: a.id,
      position: 'a0',
    });

    const { updated, deleted } = await withUserContext(pools.appPool, b.id, async (client) => {
      // The viewer SEES the row (member SELECT) but the editor-only USING clause
      // on UPDATE/DELETE excludes it: no error, zero rows touched.
      const u = await client.query(`UPDATE trip_places SET position = 'zz' WHERE id = $1`, [placeId]);
      const d = await client.query(`DELETE FROM trip_places WHERE id = $1`, [placeId]);
      return { updated: u.rowCount, deleted: d.rowCount };
    });
    expect(updated).toBe(0);
    expect(deleted).toBe(0);

    // The row is intact and unmodified — the bypass pool witnesses it.
    const raw = await admin.query<{ position: string }>(
      'SELECT position FROM trip_places WHERE id = $1',
      [placeId],
    );
    expect(raw.rows[0]!.position).toBe('a0');
  });

  it('an editor must attribute trip_places to themselves (added_by WITH CHECK)', async () => {
    const { a, b } = await seedTwoUsers(admin);
    const editor = await seedUser(admin, 'ed@example.com');
    const { cityId, poiIds } = await seedCityAndPoi(admin, 1);
    const { tripCityId } = await seedTrip(admin, {
      ownerId: a.id,
      cityId,
      members: [{ userId: editor.id, role: 'editor' }],
    });

    // Attributing the row to another user violates the attribution WITH CHECK.
    // Its own transaction, since the violation aborts it.
    await expect(
      withUserContext(pools.appPool, editor.id, (client) =>
        client.query(
          `INSERT INTO trip_places (trip_city_id, poi_id, position, added_by)
           VALUES ($1, $2, 'a1', $3)`,
          [tripCityId, poiIds[0], b.id],
        ),
      ),
    ).rejects.toMatchObject({ code: RLS_VIOLATION });

    // Attributed to self, the same editor insert succeeds.
    const added = await withUserContext(pools.appPool, editor.id, async (client) => {
      const ok = await client.query<{ added_by: string }>(
        `INSERT INTO trip_places (trip_city_id, poi_id, position, added_by)
         VALUES ($1, $2, 'a2', $3) RETURNING added_by`,
        [tripCityId, poiIds[0], editor.id],
      );
      return ok.rows[0]!.added_by;
    });
    expect(added).toBe(editor.id);
  });

  it('an editor can INSERT trip_cities and vote; a viewer cannot (AC2 positive/negative)', async () => {
    const { a, b } = await seedTwoUsers(admin);
    const { cityId, poiIds } = await seedCityAndPoi(admin, 1);
    const { tripId, tripCityId } = await seedTrip(admin, {
      ownerId: a.id,
      cityId,
      members: [{ userId: b.id, role: 'editor' }],
    });
    const placeId = await seedPlace(admin, {
      tripCityId: tripCityId!,
      poiId: poiIds[0]!,
      addedBy: a.id,
    });

    await withUserContext(pools.appPool, b.id, async (client) => {
      const city = await client.query(
        `INSERT INTO trip_cities (trip_id, ord, city_id, arrive, depart)
         VALUES ($1, 1, $2, '2026-03-01', '2026-03-02') RETURNING id`,
        [tripId, cityId],
      );
      expect(city.rowCount).toBe(1);

      const vote = await client.query(
        `INSERT INTO place_votes (trip_place_id, user_id, vote) VALUES ($1, $2, 'up') RETURNING id`,
        [placeId, b.id],
      );
      expect(vote.rowCount).toBe(1);
    });
  });
});

/**
 * P06 AC3 (boundary) — redeem_invite(code) is upgrade-only and never demotes.
 * The function is the RLS-bypassing SECURITY DEFINER entry point, callable
 * regardless of route-level guards, so the owner_id ⇔ owner-membership invariant
 * must hold in the function itself: an existing owner who redeems ANY invite
 * keeps 'owner', and no member is ever downgraded.
 */
describe('redeem_invite role changes (AC3)', () => {
  const admin = createAdminPool();
  const pools: Pools = createPools(testEnv());

  beforeEach(async () => {
    await resetTables(admin);
  });

  afterAll(async () => {
    await admin.end();
    await closePools(pools);
  });

  /** Seed an invite (superuser) and return its code. */
  async function seedInvite(
    tripId: string,
    createdBy: string,
    role: 'owner' | 'editor' | 'viewer',
    code: string,
  ): Promise<string> {
    await admin.query(
      `INSERT INTO trip_invites (trip_id, code, role, expires_at, created_by)
       VALUES ($1, $2, $3, now() + interval '1 day', $4)`,
      [tripId, code, role, createdBy],
    );
    return code;
  }

  /** redeem_invite as `uid` (RLS-bound app pool); returns the resulting role. */
  async function redeemAs(uid: string, code: string): Promise<string> {
    return withUserContext(pools.appPool, uid, async (client) => {
      const { rows } = await client.query<{ role: string }>(
        'SELECT role FROM redeem_invite($1)',
        [code],
      );
      return rows[0]!.role;
    });
  }

  it('an owner redeeming a lower-role invite is NOT demoted (stays owner)', async () => {
    const { a } = await seedTwoUsers(admin);
    const { tripId } = await seedTrip(admin, { ownerId: a.id });
    const code = await seedInvite(tripId, a.id, 'viewer', 'ownerpreviewslink000001');

    // The owner previews / redeems their own viewer link. Their membership must
    // remain 'owner' — the reported split-brain regression.
    expect(await redeemAs(a.id, code)).toBe('owner');

    const raw = await admin.query<{ role: string }>(
      'SELECT role FROM trip_members WHERE trip_id = $1 AND user_id = $2',
      [tripId, a.id],
    );
    expect(raw.rows[0]!.role).toBe('owner');
  });

  it('a new member joins with the invite role; a viewer is UPGRADED by an editor invite', async () => {
    const { a, b } = await seedTwoUsers(admin);
    const { tripId } = await seedTrip(admin, { ownerId: a.id });

    // B joins fresh as a viewer.
    const viewerCode = await seedInvite(tripId, a.id, 'viewer', 'freshviewerjoinlink00001');
    expect(await redeemAs(b.id, viewerCode)).toBe('viewer');

    // B redeems an editor invite → upgraded.
    const editorCode = await seedInvite(tripId, a.id, 'editor', 'upgradetoeditorlink00001');
    expect(await redeemAs(b.id, editorCode)).toBe('editor');
  });

  it('an editor redeeming a viewer invite is NOT downgraded (stays editor)', async () => {
    const { a, b } = await seedTwoUsers(admin);
    const { tripId } = await seedTrip(admin, {
      ownerId: a.id,
      members: [{ userId: b.id, role: 'editor' }],
    });
    const code = await seedInvite(tripId, a.id, 'viewer', 'editorredeemsviewer00001');

    expect(await redeemAs(b.id, code)).toBe('editor');
  });
});

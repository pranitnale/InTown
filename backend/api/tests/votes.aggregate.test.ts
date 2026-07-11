import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withUserContext } from '../src/auth/session.ts';
import { getVoteCounts } from '../src/places/votes.ts';
import {
  createAdminPool,
  makeTestServer,
  resetTables,
  seedCityAndPoi,
  seedPlace,
  seedTrip,
  seedTwoUsers,
  seedUser,
  sessionFor,
  type SeededUser,
  type TestServer,
} from './helpers/db.ts';

/**
 * P06 AC4 — per-member votes with AGGREGATE-ONLY disclosure. A votes are recorded
 * one-per-member (upsert flips), a viewer cannot vote, `place_vote_counts` returns
 * counts with no user ids, and — the name-leak guard — serializing every
 * trip-scoped GET as the observer never reveals a voter's identity except in the
 * attributed contexts (membership, `added_by`).
 *
 * Cast: observer/owner = Bob (sees every endpoint, including owner-only invites);
 * voter = Alice, an editor who also ADDED the place (so `added_by` legitimately
 * carries her id — the one place her id is allowed to surface).
 */
describe('votes: per-member + aggregate-only disclosure (AC4)', () => {
  const admin = createAdminPool();
  let ts: TestServer;
  let alice: SeededUser; // voter + adder (editor)
  let bob: SeededUser; // owner + observer
  let cookieAlice: string;
  let cookieBob: string;
  let tripId: string;
  let tripCityId: string;
  let placeId: string;
  let poiIds: string[];

  beforeAll(() => {
    ts = makeTestServer();
  });

  beforeEach(async () => {
    await resetTables(admin);
    ({ a: alice, b: bob } = await seedTwoUsers(admin));
    const city = await seedCityAndPoi(admin, 3);
    poiIds = city.poiIds;
    ({ tripId, tripCityId } = await seedTrip(admin, {
      ownerId: bob.id,
      members: [{ userId: alice.id, role: 'editor' }],
      cityId: city.cityId,
    }) as { tripId: string; tripCityId: string });
    placeId = await seedPlace(admin, { tripCityId, poiId: poiIds[0]!, addedBy: alice.id, position: 'a1' });
    cookieAlice = await sessionFor(admin, alice.id);
    cookieBob = await sessionFor(admin, bob.id);
  });

  afterAll(async () => {
    await ts.app.close();
    await admin.end();
  });

  function castVote(cookie: string, vote: 'up' | 'down') {
    return ts.app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/places/${placeId}/vote`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: { vote },
    });
  }

  it('records one vote per member and flips it on re-vote (upsert)', async () => {
    expect((await castVote(cookieAlice, 'up')).statusCode).toBe(200);
    const second = await castVote(cookieAlice, 'down');
    expect(second.statusCode).toBe(200);
    expect((second.json() as { vote: string }).vote).toBe('down');

    // A single row remains, flipped to the latest value.
    const raw = await admin.query<{ vote: string }>(
      `SELECT vote FROM place_votes WHERE trip_place_id = $1 AND user_id = $2`,
      [placeId, alice.id],
    );
    expect(raw.rows).toHaveLength(1);
    expect(raw.rows[0]!.vote).toBe('down');
  });

  it('a viewer cannot vote (editor-only)', async () => {
    const carol = await seedUser(admin, 'carol@example.com');
    await admin.query(`INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'viewer')`, [
      tripId,
      carol.id,
    ]);
    const cookieCarol = await sessionFor(admin, carol.id);
    const res = await castVote(cookieCarol, 'up');
    expect(res.statusCode).toBe(403);
    // Nothing was written.
    const raw = await admin.query(`SELECT 1 FROM place_votes WHERE user_id = $1`, [carol.id]);
    expect(raw.rowCount).toBe(0);
  });

  it('place_vote_counts returns aggregates; raw rows stay self-only under RLS', async () => {
    expect((await castVote(cookieAlice, 'up')).statusCode).toBe(200);
    expect((await castVote(cookieBob, 'down')).statusCode).toBe(200);

    // Aggregate reader (the only sanctioned disclosure): counts + member_count.
    const counts = await withUserContext(ts.pools.appPool, bob.id, (client) =>
      getVoteCounts(client, placeId),
    );
    expect(counts).toEqual({ up: 1, down: 1, member_count: 2 });

    // Each member's raw view is their OWN row only — never the other's.
    const aliceRows = await withUserContext(ts.pools.appPool, alice.id, async (client) =>
      (await client.query<{ user_id: string }>(`SELECT user_id FROM place_votes`)).rows,
    );
    expect(aliceRows).toEqual([{ user_id: alice.id }]);
    const bobRows = await withUserContext(ts.pools.appPool, bob.id, async (client) =>
      (await client.query<{ user_id: string }>(`SELECT user_id FROM place_votes`)).rows,
    );
    expect(bobRows).toEqual([{ user_id: bob.id }]);

    // Tripwire: both rows really exist (the hiding is RLS, not missing data).
    const raw = await admin.query(`SELECT 1 FROM place_votes WHERE trip_place_id = $1`, [placeId]);
    expect(raw.rowCount).toBe(2);
  });

  it("name-leak guard: a voter's id never surfaces beyond attributed actions (AC4)", async () => {
    // Alice votes; Bob (owner) then reads every trip-scoped GET he can reach.
    expect((await castVote(cookieAlice, 'up')).statusCode).toBe(200);

    async function body(url: string): Promise<string> {
      const res = await ts.app.inject({ method: 'GET', url, headers: { cookie: cookieBob } });
      expect(res.statusCode).toBe(200);
      return res.body;
    }

    const tripsList = await body('/api/trips');
    const trip = await body(`/api/trips/${tripId}`);
    const members = await body(`/api/trips/${tripId}/members`);
    const cities = await body(`/api/trips/${tripId}/cities`);
    const places = await body(`/api/trips/${tripId}/places`);
    const invites = await body(`/api/trips/${tripId}/invites`);

    // ALLOWED: Alice's id appears where a collaboration action is attributed —
    // her membership row and the place she added (added_by).
    expect(members).toContain(alice.id);
    expect(places).toContain(alice.id);

    // FORBIDDEN: it appears nowhere else. In particular no endpoint discloses her
    // vote or associates her id with one — there is no vote-bearing GET at all.
    expect(tripsList).not.toContain(alice.id); // trips carry owner_id (Bob) only
    expect(trip).not.toContain(alice.id);
    expect(cities).not.toContain(alice.id);
    expect(invites).not.toContain(alice.id);

    // And Bob, though owner, still cannot read Alice's raw vote row.
    const bobSeesAliceVote = await withUserContext(ts.pools.appPool, bob.id, async (client) =>
      (await client.query(`SELECT 1 FROM place_votes WHERE user_id = $1`, [alice.id])).rowCount,
    );
    expect(bobSeesAliceVote).toBe(0);
  });
});

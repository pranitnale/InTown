import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
// channels.ts is not re-exported from @intown/contracts/api's barrel, so import the
// frozen broadcast schema directly by path (vitest/vite resolves the .ts).
import { TripBroadcast } from '../../../contracts/api/channels.ts';
import { rebalanceTripCity } from '../src/ordering/fractional.ts';
import {
  adminUrl,
  createAdminPool,
  resetTables,
  seedCityAndPoi,
  seedTrip,
  seedTwoUsers,
  type SeededUser,
} from './helpers/db.ts';

/**
 * P06 AC6 (DB half) — the 0014 Broadcast-from-Database triggers. Each trips-domain
 * write must enqueue a `trip:{id}` message via realtime.send whose payload matches
 * the FROZEN contract (contracts/api/channels.ts), and a place UPDATE must carry only
 * the columns that actually changed (per-column LWW — the untouched column is null).
 *
 * This asserts the DB side of the pipeline (payload correctness in realtime.messages);
 * the websocket fan-out + Presence + two-client LWW is proven by
 * backend/scripts/realtime-two-client-demo.mjs. When realtime.send is absent (bare
 * Postgres / CI), intown_broadcast no-ops, so the suite SKIPS with a clear notice.
 */

/** Detect the realtime.send wrapper the triggers depend on (top-level, once). */
async function realtimeSendAvailable(): Promise<boolean> {
  const client = new pg.Client({ connectionString: adminUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{ send: string | null }>(
      `SELECT to_regprocedure('realtime.send(jsonb,text,text,boolean)')::text AS send`,
    );
    return rows[0]?.send != null;
  } finally {
    await client.end();
  }
}

const hasRealtimeSend = await realtimeSendAvailable();
const suite = hasRealtimeSend ? describe : describe.skip;
if (!hasRealtimeSend) {
  console.warn(
    '[realtime.broadcast.test] SKIPPED — realtime.send() is absent in this database ' +
      '(no Supabase Realtime container / bare Postgres). intown_broadcast no-ops here.',
  );
}

suite('realtime broadcast triggers (AC6, DB side)', () => {
  const admin = createAdminPool();
  let alice: SeededUser;
  let bob: SeededUser;
  let tripId: string;
  let tripCityId: string;
  let poiIds: string[];
  let topic: string;

  beforeEach(async () => {
    await resetTables(admin);
    ({ a: alice, b: bob } = await seedTwoUsers(admin));
    const city = await seedCityAndPoi(admin, 2);
    poiIds = city.poiIds;
    ({ tripId, tripCityId } = await seedTrip(admin, {
      ownerId: bob.id,
      members: [{ userId: alice.id, role: 'editor' }],
      cityId: city.cityId,
    }) as { tripId: string; tripCityId: string });
    topic = `trip:${tripId}`;
  });

  afterAll(async () => {
    await admin.end();
  });

  /** Run a write attributed to `userId` (sets the GUC the triggers read). */
  async function attributedWrite(userId: string, sql: string, params: unknown[]): Promise<void> {
    const client = await admin.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
      await client.query(sql, params);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** All broadcast payloads for this trip's topic and event, oldest first. */
  async function broadcastRows(event: string): Promise<Array<{ payload: unknown; private: boolean }>> {
    const { rows } = await admin.query<{ payload: unknown; private: boolean }>(
      `SELECT payload, private FROM realtime.messages
        WHERE topic = $1 AND event = $2
        ORDER BY inserted_at, id`,
      [topic, event],
    );
    return rows;
  }

  async function broadcasts(event: string): Promise<unknown[]> {
    return (await broadcastRows(event)).map((row) => row.payload);
  }

  async function addPlace(userId: string, poiId: string, position: string): Promise<string> {
    const { rows } = await admin.query<{ id: string }>(
      `INSERT INTO trip_places (trip_city_id, poi_id, position, state, added_by)
       VALUES ($1, $2, $3, 'suggested', $4) RETURNING id`,
      [tripCityId, poiId, position, userId],
    );
    return rows[0]!.id;
  }

  it('member INSERT broadcasts a zod-valid member_joined on trip:<id>', async () => {
    // seedTrip already inserted the owner + editor rows, firing member_joined.
    const payloads = await broadcasts('member_joined');
    expect(payloads.length).toBeGreaterThanOrEqual(2);
    for (const p of payloads) {
      const parsed = TripBroadcast.safeParse(p);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect((p as { type: string }).type).toBe('member_joined');
    }
    const userIds = payloads.map((p) => (p as { user_id: string }).user_id);
    expect(userIds).toContain(bob.id);
    expect(userIds).toContain(alice.id);
  });

  it('place INSERT broadcasts a zod-valid place_added carrying the row fields', async () => {
    const placeId = await addPlace(alice.id, poiIds[0]!, 'a1');
    const [payload] = await broadcasts('place_added');
    const parsed = TripBroadcast.safeParse(payload);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(payload).toMatchObject({
      type: 'place_added',
      trip_place_id: placeId,
      trip_city_id: tripCityId,
      poi_id: poiIds[0],
      position: 'a1',
      state: 'suggested',
      added_by: alice.id,
      version: 1,
    });
    expect((await broadcastRows('place_added'))[0]!.private).toBe(true);
  });

  it('a position-only UPDATE broadcasts position set, state null (per-column LWW)', async () => {
    const placeId = await addPlace(alice.id, poiIds[0]!, 'a1');
    await attributedWrite(bob.id, `UPDATE trip_places SET position = 'a2' WHERE id = $1`, [placeId]);

    const [payload] = await broadcasts('place_updated');
    const parsed = TripBroadcast.safeParse(payload);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(payload).toMatchObject({
      type: 'place_updated',
      trip_place_id: placeId,
      position: 'a2',
      state: null, // untouched column → null on the wire
      updated_by: bob.id,
      version: 2,
    });
  });

  it('a state-only UPDATE broadcasts state set, position null (per-column LWW)', async () => {
    const placeId = await addPlace(alice.id, poiIds[0]!, 'a1');
    await attributedWrite(alice.id, `UPDATE trip_places SET state = 'must_do' WHERE id = $1`, [placeId]);

    const [payload] = await broadcasts('place_updated');
    const parsed = TripBroadcast.safeParse(payload);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(payload).toMatchObject({
      type: 'place_updated',
      trip_place_id: placeId,
      position: null, // untouched column → null on the wire
      state: 'must_do',
      updated_by: alice.id,
      version: 2,
    });
  });

  it('a DELETE broadcasts a zod-valid place_removed attributed to the actor', async () => {
    const placeId = await addPlace(alice.id, poiIds[0]!, 'a1');
    await attributedWrite(bob.id, `DELETE FROM trip_places WHERE id = $1`, [placeId]);

    const [payload] = await broadcasts('place_removed');
    const parsed = TripBroadcast.safeParse(payload);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(payload).toMatchObject({
      type: 'place_removed',
      trip_place_id: placeId,
      removed_by: bob.id,
      version: 2,
    });
  });

  it('vote changes broadcast only aggregate tallies (never user_id or a per-user vote)', async () => {
    const placeId = await addPlace(alice.id, poiIds[0]!, 'a1');
    // INSERT emits a tally; the votePlace upsert flips it via
    // ON CONFLICT DO UPDATE, which is an UPDATE — the 0014 trigger fires on both.
    await attributedWrite(
      alice.id,
      `INSERT INTO place_votes (trip_place_id, user_id, vote) VALUES ($1, $2, 'up')`,
      [placeId, alice.id],
    );
    await attributedWrite(
      alice.id,
      `INSERT INTO place_votes (trip_place_id, user_id, vote) VALUES ($1, $2, 'down')
         ON CONFLICT (trip_place_id, user_id) DO UPDATE SET vote = EXCLUDED.vote`,
      [placeId, alice.id],
    );

    const payloads = await broadcasts('vote_tally_updated');
    expect(payloads.length).toBe(2);
    for (const p of payloads) {
      const parsed = TripBroadcast.safeParse(p);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(p).toMatchObject({
        type: 'vote_tally_updated',
        trip_place_id: placeId,
        member_count: 2,
      });
      expect(p).not.toHaveProperty('user_id');
      expect(p).not.toHaveProperty('vote');
    }
    expect(payloads[0]).toMatchObject({ up: 1, down: 0 });
    expect(payloads[1]).toMatchObject({ up: 0, down: 1 });
  });

  it('same-row updates carry a strictly increasing version independent of timestamps', async () => {
    const placeId = await addPlace(alice.id, poiIds[0]!, 'a1');
    await attributedWrite(alice.id, `UPDATE trip_places SET position = 'a2' WHERE id = $1`, [placeId]);
    await attributedWrite(bob.id, `UPDATE trip_places SET state = 'kept' WHERE id = $1`, [placeId]);

    const updates = (await broadcasts('place_updated')) as Array<{ version: number }>;
    expect(updates.map((payload) => payload.version)).toEqual([2, 3]);
    const { rows } = await admin.query<{ version: string }>(
      'SELECT version::text FROM trip_places WHERE id = $1',
      [placeId],
    );
    expect(Number(rows[0]!.version)).toBe(3);
  });

  it('a plan_revisions INSERT broadcasts a zod-valid plan_updated', async () => {
    const { rows } = await admin.query<{ id: string }>(
      `INSERT INTO plan_revisions (trip_city_id, revision_index, reason, created_by)
       VALUES ($1, 0, 'initial', $2) RETURNING id`,
      [tripCityId, alice.id],
    );
    const revisionId = rows[0]!.id;

    const [payload] = await broadcasts('plan_updated');
    const parsed = TripBroadcast.safeParse(payload);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(payload).toMatchObject({
      type: 'plan_updated',
      trip_city_id: tripCityId,
      plan_revision_id: revisionId,
      reason: 'initial',
    });
  });

  it('a rebalance emits NO sentinel (~) position broadcasts (only durable keys)', async () => {
    // Two places on pathologically long keys — the input to a rebalance. The rebalance
    // parks each on a '~'||id sentinel, then rewrites the durable keys. The trigger
    // must suppress the sentinel park writes and broadcast only the durable rewrites.
    const p1 = await addPlace(alice.id, poiIds[0]!, '1'.repeat(46));
    const p2 = await addPlace(alice.id, poiIds[1]!, '2'.repeat(46));

    const client = await admin.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', bob.id]);
      await rebalanceTripCity(client, tripCityId);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updates = await broadcasts('place_updated');
    // The durable rewrites still broadcast (one per row); the sentinel parks do not.
    expect(updates.length).toBe(2);
    const updatedIds = new Set(updates.map((p) => (p as { trip_place_id: string }).trip_place_id));
    expect(updatedIds).toEqual(new Set([p1, p2]));
    for (const p of updates) {
      const parsed = TripBroadcast.safeParse(p);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      const pos = (p as { position: string | null }).position;
      expect(pos).not.toBeNull();
      expect(pos!.startsWith('~')).toBe(false);
    }
  });
});

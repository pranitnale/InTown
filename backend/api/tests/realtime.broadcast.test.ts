import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
// channels.ts is not re-exported from @intown/contracts/api's barrel, so import the
// frozen broadcast schema directly by path (vitest/vite resolves the .ts).
import { TripBroadcast } from '../../../contracts/api/channels.ts';
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
  async function broadcasts(event: string): Promise<unknown[]> {
    const { rows } = await admin.query<{ payload: unknown }>(
      `SELECT payload FROM realtime.messages
        WHERE topic = $1 AND event = $2
        ORDER BY inserted_at, id`,
      [topic, event],
    );
    return rows.map((r) => r.payload);
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
    });
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
    });
  });

  it('a DELETE broadcasts a zod-valid place_removed attributed to the actor', async () => {
    const placeId = await addPlace(alice.id, poiIds[0]!, 'a1');
    await attributedWrite(bob.id, `DELETE FROM trip_places WHERE id = $1`, [placeId]);

    const [payload] = await broadcasts('place_removed');
    const parsed = TripBroadcast.safeParse(payload);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(payload).toMatchObject({ type: 'place_removed', trip_place_id: placeId, removed_by: bob.id });
  });
});

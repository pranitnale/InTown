import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withUserContext } from '../src/auth/session.ts';
import { REBALANCE_THRESHOLD, rebalanceTripCity } from '../src/ordering/fractional.ts';
import {
  createAdminPool,
  makeTestServer,
  resetTables,
  seedCityAndPoi,
  seedPlace,
  seedTrip,
  seedTwoUsers,
  sessionFor,
  type SeededUser,
  type TestServer,
} from './helpers/db.ts';

/**
 * P06 AC5 (DB half) — fractional ordering on the curation list:
 *  - a patch rewrites ONLY the moved row (siblings' xmin/updated_at untouched);
 *  - a colliding position on the unique backstop is retried once with jitter;
 *  - `rebalanceTripCity` shortens keys while preserving order.
 * The pure key algebra lives in fractional.test.ts.
 */
describe('curation ordering (AC5)', () => {
  const admin = createAdminPool();
  let ts: TestServer;
  let owner: SeededUser;
  let editor: SeededUser;
  let cookieEditor: string;
  let tripId: string;
  let tripCityId: string;
  let poiIds: string[];

  beforeAll(() => {
    ts = makeTestServer();
  });

  beforeEach(async () => {
    await resetTables(admin);
    ({ a: owner, b: editor } = await seedTwoUsers(admin));
    const city = await seedCityAndPoi(admin, 5);
    poiIds = city.poiIds;
    ({ tripId, tripCityId } = await seedTrip(admin, {
      ownerId: owner.id,
      members: [{ userId: editor.id, role: 'editor' }],
      cityId: city.cityId,
    }) as { tripId: string; tripCityId: string });
    cookieEditor = await sessionFor(admin, editor.id);
  });

  afterAll(async () => {
    await ts.app.close();
    await admin.end();
  });

  interface RowMeta {
    id: string;
    xmin: string;
    updated_at: string;
    position: string;
  }
  async function snapshot(): Promise<Map<string, RowMeta>> {
    const { rows } = await admin.query<RowMeta>(
      `SELECT id, xmin::text AS xmin, updated_at::text AS updated_at, position
         FROM trip_places WHERE trip_city_id = $1`,
      [tripCityId],
    );
    return new Map(rows.map((r) => [r.id, r]));
  }

  it('a patch rewrites only the moved row; siblings are byte-for-byte unchanged', async () => {
    const p1 = await seedPlace(admin, { tripCityId, poiId: poiIds[0]!, addedBy: editor.id, position: 'a1' });
    const p2 = await seedPlace(admin, { tripCityId, poiId: poiIds[1]!, addedBy: editor.id, position: 'a2' });
    const p3 = await seedPlace(admin, { tripCityId, poiId: poiIds[2]!, addedBy: editor.id, position: 'a3' });

    const before = await snapshot();

    // Move p2 to a key between a1 and a2.
    const res = await ts.app.inject({
      method: 'PATCH',
      url: `/api/trips/${tripId}/places/${p2}`,
      headers: { cookie: cookieEditor, 'content-type': 'application/json' },
      payload: { position: 'a15' },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { position: string }).position).toBe('a15');

    const after = await snapshot();
    // The two siblings' row versions (xmin) and updated_at did not move.
    for (const id of [p1, p3]) {
      expect(after.get(id)!.xmin).toBe(before.get(id)!.xmin);
      expect(after.get(id)!.updated_at).toBe(before.get(id)!.updated_at);
      expect(after.get(id)!.position).toBe(before.get(id)!.position);
    }
    // The moved row changed.
    expect(after.get(p2)!.xmin).not.toBe(before.get(p2)!.xmin);
    expect(after.get(p2)!.position).toBe('a15');
  });

  it('a position that collides with a sibling is retried once with jitter', async () => {
    const p1 = await seedPlace(admin, { tripCityId, poiId: poiIds[0]!, addedBy: editor.id, position: 'a1' });
    const p2 = await seedPlace(admin, { tripCityId, poiId: poiIds[1]!, addedBy: editor.id, position: 'a5' });

    // Ask to move p2 onto p1's exact key — the unique backstop (0013) rejects it,
    // and the handler retries with a jittered variant that sorts just after 'a1'.
    const res = await ts.app.inject({
      method: 'PATCH',
      url: `/api/trips/${tripId}/places/${p2}`,
      headers: { cookie: cookieEditor, 'content-type': 'application/json' },
      payload: { position: 'a1' },
    });
    expect(res.statusCode).toBe(200);
    const newPos = (res.json() as { position: string }).position;
    expect(newPos).not.toBe('a1'); // it was jittered off the clash
    expect(newPos.startsWith('a1')).toBe(true); // …but still lands just after a1
    expect(newPos.length).toBeGreaterThan(2);

    // p1 kept its key; both rows still exist and are distinct.
    const rows = await admin.query<{ id: string; position: string }>(
      `SELECT id, position FROM trip_places WHERE trip_city_id = $1 ORDER BY position COLLATE "C"`,
      [tripCityId],
    );
    expect(rows.rows.find((r) => r.id === p1)!.position).toBe('a1');
    expect(rows.rows).toHaveLength(2);
  });

  it('rebalanceTripCity shortens long keys while preserving order (AC5)', async () => {
    // Four places with pathologically long (>40 char) keys, ascending.
    const longKeys = ['1'.repeat(46), '2'.repeat(46), '3'.repeat(46), '4'.repeat(46)];
    const ids: string[] = [];
    for (let i = 0; i < longKeys.length; i += 1) {
      ids.push(await seedPlace(admin, { tripCityId, poiId: poiIds[i]!, addedBy: editor.id, position: longKeys[i] }));
    }

    const orderBefore = (
      await admin.query<{ id: string }>(
        `SELECT id FROM trip_places WHERE trip_city_id = $1 ORDER BY position COLLATE "C", id`,
        [tripCityId],
      )
    ).rows.map((r) => r.id);

    await withUserContext(ts.pools.appPool, editor.id, (client) => rebalanceTripCity(client, tripCityId));

    const after = (
      await admin.query<{ id: string; position: string }>(
        `SELECT id, position FROM trip_places WHERE trip_city_id = $1 ORDER BY position COLLATE "C", id`,
        [tripCityId],
      )
    ).rows;
    // Order preserved…
    expect(after.map((r) => r.id)).toEqual(orderBefore);
    // …and every key is now short and unique.
    for (const r of after) expect(r.position.length).toBeLessThanOrEqual(4);
    expect(new Set(after.map((r) => r.position)).size).toBe(after.length);
  });

  it('rebalance parks only its snapshot ids, leaving a concurrent insert un-corrupted', async () => {
    // Four rows with long keys, ascending — the input to a rebalance.
    const longKeys = ['1'.repeat(46), '2'.repeat(46), '3'.repeat(46), '4'.repeat(46)];
    for (let i = 0; i < longKeys.length; i += 1) {
      await seedPlace(admin, { tripCityId, poiId: poiIds[i]!, addedBy: editor.id, position: longKeys[i] });
    }

    // Simulate the concurrency window: a separate, committed request inserts a row
    // AFTER rebalance's snapshot SELECT but BEFORE its park UPDATE. Under READ
    // COMMITTED the park sees this row; parking it (old `WHERE trip_city_id`) would
    // strand it on a '~' value the final keyed UPDATE never rewrites.
    await withUserContext(ts.pools.appPool, editor.id, async (realClient) => {
      let injected = false;
      const client = new Proxy(realClient, {
        get(target, prop, receiver) {
          if (prop === 'query') {
            return async (...args: unknown[]): Promise<unknown> => {
              const res = await (target.query as (...a: unknown[]) => Promise<unknown>)(...args);
              const first = args[0];
              const sql = typeof first === 'string' ? first : (first as { text?: string } | undefined)?.text;
              if (!injected && sql?.includes('SELECT id FROM trip_places')) {
                injected = true;
                await admin.query(
                  `INSERT INTO trip_places (trip_city_id, poi_id, position, added_by)
                   VALUES ($1, $2, $3, $4)`,
                  [tripCityId, poiIds[4]!, 'z9', editor.id],
                );
              }
              return res;
            };
          }
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      await rebalanceTripCity(client, tripCityId);
    });

    // No row is left on an out-of-alphabet '~' position — the concurrent insert kept
    // its real key, and every original row got a fresh short key.
    const rows = (
      await admin.query<{ position: string }>(
        `SELECT position FROM trip_places WHERE trip_city_id = $1`,
        [tripCityId],
      )
    ).rows;
    expect(rows).toHaveLength(5);
    for (const r of rows) expect(r.position.startsWith('~')).toBe(false);
    // …and the concurrently-inserted row is untouched.
    expect(rows.some((r) => r.position === 'z9')).toBe(true);
  });

  it('an add with an overlong client position rebalances instead of 500ing', async () => {
    await seedPlace(admin, { tripCityId, poiId: poiIds[0]!, addedBy: editor.id, position: 'a1' });

    // A legal key (all base62, no trailing '0') but far past the btree index-row
    // byte limit: the raw INSERT would raise SQLSTATE 54000 → unhandled 500. The
    // backstop must rebalance and append a short key instead.
    const overlong = 'a'.repeat(3000);
    const res = await ts.app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/places`,
      headers: { cookie: cookieEditor, 'content-type': 'application/json' },
      payload: { trip_city_id: tripCityId, poi_id: poiIds[1]!, position: overlong },
    });
    expect(res.statusCode).toBe(200);
    const pos = (res.json() as { position: string }).position;
    expect(pos).not.toBe(overlong);
    expect(pos.length).toBeLessThanOrEqual(REBALANCE_THRESHOLD); // short — rebalanced + appended
    expect(pos.endsWith('0')).toBe(false);

    // Both rows persisted, distinct, and neither is the overlong key.
    const rows = (
      await admin.query<{ position: string }>(
        `SELECT position FROM trip_places WHERE trip_city_id = $1 ORDER BY position COLLATE "C"`,
        [tripCityId],
      )
    ).rows;
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.position.length).toBeLessThanOrEqual(REBALANCE_THRESHOLD);
  });

  it('an add with an omitted position appends a valid jittered key after the last', async () => {
    await seedPlace(admin, { tripCityId, poiId: poiIds[0]!, addedBy: editor.id, position: 'a1' });

    const res = await ts.app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/places`,
      headers: { cookie: cookieEditor, 'content-type': 'application/json' },
      payload: { trip_city_id: tripCityId, poi_id: poiIds[1]! },
    });
    expect(res.statusCode).toBe(200);
    const pos = (res.json() as { position: string }).position;
    expect(pos > 'a1').toBe(true); // appended after the current last
    expect(pos.endsWith('0')).toBe(false); // jitter never leaves a trailing minimum digit
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withUserContext } from '../src/auth/session.ts';
import { rebalanceTripCity } from '../src/ordering/fractional.ts';
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

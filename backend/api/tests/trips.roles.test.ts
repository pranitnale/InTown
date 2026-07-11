import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createAdminPool,
  makeTestServer,
  resetTables,
  seedCityAndPoi,
  seedTrip,
  seedTwoUsers,
  seedUser,
  sessionFor,
  type SeededUser,
  type TestServer,
} from './helpers/db.ts';

/**
 * P06 AC2 — Owner/Editor/Viewer enforcement across the trips routes:
 *  - a Viewer (member, read-only) is 403'd on every city write;
 *  - an Editor may write cities but is 403'd on owner-only actions
 *    (updateMember, createInvite, delete trip);
 *  - the Owner may perform those owner-only actions.
 */
describe('trip role enforcement (AC2)', () => {
  const admin = createAdminPool();
  let ts: TestServer;
  let owner: SeededUser;
  let editor: SeededUser;
  let viewer: SeededUser;
  let cookieOwner: string;
  let cookieEditor: string;
  let cookieViewer: string;
  let tripId: string;
  let tripCityId: string;
  let cityId: string;

  beforeAll(() => {
    ts = makeTestServer();
  });

  beforeEach(async () => {
    await resetTables(admin);
    ({ a: owner, b: editor } = await seedTwoUsers(admin));
    viewer = await seedUser(admin, 'carol@example.com');
    ({ cityId } = await seedCityAndPoi(admin));
    ({ tripId, tripCityId } = await seedTrip(admin, {
      ownerId: owner.id,
      members: [{ userId: editor.id, role: 'editor' }, { userId: viewer.id, role: 'viewer' }],
      cityId,
    }) as { tripId: string; tripCityId: string });

    cookieOwner = await sessionFor(admin, owner.id);
    cookieEditor = await sessionFor(admin, editor.id);
    cookieViewer = await sessionFor(admin, viewer.id);
  });

  afterAll(async () => {
    await ts.app.close();
    await admin.end();
  });

  const newCityBody = (ord: number) => ({
    city_id: cityId,
    ord,
    arrive: '2026-03-01',
    depart: '2026-03-02',
  });

  // --- Viewer: read yes, write no -----------------------------------------

  it('a viewer can read the trip but is 403 on every city write', async () => {
    const read = await ts.app.inject({ method: 'GET', url: `/api/trips/${tripId}/cities`, headers: { cookie: cookieViewer } });
    expect(read.statusCode).toBe(200);

    const add = await ts.app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/cities`,
      headers: { cookie: cookieViewer, 'content-type': 'application/json' },
      payload: newCityBody(1),
    });
    expect(add.statusCode).toBe(403);

    const patch = await ts.app.inject({
      method: 'PATCH',
      url: `/api/trips/${tripId}/cities/${tripCityId}`,
      headers: { cookie: cookieViewer, 'content-type': 'application/json' },
      payload: { depart: '2026-03-05' },
    });
    expect(patch.statusCode).toBe(403);

    const del = await ts.app.inject({
      method: 'DELETE',
      url: `/api/trips/${tripId}/cities/${tripCityId}`,
      headers: { cookie: cookieViewer },
    });
    expect(del.statusCode).toBe(403);
  });

  // --- Editor: writes cities, but not owner-only actions -------------------

  it('an editor can write cities', async () => {
    const add = await ts.app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/cities`,
      headers: { cookie: cookieEditor, 'content-type': 'application/json' },
      payload: newCityBody(1),
    });
    expect(add.statusCode).toBe(200);
    expect(add.json()).toMatchObject({ trip_id: tripId, ord: 1 });

    const patch = await ts.app.inject({
      method: 'PATCH',
      url: `/api/trips/${tripId}/cities/${tripCityId}`,
      headers: { cookie: cookieEditor, 'content-type': 'application/json' },
      payload: { depart: '2026-03-05' },
    });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { depart: string }).depart).toBe('2026-03-05');
  });

  it('an editor is 403 on owner-only actions (updateMember, createInvite, delete)', async () => {
    const promote = await ts.app.inject({
      method: 'PATCH',
      url: `/api/trips/${tripId}/members/${viewer.id}`,
      headers: { cookie: cookieEditor, 'content-type': 'application/json' },
      payload: { role: 'editor' },
    });
    expect(promote.statusCode).toBe(403);

    const invite = await ts.app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/invites`,
      headers: { cookie: cookieEditor, 'content-type': 'application/json' },
      payload: { role: 'viewer', expires_at: '2027-01-01T00:00:00Z' },
    });
    expect(invite.statusCode).toBe(403);

    const del = await ts.app.inject({ method: 'DELETE', url: `/api/trips/${tripId}`, headers: { cookie: cookieEditor } });
    expect(del.statusCode).toBe(403);
  });

  // --- Owner: full control -------------------------------------------------

  it('the owner can manage members and invites', async () => {
    const promote = await ts.app.inject({
      method: 'PATCH',
      url: `/api/trips/${tripId}/members/${viewer.id}`,
      headers: { cookie: cookieOwner, 'content-type': 'application/json' },
      payload: { role: 'editor' },
    });
    expect(promote.statusCode).toBe(200);
    expect((promote.json() as { role: string }).role).toBe('editor');

    const invite = await ts.app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/invites`,
      headers: { cookie: cookieOwner, 'content-type': 'application/json' },
      payload: { role: 'viewer', expires_at: '2027-01-01T00:00:00Z' },
    });
    expect(invite.statusCode).toBe(200);
    expect((invite.json() as { role: string; code: string }).role).toBe('viewer');
    expect((invite.json() as { code: string }).code).toHaveLength(22);
  });
});

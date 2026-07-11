import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createAdminPool,
  makeTestServer,
  resetTables,
  seedTrip,
  seedTwoUsers,
  seedUser,
  sessionFor,
  type SeededUser,
  type TestServer,
} from './helpers/db.ts';

/**
 * P06 AC1 — trips CRUD + ownership transfer, all behind the RLS-scoped routes
 * and authenticated by a seeded session cookie. Also asserts a non-member is
 * blocked (RLS + the `member` auth level), and that transfer swaps
 * `trips.owner_id` while demoting the previous owner to `editor` in lockstep
 * (the owner_id ⇔ owner-membership invariant).
 */
describe('trips CRUD + ownership transfer (AC1)', () => {
  const admin = createAdminPool();
  let ts: TestServer;
  let alice: SeededUser;
  let bob: SeededUser;
  let cookieAlice: string;
  let cookieBob: string;

  beforeAll(() => {
    ts = makeTestServer();
  });

  beforeEach(async () => {
    await resetTables(admin);
    ({ a: alice, b: bob } = await seedTwoUsers(admin));
    cookieAlice = await sessionFor(admin, alice.id);
    cookieBob = await sessionFor(admin, bob.id);
  });

  afterAll(async () => {
    await ts.app.close();
    await admin.end();
  });

  async function createTrip(cookie: string, name = 'Roman Holiday'): Promise<string> {
    const res = await ts.app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { name },
    });
    expect(res.statusCode).toBe(200);
    return (res.json() as { id: string }).id;
  }

  it('create makes the caller owner and inserts an owner membership row', async () => {
    const res = await ts.app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: cookieAlice, 'content-type': 'application/json' },
      payload: { name: 'Roman Holiday' },
    });
    expect(res.statusCode).toBe(200);
    const trip = res.json() as { id: string; owner_id: string; name: string };
    expect(trip.owner_id).toBe(alice.id);
    expect(trip.name).toBe('Roman Holiday');

    // The owner-is-always-a-member invariant: an 'owner' membership row exists.
    const { rows } = await admin.query<{ role: string }>(
      `SELECT role FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [trip.id, alice.id],
    );
    expect(rows[0]?.role).toBe('owner');
  });

  it('get + list return the caller’s own trips; update + delete work', async () => {
    const tripId = await createTrip(cookieAlice);

    const got = await ts.app.inject({ method: 'GET', url: `/api/trips/${tripId}`, headers: { cookie: cookieAlice } });
    expect(got.statusCode).toBe(200);
    expect((got.json() as { id: string }).id).toBe(tripId);

    const listed = await ts.app.inject({ method: 'GET', url: '/api/trips', headers: { cookie: cookieAlice } });
    expect(listed.statusCode).toBe(200);
    expect((listed.json() as Array<{ id: string }>).map((t) => t.id)).toContain(tripId);

    const patched = await ts.app.inject({
      method: 'PATCH',
      url: `/api/trips/${tripId}`,
      headers: { cookie: cookieAlice, 'content-type': 'application/json' },
      payload: { name: 'Tuscan Detour' },
    });
    expect(patched.statusCode).toBe(200);
    expect((patched.json() as { name: string }).name).toBe('Tuscan Detour');

    const deleted = await ts.app.inject({ method: 'DELETE', url: `/api/trips/${tripId}`, headers: { cookie: cookieAlice } });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ deleted: true });

    const gone = await ts.app.inject({ method: 'GET', url: `/api/trips/${tripId}`, headers: { cookie: cookieAlice } });
    // A deleted trip is no longer a membership → the `member` auth level 403s.
    expect(gone.statusCode).toBe(403);
  });

  it('a non-member is blocked from reading another user’s trip (403)', async () => {
    const tripId = await createTrip(cookieAlice);
    const res = await ts.app.inject({ method: 'GET', url: `/api/trips/${tripId}`, headers: { cookie: cookieBob } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
    // …and it does not appear in Bob's own list.
    const list = await ts.app.inject({ method: 'GET', url: '/api/trips', headers: { cookie: cookieBob } });
    expect((list.json() as Array<{ id: string }>).map((t) => t.id)).not.toContain(tripId);
  });

  it('ownership transfer swaps owner_id and demotes the previous owner to editor', async () => {
    const { tripId } = await seedTrip(admin, {
      ownerId: alice.id,
      members: [{ userId: bob.id, role: 'editor' }],
    });

    const res = await ts.app.inject({
      method: 'PATCH',
      url: `/api/trips/${tripId}/members/${bob.id}`,
      headers: { cookie: cookieAlice, 'content-type': 'application/json' },
      payload: { role: 'owner' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user_id: bob.id, role: 'owner' });

    // trips.owner_id now points to Bob…
    const trip = await admin.query<{ owner_id: string }>(`SELECT owner_id FROM trips WHERE id = $1`, [tripId]);
    expect(trip.rows[0]?.owner_id).toBe(bob.id);
    // …and Alice's membership was demoted to editor (invariant: exactly one owner).
    const roles = await admin.query<{ user_id: string; role: string }>(
      `SELECT user_id, role FROM trip_members WHERE trip_id = $1`,
      [tripId],
    );
    const byUser = Object.fromEntries(roles.rows.map((r) => [r.user_id, r.role]));
    expect(byUser[bob.id]).toBe('owner');
    expect(byUser[alice.id]).toBe('editor');
    expect(roles.rows.filter((r) => r.role === 'owner')).toHaveLength(1);

    // The former owner can no longer wield owner-only routes.
    const forbidden = await ts.app.inject({ method: 'DELETE', url: `/api/trips/${tripId}`, headers: { cookie: cookieAlice } });
    expect(forbidden.statusCode).toBe(403);
    // The new owner can.
    const ok = await ts.app.inject({ method: 'DELETE', url: `/api/trips/${tripId}`, headers: { cookie: cookieBob } });
    expect(ok.statusCode).toBe(200);
  });

  it('a member may leave (self removeMember); the owner cannot be removed', async () => {
    const stranger = await seedUser(admin, 'carol@example.com');
    const cookieCarol = await sessionFor(admin, stranger.id);
    const { tripId } = await seedTrip(admin, {
      ownerId: alice.id,
      members: [{ userId: bob.id, role: 'editor' }, { userId: stranger.id, role: 'viewer' }],
    });

    // Carol leaves by removing her own membership.
    const left = await ts.app.inject({
      method: 'DELETE',
      url: `/api/trips/${tripId}/members/${stranger.id}`,
      headers: { cookie: cookieCarol },
    });
    expect(left.statusCode).toBe(200);
    expect(left.json()).toEqual({ removed: true });

    // The current owner cannot be removed (even by the owner) — transfer first.
    const blocked = await ts.app.inject({
      method: 'DELETE',
      url: `/api/trips/${tripId}/members/${alice.id}`,
      headers: { cookie: cookieAlice },
    });
    expect(blocked.statusCode).toBe(400);

    // A non-owner cannot remove someone else.
    const cookieBobLocal = await sessionFor(admin, bob.id);
    const nope = await ts.app.inject({
      method: 'DELETE',
      url: `/api/trips/${tripId}/members/${alice.id}`,
      headers: { cookie: cookieBobLocal },
    });
    // Removing the owner is blocked before the role check (400).
    expect(nope.statusCode).toBe(400);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAdminPool, makeTestServer, resetTables, seedTwoUsers, type TestServer } from './helpers/db.ts';

/**
 * P04 AC1 + AC5 — user profile read/update and traveler-profile upsert, all
 * behind the RLS-scoped routes and authenticated by a seeded session cookie.
 * The traveler profile stores an AGE BAND (never a birthdate) and no coordinate.
 */
const SESSION_TOKEN = 'profile-test-session-token';
const COOKIE = `authjs.session-token=${SESSION_TOKEN}`;

describe('profile routes (AC1)', () => {
  const admin = createAdminPool();
  let ts: TestServer;
  let userAId: string;
  let userBId: string;

  beforeAll(() => {
    ts = makeTestServer();
  });

  beforeEach(async () => {
    await resetTables(admin);
    const { a, b } = await seedTwoUsers(admin);
    userAId = a.id;
    userBId = b.id;
    await admin.query(
      `INSERT INTO sessions (session_token, user_id, expires) VALUES ($1, $2, now() + interval '1 day')`,
      [SESSION_TOKEN, a.id],
    );
  });

  afterAll(async () => {
    await ts.app.close();
    await admin.end();
  });

  it('GET /api/profile returns the current user record', async () => {
    const res = await ts.app.inject({ method: 'GET', url: '/api/profile', headers: { cookie: COOKIE } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: userAId, email: 'alice@example.com', display_name: 'Alice' });
  });

  it('PATCH /api/profile updates only the sent fields', async () => {
    const res = await ts.app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: { display_name: 'Alice B.', handle: 'aliceb' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { display_name: string; handle: string; locale: string | null };
    expect(body.display_name).toBe('Alice B.');
    expect(body.handle).toBe('aliceb');
    expect(body.locale).toBeNull();
  });

  it('PATCH /api/profile with a handle another user holds returns 409, not 500', async () => {
    // Bob (invisible to Alice under RLS) already holds the handle; the UNIQUE
    // index on users.handle is enforced across ALL rows, so Alice's UPDATE
    // raises 23505 → the handler must map it to a 409.
    await admin.query(`UPDATE users SET handle = $1 WHERE id = $2`, ['taken-handle', userBId]);

    const res = await ts.app.inject({
      method: 'PATCH',
      url: '/api/profile',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: { handle: 'taken-handle' },
    });
    expect(res.statusCode).toBe(409);
    expect((res.json() as { error: string }).error).toBe('conflict');
  });

  it('traveler profile: absent → PUT upsert → GET returns it', async () => {
    const before = await ts.app.inject({
      method: 'GET',
      url: '/api/profile/traveler',
      headers: { cookie: COOKIE },
    });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toBeNull();

    const put = await ts.app.inject({
      method: 'PUT',
      url: '/api/profile/traveler',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: {
        age_band: '26-44',
        mobility: 'full',
        eu_residency: true,
        student: false,
        languages: ['en', 'de'],
        currency: 'EUR',
      },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toMatchObject({
      user_id: userAId,
      age_band: '26-44',
      mobility: 'full',
      eu_residency: true,
      student: false,
      languages: ['en', 'de'],
      currency: 'EUR',
    });
    // Data minimization: no birthdate / coordinate leaks onto the record.
    const keys = Object.keys(put.json() as Record<string, unknown>);
    expect(keys).not.toContain('birthdate');
    expect(keys).not.toContain('date_of_birth');
    expect(keys).not.toContain('lat');
    expect(keys).not.toContain('lng');

    const get = await ts.app.inject({
      method: 'GET',
      url: '/api/profile/traveler',
      headers: { cookie: COOKIE },
    });
    expect(get.json()).toMatchObject({ age_band: '26-44', currency: 'EUR' });
  });

  it('traveler profile: a second PUT updates in place (single row) and merges partial bodies', async () => {
    const first = await ts.app.inject({
      method: 'PUT',
      url: '/api/profile/traveler',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: {
        age_band: '26-44',
        mobility: 'full',
        eu_residency: true,
        student: false,
        languages: ['en'],
        currency: 'EUR',
      },
    });
    const firstId = (first.json() as { id: string }).id;

    // Partial body: only change mobility; the rest must be preserved.
    const second = await ts.app.inject({
      method: 'PUT',
      url: '/api/profile/traveler',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: { mobility: 'wheelchair' },
    });
    expect(second.statusCode).toBe(200);
    const body = second.json() as { id: string; mobility: string; currency: string; age_band: string };
    expect(body.id).toBe(firstId); // same row (upsert, not a new profile)
    expect(body.mobility).toBe('wheelchair');
    expect(body.currency).toBe('EUR'); // preserved
    expect(body.age_band).toBe('26-44'); // preserved
  });

  it('traveler profile: a partial body with no existing row is a 400 (cannot create partial)', async () => {
    const res = await ts.app.inject({
      method: 'PUT',
      url: '/api/profile/traveler',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: { mobility: 'full' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects unauthenticated requests with 401', async () => {
    expect((await ts.app.inject({ method: 'GET', url: '/api/profile' })).statusCode).toBe(401);
    expect((await ts.app.inject({ method: 'GET', url: '/api/profile/traveler' })).statusCode).toBe(401);
  });

  it('rejects an invalid traveler body with 400', async () => {
    const res = await ts.app.inject({
      method: 'PUT',
      url: '/api/profile/traveler',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: { age_band: 'not-a-band', mobility: 'full', eu_residency: true, student: false, currency: 'EUR' },
    });
    expect(res.statusCode).toBe(400);
  });
});

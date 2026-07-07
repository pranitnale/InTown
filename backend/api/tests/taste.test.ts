import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAdminPool, makeTestServer, resetTables, seedTwoUsers, type TestServer } from './helpers/db.ts';

/**
 * P04 AC2 + AC3 — taste profiles are versioned (a new PUT appends a version and
 * never loses history), and anti-preferences (soft) vs hard exclusions (veto)
 * are stored as distinct arrays.
 */
const SESSION_TOKEN = 'taste-test-session-token';
const COOKIE = `authjs.session-token=${SESSION_TOKEN}`;

const bodyV0 = {
  interests: ['art', 'food'],
  anti_preferences: ['crowds'],
  hard_exclusions: ['gambling'],
  dietary: ['vegetarian'],
  budget_tier: 'moderate',
  pace: 'relaxed',
};
const bodyV1 = {
  interests: ['food', 'art', 'history'],
  anti_preferences: ['crowds', 'nightlife'],
  hard_exclusions: ['gambling', 'zoos'],
  dietary: ['vegan'],
  budget_tier: 'comfort',
  pace: 'packed',
};

describe('taste profile versioning (AC2, AC3)', () => {
  const admin = createAdminPool();
  let ts: TestServer;
  let userAId: string;

  beforeAll(() => {
    ts = makeTestServer();
  });

  beforeEach(async () => {
    await resetTables(admin);
    const { a } = await seedTwoUsers(admin);
    userAId = a.id;
    await admin.query(
      `INSERT INTO sessions (session_token, user_id, expires) VALUES ($1, $2, now() + interval '1 day')`,
      [SESSION_TOKEN, a.id],
    );
  });

  afterAll(async () => {
    await ts.app.close();
    await admin.end();
  });

  const put = (payload: unknown) =>
    ts.app.inject({
      method: 'PUT',
      url: '/api/profile/taste',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: payload as Record<string, unknown>,
    });

  it('GET returns null before any taste profile exists', async () => {
    const res = await ts.app.inject({ method: 'GET', url: '/api/profile/taste', headers: { cookie: COOKIE } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
  });

  it('sequential PUTs create dense monotonic versions 0,1,2, preserving every row; GET returns the latest', async () => {
    const first = await put(bodyV0);
    expect(first.statusCode).toBe(200);
    expect((first.json() as { version: number }).version).toBe(0);

    const second = await put(bodyV1);
    expect(second.statusCode).toBe(200);
    expect((second.json() as { version: number }).version).toBe(1);

    // A third append advances the version again — the per-user advisory lock
    // keeps versions dense/monotonic under the serialized MAX+1 path.
    const third = await put(bodyV0);
    expect(third.statusCode).toBe(200);
    expect((third.json() as { version: number }).version).toBe(2);

    // History preserved: all three rows still exist (assert via the superuser pool).
    const rows = await admin.query<{ version: number }>(
      `SELECT version FROM taste_profiles WHERE user_id = $1 ORDER BY version ASC`,
      [userAId],
    );
    expect(rows.rows.map((r) => r.version)).toEqual([0, 1, 2]);

    // GET returns the latest version.
    const get = await ts.app.inject({ method: 'GET', url: '/api/profile/taste', headers: { cookie: COOKIE } });
    const latest = get.json() as { version: number; budget_tier: string; pace: string };
    expect(latest.version).toBe(2);
    expect(latest.budget_tier).toBe('moderate');
    expect(latest.pace).toBe('relaxed');
  });

  it('stores anti_preferences and hard_exclusions as distinct arrays (soft vs veto)', async () => {
    const res = await put(bodyV0);
    const body = res.json() as { anti_preferences: string[]; hard_exclusions: string[] };
    expect(body.anti_preferences).toEqual(['crowds']);
    expect(body.hard_exclusions).toEqual(['gambling']);
    // The two fields are independent — a tag in one is not implied by the other.
    expect(body.anti_preferences).not.toEqual(body.hard_exclusions);
  });

  it('preserves interest ranking order (array order is the ranking)', async () => {
    const res = await put(bodyV1);
    expect((res.json() as { interests: string[] }).interests).toEqual(['food', 'art', 'history']);
  });

  it('rejects unauthenticated requests with 401', async () => {
    expect((await ts.app.inject({ method: 'GET', url: '/api/profile/taste' })).statusCode).toBe(401);
  });

  it('rejects an invalid body with 400', async () => {
    const res = await put({ ...bodyV0, budget_tier: 'not-a-tier' });
    expect(res.statusCode).toBe(400);
  });
});

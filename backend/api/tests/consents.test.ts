import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAdminPool, makeTestServer, resetTables, seedTwoUsers, type TestServer } from './helpers/db.ts';

/**
 * AC6 — consent flag can be written and read back (through the RLS-scoped
 * consent routes, authenticated by a seeded session cookie).
 */
const SESSION_TOKEN = 'consent-test-session-token';
const COOKIE = `authjs.session-token=${SESSION_TOKEN}`;

describe('consents write/read (AC6)', () => {
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

  it('writes a consent and reads it back', async () => {
    const put = await ts.app.inject({
      method: 'PUT',
      url: '/api/consents',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: { consent_type: 'personalization_learning', granted: true, policy_version: '2026-01' },
    });
    expect(put.statusCode).toBe(200);
    const written = put.json();
    expect(written).toMatchObject({
      user_id: userAId,
      consent_type: 'personalization_learning',
      granted: true,
      policy_version: '2026-01',
      revoked_at: null,
    });

    const get = await ts.app.inject({
      method: 'GET',
      url: '/api/consents',
      headers: { cookie: COOKIE },
    });
    expect(get.statusCode).toBe(200);
    const list = get.json() as Array<{ consent_type: string; granted: boolean }>;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ consent_type: 'personalization_learning', granted: true });
  });

  it('records a revocation (granted=false sets revoked_at)', async () => {
    const res = await ts.app.inject({
      method: 'PUT',
      url: '/api/consents',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: { consent_type: 'marketing', granted: false, policy_version: '2026-01' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { granted: boolean; revoked_at: string | null };
    expect(body.granted).toBe(false);
    expect(body.revoked_at).not.toBeNull();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await ts.app.inject({ method: 'GET', url: '/api/consents' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an invalid body with 400', async () => {
    const res = await ts.app.inject({
      method: 'PUT',
      url: '/api/consents',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: { consent_type: 'not_a_real_type', granted: true, policy_version: 'v1' },
    });
    expect(res.statusCode).toBe(400);
  });
});

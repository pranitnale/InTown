import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAdminPool, makeTestServer, resetTables, seedTwoUsers, type TestServer } from './helpers/db.ts';
import { revokeAllSessions, revokeSession } from '../src/auth/session.ts';

/**
 * AC2 — a session can be revoked server-side and the next request with that
 * cookie is rejected.
 */
const TOKEN = 'revoke-test-session-token';
const COOKIE = `authjs.session-token=${TOKEN}`;

async function seedSession(admin: ReturnType<typeof createAdminPool>, userId: string): Promise<void> {
  await admin.query(
    `INSERT INTO sessions (session_token, user_id, expires) VALUES ($1, $2, now() + interval '1 day')`,
    [TOKEN, userId],
  );
}

describe('session revocation (AC2)', () => {
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
    await seedSession(admin, a.id);
  });

  afterAll(async () => {
    await ts.app.close();
    await admin.end();
  });

  it('accepts the cookie before revocation, rejects it after revokeSession', async () => {
    const before = await ts.app.inject({ method: 'GET', url: '/api/consents', headers: { cookie: COOKIE } });
    expect(before.statusCode).toBe(200);

    await revokeSession(ts.pools.authPool, TOKEN);

    const after = await ts.app.inject({ method: 'GET', url: '/api/consents', headers: { cookie: COOKIE } });
    expect(after.statusCode).toBe(401);
  });

  it('revokeAllSessions rejects the cookie too', async () => {
    const before = await ts.app.inject({ method: 'GET', url: '/api/consents', headers: { cookie: COOKIE } });
    expect(before.statusCode).toBe(200);

    await revokeAllSessions(ts.pools.authPool, userAId);

    const after = await ts.app.inject({ method: 'GET', url: '/api/consents', headers: { cookie: COOKIE } });
    expect(after.statusCode).toBe(401);
  });
});

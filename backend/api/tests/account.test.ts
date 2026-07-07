import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAdminPool, makeTestServer, resetTables, seedTwoUsers, type TestServer } from './helpers/db.ts';

/**
 * P04 AC4 — GDPR export returns ALL of the user's data; erasure deletes the
 * user + cascaded personal rows while the anonymous aggregate log (`events`,
 * which carries no FK to `users`) survives.
 */
const SESSION_TOKEN = 'account-test-session-token';
const COOKIE = `authjs.session-token=${SESSION_TOKEN}`;

describe('GDPR export + erasure (AC4)', () => {
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

  async function seedPersonalData(): Promise<void> {
    await ts.app.inject({
      method: 'PUT',
      url: '/api/profile/traveler',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: {
        age_band: '45-64',
        mobility: 'limited',
        eu_residency: false,
        student: true,
        languages: ['fr'],
        currency: 'CHF',
      },
    });
    await ts.app.inject({
      method: 'PUT',
      url: '/api/profile/taste',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: {
        interests: ['museums'],
        anti_preferences: ['queues'],
        hard_exclusions: ['casinos'],
        dietary: [],
        budget_tier: 'budget',
        pace: 'moderate',
      },
    });
    await ts.app.inject({
      method: 'PUT',
      url: '/api/profile/taste',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: {
        interests: ['museums', 'parks'],
        anti_preferences: ['queues'],
        hard_exclusions: ['casinos'],
        dietary: [],
        budget_tier: 'moderate',
        pace: 'moderate',
      },
    });
    await ts.app.inject({
      method: 'PUT',
      url: '/api/consents',
      headers: { cookie: COOKIE, 'content-type': 'application/json' },
      payload: { consent_type: 'personalization_learning', granted: true, policy_version: '2026-01' },
    });
  }

  it('export returns the user, traveler profile, ALL taste versions, and consents', async () => {
    await seedPersonalData();

    const res = await ts.app.inject({ method: 'GET', url: '/api/account/export', headers: { cookie: COOKIE } });
    expect(res.statusCode).toBe(200);
    const dump = res.json() as {
      user: { id: string };
      traveler_profile: { currency: string } | null;
      taste_profiles: Array<{ version: number }>;
      consents: Array<{ consent_type: string }>;
    };
    expect(dump.user.id).toBe(userAId);
    expect(dump.traveler_profile?.currency).toBe('CHF');
    expect(dump.taste_profiles.map((t) => t.version)).toEqual([0, 1]); // all versions, ordered
    expect(dump.consents).toHaveLength(1);
    expect(dump.consents[0]!.consent_type).toBe('personalization_learning');
  });

  it('export includes non-secret account + session metadata and leaks no token columns', async () => {
    await seedPersonalData();

    // Seed a linked OAuth account for the authed user via the superuser pool.
    // Token columns (secrets) are set to non-null dummy values so the "no secret
    // keys" assertion below proves the handler excludes them even when present.
    await admin.query(
      `INSERT INTO accounts
         (user_id, type, provider, provider_account_id,
          access_token, refresh_token, id_token, token_type, scope, session_state)
       VALUES ($1, 'oauth', 'google', 'google-sub-12345',
          'secret-access-token', 'secret-refresh-token', 'secret-id-token',
          'Bearer', 'openid email', 'secret-session-state')`,
      [userAId],
    );

    const res = await ts.app.inject({ method: 'GET', url: '/api/account/export', headers: { cookie: COOKIE } });
    expect(res.statusCode).toBe(200);
    const dump = res.json() as {
      accounts: Array<{ provider: string; provider_account_id: string; type: string }>;
      sessions: Array<{ expires: string }>;
    };

    // Linked account metadata (non-secret columns only).
    expect(dump.accounts).toContainEqual({
      provider: 'google',
      provider_account_id: 'google-sub-12345',
      type: 'oauth',
    });

    // Session metadata: the beforeEach-seeded session, exposing only its expiry
    // as an ISO string (never the `session_token`).
    expect(dump.sessions.length).toBeGreaterThanOrEqual(1);
    const expires = dump.sessions[0]!.expires;
    expect(typeof expires).toBe('string');
    expect(new Date(expires).toISOString()).toBe(expires);

    // No secret column ever appears anywhere in the serialized response.
    const serialized = JSON.stringify(dump);
    expect(serialized).not.toContain('session_token');
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('refresh_token');
    expect(serialized).not.toContain('id_token');
    // And none of the seeded secret VALUES leak either.
    expect(serialized).not.toContain('secret-access-token');
    expect(serialized).not.toContain('secret-refresh-token');
    expect(serialized).not.toContain('secret-id-token');
    expect(serialized).not.toContain('secret-session-state');
  });

  it('erasure deletes the user + cascaded personal rows, but an anonymous event survives', async () => {
    await seedPersonalData();

    // Pre-seed an anonymous aggregate row and a pseudonymous event for this user.
    await admin.query(
      `INSERT INTO user_pref_profiles (user_id, algo_version) VALUES ($1, 'v1')`,
      [userAId],
    );
    const marker = randomUUID();
    await admin.query(
      `INSERT INTO events (user_id, event_type, consent_flag, event_data)
       VALUES ($1, 'list_shown', true, jsonb_build_object('marker', $2::text))`,
      [userAId, marker],
    );

    const res = await ts.app.inject({ method: 'DELETE', url: '/api/account', headers: { cookie: COOKIE } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ erased: true });

    // Personal rows are gone (checked via the BYPASSRLS superuser pool).
    const userRows = await admin.query('SELECT 1 FROM users WHERE id = $1', [userAId]);
    expect(userRows.rowCount).toBe(0);
    const traveler = await admin.query('SELECT 1 FROM traveler_profiles WHERE user_id = $1', [userAId]);
    expect(traveler.rowCount).toBe(0);
    const taste = await admin.query('SELECT 1 FROM taste_profiles WHERE user_id = $1', [userAId]);
    expect(taste.rowCount).toBe(0);
    const consents = await admin.query('SELECT 1 FROM consents WHERE user_id = $1', [userAId]);
    expect(consents.rowCount).toBe(0);
    const prefs = await admin.query('SELECT 1 FROM user_pref_profiles WHERE user_id = $1', [userAId]);
    expect(prefs.rowCount).toBe(0);
    const sessions = await admin.query('SELECT 1 FROM sessions WHERE user_id = $1', [userAId]);
    expect(sessions.rowCount).toBe(0);

    // Tripwire: the pseudonymous event survives (no FK to users; anonymous
    // aggregate). Its user_id is now an orphaned pseudonym.
    const events = await admin.query(
      `SELECT user_id FROM events WHERE event_data->>'marker' = $1`,
      [marker],
    );
    expect(events.rowCount).toBe(1);
    expect(events.rows[0]!.user_id).toBe(userAId);
  });

  it('rejects unauthenticated requests with 401', async () => {
    expect((await ts.app.inject({ method: 'GET', url: '/api/account/export' })).statusCode).toBe(401);
    expect((await ts.app.inject({ method: 'DELETE', url: '/api/account' })).statusCode).toBe(401);
  });
});

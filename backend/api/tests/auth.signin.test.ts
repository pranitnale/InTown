import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher, type Dispatcher } from 'undici';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { createAdminPool, CookieJar, makeTestServer, resetTables, type TestServer } from './helpers/db.ts';

/**
 * AC1 — magic-link AND Google OAuth both complete a sign-in against the dev
 * stack, driving the REAL Auth.js flows end-to-end (adapter → DB session).
 */

const ORIGIN = 'http://localhost';

/** Fetch the CSRF token + cookie and seed the jar. */
async function getCsrf(ts: TestServer, jar: CookieJar): Promise<string> {
  const res = await ts.app.inject({ method: 'GET', url: '/api/auth/csrf' });
  jar.update(res.cookies);
  return (res.json() as { csrfToken: string }).csrfToken;
}

describe('sign-in (AC1)', () => {
  const admin = createAdminPool();
  let ts: TestServer;

  beforeAll(() => {
    ts = makeTestServer();
  });

  beforeEach(async () => {
    await resetTables(admin);
    ts.linkSink.links.length = 0;
  });

  afterAll(async () => {
    await ts.app.close();
    await admin.end();
  });

  it('magic-link: completes sign-in and creates a DB session', async () => {
    const jar = new CookieJar();
    const csrfToken = await getCsrf(ts, jar);
    const email = 'newuser@example.com';

    const signin = await ts.app.inject({
      method: 'POST',
      url: '/api/auth/signin/nodemailer',
      headers: {
        cookie: jar.header(),
        'content-type': 'application/x-www-form-urlencoded',
        origin: ORIGIN,
      },
      payload: new URLSearchParams({ csrfToken, email, callbackUrl: `${ORIGIN}/` }).toString(),
    });
    jar.update(signin.cookies);
    expect([200, 302]).toContain(signin.statusCode);

    // The provider captured the magic-link instead of sending mail.
    const link = ts.linkSink.last;
    expect(link?.identifier).toBe(email);
    expect(link?.url).toBeTruthy();

    const linkUrl = new URL(link!.url);
    const callback = await ts.app.inject({
      method: 'GET',
      url: linkUrl.pathname + linkUrl.search,
      headers: { cookie: jar.header() },
    });
    jar.update(callback.cookies);
    // Callback redirects on success.
    expect([200, 302]).toContain(callback.statusCode);
    expect(jar.get('authjs.session-token')).toBeTruthy();

    // The session resolves to the freshly-created user.
    const session = await ts.app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: jar.header() },
    });
    expect(session.statusCode).toBe(200);
    const body = session.json() as { user?: { email?: string } };
    expect(body.user?.email).toBe(email);

    // DB: user + session rows exist.
    const users = await admin.query('SELECT id FROM users WHERE email = $1', [email]);
    expect(users.rowCount).toBe(1);
    const sessions = await admin.query('SELECT session_token FROM sessions');
    expect(sessions.rowCount).toBe(1);
  });

  describe('google OAuth', () => {
    const GOOGLE_ORIGIN = 'https://accounts.google.com';
    const KID = 'test-key-1';
    let mockAgent: MockAgent;
    let priorDispatcher: Dispatcher;
    let privateKey: CryptoKey;
    let jwks: { keys: unknown[] };

    beforeAll(async () => {
      const pair = await generateKeyPair('RS256');
      privateKey = pair.privateKey;
      const jwk = await exportJWK(pair.publicKey);
      jwk.kid = KID;
      jwk.alg = 'RS256';
      jwk.use = 'sig';
      jwks = { keys: [jwk] };
    });

    beforeEach(() => {
      priorDispatcher = getGlobalDispatcher();
      mockAgent = new MockAgent();
      mockAgent.disableNetConnect();
      setGlobalDispatcher(mockAgent);

      const pool = mockAgent.get(GOOGLE_ORIGIN);
      pool
        .intercept({ path: '/.well-known/openid-configuration', method: 'GET' })
        .reply(
          200,
          {
            issuer: GOOGLE_ORIGIN,
            authorization_endpoint: `${GOOGLE_ORIGIN}/o/oauth2/v2/auth`,
            token_endpoint: `${GOOGLE_ORIGIN}/token`,
            userinfo_endpoint: `${GOOGLE_ORIGIN}/userinfo`,
            jwks_uri: `${GOOGLE_ORIGIN}/jwks`,
            response_types_supported: ['code'],
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256'],
            scopes_supported: ['openid', 'email', 'profile'],
            token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
            claims_supported: ['sub', 'email', 'email_verified', 'name', 'picture'],
            grant_types_supported: ['authorization_code'],
          },
          { headers: { 'content-type': 'application/json' } },
        )
        .persist();
      pool
        .intercept({ path: '/jwks', method: 'GET' })
        .reply(200, jwks, { headers: { 'content-type': 'application/json' } })
        .persist();
    });

    afterEach(async () => {
      setGlobalDispatcher(priorDispatcher);
      await mockAgent.close();
    });

    it('completes an OIDC sign-in through the real Auth.js callback', async () => {
      const jar = new CookieJar();
      const csrfToken = await getCsrf(ts, jar);
      const clientId = ts.env.GOOGLE_CLIENT_ID;
      const email = 'googler@example.com';
      const sub = 'google-sub-123';

      // 1. Kick off sign-in → 302 to the (mocked) Google authorize endpoint.
      const signin = await ts.app.inject({
        method: 'POST',
        url: '/api/auth/signin/google',
        headers: {
          cookie: jar.header(),
          'content-type': 'application/x-www-form-urlencoded',
          origin: ORIGIN,
        },
        payload: new URLSearchParams({ csrfToken, callbackUrl: `${ORIGIN}/` }).toString(),
      });
      jar.update(signin.cookies);
      expect(signin.statusCode).toBe(302);

      // Auth.js's Google flow uses PKCE (no state/nonce params); the callback is
      // bound to the request via the pkce code_verifier cookie carried in `jar`.
      const authUrl = new URL(signin.headers.location as string);
      expect(authUrl.origin + authUrl.pathname).toBe(`${GOOGLE_ORIGIN}/o/oauth2/v2/auth`);
      expect(authUrl.searchParams.get('client_id')).toBe(clientId);
      expect(authUrl.searchParams.get('code_challenge')).toBeTruthy();

      // 2. Sign the id_token (no nonce — Auth.js did not request one) and mock the token endpoint.
      const idToken = await new SignJWT({
        email,
        email_verified: true,
        name: 'Google User',
        picture: 'https://example.com/avatar.png',
      })
        .setProtectedHeader({ alg: 'RS256', kid: KID })
        .setIssuer(GOOGLE_ORIGIN)
        .setAudience(clientId)
        .setSubject(sub)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);

      const pool = mockAgent.get(GOOGLE_ORIGIN);
      pool
        .intercept({ path: '/token', method: 'POST' })
        .reply(
          200,
          {
            access_token: 'mock-access-token',
            token_type: 'bearer',
            expires_in: 3600,
            id_token: idToken,
            scope: 'openid email profile',
          },
          { headers: { 'content-type': 'application/json' } },
        );
      pool
        .intercept({ path: '/userinfo', method: 'GET' })
        .reply(
          200,
          { sub, email, email_verified: true, name: 'Google User', picture: 'https://example.com/avatar.png' },
          { headers: { 'content-type': 'application/json' } },
        )
        .persist();

      // 3. Provider redirects back to the callback → Auth.js runs the real callback path.
      // Google returns the RFC 9207 `iss` param on the callback; oauth4webapi requires it.
      const callback = await ts.app.inject({
        method: 'GET',
        url: `/api/auth/callback/google?code=mock-auth-code&iss=${encodeURIComponent(GOOGLE_ORIGIN)}`,
        headers: { cookie: jar.header() },
      });
      jar.update(callback.cookies);
      expect(callback.statusCode).toBe(302);
      expect(jar.get('authjs.session-token')).toBeTruthy();

      // 4. Session resolves to the Google-provisioned user.
      const session = await ts.app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: { cookie: jar.header() },
      });
      expect(session.statusCode).toBe(200);
      const body = session.json() as { user?: { email?: string } };
      expect(body.user?.email).toBe(email);

      // 5. DB: user + linked account + session rows exist.
      const users = await admin.query('SELECT id FROM users WHERE email = $1', [email]);
      expect(users.rowCount).toBe(1);
      const accounts = await admin.query(
        `SELECT provider, provider_account_id FROM accounts WHERE provider = 'google'`,
      );
      expect(accounts.rowCount).toBe(1);
      expect(accounts.rows[0].provider_account_id).toBe(sub);
      const sessions = await admin.query('SELECT session_token FROM sessions');
      expect(sessions.rowCount).toBe(1);
    });
  });
});

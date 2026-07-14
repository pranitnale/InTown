import { afterAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.ts';
import { loadEnv } from '../src/config/env.ts';

describe('GET /healthz', () => {
  const app = buildServer();

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with { status: "ok" }', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('answers credentialed preflight only for an exact allowlisted origin', async () => {
    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/api/pois',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
      },
    });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await app.inject({
      method: 'OPTIONS',
      url: '/api/pois',
      headers: {
        origin: 'https://evil.example',
        'access-control-request-method': 'GET',
      },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    expect(denied.headers['access-control-allow-credentials']).toBeUndefined();

    const signIn = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/signin/email',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,x-auth-return-redirect',
      },
    });
    expect(signIn.statusCode).toBe(204);
    expect(String(signIn.headers['access-control-allow-headers']).toLowerCase()).toContain(
      'x-auth-return-redirect',
    );
  });

  it('sets baseline API security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['referrer-policy']).toBeDefined();
  });
});

describe('production transport security headers', () => {
  const env = loadEnv({
    NODE_ENV: 'production',
    AUTH_SECRET: 'production-auth-secret-000000000000000000',
    AUTH_URL: 'https://api.intown.example',
    CORS_ALLOWED_ORIGINS: 'https://intown.example',
    AUTH_COOKIE_SITE: 'intown.example',
    DATABASE_URL: 'postgresql://postgres:production-admin-secret@db.example/intown',
    AUTH_DATABASE_URL:
      'postgresql://intown_auth:production-auth-db-secret@db.example/intown',
    APP_DATABASE_URL: 'postgresql://intown_app:production-app-db-secret@db.example/intown',
  } as NodeJS.ProcessEnv);
  const app = buildServer({ env });

  afterAll(async () => app.close());

  it('enables HSTS for the HTTPS deployment', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(res.headers['strict-transport-security']).toContain('includeSubDomains');
  });
});

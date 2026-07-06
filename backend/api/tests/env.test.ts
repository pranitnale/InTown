import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.ts';

/**
 * Unit coverage for `loadEnv` hardening (review-gate findings 1, 2, 5):
 * production fails fast on committed dev-default secrets/URLs and on a missing
 * `AUTH_URL`; dev/test keep their working defaults; `TRUST_PROXY` resolves into
 * Fastify's boolean | hop-count | CIDR-list shape.
 */

/** A fully-configured production env with no dev-default sentinels. */
const REAL_PROD = {
  NODE_ENV: 'production',
  AUTH_SECRET: 'a-real-production-auth-secret-0000000000000000',
  AUTH_URL: 'https://intown.example.com',
  DATABASE_URL: 'postgresql://postgres:real_super_pw@db:5432/intown',
  AUTH_DATABASE_URL: 'postgresql://intown_auth:real_auth_pw@db:5432/intown',
  APP_DATABASE_URL: 'postgresql://intown_app:real_app_pw@db:5432/intown',
} as unknown as NodeJS.ProcessEnv;

describe('loadEnv production hardening', () => {
  it('throws in production when AUTH_SECRET is still the dev default', () => {
    const { AUTH_SECRET: _drop, ...rest } = REAL_PROD as Record<string, string>;
    expect(() => loadEnv(rest as unknown as NodeJS.ProcessEnv)).toThrow(/AUTH_SECRET/);
  });

  it('throws in production when the DB URLs are still dev defaults', () => {
    expect(() =>
      loadEnv({ NODE_ENV: 'production', AUTH_SECRET: REAL_PROD.AUTH_SECRET, AUTH_URL: REAL_PROD.AUTH_URL } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/DATABASE_URL/);
  });

  it('throws in production when a custom URL still embeds a dev-default password', () => {
    expect(() =>
      loadEnv({
        ...(REAL_PROD as Record<string, string>),
        APP_DATABASE_URL: 'postgresql://intown_app:intown_app_dev_password@db:5432/intown',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/APP_DATABASE_URL/);
  });

  it('throws in production when AUTH_URL is missing', () => {
    const { AUTH_URL: _drop, ...rest } = REAL_PROD as Record<string, string>;
    expect(() => loadEnv(rest as unknown as NodeJS.ProcessEnv)).toThrow(/AUTH_URL/);
  });

  it('succeeds in production with real secrets/URLs and defaults TRUST_PROXY to 1 hop', () => {
    const env = loadEnv(REAL_PROD);
    expect(env.AUTH_SECRET).toBe(REAL_PROD.AUTH_SECRET);
    expect(env.AUTH_URL).toBe(REAL_PROD.AUTH_URL);
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.TRUST_PROXY).toBe(1);
  });
});

describe('loadEnv dev/test defaults', () => {
  it('loads with all dev defaults outside production and disables trustProxy', () => {
    const env = loadEnv({ NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv);
    expect(env.AUTH_SECRET.length).toBeGreaterThan(0);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.TRUST_PROXY).toBe(false);
  });

  it('does not throw in test env with dev defaults', () => {
    expect(() => loadEnv({ NODE_ENV: 'test' } as unknown as NodeJS.ProcessEnv)).not.toThrow();
  });
});

describe('resolveTrustProxy via loadEnv (TRUST_PROXY parsing)', () => {
  const base = { NODE_ENV: 'development' } as unknown as Record<string, string>;
  const load = (trustProxy: string) =>
    loadEnv({ ...base, TRUST_PROXY: trustProxy } as unknown as NodeJS.ProcessEnv).TRUST_PROXY;

  it('parses "true"/"false" to booleans', () => {
    expect(load('true')).toBe(true);
    expect(load('false')).toBe(false);
  });

  it('parses a bare integer to a hop count', () => {
    expect(load('2')).toBe(2);
  });

  it('passes a CIDR/IP list through as a string', () => {
    expect(load('10.0.0.0/8,127.0.0.1')).toBe('10.0.0.0/8,127.0.0.1');
  });
});

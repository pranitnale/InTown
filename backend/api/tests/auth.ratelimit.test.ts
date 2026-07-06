import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeTestServer, type TestServer } from './helpers/db.ts';

/**
 * AC3 — auth endpoints are rate-limited: N+1 rapid attempts are throttled (429).
 * The server is built with a small per-IP budget; the catch-all `/api/auth/*`
 * carries the per-route rate limit.
 */
const MAX = 3;

describe('auth rate limiting (AC3)', () => {
  let ts: TestServer;

  beforeAll(() => {
    ts = makeTestServer({ AUTH_RATE_LIMIT_MAX: String(MAX) });
  });

  afterAll(async () => {
    await ts.app.close();
  });

  it(`throttles the ${MAX + 1}th request within the window with 429`, async () => {
    const statuses: number[] = [];
    for (let i = 0; i < MAX + 1; i++) {
      const res = await ts.app.inject({ method: 'GET', url: '/api/auth/session' });
      statuses.push(res.statusCode);
    }
    // First MAX requests pass (200), the next is throttled.
    expect(statuses.slice(0, MAX).every((s) => s === 200)).toBe(true);
    expect(statuses[MAX]).toBe(429);
  });
});

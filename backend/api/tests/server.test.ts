import { afterAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.ts';

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
});

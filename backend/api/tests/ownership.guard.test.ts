import { afterEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { ownershipGuard } from '../src/auth/hooks.ts';

/**
 * AC5 — ownership-check middleware rejects a mismatched user/resource id.
 * Pure middleware test: no DB, no Auth.js. Drives a route protected by
 * `ownershipGuard` with a synthetic `req.user`.
 */
function buildApp(userId: string | null): FastifyInstance {
  const app = Fastify();
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req) => {
    req.user = userId ? { id: userId } : null;
  });
  app.get(
    '/things/:ownerId',
    { preHandler: ownershipGuard((req) => (req.params as { ownerId: string }).ownerId) },
    async () => ({ ok: true }),
  );
  return app;
}

describe('ownershipGuard (AC5)', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('allows the owner through', async () => {
    app = buildApp('user-a');
    const res = await app.inject({ method: 'GET', url: '/things/user-a' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('rejects a mismatched resource owner with 403', async () => {
    app = buildApp('user-a');
    const res = await app.inject({ method: 'GET', url: '/things/user-b' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
  });

  it('rejects an anonymous request with 403', async () => {
    app = buildApp(null);
    const res = await app.inject({ method: 'GET', url: '/things/user-a' });
    expect(res.statusCode).toBe(403);
  });
});

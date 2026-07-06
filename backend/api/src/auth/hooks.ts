import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import type { AuthLevel } from '@intown/contracts/api';
import type { LoadedEnv } from '../config/env.ts';
import type { Pools } from '../db/pool.ts';
import { sessionCookieName } from './config.ts';
import { getSessionUser, type SessionUser } from './session.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** The authenticated user for this request, or `null` when anonymous. */
    user: SessionUser | null;
  }
}

export interface AuthPluginDeps {
  env: LoadedEnv;
  pools: Pools;
}

/**
 * Wire cookie parsing, per-route rate limiting, and session resolution onto the
 * app. Registers globally (both `@fastify/cookie` and `@fastify/rate-limit`
 * self-declare as fastify-plugin, so their decorators apply app-wide), then
 * decorates every request with `req.user`, populated from the session cookie.
 */
const authPluginImpl: FastifyPluginAsync<AuthPluginDeps> = async (app, deps) => {
  const { env, pools } = deps;
  const cookieName = sessionCookieName(env);

  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, {
    // Off by default; only routes with `config.rateLimit` are throttled.
    global: false,
  });

  app.decorateRequest('user', null);

  app.addHook('onRequest', async (req: FastifyRequest) => {
    const token = req.cookies[cookieName];
    if (!token) {
      req.user = null;
      return;
    }
    req.user = await getSessionUser(pools.authPool, token);
  });
};

/**
 * Wrapped with fastify-plugin so it does NOT create its own encapsulation
 * context: the `req.user` decorator and the session hook apply app-wide, to the
 * consent routes and every future feature route.
 */
export const authPlugin = fp(authPluginImpl, { name: 'intown-auth', fastify: '5.x' });

/**
 * preHandler factory enforcing a route's {@link AuthLevel}.
 * - `public`  → no-op.
 * - `user`    → 401 unless a session resolved to a user.
 * - `member` / `owner` / `admin` → deferred: these need trip membership /
 *   ownership / role data that later phases (P04/P06) own. Fail closed with 501
 *   rather than silently allow.
 */
export function requireAuth(level: AuthLevel) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (level === 'public') return;

    if (level === 'user') {
      if (!req.user) {
        await reply.code(401).send({ error: 'unauthorized' });
      }
      return;
    }

    // member / owner / admin — not implemented in P02.
    await reply
      .code(501)
      .send({ error: 'not_implemented', detail: `auth level '${level}' is not implemented yet` });
  };
}

/**
 * preHandler factory rejecting a request whose authenticated user does not own
 * the targeted resource. `extractOwnerId` pulls the resource's owner id out of
 * the request (params/query/body). Returns 403 on mismatch or when anonymous.
 *
 * Reusable and unit-testable — the pattern every later ownership-checked route
 * (§11) builds on.
 */
export function ownershipGuard(extractOwnerId: (req: FastifyRequest) => string | undefined) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const ownerId = extractOwnerId(req);
    if (!req.user || !ownerId || req.user.id !== ownerId) {
      await reply.code(403).send({ error: 'forbidden' });
    }
  };
}

export type { FastifyInstance };

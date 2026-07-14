import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import type { AuthLevel } from '@intown/contracts/api';
import type { TripRole } from '@intown/contracts/types';
import type { LoadedEnv } from '../config/env.ts';
import type { Pools } from '../db/pool.ts';
import { sessionCookieName } from './config.ts';
import { getSessionUser, type SessionUser } from './session.ts';
import { resolveTripRole } from '../trips/authz.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** The authenticated user for this request, or `null` when anonymous. */
    user: SessionUser | null;
    /**
     * The caller's role in the trip named by the `:id` path param, set by
     * `requireAuth('member' | 'owner')`. `null` outside a trip-scoped route.
     */
    tripRole: TripRole | null;
  }
  interface FastifyInstance {
    /**
     * The request-serving DB pools, decorated by {@link authPlugin}. Trip authz
     * resolves a caller's role on the BYPASSRLS `authPool` before a handler opens
     * its RLS-scoped transaction.
     */
    pools: Pools;
    /** Per-IP one-minute budget applied to every contract route. */
    apiRateLimitMax: number;
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

  // Expose the pools on the instance so `requireAuth('member'|'owner')` can
  // resolve a trip role on the BYPASSRLS auth pool from within a preHandler.
  app.decorate('pools', pools);
  app.decorateRequest('user', null);
  app.decorateRequest('tripRole', null);

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
 * - `member`  → 401 if anonymous, else 403 unless the caller holds a membership
 *   in the trip named by `:id`; the resolved role is stashed on `req.tripRole`
 *   so write-path handlers can further gate viewers via `assertEditor`.
 * - `owner`   → as `member`, but 403 unless that role is exactly `owner`.
 * - `admin`   → still deferred (no moderator model yet): fail closed with 501.
 *
 * The `:id` param is already validated as a uuid by the router's preValidation
 * step, so the role lookup runs against a well-formed trip id. Role resolution
 * uses the BYPASSRLS auth pool (see {@link resolveTripRole}).
 */
export function requireAuth(level: AuthLevel) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (level === 'public') return;

    if (!req.user) {
      await reply.code(401).send({ error: 'unauthorized' });
      return;
    }
    if (level === 'user') return;

    if (level === 'member' || level === 'owner') {
      const tripId = (req.params as { id?: string }).id;
      if (!tripId) {
        // A trip-scoped auth level on a route with no `:id` in scope is a wiring
        // bug; deny rather than resolve an undefined trip.
        await reply.code(403).send({ error: 'forbidden' });
        return;
      }
      const role = await resolveTripRole(req.server.pools.authPool, tripId, req.user.id);
      if (!role || (level === 'owner' && role !== 'owner')) {
        await reply.code(403).send({ error: 'forbidden' });
        return;
      }
      req.tripRole = role;
      return;
    }

    // admin — no moderator/admin model exists yet. Fail closed with 501.
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

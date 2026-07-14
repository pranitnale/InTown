import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import { loadEnv, type LoadedEnv } from './config/env.ts';
import { createPools, closePools, type Pools } from './db/pool.ts';
import { pgAdapter } from './auth/adapter.ts';
import { buildProviders, type LinkSink } from './auth/providers.ts';
import { buildAuthConfig } from './auth/config.ts';
import { authPlugin } from './auth/hooks.ts';
import { registerAuthHandler } from './auth/handler.ts';
import { registerConsentRoutes } from './auth/consents.ts';
import { registerProfileRoutes } from './profile/routes.ts';
import { registerAccountRoutes } from './account/routes.ts';
import { registerTripRoutes } from './trips/routes.ts';
import { registerTripMemberRoutes } from './trips/members.ts';
import { registerTripInviteRoutes } from './trips/invites.ts';
import { registerPlaceRoutes } from './places/routes.ts';
import { registerPoiRoutes } from './pois/routes.ts';

export interface BuildServerOptions {
  /** Fastify logger config; defaults to off so tests stay quiet. */
  logger?: FastifyServerOptions['logger'];
  /** Injected env (tests). Falls back to `loadEnv()`. */
  env?: LoadedEnv;
  /** Injected pools (tests). Falls back to `createPools(env)`. Closed on shutdown either way. */
  pools?: Pools;
  /** Dev/test magic-link capture sink (see providers.ts). */
  linkSink?: LinkSink;
}

/**
 * Build the InTown API server (P02). Wires Auth.js (magic-link + Google) with
 * revocable database sessions, rate-limited `/api/auth/*`, RLS-scoped consent
 * routes, and the liveness probe.
 *
 * Plugin registration is queued synchronously; Fastify runs it on `ready()` /
 * `inject()`, so this stays a synchronous factory as before.
 */
export function buildServer(opts: BuildServerOptions = {}): FastifyInstance {
  const env = opts.env ?? loadEnv();
  const pools = opts.pools ?? createPools(env);

  // `trustProxy` makes `req.ip` the real client (not the reverse proxy) so the
  // per-IP auth rate limiter keys per client. Defaults to 1 hop in production
  // and off in dev/test; configurable via TRUST_PROXY (see config/env.ts).
  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: env.TRUST_PROXY,
    bodyLimit: env.API_BODY_LIMIT_BYTES,
  });
  app.decorate('apiRateLimitMax', env.API_RATE_LIMIT_MAX);

  const allowedOrigins = new Set(env.CORS_ALLOWED_ORIGINS);
  app.register(fastifyCors, {
    credentials: true,
    strictPreflight: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Content-Type', 'X-CSRF-Token', 'X-Auth-Return-Redirect'],
    maxAge: 600,
    origin(origin, callback) {
      // Requests without Origin are non-browser/same-origin traffic. Browser
      // origins must be an exact scheme+host+port allowlist match.
      callback(null, origin === undefined || allowedOrigins.has(origin));
    },
  });
  app.register(fastifyHelmet, {
    global: true,
    // The API is intentionally consumed cross-origin by the Vercel frontend;
    // CORP `same-origin` would contradict the CORS policy above.
    crossOriginResourcePolicy: false,
    hsts:
      env.NODE_ENV === 'production'
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
  });

  app.get('/healthz', async () => ({ status: 'ok' as const }));

  const adapter = pgAdapter(pools.authPool);
  const providers = buildProviders(env, opts.linkSink);
  const authConfig = buildAuthConfig({ env, adapter, providers });

  // authPlugin self-declares as fastify-plugin via its deps only; register it so
  // cookie/rate-limit decorators and the session hook apply app-wide.
  app.register(authPlugin, { env, pools });
  registerAuthHandler(app, { authConfig, env });
  registerConsentRoutes(app, pools);
  registerProfileRoutes(app, pools);
  registerAccountRoutes(app, pools);
  registerTripRoutes(app, pools);
  registerTripMemberRoutes(app, pools);
  registerTripInviteRoutes(app, pools);
  registerPlaceRoutes(app, pools);
  registerPoiRoutes(app, pools);

  app.addHook('onClose', async () => {
    await closePools(pools);
  });

  return app;
}

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Auth, type AuthConfig } from '@auth/core';
import type { LoadedEnv } from '../config/env.ts';
import { AUTH_BASE_PATH } from './config.ts';

/**
 * Fastify ↔ Web (Fetch) bridge for Auth.js. Auth.js's `Auth()` takes a WHATWG
 * `Request` and returns a `Response`; Fastify speaks Node req/reply. This module
 * translates between the two and mounts the `/api/auth/*` catch-all.
 */

/** Build a WHATWG Request from the Fastify request (raw body preserved as a Buffer). */
export function toWebRequest(req: FastifyRequest, env: LoadedEnv): Request {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol ?? 'http';
  const host = req.headers.host ?? 'localhost';
  const origin = env.AUTH_URL ?? `${proto}://${host}`;
  const url = `${origin}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? (req.body as Buffer | undefined) : undefined;

  return new Request(url, {
    method,
    headers,
    body: body ?? undefined,
    // Required by undici when a body is streamed/sent on Node.
    ...(hasBody && body ? { duplex: 'half' } : {}),
  } as RequestInit);
}

/** Copy a Web Response onto the Fastify reply, preserving multiple Set-Cookie headers. */
export async function applyWebResponse(reply: FastifyReply, res: Response): Promise<void> {
  reply.status(res.status);
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    reply.header(key, value);
  });
  for (const cookie of res.headers.getSetCookie()) {
    reply.header('set-cookie', cookie);
  }
  const text = await res.text();
  await reply.send(text);
}

/**
 * Mount the Auth.js catch-all on `/api/auth/*` (GET + POST) inside an
 * encapsulated scope. The scoped raw-body content-type parser captures every
 * body as a Buffer so Auth.js's own form/JSON parsing sees the bytes intact
 * (the default JSON parser would reject/corrupt the urlencoded sign-in posts).
 * The route carries the per-route rate limit.
 */
export function registerAuthHandler(
  app: FastifyInstance,
  params: { authConfig: AuthConfig; env: LoadedEnv },
): void {
  const { authConfig, env } = params;

  app.register(async (scope) => {
    scope.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => {
      done(null, body);
    });

    scope.route({
      method: ['GET', 'POST'],
      url: `${AUTH_BASE_PATH}/*`,
      config: {
        rateLimit: {
          max: env.AUTH_RATE_LIMIT_MAX,
          timeWindow: '1 minute',
        },
      },
      handler: async (req, reply) => {
        const request = toWebRequest(req, env);
        const res = await Auth(request, authConfig);
        await applyWebResponse(reply, res);
        return reply;
      },
    });
  });
}

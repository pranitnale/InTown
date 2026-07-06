import type { FastifyInstance, FastifyReply, FastifyRequest, RouteGenericInterface } from 'fastify';
import { z } from 'zod';
import type { RouteContract } from '@intown/contracts/api';
import { requireAuth } from '../auth/hooks.ts';

/**
 * Generic contract-driven route registration (§11). Given a frozen
 * {@link RouteContract} it:
 *  - maps method + path onto Fastify,
 *  - validates `params` / `query` / `body` against the contract's zod schemas
 *    (400 on failure),
 *  - enforces the contract's `auth` level via {@link requireAuth},
 *  - validates the handler's return against `response` before serializing.
 *
 * Handlers receive the already-validated request and return a plain value; the
 * router owns the wire concerns so every route stays uniform.
 */
export type RouteHandler = (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

function badRequest(reply: FastifyReply, err: unknown): FastifyReply {
  const detail = err instanceof z.ZodError ? err.issues : String(err);
  return reply.code(400).send({ error: 'bad_request', detail });
}

export function registerRoute(
  app: FastifyInstance,
  contract: RouteContract,
  handler: RouteHandler,
): void {
  app.route<RouteGenericInterface>({
    method: contract.method,
    url: contract.path,
    preValidation: async (req, reply) => {
      try {
        if (contract.params) req.params = contract.params.parse(req.params);
        if (contract.query) req.query = contract.query.parse(req.query);
        if (contract.body) req.body = contract.body.parse(req.body);
      } catch (err) {
        // Return the sent reply so Fastify short-circuits before preHandler /
        // handler run — an explicit stop, not a fire-and-forget send.
        return badRequest(reply, err);
      }
    },
    preHandler: requireAuth(contract.auth),
    handler: async (req, reply) => {
      const out = await handler(req, reply);
      // A handler (or guard within it) may have already responded.
      if (reply.sent) return reply;
      return contract.response.parse(out);
    },
  });
}

import type { z } from 'zod';

/**
 * `@intown/contracts/api` — the frozen §11 route contracts.
 *
 * A route is a plain typed object: method + path + auth level + zod schemas for
 * every wire slot (`params`, `query`, `body`, `response`, and `sse` for
 * streaming endpoints). No runtime framework coupling — the Fastify API (backend)
 * and the fetch client (frontend) each read these schemas to validate their end
 * of the seam. The two apps never import each other; this is the only shared code.
 */

/** HTTP methods used across the §11 surface. */
export const HTTP_METHOD_VALUES = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHOD_VALUES)[number];

/**
 * Required authorization level for a route (§11 — every route is auth +
 * ownership-checked). Levels are cumulative in intent:
 * - `public`  — no session required (auth handler, offline vault).
 * - `user`    — any authenticated user.
 * - `member`  — an authenticated member of the trip in the path (any role).
 * - `owner`   — the trip owner only.
 * - `admin`   — platform moderator/admin only.
 */
export const AUTH_LEVEL_VALUES = ['public', 'user', 'member', 'owner', 'admin'] as const;
export type AuthLevel = (typeof AUTH_LEVEL_VALUES)[number];

/**
 * A single route contract. Every schema slot is a zod schema so both apps can
 * validate against the identical shape and the generated `contracts/python`
 * mirror stays in lockstep.
 *
 * `sse` is set only for streaming endpoints (research, plan). For those, the
 * HTTP body is a `text/event-stream`; `sse` is the discriminated union of every
 * message the stream can emit, and `response` documents the terminal result
 * shape (also carried by the stream's completion message).
 */
export interface RouteContract {
  method: HttpMethod;
  path: string;
  auth: AuthLevel;
  /** One-line human description of the route. */
  summary?: string;
  /** Path parameters (e.g. `{ id }` for `/api/trips/:id`). */
  params?: z.ZodType;
  /** Query-string parameters. */
  query?: z.ZodType;
  /** Request body. */
  body?: z.ZodType;
  /** Success response body (for SSE routes: the terminal/result shape). */
  response: z.ZodType;
  /** Discriminated union of streamed messages; present only on SSE routes. */
  sse?: z.ZodType;
}

/**
 * Identity helper that pins the literal shape of a route contract while
 * enforcing {@link RouteContract}. Keeps `method`/`path`/`auth` as literals so
 * the registry stays statically inspectable.
 */
export function defineRoute<const T extends RouteContract>(route: T): T {
  return route;
}

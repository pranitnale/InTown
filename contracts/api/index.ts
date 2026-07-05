/**
 * `@intown/contracts/api` — the frozen §11 route surface + SSE shapes + realtime
 * channel schemas. Every route is a {@link RouteContract}; `allRoutes` is the
 * flat registry both apps read. The two apps never import each other — this is
 * the only shared code (decision #28).
 */
import type { RouteContract } from './route.ts';
import { authRoutes } from './auth.ts';
import { tripsRoutes } from './trips.ts';
import { researchRoutes } from './research.ts';
import { placesRoutes } from './places.ts';
import { poisRoutes } from './pois.ts';
import { planRoutes } from './plan.ts';
import { contentRoutes } from './content.ts';
import { communityRoutes } from './community.ts';
import { learningRoutes } from './learning.ts';
import { geoRoutes } from './geo.ts';

export * from './route.ts';
export * from './sse.ts';
export * from './auth.ts';
export * from './trips.ts';
export * from './research.ts';
export * from './places.ts';
export * from './pois.ts';
export * from './plan.ts';
export * from './content.ts';
export * from './community.ts';
export * from './learning.ts';
export * from './geo.ts';
export * from './channels.ts';
// Internal worker seam (NOT an HTTP route — deliberately absent from `allRoutes`).
export * from './solver.ts';

/** Flat registry of every §11 route, keyed `domain.action`. */
export const allRoutes = {
  ...authRoutes,
  ...tripsRoutes,
  ...researchRoutes,
  ...placesRoutes,
  ...poisRoutes,
  ...planRoutes,
  ...contentRoutes,
  ...communityRoutes,
  ...learningRoutes,
  ...geoRoutes,
} satisfies Record<string, RouteContract>;

export type RouteKey = keyof typeof allRoutes;

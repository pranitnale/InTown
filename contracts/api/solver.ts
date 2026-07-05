import { z } from 'zod';
import { Uuid, IsoDateTime, Coordinate } from '../types/index.ts';
import { Category, IndoorOutdoor, StopKind } from '../types/index.ts';

/**
 * §8 / §16 — the **solver worker seam** (internal, NOT an HTTP route).
 *
 * The API's `POST /plan` (see `plan.ts`) validates the client request, resolves
 * POIs + anchors + opening hours + a travel-time matrix (OSRM), then hands this
 * `SolverRequest` to the Python OR-Tools worker over the internal queue; the
 * worker replies with a `SolverResponse` that the API materializes into a
 * `plan_revisions` row + `stops`. These schemas are the contract for THAT hop.
 *
 * Coordinates are present here on purpose: they originate from grounded POIs and
 * client-supplied anchors (GPS / map tap / accommodation), never from an LLM —
 * the coordinate-integrity law (§5.5) constrains pipeline *text* output, not the
 * solver's numeric input. The solver (OR-Tools), not any model, emits arrival
 * times. All datetimes are ISO-8601 strings; the shape stays pure-JSON.
 */

/** Travel modes the solver reasons over (§8, §17.4 route layer). */
export const SOLVER_TRAVEL_MODE_VALUES = ['walk', 'transit', 'drive', 'bike', 'ferry'] as const;
export const SolverTravelMode = z.enum(SOLVER_TRAVEL_MODE_VALUES);
export type SolverTravelMode = z.infer<typeof SolverTravelMode>;

/**
 * A day's start or departure anchor as fed to the solver. Coordinates are
 * already resolved (POI-derived or client-supplied); `poi_id` is retained for
 * traceability when the anchor is a known place.
 */
export const SolverAnchor = z.object({
  /** Stable node key used in the travel matrix (e.g. `start:0`, `end:0`). */
  node: z.string(),
  coord: Coordinate,
  poi_id: Uuid.nullable(),
  label: z.string().nullable(),
});
export type SolverAnchor = z.infer<typeof SolverAnchor>;

/**
 * A resolved opening window for a candidate on a specific day. Absolute times
 * (hours already projected onto the trip's calendar). An empty `windows[]` on a
 * candidate means "no hours constraint" (always schedulable).
 */
export const SolverOpeningWindow = z.object({
  day_index: z.number().int().nonnegative(),
  opens: IsoDateTime,
  closes: IsoDateTime,
});
export type SolverOpeningWindow = z.infer<typeof SolverOpeningWindow>;

/** A candidate place the solver may place on the schedule. */
export const SolverCandidate = z.object({
  poi_id: Uuid,
  /** Travel-matrix node key for this candidate (equals `poi_id` by convention). */
  node: z.string(),
  coord: Coordinate,
  category: Category,
  /** Estimated visit duration in minutes. */
  est_duration_min: z.number().int().positive(),
  /** Scheduling weight (higher = more valuable to include); e.g. tier/score. */
  priority: z.number(),
  /** Hard-include: a locked must-do (§6.3) the solver may never drop. */
  must_do: z.boolean(),
  indoor_outdoor: IndoorOutdoor,
  /** Resolved opening windows; empty = unconstrained. */
  windows: z.array(SolverOpeningWindow),
});
export type SolverCandidate = z.infer<typeof SolverCandidate>;

/** Per-day solve configuration. */
export const SolverDay = z.object({
  day_index: z.number().int().nonnegative(),
  start_time: IsoDateTime,
  start: SolverAnchor,
  /** Hard departure deadline (last day); null = open-ended. */
  end_deadline: IsoDateTime.nullable(),
  end_anchor: SolverAnchor.nullable(),
  /** Per-day walking budget in metres (§8 second dimension); null = no cap. */
  walking_budget_m: z.number().nonnegative().nullable(),
});
export type SolverDay = z.infer<typeof SolverDay>;

/**
 * One directed travel-matrix edge between two nodes (candidate `node` keys or
 * anchor `node` keys). Precomputed by the API (OSRM) before the solve.
 */
export const SolverTravelEdge = z.object({
  from: z.string(),
  to: z.string(),
  mode: SolverTravelMode,
  seconds: z.number().int().nonnegative(),
  meters: z.number().nonnegative(),
});
export type SolverTravelEdge = z.infer<typeof SolverTravelEdge>;

/** The full solve request handed to the OR-Tools worker. */
export const SolverRequest = z.object({
  trip_city_id: Uuid,
  days: z.array(SolverDay),
  candidates: z.array(SolverCandidate),
  /** Precomputed OSRM travel matrix over all candidate + anchor nodes. */
  travel_matrix: z.array(SolverTravelEdge),
  /** Default mode when an edge is absent from the matrix. */
  default_mode: SolverTravelMode,
  /** Solve time budget in milliseconds (§6.10 live re-solve is ≤5s). */
  time_budget_ms: z.number().int().positive(),
});
export type SolverRequest = z.infer<typeof SolverRequest>;

/** Travel leg used to reach a scheduled stop (null for the first stop of a day). */
export const SolverTravelLeg = z.object({
  mode: SolverTravelMode,
  seconds: z.number().int().nonnegative(),
  meters: z.number().nonnegative(),
});
export type SolverTravelLeg = z.infer<typeof SolverTravelLeg>;

/** A single scheduled stop the solver emits. Times are solver-computed. */
export const SolverScheduledStop = z.object({
  /** Null for meal/break slots not tied to a POI. */
  poi_id: Uuid.nullable(),
  stop_kind: StopKind,
  day_index: z.number().int().nonnegative(),
  /** 0-based order within the day. */
  ord: z.number().int().nonnegative(),
  arrive: IsoDateTime,
  depart: IsoDateTime,
  /** Travel to reach this stop from the previous node; null for the day's start. */
  travel_from_prev: SolverTravelLeg.nullable(),
});
export type SolverScheduledStop = z.infer<typeof SolverScheduledStop>;

/** The materialized schedule for one day. */
export const SolverDaySchedule = z.object({
  day_index: z.number().int().nonnegative(),
  stops: z.array(SolverScheduledStop),
  /** Total walking distance for the day in metres. */
  walking_m: z.number().nonnegative(),
  /** When the day's activity ends (last depart / arrival at end anchor); null if empty. */
  ends_at: IsoDateTime.nullable(),
});
export type SolverDaySchedule = z.infer<typeof SolverDaySchedule>;

/** OR-Tools solve outcome. */
export const SOLVER_STATUS_VALUES = ['optimal', 'feasible', 'infeasible', 'timeout'] as const;
export const SolverStatus = z.enum(SOLVER_STATUS_VALUES);
export type SolverStatus = z.infer<typeof SolverStatus>;

/** The worker's reply; the API turns this into a `plan_revisions` row + `stops`. */
export const SolverResponse = z.object({
  trip_city_id: Uuid,
  status: SolverStatus,
  days: z.array(SolverDaySchedule),
  /** Candidates that could not be scheduled (never a `must_do`). */
  unscheduled_poi_ids: z.array(Uuid),
  /** Objective value the solver optimized; null when infeasible. */
  objective_value: z.number().nullable(),
  /** Wall-clock solve time in milliseconds. */
  solve_ms: z.number().int().nonnegative(),
});
export type SolverResponse = z.infer<typeof SolverResponse>;

/**
 * Registry of the solver worker-seam schemas. This is NOT an HTTP route surface
 * (it never enters `allRoutes`); it is the internal contract for the API↔worker
 * hop, exported so both the Fastify API and the Python worker mirror validate
 * against the identical shape.
 */
export const solverSchemas = {
  request: SolverRequest,
  response: SolverResponse,
} as const;

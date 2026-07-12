import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import type { TripRole } from '@intown/contracts/types';
import { loadEnv, type LoadedEnv } from '../../src/config/env.ts';
import { createPools, type Pools } from '../../src/db/pool.ts';
import { buildServer } from '../../src/server.ts';
import { ArrayLinkSink } from '../../src/auth/providers.ts';

/** Superuser URL used by the harness for seeding + cross-user assertions. */
export function adminUrl(): string {
  return (
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres_dev_password@localhost:5432/intown'
  );
}

/** Build a validated test env: process.env with test-safe defaults, then per-test overrides. */
export function testEnv(overrides: Record<string, string> = {}): LoadedEnv {
  return loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    COOKIE_SECURE: 'false',
    // Deterministic origin for the Fastify↔Web bridge (avoids host-derivation ambiguity under inject).
    AUTH_URL: process.env.AUTH_URL ?? 'http://localhost',
    // Generous by default so multi-step flows don't self-throttle; the rate-limit
    // suite overrides this to a small number.
    AUTH_RATE_LIMIT_MAX: '1000',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? 'test-client-id.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? 'test-client-secret',
    AUTH_SECRET: process.env.AUTH_SECRET ?? 'test-auth-secret-0000000000000000000000000000',
    ...overrides,
  } as NodeJS.ProcessEnv);
}

/** A superuser pool for seeding + tripwire assertions (bypasses RLS via ownership). */
export function createAdminPool(): pg.Pool {
  return new pg.Pool({ connectionString: adminUrl() });
}

export interface SeededUser {
  id: string;
  email: string;
}

export interface SeededUsers {
  a: SeededUser;
  b: SeededUser;
}

// Valid RFC-4122 UUIDs (version + variant nibbles set) so they pass `z.uuid()`.
const USER_A: SeededUser = { id: '11111111-1111-4111-8111-111111111111', email: 'alice@example.com' };
const USER_B: SeededUser = { id: '22222222-2222-4222-8222-222222222222', email: 'bob@example.com' };

/** Insert two distinct users (superuser; bypasses RLS). */
export async function seedTwoUsers(admin: pg.Pool): Promise<SeededUsers> {
  await admin.query(
    `INSERT INTO users (id, email, display_name) VALUES ($1, $2, 'Alice'), ($3, $4, 'Bob')`,
    [USER_A.id, USER_A.email, USER_B.id, USER_B.email],
  );
  return { a: USER_A, b: USER_B };
}

/**
 * Truncate the auth/identity tables plus the trips-domain + brain catalog tables
 * the P06/P08 seeders touch. CASCADE from `users` already reaches every user-FK
 * table, but `cities`/`pois` are catalog rows with no user FK, so they are listed
 * explicitly to guarantee a clean slate between tests.
 *
 * The Brain log/aggregate tables (`facts`, `poi_hours`, `poi_enrichment`,
 * `poi_geo_observations`, `reviews`, `poi_merges`) are listed too: `facts` has no
 * FK to `pois` (polymorphic entity_id), so a `pois` cascade would miss it, and
 * naming the rest keeps the reset explicit. TRUNCATE fires only TRUNCATE-level
 * triggers, so the append-only row guards on `facts`/`poi_geo_observations`
 * (0010, BEFORE UPDATE/DELETE FOR EACH ROW) never block it.
 */
export async function resetTables(admin: pg.Pool): Promise<void> {
  await admin.query(
    `TRUNCATE consents, sessions, accounts, verification_token,
              traveler_profiles, taste_profiles,
              place_votes, trip_places, plan_revisions, stops,
              intercity_legs, trip_invites, trip_members, trip_cities, trips,
              poi_merges, poi_geo_observations, facts, poi_hours, poi_enrichment,
              reviews, pois, cities, users RESTART IDENTITY CASCADE`,
  );
}

/**
 * Insert an extra user (superuser; bypasses RLS) with a server-generated uuid.
 * Handy when a test needs a third party beyond {@link seedTwoUsers} (e.g. a
 * non-member).
 */
export async function seedUser(admin: pg.Pool, email: string): Promise<SeededUser> {
  const { rows } = await admin.query<{ id: string }>(
    `INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id`,
    [email, email.split('@')[0]],
  );
  return { id: rows[0]!.id, email };
}

/**
 * Seed one city plus `poiCount` POIs in it (superuser). The brain catalog tables
 * carry no RLS, so trip-place seeding can reference these ids freely.
 */
export interface SeededCity {
  cityId: string;
  poiIds: string[];
}
export async function seedCityAndPoi(admin: pg.Pool, poiCount = 1): Promise<SeededCity> {
  const { rows: cityRows } = await admin.query<{ id: string }>(
    `INSERT INTO cities (name, bbox) VALUES ('Test City', '{}') RETURNING id`,
  );
  const cityId = cityRows[0]!.id;
  const poiIds: string[] = [];
  for (let i = 0; i < poiCount; i += 1) {
    const { rows } = await admin.query<{ id: string }>(
      `INSERT INTO pois (city_id, name, category, indoor_outdoor)
       VALUES ($1, $2, 'MUSEUM', 'indoor') RETURNING id`,
      [cityId, `POI ${i}`],
    );
    poiIds.push(rows[0]!.id);
  }
  return { cityId, poiIds };
}

export interface SeedTripMember {
  userId: string;
  role: TripRole;
}
export interface SeedTripOptions {
  ownerId: string;
  /** Extra members beyond the owner; the owner's `'owner'` row is always created. */
  members?: SeedTripMember[];
  /** When set, adds a single city stay and returns its id. */
  cityId?: string;
  name?: string;
}
export interface SeededTrip {
  tripId: string;
  tripCityId: string | null;
}

/**
 * Seed a trip (superuser; bypasses RLS) with its owner membership row (the
 * owner-is-always-a-member invariant), any additional members, and — when
 * `cityId` is given — one city stay. Returns the trip id and the city-stay id.
 */
export async function seedTrip(admin: pg.Pool, opts: SeedTripOptions): Promise<SeededTrip> {
  const { rows: tripRows } = await admin.query<{ id: string }>(
    `INSERT INTO trips (owner_id, name) VALUES ($1, $2) RETURNING id`,
    [opts.ownerId, opts.name ?? 'Test Trip'],
  );
  const tripId = tripRows[0]!.id;

  await admin.query(
    `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [tripId, opts.ownerId],
  );
  for (const m of opts.members ?? []) {
    await admin.query(`INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, $3)`, [
      tripId,
      m.userId,
      m.role,
    ]);
  }

  let tripCityId: string | null = null;
  if (opts.cityId) {
    const { rows } = await admin.query<{ id: string }>(
      `INSERT INTO trip_cities (trip_id, ord, city_id, arrive, depart)
       VALUES ($1, 0, $2, '2026-01-01', '2026-01-02') RETURNING id`,
      [tripId, opts.cityId],
    );
    tripCityId = rows[0]!.id;
  }
  return { tripId, tripCityId };
}

/** Seed a curated place in a city stay (superuser), attributed to `addedBy`. */
export async function seedPlace(
  admin: pg.Pool,
  args: { tripCityId: string; poiId: string; addedBy: string; position?: string },
): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    `INSERT INTO trip_places (trip_city_id, poi_id, position, added_by)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [args.tripCityId, args.poiId, args.position ?? 'a0', args.addedBy],
  );
  return rows[0]!.id;
}

/** Seed a single vote on a place (superuser). */
export async function seedVote(
  admin: pg.Pool,
  tripPlaceId: string,
  userId: string,
  vote: 'up' | 'down',
): Promise<void> {
  await admin.query(`INSERT INTO place_votes (trip_place_id, user_id, vote) VALUES ($1, $2, $3)`, [
    tripPlaceId,
    userId,
    vote,
  ]);
}

// ---------------------------------------------------------------------------
// Brain seed helpers (P08). All run on the superuser admin pool: the Brain
// catalog + append-only logs are owner-written (the app role only has SELECT),
// and the append-only guards (0010) block direct client INSERT-aside writes, not
// plain INSERTs, so seeding a fresh row is fine.
// ---------------------------------------------------------------------------

export interface SeedPoiOptions {
  city_id: string;
  name: string;
  /** Defaults to 'MUSEUM'. */
  category?: string;
  /** Defaults to 'indoor'. */
  indoor_outdoor?: string;
  aliases?: string[];
  /** Normalized significance in [0,1]; defaults to 0. */
  prominence?: number;
  external_ids?: Record<string, unknown>;
}

/** Seed one canonical POI (superuser); returns its id. Coord stays ungrounded (null). */
export async function seedPoi(admin: pg.Pool, opts: SeedPoiOptions): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    `INSERT INTO pois (city_id, name, category, indoor_outdoor, aliases, prominence, external_ids)
     VALUES ($1, $2, $3::category, $4::indoor_outdoor, $5, $6, $7)
     RETURNING id`,
    [
      opts.city_id,
      opts.name,
      opts.category ?? 'MUSEUM',
      opts.indoor_outdoor ?? 'indoor',
      opts.aliases ?? [],
      opts.prominence ?? 0,
      JSON.stringify(opts.external_ids ?? {}),
    ],
  );
  return rows[0]!.id;
}

export interface SeedFactOptions {
  entity_id: string;
  attribute: string;
  /** Defaults to 'poi'. */
  entity_kind?: string;
  value?: unknown;
  source_url?: string | null;
  /** Defaults to 'official_site'. */
  source_kind?: string;
  /** ISO timestamp; defaults to now(). */
  observed_at?: string;
  confidence?: number;
  corroboration_count?: number;
  /** Defaults to 'active'. */
  status?: string;
}

/** Seed one atomic fact (superuser, append-only INSERT); returns its id. */
export async function seedFact(admin: pg.Pool, opts: SeedFactOptions): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    `INSERT INTO facts
       (entity_kind, entity_id, attribute, value, source_url, source_kind,
        observed_at, confidence, corroboration_count, status)
     VALUES ($1::fact_entity_kind, $2, $3, $4, $5, $6::fact_source_kind,
             coalesce($7::timestamptz, now()), $8, $9, $10::fact_status)
     RETURNING id`,
    [
      opts.entity_kind ?? 'poi',
      opts.entity_id,
      opts.attribute,
      opts.value === undefined ? null : JSON.stringify(opts.value),
      opts.source_url ?? null,
      opts.source_kind ?? 'official_site',
      opts.observed_at ?? null,
      opts.confidence ?? 0.8,
      opts.corroboration_count ?? 0,
      opts.status ?? 'active',
    ],
  );
  return rows[0]!.id;
}

export interface SeedGeoObservationOptions {
  poi_id: string;
  source_kind: string;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  /** ISO timestamp; defaults to now(). */
  observed_at?: string;
  expires_at?: string | null;
  confidence?: number;
}

/**
 * Seed one geo-observation (superuser, append-only INSERT). The 0015 AFTER
 * INSERT trigger recomputes the POI's coord + display gate on commit; returns the
 * observation id.
 */
export async function seedGeoObservation(
  admin: pg.Pool,
  opts: SeedGeoObservationOptions,
): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    `INSERT INTO poi_geo_observations
       (poi_id, source_kind, lat, lng, accuracy_m, observed_at, expires_at, confidence)
     VALUES ($1, $2::geo_source_kind, $3, $4, $5, coalesce($6::timestamptz, now()), $7, $8)
     RETURNING id`,
    [
      opts.poi_id,
      opts.source_kind,
      opts.lat,
      opts.lng,
      opts.accuracy_m ?? null,
      opts.observed_at ?? null,
      opts.expires_at ?? null,
      opts.confidence ?? 0.9,
    ],
  );
  return rows[0]!.id;
}

export interface SeedReviewOptions {
  poi_id: string;
  user_id: string;
  rating: number;
  text?: string | null;
  verified_visit?: boolean;
  /** Defaults to 'published'. */
  status?: string;
}

/** Seed one review (superuser); returns its id. */
export async function seedReview(admin: pg.Pool, opts: SeedReviewOptions): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    `INSERT INTO reviews (poi_id, user_id, rating, text, verified_visit, status)
     VALUES ($1, $2, $3, $4, $5, $6::review_status)
     RETURNING id`,
    [
      opts.poi_id,
      opts.user_id,
      opts.rating,
      opts.text ?? null,
      opts.verified_visit ?? false,
      opts.status ?? 'published',
    ],
  );
  return rows[0]!.id;
}

/**
 * Seed a live session for a user and return the `Cookie` header value that
 * authenticates them (the dev/test cookie has no `__Secure-` prefix, matching
 * `COOKIE_SECURE=false`). Extracted from the seeded-session-cookie pattern in
 * profile.test.ts. Upserts so repeated calls with the same token stay valid.
 */
export async function sessionFor(
  admin: pg.Pool,
  userId: string,
  token = `sess-${userId}`,
): Promise<string> {
  await admin.query(
    `INSERT INTO sessions (session_token, user_id, expires)
     VALUES ($1, $2, now() + interval '1 day')
     ON CONFLICT (session_token) DO UPDATE SET user_id = EXCLUDED.user_id, expires = EXCLUDED.expires`,
    [token, userId],
  );
  return `authjs.session-token=${token}`;
}

export interface TestServer {
  app: FastifyInstance;
  pools: Pools;
  env: LoadedEnv;
  linkSink: ArrayLinkSink;
}

/**
 * Build a server wired to the dev/CI DB (app pool = intown_app so RLS applies).
 * The returned pools are closed when `app.close()` is called.
 */
export function makeTestServer(overrides: Record<string, string> = {}): TestServer {
  const env = testEnv(overrides);
  const pools = createPools(env);
  const linkSink = new ArrayLinkSink();
  const app = buildServer({ env, pools, linkSink });
  return { app, pools, env, linkSink };
}

/** A minimal cookie jar for driving the multi-step Auth.js flows via `app.inject`. */
export class CookieJar {
  private readonly store = new Map<string, string>();

  /** Update the jar from a light-my-request response's parsed cookies. */
  update(cookies: Array<{ name: string; value: string }>): void {
    for (const { name, value } of cookies) {
      if (value === '') this.store.delete(name);
      else this.store.set(name, value);
    }
  }

  /** The `Cookie` header value, or undefined when empty. */
  header(): string | undefined {
    if (this.store.size === 0) return undefined;
    return [...this.store.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  get(name: string): string | undefined {
    return this.store.get(name);
  }
}

import pg from 'pg';

/**
 * WP-D-local Brain test helpers (P08). Owned solely by the WP-D brain suites; do
 * NOT fold anything here into `helpers/db.ts` (WP-C owns that file). Everything
 * runs on the superuser admin pool: seeding, calling the SQL brain functions
 * directly, and asserting append-only guards — no HTTP, no app/auth roles.
 */

/** Superuser URL — the migrate/superuser role that owns the Brain tables + functions. */
export function adminUrl(): string {
  return (
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres_dev_password@localhost:5432/intown'
  );
}

/** A superuser pool for seeding + calling brain SQL functions directly. */
export function createAdminPool(): pg.Pool {
  return new pg.Pool({ connectionString: adminUrl() });
}

/**
 * Truncate the Brain tables this suite touches. `facts` carries no FK to `pois`
 * (polymorphic entity_id), so it must be listed explicitly — a `TRUNCATE pois
 * CASCADE` would leave stale facts behind. RESTART IDENTITY keeps runs clean.
 */
export async function resetBrain(admin: pg.Pool): Promise<void> {
  await admin.query(
    `TRUNCATE facts, poi_merges, poi_geo_observations, pois, cities RESTART IDENTITY CASCADE`,
  );
}

// --- Geo maths: metre offsets around a Porto anchor (§5.5 lat/lng are explicit). ---
export const PORTO_LAT = 41.14663;
export const PORTO_LNG = -8.61479;
const M_PER_DEG_LAT = 111_320;

/** Degrees of latitude for `meters` north (small-offset planar approximation). */
export function offsetLat(meters: number): number {
  return meters / M_PER_DEG_LAT;
}

/** Degrees of longitude for `meters` east at `atLat` (small-offset approximation). */
export function offsetLng(meters: number, atLat: number): number {
  return meters / (M_PER_DEG_LAT * Math.cos((atLat * Math.PI) / 180));
}

/** Insert a city (superuser). Returns its id; `id` may be pinned for fixtures. */
export async function seedCity(
  admin: pg.Pool,
  opts: { id?: string; name?: string; bbox?: string } = {},
): Promise<string> {
  const cols = opts.id ? '(id, name, bbox)' : '(name, bbox)';
  const vals = opts.id ? '($1, $2, $3)' : '($1, $2)';
  const params = opts.id
    ? [opts.id, opts.name ?? 'Porto', opts.bbox ?? '{}']
    : [opts.name ?? 'Porto', opts.bbox ?? '{}'];
  const { rows } = await admin.query<{ id: string }>(
    `INSERT INTO cities ${cols} VALUES ${vals} RETURNING id`,
    params,
  );
  return rows[0]!.id;
}

export interface SeedPoiArgs {
  cityId: string;
  id?: string;
  name?: string;
  category?: string;
  indoorOutdoor?: string;
  aliases?: string[];
  externalIds?: Record<string, unknown>;
  sourceRefs?: unknown[];
}

/**
 * Insert a POI (superuser). Coord fields are LEFT AT DEFAULTS (coord NULL,
 * coord_resolution 'unverified') so the geo-consensus trigger — not the seed — is
 * what grounds the coordinate. Returns the POI id.
 */
export async function seedPoi(admin: pg.Pool, args: SeedPoiArgs): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    `INSERT INTO pois (id, city_id, name, aliases, category, indoor_outdoor, external_ids, source_refs)
     VALUES (coalesce($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
     RETURNING id`,
    [
      args.id ?? null,
      args.cityId,
      args.name ?? 'Test POI',
      args.aliases ?? [],
      args.category ?? 'SIGHT',
      args.indoorOutdoor ?? 'outdoor',
      JSON.stringify(args.externalIds ?? {}),
      JSON.stringify(args.sourceRefs ?? []),
    ],
  );
  return rows[0]!.id;
}

export interface ObsArgs {
  poiId: string;
  sourceKind: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  observedAt?: string;
  expiresAt?: string | null;
  confidence?: number;
}

/**
 * Append a geo-observation (superuser). The AFTER-STATEMENT recompute trigger
 * fires synchronously, so the POI's derived coord/resolution reflect this row on
 * return. `observedAt` defaults to now(); `expiresAt` defaults to NULL.
 */
export async function insertObs(admin: pg.Pool, args: ObsArgs): Promise<void> {
  await admin.query(
    `INSERT INTO poi_geo_observations
       (poi_id, source_kind, lat, lng, accuracy_m, observed_at, expires_at, confidence)
     VALUES ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7::timestamptz, $8)`,
    [
      args.poiId,
      args.sourceKind,
      args.lat,
      args.lng,
      args.accuracyM ?? null,
      args.observedAt ?? null,
      args.expiresAt ?? null,
      args.confidence ?? 0.9,
    ],
  );
}

export interface PoiCoordRow {
  coord_resolution: string;
  coord_verified_by: string | null;
  coord_confidence: number | null;
  lat: number | null;
  lng: number | null;
  merged_into: string | null;
  source_refs: unknown;
  external_ids: unknown;
}

/** Read a POI's derived coord state (lat/lng extracted from the geography point). */
export async function readPoi(admin: pg.Pool, poiId: string): Promise<PoiCoordRow> {
  const { rows } = await admin.query<PoiCoordRow>(
    `SELECT coord_resolution,
            coord_verified_by,
            coord_confidence,
            ST_Y(coord::geometry) AS lat,
            ST_X(coord::geometry) AS lng,
            merged_into,
            source_refs,
            external_ids
       FROM pois
      WHERE id = $1`,
    [poiId],
  );
  return rows[0]!;
}

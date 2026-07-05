import { z } from 'zod';

/**
 * Shared primitives for every §10 entity schema.
 *
 * Conventions (PRD law — do not deviate):
 * - All ids are UUIDs.
 * - Datetimes are ISO-8601 strings (`z.iso.datetime()`), never `z.date()`.
 * - Schemas stay pure-JSON-serializable: no `.transform()` that would break
 *   JSON-Schema export (contracts/python is generated from these).
 * - No TypeScript `enum` keyword anywhere — `z.enum` over an `as const` tuple.
 */

/** UUID primary/foreign key. */
export const Uuid = z.uuid();
export type Uuid = z.infer<typeof Uuid>;

/** ISO-8601 date-time string (e.g. `2026-07-05T12:00:00Z`). */
export const IsoDateTime = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** ISO-8601 calendar date string (e.g. `2026-07-05`). */
export const IsoDate = z.iso.date();
export type IsoDate = z.infer<typeof IsoDate>;

/** Absolute URL (source links, official links, storage references over HTTP). */
export const Url = z.url();
export type Url = z.infer<typeof Url>;

/** ISO-4217 currency code (three uppercase letters, e.g. `EUR`). */
export const CurrencyCode = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/);
export type CurrencyCode = z.infer<typeof CurrencyCode>;

/** Monetary amount with an explicit currency. Amounts are major units (e.g. 12.5 EUR). */
export const Money = z.object({
  amount: z.number(),
  currency: CurrencyCode,
});
export type Money = z.infer<typeof Money>;

/**
 * A geographic coordinate. Coordinates NEVER originate from an LLM (§5.5) —
 * they exist only on `pois` (derived canonical coord) and on the append-only
 * `poi_geo_observations` log. No pipeline / research / import schema carries a
 * coordinate field.
 */
export const Coordinate = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Coordinate = z.infer<typeof Coordinate>;

/** Confidence score in the closed unit interval. */
export const Confidence = z.number().min(0).max(1);
export type Confidence = z.infer<typeof Confidence>;

/**
 * How a POI's canonical coordinate was verified (§5.5, §10).
 * Provenance is a fact, never a relabelable tag.
 */
export const COORD_VERIFIED_BY_VALUES = [
  'open_data',
  'cross_referenced',
  'first_traveler_gps',
] as const;
export const CoordVerifiedBy = z.enum(COORD_VERIFIED_BY_VALUES);
export type CoordVerifiedBy = z.infer<typeof CoordVerifiedBy>;

/**
 * The genuine origin of a single geo observation (§5.5 resolution cascade).
 * A ToS-limited source (`google_fallback`) is kept only as an expiring
 * observation, never relabeled.
 */
export const GEO_SOURCE_KIND_VALUES = [
  'osm',
  'wikidata',
  'commons_photo',
  'flickr_photo',
  'source_maplink',
  'visual_recognition',
  'google_fallback',
  'first_traveler_gps',
] as const;
export const GeoSourceKind = z.enum(GEO_SOURCE_KIND_VALUES);
export type GeoSourceKind = z.infer<typeof GeoSourceKind>;

/**
 * Origin kind for an atomic fact (§5.3). Terse in the PRD — this is a sensible
 * minimal set covering the described ingest paths; extend via a contract change
 * if a new ingest path appears.
 */
export const FACT_SOURCE_KIND_VALUES = [
  'llm_research',
  'osm',
  'wikidata',
  'official_site',
  'open_data',
  'advisory',
  'web_review',
  'user_correction',
] as const;
export const FactSourceKind = z.enum(FACT_SOURCE_KIND_VALUES);
export type FactSourceKind = z.infer<typeof FactSourceKind>;

/**
 * A single source reference retained on a resolved entity (§5.5 — merges keep
 * ALL source_refs). External IDs are the primary resolution keys.
 */
export const SourceRef = z.object({
  source_kind: FactSourceKind,
  source_url: Url.nullable().optional(),
  external_id: z.string().nullable().optional(),
  observed_at: IsoDateTime.optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

/** Opaque arbitrary JSON value (for `jsonb` columns). */
export const Json: z.ZodType<unknown> = z.unknown();
export type Json = unknown;

/** A JSON object payload (for `jsonb` columns that are always objects). */
export const JsonObject = z.record(z.string(), z.unknown());
export type JsonObject = z.infer<typeof JsonObject>;

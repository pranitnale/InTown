import { z } from 'zod';
import {
  Uuid,
  IsoDate,
  IsoDateTime,
  Url,
  Coordinate,
  Confidence,
  CoordVerifiedBy,
  GeoSourceKind,
  FactSourceKind,
  SourceRef,
  Money,
  Json,
  JsonObject,
} from './common.ts';
import { Category } from './category.ts';

/**
 * City bounding box (open-data extent, not an LLM-emitted coordinate).
 * WGS-84 degrees.
 */
export const BBox = z.object({
  min_lat: z.number().min(-90).max(90),
  min_lng: z.number().min(-180).max(180),
  max_lat: z.number().min(-90).max(90),
  max_lng: z.number().min(-180).max(180),
});
export type BBox = z.infer<typeof BBox>;

/** Lifecycle of a city's Brain build (§5.2). */
export const BRAIN_STATUS_VALUES = ['cold', 'building', 'warm', 'stale'] as const;
export const BrainStatus = z.enum(BRAIN_STATUS_VALUES);
export type BrainStatus = z.infer<typeof BrainStatus>;

export const City = z.object({
  id: Uuid,
  name: z.string(),
  country_code: z.string().nullable(),
  bbox: BBox,
  /** Path to the city's PMTiles basemap slice (self-hosted), null until built. */
  pmtiles_path: z.string().nullable(),
  brain_status: BrainStatus,
  warmed_at: IsoDateTime.nullable(),
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
});
export type City = z.infer<typeof City>;

/** Indoor/outdoor classification for weather-aware scheduling (§5.4). */
export const INDOOR_OUTDOOR_VALUES = ['indoor', 'outdoor', 'mixed'] as const;
export const IndoorOutdoor = z.enum(INDOOR_OUTDOOR_VALUES);
export type IndoorOutdoor = z.infer<typeof IndoorOutdoor>;

/**
 * Coordinate resolution state (§5.5 display gate): `verified` = ≥2 independent
 * sources agree within ~100 m; `approximate` = single/weak source (never a
 * confident point); `unverified` = not grounded, not navigable.
 */
export const COORD_RESOLUTION_VALUES = ['unverified', 'approximate', 'verified'] as const;
export const CoordResolution = z.enum(COORD_RESOLUTION_VALUES);
export type CoordResolution = z.infer<typeof CoordResolution>;

/** External resolution keys (§5.5) — matched before fuzzy resolution. */
export const PoiExternalIds = z.object({
  osm_id: z.string().nullable(),
  wikidata_id: z.string().nullable(),
  google_place_id: z.string().nullable(),
});
export type PoiExternalIds = z.infer<typeof PoiExternalIds>;

/** Accessibility flags (§5.4). Tri-state: true / false / unknown (null). */
export const PoiAccessibility = z.object({
  wheelchair: z.boolean().nullable(),
  stairs: z.boolean().nullable(),
  stroller: z.boolean().nullable(),
});
export type PoiAccessibility = z.infer<typeof PoiAccessibility>;

/**
 * Canonical place (§10, §5.4, §5.5). The canonical `coord` + `coord_confidence`
 * + `coord_verified_by` are DERIVED from the append-only `poi_geo_observations`
 * log — never written directly by pipeline text output (the LLM never emits
 * coordinates). `coord` is null while a place is unverified.
 */
export const Poi = z.object({
  id: Uuid,
  city_id: Uuid,
  name: z.string(),
  aliases: z.array(z.string()),
  category: Category,
  /** Derived canonical coordinate; null until grounded (§5.5). */
  coord: Coordinate.nullable(),
  coord_confidence: Confidence.nullable(),
  coord_verified_by: CoordVerifiedBy.nullable(),
  coord_resolution: CoordResolution,
  external_ids: PoiExternalIds,
  /** All retained source references (merges keep every ref, §5.5). */
  source_refs: z.array(SourceRef),
  /** Normalized significance/prominence score in [0,1]. */
  prominence: z.number().min(0).max(1),
  indoor_outdoor: IndoorOutdoor,
  accessibility: PoiAccessibility,
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
});
export type Poi = z.infer<typeof Poi>;

/**
 * Append-only geo-observation log (§5.5). Every geolocation signal ever seen is
 * kept, never overwritten. `lat`/`lng` are stored as explicit fields (per §10).
 * `expires_at` is non-null ONLY for ToS-limited sources (e.g. Google ≤30d),
 * after which the observation is purged; the durable coordinate is the
 * consensus derived from storable sources + user GPS.
 */
export const PoiGeoObservation = z.object({
  id: Uuid,
  poi_id: Uuid,
  source_kind: GeoSourceKind,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().nonnegative().nullable(),
  observed_at: IsoDateTime,
  /** Non-null only for ToS-limited sources; null = durable. */
  expires_at: IsoDateTime.nullable(),
  confidence: Confidence,
});
export type PoiGeoObservation = z.infer<typeof PoiGeoObservation>;

/**
 * Atomic-fact table (§5.3). Append-only. Facts attach to a POI or a city
 * (`entity_kind` disambiguates `entity_id`). `value` is arbitrary JSON.
 * Status/lifecycle values are a sensible minimal set (noted in the WP-A capsule).
 */
export const FACT_ENTITY_KIND_VALUES = ['poi', 'city'] as const;
export const FactEntityKind = z.enum(FACT_ENTITY_KIND_VALUES);
export type FactEntityKind = z.infer<typeof FactEntityKind>;

export const FACT_STATUS_VALUES = ['active', 'superseded', 'disputed', 'rejected'] as const;
export const FactStatus = z.enum(FACT_STATUS_VALUES);
export type FactStatus = z.infer<typeof FactStatus>;

export const Fact = z.object({
  id: Uuid,
  entity_kind: FactEntityKind,
  entity_id: Uuid,
  attribute: z.string(),
  value: Json,
  source_url: Url.nullable(),
  source_kind: FactSourceKind,
  observed_at: IsoDateTime,
  confidence: Confidence,
  corroboration_count: z.number().int().nonnegative(),
  status: FactStatus,
});
export type Fact = z.infer<typeof Fact>;

/**
 * Opening hours (§5.4). One row per interval. `day_of_week` is 0=Monday..6=Sunday;
 * null on a holiday exception row. Times are `HH:MM` (24h) local strings.
 */
const HhMm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const PoiHours = z.object({
  id: Uuid,
  poi_id: Uuid,
  day_of_week: z.number().int().min(0).max(6).nullable(),
  opens: HhMm.nullable(),
  closes: HhMm.nullable(),
  is_closed: z.boolean(),
  is_24h: z.boolean(),
  is_holiday_exception: z.boolean(),
  /** Optional validity window for seasonal hours. */
  valid_from: IsoDate.nullable(),
  valid_to: IsoDate.nullable(),
  note: z.string().nullable(),
});
export type PoiHours = z.infer<typeof PoiHours>;

/**
 * Per-language enrichment (§10): significance narrative, optional narration
 * script + generated audio path, generated timestamp.
 */
export const PoiEnrichment = z.object({
  id: Uuid,
  poi_id: Uuid,
  /** BCP-47 language tag. */
  language: z.string(),
  significance: z.string(),
  /** Narration script structure (freeform JSON), null if not yet generated. */
  scripts: JsonObject.nullable(),
  /** Storage path to the generated narration MP3, null until generated. */
  audio_path: z.string().nullable(),
  generated_at: IsoDateTime,
});
export type PoiEnrichment = z.infer<typeof PoiEnrichment>;

/**
 * City brief (§5.6): per-language safety/scams/food-identity/etiquette/holidays
 * payload. Content is freeform JSON so later phases can enrich its shape
 * without a schema change (noted in the WP-A capsule).
 */
export const CityBrief = z.object({
  id: Uuid,
  city_id: Uuid,
  language: z.string(),
  content: JsonObject,
  generated_at: IsoDateTime,
});
export type CityBrief = z.infer<typeof CityBrief>;

/**
 * Scenic-approach leg (§5.4, §17.4). A leg between two anchors noted as scenic.
 * Minimal shape (noted in the WP-A capsule); geometry/timing is attached by the
 * routing layer, never by LLM output.
 */
export const ScenicLeg = z.object({
  id: Uuid,
  city_id: Uuid,
  from_poi_id: Uuid.nullable(),
  to_poi_id: Uuid.nullable(),
  description: z.string(),
  confidence: Confidence,
  source_refs: z.array(SourceRef),
  created_at: IsoDateTime,
});
export type ScenicLeg = z.infer<typeof ScenicLeg>;

/**
 * Transit pass / card advisor entry (§6.11) with a cited price and as-of date.
 */
export const TransitPass = z.object({
  id: Uuid,
  city_id: Uuid,
  name: z.string(),
  description: z.string().nullable(),
  price: Money.nullable(),
  /** Human-readable validity (e.g. "72h", "single ride"). */
  validity: z.string().nullable(),
  /** Coverage details (zones, modes) as freeform JSON. */
  coverage: JsonObject.nullable(),
  source_url: Url.nullable(),
  as_of: IsoDate.nullable(),
  created_at: IsoDateTime,
});
export type TransitPass = z.infer<typeof TransitPass>;

import { poisRoutes } from '@intown/contracts/api';
import type { ListPoisQuery, SearchPoisQuery, PoiCardQuery } from '@intown/contracts/api';
import type {
  Poi,
  Fact,
  PoiHours,
  PoiEnrichment,
  Review,
  CoordResolution,
  CoordVerifiedBy,
  Category,
  IndoorOutdoor,
  FactEntityKind,
  FactStatus,
  FactSourceKind,
  ReviewStatus,
} from '@intown/contracts/types';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Pools } from '../db/pool.ts';
import { registerRoute, type RouteHandler } from '../http/router.ts';

/**
 * POI reads (P08, §11): viewport/category list, city-biased search-to-add, and
 * the composite decision card (cited facts, hours, per-language enrichment,
 * review aggregate). All three are served on `pools.appPool` directly: the Brain
 * catalog tables (`pois`, `facts`, `poi_hours`, `poi_enrichment`) carry no RLS
 * and `reviews` carries only a permissive policy, so no `withUserContext`
 * transaction is needed — the app role holds SELECT via 0015.
 *
 * COORDINATE DISPLAY GATE (§5.5, D52/D53): `pois.coord` is DERIVED from the
 * append-only observation log; it is NULL until grounded and only a `verified`
 * resolution is navigable. These routes surface `coord` + `coord_resolution`
 * verbatim — the gate is honored by the DB (poi_recompute_coord), never
 * re-derived here.
 *
 * MERGE REDIRECT (§5.4): duplicate POIs point at their canonical head via
 * `merged_into`. List and search show only canonical rows (`merged_into IS
 * NULL`); the card resolves a merged id to its canonical head before assembling.
 */

const DEFAULT_LIST_LIMIT = 200;
const DEFAULT_SEARCH_LIMIT = 50;
/** Minimum trigram similarity for a search hit (mirrors the §5.4 matcher floor, looser for search-to-add). */
const SEARCH_SIMILARITY_FLOOR = 0.25;
/** Default enrichment language when the caller does not pin one (contract leaves it optional). */
const DEFAULT_ENRICHMENT_LANGUAGE = 'en';

function notFound(reply: FastifyReply, detail: string): FastifyReply {
  return reply.code(404).send({ error: 'not_found', detail });
}

// ---------------------------------------------------------------------------
// Row shapes + mappers
// ---------------------------------------------------------------------------

interface PoiRow {
  id: string;
  city_id: string;
  name: string;
  aliases: string[];
  category: Category;
  coord_lat: number | null;
  coord_lng: number | null;
  coord_confidence: number | null;
  coord_verified_by: CoordVerifiedBy | null;
  coord_resolution: CoordResolution;
  external_ids: Record<string, unknown> | null;
  source_refs: unknown[] | null;
  prominence: number;
  indoor_outdoor: IndoorOutdoor;
  accessibility: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * `ST_Y/ST_X(coord::geometry)` yield lat/lng from the derived geography point;
 * date/text columns come back native. `coord` is the geometry cast because
 * ST_X/ST_Y are geometry accessors.
 */
const POI_COLUMNS = `id, city_id, name, aliases, category,
  ST_Y(coord::geometry) AS coord_lat,
  ST_X(coord::geometry) AS coord_lng,
  coord_confidence, coord_verified_by, coord_resolution,
  external_ids, source_refs, prominence, indoor_outdoor, accessibility,
  created_at, updated_at`;

function toPoi(row: PoiRow): Poi {
  const ext = row.external_ids ?? {};
  const acc = row.accessibility ?? {};
  return {
    id: row.id,
    city_id: row.city_id,
    name: row.name,
    aliases: row.aliases,
    category: row.category,
    coord:
      row.coord_lat === null || row.coord_lng === null
        ? null
        : { lat: row.coord_lat, lng: row.coord_lng },
    coord_confidence: row.coord_confidence,
    coord_verified_by: row.coord_verified_by,
    coord_resolution: row.coord_resolution,
    // external_ids / accessibility default to `{}` in the DB; the contract
    // requires every key present (nullable, not optional), so fill the gaps.
    external_ids: {
      osm_id: (ext.osm_id as string | undefined) ?? null,
      wikidata_id: (ext.wikidata_id as string | undefined) ?? null,
      google_place_id: (ext.google_place_id as string | undefined) ?? null,
    },
    source_refs: (row.source_refs ?? []) as Poi['source_refs'],
    prominence: row.prominence,
    indoor_outdoor: row.indoor_outdoor,
    accessibility: {
      wheelchair: (acc.wheelchair as boolean | undefined) ?? null,
      stairs: (acc.stairs as boolean | undefined) ?? null,
      stroller: (acc.stroller as boolean | undefined) ?? null,
    },
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

interface FactRow {
  id: string;
  entity_kind: FactEntityKind;
  entity_id: string;
  attribute: string;
  value: unknown;
  source_url: string | null;
  source_kind: FactSourceKind;
  observed_at: Date;
  confidence: number;
  corroboration_count: number;
  status: FactStatus;
}

const FACT_COLUMNS = `id, entity_kind, entity_id, attribute, value, source_url,
  source_kind, observed_at, confidence, corroboration_count, status`;

function toFact(row: FactRow): Fact {
  return {
    id: row.id,
    entity_kind: row.entity_kind,
    entity_id: row.entity_id,
    attribute: row.attribute,
    value: row.value ?? null,
    source_url: row.source_url,
    source_kind: row.source_kind,
    observed_at: row.observed_at.toISOString(),
    confidence: row.confidence,
    corroboration_count: row.corroboration_count,
    status: row.status,
  };
}

interface PoiHoursRow {
  id: string;
  poi_id: string;
  day_of_week: number | null;
  opens: string | null;
  closes: string | null;
  is_closed: boolean;
  is_24h: boolean;
  is_holiday_exception: boolean;
  valid_from: string | null;
  valid_to: string | null;
  note: string | null;
}

const HOURS_COLUMNS = `id, poi_id, day_of_week, opens, closes, is_closed, is_24h,
  is_holiday_exception, valid_from::text AS valid_from, valid_to::text AS valid_to, note`;

function toHours(row: PoiHoursRow): PoiHours {
  return {
    id: row.id,
    poi_id: row.poi_id,
    day_of_week: row.day_of_week,
    opens: row.opens,
    closes: row.closes,
    is_closed: row.is_closed,
    is_24h: row.is_24h,
    is_holiday_exception: row.is_holiday_exception,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    note: row.note,
  };
}

interface EnrichmentRow {
  id: string;
  poi_id: string;
  language: string;
  significance: string;
  scripts: Record<string, unknown> | null;
  audio_path: string | null;
  generated_at: Date;
}

const ENRICHMENT_COLUMNS = `id, poi_id, language, significance, scripts, audio_path, generated_at`;

function toEnrichment(row: EnrichmentRow): PoiEnrichment {
  return {
    id: row.id,
    poi_id: row.poi_id,
    language: row.language,
    significance: row.significance,
    scripts: row.scripts,
    audio_path: row.audio_path,
    generated_at: row.generated_at.toISOString(),
  };
}

interface ReviewRow {
  id: string;
  poi_id: string;
  user_id: string;
  rating: number;
  text: string | null;
  verified_visit: boolean;
  status: ReviewStatus;
  created_at: Date;
  updated_at: Date;
}

const REVIEW_COLUMNS = `id, poi_id, user_id, rating, text, verified_visit, status, created_at, updated_at`;

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    poi_id: row.poi_id,
    user_id: row.user_id,
    rating: row.rating,
    text: row.text,
    verified_visit: row.verified_visit,
    status: row.status,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export function listPoisHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const { city_id, bbox, category, min_prominence, limit } = req.query as ListPoisQuery;
    // merged_into IS NULL always: never surface a duplicate that folds elsewhere.
    const conds: string[] = ['merged_into IS NULL'];
    const params: unknown[] = [];
    if (city_id) {
      params.push(city_id);
      conds.push(`city_id = $${params.length}`);
    }
    if (bbox) {
      // Only grounded POIs can be in-viewport; the envelope is (minLng,minLat,maxLng,maxLat).
      params.push(bbox.min_lng, bbox.min_lat, bbox.max_lng, bbox.max_lat);
      const n = params.length;
      conds.push(
        `coord IS NOT NULL AND ST_Intersects(coord, ST_MakeEnvelope($${n - 3}, $${n - 2}, $${n - 1}, $${n}, 4326)::geography)`,
      );
    }
    if (category) {
      params.push(category);
      conds.push(`category = $${params.length}::category`);
    }
    if (min_prominence !== undefined) {
      params.push(min_prominence);
      conds.push(`prominence >= $${params.length}`);
    }
    params.push(limit ?? DEFAULT_LIST_LIMIT);
    const { rows } = await pools.appPool.query<PoiRow>(
      `SELECT ${POI_COLUMNS}
         FROM pois
        WHERE ${conds.join(' AND ')}
        ORDER BY prominence DESC NULLS LAST, id
        LIMIT $${params.length}`,
      params,
    );
    return rows.map(toPoi);
  };
}

export function searchPoisHandler(pools: Pools): RouteHandler {
  return async (req) => {
    const { q, city_id, limit } = req.query as SearchPoisQuery;
    // $1 = probe; a hit is a trigram-similar name, a substring name, or a
    // substring alias. Ranked by the best of name/alias similarity.
    const params: unknown[] = [q, SEARCH_SIMILARITY_FLOOR];
    const conds: string[] = [
      'merged_into IS NULL',
      `(similarity(name, $1) >= $2
        OR name ILIKE '%' || $1 || '%'
        OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE a ILIKE '%' || $1 || '%'))`,
    ];
    if (city_id) {
      params.push(city_id);
      conds.push(`city_id = $${params.length}`);
    }
    params.push(limit ?? DEFAULT_SEARCH_LIMIT);
    const { rows } = await pools.appPool.query<PoiRow>(
      `SELECT ${POI_COLUMNS}
         FROM pois
        WHERE ${conds.join(' AND ')}
        ORDER BY greatest(
                   similarity(name, $1),
                   coalesce((SELECT max(similarity(a, $1)) FROM unnest(aliases) a), 0)
                 ) DESC, id
        LIMIT $${params.length}`,
      params,
    );
    return rows.map(toPoi);
  };
}

export function poiCardHandler(pools: Pools): RouteHandler {
  return async (req, reply) => {
    const { id } = req.params as { id: string };
    const { language } = req.query as PoiCardQuery;
    const lang = language ?? DEFAULT_ENRICHMENT_LANGUAGE;

    // Redirect a merged id to its canonical head; 404 when the id is unknown.
    const head = await pools.appPool.query<{ canon: string }>(
      `SELECT coalesce(merged_into, id) AS canon FROM pois WHERE id = $1`,
      [id],
    );
    if (head.rowCount === 0) return notFound(reply, 'poi not found');
    const canon = head.rows[0]!.canon;

    const [poiRes, factsRes, hoursRes, enrichRes, reviewsRes, aggRes] = await Promise.all([
      pools.appPool.query<PoiRow>(`SELECT ${POI_COLUMNS} FROM pois WHERE id = $1`, [canon]),
      pools.appPool.query<FactRow>(
        `SELECT ${FACT_COLUMNS} FROM facts
          WHERE entity_kind = 'poi' AND entity_id = $1 AND status <> 'rejected'
          ORDER BY attribute, observed_at DESC`,
        [canon],
      ),
      pools.appPool.query<PoiHoursRow>(
        `SELECT ${HOURS_COLUMNS} FROM poi_hours
          WHERE poi_id = $1
          ORDER BY day_of_week NULLS LAST, id`,
        [canon],
      ),
      pools.appPool.query<EnrichmentRow>(
        `SELECT ${ENRICHMENT_COLUMNS} FROM poi_enrichment WHERE poi_id = $1 AND language = $2`,
        [canon, lang],
      ),
      pools.appPool.query<ReviewRow>(
        `SELECT ${REVIEW_COLUMNS} FROM reviews
          WHERE poi_id = $1 AND status = 'published'
          ORDER BY created_at DESC`,
        [canon],
      ),
      pools.appPool.query<{ rating_count: number; rating_avg: number | null }>(
        `SELECT count(*)::int AS rating_count, avg(rating)::float8 AS rating_avg
           FROM reviews WHERE poi_id = $1 AND status = 'published'`,
        [canon],
      ),
    ]);

    // The canonical head always exists (it is either the row itself or a live
    // merge target), but guard defensively rather than assume.
    if (poiRes.rowCount === 0) return notFound(reply, 'poi not found');

    return {
      poi: toPoi(poiRes.rows[0]!),
      facts: factsRes.rows.map(toFact),
      hours: hoursRes.rows.map(toHours),
      enrichment: enrichRes.rows[0] ? toEnrichment(enrichRes.rows[0]) : null,
      reviews: reviewsRes.rows.map(toReview),
      rating_avg: aggRes.rows[0]!.rating_avg,
      rating_count: aggRes.rows[0]!.rating_count,
    };
  };
}

/**
 * Register the POI read routes (P08). Wired in `server.ts` after the place
 * routes. Note: `pois.search` must register before `pois.card` is irrelevant —
 * Fastify's radix router disambiguates `/api/pois/search` from
 * `/api/pois/:id/card` by structure — but keep the contract order for clarity.
 */
export function registerPoiRoutes(app: FastifyInstance, pools: Pools): void {
  registerRoute(app, poisRoutes['pois.list'], listPoisHandler(pools));
  registerRoute(app, poisRoutes['pois.search'], searchPoisHandler(pools));
  registerRoute(app, poisRoutes['pois.card'], poiCardHandler(pools));
}

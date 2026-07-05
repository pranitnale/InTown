-- 0005_brain — the City Brain (§5.2–5.6, §10). Mirrors contracts/types/brain.ts.
--
-- Coordinate law (§5.5): the LLM NEVER emits coordinates. `pois.coord` is a
-- DERIVED canonical geography point (null until grounded); its provenance lives
-- in `poi_geo_observations` (append-only, enforced in 0010). No other table in
-- the pipeline carries a coordinate.

CREATE TABLE cities (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text         NOT NULL,
  country_code text,
  bbox         jsonb        NOT NULL,                 -- BBox {min_lat,min_lng,max_lat,max_lng}
  pmtiles_path text,                                  -- self-hosted basemap slice; null until built
  brain_status brain_status NOT NULL DEFAULT 'cold',
  warmed_at    timestamptz,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

-- Now that `cities` exists, wire the forward FK deferred from 0004.
ALTER TABLE trip_cities
  ADD CONSTRAINT trip_cities_city_id_fkey
  FOREIGN KEY (city_id) REFERENCES cities (id) ON DELETE RESTRICT;

-- Canonical place. coord/coord_confidence/coord_verified_by are derived from the
-- observation log and null until grounded; coord_resolution is the §5.5 display
-- gate and defaults to 'unverified'.
CREATE TABLE pois (
  id                uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id           uuid                 NOT NULL REFERENCES cities (id) ON DELETE CASCADE,
  name              text                 NOT NULL,
  aliases           text[]               NOT NULL DEFAULT '{}',
  category          category             NOT NULL,
  coord             geography(Point, 4326),
  coord_confidence  double precision     CHECK (coord_confidence >= 0 AND coord_confidence <= 1),
  coord_verified_by coord_verified_by,
  coord_resolution  coord_resolution     NOT NULL DEFAULT 'unverified',
  external_ids      jsonb                NOT NULL DEFAULT '{}',  -- PoiExternalIds
  source_refs       jsonb                NOT NULL DEFAULT '[]',  -- SourceRef[]
  prominence        double precision     NOT NULL DEFAULT 0 CHECK (prominence >= 0 AND prominence <= 1),
  indoor_outdoor    indoor_outdoor       NOT NULL,
  accessibility     jsonb                NOT NULL DEFAULT '{}',  -- PoiAccessibility
  created_at        timestamptz          NOT NULL DEFAULT now(),
  updated_at        timestamptz          NOT NULL DEFAULT now()
);

-- Append-only geo-observation log (§5.5). lat/lng are explicit fields (per §10).
-- expires_at is non-null only for ToS-limited sources; UPDATE/DELETE blocked in 0010.
CREATE TABLE poi_geo_observations (
  id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id      uuid             NOT NULL REFERENCES pois (id) ON DELETE CASCADE,
  source_kind geo_source_kind  NOT NULL,
  lat         double precision NOT NULL CHECK (lat >= -90 AND lat <= 90),
  lng         double precision NOT NULL CHECK (lng >= -180 AND lng <= 180),
  accuracy_m  double precision CHECK (accuracy_m >= 0),
  observed_at timestamptz      NOT NULL,
  expires_at  timestamptz,
  confidence  double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1)
);

-- Atomic facts (§5.3). Append-only; polymorphic over (entity_kind, entity_id)
-- so a fact can attach to a poi OR a city. UPDATE/DELETE blocked in 0010.
CREATE TABLE facts (
  id                  uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_kind         fact_entity_kind NOT NULL,
  entity_id           uuid             NOT NULL,
  attribute           text             NOT NULL,
  value               jsonb,
  source_url          text,
  source_kind         fact_source_kind NOT NULL,
  observed_at         timestamptz      NOT NULL,
  confidence          double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  corroboration_count integer          NOT NULL DEFAULT 0 CHECK (corroboration_count >= 0),
  status              fact_status      NOT NULL DEFAULT 'active'
);

-- Opening hours (§5.4). day_of_week 0=Mon..6=Sun, null on a holiday exception.
CREATE TABLE poi_hours (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id               uuid    NOT NULL REFERENCES pois (id) ON DELETE CASCADE,
  day_of_week          integer CHECK (day_of_week >= 0 AND day_of_week <= 6),
  opens                text    CHECK (opens ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  closes               text    CHECK (closes ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  is_closed            boolean NOT NULL DEFAULT false,
  is_24h               boolean NOT NULL DEFAULT false,
  is_holiday_exception boolean NOT NULL DEFAULT false,
  valid_from           date,
  valid_to             date,
  note                 text
);

-- Per-language enrichment (§10): significance + optional narration script/audio.
CREATE TABLE poi_enrichment (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id       uuid        NOT NULL REFERENCES pois (id) ON DELETE CASCADE,
  language     text        NOT NULL,                  -- BCP-47
  significance text        NOT NULL,
  scripts      jsonb,                                 -- narration structure; null until generated
  audio_path   text,                                  -- MP3 storage path; null until generated
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poi_id, language)
);

-- City brief (§5.6): per-language safety/scams/etiquette/etc. content (freeform).
CREATE TABLE city_briefs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id      uuid        NOT NULL REFERENCES cities (id) ON DELETE CASCADE,
  language     text        NOT NULL,
  content      jsonb       NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, language)
);

-- Scenic-approach leg (§5.4, §17.4). Geometry/timing attach in the routing layer.
CREATE TABLE scenic_legs (
  id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id     uuid             NOT NULL REFERENCES cities (id) ON DELETE CASCADE,
  from_poi_id uuid             REFERENCES pois (id) ON DELETE SET NULL,
  to_poi_id   uuid             REFERENCES pois (id) ON DELETE SET NULL,
  description text             NOT NULL,
  confidence  double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_refs jsonb            NOT NULL DEFAULT '[]',
  created_at  timestamptz      NOT NULL DEFAULT now()
);

-- Transit pass / card advisor (§6.11) with cited price + as-of date.
CREATE TABLE transit_passes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id     uuid        NOT NULL REFERENCES cities (id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  price       jsonb,                                  -- Money {amount,currency}
  validity    text,
  coverage    jsonb,
  source_url  text,
  as_of       date,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pois_city_idx            ON pois (city_id);
CREATE INDEX pois_category_idx        ON pois (city_id, category);
CREATE INDEX pois_coord_gix           ON pois USING gist (coord);
CREATE INDEX poi_geo_obs_poi_idx      ON poi_geo_observations (poi_id);
CREATE INDEX facts_entity_idx         ON facts (entity_kind, entity_id);
CREATE INDEX poi_hours_poi_idx        ON poi_hours (poi_id);
CREATE INDEX city_briefs_city_idx     ON city_briefs (city_id);
CREATE INDEX scenic_legs_city_idx     ON scenic_legs (city_id);
CREATE INDEX transit_passes_city_idx  ON transit_passes (city_id);

-- 0006_curation — trip_places, place_votes, plan_revisions, stops (§6.3, §10).
-- Mirrors contracts/types/curation.ts.
--
-- trip_places.position is TEXT-FRACTIONAL (a fractional-indexing key like "a0",
-- "a0V") — NEVER numeric — so reorders never renumber siblings.
-- plan_revisions is append-only (UPDATE/DELETE blocked in 0010).

CREATE TABLE trip_places (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_city_id uuid        NOT NULL REFERENCES trip_cities (id) ON DELETE CASCADE,
  poi_id       uuid        NOT NULL REFERENCES pois (id) ON DELETE CASCADE,
  position     text        NOT NULL,                  -- fractional key, not a number
  state        place_state NOT NULL DEFAULT 'suggested',
  added_by     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  est_duration integer     CHECK (est_duration > 0),  -- minutes
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_city_id, poi_id)
);

CREATE TABLE place_votes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_place_id uuid        NOT NULL REFERENCES trip_places (id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  vote          vote_value  NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_place_id, user_id)
);

-- Append-only revision log. Each re-solve/edit is a new row.
CREATE TABLE plan_revisions (
  id             uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_city_id   uuid                 NOT NULL REFERENCES trip_cities (id) ON DELETE CASCADE,
  revision_index integer              NOT NULL CHECK (revision_index >= 0),
  reason         plan_revision_reason NOT NULL,
  created_by     uuid                 NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at     timestamptz          NOT NULL DEFAULT now(),
  UNIQUE (trip_city_id, revision_index)
);

-- Materialized schedule for a revision. One row per scheduled item.
CREATE TABLE stops (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_city_id     uuid        NOT NULL REFERENCES trip_cities (id) ON DELETE CASCADE,
  plan_revision_id uuid        NOT NULL REFERENCES plan_revisions (id) ON DELETE CASCADE,
  poi_id           uuid        REFERENCES pois (id) ON DELETE SET NULL,  -- null for meal/break
  stop_kind        stop_kind   NOT NULL,
  day_index        integer     NOT NULL CHECK (day_index >= 0),
  ord              integer     NOT NULL CHECK (ord >= 0),
  start_time       timestamptz,
  end_time         timestamptz,
  est_duration     integer     CHECK (est_duration > 0),
  ticket_links     jsonb       NOT NULL DEFAULT '[]'
);

CREATE INDEX trip_places_trip_city_idx ON trip_places (trip_city_id);
CREATE INDEX place_votes_place_idx     ON place_votes (trip_place_id);
CREATE INDEX plan_revisions_tc_idx     ON plan_revisions (trip_city_id);
CREATE INDEX stops_revision_idx        ON stops (plan_revision_id);
CREATE INDEX stops_trip_city_idx       ON stops (trip_city_id);

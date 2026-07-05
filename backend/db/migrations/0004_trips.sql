-- 0004_trips — trips, trip_cities, trip_members, trip_invites, intercity_legs
-- (§10). Mirrors contracts/types/trips.ts. `ticket_links` is the jsonb column
-- shape from vault.ts (array of TicketLink), carried on parent entities.
--
-- NOTE ON ORDERING: trip_cities.city_id references `cities`, which is created in
-- 0005_brain. The FK is therefore added by 0005 (ALTER TABLE) once `cities`
-- exists; here city_id is a plain NOT NULL uuid. Every other FK in this file is
-- backward-referencing and inline.

CREATE TABLE trips (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name         text        NOT NULL,
  ticket_links jsonb       NOT NULL DEFAULT '[]',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- A city stay within a trip. No coordinate column here (canonical coords live
-- only on `pois`). city_id FK added in 0005.
CREATE TABLE trip_cities (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        uuid        NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  ord            integer     NOT NULL CHECK (ord >= 0),
  city_id        uuid        NOT NULL,
  arrive         date        NOT NULL,
  depart         date        NOT NULL,
  accommodation  jsonb,
  start_defaults jsonb,
  ticket_links   jsonb       NOT NULL DEFAULT '[]',
  UNIQUE (trip_id, ord)
);

CREATE TABLE trip_members (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id   uuid        NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role      trip_role   NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

CREATE TABLE trip_invites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid        NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  code       text        NOT NULL UNIQUE,
  role       trip_role   NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked    boolean     NOT NULL DEFAULT false,
  created_by uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Inter-city leg [P2]. from/to reference trip_cities (same file).
CREATE TABLE intercity_legs (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id           uuid          NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  from_trip_city_id uuid          REFERENCES trip_cities (id) ON DELETE SET NULL,
  to_trip_city_id   uuid          REFERENCES trip_cities (id) ON DELETE SET NULL,
  mode              intercity_mode NOT NULL,
  dep_time          timestamptz,
  arr_time          timestamptz,
  dep_place         text,
  arr_place         text,
  booking_ref       text,
  ticket_links      jsonb         NOT NULL DEFAULT '[]'
);

CREATE INDEX trip_cities_trip_idx    ON trip_cities (trip_id);
CREATE INDEX trip_members_trip_idx   ON trip_members (trip_id);
CREATE INDEX trip_members_user_idx   ON trip_members (user_id);
CREATE INDEX trip_invites_trip_idx   ON trip_invites (trip_id);
CREATE INDEX intercity_legs_trip_idx ON intercity_legs (trip_id);

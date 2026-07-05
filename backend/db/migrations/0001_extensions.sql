-- 0001_extensions — required Postgres extensions (§12).
-- PostGIS for POI geography; pgcrypto for gen_random_uuid() defaults.
-- (Postgres 13+ ships gen_random_uuid() in core, but pgcrypto is kept explicit
-- per the stack spec so the dependency is never implicit.)

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

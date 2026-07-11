-- Dev-only bootstrap for Supabase Realtime Broadcast-from-Database (§6.3, §12.1).
--
-- The realtime container runs its per-tenant "Realtime.Tenants.Migrations" against
-- THIS database the first time a client connects, creating the `realtime` schema
-- (realtime.messages, realtime.send(jsonb,text,text,boolean), realtime.broadcast_*,
-- the apply_rls/WAL helpers, …). Those migrations assume the environment the
-- official supabase/postgres image provides: an existing `realtime` schema and a
-- set of standard roles they GRANT to. The vanilla postgis/postgis image ships
-- neither, so without this file the tenant migrations abort with
--   ERROR: schema "realtime" does not exist
-- and the tenant is torn down (no Broadcast, no realtime.send for migration 0014's
-- intown_broadcast wrapper to call).
--
-- Postgres only runs /docker-entrypoint-initdb.d/* on FIRST cluster init (empty
-- data dir). On an already-populated `postgres_data` volume, recreate it
-- (`docker compose -f backend/infra/docker-compose.dev.yml down -v`) for this to
-- take effect, or apply the same statements by hand.
--
-- NONE of this touches the application schema or the intown_app/intown_auth roles
-- (created by migration 0011); it is realtime-tenant plumbing only, and CI (bare
-- Postgres, no realtime container) never loads it.

CREATE SCHEMA IF NOT EXISTS realtime;

-- Standard Supabase roles the tenant migrations GRANT to. NOLOGIN, no privileges
-- beyond what the migrations themselves assign — they exist only so the GRANT
-- statements resolve. Idempotent so a re-run (or a partially-seeded cluster) is safe.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'anon', 'authenticated', 'service_role',
    'supabase_admin', 'supabase_realtime_admin', 'dashboard_user', 'authenticator'
  ] LOOP
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $$;

GRANT ALL ON SCHEMA realtime TO postgres;
GRANT USAGE ON SCHEMA realtime TO anon, authenticated, service_role, supabase_realtime_admin;

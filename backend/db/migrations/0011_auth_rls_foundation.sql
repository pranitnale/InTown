-- 0011_auth_rls_foundation — P02 multi-tenant foundations (§16.1).
--
-- Turns the permissive RLS placeholders from 0010 into real per-user predicates
-- for the identity tables, introduces the two least-privilege application roles,
-- and adds the request-scoped `current_user_id()` helper every policy reads.
--
-- Role model (🧭 ET debt #11 — ET had no scope checks):
--   intown_auth  LOGIN, NOSUPERUSER, BYPASSRLS  — Auth.js session/account store;
--                must see every row regardless of the request user.
--   intown_app   LOGIN, NOSUPERUSER, no BYPASSRLS, NOT table owner — every
--                request handler connects as this role, so RLS actually applies.
-- The migrate/superuser role (owner) still bypasses RLS by ownership; that role
-- is used only for migrations, never to serve requests.

-- ---------------------------------------------------------------------------
-- Roles. Idempotent and deliberately created with NO effective password. The
-- migration runner provisions validated AUTH_DATABASE_URL / APP_DATABASE_URL
-- credentials only after the full chain succeeds; no committed credential is
-- ever effective, even briefly, on a fresh production database.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'intown_auth') THEN
    CREATE ROLE intown_auth LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS PASSWORD NULL;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'intown_app') THEN
    CREATE ROLE intown_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO intown_auth, intown_app;

-- Table privileges. Row visibility is still gated by RLS below; these grants are
-- the coarse table-level layer beneath the policies.
GRANT SELECT, INSERT, UPDATE, DELETE ON users, traveler_profiles, taste_profiles, consents
  TO intown_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, traveler_profiles, taste_profiles, consents
  TO intown_auth;

-- Identity tables use gen_random_uuid() defaults (no sequences), so there are no
-- sequence grants to make here. Future serial columns must add USAGE,SELECT.

-- ---------------------------------------------------------------------------
-- Request-scoped current user. Set per transaction by the app via
-- `SELECT set_config('app.current_user_id', <uuid>, true)`. When unset, this
-- returns NULL, so every `= current_user_id()` predicate evaluates to NULL
-- (false) and denies access by default.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Adapter fidelity: Auth.js maps `emailVerified`/`image` onto the users table.
-- The contract `User` type is a subset; these extra columns are additive and
-- never leave the API.
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image text;

-- ---------------------------------------------------------------------------
-- Real self predicates on the identity tables (replace 0010 placeholders).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_permissive ON users;
CREATE POLICY users_self ON users
  FOR ALL USING (id = current_user_id()) WITH CHECK (id = current_user_id());

DROP POLICY IF EXISTS traveler_profiles_permissive ON traveler_profiles;
CREATE POLICY traveler_profiles_self ON traveler_profiles
  FOR ALL USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

DROP POLICY IF EXISTS taste_profiles_permissive ON taste_profiles;
CREATE POLICY taste_profiles_self ON taste_profiles
  FOR ALL USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

DROP POLICY IF EXISTS consents_permissive ON consents;
CREATE POLICY consents_self ON consents
  FOR ALL USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

-- The trip / curation / community permissive policies from 0010 are DELIBERATELY
-- LEFT untouched here: P04 (profiles/GDPR) and P06 (trips) own tightening them,
-- and editing them now would create cross-phase merge contention.

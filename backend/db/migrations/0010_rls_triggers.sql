-- 0010_rls_triggers — updated_at maintenance, append-only enforcement, and RLS
-- scaffolding (§16). Policies here are PERMISSIVE placeholders; P02 (auth)
-- tightens them to real per-user / per-trip predicates.

-- ---------------------------------------------------------------------------
-- set_updated_at: stamp updated_at on every UPDATE of a mutable table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users', 'traveler_profiles', 'trips', 'cities', 'pois',
    'trip_places', 'reviews', 'user_pref_profiles', 'item_stats'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %1$I_set_updated_at BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tbl);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Append-only enforcement: block UPDATE and DELETE on the immutable logs
-- (§5.3, §5.5, §9.1, §10). Any legitimate teardown/erasure (trip deletion,
-- GDPR erasure) runs in a privileged maintenance routine that sets
-- `session_replication_role = 'replica'` to bypass these triggers; event
-- retention is done by dropping/detaching time partitions (DDL, not row DELETE),
-- so it is unaffected. `events.user_id`/`trip_id` are intentionally FK-free
-- pseudonymous keys (§16.1): erasing a user simply orphans the pseudonym while
-- anonymous aggregates survive — no cascade UPDATE/DELETE is ever issued here.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'table "%" is append-only: % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'facts', 'events', 'poi_geo_observations', 'plan_revisions'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %1$I_no_update BEFORE UPDATE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION reject_mutation()', tbl);
    EXECUTE format(
      'CREATE TRIGGER %1$I_no_delete BEFORE DELETE ON %1$I
         FOR EACH ROW EXECUTE FUNCTION reject_mutation()', tbl);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security on user-scoped tables. PERMISSIVE-for-now: enabled so the
-- posture is correct from day one, with a wide-open policy documented as
-- tightened in P02 (real predicates: owner/member of the trip, self for
-- identity rows). Shared catalog tables (cities, pois, facts, badges, …) are
-- intentionally left without RLS — they are not user-scoped.
-- ---------------------------------------------------------------------------
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users', 'traveler_profiles', 'taste_profiles', 'consents',
    'trips', 'trip_cities', 'trip_members', 'trip_invites', 'intercity_legs',
    'trip_places', 'place_votes', 'plan_revisions', 'stops',
    'reviews', 'corrections', 'want_to_go', 'user_badges',
    'events', 'user_pref_profiles', 'trip_documents'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    -- TODO(P02): replace with real per-user / per-trip predicates.
    EXECUTE format(
      'CREATE POLICY %1$I_permissive ON %1$I FOR ALL USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END;
$$;

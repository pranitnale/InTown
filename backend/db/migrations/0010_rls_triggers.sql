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
-- Append-only enforcement: block *direct* UPDATE and DELETE on the immutable
-- logs (§5.3, §5.5, §9.1, §10), while still allowing system-initiated FK
-- cascades to pass through. The guard fires only at `pg_trigger_depth() = 1`
-- (i.e. when this trigger is the outermost one — a client statement issued
-- straight against the log). Rows removed by an ON DELETE CASCADE arrive via
-- an internal FK-action trigger, so their append-only trigger runs at depth
-- > 1 and is permitted. This lets `plan_revisions` (users -> trips ->
-- trip_cities -> plan_revisions) and `poi_geo_observations` (cities -> pois ->
-- poi_geo_observations) be torn down by trip deletion / GDPR erasure / POI
-- purges, without opening a hole for direct edits.
-- `events.user_id`/`trip_id` carry NO FK (0008): they are pseudonymous keys
-- (§16.1) that are simply orphaned on erasure, so events are never cascaded.
-- Event retention is done by dropping/detaching time partitions (DDL, not row
-- DELETE), so it is likewise unaffected.
-- NB: do NOT use `session_replication_role = 'replica'` as an escape hatch — it
-- disables FK-action triggers too, so the very cascades this design relies on
-- would silently no-op, leaving orphaned children.
-- PROJECT CONVENTION (enforced by review, not by this guard): No trigger
-- function or function invoked via DML may ever perform INSERT-aside writes
-- (UPDATE/DELETE) against the four append-only tables (facts, events,
-- poi_geo_observations, plan_revisions) — nested DML runs at trigger depth > 1
-- and bypasses this guard by design (so that FK ON DELETE cascades from parent
-- rows can complete). The depth > 1 branch therefore admits ANY nested DML, not
-- only system FK cascades; the append-only law rests on this convention holding.
-- Any future migration adding a trigger that writes to these tables must be
-- reviewed against this rule.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Only reject when this is the outermost trigger (a direct client DML).
  -- Cascaded deletes reach here at depth > 1 and are allowed through.
  IF pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'table "%" is append-only: % is not permitted', TG_TABLE_NAME, TG_OP
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
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

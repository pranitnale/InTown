-- 0017_production_blocker_repairs — security/privacy/correctness repairs found
-- during the P00-P08 production audit. This migration is intentionally additive
-- for deployed databases; 0011 is also safe for a brand-new chain.

-- ---------------------------------------------------------------------------
-- Database login credentials.
-- ---------------------------------------------------------------------------
-- Clear the two historically committed dev passwords before any explicit
-- reprovision. If deployment is interrupted after this migration, both roles
-- fail closed instead of retaining a known credential.
ALTER ROLE intown_auth
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS PASSWORD NULL;
ALTER ROLE intown_app
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;

-- Parameterized boundary used only by the migration owner. The Node runner calls
-- it with bind parameters, so passwords never appear in query text/application
-- logs. Role names are an exact allowlist; attributes are reasserted every run.
CREATE OR REPLACE FUNCTION intown_provision_role(p_role text, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog AS $$
BEGIN
  IF p_password IS NULL OR char_length(p_password) = 0 OR char_length(p_password) > 1024 THEN
    RAISE EXCEPTION 'database role password must contain 1..1024 characters'
      USING ERRCODE = '22023';
  END IF;

  IF p_role = 'intown_auth' THEN
    EXECUTE format(
      'ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS PASSWORD %L',
      p_role, p_password
    );
  ELSIF p_role = 'intown_app' THEN
    EXECUTE format(
      'ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
      p_role, p_password
    );
  ELSE
    RAISE EXCEPTION 'role is not provisionable' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION intown_provision_role(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION intown_provision_role(text, text) FROM intown_auth, intown_app;

-- ---------------------------------------------------------------------------
-- Per-row monotonic trip-place versions.
-- ---------------------------------------------------------------------------
ALTER TABLE trip_places
  ADD COLUMN version bigint NOT NULL DEFAULT 1 CHECK (version > 0);

CREATE OR REPLACE FUNCTION bump_trip_place_version() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trip_places_version_bump
  BEFORE UPDATE ON trip_places
  FOR EACH ROW EXECUTE FUNCTION bump_trip_place_version();

REVOKE ALL ON FUNCTION bump_trip_place_version() FROM PUBLIC;

-- Private Broadcast-from-Database boundary. P15 must mint member-scoped Realtime
-- JWTs and install realtime.messages topic policies before clients subscribe;
-- until then private sends are persisted/fanned out only to authorized clients.
CREATE OR REPLACE FUNCTION intown_broadcast(event text, trip uuid, payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  IF trip IS NULL THEN
    RETURN;
  END IF;
  IF event IS NULL OR char_length(event) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'invalid realtime event name' USING ERRCODE = '22023';
  END IF;
  IF payload IS NULL OR pg_column_size(payload) > 65536 THEN
    RAISE EXCEPTION 'realtime payload exceeds 64 KiB' USING ERRCODE = '22023';
  END IF;
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
    RETURN;
  END IF;
  PERFORM realtime.send(payload, event, 'trip:' || trip::text, true);
END;
$$;

REVOKE ALL ON FUNCTION intown_broadcast(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION intown_broadcast(text, uuid, jsonb) TO intown_app;

CREATE OR REPLACE FUNCTION broadcast_trip_place() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM intown_broadcast('place_added', trip_id_of_city(NEW.trip_city_id),
      jsonb_build_object(
        'type', 'place_added',
        'trip_place_id', NEW.id,
        'trip_city_id', NEW.trip_city_id,
        'poi_id', NEW.poi_id,
        'position', NEW.position,
        'state', NEW.state,
        'added_by', NEW.added_by,
        'version', NEW.version,
        'at', NEW.updated_at
      ));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.position LIKE '~%' THEN
      RETURN NEW;
    END IF;
    PERFORM intown_broadcast('place_updated', trip_id_of_city(NEW.trip_city_id),
      jsonb_build_object(
        'type', 'place_updated',
        'trip_place_id', NEW.id,
        'position', CASE WHEN OLD.position IS DISTINCT FROM NEW.position THEN NEW.position END,
        'state', CASE WHEN OLD.state IS DISTINCT FROM NEW.state THEN NEW.state END,
        'updated_by', current_user_id(),
        'version', NEW.version,
        'at', NEW.updated_at
      ));
    RETURN NEW;
  ELSE
    PERFORM intown_broadcast('place_removed', trip_id_of_city(OLD.trip_city_id),
      jsonb_build_object(
        'type', 'place_removed',
        'trip_place_id', OLD.id,
        'removed_by', current_user_id(),
        -- DELETE has no NEW row to persist; the removal follows the last stored
        -- row version and therefore uses the next monotonic value on the wire.
        'version', OLD.version + 1,
        'at', clock_timestamp()
      ));
    RETURN OLD;
  END IF;
END;
$$;

-- Preference disclosure is aggregate-only. This definer trigger reads all vote
-- rows to emit a tally but never includes user_id or an individual's vote.
CREATE OR REPLACE FUNCTION broadcast_place_vote() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_place uuid;
  v_trip uuid;
  v_up integer;
  v_down integer;
  v_members integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_place := OLD.trip_place_id;
  ELSE
    v_place := NEW.trip_place_id;
  END IF;

  SELECT tc.trip_id INTO v_trip
  FROM public.trip_places tp
  JOIN public.trip_cities tc ON tc.id = tp.trip_city_id
  WHERE tp.id = v_place;

  IF v_trip IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT
    count(*) FILTER (WHERE vote = 'up')::integer,
    count(*) FILTER (WHERE vote = 'down')::integer
  INTO v_up, v_down
  FROM public.place_votes
  WHERE trip_place_id = v_place;

  SELECT count(*)::integer INTO v_members
  FROM public.trip_members
  WHERE trip_id = v_trip;

  PERFORM public.intown_broadcast('vote_tally_updated', v_trip,
    jsonb_build_object(
      'type', 'vote_tally_updated',
      'trip_place_id', v_place,
      'up', coalesce(v_up, 0),
      'down', coalesce(v_down, 0),
      'member_count', coalesce(v_members, 0),
      'at', clock_timestamp()
    ));
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS place_votes_broadcast ON place_votes;
CREATE TRIGGER place_votes_broadcast
  AFTER INSERT OR UPDATE OR DELETE ON place_votes
  FOR EACH ROW EXECUTE FUNCTION broadcast_place_vote();

REVOKE ALL ON FUNCTION broadcast_place_vote() FROM PUBLIC;

-- Pin every existing broadcast trigger function's resolution context.
ALTER FUNCTION broadcast_member_joined() SET search_path = pg_catalog, public;
ALTER FUNCTION broadcast_plan_updated() SET search_path = pg_catalog, public;

-- ---------------------------------------------------------------------------
-- Durable geo source identity and pairwise-safe consensus.
-- ---------------------------------------------------------------------------
-- Existing rows remain nullable legacy observations. Every INSERT after this
-- migration must carry a normalized provider plus its durable upstream record
-- id (for example `openstreetmap` + `node/123`).
ALTER TABLE poi_geo_observations
  ADD COLUMN source_provider text,
  ADD COLUMN source_record_id text,
  ADD CONSTRAINT poi_geo_obs_source_identity_pair_chk CHECK (
    (source_provider IS NULL AND source_record_id IS NULL)
    OR (
      source_provider IS NOT NULL
      AND source_record_id IS NOT NULL
      AND char_length(source_provider) BETWEEN 2 AND 100
      AND source_provider = lower(btrim(source_provider))
      AND source_provider ~ '^[a-z0-9][a-z0-9._-]*$'
      AND char_length(source_record_id) BETWEEN 1 AND 500
      AND source_record_id = btrim(source_record_id)
      AND source_record_id !~ '[[:cntrl:]]'
    )
  );

CREATE INDEX poi_geo_obs_source_identity_idx
  ON poi_geo_observations (source_provider, source_record_id)
  WHERE source_provider IS NOT NULL;

CREATE OR REPLACE FUNCTION require_geo_source_identity() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.source_provider IS NULL OR NEW.source_record_id IS NULL THEN
    RAISE EXCEPTION 'new geo observations require source_provider and source_record_id'
      USING ERRCODE = '23514', CONSTRAINT = 'poi_geo_obs_new_source_identity_chk';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER poi_geo_obs_require_identity
  BEFORE INSERT ON poi_geo_observations
  FOR EACH ROW EXECUTE FUNCTION require_geo_source_identity();

REVOKE ALL ON FUNCTION require_geo_source_identity() FROM PUBLIC;

-- One best observation per provider contributes to the centroid. A coordinate
-- is verified only when at least two independent providers contribute AND every
-- contributing provider pair is <=100m apart. This closes the old centroid-only
-- bug where two points 180-200m apart could each sit <=100m from their midpoint.
CREATE OR REPLACE FUNCTION poi_recompute_coord(p_poi_id uuid) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE
  canon             uuid;
  v_sum_w           double precision;
  v_sum_wlat        double precision;
  v_sum_wlng        double precision;
  v_max_conf        double precision;
  v_has_gps         boolean;
  v_centroid        geography;
  v_provider_count  integer;
  v_max_pair_m      double precision;
BEGIN
  SELECT coalesce(merged_into, id) INTO canon FROM public.pois WHERE id = p_poi_id;
  IF canon IS NULL THEN
    RETURN;
  END IF;

  WITH eligible AS (
    SELECT
      o.id,
      o.lat,
      o.lng,
      o.confidence,
      o.source_kind,
      o.observed_at,
      coalesce(o.source_provider, 'legacy-' || o.source_kind::text) AS provider_key,
      coalesce(o.source_provider, 'legacy-' || o.source_kind::text)
        || chr(31)
        || coalesce(o.source_record_id, 'legacy-row-' || o.id::text) AS identity_key,
      o.confidence
        * (1.0 / (1.0 + coalesce(o.accuracy_m, 100.0) / 50.0))
        * CASE
            WHEN o.source_kind = 'first_traveler_gps'
              THEN exp(-(extract(epoch FROM (clock_timestamp() - o.observed_at)) / 86400.0) / 180.0)
            ELSE 1.0
          END AS w
    FROM public.poi_geo_observations o
    JOIN public.pois p ON p.id = o.poi_id
    WHERE (p.id = canon OR p.merged_into = canon)
      AND (o.expires_at IS NULL OR o.expires_at > clock_timestamp())
      AND o.source_kind <> 'google_fallback'
  ), identity_dedup AS (
    SELECT DISTINCT ON (identity_key)
      identity_key, provider_key, lat, lng, confidence, source_kind, observed_at, id, w
    FROM eligible
    ORDER BY identity_key, w DESC, observed_at DESC, id
  ), contributing AS (
    SELECT DISTINCT ON (provider_key)
      provider_key, lat, lng, confidence, source_kind, w
    FROM identity_dedup
    ORDER BY provider_key, w DESC, observed_at DESC, id
  )
  SELECT
    sum(w),
    sum(w * lat),
    sum(w * lng),
    max(confidence),
    bool_or(source_kind = 'first_traveler_gps'),
    count(*)::integer
  INTO v_sum_w, v_sum_wlat, v_sum_wlng, v_max_conf, v_has_gps, v_provider_count
  FROM contributing;

  IF v_sum_w IS NULL OR v_sum_w <= 0 THEN
    UPDATE public.pois
       SET coord             = NULL,
           coord_confidence  = NULL,
           coord_verified_by = NULL,
           coord_resolution  = 'unverified'
     WHERE id = canon;
    RETURN;
  END IF;

  v_centroid := ST_SetSRID(
    ST_MakePoint(v_sum_wlng / v_sum_w, v_sum_wlat / v_sum_w), 4326
  )::geography;

  WITH eligible AS (
    SELECT
      o.id,
      o.lat,
      o.lng,
      o.confidence,
      o.observed_at,
      coalesce(o.source_provider, 'legacy-' || o.source_kind::text) AS provider_key,
      coalesce(o.source_provider, 'legacy-' || o.source_kind::text)
        || chr(31)
        || coalesce(o.source_record_id, 'legacy-row-' || o.id::text) AS identity_key,
      o.confidence
        * (1.0 / (1.0 + coalesce(o.accuracy_m, 100.0) / 50.0))
        * CASE
            WHEN o.source_kind = 'first_traveler_gps'
              THEN exp(-(extract(epoch FROM (clock_timestamp() - o.observed_at)) / 86400.0) / 180.0)
            ELSE 1.0
          END AS w
    FROM public.poi_geo_observations o
    JOIN public.pois p ON p.id = o.poi_id
    WHERE (p.id = canon OR p.merged_into = canon)
      AND (o.expires_at IS NULL OR o.expires_at > clock_timestamp())
      AND o.source_kind <> 'google_fallback'
  ), identity_dedup AS (
    SELECT DISTINCT ON (identity_key)
      identity_key, provider_key, lat, lng, observed_at, id, w
    FROM eligible
    ORDER BY identity_key, w DESC, observed_at DESC, id
  ), contributing AS (
    SELECT DISTINCT ON (provider_key) provider_key, lat, lng
    FROM identity_dedup
    ORDER BY provider_key, w DESC, observed_at DESC, id
  )
  SELECT max(ST_Distance(
    ST_SetSRID(ST_MakePoint(a.lng, a.lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(b.lng, b.lat), 4326)::geography
  ))
  INTO v_max_pair_m
  FROM contributing a
  JOIN contributing b ON a.provider_key < b.provider_key;

  IF v_provider_count >= 2 AND coalesce(v_max_pair_m, 1e100) <= 100.0 THEN
    UPDATE public.pois
       SET coord             = v_centroid,
           coord_resolution  = 'verified',
           coord_verified_by = 'cross_referenced',
           coord_confidence  = least(0.99, v_max_conf)
     WHERE id = canon;
  ELSE
    UPDATE public.pois
       SET coord             = v_centroid,
           coord_resolution  = 'approximate',
           coord_verified_by = (
             CASE WHEN v_has_gps THEN 'first_traveler_gps' ELSE 'open_data' END
           )::public.coord_verified_by,
           coord_confidence  = v_max_conf * 0.6
     WHERE id = canon;
  END IF;
END;
$$;

-- The trigger boundary runs recomputation as the schema owner; callers need
-- only INSERT privilege, never UPDATE privilege on the derived pois fields.
ALTER FUNCTION poi_geo_obs_recompute() SECURITY DEFINER;
ALTER FUNCTION poi_geo_obs_recompute() SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION poi_geo_obs_recompute() FROM PUBLIC;
REVOKE ALL ON FUNCTION poi_recompute_coord(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Existing function hardening: fixed lookup paths + least privilege.
-- ---------------------------------------------------------------------------
ALTER FUNCTION current_user_id() SET search_path = pg_catalog;

ALTER FUNCTION trip_role_of(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION is_trip_owner(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION is_trip_member(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION is_trip_editor(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION trip_id_of_city(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION trip_id_of_place(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION trip_role_rank(trip_role) SET search_path = pg_catalog, public;
ALTER FUNCTION redeem_invite(text) SET search_path = pg_catalog, public;
ALTER FUNCTION place_vote_counts(uuid) SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION trip_role_of(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_trip_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_trip_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_trip_editor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION trip_id_of_city(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION trip_id_of_place(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION trip_role_rank(trip_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION redeem_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION place_vote_counts(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION current_user_id() TO intown_app;
GRANT EXECUTE ON FUNCTION trip_role_of(uuid) TO intown_app;
GRANT EXECUTE ON FUNCTION is_trip_owner(uuid) TO intown_app;
GRANT EXECUTE ON FUNCTION is_trip_member(uuid) TO intown_app;
GRANT EXECUTE ON FUNCTION is_trip_editor(uuid) TO intown_app;
GRANT EXECUTE ON FUNCTION trip_id_of_city(uuid) TO intown_app;
GRANT EXECUTE ON FUNCTION trip_id_of_place(uuid) TO intown_app;
GRANT EXECUTE ON FUNCTION redeem_invite(text) TO intown_app;
GRANT EXECUTE ON FUNCTION place_vote_counts(uuid) TO intown_app;

ALTER FUNCTION category_compatible(category, category) SET search_path = pg_catalog, public;
ALTER FUNCTION poi_find_by_external_id(uuid, text, text) SET search_path = pg_catalog, public;
ALTER FUNCTION poi_match_candidates(uuid, text, category, double precision, double precision)
  SET search_path = pg_catalog, public;
ALTER FUNCTION poi_merge(uuid, uuid, text, text) SET search_path = pg_catalog, public;
ALTER FUNCTION poi_unmerge(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION poi_geo_purge_expired() SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION category_compatible(category, category) FROM PUBLIC;
REVOKE ALL ON FUNCTION poi_find_by_external_id(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION poi_match_candidates(uuid, text, category, double precision, double precision)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION poi_merge(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION poi_unmerge(uuid) FROM PUBLIC;

-- 0015_brain_grants_geo — P08 City Brain, WP-A part 1: app-role grants, the
-- geo-consensus recompute + display gate (§5.5, D52/D53), and the expiry purge.
--
-- This migration is the DB-level source of truth for POI coordinate law; the TS
-- API (P09) and Python pipeline (P11) call these functions rather than
-- re-deriving coordinates in application code.
--
-- SPLIT WITH 0016 (entity resolution): the `pois.merged_into` redirect column is
-- added HERE (before poi_recompute_coord, which must read the merge group), while
-- the poi_merges table and the merge/unmerge/matcher functions live in 0016. This
-- keeps recompute self-contained in 0015 and the resolution machinery in 0016,
-- with no forward reference to a column that would not yet exist.
--
-- COORDINATE LAW (§5.5, D52/D53):
--   * The LLM never emits coordinates; `pois.coord` is DERIVED from the append-only
--     `poi_geo_observations` log and is NULL until grounded.
--   * `google_fallback` observations are NEVER canonical (Google ToS): they are
--     excluded from the centroid, agreement, and confidence entirely, so the
--     canonical coord stays correct even if a purge of expired rows is skipped.
--   * `coord_resolution` is the display gate: 'verified' iff >= 2 independent
--     sources agree within 100 m; navigability == (resolution = 'verified').
--
-- TUNABLES (encoded below; change is a doctrine decision, not a config tweak):
--   * agreement radius              = 100 m
--   * first-traveler GPS decay tau  = 180 days (half-life-ish recency window)
--   * accuracy penalty scale        = 50 m  (weight = 1/(1 + accuracy_m/50))
--   * unknown-accuracy assumption   = 100 m  (NULL accuracy_m → assumed ~100 m,
--     so weight = 1/(1 + 100/50) = 1/3; we must NOT treat an unstated accuracy
--     as perfect, or an OSM/open-data row with no accuracy would outweigh a
--     precise GPS fix. 100 m is a deliberately conservative "coarse but usable"
--     default sitting just at the agreement-radius boundary.)
--
-- CAVEAT: the centroid is a weighted arithmetic mean of raw lat/lng, which is
-- invalid near the antimeridian (±180° wrap) and the poles. This is acceptable
-- for city-scale POI clusters (all observations for one POI sit within metres of
-- each other) but must NOT be reused for globe-spanning point sets.

-- ---------------------------------------------------------------------------
-- pg_trgm powers the fuzzy name matcher in 0016 (similarity(), gin_trgm_ops).
-- Plain (non-CONCURRENTLY) so it is transactional inside migrate.ts's per-file txn.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- App-role table grants. The Brain catalog tables were created by the owner role
-- in 0005/0007 with NO privileges for intown_app, so read routes served on the
-- app pool would 500. These tables are shared catalog (not user-scoped), so they
-- carry no RLS and SELECT is the whole story. Writes stay with the owner /
-- pipeline role. intown_auth (BYPASSRLS session store) needs nothing here.
-- ---------------------------------------------------------------------------
GRANT SELECT ON
  cities, pois, facts, poi_hours, poi_enrichment, poi_geo_observations,
  reviews, scenic_legs, transit_passes, city_briefs
  TO intown_app;

-- ---------------------------------------------------------------------------
-- Merge redirect column (used by 0016's poi_merge/poi_unmerge). A merged POI
-- points at the POI it was folded into; canonical POIs have merged_into IS NULL.
-- ON DELETE SET NULL so deleting a kept POI orphans (rather than cascades) its
-- former duplicates. Partial index accelerates the merge-group scan in recompute.
-- ---------------------------------------------------------------------------
ALTER TABLE pois
  ADD COLUMN merged_into uuid REFERENCES pois (id) ON DELETE SET NULL;

CREATE INDEX pois_merged_into_idx ON pois (merged_into) WHERE merged_into IS NOT NULL;

-- Trigram GIN index on pois.name. NOTE: this index does NOT accelerate the 0016
-- similarity matcher — a `similarity(a, b) >= x` predicate cannot use a GIN
-- gin_trgm_ops index (only the % and LIKE/ILIKE operator families can; <-> KNN is
-- GiST-only), and
-- the matcher instead relies on a city + category-pruned sequential scan, which is
-- fine at city scale. The real beneficiary is the /api/pois/search route
-- (backend/api/src/pois/routes.ts), whose `name ILIKE '%q%'` filter this index
-- accelerates via gin_trgm_ops.
CREATE INDEX pois_name_trgm_gix ON pois USING gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- ToS law at the schema level (D53): a google_fallback observation is ToS-limited
-- and MUST carry an expires_at, so it can never outlive its permitted retention.
-- Enforced as a CHECK rather than left to application discipline — recompute
-- already excludes google_fallback rows, but this guarantees none can be stored
-- without an expiry in the first place.
-- ---------------------------------------------------------------------------
ALTER TABLE poi_geo_observations
  ADD CONSTRAINT poi_geo_obs_google_expires_chk
  CHECK (source_kind <> 'google_fallback' OR expires_at IS NOT NULL);

-- ---------------------------------------------------------------------------
-- poi_recompute_coord(p_poi_id) — re-derive the canonical coordinate + display
-- gate for a POI's merge group from the eligible observation log. Idempotent;
-- safe to call for any POI id (self-resolves to the canonical head).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION poi_recompute_coord(p_poi_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  canon       uuid;
  v_sum_w     double precision;
  v_sum_wlat  double precision;
  v_sum_wlng  double precision;
  v_max_conf  double precision;
  v_has_gps   boolean;
  v_centroid  geography;
  v_agree     integer;
BEGIN
  -- Canonical head of the merge group: this POI unless it was itself merged away.
  SELECT coalesce(merged_into, id) INTO canon FROM pois WHERE id = p_poi_id;
  IF canon IS NULL THEN
    RETURN;  -- POI does not exist
  END IF;

  -- Weighted sums over eligible observations across the whole group. Eligibility:
  -- not expired, and never a google_fallback row (D52/D53 — never canonical).
  -- weight = confidence
  --        * 1/(1 + accuracy_m/50)                       (accuracy penalty)
  --        * exp(-age_days/180)  for first_traveler_gps  (recency decay), else 1.
  WITH elig AS (
    SELECT
      o.lat,
      o.lng,
      o.confidence,
      o.source_kind,
      o.confidence
        * (1.0 / (1.0 + coalesce(o.accuracy_m, 100.0) / 50.0))  -- NULL accuracy → ~100 m, not perfect
        * CASE
            WHEN o.source_kind = 'first_traveler_gps'
              THEN exp(-(extract(epoch FROM (now() - o.observed_at)) / 86400.0) / 180.0)
            ELSE 1.0
          END AS w
    FROM poi_geo_observations o
    JOIN pois p ON p.id = o.poi_id
    WHERE (p.id = canon OR p.merged_into = canon)
      AND (o.expires_at IS NULL OR o.expires_at > now())
      AND o.source_kind <> 'google_fallback'
  )
  SELECT
    sum(w),
    sum(w * lat),
    sum(w * lng),
    max(confidence),
    bool_or(source_kind = 'first_traveler_gps')
  INTO v_sum_w, v_sum_wlat, v_sum_wlng, v_max_conf, v_has_gps
  FROM elig;

  -- No eligible observations → ungrounded. Clear coord and reset the display gate.
  IF v_sum_w IS NULL OR v_sum_w <= 0 THEN
    UPDATE pois
       SET coord             = NULL,
           coord_confidence  = NULL,
           coord_verified_by = NULL,
           coord_resolution  = 'unverified'
     WHERE id = canon;
    RETURN;
  END IF;

  v_centroid := ST_SetSRID(ST_MakePoint(v_sum_wlng / v_sum_w, v_sum_wlat / v_sum_w), 4326)::geography;

  -- Independence = DISTINCT source_kind among eligible obs whose point sits within
  -- the 100 m agreement radius of the candidate centroid.
  SELECT count(DISTINCT o.source_kind)
    INTO v_agree
  FROM poi_geo_observations o
  JOIN pois p ON p.id = o.poi_id
  WHERE (p.id = canon OR p.merged_into = canon)
    AND (o.expires_at IS NULL OR o.expires_at > now())
    AND o.source_kind <> 'google_fallback'
    AND ST_DWithin(ST_SetSRID(ST_MakePoint(o.lng, o.lat), 4326)::geography, v_centroid, 100);

  IF v_agree >= 2 THEN
    UPDATE pois
       SET coord             = v_centroid,
           coord_resolution  = 'verified',
           coord_verified_by = 'cross_referenced',
           coord_confidence  = least(0.99, v_max_conf)
     WHERE id = canon;
  ELSE
    UPDATE pois
       SET coord             = v_centroid,
           coord_resolution  = 'approximate',
           coord_verified_by = (CASE WHEN v_has_gps THEN 'first_traveler_gps' ELSE 'open_data' END)::coord_verified_by,
           coord_confidence  = v_max_conf * 0.6
     WHERE id = canon;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Statement-level AFTER INSERT trigger: recompute each POI touched by a batch of
-- new observations, once per distinct poi_id (a bulk backfill of one POI's
-- observations recomputes it a single time). Uses a NEW TABLE transition set so a
-- multi-row INSERT does not fan out to one recompute per row.
--
-- APPEND-ONLY SAFETY (§ 0010 convention): this trigger only READS
-- poi_geo_observations and UPDATEs the mutable `pois` table. It never writes any
-- append-only log, so it does not depend on (or abuse) the pg_trigger_depth()
-- escape hatch in reject_mutation().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION poi_geo_obs_recompute() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT poi_id FROM new_table LOOP
    PERFORM poi_recompute_coord(r.poi_id);
  END LOOP;
  RETURN NULL;  -- AFTER STATEMENT trigger: return value is ignored.
END;
$$;

CREATE TRIGGER poi_geo_obs_recompute_aist
  AFTER INSERT ON poi_geo_observations
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT EXECUTE FUNCTION poi_geo_obs_recompute();

-- ---------------------------------------------------------------------------
-- poi_geo_purge_expired() — hard-delete observations past their expires_at, then
-- recompute every affected POI. Returns the number of rows deleted.
--
-- poi_geo_observations is append-only (0010 blocks direct DELETE via the
-- `poi_geo_observations_no_delete` trigger). This is the ONE sanctioned deletion
-- path: SECURITY DEFINER (runs as the table owner) so it can DISABLE that guard
-- trigger for the duration of the purge, then re-enable it. The re-enable is
-- wrapped in an EXCEPTION block so a failed DELETE never leaves the guard off; the
-- error is re-raised after restoring it.
--
-- OPERATIONAL NOTE: DISABLE/ENABLE TRIGGER takes a brief ACCESS EXCLUSIVE lock on
-- the table — run off-peak. Skipping the purge is NEVER a correctness problem:
-- poi_recompute_coord already excludes expired (and google_fallback) rows, so the
-- canonical coord ignores them whether or not they have been physically removed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION poi_geo_purge_expired() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_affected uuid[];
  v_deleted  integer := 0;
  r          uuid;
BEGIN
  SELECT array_agg(DISTINCT poi_id) INTO v_affected
  FROM poi_geo_observations
  WHERE expires_at <= now();

  IF v_affected IS NULL THEN
    RETURN 0;  -- nothing expired
  END IF;

  ALTER TABLE poi_geo_observations DISABLE TRIGGER poi_geo_observations_no_delete;
  BEGIN
    DELETE FROM poi_geo_observations WHERE expires_at <= now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    -- Always restore the append-only guard, even on failure, before re-raising.
    ALTER TABLE poi_geo_observations ENABLE TRIGGER poi_geo_observations_no_delete;
    RAISE;
  END;
  ALTER TABLE poi_geo_observations ENABLE TRIGGER poi_geo_observations_no_delete;

  FOREACH r IN ARRAY v_affected LOOP
    PERFORM poi_recompute_coord(r);
  END LOOP;

  RETURN v_deleted;
END;
$$;

-- Purge is an operator/maintenance routine, not something any logged-in role may
-- invoke — it disables an append-only guard. Lock it down to the owner.
REVOKE ALL ON FUNCTION poi_geo_purge_expired() FROM PUBLIC;

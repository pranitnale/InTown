-- 0016_brain_resolution — P08 City Brain, WP-A part 2: entity resolution. The
-- duplicate-detection matcher and the merge/unmerge machinery that fold two POI
-- rows into one canonical place (§5.4 dedup, D23/D31).
--
-- Builds on 0015, which added the `pois.merged_into` redirect column and
-- poi_recompute_coord(). Facts and observations are NEVER moved on merge (both
-- are append-only logs); reads resolve a duplicate to its canonical head via the
-- merged_into redirect, and poi_recompute_coord folds the merge group's
-- observations into one coordinate.
--
-- MATCH CASCADE (callers, P09/P11): (1) exact external-id hit via
-- poi_find_by_external_id, then (2) fuzzy name + category + geo via
-- poi_match_candidates. Both live in SQL so the pipeline and the API agree.

-- ---------------------------------------------------------------------------
-- poi_merges — audit log + undo journal for merges. kept_snapshot preserves the
-- exact {source_refs, external_ids} of the kept POI *before* the union, so
-- poi_unmerge can restore it byte-for-byte. undone_at NULL == the merge is live.
-- ---------------------------------------------------------------------------
CREATE TABLE poi_merges (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kept_poi_id   uuid        NOT NULL REFERENCES pois (id) ON DELETE CASCADE,
  merged_poi_id uuid        NOT NULL REFERENCES pois (id) ON DELETE CASCADE,
  kept_snapshot jsonb       NOT NULL,                 -- {source_refs, external_ids} pre-merge
  reason        text,
  actor         text,
  merged_at     timestamptz NOT NULL DEFAULT now(),
  undone_at     timestamptz
);

-- One live merge per kept POI is the common lookup; also index the merged side
-- for the unmerge journal scan.
CREATE INDEX poi_merges_kept_active_idx ON poi_merges (kept_poi_id) WHERE undone_at IS NULL;
CREATE INDEX poi_merges_merged_idx      ON poi_merges (merged_poi_id);

GRANT SELECT ON poi_merges TO intown_app;

-- GIN (jsonb_path_ops) on external_ids so poi_find_by_external_id's containment
-- probe (`external_ids @> '{key:value}'`) is index-backed.
CREATE INDEX pois_external_ids_gin ON pois USING gin (external_ids jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- category_compatible(a, b) — may two POIs of these categories be the same place?
-- Symmetric. True on equality, on the near-synonym pairs below, or when either
-- side is OTHER (the catch-all bucket must never block a merge). IMMUTABLE + no
-- table access, so it inlines into the matcher's WHERE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION category_compatible(a category, b category) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT a = b
      OR a = 'OTHER' OR b = 'OTHER'
      OR (a, b) IN (
           ('CAFE', 'RESTAURANT'),        ('RESTAURANT', 'CAFE'),
           ('MUSEUM', 'SIGHT'),           ('SIGHT', 'MUSEUM'),
           ('SIGHT', 'VIEWPOINT'),        ('VIEWPOINT', 'SIGHT'),
           ('PARK_NATURE', 'VIEWPOINT'),  ('VIEWPOINT', 'PARK_NATURE')
         )
$$;

-- ---------------------------------------------------------------------------
-- poi_find_by_external_id(city, key, value) — ID-first resolution. Returns the
-- canonical (non-merged) POI in the city carrying external_ids[key] == value, or
-- NULL. Uses a jsonb containment probe so the pois_external_ids_gin index applies.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION poi_find_by_external_id(p_city_id uuid, p_key text, p_value text)
RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT id
  FROM pois
  WHERE city_id = p_city_id
    AND merged_into IS NULL
    AND external_ids @> jsonb_build_object(p_key, to_jsonb(p_value))
  LIMIT 1
$$;

-- ---------------------------------------------------------------------------
-- poi_match_candidates(city, name, category, lat, lng) — fuzzy duplicate search.
-- Candidates are canonical POIs in the same city whose category is compatible and
-- whose name (or best alias) has trigram similarity >= 0.45 to the probe name.
-- When BOTH the candidate coord and the probe lat/lng are known, the candidate
-- must also sit within 150 m; if either side lacks coordinates the geo gate is
-- skipped (name + category only).
--
-- name_sim = greatest(similarity(name, probe), max alias similarity). Aliases are
-- a text[] on pois, so each is scored with the same trigram similarity.
--
-- SCORING:
--   * known distance: score = 0.6*name_sim + 0.4*geo_score,
--                     geo_score = greatest(0, 1 - dist/150).
--   * unknown distance (either side coord-less): score = name_sim.
--     DESIGN CHOICE — we do NOT multiply by 0.6 when distance is unknown. A
--     genuinely correct but not-yet-grounded candidate would otherwise be capped
--     at 0.6 and rank below any weaker but coord-bearing candidate, defeating the
--     "resolve before we have a coordinate" case. Keeping name_sim on the same
--     [0,1] scale lets a strong name match win when geo is simply unavailable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION poi_match_candidates(
  p_city_id  uuid,
  p_name     text,
  p_category category,
  p_lat      double precision,
  p_lng      double precision
)
RETURNS TABLE (poi_id uuid, name_sim real, dist_m double precision, score real)
LANGUAGE sql STABLE AS $$
  WITH probe AS (
    SELECT CASE
             WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
               THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
           END AS pt
  ),
  cand AS (
    SELECT
      p.id,
      p.coord,
      greatest(
        similarity(p.name, p_name),
        coalesce((SELECT max(similarity(a, p_name)) FROM unnest(p.aliases) AS a), 0)
      )::real AS name_sim
    FROM pois p
    WHERE p.city_id = p_city_id
      AND p.merged_into IS NULL
      AND category_compatible(p.category, p_category)
  ),
  scored AS (
    SELECT
      c.id,
      c.name_sim,
      CASE
        WHEN c.coord IS NOT NULL AND probe.pt IS NOT NULL
          THEN ST_Distance(c.coord, probe.pt)
      END AS dist_m,
      (c.coord IS NULL OR probe.pt IS NULL OR ST_DWithin(c.coord, probe.pt, 150)) AS geo_ok
    FROM cand c, probe
    WHERE c.name_sim >= 0.45
  )
  SELECT
    s.id AS poi_id,
    s.name_sim,
    s.dist_m,
    (CASE
       WHEN s.dist_m IS NULL THEN s.name_sim
       ELSE 0.6 * s.name_sim + 0.4 * greatest(0, 1 - s.dist_m / 150.0)
     END)::real AS score
  FROM scored s
  WHERE s.geo_ok
  ORDER BY score DESC
$$;

-- ---------------------------------------------------------------------------
-- poi_merge(kept, merged, reason, actor) — fold `merged` into `kept`. Guards
-- against self-merge, missing rows, and either side already being merged; locks
-- both rows FOR UPDATE. Snapshots the kept POI's mergeable state, unions
-- source_refs (dedup by whole element) and external_ids (kept wins on key
-- conflict), redirects merged.merged_into → kept, and recomputes the coordinate
-- (which now sees both POIs' observations). Facts/observations are left in place.
--
-- NO-CHAIN INVARIANT: merged_into always points at a canonical (never-merged)
-- POI — chains (A→B→C) are impossible. This is what lets canon resolution
-- (`coalesce(merged_into, id)`) and the merge-group scan
-- (`id = canon OR merged_into = canon`) stay strictly one-hop. It is enforced two
-- ways: `merged` must not already be merged (checked below), AND `merged` must
-- have NO incoming redirects (no other POI points at it) — otherwise folding it
-- into `kept` would strand its children one hop too deep. Attempting either
-- RAISEs. OPERATIONAL WORKAROUND to re-parent a group: unmerge the children
-- first (LIFO — newest merge first, see poi_unmerge), then merge in the desired
-- order.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION poi_merge(p_kept uuid, p_merged uuid, p_reason text, p_actor text)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_kept       pois;
  v_merged     pois;
  v_union_refs jsonb;
BEGIN
  IF p_kept = p_merged THEN
    RAISE EXCEPTION 'cannot merge poi % into itself', p_kept USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_kept FROM pois WHERE id = p_kept FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'kept poi % not found', p_kept USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT * INTO v_merged FROM pois WHERE id = p_merged FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merged poi % not found', p_merged USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_kept.merged_into IS NOT NULL OR v_merged.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'poi already merged (kept.merged_into=%, merged.merged_into=%)',
      v_kept.merged_into, v_merged.merged_into USING ERRCODE = 'restrict_violation';
  END IF;

  -- NO-CHAIN INVARIANT: refuse to merge away a POI that other POIs point at.
  -- Otherwise A→merged plus merged→kept would form the chain A→merged→kept, which
  -- the one-hop canon resolution and merge-group scan cannot follow. Unmerge the
  -- children first (LIFO), then merge in the desired order.
  IF EXISTS (SELECT 1 FROM pois WHERE merged_into = p_merged) THEN
    RAISE EXCEPTION 'cannot merge poi % away: it has incoming redirects (would create a merge chain)',
      p_merged USING ERRCODE = 'restrict_violation';
  END IF;

  -- Journal the kept POI's pre-merge mergeable state for a faithful unmerge.
  INSERT INTO poi_merges (kept_poi_id, merged_poi_id, kept_snapshot, reason, actor)
  VALUES (
    p_kept, p_merged,
    jsonb_build_object('source_refs', v_kept.source_refs, 'external_ids', v_kept.external_ids),
    p_reason, p_actor
  );

  -- Union source_refs (SourceRef[]) deduped by full element identity.
  SELECT coalesce(jsonb_agg(elem), '[]'::jsonb) INTO v_union_refs
  FROM (
    SELECT elem FROM jsonb_array_elements(v_kept.source_refs) AS elem
    UNION
    SELECT elem FROM jsonb_array_elements(v_merged.source_refs) AS elem
  ) u;

  UPDATE pois
     SET source_refs  = v_union_refs,
         external_ids = v_merged.external_ids || v_kept.external_ids  -- kept wins conflicts
   WHERE id = p_kept;

  UPDATE pois SET merged_into = p_kept WHERE id = p_merged;

  PERFORM poi_recompute_coord(p_kept);
END;
$$;

-- ---------------------------------------------------------------------------
-- poi_unmerge(merged) — reverse the latest live merge for `merged`. Restores the
-- kept POI's snapshotted source_refs/external_ids, clears merged.merged_into,
-- stamps the journal row undone, and recomputes BOTH POIs' coordinates.
--
-- LIFO-PER-KEPT REQUIREMENT: unmerges into a given kept POI must be undone in
-- reverse order (newest merge first). kept_snapshot captures the kept POI's
-- {source_refs, external_ids} as they were *before that one merge*; restoring an
-- older snapshot would discard the unioned refs contributed by every later merge
-- into the same kept POI. So if a LATER active merge into this same kept POI
-- exists, we RAISE and require it be unmerged first. "Later" is ordered by the
-- tie-safe tuple (merged_at, id) so simultaneous merged_at timestamps still have
-- a deterministic order.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION poi_unmerge(p_merged uuid)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_merge poi_merges;
  v_kept  uuid;
BEGIN
  SELECT * INTO v_merge
  FROM poi_merges
  WHERE merged_poi_id = p_merged AND undone_at IS NULL
  ORDER BY merged_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active merge found for poi %', p_merged USING ERRCODE = 'no_data_found';
  END IF;

  v_kept := v_merge.kept_poi_id;

  -- LIFO guard: kept_snapshot only faithfully restores the kept POI when this is
  -- the newest active merge into it. A later active merge into the same kept POI
  -- means undoing this one first would clobber that later merge's unioned refs, so
  -- refuse. Order is tie-safe on (merged_at, id).
  IF EXISTS (
    SELECT 1 FROM poi_merges m
    WHERE m.kept_poi_id = v_kept
      AND m.undone_at IS NULL
      AND (m.merged_at, m.id) > (v_merge.merged_at, v_merge.id)
  ) THEN
    RAISE EXCEPTION 'cannot unmerge poi % out of order: a later active merge into kept poi % must be unmerged first (LIFO)',
      p_merged, v_kept USING ERRCODE = 'restrict_violation';
  END IF;

  UPDATE pois
     SET source_refs  = v_merge.kept_snapshot -> 'source_refs',
         external_ids = v_merge.kept_snapshot -> 'external_ids'
   WHERE id = v_kept;

  UPDATE pois SET merged_into = NULL WHERE id = p_merged;

  UPDATE poi_merges SET undone_at = now() WHERE id = v_merge.id;

  PERFORM poi_recompute_coord(v_kept);
  PERFORM poi_recompute_coord(p_merged);
END;
$$;

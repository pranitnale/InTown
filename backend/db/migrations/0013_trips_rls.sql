-- 0013_trips_rls — P06 trips-domain Row-Level Security (§6.3, §16, 🧭 ET debt #11).
--
-- Replaces the PERMISSIVE placeholders from 0010 on every trips-domain table with
-- real per-trip predicates keyed on membership + role, introduces the membership
-- helper functions the policies read, and adds the two SECURITY DEFINER entry
-- points the API calls for join + aggregate vote counts.
--
-- ROLE MODEL (contracts/types/trips.ts): owner ⊃ editor ⊃ viewer.
--   viewer — read (SELECT) only.
--   editor — read + curate/vote/edit (writes on trip_cities/trip_places/stops/…).
--   owner  — everything + manage members/roles/invites + delete the trip.
--
-- WHY SECURITY DEFINER HELPERS: a policy on `trips` that asks "is the caller a
-- member?" must read `trip_members`, and a policy on `trip_members` reads back
-- into membership — evaluated as the querying (RLS-bound) role this recurses and
-- also can't see rows the caller is not yet permitted to see. The helpers below
-- are SECURITY DEFINER (run as the migration/owner role, which bypasses RLS by
-- ownership) and STABLE, so they read the membership graph directly, exactly
-- once, with no policy recursion. `current_user_id()` (0011) still resolves from
-- the request-scoped `app.current_user_id` GUC — SECURITY DEFINER changes the
-- effective role, never the GUC.
--
-- AGGREGATE-ONLY DISCLOSURE (§6.3): `place_votes` rows are visible ONLY to their
-- own author (self-rows-only policy). No member can read another member's vote
-- row at all — the "3 of 4 want this, never 'Ana vetoed it'" guarantee is
-- enforced at the DB layer, not just in the API. Counts are exposed only through
-- the `place_vote_counts()` definer function, which returns aggregates with no
-- user ids.

-- ---------------------------------------------------------------------------
-- Membership helpers. All SECURITY DEFINER STABLE with a pinned search_path so a
-- rogue object on a caller's search_path can never shadow the tables/enums they
-- resolve (pg_catalog is always searched implicitly, so `now()`/`count()` still
-- resolve). EXECUTE defaults to PUBLIC (as with current_user_id() in 0011), so
-- the RLS-bound intown_app role can invoke them from within policy expressions.
-- ---------------------------------------------------------------------------

-- The caller's role in a trip, or NULL when they hold no membership row.
CREATE OR REPLACE FUNCTION trip_role_of(trip uuid) RETURNS trip_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM trip_members
   WHERE trip_id = trip AND user_id = current_user_id()
   LIMIT 1
$$;

-- Owner test. Also honours `trips.owner_id` directly so the trip creator counts
-- as owner for the very first `trip_members` INSERT (their owner membership row
-- does not exist yet). The create-trip handler keeps the two in sync (owner_id ⇔
-- an 'owner' membership), and ownership transfer swaps both inside one
-- transaction. COALESCE pins a strict boolean: a non-member must get FALSE (not
-- NULL), so callers can safely negate the result (e.g. place_vote_counts).
CREATE OR REPLACE FUNCTION is_trip_owner(trip uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(trip_role_of(trip) = 'owner', false)
      OR EXISTS (SELECT 1 FROM trips WHERE id = trip AND owner_id = current_user_id())
$$;

-- Membership test (any role). The canonical owner counts even before their
-- membership row lands (bootstrap), via is_trip_owner. Strict boolean.
CREATE OR REPLACE FUNCTION is_trip_member(trip uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (trip_role_of(trip) IS NOT NULL) OR is_trip_owner(trip)
$$;

-- Editor test (owner or editor). Viewers are excluded from every write path.
-- Strict boolean.
CREATE OR REPLACE FUNCTION is_trip_editor(trip uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(trip_role_of(trip) IN ('owner', 'editor'), false) OR is_trip_owner(trip)
$$;

-- Resolvers that lift a child row up to its owning trip id, bypassing RLS so the
-- policies on the child tables can ask membership questions without depending on
-- the caller's visibility of the intermediate `trip_cities` / `trip_places` rows.
CREATE OR REPLACE FUNCTION trip_id_of_city(city uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT trip_id FROM trip_cities WHERE id = city
$$;

CREATE OR REPLACE FUNCTION trip_id_of_place(trip_place uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tc.trip_id
    FROM trip_places tp
    JOIN trip_cities tc ON tc.id = tp.trip_city_id
   WHERE tp.id = trip_place
$$;

-- ---------------------------------------------------------------------------
-- trips — member SELECT, self INSERT as owner, owner UPDATE/DELETE.
-- ---------------------------------------------------------------------------
-- The `owner_id` disjunct is load-bearing for `INSERT ... RETURNING`: the SELECT
-- policy is applied to the row being returned, and at creation time the owner's
-- membership row does not exist yet, so `is_trip_member` (which reads it via a
-- sub-SELECT that cannot see the row still being inserted in the same statement)
-- would filter the row out. Comparing the NEW row's `owner_id` column directly
-- lets the creator read back the trip they just inserted.
DROP POLICY IF EXISTS trips_permissive ON trips;
CREATE POLICY trips_select ON trips FOR SELECT
  USING (owner_id = current_user_id() OR is_trip_member(id));
CREATE POLICY trips_insert ON trips FOR INSERT
  WITH CHECK (owner_id = current_user_id());
CREATE POLICY trips_update ON trips FOR UPDATE
  USING (is_trip_owner(id)) WITH CHECK (is_trip_owner(id));
CREATE POLICY trips_delete ON trips FOR DELETE
  USING (is_trip_owner(id));

-- ---------------------------------------------------------------------------
-- trip_cities — member SELECT, editor writes.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS trip_cities_permissive ON trip_cities;
CREATE POLICY trip_cities_select ON trip_cities FOR SELECT
  USING (is_trip_member(trip_id));
CREATE POLICY trip_cities_insert ON trip_cities FOR INSERT
  WITH CHECK (is_trip_editor(trip_id));
CREATE POLICY trip_cities_update ON trip_cities FOR UPDATE
  USING (is_trip_editor(trip_id)) WITH CHECK (is_trip_editor(trip_id));
CREATE POLICY trip_cities_delete ON trip_cities FOR DELETE
  USING (is_trip_editor(trip_id));

-- ---------------------------------------------------------------------------
-- trip_members — member SELECT, owner INSERT/UPDATE, owner-or-self DELETE.
-- Self-DELETE is the "leave a trip" path (the API exposes it as an owner-or-self
-- removeMember). INSERT is owner-only; new members arrive through redeem_invite
-- (SECURITY DEFINER, below), except the creator's own bootstrap owner row which
-- is_trip_owner admits via trips.owner_id.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS trip_members_permissive ON trip_members;
CREATE POLICY trip_members_select ON trip_members FOR SELECT
  USING (is_trip_member(trip_id));
CREATE POLICY trip_members_insert ON trip_members FOR INSERT
  WITH CHECK (is_trip_owner(trip_id));
CREATE POLICY trip_members_update ON trip_members FOR UPDATE
  USING (is_trip_owner(trip_id)) WITH CHECK (is_trip_owner(trip_id));
CREATE POLICY trip_members_delete ON trip_members FOR DELETE
  USING (is_trip_owner(trip_id) OR user_id = current_user_id());

-- ---------------------------------------------------------------------------
-- trip_invites — owner-only for every operation. Redemption by a non-owner goes
-- through redeem_invite (SECURITY DEFINER), which never reads through this policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS trip_invites_permissive ON trip_invites;
CREATE POLICY trip_invites_owner ON trip_invites FOR ALL
  USING (is_trip_owner(trip_id)) WITH CHECK (is_trip_owner(trip_id));

-- ---------------------------------------------------------------------------
-- trip_places — member SELECT, editor writes; INSERT additionally requires the
-- row to be attributed to the caller (added_by = current user), so curation
-- actions are honestly attributed (§6.3 "who added").
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS trip_places_permissive ON trip_places;
CREATE POLICY trip_places_select ON trip_places FOR SELECT
  USING (is_trip_member(trip_id_of_city(trip_city_id)));
CREATE POLICY trip_places_insert ON trip_places FOR INSERT
  WITH CHECK (is_trip_editor(trip_id_of_city(trip_city_id)) AND added_by = current_user_id());
CREATE POLICY trip_places_update ON trip_places FOR UPDATE
  USING (is_trip_editor(trip_id_of_city(trip_city_id)))
  WITH CHECK (is_trip_editor(trip_id_of_city(trip_city_id)));
CREATE POLICY trip_places_delete ON trip_places FOR DELETE
  USING (is_trip_editor(trip_id_of_city(trip_city_id)));

-- ---------------------------------------------------------------------------
-- place_votes — SELF ROWS ONLY, and only for an editor of the parent trip. This
-- is the DB-level aggregate-only guarantee: no member ever reads another
-- member's raw vote (§6.3). Counts flow exclusively through place_vote_counts().
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS place_votes_permissive ON place_votes;
CREATE POLICY place_votes_self ON place_votes FOR ALL
  USING (user_id = current_user_id() AND is_trip_editor(trip_id_of_place(trip_place_id)))
  WITH CHECK (user_id = current_user_id() AND is_trip_editor(trip_id_of_place(trip_place_id)));

-- ---------------------------------------------------------------------------
-- plan_revisions — member SELECT, editor INSERT. Append-only (0010 blocks
-- UPDATE/DELETE via trigger); RLS also grants no UPDATE/DELETE policy, so the
-- immutability is doubly locked.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS plan_revisions_permissive ON plan_revisions;
CREATE POLICY plan_revisions_select ON plan_revisions FOR SELECT
  USING (is_trip_member(trip_id_of_city(trip_city_id)));
CREATE POLICY plan_revisions_insert ON plan_revisions FOR INSERT
  WITH CHECK (is_trip_editor(trip_id_of_city(trip_city_id)));

-- ---------------------------------------------------------------------------
-- stops — member SELECT, editor writes.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS stops_permissive ON stops;
CREATE POLICY stops_select ON stops FOR SELECT
  USING (is_trip_member(trip_id_of_city(trip_city_id)));
CREATE POLICY stops_insert ON stops FOR INSERT
  WITH CHECK (is_trip_editor(trip_id_of_city(trip_city_id)));
CREATE POLICY stops_update ON stops FOR UPDATE
  USING (is_trip_editor(trip_id_of_city(trip_city_id)))
  WITH CHECK (is_trip_editor(trip_id_of_city(trip_city_id)));
CREATE POLICY stops_delete ON stops FOR DELETE
  USING (is_trip_editor(trip_id_of_city(trip_city_id)));

-- ---------------------------------------------------------------------------
-- intercity_legs — member SELECT, editor writes. Carries trip_id directly.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS intercity_legs_permissive ON intercity_legs;
CREATE POLICY intercity_legs_select ON intercity_legs FOR SELECT
  USING (is_trip_member(trip_id));
CREATE POLICY intercity_legs_insert ON intercity_legs FOR INSERT
  WITH CHECK (is_trip_editor(trip_id));
CREATE POLICY intercity_legs_update ON intercity_legs FOR UPDATE
  USING (is_trip_editor(trip_id)) WITH CHECK (is_trip_editor(trip_id));
CREATE POLICY intercity_legs_delete ON intercity_legs FOR DELETE
  USING (is_trip_editor(trip_id));

-- ---------------------------------------------------------------------------
-- redeem_invite(code) — the /api/join/:code entry point. SECURITY DEFINER so a
-- prospective member (who is NOT yet a member and therefore cannot read the
-- invite under trip_invites RLS) can validate and redeem it. Upserts the caller's
-- membership with the invite's embedded role.
--
-- Typed failures, surfaced to the API via SQLSTATE so it can map them to HTTP:
--   IT404 — code is unknown (→ 404 not found).
--   IT410 — code is revoked or expired (→ 410 gone).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_invite(code text) RETURNS trip_members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid    uuid := current_user_id();
  inv    trip_invites;
  result trip_members;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'no authenticated user' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO inv FROM trip_invites WHERE trip_invites.code = redeem_invite.code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite % not found', redeem_invite.code USING ERRCODE = 'IT404';
  END IF;

  IF inv.revoked OR inv.expires_at <= now() THEN
    RAISE EXCEPTION 'invite % is revoked or expired', redeem_invite.code USING ERRCODE = 'IT410';
  END IF;

  INSERT INTO trip_members (trip_id, user_id, role)
  VALUES (inv.trip_id, uid, inv.role)
  ON CONFLICT (trip_id, user_id) DO UPDATE SET role = EXCLUDED.role
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- place_vote_counts(place) — aggregate reader for a curated place. SECURITY
-- DEFINER because the raw place_votes rows are invisible even to fellow members;
-- this is the ONLY sanctioned way to learn how a group voted, and it returns
-- counts + the trip's member count with NO user ids attached. Raises IT403 unless
-- the caller is a member of the parent trip, IT404 if the place does not exist.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION place_vote_counts(place uuid)
RETURNS TABLE (up integer, down integer, member_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  trip uuid := trip_id_of_place(place);
BEGIN
  IF trip IS NULL THEN
    RAISE EXCEPTION 'place % not found', place USING ERRCODE = 'IT404';
  END IF;
  IF NOT is_trip_member(trip) THEN
    RAISE EXCEPTION 'not a member of trip %', trip USING ERRCODE = 'IT403';
  END IF;

  RETURN QUERY
    SELECT
      count(*) FILTER (WHERE v.vote = 'up')::integer   AS up,
      count(*) FILTER (WHERE v.vote = 'down')::integer AS down,
      (SELECT count(*)::integer FROM trip_members m WHERE m.trip_id = trip) AS member_count
    FROM place_votes v
    WHERE v.trip_place_id = place;
END;
$$;

-- ---------------------------------------------------------------------------
-- Fractional-indexing jitter backstop (§6.3, D47): two concurrent inserts that
-- land on the same slot must not silently collide. A UNIQUE index on
-- (trip_city_id, position) turns a same-slot clash into a 23505 the API retries
-- with a jittered key, so ordering keys stay unique per city stay.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX trip_places_trip_city_position_uidx
  ON trip_places (trip_city_id, position);

-- ---------------------------------------------------------------------------
-- Grants (mirror 0011/0012). The trips-domain tables were created by the owner
-- role in 0004/0006 with RLS enabled but no privileges for the app role, so the
-- coarse table-level layer must be opened here — RLS above still gates rows.
-- intown_auth (BYPASSRLS) needs only trip_members SELECT: the API resolves a
-- caller's role on the auth pool before a trip route's handler runs. The two
-- SECURITY DEFINER entry points get an explicit EXECUTE grant to intown_app; the
-- membership/resolver helpers rely on the PUBLIC EXECUTE default (as does
-- current_user_id() in 0011) since RLS policy expressions invoke them as the app
-- role.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  trips, trip_cities, trip_members, trip_invites, intercity_legs,
  trip_places, place_votes, plan_revisions, stops
  TO intown_app;

GRANT SELECT ON trip_members TO intown_auth;

GRANT EXECUTE ON FUNCTION redeem_invite(text), place_vote_counts(uuid) TO intown_app;

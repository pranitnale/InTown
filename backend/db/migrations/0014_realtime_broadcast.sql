-- 0014_realtime_broadcast — P06 Supabase Realtime Broadcast-from-Database (§6.3,
-- §6.4, §12.1). Postgres is the single source of truth for the live curation list;
-- these AFTER triggers turn each committed write into a `trip:{id}` channel message
-- so every connected member reconciles optimistically. Per-column LWW: a place
-- UPDATE broadcasts ONLY the columns that actually changed (the others go null),
-- carrying the server `updated_at` as the LWW timestamp (§6.4).
--
-- PAYLOAD SHAPES ARE FROZEN by contracts/api/channels.ts (TripBroadcast). Each
-- jsonb_build_object below mirrors one variant of that discriminated union EXACTLY,
-- including the `type` discriminant. Timestamps use timestamptz columns directly:
-- jsonb rendering yields ISO-8601 with a numeric offset (e.g. `…+00:00`), which the
-- contract's `IsoDateTime` (z.iso.datetime({offset:true})) accepts. NO COORDINATES
-- ever cross this channel — payloads carry ids only (§6.4).
--
-- WHY intown_broadcast IS SECURITY DEFINER: the app connects as intown_app, which
-- has no privileges on `realtime.messages`. `realtime.send` (owned by postgres, and
-- SECURITY INVOKER) would therefore hit a permission error mid-write — swallowed by
-- its own EXCEPTION handler, so the write still commits but nothing is broadcast.
-- Wrapping the call in a SECURITY DEFINER function owned by the migration/superuser
-- role runs the send as postgres (which owns realtime.messages), so the broadcast
-- actually lands. The per-table trigger functions stay SECURITY INVOKER: they only
-- read NEW/OLD and call the two definer helpers (this one + trip_id_of_city/_place
-- from 0013), so they need no elevated rights of their own.
--
-- BARE-POSTGRES SAFETY: CI (and any stack without the realtime container) has no
-- `realtime` schema, so `realtime.send` is absent. intown_broadcast checks
-- `to_regprocedure('realtime.send(jsonb,text,text,boolean)')` at runtime and returns
-- early when it is NULL — the guarded PERFORM is never planned, so the triggers are
-- inert no-ops there and every trips-domain write still succeeds.

-- ---------------------------------------------------------------------------
-- intown_broadcast(event, trip, payload) — the single send boundary.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION intown_broadcast(event text, trip uuid, payload jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- No trip resolved (e.g. a cascade delete already removed the parent city stay):
  -- there is no channel to address, so drop it.
  IF trip IS NULL THEN
    RETURN;
  END IF;
  -- Realtime not provisioned (bare Postgres / CI): no-op so writes stay green.
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NULL THEN
    RETURN;
  END IF;
  -- private => false: these are PUBLIC channels — subscription is NOT authorized.
  -- There is deliberately no channel-level membership check yet: user-facing realtime
  -- JWTs do not exist until P07/P15, so private-channel authorization is a documented
  -- deploy-phase deferral (see the P06 phase-file deferral flag). This is safe TODAY
  -- only because API_JWT_SECRET never leaves the server — no untrusted party can mint
  -- a token to subscribe. Before any phase mints user-facing tokens these MUST become
  -- private with realtime.messages authorization policies (or per-trip channel tokens).
  PERFORM realtime.send(payload, event, 'trip:' || trip::text, false);
END;
$$;

-- ---------------------------------------------------------------------------
-- trip_places — place_added (INSERT) / place_updated (UPDATE, per-column LWW) /
-- place_removed (DELETE). Trip id is lifted from the parent city stay via the
-- 0013 SECURITY DEFINER resolver, so the trigger needs no direct read of
-- trip_cities. `updated_by`/`removed_by` come from the request-scoped
-- current_user_id() (0011): the actor who made the edit, which is attributed
-- collaboration state (§6.4), not a preference disclosure.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION broadcast_trip_place() RETURNS trigger
LANGUAGE plpgsql AS $$
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
        'at', NEW.updated_at
      ));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Rebalance parks every row on a transient sentinel position ('~' || id, outside
    -- the base62 alphabet) before laying down the real keys. Those park writes are
    -- internal churn, not curation intent, and would emit a burst of 'place_updated'
    -- messages carrying a bogus '~…' position — all with the same transaction `at`,
    -- which a strict-greater LWW comparator could settle on. Suppress them: the
    -- subsequent real-key rewrite broadcasts the durable position. Real ordering keys
    -- are always base62, so a '~' prefix uniquely marks the sentinel.
    IF NEW.position LIKE '~%' THEN
      RETURN NEW;
    END IF;
    -- Per-column LWW wire shape: a column is present only when it actually changed
    -- (IS DISTINCT FROM handles NULLs), otherwise null. A pure reorder carries only
    -- `position`; a state flip carries only `state`; the peer merges field-by-field.
    PERFORM intown_broadcast('place_updated', trip_id_of_city(NEW.trip_city_id),
      jsonb_build_object(
        'type', 'place_updated',
        'trip_place_id', NEW.id,
        'position', CASE WHEN OLD.position IS DISTINCT FROM NEW.position THEN NEW.position END,
        'state', CASE WHEN OLD.state IS DISTINCT FROM NEW.state THEN NEW.state END,
        'updated_by', current_user_id(),
        'at', NEW.updated_at
      ));
    RETURN NEW;
  ELSE
    PERFORM intown_broadcast('place_removed', trip_id_of_city(OLD.trip_city_id),
      jsonb_build_object(
        'type', 'place_removed',
        'trip_place_id', OLD.id,
        'removed_by', current_user_id(),
        'at', now()
      ));
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trip_places_broadcast
  AFTER INSERT OR UPDATE OR DELETE ON trip_places
  FOR EACH ROW EXECUTE FUNCTION broadcast_trip_place();

-- ---------------------------------------------------------------------------
-- place_votes — vote_cast on INSERT and UPDATE (the votePlace upsert flips an
-- existing row via ON CONFLICT DO UPDATE, which is an UPDATE). `user_id` on this
-- payload is per the frozen BroadcastVoteCast contract; see the P06 flag note about
-- the tension with aggregate-only disclosure. Trip lifted via trip_id_of_place.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION broadcast_place_vote() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM intown_broadcast('vote_cast', trip_id_of_place(NEW.trip_place_id),
    jsonb_build_object(
      'type', 'vote_cast',
      'trip_place_id', NEW.trip_place_id,
      'user_id', NEW.user_id,
      'vote', NEW.vote,
      'at', now()
    ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER place_votes_broadcast
  AFTER INSERT OR UPDATE ON place_votes
  FOR EACH ROW EXECUTE FUNCTION broadcast_place_vote();

-- ---------------------------------------------------------------------------
-- trip_members — member_joined on INSERT (redeem_invite / owner add). `joined_at`
-- is the server timestamp. trip_id is carried directly on the row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION broadcast_member_joined() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM intown_broadcast('member_joined', NEW.trip_id,
    jsonb_build_object(
      'type', 'member_joined',
      'user_id', NEW.user_id,
      'role', NEW.role,
      'at', NEW.joined_at
    ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trip_members_broadcast
  AFTER INSERT ON trip_members
  FOR EACH ROW EXECUTE FUNCTION broadcast_member_joined();

-- ---------------------------------------------------------------------------
-- plan_revisions — plan_updated on INSERT (append-only log; 0010 blocks UPDATE/
-- DELETE). trip_id lifted from the city stay via trip_id_of_city.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION broadcast_plan_updated() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM intown_broadcast('plan_updated', trip_id_of_city(NEW.trip_city_id),
    jsonb_build_object(
      'type', 'plan_updated',
      'trip_city_id', NEW.trip_city_id,
      'plan_revision_id', NEW.id,
      'reason', NEW.reason,
      'at', NEW.created_at
    ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER plan_revisions_broadcast
  AFTER INSERT ON plan_revisions
  FOR EACH ROW EXECUTE FUNCTION broadcast_plan_updated();

-- intown_broadcast defaults to PUBLIC EXECUTE (like the 0011/0013 helpers), so the
-- trigger functions invoke it as intown_app; the SECURITY DEFINER context inside it
-- supplies the realtime.messages privileges.

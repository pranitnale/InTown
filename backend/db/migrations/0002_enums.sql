-- 0002_enums — every fixed value set from contracts/types as a native enum.
-- Exactly ONE category enum (§5.4, ET debt #3). Value sets mirror the zod
-- `*_VALUES` tuples verbatim; changing a set is a contract change, not an ad-hoc
-- ALTER TYPE here.

-- §5.4 unified place category — defined once, everywhere.
CREATE TYPE category AS ENUM (
  'SIGHT', 'MUSEUM', 'VIEWPOINT', 'PARK_NATURE', 'ENTERTAINMENT',
  'NIGHTLIFE', 'SHOPPING', 'RESTAURANT', 'CAFE', 'OTHER'
);

-- Identity / preferences (users.ts)
CREATE TYPE age_band     AS ENUM ('<18', '18-25', '26-44', '45-64', '65+');
CREATE TYPE mobility     AS ENUM ('full', 'limited', 'wheelchair', 'stroller');
CREATE TYPE budget_tier  AS ENUM ('budget', 'moderate', 'comfort', 'luxury');
CREATE TYPE pace         AS ENUM ('relaxed', 'moderate', 'packed');
CREATE TYPE consent_type AS ENUM ('personalization_learning', 'location_derived_signals', 'marketing');

-- Trips (trips.ts)
CREATE TYPE trip_role     AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE intercity_mode AS ENUM ('train', 'bus', 'flight', 'car', 'ferry', 'other');

-- Brain (brain.ts / common.ts)
CREATE TYPE brain_status     AS ENUM ('cold', 'building', 'warm', 'stale');
CREATE TYPE indoor_outdoor   AS ENUM ('indoor', 'outdoor', 'mixed');
CREATE TYPE coord_resolution AS ENUM ('unverified', 'approximate', 'verified');
CREATE TYPE coord_verified_by AS ENUM ('open_data', 'cross_referenced', 'first_traveler_gps');
CREATE TYPE geo_source_kind  AS ENUM (
  'osm', 'wikidata', 'commons_photo', 'flickr_photo', 'source_maplink',
  'visual_recognition', 'google_fallback', 'first_traveler_gps'
);
CREATE TYPE fact_source_kind AS ENUM (
  'llm_research', 'osm', 'wikidata', 'official_site', 'open_data',
  'advisory', 'web_review', 'user_correction'
);
CREATE TYPE fact_entity_kind AS ENUM ('poi', 'city');
CREATE TYPE fact_status      AS ENUM ('active', 'superseded', 'disputed', 'rejected');

-- Curation (curation.ts)
CREATE TYPE place_state          AS ENUM ('suggested', 'kept', 'removed', 'must_do');
CREATE TYPE vote_value           AS ENUM ('up', 'down');
CREATE TYPE plan_revision_reason AS ENUM (
  'initial', 'manual_edit', 'reconfigure', 'regenerated', 'go_now', 'closed_now', 'restore'
);
CREATE TYPE stop_kind AS ENUM ('poi', 'meal', 'break');

-- Community (community.ts)
CREATE TYPE review_status          AS ENUM ('pending', 'published', 'removed');
CREATE TYPE moderation_target_kind AS ENUM ('review', 'correction', 'poi', 'fact', 'import');
CREATE TYPE moderation_decision    AS ENUM (
  'pending', 'no_action', 'content_removed', 'content_demoted', 'rejected'
);
CREATE TYPE correction_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE want_to_go_status AS ENUM ('saved', 'discarded', 'resolved');

-- Vault (vault.ts)
CREATE TYPE document_parent_kind AS ENUM ('TRIP', 'TRIP_CITY', 'INTERCITY_LEG', 'STOP');

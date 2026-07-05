-- 0007_community — reviews, moderation_actions, corrections, want_to_go,
-- badges, user_badges (§10, §16.2–16.3). Mirrors contracts/types/community.ts.

-- Reviews (§16.3 Omnibus). verified_visit = GPS-confirmed presence.
CREATE TABLE reviews (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id         uuid          NOT NULL REFERENCES pois (id) ON DELETE CASCADE,
  user_id        uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating         integer       NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text           text,
  verified_visit boolean       NOT NULL DEFAULT false,
  status         review_status NOT NULL DEFAULT 'pending',
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (poi_id, user_id)
);

-- DSA moderation audit log (§16.2). Polymorphic target (target_kind, target_id);
-- append-only in spirit, but decision/statement_of_reasons are filled on decide,
-- so it is NOT UPDATE-locked.
CREATE TABLE moderation_actions (
  id                   uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  target_kind          moderation_target_kind NOT NULL,
  target_id            uuid                   NOT NULL,
  notice               text                   NOT NULL,   -- Art. 16 notice text
  decision             moderation_decision    NOT NULL DEFAULT 'pending',
  statement_of_reasons text,                              -- Art. 17; null while pending
  reporter_id          uuid                   REFERENCES users (id) ON DELETE SET NULL,
  moderator_id         uuid                   REFERENCES users (id) ON DELETE SET NULL,
  noticed_at           timestamptz            NOT NULL DEFAULT now(),
  decided_at           timestamptz,
  created_at           timestamptz            NOT NULL DEFAULT now()
);

-- Proposed correction to an atomic fact (§6.15). facts is append-only, so no
-- cascade is meaningful; RESTRICT keeps the reference honest.
CREATE TABLE corrections (
  id             uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id        uuid              NOT NULL REFERENCES facts (id) ON DELETE RESTRICT,
  proposed_value jsonb,
  reporter_id    uuid              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  confirmations  integer           NOT NULL DEFAULT 0 CHECK (confirmations >= 0),
  status         correction_status NOT NULL DEFAULT 'pending',
  created_at     timestamptz       NOT NULL DEFAULT now()
);

-- Saved "want to go" (§6.22 social import): resolves to a poi_id or holds an
-- unresolved_name until grounded.
CREATE TABLE want_to_go (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  poi_id          uuid              REFERENCES pois (id) ON DELETE SET NULL,
  unresolved_name text,
  city            text,                                    -- free-text city context
  source_url      text,
  creator_handle  text,
  status          want_to_go_status NOT NULL DEFAULT 'saved',
  saved_at        timestamptz       NOT NULL DEFAULT now()
);

-- Badge definitions (§6.21). `rule` is a server-config expression over events.
CREATE TABLE badges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  description text,
  rule        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_badges (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  badge_id   uuid        NOT NULL REFERENCES badges (id) ON DELETE CASCADE,
  trip_id    uuid        REFERENCES trips (id) ON DELETE SET NULL,  -- if trip-scoped
  awarded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reviews_poi_idx           ON reviews (poi_id);
CREATE INDEX reviews_user_idx          ON reviews (user_id);
CREATE INDEX moderation_target_idx     ON moderation_actions (target_kind, target_id);
CREATE INDEX corrections_fact_idx      ON corrections (fact_id);
CREATE INDEX want_to_go_user_idx       ON want_to_go (user_id);
CREATE INDEX user_badges_user_idx      ON user_badges (user_id);

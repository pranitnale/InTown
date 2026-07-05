-- 0008_learning — events (append-only capture), user_pref_profiles, item_stats
-- (§9.1–9.2, §10). Mirrors contracts/types/learning.ts.
--
-- `events` is RANGE-partitioned by occurred_at (declarative partitioning). A
-- DEFAULT partition catches everything for now; time-bucketed partitions
-- (monthly) + retention are added when volume justifies it (owned by a later
-- learning phase). The partition key must be in the PK, so PK = (id, occurred_at).
-- Append-only enforcement (block UPDATE/DELETE) is applied in 0010; the trigger
-- attaches to the parent and cascades to partitions.
CREATE TABLE events (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  -- Pseudonymous, intentionally FK-free (§16.1): events are an append-only log,
  -- so an ON DELETE FK action would fire against the append-only trigger (0010)
  -- and abort GDPR erasure / trip deletion. Erasing a user or trip simply
  -- orphans the pseudonym here while anonymous aggregates survive.
  user_id      uuid,
  trip_id      uuid,
  event_type   text        NOT NULL,                 -- catalog name; payload in event_data
  event_data   jsonb       NOT NULL DEFAULT '{}',
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  algo_version text,
  consent_flag boolean     NOT NULL,                 -- learning consent active at capture time
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE events_default PARTITION OF events DEFAULT;

CREATE INDEX events_occurred_at_idx ON events (occurred_at);
CREATE INDEX events_user_idx        ON events (user_id);
CREATE INDEX events_trip_idx        ON events (trip_id);
CREATE INDEX events_type_idx        ON events (event_type);

-- Per-user preference projection (§9.2 v1): deterministic weights + a compact
-- behavioral summary injected into LLM scoring. One row per user.
CREATE TABLE user_pref_profiles (
  user_id            uuid        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  weights            jsonb       NOT NULL DEFAULT '{}',
  preference_summary text,
  algo_version       text        NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Global quality-prior projection per (place x interest segment). segment null
-- = global prior. posterior = Bayesian-smoothed (C*m + sum_score)/(C + n).
CREATE TABLE item_stats (
  id           uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id       uuid             NOT NULL REFERENCES pois (id) ON DELETE CASCADE,
  segment      text,
  n            integer          NOT NULL DEFAULT 0 CHECK (n >= 0),
  sum_score    double precision NOT NULL DEFAULT 0,
  posterior    double precision NOT NULL DEFAULT 0,
  algo_version text             NOT NULL,
  updated_at   timestamptz      NOT NULL DEFAULT now()
);

-- One projection row per (poi, segment). Two partial uniques so the global prior
-- (segment IS NULL) is also single-row per poi (a plain UNIQUE ignores nulls).
CREATE UNIQUE INDEX item_stats_poi_segment_uidx
  ON item_stats (poi_id, segment) WHERE segment IS NOT NULL;
CREATE UNIQUE INDEX item_stats_poi_global_uidx
  ON item_stats (poi_id) WHERE segment IS NULL;

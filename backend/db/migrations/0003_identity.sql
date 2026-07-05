-- 0003_identity — users, traveler_profiles, taste_profiles, consents (§10).
-- Mirrors contracts/types/users.ts. ISO-4217 currency stored as a checked
-- 3-uppercase-letter text (matches CurrencyCode). Datetimes are timestamptz.

CREATE TABLE users (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text        UNIQUE,
  display_name text,
  handle       text        UNIQUE,
  locale       text,                                       -- BCP-47 UI/content language
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE traveler_profiles (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  age_band     age_band    NOT NULL,
  mobility     mobility    NOT NULL,
  eu_residency boolean     NOT NULL,
  student      boolean     NOT NULL,
  languages    text[]      NOT NULL DEFAULT '{}',          -- BCP-47 tags, ordered
  currency     text        NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Versioned taste profile: a new version is a new row (never edited in place),
-- so learning can attribute signals to a version.
CREATE TABLE taste_profiles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  version          integer     NOT NULL CHECK (version >= 0),
  interests        text[]      NOT NULL DEFAULT '{}',      -- ranked, most-preferred first
  anti_preferences text[]      NOT NULL DEFAULT '{}',
  hard_exclusions  text[]      NOT NULL DEFAULT '{}',
  dietary          text[]      NOT NULL DEFAULT '{}',
  budget_tier      budget_tier NOT NULL,
  pace             pace        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);

-- Consent-or-pay (§16.1). Append-only-friendly: granted + revoked_at.
CREATE TABLE consents (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  consent_type   consent_type NOT NULL,
  granted        boolean      NOT NULL,
  policy_version text         NOT NULL,
  granted_at     timestamptz  NOT NULL DEFAULT now(),
  revoked_at     timestamptz
);

CREATE INDEX consents_user_idx        ON consents (user_id);
CREATE INDEX taste_profiles_user_idx  ON taste_profiles (user_id);

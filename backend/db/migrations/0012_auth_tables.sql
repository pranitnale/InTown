-- 0012_auth_tables — Auth.js core schema (§6.1, decision #21), mapped onto the
-- existing `users.id uuid`. We do NOT create a duplicate user table; the adapter
-- (backend/api/src/auth/adapter.ts) maps Auth.js's User onto `users`.
--
-- Column shapes follow the Auth.js adapter models exactly (snake_case for the
-- OAuth token fields, per the Auth.js convention) so the reference adapter test
-- suite semantics hold.

-- OAuth / OIDC + email account links. One user may have many accounts.
CREATE TABLE accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type                text NOT NULL,
  provider            text NOT NULL,
  provider_account_id text NOT NULL,
  refresh_token       text,
  access_token        text,
  expires_at          bigint,
  token_type          text,
  scope               text,
  id_token            text,
  session_state       text,
  UNIQUE (provider, provider_account_id)
);
CREATE INDEX accounts_user_idx ON accounts (user_id);

-- Revocable server-side sessions (🧭 ET debt #8: ET used a constant-payload
-- cookie with no revocation). The cookie carries only `session_token`.
CREATE TABLE sessions (
  session_token text        PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires       timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Passwordless magic-link tokens. Consumed once by the callback.
CREATE TABLE verification_token (
  identifier text        NOT NULL,
  token      text        NOT NULL,
  expires    timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ---------------------------------------------------------------------------
-- RLS. accounts/sessions carry a self policy as defense in depth (the BYPASSRLS
-- intown_auth role that Auth.js uses is unaffected). verification_token has RLS
-- enabled with NO policy for the app role: only the BYPASSRLS auth role ever
-- reads/writes it, so under intown_app it is fully closed.
-- ---------------------------------------------------------------------------
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_token ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_self ON accounts
  FOR ALL USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());
CREATE POLICY sessions_self ON sessions
  FOR ALL USING (user_id = current_user_id()) WITH CHECK (user_id = current_user_id());

-- Grants. Auth.js (intown_auth, BYPASSRLS) owns all three tables' access paths.
GRANT SELECT, INSERT, UPDATE, DELETE ON accounts, sessions, verification_token
  TO intown_auth;
-- intown_app is intentionally granted nothing on the auth tables: request
-- handlers resolve/revoke sessions through the BYPASSRLS auth pool, never the
-- app pool. A future "sign out this device" endpoint that reads sessions under
-- the app role would add `GRANT SELECT, DELETE ON sessions TO intown_app` here.

# Backend deployment — self-hosted VPS (§12.1, owner decisions #20–21)

The **`backend/` folder** (API, Python workers, Postgres/PostGIS, object
storage, Realtime, OSRM, TTS, solver) runs on the owner's own VPS(s) — no
third-party BaaS for data/API/DB. This buys EU data residency (§16.1), cost
control, and no vendor lock-in, at the cost of owning backups, patching, uptime,
and scaling. The **`frontend/` folder** is a static PWA on **Vercel**; **no user
data, API, or database ever lives there** — it reaches the VPS over HTTPS via
the `contracts/` API. The two folders are independently deployable, so moving
the frontend elsewhere later is a deploy-target change, not a code change.

## The "plainer path" (chosen over self-hosting full Supabase)

Rather than run ~10 Supabase containers (or fork/strip its source), compose from
standard parts:

- **PostgreSQL 16 + PostGIS 3.5+** — installed directly (unavoidable core; light at our scale).
- **Our own API (Fastify)** — replaces PostgREST + Kong entirely.
- **Auth.js** — a library inside the API (near-zero extra process), lighter than GoTrue.
- **Object storage** — **local disk + API first**; MinIO (S3-style) is an optional later add-on.
- **Realtime** — the *one* Supabase piece worth borrowing as-is: just the
  self-hosted **Realtime** container (Elixir) for the live curation list's
  Broadcast + Presence (§6.3). Fallback: a small WebSocket handler in the API.

## Load reality

At ~50 users, interactive concurrency (API/DB/auth/realtime) is trivial. The VPS
footprint is dominated by **geo/AI infrastructure** (OSRM routing, PMTiles
serving, TTS, Python solver/AI workers), not by user count. LLMs run on
**external APIs** (Claude/Gemini) — no VPS load, but the real variable cost
(§15). Geocoding is offloaded to Geoapify's free tier so RAM/disk-heavy
Nominatim/Photon can be deferred.

## Sizing — starting point for a ~50-user beta (eigene Schätzung; validate on a test box, §20)

A single **~4 vCPU / 16 GB RAM / 160 GB SSD** VPS comfortably holds the whole
stack for a handful of launch cities, with headroom for OSRM spikes.

Rough per-service RAM budget:

| Service | RAM |
|---|---|
| Postgres + PostGIS | 1–2 GB |
| API (Fastify) | ~0.5 GB |
| Realtime | ~0.3–0.5 GB |
| Python workers (pipeline/solver) | 1–2 GB |
| **OSRM** (main variable — scales with loaded region size) | **1–4 GB** |
| PMTiles serving | negligible RAM (disk-bound, 20–80 MB/city) |
| TTS (Piper/Kokoro) | ~0.3–0.7 GB |

**When to split:** move to an **app+DB box** and a separate **geo/worker box**
when self-hosted geocoding (Nominatim/Photon) is added or many cities are loaded.

## Migrations

The single canonical chain lives in `backend/db/migrations/` (§18.3 — never a
`setup.sql`). Apply from the API package:

```bash
DATABASE_URL=postgres://postgres:...@host:5432/intown \
  pnpm --filter @intown/api run migrate
```

The runner (`api/src/db/migrate.ts`) takes a Postgres advisory lock, tracks
applied files in `schema_migrations`, and applies each pending `*.sql` in
filename order inside its own transaction — idempotent and safe to re-run.

Production migration/startup also requires `AUTH_DATABASE_URL` and
`APP_DATABASE_URL`; their URL passwords are validated and provisioned onto the
`intown_auth` (BYPASSRLS) and least-privilege `intown_app` roles only after the
full chain succeeds. Never run the API with the migration/superuser URL.

## Frontend/API origin and cookie invariant

The static frontend and API may be on different hosts, but production auth
requires **same-site custom domains** because Auth.js CSRF/PKCE/session cookies
are `SameSite=Lax`. A typical layout is `app.intown.example` (Vercel) and
`api.intown.example` (VPS), with:

```text
AUTH_URL=https://api.intown.example
CORS_ALLOWED_ORIGINS=https://app.intown.example
AUTH_COOKIE_SITE=intown.example
```

Startup rejects HTTP/wildcard origins and rejects any origin outside
`AUTH_COOKIE_SITE`. Pointing an unrelated `project.vercel.app` origin at the VPS
API is intentionally unsupported: cross-site credentialed sign-in POSTs would
drop the Lax auth cookies. Use custom domains (including for authenticated
preview environments) and terminate TLS before the API.

## Private Realtime deployment gate (P15)

Trip broadcasts are written with `private=true`; public `trip:{id}` subscriptions
must never be enabled. Before P15 exposes realtime to browsers, it must mint
short-lived member-scoped Realtime JWTs and install `realtime.messages` topic
policies that authorize only current members of the addressed trip. Validate
owner/editor/viewer access plus removed-member denial in the two-client demo.
Until that token/policy work exists, the API remains the source of truth and
clients must use HTTP refresh instead of attempting public-channel fallback.

## Notes / TODO for the ops phase

- Pin exact image tags (MinIO `RELEASE.*`, Supabase Realtime `v2.x`) once the
  target versions are chosen; `docker-compose.dev.yml` is a dev convenience, not
  the production topology.
- Backups (pg_dump / WAL archiving), TLS termination, secrets management, and
  process supervision are owned by a dedicated ops phase — not configured here.

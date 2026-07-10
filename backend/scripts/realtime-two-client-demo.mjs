// P06 AC6 — two-client Supabase Realtime demo (Broadcast + Presence + per-column
// LWW). Proves the live-collaboration path end to end against the RUNNING realtime
// container (backend/infra/docker-compose.dev.yml):
//
//   1. Seed a trip / city stay / curated place straight into Postgres.
//   2. Open two realtime clients, both join `trip:{id}`, both track Presence, and
//      each asserts it sees 2 presence entries after sync.
//   3. Fire a position UPDATE via SQL and assert BOTH clients receive a
//      zod-valid `place_updated` broadcast (validated against the FROZEN contract
//      schema, contracts/api/channels.ts) — this is Broadcast-from-Database via the
//      migration 0014 trigger → intown_broadcast → realtime.send path.
//   4. Per-column LWW: a state edit attributed to client A and a position edit
//      attributed to client B, fired back to back. Assert the row keeps BOTH new
//      columns (disjoint columns never clobber each other) and that each broadcast
//      carried only its own changed field non-null.
//
// Run against the live stack:  node backend/scripts/realtime-two-client-demo.mjs
// Exits 0 on PASS, 1 on FAIL, printing a summary. Config is derived from the dev
// compose file and overridable via env (DATABASE_URL, REALTIME_URL, API_JWT_SECRET).

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Third-party deps live in @intown/api's node_modules (this script ships no
// package.json of its own), so resolve them from there per the P06 plan.
const require = createRequire(fileURLToPath(new URL('../api/package.json', import.meta.url)));
const { RealtimeClient } = require('@supabase/realtime-js');
const { SignJWT } = require('jose');
const pg = require('pg');

// The broadcast payload validators are the FROZEN contract — imported straight from
// source (Node strips the TS types; the file lives outside node_modules so stripping
// applies). No duplicated schema here: the demo asserts what the app promises.
const { TripBroadcast } = await import(new URL('../../contracts/api/channels.ts', import.meta.url).href);

// --- config (dev defaults mirror docker-compose.dev.yml) -----------------------
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres_dev_password@localhost:5432/intown';
const REALTIME_URL = process.env.REALTIME_URL ?? 'ws://localhost:4000/socket';
const API_JWT_SECRET = process.env.API_JWT_SECRET ?? 'intown-dev-jwt-secret-change-me-000000';
const BROADCAST_TIMEOUT_MS = 12_000;
const PRESENCE_TIMEOUT_MS = 12_000;

const failures = [];
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
}

/** HS256 JWT the realtime tenant accepts (secret == seeded tenant jwt_secret). The
 *  `typ: 'JWT'` header is REQUIRED — realtime rejects the socket otherwise. */
async function devToken(role = 'authenticated') {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(API_JWT_SECRET));
}

/** Run one UPDATE attributed to `userId` (sets the request-scoped GUC the triggers
 *  read for updated_by), each in its own committed transaction. */
async function attributedUpdate(pool, userId, sql, params) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
    await client.query(sql, params);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  // --- 1. seed a trip / city stay / place (superuser bypasses RLS) -------------
  const seed = await pool.query(`
    WITH u AS (
      INSERT INTO users (email, display_name) VALUES
        ('rt-demo-a@example.com', 'Demo A'), ('rt-demo-b@example.com', 'Demo B')
      RETURNING id, email
    ), c AS (
      INSERT INTO cities (name, bbox) VALUES ('RT Demo City', '{}') RETURNING id
    ), p AS (
      INSERT INTO pois (city_id, name, category, indoor_outdoor)
      SELECT c.id, 'RT Demo POI', 'MUSEUM', 'indoor' FROM c RETURNING id
    ), t AS (
      INSERT INTO trips (owner_id, name)
      SELECT id, 'RT Demo Trip' FROM u WHERE email = 'rt-demo-a@example.com' RETURNING id, owner_id
    ), tc AS (
      INSERT INTO trip_cities (trip_id, ord, city_id, arrive, depart)
      SELECT t.id, 0, c.id, '2026-01-01', '2026-01-02' FROM t, c RETURNING id, trip_id
    ), tp AS (
      INSERT INTO trip_places (trip_city_id, poi_id, position, state, added_by)
      SELECT tc.id, p.id, 'a0', 'suggested', t.owner_id FROM tc, p, t RETURNING id
    )
    SELECT
      (SELECT id FROM t) AS trip_id,
      (SELECT id FROM tp) AS place_id,
      (SELECT id FROM u WHERE email = 'rt-demo-a@example.com') AS user_a,
      (SELECT id FROM u WHERE email = 'rt-demo-b@example.com') AS user_b
  `);
  const { trip_id: tripId, place_id: placeId, user_a: userA, user_b: userB } = seed.rows[0];
  const topic = `trip:${tripId}`;
  console.log(`seeded trip ${tripId}, place ${placeId}`);

  const clients = [];
  try {
    // --- 2. open two clients, join the channel, track presence ---------------
    const received = { A: [], B: [] };
    async function connect(name, presenceKey) {
      const token = await devToken();
      const client = new RealtimeClient(REALTIME_URL, { params: { apikey: token }, timeout: 8000 });
      clients.push(client);
      const channel = client.channel(topic, {
        config: { broadcast: { self: true }, presence: { key: presenceKey } },
      });
      channel.on('broadcast', { event: 'place_updated' }, (msg) => received[name].push(msg.payload));
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${name} subscribe timed out`)), 10_000);
        channel.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timer);
            channel.track({ user_id: presenceKey, at: new Date().toISOString() }).then(() => resolve());
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timer);
            reject(new Error(`${name} ${status}: ${err ?? ''}`));
          }
        });
      });
      return channel;
    }

    const chA = await connect('A', userA);
    const chB = await connect('B', userB);

    // Presence sync: each side should list both members.
    const bothPresent = (ch) => Object.keys(ch.presenceState()).length >= 2;
    await waitFor(() => bothPresent(chA) && bothPresent(chB), PRESENCE_TIMEOUT_MS);
    check('presence: client A sees 2 entries', bothPresent(chA), `${Object.keys(chA.presenceState()).length} entries`);
    check('presence: client B sees 2 entries', bothPresent(chB), `${Object.keys(chB.presenceState()).length} entries`);

    // --- 3. position UPDATE -> both clients get a zod-valid place_updated -----
    await attributedUpdate(pool, userA, `UPDATE trip_places SET position = 'a1' WHERE id = $1`, [placeId]);
    await waitFor(() => received.A.length >= 1 && received.B.length >= 1, BROADCAST_TIMEOUT_MS);
    check('broadcast: client A received place_updated', received.A.length >= 1);
    check('broadcast: client B received place_updated', received.B.length >= 1);

    const firstA = received.A[0];
    const parsed = firstA ? TripBroadcast.safeParse(firstA) : { success: false };
    check('broadcast: payload is zod-valid TripBroadcast', parsed.success,
      parsed.success ? 'place_updated' : JSON.stringify(parsed.error?.issues ?? firstA));
    check('broadcast: position UPDATE carried position non-null', firstA?.position === 'a1' && firstA?.state === null,
      `position=${firstA?.position} state=${firstA?.state}`);

    // --- 4. per-column LWW: state edit (A) + position edit (B), disjoint ------
    received.A.length = 0;
    received.B.length = 0;
    await attributedUpdate(pool, userA, `UPDATE trip_places SET state = 'must_do' WHERE id = $1`, [placeId]);
    await attributedUpdate(pool, userB, `UPDATE trip_places SET position = 'a2' WHERE id = $1`, [placeId]);
    await waitFor(() => received.A.length >= 2, BROADCAST_TIMEOUT_MS);

    const stateMsg = received.A.find((m) => m.state !== null);
    const posMsg = received.A.find((m) => m.position !== null);
    check('LWW: a state-only broadcast arrived (state set, position null)',
      !!stateMsg && stateMsg.state === 'must_do' && stateMsg.position === null && stateMsg.updated_by === userA,
      stateMsg ? `updated_by=${stateMsg.updated_by}` : 'missing');
    check('LWW: a position-only broadcast arrived (position set, state null)',
      !!posMsg && posMsg.position === 'a2' && posMsg.state === null && posMsg.updated_by === userB,
      posMsg ? `updated_by=${posMsg.updated_by}` : 'missing');

    const finalRow = (await pool.query(`SELECT position, state FROM trip_places WHERE id = $1`, [placeId])).rows[0];
    check('LWW: final row keeps BOTH columns (state must_do AND position a2)',
      finalRow.state === 'must_do' && finalRow.position === 'a2',
      `position=${finalRow.position} state=${finalRow.state}`);
  } finally {
    for (const c of clients) {
      try { c.disconnect(); } catch { /* ignore */ }
    }
    // Cascade-delete the seeded trip + its two demo users.
    await pool.query(`DELETE FROM trips WHERE id = $1`, [tripId]).catch(() => {});
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[userA, userB]]).catch(() => {});
    await pool.end();
  }
}

/** Poll `predicate` until true or `timeoutMs` elapses. */
async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

try {
  await main();
} catch (err) {
  console.error('FATAL', err);
  failures.push(`fatal: ${err.message}`);
}

if (failures.length === 0) {
  console.log('\nRESULT: PASS — Broadcast + Presence + per-column LWW all verified.');
  process.exit(0);
} else {
  console.log(`\nRESULT: FAIL — ${failures.length} check(s) failed: ${failures.join('; ')}`);
  process.exit(1);
}

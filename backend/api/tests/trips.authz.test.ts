import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { authPlugin, requireAuth } from '../src/auth/hooks.ts';
import { assertEditor } from '../src/trips/authz.ts';
import type { TripRole } from '@intown/contracts/types';
import { createPools, closePools, type Pools } from '../src/db/pool.ts';
import {
  createAdminPool,
  resetTables,
  seedTwoUsers,
  seedUser,
  seedTrip,
  sessionFor,
  testEnv,
  type SeededUser,
} from './helpers/db.ts';

/**
 * P06 AC1/AC2 — the `member` and `owner` auth levels in requireAuth. Driven
 * against dummy probe routes so the auth level is exercised in isolation from the
 * trips handlers (the ownership.guard.test.ts approach, extended with the DB the
 * role lookup needs). authPlugin decorates `req.user` (from the session cookie)
 * and `instance.pools`, which requireAuth reads to resolve the trip role.
 */
const NONEXISTENT_TRIP = '00000000-0000-4000-8000-0000000000ff';

describe('requireAuth trip levels (AC1, AC2)', () => {
  const admin = createAdminPool();
  const env = testEnv();
  const pools: Pools = createPools(env);
  let app: FastifyInstance;

  let owner: SeededUser;
  let editor: SeededUser;
  let stranger: SeededUser;
  let tripId: string;
  let cookieOwner: string;
  let cookieEditor: string;
  let cookieStranger: string;

  beforeEach(async () => {
    await resetTables(admin);

    const { a, b } = await seedTwoUsers(admin);
    owner = a;
    editor = b;
    stranger = await seedUser(admin, 'carol@example.com');

    ({ tripId } = await seedTrip(admin, {
      ownerId: owner.id,
      members: [{ userId: editor.id, role: 'editor' }],
    }));

    cookieOwner = await sessionFor(admin, owner.id);
    cookieEditor = await sessionFor(admin, editor.id);
    cookieStranger = await sessionFor(admin, stranger.id);

    app = Fastify();
    // Reuse the harness pools so the app resolves sessions/roles against the same
    // database the seeders wrote to. app.close() does not close them (no onClose
    // here); closePools runs once in afterAll.
    await app.register(authPlugin, { env, pools });
    app.get('/probe/:id', { preHandler: requireAuth('member') }, async (req) => ({
      role: req.tripRole,
    }));
    app.get('/probe-owner/:id', { preHandler: requireAuth('owner') }, async (req) => ({
      role: req.tripRole,
    }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await admin.end();
    await closePools(pools);
  });

  // --- member level -------------------------------------------------------

  it('member: the owner passes and gets tripRole=owner', async () => {
    const res = await app.inject({ method: 'GET', url: `/probe/${tripId}`, headers: { cookie: cookieOwner } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ role: 'owner' });
  });

  it('member: a non-owner member passes and gets its own role', async () => {
    const res = await app.inject({ method: 'GET', url: `/probe/${tripId}`, headers: { cookie: cookieEditor } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ role: 'editor' });
  });

  it('member: a non-member is rejected with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/probe/${tripId}`,
      headers: { cookie: cookieStranger },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
  });

  it('member: an anonymous request is rejected with 401 (before any role lookup)', async () => {
    const res = await app.inject({ method: 'GET', url: `/probe/${tripId}` });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'unauthorized' });
  });

  it('member: a member of one trip is a non-member (403) of another trip id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/probe/${NONEXISTENT_TRIP}`,
      headers: { cookie: cookieOwner },
    });
    expect(res.statusCode).toBe(403);
  });

  // --- owner level --------------------------------------------------------

  it('owner: the owner passes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/probe-owner/${tripId}`,
      headers: { cookie: cookieOwner },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ role: 'owner' });
  });

  it('owner: a non-owner member is rejected with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/probe-owner/${tripId}`,
      headers: { cookie: cookieEditor },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
  });
});

/**
 * P06 AC2 (API half) — assertEditor, the handler-level guard write-path routes
 * call after requireAuth('member') has stashed req.tripRole. Owners and editors
 * pass; a viewer is rejected with a 403 and the guard reports it must stop.
 */
describe('assertEditor (AC2)', () => {
  /** A reply stub recording the last code()/send() so the guard is observable. */
  function fakeReply(): { reply: FastifyReply; sent: { code: number | null; body: unknown } } {
    const sent: { code: number | null; body: unknown } = { code: null, body: undefined };
    const reply = {
      code(c: number) {
        sent.code = c;
        return this;
      },
      async send(b: unknown) {
        sent.body = b;
        return this;
      },
    };
    return { reply: reply as unknown as FastifyReply, sent };
  }

  function reqWithRole(role: TripRole | undefined): FastifyRequest {
    return { tripRole: role } as unknown as FastifyRequest;
  }

  it('an owner passes and no response is sent', async () => {
    const { reply, sent } = fakeReply();
    expect(await assertEditor(reqWithRole('owner'), reply)).toBe(true);
    expect(sent.code).toBeNull();
  });

  it('an editor passes and no response is sent', async () => {
    const { reply, sent } = fakeReply();
    expect(await assertEditor(reqWithRole('editor'), reply)).toBe(true);
    expect(sent.code).toBeNull();
  });

  it('a viewer is denied: returns false and sends 403 forbidden', async () => {
    const { reply, sent } = fakeReply();
    expect(await assertEditor(reqWithRole('viewer'), reply)).toBe(false);
    expect(sent.code).toBe(403);
    expect(sent.body).toEqual({ error: 'forbidden' });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TripRole } from '@intown/contracts/types';
import {
  createAdminPool,
  makeTestServer,
  resetTables,
  seedTrip,
  seedTwoUsers,
  sessionFor,
  type SeededUser,
  type TestServer,
} from './helpers/db.ts';

/**
 * P06 AC3 — invite links: `/join/:code` honors the embedded role, an expired or
 * revoked code is refused (410), an unknown code is 404, and a double-join is
 * idempotent (redeem_invite is upgrade-only, never demotes).
 */
describe('trip invites + join (AC3)', () => {
  const admin = createAdminPool();
  let ts: TestServer;
  let owner: SeededUser;
  let joiner: SeededUser;
  let cookieOwner: string;
  let cookieJoiner: string;
  let tripId: string;

  beforeAll(() => {
    ts = makeTestServer();
  });

  beforeEach(async () => {
    await resetTables(admin);
    ({ a: owner, b: joiner } = await seedTwoUsers(admin));
    cookieOwner = await sessionFor(admin, owner.id);
    cookieJoiner = await sessionFor(admin, joiner.id);
    ({ tripId } = await seedTrip(admin, { ownerId: owner.id }));
  });

  afterAll(async () => {
    await ts.app.close();
    await admin.end();
  });

  /** Insert an invite directly (superuser) for precise control over code/expiry/revoked. */
  async function seedInvite(args: {
    code: string;
    role: TripRole;
    expiresAt: string;
    revoked?: boolean;
  }): Promise<void> {
    await admin.query(
      `INSERT INTO trip_invites (trip_id, code, role, expires_at, revoked, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tripId, args.code, args.role, args.expiresAt, args.revoked ?? false, owner.id],
    );
  }

  it('createInvite (owner) then join honors the embedded role', async () => {
    const created = await ts.app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/invites`,
      headers: { cookie: cookieOwner, 'content-type': 'application/json' },
      payload: { role: 'editor', expires_at: '2027-01-01T00:00:00Z' },
    });
    expect(created.statusCode).toBe(200);
    const code = (created.json() as { code: string }).code;

    const joined = await ts.app.inject({ method: 'POST', url: `/api/join/${code}`, headers: { cookie: cookieJoiner } });
    expect(joined.statusCode).toBe(200);
    expect(joined.json()).toMatchObject({ trip_id: tripId, user_id: joiner.id, role: 'editor' });

    // The membership is real (DB-visible) with the embedded role.
    const { rows } = await admin.query<{ role: string }>(
      `SELECT role FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, joiner.id],
    );
    expect(rows[0]?.role).toBe('editor');
  });

  it('createInvite rejects role=owner (ownership is transferred, never invited)', async () => {
    const res = await ts.app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/invites`,
      headers: { cookie: cookieOwner, 'content-type': 'application/json' },
      payload: { role: 'owner', expires_at: '2027-01-01T00:00:00Z' },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBe('bad_request');

    // No invite row was created.
    const { rows } = await admin.query(
      `SELECT 1 FROM trip_invites WHERE trip_id = $1`,
      [tripId],
    );
    expect(rows).toHaveLength(0);
  });

  it('listInvites returns active invites only (not revoked, not expired)', async () => {
    await seedInvite({ code: 'active-code-000000000A', role: 'viewer', expiresAt: '2027-01-01T00:00:00Z' });
    await seedInvite({ code: 'revoked-code-00000000B', role: 'viewer', expiresAt: '2027-01-01T00:00:00Z', revoked: true });
    await seedInvite({ code: 'expired-code-00000000C', role: 'viewer', expiresAt: '2000-01-01T00:00:00Z' });

    const res = await ts.app.inject({ method: 'GET', url: `/api/trips/${tripId}/invites`, headers: { cookie: cookieOwner } });
    expect(res.statusCode).toBe(200);
    const codes = (res.json() as Array<{ code: string }>).map((i) => i.code);
    expect(codes).toEqual(['active-code-000000000A']);
  });

  it('joining an expired invite is 410 gone', async () => {
    await seedInvite({ code: 'expired-xxxxxxxxxxxxxx', role: 'editor', expiresAt: '2000-01-01T00:00:00Z' });
    const res = await ts.app.inject({ method: 'POST', url: '/api/join/expired-xxxxxxxxxxxxxx', headers: { cookie: cookieJoiner } });
    expect(res.statusCode).toBe(410);
    expect((res.json() as { error: string }).error).toBe('gone');
  });

  it('joining a revoked invite is 410 gone', async () => {
    await seedInvite({ code: 'revoked-xxxxxxxxxxxxxx', role: 'editor', expiresAt: '2027-01-01T00:00:00Z', revoked: true });
    const res = await ts.app.inject({ method: 'POST', url: '/api/join/revoked-xxxxxxxxxxxxxx', headers: { cookie: cookieJoiner } });
    expect(res.statusCode).toBe(410);
    expect((res.json() as { error: string }).error).toBe('gone');
  });

  it('revokeInvite makes a subsequent join 410, and an unknown code is 404', async () => {
    await seedInvite({ code: 'liveinvitexxxxxxxxxxxx', role: 'editor', expiresAt: '2027-01-01T00:00:00Z' });
    const inviteId = (
      await admin.query<{ id: string }>(`SELECT id FROM trip_invites WHERE code = $1`, ['liveinvitexxxxxxxxxxxx'])
    ).rows[0]!.id;

    const revoked = await ts.app.inject({
      method: 'DELETE',
      url: `/api/trips/${tripId}/invites/${inviteId}`,
      headers: { cookie: cookieOwner },
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toEqual({ revoked: true });

    const afterRevoke = await ts.app.inject({ method: 'POST', url: '/api/join/liveinvitexxxxxxxxxxxx', headers: { cookie: cookieJoiner } });
    expect(afterRevoke.statusCode).toBe(410);

    const unknown = await ts.app.inject({ method: 'POST', url: '/api/join/no-such-code-000000', headers: { cookie: cookieJoiner } });
    expect(unknown.statusCode).toBe(404);
    expect((unknown.json() as { error: string }).error).toBe('not_found');
  });

  it('a double-join is idempotent (no downgrade, single membership row)', async () => {
    await seedInvite({ code: 'doublejoinxxxxxxxxxxxx', role: 'editor', expiresAt: '2027-01-01T00:00:00Z' });

    const first = await ts.app.inject({ method: 'POST', url: '/api/join/doublejoinxxxxxxxxxxxx', headers: { cookie: cookieJoiner } });
    expect(first.statusCode).toBe(200);
    expect((first.json() as { role: string }).role).toBe('editor');

    const second = await ts.app.inject({ method: 'POST', url: '/api/join/doublejoinxxxxxxxxxxxx', headers: { cookie: cookieJoiner } });
    expect(second.statusCode).toBe(200);
    expect((second.json() as { role: string }).role).toBe('editor');

    const { rows } = await admin.query(
      `SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
      [tripId, joiner.id],
    );
    expect(rows).toHaveLength(1);
  });
});

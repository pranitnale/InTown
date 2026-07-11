import { describe, it, expect } from 'vitest';
import { Trip, TripMember } from '@intown/contracts/types';
import { createMockTripsApi } from '../api/mock.ts';
import { InviteUnusableError } from '../api/types.ts';

const MARA = 'aa000000-0000-4000-8000-000000000001';

describe('mock TripsApi (fixture-seeded, contract-validated) — AC #1/#6', () => {
  it('lists the fixture trips with the current user’s role per trip', async () => {
    const api = createMockTripsApi();
    const summaries = await api.listTrips();
    expect(summaries).toHaveLength(3);
    // Re-parse proves the returned trips satisfy the frozen schema.
    for (const { trip } of summaries) expect(() => Trip.parse(trip)).not.toThrow();
    const roles = summaries.map((s) => s.role).sort();
    expect(roles).toEqual(['editor', 'owner', 'viewer']);
  });

  it('getTasteSummary is null on a first-ever trip and populated for a returning user', async () => {
    expect(await createMockTripsApi().getTasteSummary()).toBeNull();
    const returning = await createMockTripsApi({ returning: true }).getTasteSummary();
    expect(returning).not.toBeNull();
    expect(returning?.interests).toContain('architecture');
    expect(returning?.pace).toBe('moderate');
  });

  it('createTrip returns a contract-shaped owned trip with the fixed clock', async () => {
    const api = createMockTripsApi();
    const trip = await api.createTrip({ name: 'Madrid tapas run' });
    expect(() => Trip.parse(trip)).not.toThrow();
    expect(trip.name).toBe('Madrid tapas run');
    expect(trip.owner_id).toBe(MARA);
    expect(trip.created_at).toBe('2026-07-07T12:00:00Z');
    // A created trip shows up in the list as owner.
    const summaries = await api.listTrips();
    expect(summaries.some((s) => s.trip.id === trip.id && s.role === 'owner')).toBe(true);
  });

  it('getInvite previews a usable code, and marks expired/revoked as unusable', async () => {
    const api = createMockTripsApi();
    const usable = await api.getInvite('PORTO-7QF2K9');
    expect(usable).not.toBeNull();
    expect(usable?.role).toBe('editor');
    expect(usable?.tripName).toBe('Porto long weekend');
    expect(usable?.usable).toBe(true);

    expect((await api.getInvite('STALE-EXPIRE'))?.usable).toBe(false);
    expect((await api.getInvite('REVOKED-CODE'))?.usable).toBe(false);
    expect(await api.getInvite('NOPE-000000')).toBeNull();
  });

  it('joinTrip redeems a usable code and rejects an unusable one', async () => {
    const api = createMockTripsApi();
    const member = await api.joinTrip('PORTO-7QF2K9');
    expect(() => TripMember.parse(member)).not.toThrow();
    expect(member.role).toBe('editor');
    expect(member.user_id).toBe(MARA);
    expect(member.joined_at).toBe('2026-07-07T12:00:00Z');

    await expect(api.joinTrip('STALE-EXPIRE')).rejects.toBeInstanceOf(InviteUnusableError);
    await expect(api.joinTrip('REVOKED-CODE')).rejects.toBeInstanceOf(InviteUnusableError);
  });
});

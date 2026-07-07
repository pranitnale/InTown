import { describe, it, expect } from 'vitest';
import { AccountExport, TasteProfile, TravelerProfile } from '@intown/contracts/types';
import { createMockProfileApi } from '../api/mock.ts';

describe('mock ProfileApi (fixture-seeded, contract-validated) — AC #1', () => {
  it('seeds traveler + taste from the fixture and returns contract-shaped data', async () => {
    const api = createMockProfileApi();
    const traveler = await api.getTravelerProfile();
    const taste = await api.getTasteProfile();
    expect(traveler).not.toBeNull();
    expect(taste).not.toBeNull();
    // Re-parse proves the returned objects satisfy the frozen schemas.
    expect(() => TravelerProfile.parse(traveler)).not.toThrow();
    expect(() => TasteProfile.parse(taste)).not.toThrow();
    expect(taste?.interests).toContain('architecture');
  });

  it('updateTasteProfile APPENDS a new version (never edits in place)', async () => {
    const api = createMockProfileApi();
    const before = await api.getTasteProfile();
    const beforeVersion = before?.version ?? -1;
    const after = await api.updateTasteProfile({
      interests: ['coffee', 'architecture'],
      anti_preferences: [],
      hard_exclusions: ['casinos'],
      dietary: ['vegetarian'],
      budget_tier: 'moderate',
      pace: 'relaxed',
    });
    expect(after.version).toBe(beforeVersion + 1);
    expect(after.interests).toEqual(['coffee', 'architecture']);
    expect(after.hard_exclusions).toEqual(['casinos']);
  });

  it('updateTravelerProfile upserts with a partial body', async () => {
    const api = createMockProfileApi({ emptyTraveler: true });
    expect(await api.getTravelerProfile()).toBeNull();
    const saved = await api.updateTravelerProfile({ age_band: '65+' });
    expect(saved.age_band).toBe('65+');
    expect((await api.getTravelerProfile())?.age_band).toBe('65+');
  });

  it('exportAccount returns a valid GDPR subject-access record', async () => {
    const api = createMockProfileApi();
    const exported = await api.exportAccount();
    expect(() => AccountExport.parse(exported)).not.toThrow();
    expect(exported.taste_profiles.length).toBeGreaterThan(0);
    expect(exported.user.email).toBeTruthy();
  });

  it('eraseAccount clears personal data and reports erased', async () => {
    const api = createMockProfileApi();
    const { erased } = await api.eraseAccount();
    expect(erased).toBe(true);
    expect(await api.getTravelerProfile()).toBeNull();
    expect(await api.getTasteProfile()).toBeNull();
    expect((await api.getProfile()).email).toBeNull();
  });
});

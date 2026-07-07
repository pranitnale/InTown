import { describe, it, expect } from 'vitest';
import { AccountExport, TasteProfile, TravelerProfile } from '@intown/contracts/types';
import { createMockProfileApi } from '../api/mock.ts';
import { ProfileBadRequestError } from '../api/types.ts';

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

  it('updateTravelerProfile REJECTS a partial first-time create with a 400 (mirrors backend)', async () => {
    // The merged P04 backend rejects a partial create (it needs every NOT NULL
    // field). The mock must replicate that contract or the divergence is
    // invisible to tests — a partial create must NOT invent defaults.
    const api = createMockProfileApi({ emptyTraveler: true });
    expect(await api.getTravelerProfile()).toBeNull();
    await expect(api.updateTravelerProfile({ age_band: '65+' })).rejects.toBeInstanceOf(
      ProfileBadRequestError,
    );
    // Nothing was persisted by the rejected create.
    expect(await api.getTravelerProfile()).toBeNull();
  });

  it('updateTravelerProfile ACCEPTS a full first-time create', async () => {
    const api = createMockProfileApi({ emptyTraveler: true });
    const saved = await api.updateTravelerProfile({
      age_band: '65+',
      mobility: 'full',
      eu_residency: false,
      student: false,
      languages: [],
      currency: 'EUR',
    });
    expect(saved.age_band).toBe('65+');
    expect(saved.currency).toBe('EUR');
    expect(() => TravelerProfile.parse(saved)).not.toThrow();
    expect((await api.getTravelerProfile())?.age_band).toBe('65+');
  });

  it('updateTravelerProfile ACCEPTS a partial UPDATE of an existing profile', async () => {
    // Seeded (non-empty) traveler already exists → a partial body merges over it.
    const api = createMockProfileApi();
    const before = await api.getTravelerProfile();
    expect(before).not.toBeNull();
    const saved = await api.updateTravelerProfile({ age_band: '65+' });
    expect(saved.age_band).toBe('65+');
    // Untouched fields are preserved from the existing row.
    expect(saved.mobility).toBe(before!.mobility);
    expect(saved.currency).toBe(before!.currency);
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

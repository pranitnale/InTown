import {
  User,
  TravelerProfile,
  TasteProfile,
  Consent,
  AccountExport,
  AccountLink,
  SessionMeta,
} from '@intown/contracts/types';
import type {
  UpdateProfileBody,
  UpdateTravelerProfileBody,
  UpdateTasteProfileBody,
} from '@intown/contracts/api';
import fixture from '@intown/contracts/fixtures/profiles-trip-members.json';
import type { ProfileApi } from './types.ts';

export interface MockProfileOptions {
  /** Which fixture user to seed from (0 = Mara, has full traveler + taste). */
  seedUserIndex?: number;
  /** Start with no traveler profile saved (drives the empty-onboarding path). */
  emptyTraveler?: boolean;
  /** Start with no taste profile saved. */
  emptyTaste?: boolean;
}

const NOW = '2026-07-07T12:00:00Z';

/**
 * In-memory {@link ProfileApi} seeded from the frozen
 * `profiles-trip-members.json` fixture. EVERY returned object is validated with
 * the contract zod schemas (`.parse`), so tests exercising the mock also prove
 * the UI consumes contract-shaped data. Mirrors `createMockAuthApi`.
 */
export function createMockProfileApi(opts: MockProfileOptions = {}): ProfileApi {
  const idx = opts.seedUserIndex ?? 0;
  const rawUser = fixture.users[idx];
  if (!rawUser) throw new Error(`mock: no fixture user at index ${idx}`);
  let user: User = User.parse(rawUser);

  const rawTraveler = fixture.traveler_profiles.find((p) => p.user_id === user.id);
  let traveler: TravelerProfile | null =
    opts.emptyTraveler || !rawTraveler ? null : TravelerProfile.parse(rawTraveler);

  const seedTaste = fixture.taste_profiles.find((p) => p.user_id === user.id);
  let taste: TasteProfile | null =
    opts.emptyTaste || !seedTaste ? null : TasteProfile.parse(seedTaste);
  // Full version history, ordered by version, for the GDPR export.
  const tasteVersions: TasteProfile[] = taste ? [taste] : [];

  const consents: Consent[] = fixture.consents
    .filter((c) => c.user_id === user.id)
    .map((c) => Consent.parse(c));

  const accounts: AccountLink[] = [
    AccountLink.parse({ provider: 'google', provider_account_id: 'g-mock-1', type: 'oidc' }),
  ];
  const sessions: SessionMeta[] = [SessionMeta.parse({ expires: '2026-08-01T00:00:00Z' })];

  function nextVersion(): number {
    return tasteVersions.reduce((max, p) => Math.max(max, p.version), -1) + 1;
  }

  return {
    async getProfile(): Promise<User> {
      return user;
    },

    async updateProfile(body: UpdateProfileBody): Promise<User> {
      user = User.parse({
        ...user,
        display_name: body.display_name ?? user.display_name,
        handle: body.handle ?? user.handle,
        locale: body.locale ?? user.locale,
        updated_at: NOW,
      });
      return user;
    },

    async getTravelerProfile(): Promise<TravelerProfile | null> {
      return traveler;
    },

    async updateTravelerProfile(body: UpdateTravelerProfileBody): Promise<TravelerProfile> {
      const base = traveler ?? {
        id: '17000000-0000-4000-8000-0000000000ff',
        user_id: user.id,
        age_band: '26-44' as const,
        mobility: 'full' as const,
        eu_residency: false,
        student: false,
        languages: [],
        currency: 'EUR',
        created_at: NOW,
        updated_at: NOW,
      };
      traveler = TravelerProfile.parse({
        ...base,
        ...body,
        id: base.id,
        user_id: user.id,
        created_at: base.created_at,
        updated_at: NOW,
      });
      return traveler;
    },

    async getTasteProfile(): Promise<TasteProfile | null> {
      return taste;
    },

    async updateTasteProfile(body: UpdateTasteProfileBody): Promise<TasteProfile> {
      // PUT APPENDS a new version — never edits in place.
      taste = TasteProfile.parse({
        id: `27000000-0000-4000-8000-0000000000${(nextVersion() % 100).toString().padStart(2, '0')}`,
        user_id: user.id,
        version: nextVersion(),
        interests: body.interests,
        anti_preferences: body.anti_preferences,
        hard_exclusions: body.hard_exclusions,
        dietary: body.dietary,
        budget_tier: body.budget_tier,
        pace: body.pace,
        created_at: NOW,
      });
      tasteVersions.push(taste);
      return taste;
    },

    async exportAccount(): Promise<AccountExport> {
      return AccountExport.parse({
        user,
        traveler_profile: traveler,
        taste_profiles: [...tasteVersions].sort((a, b) => a.version - b.version),
        consents,
        accounts,
        sessions,
      });
    },

    async eraseAccount(): Promise<{ erased: boolean }> {
      user = User.parse({
        ...user,
        email: null,
        display_name: null,
        handle: null,
        locale: null,
        updated_at: NOW,
      });
      traveler = null;
      taste = null;
      tasteVersions.length = 0;
      return { erased: true };
    },
  };
}

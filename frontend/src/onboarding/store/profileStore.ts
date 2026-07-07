import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { User, TravelerProfile, TasteProfile, AccountExport } from '@intown/contracts/types';
import type {
  UpdateProfileBody,
  UpdateTravelerProfileBody,
  UpdateTasteProfileBody,
} from '@intown/contracts/api';
import type { ProfileApi } from '../api/index.ts';

export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProfileState {
  status: ProfileStatus;
  error: string | null;
  user: User | null;
  traveler: TravelerProfile | null;
  taste: TasteProfile | null;

  /** Load user + traveler + taste in parallel. Never rejects; sets `error`. */
  load: () => Promise<void>;
  saveProfile: (body: UpdateProfileBody) => Promise<User>;
  saveTraveler: (body: UpdateTravelerProfileBody) => Promise<TravelerProfile>;
  /** Append a new taste-profile version and adopt it as current. */
  saveTaste: (body: UpdateTasteProfileBody) => Promise<TasteProfile>;
  exportAccount: () => Promise<AccountExport>;
  eraseAccount: () => Promise<boolean>;
}

export type ProfileStore = UseBoundStore<StoreApi<ProfileState>>;

/**
 * P05-LOCAL profile store (own Zustand instance — never touches
 * `src/store/app.ts`). One instance per {@link ProfileProvider} so
 * onboarding/settings/dev/tests stay isolated. Mirrors the P03 session store.
 */
export function createProfileStore(api: ProfileApi): ProfileStore {
  return create<ProfileState>((set) => ({
    status: 'idle',
    error: null,
    user: null,
    traveler: null,
    taste: null,

    async load() {
      set({ status: 'loading', error: null });
      try {
        const [user, traveler, taste] = await Promise.all([
          api.getProfile(),
          api.getTravelerProfile(),
          api.getTasteProfile(),
        ]);
        set({ status: 'ready', user, traveler, taste });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : 'Failed to load' });
      }
    },

    async saveProfile(body) {
      const user = await api.updateProfile(body);
      set({ user });
      return user;
    },

    async saveTraveler(body) {
      const traveler = await api.updateTravelerProfile(body);
      set({ traveler });
      return traveler;
    },

    async saveTaste(body) {
      const taste = await api.updateTasteProfile(body);
      set({ taste });
      return taste;
    },

    exportAccount() {
      return api.exportAccount();
    },

    async eraseAccount() {
      const { erased } = await api.eraseAccount();
      if (erased) set({ user: null, traveler: null, taste: null });
      return erased;
    },
  }));
}

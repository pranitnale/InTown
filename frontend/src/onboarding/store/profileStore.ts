import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { User, TravelerProfile, TasteProfile, AccountExport } from '@intown/contracts/types';
import type {
  UpdateProfileBody,
  UpdateTravelerProfileBody,
  UpdateTasteProfileBody,
} from '@intown/contracts/api';
import { ProfileSessionExpiredError, type ProfileApi } from '../api/index.ts';

export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProfileState {
  status: ProfileStatus;
  error: string | null;
  user: User | null;
  traveler: TravelerProfile | null;
  taste: TasteProfile | null;
  load: () => Promise<void>;
  saveProfile: (body: UpdateProfileBody) => Promise<User>;
  saveTraveler: (body: UpdateTravelerProfileBody) => Promise<TravelerProfile>;
  saveTaste: (body: UpdateTasteProfileBody) => Promise<TasteProfile>;
  exportAccount: () => Promise<AccountExport>;
  eraseAccount: () => Promise<boolean>;
}

export type ProfileStore = UseBoundStore<StoreApi<ProfileState>>;

/**
 * Profile store with per-resource race protection. A slow mount load cannot
 * overwrite a newer confirmed save, and a superseded load cannot win later.
 */
export function createProfileStore(
  api: ProfileApi,
  onSessionExpired?: () => void,
): ProfileStore {
  let loadRequest = 0;
  let userRevision = 0;
  let travelerRevision = 0;
  let tasteRevision = 0;

  function handleSessionError(err: unknown): void {
    if (err instanceof ProfileSessionExpiredError) onSessionExpired?.();
  }

  return create<ProfileState>((set) => ({
    status: 'idle',
    error: null,
    user: null,
    traveler: null,
    taste: null,

    async load() {
      const request = ++loadRequest;
      const revisions = { userRevision, travelerRevision, tasteRevision };
      set({ status: 'loading', error: null });
      try {
        const [user, traveler, taste] = await Promise.all([
          api.getProfile(),
          api.getTravelerProfile(),
          api.getTasteProfile(),
        ]);
        if (request !== loadRequest) return;
        set((current) => ({
          status: 'ready',
          error: null,
          user: userRevision === revisions.userRevision ? user : current.user,
          traveler:
            travelerRevision === revisions.travelerRevision ? traveler : current.traveler,
          taste: tasteRevision === revisions.tasteRevision ? taste : current.taste,
        }));
      } catch (err) {
        if (request !== loadRequest) return;
        handleSessionError(err);
        set({ status: 'error', error: err instanceof Error ? err.message : 'Failed to load' });
      }
    },

    async saveProfile(body) {
      const revision = ++userRevision;
      try {
        const user = await api.updateProfile(body);
        if (revision === userRevision) set({ user });
        return user;
      } catch (err) {
        handleSessionError(err);
        throw err;
      }
    },

    async saveTraveler(body) {
      const revision = ++travelerRevision;
      try {
        const traveler = await api.updateTravelerProfile(body);
        if (revision === travelerRevision) set({ traveler });
        return traveler;
      } catch (err) {
        handleSessionError(err);
        throw err;
      }
    },

    async saveTaste(body) {
      const revision = ++tasteRevision;
      try {
        const taste = await api.updateTasteProfile(body);
        if (revision === tasteRevision) set({ taste });
        return taste;
      } catch (err) {
        handleSessionError(err);
        throw err;
      }
    },

    async exportAccount() {
      try {
        return await api.exportAccount();
      } catch (err) {
        handleSessionError(err);
        throw err;
      }
    },

    async eraseAccount() {
      let erased: boolean;
      try {
        ({ erased } = await api.eraseAccount());
      } catch (err) {
        handleSessionError(err);
        throw err;
      }
      if (erased) {
        userRevision += 1;
        travelerRevision += 1;
        tasteRevision += 1;
        set({ user: null, traveler: null, taste: null });
      }
      return erased;
    },
  }));
}

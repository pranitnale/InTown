import { createContext } from 'react';
import type { ProfileApi } from '../api/index.ts';
import type { ProfileStore } from './profileStore.ts';

export interface ProfileContextValue {
  store: ProfileStore;
  api: ProfileApi;
}

/** Null until a ProfileProvider mounts; useProfile throws if read outside one. */
export const ProfileContext = createContext<ProfileContextValue | null>(null);

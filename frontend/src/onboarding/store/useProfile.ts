import { useContext } from 'react';
import type { ProfileApi } from '../api/index.ts';
import { ProfileContext } from './context.ts';
import type { ProfileState, ProfileStore } from './profileStore.ts';

export interface UseProfileResult extends ProfileState {
  api: ProfileApi;
  /** The underlying store (for imperative reads without subscribing). */
  store: ProfileStore;
}

/** Subscribe to the profile store + reach the api. Throws outside a provider. */
export function useProfile(): UseProfileResult {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a <ProfileProvider>');
  const state = ctx.store();
  return { ...state, api: ctx.api, store: ctx.store };
}

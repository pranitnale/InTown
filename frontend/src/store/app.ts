import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createSelectionSlice, type SelectionSlice } from './selection.ts';

/**
 * Global app store (Zustand, per FINAL_PRD §12), composed from slices. Later
 * phases add their own slices (trip, plan, map, realtime) by the same pattern.
 * This file owns the theme-preference seam the shell reads, a STUB auth flag,
 * and re-exports the selection slice.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface ThemeSlice {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

/**
 * STUB auth slice — real auth/session lands in P03. `isAuthed` defaults to
 * `true` so the P01 route skeleton is fully navigable now. `<RequireAuth>`
 * reads ONLY this flag, so P03 swaps the predicate/source (real session state)
 * without touching any route wiring.
 */
export interface AuthSlice {
  isAuthed: boolean;
  setAuthed: (value: boolean) => void;
}

export type AppState = ThemeSlice & AuthSlice & SelectionSlice;

const createThemeSlice: StateCreator<AppState, [], [], ThemeSlice> = (set) => ({
  themePreference: 'system',
  setThemePreference: (themePreference) => set({ themePreference }),
});

const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set) => ({
  isAuthed: true, // STUB (P03 replaces with real session state).
  setAuthed: (isAuthed) => set({ isAuthed }),
});

export const useAppStore = create<AppState>()((...a) => ({
  ...createThemeSlice(...a),
  ...createAuthSlice(...a),
  ...createSelectionSlice(...a),
}));

export type { SelectionKind, Selection, SelectionSlice } from './selection.ts';

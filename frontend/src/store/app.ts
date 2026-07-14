import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { createSelectionSlice, type SelectionSlice } from './selection.ts';

/** Global non-session app state. Auth is server-reconciled in `src/auth`. */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface ThemeSlice {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

export type AppState = ThemeSlice & SelectionSlice;

const createThemeSlice: StateCreator<AppState, [], [], ThemeSlice> = (set) => ({
  themePreference: 'system',
  setThemePreference: (themePreference) => set({ themePreference }),
});

export const useAppStore = create<AppState>()((...args) => ({
  ...createThemeSlice(...args),
  ...createSelectionSlice(...args),
}));

export type { SelectionKind, Selection, SelectionSlice } from './selection.ts';

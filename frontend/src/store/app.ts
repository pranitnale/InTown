import { create } from 'zustand';

/**
 * Stub global app store (Zustand, per FINAL_PRD §12). Real slices (auth, trip,
 * plan, map, realtime) are added by later phases; this establishes the pattern
 * and the theme-preference seam the branded shell reads.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppState {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

export const useAppStore = create<AppState>((set) => ({
  themePreference: 'system',
  setThemePreference: (themePreference) => set({ themePreference }),
}));

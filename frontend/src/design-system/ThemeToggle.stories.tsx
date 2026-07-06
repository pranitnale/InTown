import type { StoryDefault } from '@ladle/react';
import { ThemeToggle } from './ThemeToggle.tsx';

export default {
  title: 'Primitives/ThemeToggle',
} satisfies StoryDefault;

/**
 * Note: this control writes the app-wide `themePreference` to the Zustand store
 * and sets `data-theme` on <html>. In the two-panel Ladle view the panels are
 * pinned to light/dark via inline token vars, so they stay fixed; the radio
 * simply demonstrates the control itself.
 */
export const Preferences = () => <ThemeToggle />;

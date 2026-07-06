import { useSyncExternalStore } from 'react';
import { useAppStore } from '../store/app.ts';
import type { ThemePreference } from '../store/app.ts';

/**
 * Theme application logic (AC #8). The effective theme is derived from the
 * user's `themePreference`:
 *   - 'system' follows `prefers-color-scheme` (no `data-theme` attribute is set,
 *     so the CSS `@media` block in ui-tokens/tokens.css governs the cascade);
 *   - 'light' / 'dark' set `data-theme` explicitly as an override.
 * `prefers-color-scheme` changes are observed via a matchMedia listener so the
 * effective theme (and anything derived from it, e.g. the basemap) stays live.
 */
export type EffectiveTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

export function getSystemTheme(): EffectiveTheme {
  if (!hasMatchMedia()) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function subscribeSystemTheme(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => {};
  const mql = window.matchMedia(DARK_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** Reactive `prefers-color-scheme` value; SSR-safe (server snapshot = 'light'). */
export function useSystemTheme(): EffectiveTheme {
  return useSyncExternalStore(subscribeSystemTheme, getSystemTheme, () => 'light');
}

export function resolveEffectiveTheme(
  preference: ThemePreference,
  systemTheme: EffectiveTheme,
): EffectiveTheme {
  return preference === 'system' ? systemTheme : preference;
}

/** The concrete light/dark theme in effect right now (preference + system). */
export function useEffectiveTheme(): EffectiveTheme {
  const preference = useAppStore((s) => s.themePreference);
  const systemTheme = useSystemTheme();
  return resolveEffectiveTheme(preference, systemTheme);
}

/**
 * Write (or clear) the `data-theme` attribute on <html> for the given
 * preference. 'system' intentionally clears it so the CSS media query governs.
 */
export function applyThemeAttribute(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

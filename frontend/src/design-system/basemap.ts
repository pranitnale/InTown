import { useEffectiveTheme, type EffectiveTheme } from '../app-shell/theme.ts';

/**
 * Basemap style config (§17 — "Basemap gets a true dark tile style, never CSS
 * inversion"). These are genuine, independent light/dark map style descriptors
 * that later map phases (P17 backend / P18 UI) consume — dark mode swaps the
 * whole style, it does NOT invert the light basemap with a CSS filter.
 *
 * The `styleUrl` values are placeholders for the real self-hosted MapLibre style
 * JSON endpoints wired up by the map platform phase; the shape and the
 * light↔dark split are what P01 fixes in place.
 */
export interface BasemapStyle {
  /** Stable identifier for the style. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Which theme this style is authored for. */
  theme: EffectiveTheme;
  /** MapLibre style JSON URL (placeholder until P17/P18). */
  styleUrl: string;
}

export const LIGHT_BASEMAP: BasemapStyle = {
  id: 'intown-light',
  label: 'InTown Light',
  theme: 'light',
  styleUrl: 'https://tiles.intown.app/styles/intown-light/style.json',
};

export const DARK_BASEMAP: BasemapStyle = {
  id: 'intown-dark',
  label: 'InTown Dark',
  theme: 'dark',
  styleUrl: 'https://tiles.intown.app/styles/intown-dark/style.json',
};

export function basemapStyleFor(theme: EffectiveTheme): BasemapStyle {
  return theme === 'dark' ? DARK_BASEMAP : LIGHT_BASEMAP;
}

/** The basemap style matching the theme currently in effect. */
export function useBasemapStyle(): BasemapStyle {
  return basemapStyleFor(useEffectiveTheme());
}

import { useSyncExternalStore } from 'react';

/**
 * Reactive `matchMedia` hook (SSR-safe: server/no-matchMedia snapshot = false).
 * The responsive shell is CSS/Tailwind-driven for pure layout; this hook exists
 * for the few cases that need the breakpoint in JS (e.g. deciding whether the
 * secondary surface renders as the desktop side-panel or the mobile drawer).
 */
function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!hasMatchMedia()) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => (hasMatchMedia() ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** Tailwind `md` breakpoint (48rem / 768px). Desktop = side-panel; below = drawer. */
export const MD_BREAKPOINT = '(min-width: 48rem)';

/** True on a desktop-width viewport (fixed right side-panel layout). */
export function useIsDesktop(): boolean {
  return useMediaQuery(MD_BREAKPOINT);
}

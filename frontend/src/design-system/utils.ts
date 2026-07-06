/** Tiny classNames joiner — no runtime dep. Falsy values are dropped. */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}

/**
 * Shared focus-visible ring, token-driven (`--focus`). Every interactive
 * primitive composes this so the focus affordance is identical app-wide and
 * follows the light/dark cascade.
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

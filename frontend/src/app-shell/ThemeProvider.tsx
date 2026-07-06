import { useEffect, type ReactNode } from 'react';
import { useAppStore } from '../store/app.ts';
import { applyThemeAttribute } from './theme.ts';

/**
 * Applies the active theme preference to <html> app-wide (AC #8). Mount once
 * near the root. When the preference is 'system' no attribute is written and
 * the CSS `@media (prefers-color-scheme)` cascade takes over automatically.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useAppStore((s) => s.themePreference);

  useEffect(() => {
    applyThemeAttribute(preference);
  }, [preference]);

  return <>{children}</>;
}

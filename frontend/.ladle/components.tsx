import type { CSSProperties, ReactNode } from 'react';
import type { GlobalProvider } from '@ladle/react';
import { lightTokens, darkTokens } from '../ui-tokens/tokens.ts';
import '../src/index.css';

/**
 * Ladle global provider. Loads the app's Tailwind + generated design tokens
 * (via `../src/index.css`) and renders every story TWICE — once in a
 * `data-theme="light"` panel and once in `data-theme="dark"` — so each story is
 * viewable in both themes side by side without touching `<html>`.
 *
 * The token custom properties are set as INLINE vars on each panel (read from
 * the generated `ui-tokens/tokens.ts`, never hardcoded). Inline vars win within
 * the panel subtree, so theming is correct regardless of the OS color scheme or
 * Ladle's own dark-mode chrome toggle. Tailwind's `@theme inline` utilities
 * resolve `var(--bg)` etc. from these panel-local values.
 */
function toVars(tokens: Record<string, string>): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    vars[`--${key}`] = value;
  }
  return vars as CSSProperties;
}

const LIGHT_VARS = { ...toVars(lightTokens), colorScheme: 'light' } as CSSProperties;
const DARK_VARS = { ...toVars(darkTokens), colorScheme: 'dark' } as CSSProperties;

function Panel({ theme, vars, children }: { theme: 'light' | 'dark'; vars: CSSProperties; children: ReactNode }) {
  return (
    <div data-theme={theme} style={vars} className="bg-bg text-text">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{theme}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export const Provider: GlobalProvider = ({ children }) => (
  <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2" style={{ minHeight: '100vh' }}>
    <Panel theme="light" vars={LIGHT_VARS}>
      {children}
    </Panel>
    <Panel theme="dark" vars={DARK_VARS}>
      {children}
    </Panel>
  </div>
);

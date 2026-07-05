import { CATEGORY_VALUES } from '@intown/contracts/types';
import { useAppStore } from './store/app.ts';

/**
 * Blank branded shell. It exercises the contract seam (the single §5.4 category
 * enum) and the Zustand store; real screens/routes arrive in later phases.
 */
const PLACE_CATEGORIES: readonly string[] = CATEGORY_VALUES;

export default function App() {
  const themePreference = useAppStore((s) => s.themePreference);

  return (
    <div
      className="app-shell"
      data-theme-preference={themePreference}
      data-category-count={PLACE_CATEGORIES.length}
    >
      <header className="app-header">
        <span className="app-wordmark">InTown</span>
      </header>
      <main className="app-main" aria-label="App content">
        {/* Intentionally empty: P00 ships a deployable blank shell. */}
      </main>
    </div>
  );
}

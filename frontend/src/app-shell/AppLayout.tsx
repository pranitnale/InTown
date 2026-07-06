import { NavLink, Outlet } from 'react-router';
import { ThemeToggle, cn } from '../design-system/index.ts';
import { InstallButton } from './InstallButton.tsx';

/**
 * Responsive app shell (AC #5) — one codebase, breakpoint-driven:
 *   - Desktop (≥ md / 48rem): a fixed RIGHT side-panel layout (the `<aside>`),
 *     with primary content on the left.
 *   - Mobile (< md): single column; primary nav collapses to a bottom bar, and
 *     the secondary surface is presented via the `<BottomSheet>` drawer (mounted
 *     by screens that need it, e.g. the Home screen). The side-panel ↔ drawer
 *     swap is pure Tailwind responsive utilities (`hidden md:*` / `md:hidden`).
 */
const NAV = [
  { to: '/trips', label: 'Trips' },
  { to: '/settings', label: 'Settings' },
] as const;

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'rounded-md px-3 py-1.5 text-base font-medium transition-colors motion-reduce:transition-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    isActive ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-surface hover:text-text',
  );
}

export function AppLayout() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg text-text">
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-surface px-4 py-3">
        <NavLink to="/" className="text-lg font-bold tracking-tight text-primary">
          InTown
        </NavLink>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <InstallButton />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 md:grid md:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>
        {/* Desktop-only fixed right side-panel. On mobile this surface is the
            BottomSheet drawer instead (see AppLayout doc + Home screen). */}
        <aside
          aria-label="Side panel"
          className="hidden border-l border-border bg-surface p-4 md:block"
        >
          <p className="text-sm text-text-secondary">
            Side panel — desktop secondary surface. Contextual content arrives in later phases.
          </p>
        </aside>
      </div>

      {/* Mobile bottom nav bar (the desktop primary nav lives in the header). */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-border bg-surface px-2 py-2 md:hidden"
      >
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

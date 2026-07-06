import { Navigate, Outlet, useLocation } from 'react-router';
import { useAppStore } from '../store/app.ts';

/**
 * Auth gate boundary (AC #5) — a real component boundary so P03 only swaps the
 * predicate. Today it reads the STUB `isAuthed` flag from the store (default
 * `true`, so the skeleton is navigable). When unauthed it redirects to `/auth`,
 * preserving the attempted location in router state so P03 can bounce the user
 * back after sign-in.
 *
 * P03: replace the `isAuthed` selector below with the real session predicate;
 * NO route wiring changes are needed.
 */
export function RequireAuth() {
  const isAuthed = useAppStore((s) => s.isAuthed);
  const location = useLocation();

  if (!isAuthed) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

/* eslint-disable react-refresh/only-export-components */
import type { ReactElement } from 'react';
import { useSyncExternalStore } from 'react';
import { SignIn } from './screens/SignIn.tsx';
import { SignUp } from './screens/SignUp.tsx';
import { CheckEmail } from './screens/CheckEmail.tsx';
import { AuthCallback } from './screens/AuthCallback.tsx';
import { AuthError } from './screens/AuthError.tsx';
import { useSession } from './session/useSession.ts';

export interface AuthRoute {
  path: string;
  element: ReactElement;
}

/** Route table P01's router mounts. Paths are the canonical auth entry points. */
export const authRouteTable: AuthRoute[] = [
  { path: '/auth/sign-in', element: <SignIn /> },
  { path: '/auth/sign-up', element: <SignUp /> },
  { path: '/auth/check-email', element: <CheckEmail /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  { path: '/auth/error', element: <AuthError /> },
];

const noopSubscribe = () => () => {};

function matchScreen(path: string): ReactElement {
  const pathname = path.split('?')[0] ?? path;
  const route = authRouteTable.find((r) => r.path === pathname);
  return route?.element ?? <SignIn />;
}

/**
 * Self-contained auth flow for the memory navigator (dev/tests). It re-renders
 * on navigation via the navigator's optional subscribe hook and picks the screen
 * for the current path. No router library — P01 supplies the real router.
 */
export function AuthFlow() {
  const { navigator } = useSession();
  const subscribe = navigator.subscribe ?? noopSubscribe;
  const path = useSyncExternalStore(
    subscribe,
    () => navigator.currentPath,
    () => navigator.currentPath,
  );
  return matchScreen(path);
}

/* eslint-disable react-refresh/only-export-components -- provider exports its router adapter for direct protocol tests */
import { useMemo, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getRuntimeConfig } from '../../config/runtime.ts';
import { createAuthApi } from '../api/index.ts';
import type { AuthNavigator } from '../navigation.ts';
import { SessionProvider } from './SessionProvider.tsx';

export interface BrowserSessionProviderProps {
  children: ReactNode;
}

interface RouterNavigatorDeps {
  navigate(path: string | number): void;
  currentPath(): string;
}

/** Adapt React Router navigation to the auth module's small navigator seam. */
export function createRouterAuthNavigator({
  navigate,
  currentPath,
}: RouterNavigatorDeps): AuthNavigator {
  return {
    get currentPath() {
      return currentPath();
    },
    navigate(path) {
      navigate(path);
    },
    back() {
      navigate(-1);
    },
  };
}

/**
 * Application-wide browser session boundary. This is the only production auth
 * API construction point; route components never choose a mock transport.
 */
export function BrowserSessionProvider({ children }: BrowserSessionProviderProps) {
  const routeNavigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef('/');
  pathRef.current = `${location.pathname}${location.search}${location.hash}`;

  const navigator = useMemo(
    () =>
      createRouterAuthNavigator({
        navigate: (target) => {
          if (typeof target === 'number') routeNavigate(target);
          else routeNavigate(target);
        },
        currentPath: () => pathRef.current,
      }),
    [routeNavigate],
  );
  const api = useMemo(() => {
    const config = getRuntimeConfig();
    return createAuthApi({ mock: config.mockApi, baseUrl: config.apiBaseUrl });
  }, []);

  return (
    <SessionProvider api={api} navigator={navigator}>
      {children}
    </SessionProvider>
  );
}

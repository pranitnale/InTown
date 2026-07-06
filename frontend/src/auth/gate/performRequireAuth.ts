import type { AuthNavigator } from '../navigation.ts';
import type { SessionStore } from '../session/store.ts';

export const SIGN_IN_PATH = '/auth/sign-in';

/**
 * Core peak-motivation gate logic (framework-free so it is directly unit
 * testable). If authenticated, runs `resumeAction` now; otherwise stashes the
 * action + current path and opens the auth flow. It only ever acts when called —
 * it is never a mount-time / global redirect.
 */
export function performRequireAuth(
  store: SessionStore,
  navigator: AuthNavigator,
  resumeAction?: () => void,
): void {
  const state = store.getState();
  if (state.status === 'authenticated') {
    resumeAction?.();
    return;
  }
  state.beginAuth(navigator.currentPath, resumeAction);
  navigator.navigate(SIGN_IN_PATH);
}

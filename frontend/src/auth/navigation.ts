/**
 * Router-agnostic navigation seam for the auth flow. P03 ships an in-memory
 * navigator for isolated dev/tests; at the P01 merge the app supplies a concrete
 * router-backed implementation of {@link AuthNavigator}. No router library here.
 */

export interface AuthNavigator {
  /** Navigate to an absolute in-app path. */
  navigate(path: string): void;
  /** The current in-app path. */
  currentPath: string;
  /** Go back one entry in history (no-op at the root). */
  back(): void;
  /**
   * Optional change subscription so React views (e.g. <AuthFlow/>) can re-render
   * on navigation via useSyncExternalStore. Router-backed navigators may omit it
   * and drive re-renders through the router instead.
   */
  subscribe?(listener: () => void): () => void;
}

/** In-memory navigator with a history stack and change notifications. */
export function createMemoryNavigator(initialPath = '/'): AuthNavigator {
  const stack: string[] = [initialPath];
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    get currentPath() {
      return stack[stack.length - 1] ?? initialPath;
    },
    navigate(path: string) {
      stack.push(path);
      emit();
    },
    back() {
      if (stack.length > 1) {
        stack.pop();
        emit();
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

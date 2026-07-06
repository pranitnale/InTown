import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { User } from '@intown/contracts/types';
import type { AuthApi } from '../api/index.ts';
import { SessionExpiredError } from '../api/index.ts';
import type { AuthNavigator } from '../navigation.ts';

export type SessionStatus = 'anonymous' | 'authenticated' | 'expired';

const SIGN_IN_PATH = '/auth/sign-in';

/** Stable sessionStorage key for the return-to-origin path. */
export const REDIRECT_STORAGE_KEY = 'intown.auth.redirectTo';

/**
 * Minimal session-scoped persistence seam. In the browser this is the native
 * `sessionStorage`; tests inject an in-memory implementation. No dependency.
 */
export interface RedirectStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Feature-detect browser sessionStorage; `null` under SSR / node tests. */
function detectRedirectStorage(): RedirectStorage | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

function writeRedirect(storage: RedirectStorage | null, path: string): void {
  try {
    storage?.setItem(REDIRECT_STORAGE_KEY, path);
  } catch {
    /* ignore privacy-mode / quota failures */
  }
}

function readRedirect(storage: RedirectStorage | null): string | null {
  try {
    return storage?.getItem(REDIRECT_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function clearRedirect(storage: RedirectStorage | null): void {
  try {
    storage?.removeItem(REDIRECT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export interface SessionState {
  status: SessionStatus;
  user: User | null;
  /** Path to return to after a successful auth (captured at the gate). */
  redirectTo: string | null;
  /** Action stashed by the gate, replayed after a successful auth. */
  pendingResume: (() => void) | null;

  /** Capture where to return to and what to run after auth. */
  beginAuth: (fromPath: string, resume?: () => void) => void;
  /** Probe the server session and reconcile local state. */
  refresh: () => Promise<void>;
  /** Finish an OAuth / magic-link return, then replay the redirect + resume. */
  completeAuth: (params: Record<string, string>) => Promise<void>;
  /** Server revoke + local clear. */
  signOut: () => Promise<void>;
  /** Mark the session expired and route to sign-in (server said 401 mid-use). */
  reportExpired: () => void;
  /** Run a protected op, converting a 401 into an expiry transition. */
  guard: <T>(op: () => Promise<T>) => Promise<T>;
}

export type SessionStore = UseBoundStore<StoreApi<SessionState>>;

export interface SessionStoreDeps {
  api: AuthApi;
  navigator: AuthNavigator;
  /**
   * Where the return-to-origin path is persisted so it survives the full-page
   * OAuth / magic-link round-trip. Defaults to feature-detected
   * `sessionStorage`; pass `null` to disable, or inject one in tests.
   */
  redirectStorage?: RedirectStorage | null;
}

/**
 * P03-LOCAL session store (own Zustand instance — never touches
 * `src/store/app.ts`). One instance per SessionProvider so dev/tests stay
 * isolated.
 */
export function createSessionStore({
  api,
  navigator,
  redirectStorage,
}: SessionStoreDeps): SessionStore {
  const persist =
    redirectStorage === undefined ? detectRedirectStorage() : redirectStorage;

  return create<SessionState>((set, get) => ({
    status: 'anonymous',
    user: null,
    redirectTo: null,
    pendingResume: null,

    beginAuth(fromPath, resume) {
      // Persist the serializable part so return-to-origin survives the
      // full-page OAuth / magic-link navigation. `pendingResume` is an
      // in-memory closure and CANNOT survive a reload — replaying the gated
      // action after landing is wired at the P02 merge (documented
      // integration point), not solved here.
      writeRedirect(persist, fromPath);
      set({ redirectTo: fromPath, pendingResume: resume ?? null });
    },

    async refresh() {
      const info = await api.getSession();
      if (info.status === 'authenticated') {
        set({ status: 'authenticated', user: info.user });
      } else if (info.status === 'expired') {
        get().reportExpired();
      } else {
        set({ status: 'anonymous', user: null });
      }
    },

    async completeAuth(params) {
      const info = await api.completeCallback(params);
      if (info.status !== 'authenticated') {
        get().reportExpired();
        return;
      }
      const { redirectTo, pendingResume } = get();
      // In-memory `redirectTo` is wiped by the full-page auth round-trip, so
      // fall back to the persisted sessionStorage copy, then clear it.
      const target = redirectTo ?? readRedirect(persist) ?? '/';
      clearRedirect(persist);
      set({ status: 'authenticated', user: info.user, redirectTo: null, pendingResume: null });
      navigator.navigate(target);
      pendingResume?.();
    },

    async signOut() {
      await api.signOut();
      clearRedirect(persist);
      set({ status: 'anonymous', user: null, redirectTo: null, pendingResume: null });
    },

    reportExpired() {
      set({ status: 'expired', user: null });
      navigator.navigate(SIGN_IN_PATH);
    },

    async guard(op) {
      try {
        return await op();
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          get().reportExpired();
        }
        throw err;
      }
    },
  }));
}

/**
 * Mount-time reconciliation. Probe the server session, but never let a
 * network / 5xx failure become an unhandled rejection at startup: on failure
 * reconcile to anonymous and let the user proceed. (A 401 / expired session is
 * handled inside `refresh()` via `reportExpired` and does not reject.)
 */
export function reconcileSessionOnMount(store: SessionStore): Promise<void> {
  return store
    .getState()
    .refresh()
    .catch(() => {
      store.setState({ status: 'anonymous', user: null });
    });
}

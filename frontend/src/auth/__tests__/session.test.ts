import { describe, it, expect, vi } from 'vitest';
import {
  createSessionStore,
  reconcileSessionOnMount,
  REDIRECT_STORAGE_KEY,
} from '../session/store.ts';
import { createMemoryNavigator } from '../navigation.ts';
import { createMockAuthApi } from '../api/mock.ts';

describe('session store', () => {
  it('sign-out revokes on the server and clears the session', async () => {
    const api = createMockAuthApi();
    const signOut = vi.spyOn(api, 'signOut');
    const navigator = createMemoryNavigator('/');
    const store = createSessionStore({ api, navigator });
    store.setState({ status: 'authenticated' });

    await store.getState().signOut();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe('anonymous');
    expect(store.getState().user).toBeNull();
  });

  it('an expired session sets status=expired and redirects to sign-in', async () => {
    const api = createMockAuthApi({ expired: true });
    const navigator = createMemoryNavigator('/trips/42');
    const store = createSessionStore({ api, navigator });

    await store.getState().refresh();

    expect(store.getState().status).toBe('expired');
    expect(navigator.currentPath).toBe('/auth/sign-in');
  });

  it('after successful auth it replays redirectTo and the stashed action', async () => {
    const api = createMockAuthApi();
    const navigator = createMemoryNavigator('/auth/sign-in');
    const store = createSessionStore({ api, navigator });
    const resume = vi.fn();

    store.getState().beginAuth('/trips/42', resume);
    await store.getState().completeAuth({ code: 'abc' });

    expect(store.getState().status).toBe('authenticated');
    expect(store.getState().user).not.toBeNull();
    expect(navigator.currentPath).toBe('/trips/42');
    expect(resume).toHaveBeenCalledTimes(1);
    // stash cleared after replay
    expect(store.getState().pendingResume).toBeNull();
    expect(store.getState().redirectTo).toBeNull();
  });

  it('mount reconciliation surfaces a failing session probe as temporarily unavailable', async () => {
    const api = createMockAuthApi();
    vi.spyOn(api, 'getSession').mockRejectedValue(new Error('network down'));
    const navigator = createMemoryNavigator('/');
    const store = createSessionStore({ api, navigator, redirectStorage: null });

    // Must resolve (no unhandled rejection) even though getSession rejects.
    await expect(reconcileSessionOnMount(store)).resolves.toBeUndefined();

    expect(store.getState().status).toBe('unavailable');
    expect(store.getState().user).toBeNull();
    expect(store.getState().error).toBe('network down');
  });

  it('persists redirectTo to injected storage and restores it across a remount', async () => {
    const backing = new Map<string, string>();
    const redirectStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => {
        backing.set(k, v);
      },
      removeItem: (k: string) => {
        backing.delete(k);
      },
    };

    // First "page": the gate stashes the origin path before the browser leaves.
    const store1 = createSessionStore({
      api: createMockAuthApi(),
      navigator: createMemoryNavigator('/trips/42'),
      redirectStorage,
    });
    store1.getState().beginAuth('/trips/42');
    expect(backing.get(REDIRECT_STORAGE_KEY)).toBe('/trips/42');

    // Second "page" after the OAuth round-trip: a fresh store (in-memory
    // redirectTo lost) sharing the same sessionStorage restores the target.
    const navigator2 = createMemoryNavigator('/auth/callback');
    const store2 = createSessionStore({
      api: createMockAuthApi(),
      navigator: navigator2,
      redirectStorage,
    });
    expect(store2.getState().redirectTo).toBeNull(); // memory did not survive

    await store2.getState().completeAuth({ code: 'abc' });

    expect(navigator2.currentPath).toBe('/trips/42');
    // Persisted key cleared once consumed.
    expect(backing.has(REDIRECT_STORAGE_KEY)).toBe(false);
  });
});

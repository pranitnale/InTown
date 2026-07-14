import { describe, it, expect, vi } from 'vitest';
import { createSessionStore } from '../session/store.ts';
import { createMemoryNavigator } from '../navigation.ts';
import { createMockAuthApi } from '../api/mock.ts';
import { performRequireAuth } from '../gate/performRequireAuth.ts';

describe('peak-motivation gate', () => {
  it('runs the action immediately when authenticated (no navigation)', () => {
    const api = createMockAuthApi();
    const navigator = createMemoryNavigator('/trips/42');
    const store = createSessionStore({ api, navigator });
    store.setState({ status: 'authenticated' });
    const action = vi.fn();

    performRequireAuth(store, navigator, action);

    expect(action).toHaveBeenCalledTimes(1);
    expect(navigator.currentPath).toBe('/trips/42');
  });

  it('is not a global guard: nothing happens until requireAuth is invoked', () => {
    const api = createMockAuthApi();
    const navigator = createMemoryNavigator('/trips/42');
    const store = createSessionStore({ api, navigator });

    // Simply constructing the session must not redirect or change status.
    expect(navigator.currentPath).toBe('/trips/42');
    expect(store.getState().status).toBe('loading');
    expect(store.getState().pendingResume).toBeNull();
  });

  it('when anonymous: stashes the action, opens auth, and replays after success', async () => {
    const api = createMockAuthApi();
    const navigator = createMemoryNavigator('/trips/42');
    const store = createSessionStore({ api, navigator });
    const action = vi.fn();
    store.setState({ status: 'anonymous' });

    performRequireAuth(store, navigator, action);

    // Action deferred; auth flow opened; return path + action stashed.
    expect(action).not.toHaveBeenCalled();
    expect(navigator.currentPath).toBe('/auth/sign-in');
    expect(store.getState().redirectTo).toBe('/trips/42');
    expect(store.getState().pendingResume).toBe(action);

    // Successful auth replays the stashed action and returns to the origin.
    await store.getState().completeAuth({ code: 'abc' });

    expect(action).toHaveBeenCalledTimes(1);
    expect(navigator.currentPath).toBe('/trips/42');
    expect(store.getState().status).toBe('authenticated');
  });
});

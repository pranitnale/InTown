import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '../../routes-scaffold/RequireAuth.tsx';
import { createMockAuthApi } from '../api/mock.ts';
import { createRouterAuthNavigator } from '../session/BrowserSessionProvider.tsx';
import { SessionProvider } from '../session/SessionProvider.tsx';
import { createSessionStore, normalizeReturnPath } from '../session/store.ts';
import { createMemoryNavigator } from '../navigation.ts';

describe('router/session integration', () => {
  it('adapts browser-router navigation without losing query/hash return paths', () => {
    let current = '/settings?tab=data#privacy';
    const navigate = vi.fn((target: string | number) => {
      if (typeof target === 'string') current = target;
    });
    const navigator = createRouterAuthNavigator({ navigate, currentPath: () => current });

    expect(navigator.currentPath).toBe('/settings?tab=data#privacy');
    navigator.navigate('/auth/sign-in');
    expect(navigate).toHaveBeenCalledWith('/auth/sign-in');
    navigator.back();
    expect(navigate).toHaveBeenLastCalledWith(-1);
  });

  it('renders an explicit loading state while the real session probe is pending', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/settings?tab=data']}>
        <SessionProvider
          api={createMockAuthApi()}
          navigator={createMemoryNavigator('/settings?tab=data')}
          autoRefresh={false}
        >
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/settings" element={<p>private settings</p>} />
            </Route>
          </Routes>
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(html).toContain('Checking your session');
    expect(html).not.toContain('private settings');
  });

  it('preserves safe local returns and rejects external/protocol-relative targets', () => {
    expect(normalizeReturnPath('/trips/42?day=2#stop')).toBe('/trips/42?day=2#stop');
    expect(normalizeReturnPath('https://evil.example/phish')).toBe('/');
    expect(normalizeReturnPath('//evil.example/phish')).toBe('/');

    const storage = new Map<string, string>();
    const store = createSessionStore({
      api: createMockAuthApi(),
      navigator: createMemoryNavigator('/settings?tab=data'),
      redirectStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => void storage.set(key, value),
        removeItem: (key) => void storage.delete(key),
      },
    });
    store.getState().beginAuth('/settings?tab=data#privacy');
    expect(store.getState().redirectTo).toBe('/settings?tab=data#privacy');
  });
});

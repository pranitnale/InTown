import { describe, expect, it, vi } from 'vitest';
import type { TravelerProfile } from '@intown/contracts/types';
import type { ProfileApi } from '../api/types.ts';
import { createProfileApi } from '../api/index.ts';
import { createMockProfileApi } from '../api/mock.ts';
import { ProfileSessionExpiredError } from '../api/types.ts';
import { createProfileStore } from '../store/profileStore.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('profile live selection and load safety', () => {
  it('uses the live client by default and the mock only when explicitly selected', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));
    const live = createProfileApi({ baseUrl: 'https://api.intown.test', fetchImpl });

    await expect(live.getProfile()).rejects.toBeInstanceOf(ProfileSessionExpiredError);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.intown.test/api/profile');

    const mockFetch = vi.fn<typeof fetch>();
    const mock = createProfileApi({ mock: true, fetchImpl: mockFetch });
    await expect(mock.getProfile()).resolves.toMatchObject({ handle: expect.any(String) });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not let a slow initial load overwrite a newer confirmed traveler save', async () => {
    const base = createMockProfileApi();
    const staleTraveler = (await base.getTravelerProfile()) as TravelerProfile;
    const pendingTraveler = deferred<TravelerProfile | null>();
    const api: ProfileApi = {
      ...base,
      getTravelerProfile: () => pendingTraveler.promise,
    };
    const store = createProfileStore(api);

    const loading = store.getState().load();
    const saved = await store.getState().saveTraveler({ age_band: '65+' });
    expect(saved.age_band).toBe('65+');

    pendingTraveler.resolve(staleTraveler);
    await loading;

    expect(store.getState().status).toBe('ready');
    expect(store.getState().traveler?.age_band).toBe('65+');
    expect(store.getState().traveler?.mobility).toBe(staleTraveler.mobility);
  });

  it('reports a live profile 401 to the global session boundary', async () => {
    const expired = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));
    const store = createProfileStore(createProfileApi({ fetchImpl }), expired);

    await store.getState().load();

    expect(expired).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe('error');
  });
});

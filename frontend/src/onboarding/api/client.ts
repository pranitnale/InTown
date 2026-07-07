import { User, TravelerProfile, TasteProfile, AccountExport } from '@intown/contracts/types';
import {
  authRoutes,
  type UpdateProfileBody,
  type UpdateTravelerProfileBody,
  type UpdateTasteProfileBody,
} from '@intown/contracts/api';
import type { ProfileApi } from './types.ts';
import { ProfileSessionExpiredError, ProfileBadRequestError } from './types.ts';

export interface ProfileClientOptions {
  /** Base origin for the API. Empty = same origin. */
  baseUrl?: string;
  /** Injectable transport so tests/harness can stub the network. */
  fetchImpl?: typeof fetch;
}

/**
 * Live {@link ProfileApi} keyed off the frozen `contracts/api` route objects —
 * paths and methods are read from `authRoutes[...]`, never hardcoded. Mirrors
 * `createAuthClient`.
 */
export function createProfileClient({ baseUrl = '', fetchImpl }: ProfileClientOptions = {}): ProfileApi {
  const doFetch: typeof fetch = fetchImpl ?? ((...args) => globalThis.fetch(...args));
  const url = (path: string) => `${baseUrl}${path}`;

  async function json(res: Response): Promise<unknown> {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  function guard(res: Response, label: string): void {
    if (res.status === 401) throw new ProfileSessionExpiredError();
    // A 400 is a rejected body (e.g. a partial first-time traveler create): the
    // caller must fix the body, not retry — surface it as a distinct error.
    if (res.status === 400) throw new ProfileBadRequestError(`${label} rejected: 400`);
    if (!res.ok) throw new Error(`${label} failed: ${res.status}`);
  }

  return {
    async getProfile(): Promise<User> {
      const route = authRoutes['auth.getProfile'];
      const res = await doFetch(url(route.path), { method: route.method, credentials: 'include' });
      guard(res, 'getProfile');
      return User.parse(await json(res));
    },

    async updateProfile(body: UpdateProfileBody): Promise<User> {
      const route = authRoutes['auth.updateProfile'];
      const res = await doFetch(url(route.path), {
        method: route.method,
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      guard(res, 'updateProfile');
      return User.parse(await json(res));
    },

    async getTravelerProfile(): Promise<TravelerProfile | null> {
      const route = authRoutes['auth.getTravelerProfile'];
      const res = await doFetch(url(route.path), { method: route.method, credentials: 'include' });
      guard(res, 'getTravelerProfile');
      return TravelerProfile.nullable().parse(await json(res));
    },

    async updateTravelerProfile(body: UpdateTravelerProfileBody): Promise<TravelerProfile> {
      const route = authRoutes['auth.updateTravelerProfile'];
      const res = await doFetch(url(route.path), {
        method: route.method,
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      guard(res, 'updateTravelerProfile');
      return TravelerProfile.parse(await json(res));
    },

    async getTasteProfile(): Promise<TasteProfile | null> {
      const route = authRoutes['auth.getTasteProfile'];
      const res = await doFetch(url(route.path), { method: route.method, credentials: 'include' });
      guard(res, 'getTasteProfile');
      return TasteProfile.nullable().parse(await json(res));
    },

    async updateTasteProfile(body: UpdateTasteProfileBody): Promise<TasteProfile> {
      const route = authRoutes['auth.updateTasteProfile'];
      const res = await doFetch(url(route.path), {
        method: route.method,
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      guard(res, 'updateTasteProfile');
      return TasteProfile.parse(await json(res));
    },

    async exportAccount(): Promise<AccountExport> {
      const route = authRoutes['auth.exportAccount'];
      const res = await doFetch(url(route.path), { method: route.method, credentials: 'include' });
      guard(res, 'exportAccount');
      return AccountExport.parse(await json(res));
    },

    async eraseAccount(): Promise<{ erased: boolean }> {
      const route = authRoutes['auth.eraseAccount'];
      const res = await doFetch(url(route.path), { method: route.method, credentials: 'include' });
      guard(res, 'eraseAccount');
      return route.response.parse(await json(res)) as { erased: boolean };
    },
  };
}

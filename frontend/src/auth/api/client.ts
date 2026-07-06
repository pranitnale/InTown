import { User, Consent } from '@intown/contracts/types';
import { authRoutes, type SetConsentBody } from '@intown/contracts/api';
import type { AuthApi, OAuthStart, SessionInfo, StartResult } from './types.ts';
import { SessionExpiredError } from './types.ts';

export interface AuthClientOptions {
  /** Base origin for the API (e.g. `https://api.intown.app`). Empty = same origin. */
  baseUrl?: string;
  /** Injectable transport so tests/harness can stub the network. */
  fetchImpl?: typeof fetch;
}

/** Auth.js catch-all sub-paths (the contract's `/api/auth/*` glob, decision #21). */
const AUTH_BASE = '/api/auth';

export function createAuthClient({ baseUrl = '', fetchImpl }: AuthClientOptions = {}): AuthApi {
  const doFetch: typeof fetch =
    fetchImpl ?? ((...args) => globalThis.fetch(...args));

  const url = (path: string) => `${baseUrl}${path}`;

  async function json(res: Response): Promise<unknown> {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  return {
    async getSession(): Promise<SessionInfo> {
      const res = await doFetch(url(authRoutes['auth.getProfile'].path), {
        method: 'GET',
        credentials: 'include',
      });
      if (res.status === 401) return { status: 'anonymous', user: null };
      if (!res.ok) throw new Error(`getSession failed: ${res.status}`);
      const user = User.parse(await json(res));
      return { status: 'authenticated', user };
    },

    async startMagicLink(email: string): Promise<StartResult> {
      const res = await doFetch(url(`${AUTH_BASE}/signin/email`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      return { ok: res.ok };
    },

    async startGoogleOAuth(): Promise<OAuthStart> {
      // Auth.js begins the provider dance at this sub-path; the browser is
      // redirected there. P02 finalizes CSRF/handshake specifics.
      return { redirectUrl: url(`${AUTH_BASE}/signin/google`) };
    },

    async completeCallback(params: Record<string, string>): Promise<SessionInfo> {
      const query = new URLSearchParams(params).toString();
      const res = await doFetch(url(`${AUTH_BASE}/callback?${query}`), {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`callback failed: ${res.status}`);
      // Cookie session is now set; load the typed profile.
      return this.getSession();
    },

    async signOut(): Promise<void> {
      await doFetch(url(`${AUTH_BASE}/signout`), {
        method: 'POST',
        credentials: 'include',
      });
    },

    async getConsents(): Promise<Consent[]> {
      const res = await doFetch(url(authRoutes['auth.getConsents'].path), {
        method: 'GET',
        credentials: 'include',
      });
      if (res.status === 401) throw new SessionExpiredError();
      if (!res.ok) throw new Error(`getConsents failed: ${res.status}`);
      return Consent.array().parse(await json(res));
    },

    async setConsent(body: SetConsentBody): Promise<Consent> {
      const res = await doFetch(url(authRoutes['auth.setConsent'].path), {
        method: authRoutes['auth.setConsent'].method,
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.status === 401) throw new SessionExpiredError();
      if (!res.ok) throw new Error(`setConsent failed: ${res.status}`);
      return Consent.parse(await json(res));
    },
  };
}

import { User, Consent } from '@intown/contracts/types';
import { authRoutes, type SetConsentBody } from '@intown/contracts/api';
import type { AuthApi, OAuthStart, SessionInfo, StartResult } from './types.ts';
import { SessionExpiredError } from './types.ts';

export interface AuthClientOptions {
  /** Base origin for the API (e.g. `https://api.intown.app`). Empty = same origin. */
  baseUrl?: string;
  /** Injectable transport so tests/harness can stub the network. */
  fetchImpl?: typeof fetch;
  /** Frontend landing URL after Auth.js finishes its provider callback. */
  callbackUrl?: string;
}

/** Auth.js catch-all sub-paths (the contract's `/api/auth/*` glob, decision #21). */
const AUTH_BASE = '/api/auth';

function browserCallbackUrl(): string {
  if (typeof window === 'undefined') return '/auth/callback';
  return new URL('/auth/callback', window.location.origin).href;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createAuthClient({
  baseUrl = '',
  fetchImpl,
  callbackUrl,
}: AuthClientOptions = {}): AuthApi {
  const doFetch: typeof fetch =
    fetchImpl ?? ((...args) => globalThis.fetch(...args));

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const url = (path: string) => `${normalizedBase}${path}`;
  const landingUrl = callbackUrl ?? browserCallbackUrl();

  async function json(res: Response, label: string): Promise<unknown> {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${label} returned invalid JSON`);
    }
  }

  async function getCsrfToken(): Promise<string> {
    const res = await doFetch(url(`${AUTH_BASE}/csrf`), {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`CSRF token request failed: ${res.status}`);
    const body = await json(res, 'CSRF token request');
    if (!isRecord(body) || typeof body.csrfToken !== 'string' || !body.csrfToken.trim()) {
      throw new Error('CSRF token response was missing csrfToken');
    }
    return body.csrfToken;
  }

  function validatedRedirect(raw: unknown, label: string): string {
    if (!isRecord(raw) || typeof raw.url !== 'string' || !raw.url.trim()) {
      throw new Error(`${label} response was missing a redirect URL`);
    }

    const fallbackOrigin =
      normalizedBase ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    let redirect: URL;
    try {
      redirect = new URL(raw.url, fallbackOrigin);
    } catch {
      throw new Error(`${label} returned an invalid redirect URL`);
    }
    if (redirect.protocol !== 'http:' && redirect.protocol !== 'https:') {
      throw new Error(`${label} returned an unsafe redirect URL`);
    }
    if (redirect.pathname.startsWith(`${AUTH_BASE}/error`) || redirect.searchParams.has('error')) {
      throw new Error(`${label} was rejected by the authentication server`);
    }
    return redirect.href;
  }

  async function postAuth(
    path: string,
    fields: Record<string, string>,
    label: string,
  ): Promise<string> {
    const csrfToken = await getCsrfToken();
    const body = new URLSearchParams({
      ...fields,
      csrfToken,
      callbackUrl: landingUrl,
      json: 'true',
    });
    const res = await doFetch(url(path), {
      method: 'POST',
      credentials: 'include',
      redirect: 'manual',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        'X-Auth-Return-Redirect': '1',
      },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`${label} failed: ${res.status}`);
    return validatedRedirect(await json(res, label), label);
  }

  return {
    async getSession(): Promise<SessionInfo> {
      const res = await doFetch(url(authRoutes['auth.getProfile'].path), {
        method: 'GET',
        credentials: 'include',
      });
      if (res.status === 401) return { status: 'anonymous', user: null };
      if (!res.ok) throw new Error(`getSession failed: ${res.status}`);
      const user = User.parse(await json(res, 'getSession'));
      return { status: 'authenticated', user };
    },

    async startMagicLink(email: string): Promise<StartResult> {
      // The configured Auth.js email provider id is "nodemailer". Auth.js
      // requires a CSRF cookie/token pair and URL-encoded fields for this POST.
      await postAuth(`${AUTH_BASE}/signin/nodemailer`, { email }, 'Magic-link sign-in');
      return { ok: true };
    },

    async startGoogleOAuth(): Promise<OAuthStart> {
      // A GET to /signin/google renders/errors; the real Auth.js provider dance
      // starts with the same CSRF-protected form POST used by its web client.
      const redirectUrl = await postAuth(
        `${AUTH_BASE}/signin/google`,
        {},
        'Google sign-in',
      );
      return { redirectUrl };
    },

    async completeCallback(params: Record<string, string>): Promise<SessionInfo> {
      if (params.error) throw new Error(`Authentication callback failed: ${params.error}`);
      // Auth.js has already handled /callback/nodemailer or /callback/google
      // before redirecting the browser here. Never call the provider-less
      // /api/auth/callback path; just reconcile the new cookie-backed session.
      return this.getSession();
    },

    async signOut(): Promise<void> {
      await postAuth(`${AUTH_BASE}/signout`, {}, 'Sign-out');
    },

    async getConsents(): Promise<Consent[]> {
      const res = await doFetch(url(authRoutes['auth.getConsents'].path), {
        method: 'GET',
        credentials: 'include',
      });
      if (res.status === 401) throw new SessionExpiredError();
      if (!res.ok) throw new Error(`getConsents failed: ${res.status}`);
      return Consent.array().parse(await json(res, 'getConsents'));
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
      return Consent.parse(await json(res, 'setConsent'));
    },
  };
}

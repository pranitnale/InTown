import { describe, expect, it, vi } from 'vitest';
import { createAuthClient } from '../api/client.ts';

const CALLBACK_URL = 'https://app.intown.test/auth/callback';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function userResponse(): Response {
  return jsonResponse({
    id: '00000000-0000-4000-8000-000000000001',
    email: 'traveler@example.com',
    display_name: 'Traveler',
    handle: 'traveler',
    locale: 'en',
    created_at: '2026-07-06T12:00:00Z',
    updated_at: '2026-07-06T12:00:00Z',
  });
}

function expectAuthForm(call: unknown[], expectedPath: string) {
  expect(call[0]).toBe(`https://api.intown.test${expectedPath}`);
  const init = call[1] as RequestInit;
  expect(init.method).toBe('POST');
  expect(init.credentials).toBe('include');
  expect(init.redirect).toBe('manual');
  expect(new Headers(init.headers).get('content-type')).toBe(
    'application/x-www-form-urlencoded',
  );
  expect(new Headers(init.headers).get('X-Auth-Return-Redirect')).toBe('1');
  return new URLSearchParams(init.body as string);
}

describe('Auth.js browser protocol', () => {
  it('starts nodemailer magic-link sign-in with CSRF and a URL-encoded form', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-magic' }))
      .mockResolvedValueOnce(
        jsonResponse({ url: 'https://api.intown.test/api/auth/verify-request?provider=nodemailer' }),
      );
    const api = createAuthClient({
      baseUrl: 'https://api.intown.test',
      callbackUrl: CALLBACK_URL,
      fetchImpl,
    });

    await expect(api.startMagicLink('person@example.com')).resolves.toEqual({ ok: true });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.intown.test/api/auth/csrf');
    const form = expectAuthForm(fetchImpl.mock.calls[1] as unknown[], '/api/auth/signin/nodemailer');
    expect(Object.fromEntries(form)).toMatchObject({
      csrfToken: 'csrf-magic',
      email: 'person@example.com',
      callbackUrl: CALLBACK_URL,
      json: 'true',
    });
  });

  it('starts Google through the provider POST and returns its validated external redirect', async () => {
    const googleUrl =
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=client&code_challenge=challenge';
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-google' }))
      .mockResolvedValueOnce(jsonResponse({ url: googleUrl }));
    const api = createAuthClient({
      baseUrl: 'https://api.intown.test/',
      callbackUrl: CALLBACK_URL,
      fetchImpl,
    });

    await expect(api.startGoogleOAuth()).resolves.toEqual({ redirectUrl: googleUrl });
    const form = expectAuthForm(fetchImpl.mock.calls[1] as unknown[], '/api/auth/signin/google');
    expect(form.get('csrfToken')).toBe('csrf-google');
    expect(form.get('callbackUrl')).toBe(CALLBACK_URL);
  });

  it('lets Auth.js handle provider callbacks and only probes the typed profile on landing', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(userResponse());
    const api = createAuthClient({ baseUrl: 'https://api.intown.test', fetchImpl });

    const session = await api.completeCallback({ code: 'already-consumed-by-authjs' });

    expect(session.status).toBe('authenticated');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.intown.test/api/profile');
    expect(String(fetchImpl.mock.calls[0]?.[0])).not.toContain('/api/auth/callback');
  });

  it('signs out with a fresh CSRF token so Auth.js revokes the DB session', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf-signout' }))
      .mockResolvedValueOnce(jsonResponse({ url: CALLBACK_URL }));
    const api = createAuthClient({
      baseUrl: 'https://api.intown.test',
      callbackUrl: CALLBACK_URL,
      fetchImpl,
    });

    await expect(api.signOut()).resolves.toBeUndefined();
    const form = expectAuthForm(fetchImpl.mock.calls[1] as unknown[], '/api/auth/signout');
    expect(form.get('csrfToken')).toBe('csrf-signout');
  });

  it('rejects malformed CSRF and unsafe/error redirects', async () => {
    const missingCsrf = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({}));
    await expect(createAuthClient({ fetchImpl: missingCsrf }).startGoogleOAuth()).rejects.toThrow(
      /missing csrfToken/i,
    );

    const unsafe = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'csrf' }))
      .mockResolvedValueOnce(jsonResponse({ url: 'javascript:alert(1)' }));
    await expect(createAuthClient({ fetchImpl: unsafe }).startGoogleOAuth()).rejects.toThrow(
      /unsafe redirect/i,
    );

    const callbackError = createAuthClient({ fetchImpl: vi.fn<typeof fetch>() });
    await expect(callbackError.completeCallback({ error: 'OAuthCallbackError' })).rejects.toThrow(
      /OAuthCallbackError/,
    );
  });
});

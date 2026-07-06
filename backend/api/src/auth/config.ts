import type { AuthConfig } from '@auth/core';
import type { Adapter } from '@auth/core/adapters';
import type { Provider } from '@auth/core/providers';
import type { LoadedEnv } from '../config/env.ts';

/** Auth.js base path — all provider/callback/session routes hang off here. */
export const AUTH_BASE_PATH = '/api/auth';

/**
 * The session cookie name Auth.js uses, which the request hook must read to
 * resolve the session. Mirrors Auth.js's own default naming: the `__Secure-`
 * prefix is added when secure cookies are on.
 */
export function sessionCookieName(env: Pick<LoadedEnv, 'COOKIE_SECURE'>): string {
  return `${env.COOKIE_SECURE ? '__Secure-' : ''}authjs.session-token`;
}

/**
 * Build the Auth.js config: database-backed (revocable) sessions, our pg
 * adapter, and httpOnly/lax cookies whose `secure` flag follows the env.
 */
export function buildAuthConfig(params: {
  env: LoadedEnv;
  adapter: Adapter;
  providers: Provider[];
}): AuthConfig {
  const { env, adapter, providers } = params;
  return {
    adapter,
    providers,
    secret: env.AUTH_SECRET,
    trustHost: true,
    basePath: AUTH_BASE_PATH,
    session: { strategy: 'database' },
    useSecureCookies: env.COOKIE_SECURE,
    cookies: {
      sessionToken: {
        name: sessionCookieName(env),
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: env.COOKIE_SECURE,
        },
      },
    },
  } satisfies AuthConfig;
}

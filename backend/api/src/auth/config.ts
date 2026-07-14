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
  const redirectOrigins = new Set([
    ...(env.AUTH_URL ? [new URL(env.AUTH_URL).origin] : []),
    ...env.CORS_ALLOWED_ORIGINS,
  ]);
  return {
    adapter,
    providers,
    secret: env.AUTH_SECRET,
    trustHost: true,
    basePath: AUTH_BASE_PATH,
    session: { strategy: 'database' },
    useSecureCookies: env.COOKIE_SECURE,
    callbacks: {
      /**
       * Auth.js accepts a caller-provided callbackUrl. Constrain it to the API
       * origin or an explicitly allowed browser origin so sign-in cannot become
       * an open redirect (and so a forged Host header is never trusted in prod).
       */
      redirect({ url, baseUrl }) {
        try {
          const target = new URL(url, baseUrl);
          if (
            (target.protocol === 'http:' || target.protocol === 'https:') &&
            redirectOrigins.has(target.origin)
          ) {
            return target.href;
          }
        } catch {
          // Fall through to the known Auth.js base origin.
        }
        return baseUrl;
      },
    },
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

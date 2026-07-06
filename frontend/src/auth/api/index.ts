import { createAuthClient, type AuthClientOptions } from './client.ts';
import { createMockAuthApi, type MockAuthOptions } from './mock.ts';
import type { AuthApi } from './types.ts';

export type { AuthApi, SessionInfo, StartResult, OAuthStart } from './types.ts';
export { SessionExpiredError } from './types.ts';
export { createAuthClient } from './client.ts';
export type { AuthClientOptions } from './client.ts';
export { createMockAuthApi } from './mock.ts';
export type { MockAuthOptions } from './mock.ts';

export interface CreateAuthApiOptions extends AuthClientOptions, MockAuthOptions {
  /** Use the in-memory mock instead of the live client. Flips to live at P02 merge. */
  mock?: boolean;
}

/**
 * Single switch the app/harness uses to obtain an {@link AuthApi}. Mock in
 * isolation (P03) → live client once P02 lands.
 */
export function createAuthApi(options: CreateAuthApiOptions = {}): AuthApi {
  if (options.mock) {
    return createMockAuthApi({
      initialUser: options.initialUser,
      initialConsents: options.initialConsents,
      expired: options.expired,
    });
  }
  return createAuthClient({ baseUrl: options.baseUrl, fetchImpl: options.fetchImpl });
}

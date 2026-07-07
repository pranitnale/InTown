import { createProfileClient, type ProfileClientOptions } from './client.ts';
import { createMockProfileApi, type MockProfileOptions } from './mock.ts';
import type { ProfileApi } from './types.ts';

export type { ProfileApi } from './types.ts';
export { ProfileSessionExpiredError, ProfileBadRequestError } from './types.ts';
export { createProfileClient } from './client.ts';
export type { ProfileClientOptions } from './client.ts';
export { createMockProfileApi } from './mock.ts';
export type { MockProfileOptions } from './mock.ts';

export interface CreateProfileApiOptions extends ProfileClientOptions, MockProfileOptions {
  /**
   * Use the in-memory mock instead of the live client. P04's live client is
   * already merged; the flip to it is deferred to the auth/session integration
   * (P03 SessionProvider), which supplies the session-bound credentials the
   * live client needs — it is not gated on P04.
   */
  mock?: boolean;
}

/**
 * Single switch the app/harness uses to obtain a {@link ProfileApi}. Mock in
 * isolation (P05); the flip to the live client (P04, already merged) is
 * deferred to the P03 auth/session integration.
 */
export function createProfileApi(options: CreateProfileApiOptions = {}): ProfileApi {
  if (options.mock) {
    return createMockProfileApi({
      seedUserIndex: options.seedUserIndex,
      emptyTraveler: options.emptyTraveler,
      emptyTaste: options.emptyTaste,
    });
  }
  return createProfileClient({ baseUrl: options.baseUrl, fetchImpl: options.fetchImpl });
}

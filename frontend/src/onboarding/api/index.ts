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
  /** Use the in-memory mock instead of the live client. Flips to live at P04 merge. */
  mock?: boolean;
}

/**
 * Single switch the app/harness uses to obtain a {@link ProfileApi}. Mock in
 * isolation (P05) → live client once P04 lands.
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

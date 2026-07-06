import { User, Consent, type ConsentType } from '@intown/contracts/types';
import { type SetConsentBody } from '@intown/contracts/api';
import type { AuthApi, OAuthStart, SessionInfo, StartResult } from './types.ts';

export interface MockAuthOptions {
  /** Session state the mock starts in. */
  initialUser?: User | null;
  /** Consents the mock starts with. */
  initialConsents?: Consent[];
  /** When true, `getSession` reports `expired` instead of `anonymous`. */
  expired?: boolean;
}

const NOW = '2026-07-06T12:00:00Z';

function mockUser(): User {
  // Parsed through the contract schema so the mock proves shape conformance.
  return User.parse({
    id: '00000000-0000-4000-8000-000000000001',
    email: 'traveler@example.com',
    display_name: 'Test Traveler',
    handle: 'traveler',
    locale: 'en',
    created_at: NOW,
    updated_at: NOW,
  });
}

function mockConsent(type: ConsentType, granted: boolean, policyVersion: string): Consent {
  return Consent.parse({
    id: '00000000-0000-4000-8000-0000000000c0',
    user_id: '00000000-0000-4000-8000-000000000001',
    consent_type: type,
    granted,
    policy_version: policyVersion,
    granted_at: NOW,
    revoked_at: granted ? null : NOW,
  });
}

/**
 * In-memory {@link AuthApi}. Every returned object is validated with the frozen
 * contract zod schemas (`User.parse` / `Consent.parse`), so tests exercising the
 * mock also prove the UI consumes contract-shaped data.
 */
export function createMockAuthApi(opts: MockAuthOptions = {}): AuthApi {
  let user: User | null = opts.initialUser ?? null;
  let expired = opts.expired ?? false;
  const consents = new Map<ConsentType, Consent>();
  for (const c of opts.initialConsents ?? []) consents.set(c.consent_type, c);

  return {
    async getSession(): Promise<SessionInfo> {
      if (user) return { status: 'authenticated', user };
      if (expired) return { status: 'expired', user: null };
      return { status: 'anonymous', user: null };
    },

    async startMagicLink(email: string): Promise<StartResult> {
      return { ok: email.includes('@') };
    },

    async startGoogleOAuth(): Promise<OAuthStart> {
      return { redirectUrl: '/api/auth/signin/google' };
    },

    async completeCallback(): Promise<SessionInfo> {
      user = mockUser();
      expired = false;
      return { status: 'authenticated', user };
    },

    async signOut(): Promise<void> {
      user = null;
      expired = false;
    },

    async getConsents(): Promise<Consent[]> {
      return [...consents.values()];
    },

    async setConsent(body: SetConsentBody): Promise<Consent> {
      const record = mockConsent(body.consent_type, body.granted, body.policy_version);
      consents.set(body.consent_type, record);
      return record;
    },
  };
}

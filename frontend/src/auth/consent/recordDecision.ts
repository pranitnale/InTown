import type { Consent } from '@intown/contracts/types';
import type { SetConsentBody } from '@intown/contracts/api';
import type { AuthApi } from '../api/index.ts';
import { CONSENT_POLICY_VERSION } from './copy.ts';
import { consentDecisionKey, type ConsentStorage } from './storage.ts';

export const PERSONALIZATION_CONSENT_TYPE = 'personalization_learning' as const;

export interface RecordDecisionDeps {
  api: Pick<AuthApi, 'setConsent'>;
  storage: ConsentStorage;
  granted: boolean;
  policyVersion?: string;
}

/**
 * Persist a personalization-consent decision: record it server-side (§16.1)
 * with the exact {@link SetConsentBody}, then cache it locally so the first-login
 * card never reappears. Shared by ConsentCard and unit tests.
 */
export async function recordConsentDecision({
  api,
  storage,
  granted,
  policyVersion,
}: RecordDecisionDeps): Promise<Consent> {
  const body: SetConsentBody = {
    consent_type: PERSONALIZATION_CONSENT_TYPE,
    granted,
    policy_version: policyVersion ?? CONSENT_POLICY_VERSION,
  };
  const result = await api.setConsent(body);
  storage.set(consentDecisionKey(PERSONALIZATION_CONSENT_TYPE), granted ? 'granted' : 'declined');
  return result;
}

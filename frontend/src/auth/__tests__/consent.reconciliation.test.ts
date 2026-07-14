import { Consent } from '@intown/contracts/types';
import { describe, expect, it, vi } from 'vitest';
import {
  latestPersonalizationDecision,
  reconcilePersonalizationConsent,
} from '../consent/ConsentProvider.tsx';
import {
  consentDecisionKey,
  createMemoryStorage,
  readConsentDecision,
} from '../consent/storage.ts';

function consent(granted: boolean, at: string) {
  return Consent.parse({
    id: granted
      ? '00000000-0000-4000-8000-000000000011'
      : '00000000-0000-4000-8000-000000000012',
    user_id: '00000000-0000-4000-8000-000000000001',
    consent_type: 'personalization_learning',
    granted,
    policy_version: '2026-07-01',
    granted_at: at,
    revoked_at: granted ? null : at,
  });
}

describe('server-authoritative consent reconciliation', () => {
  it('uses the newest append-only server record even when records are unsorted', () => {
    expect(
      latestPersonalizationDecision([
        consent(false, '2026-07-07T12:00:00Z'),
        consent(true, '2026-07-06T12:00:00Z'),
      ]),
    ).toBe(false);
  });

  it('overwrites a stale local decline with the server grant', async () => {
    const storage = createMemoryStorage({
      [consentDecisionKey('personalization_learning')]: 'declined',
    });
    const api = { getConsents: vi.fn(async () => [consent(true, '2026-07-07T12:00:00Z')]) };

    await expect(reconcilePersonalizationConsent(api, storage)).resolves.toBe(true);
    expect(readConsentDecision(storage, 'personalization_learning')).toBe('granted');
  });

  it('does not let a stale local grant suppress first-login UI when the server has no record', async () => {
    const storage = createMemoryStorage({
      [consentDecisionKey('personalization_learning')]: 'granted',
    });
    const api = { getConsents: vi.fn(async () => []) };

    await expect(reconcilePersonalizationConsent(api, storage)).resolves.toBeNull();
  });
});

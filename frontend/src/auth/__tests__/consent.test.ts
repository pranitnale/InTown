import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Consent } from '@intown/contracts/types';
import type { SetConsentBody } from '@intown/contracts/api';
import { recordConsentDecision } from '../consent/recordDecision.ts';
import {
  createMemoryStorage,
  readConsentDecision,
  consentDecisionKey,
} from '../consent/storage.ts';
import { CONSENT_POLICY_VERSION } from '../consent/copy.ts';
import { NonPersonalizedNote } from '../consent/NonPersonalizedNote.tsx';
import { createSessionStore } from '../session/store.ts';
import { createMemoryNavigator } from '../navigation.ts';
import { createMockAuthApi } from '../api/mock.ts';
import { SessionExpiredError } from '../api/index.ts';

const NOW = '2026-07-06T12:00:00Z';

function stubSetConsent() {
  return vi.fn(async (body: SetConsentBody) =>
    Consent.parse({
      id: '00000000-0000-4000-8000-0000000000c0',
      user_id: '00000000-0000-4000-8000-000000000001',
      consent_type: body.consent_type,
      granted: body.granted,
      policy_version: body.policy_version,
      granted_at: NOW,
      revoked_at: body.granted ? null : NOW,
    }),
  );
}

describe('consent decision', () => {
  it('Allow calls setConsent with the exact personalization body and caches it', async () => {
    const setConsent = stubSetConsent();
    const storage = createMemoryStorage();

    await recordConsentDecision({ api: { setConsent }, storage, granted: true });

    expect(setConsent).toHaveBeenCalledTimes(1);
    expect(setConsent).toHaveBeenCalledWith({
      consent_type: 'personalization_learning',
      granted: true,
      policy_version: CONSENT_POLICY_VERSION,
    });
    expect(readConsentDecision(storage, 'personalization_learning')).toBe('granted');
    expect(storage.get(consentDecisionKey('personalization_learning'))).toBe('granted');
  });

  it('Not now records granted=false and persists the declined decision', async () => {
    const setConsent = stubSetConsent();
    const storage = createMemoryStorage();

    const result = await recordConsentDecision({ api: { setConsent }, storage, granted: false });

    expect(setConsent).toHaveBeenCalledWith(
      expect.objectContaining({ consent_type: 'personalization_learning', granted: false }),
    );
    expect(result.granted).toBe(false);
    expect(readConsentDecision(storage, 'personalization_learning')).toBe('declined');
  });

  it('declining shows the honest non-personalized note (app stays functional)', () => {
    const html = renderToStaticMarkup(createElement(NonPersonalizedNote));
    expect(html).toContain('adapt to you');
    // No global kill-switch: declining only writes the decision, nothing disables the app.
  });

  it('a SessionExpiredError from setConsent routes through guard → expiry + sign-in', async () => {
    // Mirrors ConsentCard.choose: the consent write goes through store.guard,
    // so a mid-use 401 becomes an expiry transition + redirect, not an
    // unhandled rejection.
    const api = createMockAuthApi();
    vi.spyOn(api, 'setConsent').mockRejectedValue(new SessionExpiredError());
    const navigator = createMemoryNavigator('/somewhere');
    const store = createSessionStore({ api, navigator, redirectStorage: null });
    const storage = createMemoryStorage();

    await expect(
      store.getState().guard(() => recordConsentDecision({ api, storage, granted: true })),
    ).rejects.toBeInstanceOf(SessionExpiredError);

    expect(store.getState().status).toBe('expired');
    expect(navigator.currentPath).toBe('/auth/sign-in');
    // Nothing cached locally when the write failed → card can re-prompt/retry.
    expect(readConsentDecision(storage, 'personalization_learning')).toBeNull();
  });
});

import { useId, useState } from 'react';
import { Card } from '../ui/Card.tsx';
import { Button } from '../ui/Button.tsx';
import { useSession } from '../session/useSession.ts';
import { SessionExpiredError } from '../api/index.ts';
import { PERSONALIZATION_CONSENT_COPY } from './copy.ts';
import { consentDecisionKey, type ConsentStorage } from './storage.ts';
import { PERSONALIZATION_CONSENT_TYPE, recordConsentDecision } from './recordDecision.ts';

export interface ConsentCardProps {
  /** Where the one-time decision is cached (so the card only shows on first login). */
  storage: ConsentStorage;
  /** Policy/copy version recorded with the decision (§16.1). */
  policyVersion?: string;
  /** Called after the decision is recorded (true = granted). */
  onDecision?: (granted: boolean) => void;
}

/**
 * First-login consent card (§16.1). Shows the exact personalization copy and
 * Allow / Not now actions. On a choice it records the consent server-side and
 * caches the decision locally, so it never reappears. Declining is fully
 * supported — the app stays functional in non-personalized mode.
 */
export function ConsentCard({ storage, policyVersion, onDecision }: ConsentCardProps) {
  const { api, store } = useSession();
  const titleId = useId();
  const key = consentDecisionKey(PERSONALIZATION_CONSENT_TYPE);
  const [decided, setDecided] = useState<boolean>(() => storage.get(key) !== null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (decided) return null;

  async function choose(granted: boolean) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      // Route the consent write through the session guard so a mid-use 401
      // maps SessionExpiredError → reportExpired → navigate('/auth/sign-in')
      // instead of surfacing as an unhandled rejection.
      await store.getState().guard(() =>
        recordConsentDecision({ api, storage, granted, policyVersion }),
      );
      setDecided(true);
      onDecision?.(granted);
    } catch (err) {
      // guard already handled expiry (redirect performed); for any other,
      // non-fatal error keep the app usable and let the card retry.
      if (!(err instanceof SessionExpiredError)) setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card aria-labelledby={titleId}>
      <h2 id={titleId} className="mb-2 text-lg font-semibold text-text">
        Personalize your experience
      </h2>
      <p className="mb-5 text-sm text-text-secondary">{PERSONALIZATION_CONSENT_COPY}</p>
      {failed ? (
        <p className="mb-3 text-sm text-error" role="alert">
          Something went wrong saving your choice. Please try again.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" disabled={busy} onClick={() => void choose(true)}>
          Allow
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void choose(false)}>
          Not now
        </Button>
      </div>
    </Card>
  );
}

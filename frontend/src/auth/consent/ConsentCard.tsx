import { useId, useState } from 'react';
import { Card } from '../ui/Card.tsx';
import { Button } from '../ui/Button.tsx';
import { useSession } from '../session/useSession.ts';
import { SessionExpiredError } from '../api/index.ts';
import { PERSONALIZATION_CONSENT_COPY } from './copy.ts';
import { createLocalStorage, consentDecisionKey, type ConsentStorage } from './storage.ts';
import { PERSONALIZATION_CONSENT_TYPE, recordConsentDecision } from './recordDecision.ts';

export interface ConsentCardProps {
  /** Optional local cache used only by the isolated component/test harness. */
  storage?: ConsentStorage;
  /** Policy/copy version recorded with the decision. */
  policyVersion?: string;
  /**
   * Server-reconciled decision. Undefined selects standalone cache behavior;
   * null means the server has no decision and the card must be shown.
   */
  decision?: boolean | null;
  /** Controlled server write supplied by the global ConsentProvider. */
  onSaveDecision?: (granted: boolean) => Promise<void>;
  onDecision?: (granted: boolean) => void;
}

/** First-login personalization choice with a functional decline path. */
export function ConsentCard({
  storage: suppliedStorage,
  policyVersion,
  decision,
  onSaveDecision,
  onDecision,
}: ConsentCardProps) {
  const { api, store } = useSession();
  const titleId = useId();
  const [storage] = useState(() => suppliedStorage ?? createLocalStorage());
  const key = consentDecisionKey(PERSONALIZATION_CONSENT_TYPE);
  const [locallyDecided, setLocallyDecided] = useState<boolean>(() => storage.get(key) !== null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const controlled = decision !== undefined;

  if (controlled ? decision !== null : locallyDecided) return null;

  async function choose(granted: boolean) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      if (onSaveDecision) {
        await onSaveDecision(granted);
      } else {
        await store.getState().guard(() =>
          recordConsentDecision({ api, storage, granted, policyVersion }),
        );
      }
      setLocallyDecided(true);
      onDecision?.(granted);
    } catch (err) {
      if (!(err instanceof SessionExpiredError)) setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card aria-labelledby={titleId} className="mx-auto max-w-2xl">
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

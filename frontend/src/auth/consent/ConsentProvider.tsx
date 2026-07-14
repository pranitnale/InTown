/* eslint-disable react-refresh/only-export-components -- provider, hook, and reconciliation seam intentionally colocated */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Consent } from '@intown/contracts/types';
import { Button } from '../../design-system/index.ts';
import type { AuthApi } from '../api/index.ts';
import { useSession } from '../session/useSession.ts';
import { ConsentCard } from './ConsentCard.tsx';
import { PERSONALIZATION_CONSENT_TYPE, recordConsentDecision } from './recordDecision.ts';
import { createLocalStorage, consentDecisionKey, type ConsentStorage } from './storage.ts';

export type ConsentReconciliationStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ConsentContextValue {
  status: ConsentReconciliationStatus;
  /** null means the server has no first-login decision yet. */
  personalization: boolean | null;
  error: string | null;
  saving: boolean;
  refresh(): Promise<void>;
  setPersonalization(granted: boolean): Promise<void>;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

/** Return the newest append-only personalization decision from the server. */
export function latestPersonalizationDecision(consents: readonly Consent[]): boolean | null {
  let latest: Consent | null = null;
  for (const consent of consents) {
    if (consent.consent_type !== PERSONALIZATION_CONSENT_TYPE) continue;
    if (!latest || Date.parse(consent.granted_at) >= Date.parse(latest.granted_at)) latest = consent;
  }
  return latest?.granted ?? null;
}

/**
 * Fetch server state first, then update the local cache. A stale local value is
 * never treated as authority and cannot suppress the first-login prompt.
 */
export async function reconcilePersonalizationConsent(
  api: Pick<AuthApi, 'getConsents'>,
  storage: ConsentStorage,
): Promise<boolean | null> {
  const decision = latestPersonalizationDecision(await api.getConsents());
  if (decision !== null) {
    storage.set(
      consentDecisionKey(PERSONALIZATION_CONSENT_TYPE),
      decision ? 'granted' : 'declined',
    );
  }
  return decision;
}

export interface ConsentProviderProps {
  children: ReactNode;
  storage?: ConsentStorage;
}

export function ConsentProvider({ children, storage: suppliedStorage }: ConsentProviderProps) {
  const { status: sessionStatus, user, api, store } = useSession();
  const storage = useMemo(() => suppliedStorage ?? createLocalStorage(), [suppliedStorage]);
  const requestId = useRef(0);
  const [status, setStatus] = useState<ConsentReconciliationStatus>('idle');
  const [personalization, setPersonalizationState] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (store.getState().status !== 'authenticated') return;
    const id = ++requestId.current;
    setStatus('loading');
    setError(null);
    try {
      const decision = await store
        .getState()
        .guard(() => reconcilePersonalizationConsent(api, storage));
      if (id !== requestId.current) return;
      setPersonalizationState(decision);
      setStatus('ready');
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Could not load your consent choice');
      setStatus('error');
    }
  }, [api, storage, store]);

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      void refresh();
      return;
    }
    requestId.current += 1;
    setStatus('idle');
    setPersonalizationState(null);
    setError(null);
  }, [sessionStatus, user?.id, refresh]);

  const setPersonalization = useCallback(
    async (granted: boolean) => {
      setSaving(true);
      setError(null);
      try {
        await store
          .getState()
          .guard(() => recordConsentDecision({ api, storage, granted }));
        setPersonalizationState(granted);
        setStatus('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save your consent choice');
        setStatus('error');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [api, storage, store],
  );

  const value = useMemo<ConsentContextValue>(
    () => ({ status, personalization, error, saving, refresh, setPersonalization }),
    [status, personalization, error, saving, refresh, setPersonalization],
  );
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext);
  if (!value) throw new Error('useConsent must be used within a <ConsentProvider>');
  return value;
}

/** Global first-login prompt, rendered only after server reconciliation. */
export function FirstLoginConsentPrompt() {
  const { status, personalization, error, refresh, setPersonalization } = useConsent();

  if (status === 'ready' && personalization === null) {
    return (
      <section className="border-b border-border bg-bg px-4 py-4" aria-label="Personalization choice">
        <ConsentCard decision={null} onSaveDecision={setPersonalization} />
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="flex flex-wrap items-center justify-center gap-3 border-b border-border bg-bg px-4 py-3">
        <p className="text-sm text-text-secondary" role="status">
          {error ?? 'Could not load your personalization choice.'}
        </p>
        <Button variant="secondary" size="sm" onClick={() => void refresh()}>
          Try again
        </Button>
      </section>
    );
  }

  return null;
}

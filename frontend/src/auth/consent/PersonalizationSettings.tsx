import { useState } from 'react';
import { Button, Card, Toggle } from '../../design-system/index.ts';
import { useSession } from '../session/useSession.ts';
import { NonPersonalizedNote } from './NonPersonalizedNote.tsx';
import { PERSONALIZATION_CONSENT_COPY } from './copy.ts';
import { useConsent } from './ConsentProvider.tsx';

export function PersonalizationSettings() {
  const { status, personalization, error, saving, refresh, setPersonalization } = useConsent();
  const [actionError, setActionError] = useState<string | null>(null);

  async function change(next: boolean) {
    setActionError(null);
    try {
      await setPersonalization(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save your choice');
    }
  }

  return (
    <Card why="You can change this choice anytime." className="p-5">
      <h2 className="mb-1 text-lg font-semibold text-text">Personalization</h2>
      <p className="mb-4 text-sm text-text-secondary">{PERSONALIZATION_CONSENT_COPY}</p>
      {status === 'loading' || status === 'idle' ? (
        <p className="text-sm text-text-secondary" aria-busy="true">
          Loading your choice...
        </p>
      ) : null}
      {status === 'error' ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-error" role="alert">
            {actionError ?? error ?? 'Could not load your choice.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : null}
      {status === 'ready' ? (
        <div className="flex flex-col gap-3">
          <Toggle
            checked={personalization === true}
            disabled={saving}
            onCheckedChange={(next) => void change(next)}
            label="Allow cross-trip learning"
          />
          {personalization === false ? <NonPersonalizedNote /> : null}
          {personalization === null ? (
            <p className="text-sm text-text-secondary">
              Choose on or off. Either way, all core planning features remain available.
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function SignOutControl() {
  const { signOut, navigator } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signOut();
      navigator.navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out');
      setBusy(false);
    }
  }

  return (
    <Card why="This revokes your current server session." className="p-5">
      <h2 className="mb-1 text-lg font-semibold text-text">Session</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Sign out on this device. You can sign back in with email or Google.
      </p>
      {error ? (
        <p className="mb-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button variant="secondary" disabled={busy} onClick={() => void submit()}>
        {busy ? 'Signing out...' : 'Sign out'}
      </Button>
    </Card>
  );
}

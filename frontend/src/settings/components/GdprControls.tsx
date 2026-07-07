import { useState } from 'react';
import type { AccountExport } from '@intown/contracts/types';
import { Button, Card, cn, IconTrash } from '../../design-system/index.ts';
import { useProfile } from '../../onboarding/index.ts';

export interface GdprControlsProps {
  className?: string;
}

/**
 * GDPR export + erasure UI (AC #1, §16.1). Export downloads the full
 * subject-access record as JSON; erasure is guarded by an explicit confirm step
 * and uses the destructive button treatment. Both call P04 via the profile
 * store.
 */
export function GdprControls({ className }: GdprControlsProps) {
  const { store } = useProfile();
  const [busy, setBusy] = useState<'export' | 'erase' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [erased, setErased] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportedAt, setExportedAt] = useState<string | null>(null);

  async function doExport() {
    setBusy('export');
    setError(null);
    try {
      const data: AccountExport = await store.getState().exportAccount();
      const json = JSON.stringify(data, null, 2);
      if (typeof document !== 'undefined' && typeof URL?.createObjectURL === 'function') {
        const blob = new Blob([json], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = 'intown-account-export.json';
        a.click();
        URL.revokeObjectURL(href);
      }
      setExportedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  }

  async function doErase() {
    setBusy('erase');
    setError(null);
    try {
      const ok = await store.getState().eraseAccount();
      setErased(ok);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erasure failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card why="Your data, your control." className={cn('p-5', className)}>
      <h2 className="mb-1 text-lg font-semibold text-text">Your data</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Download everything we hold about you, or delete your account permanently.
      </p>

      {error ? (
        <p role="alert" className="mb-3 text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Button variant="secondary" disabled={busy !== null} onClick={() => void doExport()}>
            {busy === 'export' ? 'Preparing…' : 'Export my data'}
          </Button>
          {exportedAt ? (
            <p className="text-xs text-text-tertiary">Export downloaded.</p>
          ) : null}
        </div>

        <hr className="border-border" />

        {erased ? (
          <p className="text-sm text-text-secondary" role="status">
            Your account and personal data have been deleted.
          </p>
        ) : confirming ? (
          <div className="flex flex-col gap-2 rounded-lg border border-error bg-error/5 p-3">
            <p className="text-sm text-text">
              This permanently deletes your profile, taste history and consents. This cannot be
              undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                leftIcon={<IconTrash />}
                disabled={busy !== null}
                onClick={() => void doErase()}
              >
                {busy === 'erase' ? 'Deleting…' : 'Delete permanently'}
              </Button>
              <Button variant="ghost" disabled={busy !== null} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="destructive"
            leftIcon={<IconTrash />}
            onClick={() => setConfirming(true)}
          >
            Delete my account
          </Button>
        )}
      </div>
    </Card>
  );
}

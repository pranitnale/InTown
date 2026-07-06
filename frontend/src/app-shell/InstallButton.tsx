import { Button } from '../design-system/index.ts';
import { usePwaInstall } from './pwa-install.ts';

/**
 * Minimal install affordance for the shell chrome (AC #7). Renders the native
 * "Install app" CTA when a `beforeinstallprompt` was captured; on iOS Safari
 * (no such event) it renders the manual "Add to Home Screen" nudge instead.
 * Renders nothing when already installed or when no install path exists.
 */
export function InstallButton() {
  const { canInstall, promptInstall, showIosHint } = usePwaInstall();

  if (canInstall) {
    return (
      <Button size="sm" variant="secondary" onClick={() => void promptInstall()}>
        Install app
      </Button>
    );
  }

  if (showIosHint) {
    return (
      <span className="text-sm text-text-secondary">
        Install: tap Share, then &ldquo;Add to Home Screen&rdquo;.
      </span>
    );
  }

  return null;
}

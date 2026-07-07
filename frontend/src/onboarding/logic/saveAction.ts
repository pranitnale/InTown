/**
 * Shared save-orchestration for the profile editors (AC #1). Runs an async save,
 * toggling a busy flag and — crucially — CATCHING rejections so a failed save
 * (a 500, or a 401 `ProfileSessionExpiredError`) surfaces as an error message
 * instead of an unhandled fire-and-forget rejection that leaves the button
 * un-busied with no feedback. The editors render the returned message with
 * `role="alert"`, mirroring `GdprControls`' convention.
 *
 * Extracted as a pure function so the catch/finally contract is unit-testable in
 * the node/SSR test harness (which has no DOM to drive a click through).
 */
export interface SaveActionHandlers {
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Execute `action`, reporting progress through `handlers`. Returns `true` when
 * the save resolved, `false` when it rejected (the rejection is surfaced via
 * `setError`, never rethrown — the caller must not need a further `.catch`).
 */
export async function runSave(
  action: () => Promise<void> | void,
  handlers: SaveActionHandlers,
  fallbackMessage: string,
): Promise<boolean> {
  handlers.setBusy(true);
  handlers.setError(null);
  try {
    await action();
    return true;
  } catch (err) {
    handlers.setError(err instanceof Error ? err.message : fallbackMessage);
    return false;
  } finally {
    handlers.setBusy(false);
  }
}

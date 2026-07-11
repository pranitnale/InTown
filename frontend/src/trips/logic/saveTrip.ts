/**
 * Save-orchestration for the trip wizard and the join landing (AC #5). The
 * sign-in gate sits HERE — at save / join, the peak-motivation moment — never
 * before the quiz. `guardedAction` runs the write behind `requireAuth`: authed
 * callers run immediately, anonymous callers get routed through auth and the
 * write replays after a successful sign-in. `performSave` wraps the async write
 * with busy/error handling and CATCHES rejections (a failed create must surface
 * as a message, not an unhandled fire-and-forget). Both are pure functions so
 * the gate contract is unit-testable in the node/SSR harness (no DOM click).
 */
export interface SaveTripHandlers {
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Execute `write`, reporting progress through `handlers`. Returns `true` when
 * it resolved, `false` when it rejected (the rejection is surfaced via
 * `setError`, never rethrown).
 */
export async function performSave(
  write: () => Promise<void>,
  handlers: SaveTripHandlers,
  fallbackMessage: string,
): Promise<boolean> {
  handlers.setBusy(true);
  handlers.setError(null);
  try {
    await write();
    return true;
  } catch (err) {
    handlers.setError(err instanceof Error ? err.message : fallbackMessage);
    return false;
  } finally {
    handlers.setBusy(false);
  }
}

/**
 * Run a protected write behind the peak-motivation gate. `requireAuth` decides
 * whether `run` executes now (authed) or after sign-in (anonymous); `run` is the
 * busy/error-wrapped {@link performSave} call.
 */
export function guardedSave(
  requireAuth: (resume?: () => void) => void,
  run: () => void,
): void {
  requireAuth(run);
}

import { describe, it, expect, vi } from 'vitest';
import { guardedSave, performSave } from '../logic/saveTrip.ts';

/**
 * The sign-in gate sits at SAVE/JOIN (peak motivation), never before the quiz
 * (AC #5). `guardedSave` runs the write behind `requireAuth`; `performSave`
 * wraps the async write with busy/error handling. Both are the exact seams the
 * `TripNew` / `JoinLanding` screens plug the auth gate into.
 */
describe('save/join gate (AC #5)', () => {
  it('performSave toggles busy and returns true on success', async () => {
    const setBusy = vi.fn();
    const setError = vi.fn();
    const ok = await performSave(async () => {}, { setBusy, setError }, 'fallback');
    expect(ok).toBe(true);
    expect(setBusy.mock.calls).toEqual([[true], [false]]);
    expect(setError).toHaveBeenCalledWith(null);
  });

  it('performSave catches a rejection, surfaces the message, and un-busies', async () => {
    const setBusy = vi.fn();
    const setError = vi.fn();
    const ok = await performSave(
      async () => {
        throw new Error('boom');
      },
      { setBusy, setError },
      'fallback',
    );
    expect(ok).toBe(false);
    expect(setError).toHaveBeenLastCalledWith('boom');
    expect(setBusy).toHaveBeenLastCalledWith(false);
  });

  it('runs the write immediately when the user is already authenticated', () => {
    const write = vi.fn();
    // Authed requireAuth: invokes the resume action synchronously.
    const requireAuth = (resume?: () => void) => resume?.();
    guardedSave(requireAuth, write);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('defers the write until sign-in when anonymous, then replays it', () => {
    const write = vi.fn();
    let stashed: (() => void) | undefined;
    // Anonymous requireAuth: stashes the action instead of running it.
    const requireAuth = (resume?: () => void) => {
      stashed = resume;
    };
    guardedSave(requireAuth, write);
    expect(write).not.toHaveBeenCalled(); // gate is NOT before the quiz — nothing yet
    stashed?.(); // successful sign-in replays the stashed write
    expect(write).toHaveBeenCalledTimes(1);
  });
});

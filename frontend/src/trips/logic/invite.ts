import type { TripInvite } from '@intown/contracts/types';

/**
 * Invite usability (pure, DOM-free, unit-tested). An invite is redeemable only
 * when it is neither revoked nor past its expiry. Time is INJECTED (never
 * `Date.now()`), so the join flow and its tests are deterministic against the
 * fixed fixture clock ('2026-07-07T12:00:00Z').
 */
export function isInviteUsable(invite: Pick<TripInvite, 'revoked' | 'expires_at'>, now: string): boolean {
  if (invite.revoked) return false;
  return new Date(invite.expires_at).getTime() > new Date(now).getTime();
}

/** Why an invite is not usable — for the join landing's honest failure copy. */
export function inviteUnusableReason(
  invite: Pick<TripInvite, 'revoked' | 'expires_at'>,
  now: string,
): string | null {
  if (invite.revoked) return 'This invite has been revoked by the trip owner.';
  if (new Date(invite.expires_at).getTime() <= new Date(now).getTime()) {
    return 'This invite link has expired.';
  }
  return null;
}

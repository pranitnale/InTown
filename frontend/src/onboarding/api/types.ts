import type { User, TravelerProfile, TasteProfile, AccountExport } from '@intown/contracts/types';
import type {
  UpdateProfileBody,
  UpdateTravelerProfileBody,
  UpdateTasteProfileBody,
} from '@intown/contracts/api';

/**
 * Profile / taste / GDPR transport the onboarding + settings UI talks to. Typed
 * entirely against the frozen §11 contract schemas, mirroring `AuthApi`. The
 * live client (P04) and the in-memory mock both satisfy this shape, so the merge
 * flips one for the other with no UI change. Session (`getSession`, consent) is
 * NOT duplicated here — that stays in `src/auth`.
 */
export interface ProfileApi {
  /** Current user record (display_name / handle / locale live here). */
  getProfile(): Promise<User>;
  /** Update editable user fields. */
  updateProfile(body: UpdateProfileBody): Promise<User>;
  /** Current traveler profile, or null if none saved yet. */
  getTravelerProfile(): Promise<TravelerProfile | null>;
  /** Upsert the traveler profile (PUT, partial). */
  updateTravelerProfile(body: UpdateTravelerProfileBody): Promise<TravelerProfile>;
  /** Latest taste-profile version, or null if none saved yet. */
  getTasteProfile(): Promise<TasteProfile | null>;
  /** Append a NEW taste-profile version (history is never edited in place). */
  updateTasteProfile(body: UpdateTasteProfileBody): Promise<TasteProfile>;
  /** GDPR subject-access export. */
  exportAccount(): Promise<AccountExport>;
  /** GDPR erasure. */
  eraseAccount(): Promise<{ erased: boolean }>;
}

/** Thrown when a protected call reports the session is gone (401). */
export class ProfileSessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'ProfileSessionExpiredError';
  }
}

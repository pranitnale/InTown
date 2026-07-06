import type { User, Consent } from '@intown/contracts/types';
import type { SetConsentBody } from '@intown/contracts/api';

/** Result of a session probe. `expired` is distinct from `anonymous`: the caller
 *  previously had a session that the server has since revoked/timed out. */
export type SessionInfo =
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous'; user: null }
  | { status: 'expired'; user: null };

export interface StartResult {
  ok: boolean;
}

export interface OAuthStart {
  /** URL the browser should navigate to in order to begin the provider dance. */
  redirectUrl: string;
}

/**
 * The auth transport the UI talks to. Typed entirely against the frozen §11
 * contract schemas. The live client (P02) and the in-memory mock both satisfy
 * this shape, so the merge flips one for the other with no UI change.
 */
export interface AuthApi {
  /** Probe the current session (Auth.js session + typed profile). */
  getSession(): Promise<SessionInfo>;
  /** Begin passwordless magic-link sign-in for an email address. */
  startMagicLink(email: string): Promise<StartResult>;
  /** Begin Google OAuth; returns the URL to redirect the browser to. */
  startGoogleOAuth(): Promise<OAuthStart>;
  /** Finish an OAuth / magic-link return and establish the session. */
  completeCallback(params: Record<string, string>): Promise<SessionInfo>;
  /** Server-side session revoke (sign-out). */
  signOut(): Promise<void>;
  /** List the current user's consent records. */
  getConsents(): Promise<Consent[]>;
  /** Grant or revoke a single consent (§16.1). */
  setConsent(body: SetConsentBody): Promise<Consent>;
}

/** Thrown by protected calls when the server reports the session is gone (401). */
export class SessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

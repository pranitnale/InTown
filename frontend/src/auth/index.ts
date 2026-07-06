/**
 * Public surface of the P03 auth & consent module. Everything the rest of the
 * app (and the P01 router) needs to mount auth, guard actions, and show consent.
 */

// Routing / flow
export { authRouteTable, AuthFlow } from './routes.tsx';
export type { AuthRoute } from './routes.tsx';

// Navigation seam
export type { AuthNavigator } from './navigation.ts';
export { createMemoryNavigator } from './navigation.ts';

// Session
export { SessionProvider } from './session/SessionProvider.tsx';
export type { SessionProviderProps } from './session/SessionProvider.tsx';
export { useSession } from './session/useSession.ts';
export type { UseSessionResult } from './session/useSession.ts';
export type { SessionState, SessionStatus, SessionStore } from './session/store.ts';
export { createSessionStore } from './session/store.ts';

// Gate
export { AuthGate } from './gate/AuthGate.tsx';
export type { AuthGateProps, AuthGateRenderProps } from './gate/AuthGate.tsx';
export { useAuthGate } from './gate/useAuthGate.ts';
export type { UseAuthGateResult } from './gate/useAuthGate.ts';

// Consent
export { ConsentCard } from './consent/ConsentCard.tsx';
export type { ConsentCardProps } from './consent/ConsentCard.tsx';
export { NonPersonalizedNote } from './consent/NonPersonalizedNote.tsx';
export { PERSONALIZATION_CONSENT_COPY, CONSENT_POLICY_VERSION } from './consent/copy.ts';
export {
  createMemoryStorage,
  createLocalStorage,
  consentDecisionKey,
  readConsentDecision,
} from './consent/storage.ts';
export type { ConsentStorage, ConsentDecision } from './consent/storage.ts';
export {
  recordConsentDecision,
  PERSONALIZATION_CONSENT_TYPE,
} from './consent/recordDecision.ts';

// API
export { createAuthApi, createAuthClient, createMockAuthApi, SessionExpiredError } from './api/index.ts';
export type {
  AuthApi,
  SessionInfo,
  StartResult,
  OAuthStart,
  CreateAuthApiOptions,
} from './api/index.ts';

// UI shims (exported so P01 can find/replace them at merge)
export * as authUi from './ui/index.ts';

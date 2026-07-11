/**
 * Public surface of the P07 trips module: the three mountable routes P01's
 * router wires, plus the api/store/logic seams reused at the P06+P07 merge and
 * by tests. The module writes only under `src/trips`; it imports auth and
 * onboarding ONLY through their barrels.
 */

// Routes
export { TripsList, TripsListView, TripsRoute } from './screens/TripsList.tsx';
export { TripNewRoute } from './screens/TripNew.tsx';
export { JoinRoute } from './screens/JoinLanding.tsx';

// API
export {
  createTripsApi,
  createMockTripsApi,
  TripsSessionExpiredError,
  InviteUnusableError,
} from './api/index.ts';
export type {
  TripsApi,
  TripSummary,
  TasteSummary,
  InvitePreview,
  CreateTripsApiOptions,
} from './api/index.ts';
export type { MockTripsOptions } from './api/mock.ts';

// Store
export { createTripsStore } from './store/tripsStore.ts';
export type { TripsState, TripsStore, TripsStatus } from './store/tripsStore.ts';
export { TripsProvider } from './store/TripsProvider.tsx';
export type { TripsProviderProps } from './store/TripsProvider.tsx';
export { useTrips } from './store/useTrips.ts';
export type { UseTripsResult } from './store/useTrips.ts';
export { createTripWizardStore } from './store/tripWizardStore.ts';
export type { TripWizardState, TripWizardStore } from './store/tripWizardStore.ts';

// Pure logic (reusable + unit-tested)
export * from './logic/wizard.ts';
export * from './logic/companions.ts';
export * from './logic/feedback.ts';
export * from './logic/invite.ts';
export * from './logic/roles.ts';
export * from './logic/saveTrip.ts';

// Components
export { WizardShell } from './components/WizardShell.tsx';
export { RoleBadge } from './components/RoleBadge.tsx';
export { PlanShapingFeedback } from './components/PlanShapingFeedback.tsx';
export { StillYouCard } from './components/StillYouCard.tsx';

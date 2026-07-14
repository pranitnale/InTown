/* eslint-disable react-refresh/only-export-components -- static router module owns its provider boundary */
import { Navigate, Outlet, createBrowserRouter } from 'react-router';
import { AppLayout } from '../app-shell/AppLayout.tsx';
import {
  AuthCallback,
  AuthError,
  BrowserSessionProvider,
  CheckEmail,
  ConsentProvider,
  SignIn,
  SignUp,
} from '../auth/index.ts';
import { RequireAuth } from './RequireAuth.tsx';
import { OnboardingRoute } from '../onboarding/index.ts';
import { SettingsRoute } from '../settings/index.ts';
import { TripsRoute, TripNewRoute, JoinRoute } from '../trips/index.ts';
import {
  HomeScreen,
  ModerationScreen,
  OfflineScreen,
  ReviewsPolicyScreen,
  TripCityBriefScreen,
  TripCurateScreen,
  TripDetailScreen,
  TripGeneratingScreen,
} from './placeholders.tsx';

function AppProviders() {
  return (
    <BrowserSessionProvider>
      <ConsentProvider>
        <Outlet />
      </ConsentProvider>
    </BrowserSessionProvider>
  );
}

/**
 * Canonical route table. The landing page, auth, offline shell, new-trip quiz,
 * and invite preview are public; account-specific pages use the real session.
 */
export const router = createBrowserRouter([
  {
    element: <AppProviders />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // Public routes.
          { index: true, element: <HomeScreen /> },
          { path: 'auth', element: <Navigate to="/auth/sign-in" replace /> },
          { path: 'auth/sign-in', element: <SignIn /> },
          { path: 'auth/sign-up', element: <SignUp /> },
          { path: 'auth/check-email', element: <CheckEmail /> },
          { path: 'auth/callback', element: <AuthCallback /> },
          { path: 'auth/error', element: <AuthError /> },
          { path: 'offline', element: <OfflineScreen /> },
          { path: 'reviews-policy', element: <ReviewsPolicyScreen /> },
          { path: 'moderation', element: <ModerationScreen /> },
          { path: 'trips/new', element: <TripNewRoute /> },
          { path: 'join/:code', element: <JoinRoute /> },

          // Account-specific routes.
          {
            element: <RequireAuth />,
            children: [
              { path: 'onboarding', element: <OnboardingRoute /> },
              { path: 'trips', element: <TripsRoute /> },
              { path: 'trips/:id', element: <TripDetailScreen /> },
              { path: 'trips/:id/curate', element: <TripCurateScreen /> },
              { path: 'trips/:id/city-brief', element: <TripCityBriefScreen /> },
              { path: 'trips/:id/generating', element: <TripGeneratingScreen /> },
              { path: 'settings', element: <SettingsRoute /> },
            ],
          },
        ],
      },
    ],
  },
]);

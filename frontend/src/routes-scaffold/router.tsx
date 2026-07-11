import { createBrowserRouter } from 'react-router';
import { AppLayout } from '../app-shell/AppLayout.tsx';
import { RequireAuth } from './RequireAuth.tsx';
import { OnboardingRoute } from '../onboarding/index.ts';
import { SettingsRoute } from '../settings/index.ts';
import { TripsRoute, TripNewRoute, JoinRoute } from '../trips/index.ts';
import {
  AuthScreen,
  HomeScreen,
  ModerationScreen,
  OfflineScreen,
  ReviewsPolicyScreen,
  TripCityBriefScreen,
  TripCurateScreen,
  TripDetailScreen,
  TripGeneratingScreen,
} from './placeholders.tsx';

/**
 * P01 route skeleton (AC #5 / FINAL_PRD §4). All screens are placeholders; real
 * content lands in later phases. Mirrors the SPA rewrite in `vercel.json`
 * (all paths → index.html) so deep links resolve client-side.
 *
 * Gating: PUBLIC routes (`/auth/*`, `/offline`, `/reviews-policy`,
 * `/moderation`) sit directly under the layout; every other route is wrapped by
 * `<RequireAuth>`. P03 swaps the gate predicate — no route changes needed.
 *
 * P07 exception (§6.4/§6.3 gate placement): `/trips/new` (the setup wizard) and
 * `/join/:code` (the invite landing) are PUBLIC — the sign-in gate sits at
 * save/join (peak motivation), never before the quiz or the role preview. Those
 * screens gate their own protected actions internally. The `/trips` list stays
 * gated behind `<RequireAuth>`.
 */
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      // ---- PUBLIC (no auth gate) ----
      { path: 'auth/*', element: <AuthScreen /> },
      { path: 'offline', element: <OfflineScreen /> },
      { path: 'reviews-policy', element: <ReviewsPolicyScreen /> },
      { path: 'moderation', element: <ModerationScreen /> },
      { path: 'trips/new', element: <TripNewRoute /> },
      { path: 'join/:code', element: <JoinRoute /> },

      // ---- GATED (behind RequireAuth) ----
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomeScreen /> }, // '/'
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
]);

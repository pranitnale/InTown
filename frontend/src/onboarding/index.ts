/**
 * Public surface of the P05 onboarding & profiles module. Everything settings,
 * the router, dev harness, and P07's trip-scoped quiz reuse.
 */

// API
export {
  createProfileApi,
  createProfileClient,
  createMockProfileApi,
  ProfileSessionExpiredError,
} from './api/index.ts';
export type {
  ProfileApi,
  ProfileClientOptions,
  MockProfileOptions,
  CreateProfileApiOptions,
} from './api/index.ts';

// Store
export { createProfileStore } from './store/profileStore.ts';
export type { ProfileState, ProfileStore, ProfileStatus } from './store/profileStore.ts';
export { ProfileProvider } from './store/ProfileProvider.tsx';
export type { ProfileProviderProps } from './store/ProfileProvider.tsx';
export { useProfile } from './store/useProfile.ts';
export type { UseProfileResult } from './store/useProfile.ts';

// Pure logic (reusable + unit-tested)
export * from './logic/interests.ts';
export * from './logic/swipe.ts';
export * from './logic/dragRank.ts';
export * from './logic/quiz.ts';
export * from './logic/override.ts';
export * from './logic/pace.ts';

// Components
export { ProgressBar } from './components/ProgressBar.tsx';
export { QuizFramework } from './components/QuizFramework.tsx';
export type { QuizFrameworkProps, QuizChoiceQuestion, QuizChoice } from './components/QuizFramework.tsx';
export { DragRankList } from './components/DragRankList.tsx';
export { AntiPreferenceControl } from './components/AntiPreferenceControl.tsx';
export { HardExclusionControl } from './components/HardExclusionControl.tsx';
export { PhotoSwipeDeck } from './components/PhotoSwipeDeck.tsx';
export { BecauseYouSaidChips } from './components/BecauseYouSaidChips.tsx';
export { DefiningSightOverride } from './components/DefiningSightOverride.tsx';
export { TravelerProfileEditor } from './components/TravelerProfileEditor.tsx';
export { TasteProfileEditor } from './components/TasteProfileEditor.tsx';

// Screens
export { OnboardingFlow, OnboardingRoute } from './screens/OnboardingFlow.tsx';

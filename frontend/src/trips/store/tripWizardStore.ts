import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import {
  advance as advanceWizard,
  back as backWizard,
  initWizard,
  patchAnswers,
  type InitWizardOptions,
  type WizardAnswers,
  type WizardState,
} from '../logic/wizard.ts';

export interface TripWizardState {
  wizard: WizardState;
  /** Merge a partial set of answers into the wizard. */
  patch: (patch: Partial<WizardAnswers>) => void;
  /** Advance to the next step (no-op when the current step can't advance). */
  next: () => void;
  /** Step back one screen. */
  prev: () => void;
  /** Reset to a fresh wizard. */
  reset: () => void;
}

export type TripWizardStore = UseBoundStore<StoreApi<TripWizardState>>;

/**
 * P07-LOCAL trip-wizard store (own Zustand instance). One per `TripNew` mount —
 * a thin reactive shell over the pure `logic/wizard.ts` reducers, so all the
 * progression rules stay unit-tested and DOM-free.
 */
export function createTripWizardStore(opts: InitWizardOptions = {}): TripWizardStore {
  return create<TripWizardState>((set, get) => ({
    wizard: initWizard(opts),
    patch: (patch) => set({ wizard: patchAnswers(get().wizard, patch) }),
    next: () => set({ wizard: advanceWizard(get().wizard) }),
    prev: () => set({ wizard: backWizard(get().wizard) }),
    reset: () => set({ wizard: initWizard(opts) }),
  }));
}

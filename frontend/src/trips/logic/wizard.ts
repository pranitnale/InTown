import type { BudgetTier, Pace } from '@intown/contracts/types';
import type { CreateTripBody } from '@intown/contracts/api';
import { emptyCompanions, type CompanionsState } from './companions.ts';

/**
 * Trip-setup wizard state machine (§6.4). Pure, DOM-free, unit-tested — the
 * `TripNew` screen and its Zustand store are the presentation shell over this.
 *
 * Rules encoded here:
 *  - ONE question per screen (`cursor` indexes a single active step).
 *  - The steps run in the §6.4 order (city/dates/times → companions → pace →
 *    budget → taste → accommodation → transport → must-see/avoid).
 *  - Endowed progress: the first step (city) is genuinely EARNED, not a fake
 *    head-start — once a real city + dates are chosen the bar reads
 *    "City selected ✓ — 1 of N" with a stated reason.
 *  - Friction law: only the city step is required to advance; every later step
 *    is skippable, and each one that IS answered visibly shapes the plan
 *    (see `feedback.ts`).
 */

/** In-city transport preference (UI-local; not an inter-city contract enum). */
export const TRANSPORT_MODES = ['walk', 'transit', 'car', 'bike', 'mixed'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

/** Ordered wizard steps — one question per screen, §6.4 order. */
export const WIZARD_STEPS = [
  'city',
  'companions',
  'pace',
  'budget',
  'taste',
  'accommodation',
  'transport',
  'lists',
] as const;
export type WizardStepId = (typeof WIZARD_STEPS)[number];

export interface AccommodationAnchor {
  /** Free-text area/address the day plans anchor to. */
  label: string;
}

export interface WizardAnswers {
  city: string;
  /** ISO calendar dates ('' when unset). */
  arrive: string;
  depart: string;
  /** Local clock times ('' when unset) — arrival/departure day shaping. */
  arriveTime: string;
  departTime: string;
  companions: CompanionsState;
  pace?: Pace;
  budget?: BudgetTier;
  /** Interests picked in the first-trip swipe round (ranked, most-liked first). */
  tasteInterests: string[];
  /** True once the taste round is done (swiped) or the "still you?" is confirmed. */
  tasteConfirmed: boolean;
  accommodation: AccommodationAnchor | null;
  /** True when the user explicitly skipped the accommodation anchor. */
  accommodationSkipped: boolean;
  transport?: TransportMode;
  mustSee: string[];
  avoid: string[];
}

export interface WizardState {
  answers: WizardAnswers;
  /** 0-based index into {@link WIZARD_STEPS} of the on-screen step. */
  cursor: number;
}

/** Progress shape compatible with the onboarding `ProgressBar` (`QuizProgress`). */
export interface WizardProgress {
  completed: number;
  total: number;
  currentStep: number;
  label: string;
}

export interface InitWizardOptions {
  answers?: Partial<WizardAnswers>;
}

function freshAnswers(): WizardAnswers {
  return {
    city: '',
    arrive: '',
    depart: '',
    arriveTime: '',
    departTime: '',
    companions: emptyCompanions(),
    tasteInterests: [],
    tasteConfirmed: false,
    accommodation: null,
    accommodationSkipped: false,
    mustSee: [],
    avoid: [],
  };
}

export function initWizard(opts: InitWizardOptions = {}): WizardState {
  return { answers: { ...freshAnswers(), ...opts.answers }, cursor: 0 };
}

export function currentStepId(state: WizardState): WizardStepId {
  return WIZARD_STEPS[state.cursor] ?? WIZARD_STEPS[0];
}

export function patchAnswers(state: WizardState, patch: Partial<WizardAnswers>): WizardState {
  return { ...state, answers: { ...state.answers, ...patch } };
}

/** The city step needs a real destination + both dates before advancing. */
export function cityStepReady(answers: WizardAnswers): boolean {
  return answers.city.trim().length > 0 && answers.arrive !== '' && answers.depart !== '';
}

/**
 * Whether the on-screen step may advance. Only the city step gates progress
 * (friction law: everything after it is skippable).
 */
export function canAdvance(state: WizardState): boolean {
  if (currentStepId(state) === 'city') return cityStepReady(state.answers);
  return true;
}

export function isLastStep(state: WizardState): boolean {
  return state.cursor >= WIZARD_STEPS.length - 1;
}

/** Advance one step, clamped at the last (never past the end). */
export function advance(state: WizardState): WizardState {
  if (!canAdvance(state) || isLastStep(state)) return state;
  return { ...state, cursor: state.cursor + 1 };
}

/** Step back one step, clamped at the first. */
export function back(state: WizardState): WizardState {
  return { ...state, cursor: Math.max(0, state.cursor - 1) };
}

/** The trip can be saved once a city + dates exist (the only required data). */
export function isReadyToSave(state: WizardState): boolean {
  return cityStepReady(state.answers);
}

/**
 * Endowed progress including the genuinely-earned city step. `completed` counts
 * the steps left behind (== cursor), so once the user passes the city step the
 * bar starts at 1/total with a real reason and never shows a fabricated lead.
 */
export function wizardProgress(state: WizardState): WizardProgress {
  const total = WIZARD_STEPS.length;
  const completed = Math.min(total, state.cursor);
  const cityDone = state.answers.city.trim().length > 0;
  const prefix = cityDone ? 'City selected ✓' : 'Let’s plan your trip';
  return {
    completed,
    total,
    currentStep: Math.min(total, state.cursor + 1),
    label: `${prefix} — ${completed} of ${total}`,
  };
}

/** The genuinely-earned reason the first step is pre-completed (endowed). */
export function endowedReason(): string {
  return 'You picked your destination and dates — that’s a real first step, not a freebie.';
}

/** Derive the (contract-valid, non-empty) trip name from the answers. */
export function buildCreateTripName(answers: WizardAnswers): string {
  const city = answers.city.trim();
  return city.length > 0 ? city : 'New trip';
}

/** Build the §11 `CreateTripBody` the trips API expects. */
export function buildCreateTripBody(answers: WizardAnswers): CreateTripBody {
  return { name: buildCreateTripName(answers) };
}

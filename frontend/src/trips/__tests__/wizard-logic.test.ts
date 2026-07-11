import { describe, it, expect } from 'vitest';
import {
  WIZARD_STEPS,
  advance,
  back,
  buildCreateTripBody,
  buildCreateTripName,
  canAdvance,
  cityStepReady,
  currentStepId,
  endowedReason,
  initWizard,
  isLastStep,
  isReadyToSave,
  patchAnswers,
  wizardProgress,
} from '../logic/wizard.ts';

describe('trip wizard state machine (AC #2/#5)', () => {
  it('runs the §6.4 steps in order, one per screen', () => {
    expect(WIZARD_STEPS).toEqual([
      'city',
      'companions',
      'pace',
      'budget',
      'taste',
      'accommodation',
      'transport',
      'lists',
    ]);
    expect(currentStepId(initWizard())).toBe('city');
  });

  it('gates only the city step: needs a city + both dates to advance', () => {
    let s = initWizard();
    expect(canAdvance(s)).toBe(false);
    s = patchAnswers(s, { city: 'Porto' });
    expect(canAdvance(s)).toBe(false); // dates still missing
    s = patchAnswers(s, { arrive: '2026-08-01', depart: '2026-08-04' });
    expect(cityStepReady(s.answers)).toBe(true);
    expect(canAdvance(s)).toBe(true);
  });

  it('advance is a no-op on the city step until it is ready', () => {
    const s = initWizard();
    expect(advance(s).cursor).toBe(0);
    const ready = patchAnswers(s, { city: 'Porto', arrive: '2026-08-01', depart: '2026-08-04' });
    expect(advance(ready).cursor).toBe(1);
  });

  it('every step after the city step is skippable (advances freely)', () => {
    let s = patchAnswers(initWizard(), {
      city: 'Porto',
      arrive: '2026-08-01',
      depart: '2026-08-04',
    });
    for (let i = 1; i < WIZARD_STEPS.length; i++) {
      s = advance(s);
    }
    expect(isLastStep(s)).toBe(true);
    expect(currentStepId(s)).toBe('lists');
    // Clamped at the last step.
    expect(advance(s).cursor).toBe(WIZARD_STEPS.length - 1);
  });

  it('back is clamped at the first step', () => {
    const s = initWizard();
    expect(back(s).cursor).toBe(0);
  });

  it('endowed progress reads "City selected ✓ — 1 of 8" once past the city step', () => {
    let s = patchAnswers(initWizard(), {
      city: 'Porto',
      arrive: '2026-08-01',
      depart: '2026-08-04',
    });
    // On the city step (before a real city) it is not endowed.
    const start = wizardProgress(initWizard());
    expect(start.completed).toBe(0);
    expect(start.label).toContain('Let’s plan your trip');

    s = advance(s); // now on companions, city genuinely earned
    const p = wizardProgress(s);
    expect(p.total).toBe(8);
    expect(p.completed).toBe(1);
    expect(p.currentStep).toBe(2);
    expect(p.label).toBe('City selected ✓ — 1 of 8');
    expect(endowedReason()).toMatch(/real first step, not a freebie/);
  });

  it('isReadyToSave requires a city + dates; builds a non-empty contract name', () => {
    expect(isReadyToSave(initWizard())).toBe(false);
    const s = patchAnswers(initWizard(), {
      city: 'Porto',
      arrive: '2026-08-01',
      depart: '2026-08-04',
    });
    expect(isReadyToSave(s)).toBe(true);
    expect(buildCreateTripName(s.answers)).toBe('Porto');
    expect(buildCreateTripBody(s.answers)).toEqual({ name: 'Porto' });
    expect(buildCreateTripName(initWizard().answers)).toBe('New trip');
  });
});

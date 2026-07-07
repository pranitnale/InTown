import type { AgeBand, Pace } from '@intown/contracts/types';

/**
 * Age band → pace PRESET (AC #7). This is a suggested default the user SEES and
 * can freely override — never a cap (anti-ageism, §6.2 key constraint). The
 * mapping only pre-selects the pace control; it imposes no ceiling and the user
 * may pick any pace regardless of age band.
 */
const PACE_PRESET: Record<AgeBand, Pace> = {
  '<18': 'packed',
  '18-25': 'packed',
  '26-44': 'moderate',
  '45-64': 'moderate',
  '65+': 'relaxed',
};

/** The suggested (editable) pace preset for an age band. */
export function pacePresetFor(ageBand: AgeBand): Pace {
  return PACE_PRESET[ageBand];
}

/**
 * Human explanation surfaced next to the (editable) pace control. Deliberately
 * frames the value as a starting suggestion, not a limit.
 */
export function pacePresetReason(ageBand: AgeBand): string {
  const pace = pacePresetFor(ageBand);
  return `Suggested pace for ${ageBand}: ${pace} — a starting point, change it anytime.`;
}

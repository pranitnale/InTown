import { z } from 'zod';
import { Uuid, IsoDateTime, CurrencyCode } from './common.ts';

/**
 * Identity & preferences (§10). `users` carries the FK column used for
 * pseudonymized event capture and GDPR erasure (§9.1, §16.1).
 */
export const User = z.object({
  id: Uuid,
  email: z.email().nullable(),
  display_name: z.string().nullable(),
  handle: z.string().nullable(),
  /** UI/content language preference (BCP-47), independent of taste languages. */
  locale: z.string().nullable(),
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
});
export type User = z.infer<typeof User>;

/** Age band, not birthdate — data minimization (§16.1). */
export const AGE_BAND_VALUES = ['<18', '18-25', '26-44', '45-64', '65+'] as const;
export const AgeBand = z.enum(AGE_BAND_VALUES);
export type AgeBand = z.infer<typeof AgeBand>;

export const MOBILITY_VALUES = ['full', 'limited', 'wheelchair', 'stroller'] as const;
export const Mobility = z.enum(MOBILITY_VALUES);
export type Mobility = z.infer<typeof Mobility>;

export const TravelerProfile = z.object({
  id: Uuid,
  user_id: Uuid,
  age_band: AgeBand,
  mobility: Mobility,
  eu_residency: z.boolean(),
  student: z.boolean(),
  /** BCP-47 language tags the traveler reads/speaks (ordered by preference). */
  languages: z.array(z.string()),
  currency: CurrencyCode,
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
});
export type TravelerProfile = z.infer<typeof TravelerProfile>;

/**
 * Budget tier and pace. The PRD is terse on the exact scales — these are
 * sensible minimal ordinal shapes (noted in the WP-A capsule); extend via a
 * contract change if the product needs finer buckets.
 */
export const BUDGET_TIER_VALUES = ['budget', 'moderate', 'comfort', 'luxury'] as const;
export const BudgetTier = z.enum(BUDGET_TIER_VALUES);
export type BudgetTier = z.infer<typeof BudgetTier>;

export const PACE_VALUES = ['relaxed', 'moderate', 'packed'] as const;
export const Pace = z.enum(PACE_VALUES);
export type Pace = z.infer<typeof Pace>;

/**
 * Versioned taste profile (§10). `interests` is a RANKED list (array order is
 * the ranking, most-preferred first). A new version is a new row — profiles
 * are never edited in place, so learning can attribute signals to a version.
 */
export const TasteProfile = z.object({
  id: Uuid,
  user_id: Uuid,
  version: z.number().int().nonnegative(),
  /** Ranked interest tags, most-preferred first. */
  interests: z.array(z.string()),
  anti_preferences: z.array(z.string()),
  hard_exclusions: z.array(z.string()),
  /** Dietary rule tags (e.g. `vegetarian`, `halal`, `gluten_free`). */
  dietary: z.array(z.string()),
  budget_tier: BudgetTier,
  pace: Pace,
  created_at: IsoDateTime,
});
export type TasteProfile = z.infer<typeof TasteProfile>;

/**
 * Consent record (§16.1). Consent-or-pay: personalization learning is
 * consent-gated; explicitly-given preferences ride on contractual necessity.
 * Consent state changes are append-only-friendly (granted + revoked_at).
 */
export const CONSENT_TYPE_VALUES = [
  'personalization_learning',
  'location_derived_signals',
  'marketing',
] as const;
export const ConsentType = z.enum(CONSENT_TYPE_VALUES);
export type ConsentType = z.infer<typeof ConsentType>;

export const Consent = z.object({
  id: Uuid,
  user_id: Uuid,
  consent_type: ConsentType,
  granted: z.boolean(),
  /** Version of the consent copy/policy the user agreed to. */
  policy_version: z.string(),
  granted_at: IsoDateTime,
  revoked_at: IsoDateTime.nullable(),
});
export type Consent = z.infer<typeof Consent>;

/**
 * GDPR subject-access export (§16.1). The complete personal record the erasure
 * endpoint would remove: the user row, the (single) traveler profile, EVERY
 * taste-profile version (ordered by version), and every consent state row.
 * Anonymous aggregates (pseudonymous `events`, global `item_stats`) are
 * deliberately absent — they carry no personal data and survive erasure.
 */
export const AccountExport = z.object({
  user: User,
  traveler_profile: TravelerProfile.nullable(),
  taste_profiles: z.array(TasteProfile),
  consents: z.array(Consent),
});
export type AccountExport = z.infer<typeof AccountExport>;

import { z } from 'zod';

/**
 * The single unified place category enum (§5.4, 🧭 ET debt #3 — three
 * conflicting taxonomies collapsed to ONE). Defined exactly once, here.
 * Every consumer (TS and generated Python) imports this and only this.
 */
export const CATEGORY_VALUES = [
  'SIGHT',
  'MUSEUM',
  'VIEWPOINT',
  'PARK_NATURE',
  'ENTERTAINMENT',
  'NIGHTLIFE',
  'SHOPPING',
  'RESTAURANT',
  'CAFE',
  'OTHER',
] as const;

export const Category = z.enum(CATEGORY_VALUES);
export type Category = z.infer<typeof Category>;

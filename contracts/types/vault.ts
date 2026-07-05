import { z } from 'zod';
import { Uuid, IsoDateTime, Url } from './common.ts';

/**
 * Vault (§10) [P2]. `parent_kind` names which entity a document hangs off
 * (INTERCITY_LEG explicitly included). `member_ids` scopes visibility;
 * `storage_path` is unique. Parent-kind set is a sensible minimal enum (noted).
 */
export const DOCUMENT_PARENT_KIND_VALUES = [
  'TRIP',
  'TRIP_CITY',
  'INTERCITY_LEG',
  'STOP',
] as const;
export const DocumentParentKind = z.enum(DOCUMENT_PARENT_KIND_VALUES);
export type DocumentParentKind = z.infer<typeof DocumentParentKind>;

export const TripDocument = z.object({
  id: Uuid,
  trip_id: Uuid,
  parent_kind: DocumentParentKind,
  parent_id: Uuid,
  /** Members allowed to see this document. */
  member_ids: z.array(Uuid),
  /** Unique storage path (local disk / MinIO). */
  storage_path: z.string(),
  filename: z.string().nullable(),
  content_type: z.string().nullable(),
  uploaded_by: Uuid,
  created_at: IsoDateTime,
});
export type TripDocument = z.infer<typeof TripDocument>;

/**
 * A ticket link (§10) — stored as `ticket_links jsonb` on parent entities
 * (trips, trip_cities, intercity_legs, stops). Exported as a reusable shape.
 */
export const TicketLink = z.object({
  label: z.string().nullable(),
  url: Url,
  added_by: Uuid.nullable(),
  added_at: IsoDateTime.nullable(),
});
export type TicketLink = z.infer<typeof TicketLink>;

/** The `ticket_links` jsonb column shape: an array of ticket links. */
export const TicketLinks = z.array(TicketLink);
export type TicketLinks = z.infer<typeof TicketLinks>;

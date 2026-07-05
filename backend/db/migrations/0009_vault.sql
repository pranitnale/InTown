-- 0009_vault — trip_documents (§10 [P2]). Mirrors contracts/types/vault.ts.
--
-- ticket_links is NOT a table: it is the `TicketLinks` (TicketLink[]) jsonb
-- column shape, already carried on parent entities as `ticket_links jsonb`
-- (trips, trip_cities, intercity_legs, stops — created in 0004/0006). Documented
-- here for traceability; no DDL needed for it.

CREATE TABLE trip_documents (
  id           uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      uuid                 NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  parent_kind  document_parent_kind NOT NULL,          -- TRIP | TRIP_CITY | INTERCITY_LEG | STOP
  parent_id    uuid                 NOT NULL,           -- polymorphic; scoped by parent_kind
  member_ids   uuid[]               NOT NULL DEFAULT '{}',  -- visibility scope
  storage_path text                 NOT NULL UNIQUE,    -- local disk / MinIO path
  filename     text,
  content_type text,
  uploaded_by  uuid                 NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   timestamptz          NOT NULL DEFAULT now()
);

CREATE INDEX trip_documents_trip_idx   ON trip_documents (trip_id);
CREATE INDEX trip_documents_parent_idx ON trip_documents (parent_kind, parent_id);

# queue — Postgres-backed job queue (§12, decision #27)

Placeholder. The job queue is **owned by P11**. It will use the Postgres
`SELECT … FOR UPDATE SKIP LOCKED` pattern (no Redis initially) to dispatch work
to the `pipeline` and `solver` workers, with SSE progress surfaced through the
API.

P00 reserves this directory only; no code here yet.

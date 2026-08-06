# M3 Retention and Deletion Policy

## Raw runs

- **Storage:** Immutable KV records, one atomic write per run.
- **Retention:** Indefinite. Raw runs are the irreducible evidence base for
  reproducible summaries. The M1 pilot and future milestones depend on
  retained raw records for versioned reconciliation.
- **Deletion:** Owner-initiated only via `DELETE /v1/runs/:id` (authenticated).
  Deletion places a permanent tombstone keyed by `payloadSha256` to prevent
  non-resurrection (re-insertion of the same record).

## Public aggregate

- **Exposed:** Summary counts (total runs, benchmark counts, target counts)
  and paginated run metadata (runId, benchmark, variant, target, correctness
  status, capturedAt). No raw timing trajectories or environment details
  are exposed in the default public list response.
- **Run detail:** `GET /v1/runs/:id` returns the full record in public mode.
  This is acceptable because run records are closed-schema validated data
  (no executable code, no secrets, no PII by schema design).

## Tombstones

- **Retention:** Permanent. Tombstones prevent accidental or malicious
  re-insertion of deleted runs via the idempotent dedup path.
- **Key:** `["runs_tombstone", runId]` with `{ payloadSha256, deletedAt }`.
- **Check:** Every `put()` call checks tombstones before insertion.

## KV storage bounds

- **Per-run:** 256 KB max (enforced by streaming byte cap before JSON parse).
- **Rate:** 30 POST requests per minute per client IP (durable rate limit).
- **Headroom:** `GET /v1/headroom` reports live key count and byte estimate.

## Default decisions (CONFIRMED by Paul 2026-08-06 — "defaults look good, KV store already added")

1. Raw run retention period: **indefinite** (default; Paul may set a TTL).
2. Public run detail exposure: **full record** (default; Paul may restrict
   to metadata-only if PII concerns emerge).
3. Tombstone GC: **never** (tombstones are permanent by design).
4. KV namespace: **single production namespace** on Deno Deploy (Paul
   approved provisioning on 2026-08-05 by directing live M3 deployment).

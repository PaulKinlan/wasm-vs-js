# M3 Cost Model: Request, KV Read/Write/Storage, Egress, Backup

## Request cost

| Operation             | KV reads                                      | KV writes                                             | Atomic commits | Notes                           |
| --------------------- | --------------------------------------------- | ----------------------------------------------------- | -------------- | ------------------------------- |
| `POST /v1/runs`       | 2 (dedupe check + tombstone scan)             | 4 (run + dedupe + index + summary)                    | 1              | Streaming byte cap before parse |
| `GET /v1/runs` (list) | 1 (list scan)                                 | 0                                                     | 0              | Paginated, max 100              |
| `GET /v1/runs/:id`    | 1 (get)                                       | 0                                                     | 0              | Direct key lookup               |
| `GET /v1/summaries`   | 1 (get counter) + 1 (list scan for breakdown) | 0                                                     | 0              | Summary is cached in KV         |
| `GET /v1/health`      | 1 (get)                                       | 0                                                     | 0              | Latency probe                   |
| `DELETE /v1/runs/:id` | 2 (run + tombstone check)                     | 3 (delete run + dedupe + index) + 1 (tombstone write) | 1              | Atomic delete + tombstone       |

## KV storage estimate

- **Per run record:** ~2-3 KB (JSON, schema-validated)
- **Per index entry:** ~100 bytes (runId + capturedAt)
- **Per dedupe entry:** ~80 bytes (runId + storedAt)
- **Per tombstone:** ~120 bytes (runId + payloadSha256 + deletedAt)
- **Summary counter:** ~8 bytes
- **Total per run:** ~2.5 KB including overhead
- **1,000 runs:** ~2.5 MB
- **10,000 runs:** ~25 MB (well within Deno Deploy KV free tier)

## Egress estimate

- `GET /v1/runs?limit=50`: ~125 KB (50 runs × 2.5 KB)
- `GET /v1/runs/:id`: ~2.5 KB
- `GET /v1/summaries`: ~500 bytes
- `GET /v1/health`: ~100 bytes

## Rate limits

- **Write:** 30 POST /v1/runs per minute per client IP
- **Read:** No limit (GET routes are unauthenticated and cached)
- **Body:** 256 KB max per POST (enforced before JSON parse)

## Deno Deploy KV pricing context

- **Free tier:** 100K reads/day, 10K writes/day, 1 GB storage
- **Pro tier:** $0.25/100K reads, $1/100K writes, $0.25/GB-month storage
- **At 1,000 runs/day:** ~4K writes (run + dedupe + index + summary) = well within free tier
- **At 10,000 runs/day:** ~40K writes = exceeds free tier, ~$0.40/day on Pro

## Backup strategy

- **Logical export:** `exportLogical()` serializes all runs to a JSON dump
  with SHA-256 checksum. Can be stored in git or object storage.
- **Restore:** `importLogical()` re-inserts from a dump with schema validation.
  Idempotent via dedupe — safe to re-run.
- **Frequency:** Export after each collection campaign (M1 pilot, M2 variant runs).
- **Testing:** Export/import roundtrip tested with corrupt/partial/stale inputs.

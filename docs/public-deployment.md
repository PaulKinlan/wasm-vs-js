# Public read-only evidence deployment

The current deployable surface publishes the UI, benchmark definition, build manifest, 96-byte Wasm artifact, versioned M1 implementation acceptance package, and a non-persistent hosted `/run` journey. The hosted journey executes the fixed pair in a dedicated same-origin module worker, verifies the exact fetched JavaScript and Wasm bytes before execution, keeps heavy scored work off the UI thread, and terminates the worker after completion or error. It retains privacy-limited page provenance only in the displayed in-memory result: typed UA-exposed processor and approximate-memory hints, UA-CH availability, legacy Chromium heap scope, optional UA-specific memory status, Wasm buffer length, raw same-origin Resource Timing, an animation-frame refresh estimate, and long-animation-frame responsiveness. Exact host CPU/RAM and heavy Chrome/CDP/process diagnostics remain unavailable here and belong to separate controlled diagnostic launches. It does **not** publish raw runs, enable the writable local collector, accept writes, provision Deno KV, or make a performance claim.

## Candidate identity

- Deno organization: `paulkinlan-ea`
- Application candidate: `wasm-vs-js`
- Stable domain candidate: `wasm-vs-js.aifoc.us`
- Entrypoint: `deploy.ts` (sets public mode before dynamically importing the shared server)

The application, domain, DNS, and any Deno resource are not provisioned by this commit.

## Evidence identity and deployment provenance

The published evidence describes the accepted implementation commit `9c309c4941d1b8550c15f8549f95a5636a634ef6`. That identity is a reviewed source constant and is returned as `acceptedImplementationCommit` by `/healthz`; public mode does not trust or echo an operator-supplied Git label.

Deno's deployment identifier is not a Git object ID. Record the platform revision/deployment identifier alongside the exact source commit used to deploy, then verify the live acceptance JSON, build manifest, and Wasm hashes against that checkout. Do not claim that a custom environment variable cryptographically binds deployed bytes to Git.

## Local public-mode proof

From the exact reviewed checkout:

```sh
PORT=8788 HOST=127.0.0.1 deno task public
```

Expected surface:

- `GET /`, `/evidence`, `/evidence/v1/acceptance.json`, `/benchmarks/sum-u32/benchmark.json`, the build manifest, and Wasm artifact: `200`;
- `GET /healthz`: `200`, `mode=public-read-only`, and exact `acceptedImplementationCommit`;
- `GET /api/summary`: `200` with zero published runs and `claimStatus=no-runs`;
- `GET /run`, `/run/`, the dedicated hosted runner and worker modules, copied exact workload module, build manifest, and Wasm artifact: `200`;
- `GET /run.html`, `/runner.js`, and any `/raw/...` path: `404`;
- every non-GET/HEAD request: `403` before route handling;
- every `/api/runs` read: `403`.

The public task has no filesystem write permission.

## Reviewed deployment procedure

This procedure intentionally stops before credentials or production mutation:

1. Independently review the exact commit and record its full object ID.
2. Run `deno task check` and the public-mode loopback smoke from that exact clean checkout.
3. Obtain explicit approval for Deno application creation/deployment and DNS mutation.
4. Do not configure a mode override: the reviewed `deploy.ts` entrypoint fixes the service to public mode before importing the shared server.
5. Deploy non-interactively to the approved `paulkinlan-ea/wasm-vs-js` application using the credential intake path; never print or persist the token in this repository.
6. Record the platform deployment identifier and source commit, then verify the revision URL, `/healthz`, acceptance JSON, build manifest, and Wasm hash before assigning the stable domain.
7. Bind `wasm-vs-js.aifoc.us` only after the hostname is confirmed, then verify TLS, routes, response headers, mutation denial, and live content hashes.
8. Use an explicitly authorized browser run to validate desktop/mobile visible evidence and exact owned-process/profile cleanup.

No database is required or permitted for this read-only slice.

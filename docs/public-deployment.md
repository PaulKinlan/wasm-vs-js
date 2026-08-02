# Public read-only evidence deployment

The current deployable surface publishes the UI, benchmark definition, build manifest, 96-byte Wasm artifact, and the versioned M1 implementation acceptance package. It does **not** publish raw runs, enable the local runner, accept writes, provision Deno KV, or make a performance claim.

## Candidate identity

- Deno organization: `paulkinlan-ea`
- Application candidate: `wasm-vs-js`
- Stable domain candidate: `wasm-vs-js.aifoc.us`
- Entrypoint: `server.ts`
- Mode: `SERVER_MODE=public`

The application, domain, DNS, and any Deno resource are not provisioned by this commit.

## Fail-closed commit binding

Deno Deploy does not include a Git checkout at runtime. The authority that deploys an independently reviewed source commit must set `WASM_VS_JS_COMMIT` to that exact 40- or 64-character lowercase Git object ID. Startup fails if it is absent or malformed. `/healthz` exposes the configured reviewed commit so deployment verification can compare the live revision with the approved source.

Do not replace this value with `latest`, a branch name, a shortened object ID, or the earlier evidence-source commit. The environment value binds the deployed application commit. The acceptance package separately records the exact `9c309c4…` implementation commit it describes.

## Local public-mode proof

From the exact reviewed checkout:

```sh
WASM_VS_JS_COMMIT="$(git rev-parse HEAD)" PORT=8788 HOST=127.0.0.1 deno task public
```

Expected surface:

- `GET /`, `/evidence`, `/evidence/v1/acceptance.json`, `/benchmarks/sum-u32/benchmark.json`, the build manifest, and Wasm artifact: `200`;
- `GET /healthz`: `200`, `mode=public-read-only`, and the exact reviewed commit;
- `GET /api/summary`: `200` with zero published runs and `claimStatus=no-runs`;
- `GET /run`, `/runner.js`, and any `/raw/...` path: `404`;
- every non-GET/HEAD request: `403` before route handling;
- every `/api/runs` read: `403`.

The public task has no filesystem write permission.

## Reviewed deployment procedure

This procedure intentionally stops before credentials or production mutation:

1. Independently review the exact commit and record its full object ID.
2. Run `deno task check` and the public-mode loopback smoke from that exact clean checkout.
3. Obtain explicit approval for Deno application creation/deployment and DNS mutation.
4. Configure production environment names only: `SERVER_MODE=public`, `HOST=0.0.0.0`, and `WASM_VS_JS_COMMIT=<exact-reviewed-commit>`.
5. Deploy non-interactively to the approved `paulkinlan-ea/wasm-vs-js` application using the credential intake path; never print or persist the token in this repository.
6. Verify the revision URL and `/healthz` before assigning the stable domain.
7. Bind `wasm-vs-js.aifoc.us` only after the hostname is confirmed, then verify TLS, routes, response headers, mutation denial, and the live commit.
8. Use an explicitly authorized browser run to validate desktop/mobile visible evidence and exact owned-process/profile cleanup.

No database is required or permitted for this read-only slice.

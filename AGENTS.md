# Repository rules

Read `PLAN.md` before planning or changing the project. It is canonical. Every change must advance one active milestone and preserve published workload IDs, variant IDs, schema versions, routes, and result URLs.

## Benchmark integrity

- Never report one context-free JavaScript-versus-Wasm winner.
- Keep controlled Track A and independently optimized Track B separate.
- Do not time a pair until equivalent outputs and fixed work pass.
- Preserve cold and warm runs separately. Retain first iterations and complete trajectories.
- Record exact browser, OS, device, source, build, compiler, flags, cache, network, and collector provenance.
- Unsupported, blocked, redacted, dropped, or uncollected evidence is never numeric zero.
- Browser-specific memory, GC, tracing, throttling, and process metrics remain explicitly browser-specific diagnostics.
- Raw runs are immutable. Summary algorithms are versioned and reproducible from retained runs.
- No exclusion is silent. Keep the sample and a machine-readable reason unless integrity failed before a valid sample existed.

## Public writing

Load and apply the `anti-slop-writing` skill before creating or revising any public page, README, evidence explanation, benchmark description, result summary, or launch copy. Prefer concrete counts, routes, hashes, mechanisms, limits, and observed results. Cut repeated warnings, generic importance claims, formulaic contrasts, marketing language, and prose that implies evidence the project has not collected.

## Working rules

Use one writer per worktree. Workers do not self-review or push. Run `deno task check` before committing. Independently review milestone commits before claiming acceptance.

Publish testable work early. Pause only for secrets, production-resource creation or mutation, private evidence, destructive actions, or material cost. Deno app/KV provisioning requires explicit approval.

Browser validation must exercise visible controls and retain browser version, launch arguments, routes, console/network evidence, assertions, screenshots, and exact owned-process/profile cleanup. Never globally kill Chrome.

Never accept submitted executable benchmark code. Ingestion accepts only closed, versioned result records. Bound request bodies before parsing, authenticate writes, apply durable abuse controls, and never trust CORS as authorization.

## Deployment protocol

Production deploys happen ONLY via the GitHub integration on pushes to
`main`. Never run `deno deploy` CLI against the production project: CLI
deploys shadow the integration deploy and (2026-08-05 incident) the CLI
fails on files >~5MB, so a CLI deploy with `--ignore` silently drops large
artifacts from production (gltf-viewer reference-output.bin, ml-gemm
reference.f64 404'd until a main push restored them).

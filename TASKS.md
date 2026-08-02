# Task graph

Tasks are ordered by dependency. A checked box means the exact acceptance criteria passed and the work is committed. Research prose or a green unit test alone does not complete a user journey.

## M0 — public plan and contracts

- [x] Publish direct README and repository rules.
- [x] Publish canonical methodology/product plan.
- [x] Publish milestone and implementation task graph.
- [x] Define benchmark and immutable run schemas plus positive/negative contract fixtures.
- [x] Independently review the exact M0 commit and correct blockers.
- [x] Record M0 acceptance with exact commit and review verdict.

## M1 — first complete vertical slice

### Runner and evidence

- [ ] Implement schema validation and canonical hashing.
- [ ] Implement capability probes and typed metric availability.
- [ ] Implement portable phase marks and raw-sample collection.
- [ ] Calibrate clock quantum, harness overhead, and fixed batch size.
- [ ] Preserve first iteration, warm-up trajectory, steady samples, validation, and failure reasons.

### First workload

- [ ] Select one deterministic compute/data kernel suitable for JS and linear Wasm.
- [ ] Freeze input corpus, oracle, FP/integer policy, operation count, and output digest.
- [ ] Implement literal Track A JavaScript.
- [ ] Implement equivalent Track A Wasm source and reproducible build.
- [ ] Record source/artifact/compiler/flags and raw/gzip/Brotli footprint.
- [ ] Reject timing when output or work equivalence fails.

### Orchestration

- [ ] Launch exact owned Chrome process/profile for cold runs.
- [ ] Implement warm-cache protocol and verify resource/cache state.
- [ ] Randomize paired order with retained seed.
- [ ] Run a separately labelled pilot, freeze the launch floor/precision target/cap, then collect at least 20 paired fresh launches and continue to target or cap; label inconclusive only at the cap.
- [ ] Retain browser version, flags, console/network, assertions, screenshots, and exact cleanup.

### Results

- [ ] Store immutable local raw runs.
- [ ] Generate versioned summaries with paired effects and bootstrap CI.
- [ ] Build an inspectable static page with lifecycle, samples, sizes, provenance, correctness, and unavailable states.
- [ ] Validate keyboard, mobile/desktop layout, dark/reduced-motion/forced-colour states.
- [ ] Independently review and accept the exact M1 commit.

## M2 — families, optimized tracks, and boundaries

- [ ] Add T1 primitive family without presenting tiny intervals before calibration.
- [ ] Add representative T2 numeric, parsing, compression, image, and graph kernels.
- [ ] Add T4 JS→Wasm, Wasm→JS, round-trip, copy, string, refs, callbacks, and batching tests.
- [ ] Add Track B optimization logs and independent JS/Wasm improvements.
- [ ] Add reviewed WasmGC and hybrid implementations where the workload has a meaningful equivalent; otherwise publish the missing-cell reason.
- [ ] Add `-O3`/`-Oz`, scalar/SIMD, and other named build variants where supported.
- [ ] Add worker creation, clone/transfer/shared-memory, and 1/2/4/N scaling workloads.
- [ ] Review workload balance so microbenchmarks do not dominate.

## M3 — Deno reporting service

### API and storage

- [ ] Implement closed-schema `POST /v1/runs` with streaming byte cap before JSON parsing.
- [ ] Implement reporter authorization, idempotency, durable rate limits, and timestamp bounds.
- [ ] Implement immutable KV run/part/dedupe/index/summary records in one bounded atomic commit.
- [ ] Measure key/value/check/mutation/serialized-byte headroom.
- [ ] Implement bounded run list/detail, summaries, and health APIs.
- [ ] Implement versioned reconciliation from raw runs.

### Operations

- [ ] Decide raw/public/aggregate retention and deletion policy.
- [ ] Implement owner deletion and non-resurrection tombstones.
- [ ] Implement checksummed logical export and isolated restore.
- [ ] Test corrupt, partial, stale, foreign, and wrong-schema restores.
- [ ] Model request, KV read/write/storage, egress, and backup cost.
- [ ] Obtain explicit approval before Deno app/KV provisioning.
- [ ] Prove production/branch/preview database isolation; never use shared preview KV for destructive tests.
- [ ] Independently review security, privacy, recovery, and exact production source.

## M4 — public results explorer

- [ ] Implement AI Focus token layer and editorial/dashboard widths.
- [ ] Add URL-backed filters and stable result/run routes.
- [ ] Add workload × environment matrix and chart/table pairs.
- [ ] Add raw-run, build, environment, correctness, capability, exclusion, and artifact inspectors.
- [ ] Avoid winner copy and colour-only status.
- [ ] Deploy exact reviewed source.
- [ ] Validate live routes, headers, ingestion denial, desktop/mobile controls, console/network, and cleanup.

## M5 — browsers and devices

- [ ] Add WebDriver BiDi Chrome/Firefox orchestration around the same in-page collector.
- [ ] Add Safari WebDriver Classic orchestration and separately labelled Web Inspector artifacts.
- [ ] Add ARM64 desktop host.
- [ ] Add real high/mid/low Android and real iOS Safari evidence as available.
- [ ] Publish capability coverage and unsupported cells without substituting zero.
- [ ] Prevent proprietary diagnostic fields entering cross-browser summaries.

## M6 — components and complete applications

- [ ] Add T3 production-plausible codec/database/parser/compiler/ML/rendering components.
- [ ] Add T6 load→useful, edit, filter, sort, chart/render, and sustained interaction journeys.
- [ ] Count script, DOM, style, layout, paint, async, boundary, and complete-task outcomes.
- [ ] Add independent holdout applications before broad claims.

## M7 — scale and article evidence

- [ ] Establish workload proposal/review template and JS/Wasm expert review.
- [ ] Grow the versioned inventory toward hundreds of balanced workloads.
- [ ] Freeze a preregistered release matrix and exclusion policy.
- [ ] Run and publish all valid, failed, blocked, unavailable, and inconclusive cells.
- [ ] Freeze multiplicity handling, family-level aggregation, and headline claim-selection policy.
- [ ] Generate an immutable claim ledger from accepted runs.
- [ ] Draft the AI Focus article from the ledger, including counterexamples and uncertainty.
- [ ] Independently review statistical claims, editorial framing, and reproducibility.

## Standing gates

- [ ] Preserve published IDs, routes, schema versions, and inbound links.
- [ ] Keep raw runs immutable and summaries reproducible.
- [ ] Keep Track A/Track B and cold/warm results separate.
- [ ] Never encode unsupported evidence as zero.
- [ ] Never silently exclude a run.
- [ ] Never provision, deploy, spend, use credentials, or mutate production resources without the required approval.

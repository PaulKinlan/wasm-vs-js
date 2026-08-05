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

- [x] Implement schema validation and RFC 8785 canonical hashing.
- [x] Implement capability probes and typed metric availability.
- [x] Implement portable phase marks and raw-sample collection.
- [x] Calibrate clock quantum, harness overhead, and one shared fixed batch size.
- [x] Preserve first-use lifecycle metrics, the first scored post-calibration iteration, the full scored trajectory, validation, and failure reasons. (Phase list and cold/warm protocol states: `docs/cold-start-definition.md`.)

### First workload

- [x] Select one deterministic compute/data kernel suitable for JS and linear Wasm.
- [x] Freeze input corpus, oracle, integer policy, operation count, and output digest.
- [x] Implement literal Track A JavaScript.
- [x] Implement equivalent Track A Wasm source and reproducible pinned build.
- [x] Record source/artifact/compiler/flags and raw/gzip/Brotli footprint.
- [x] Reject timing when output or work equivalence fails.

### Orchestration

- [x] Freeze the exact M1 Chrome source/build/input/browser/cache/statistics/stopping contract and single-use bounded permit envelope; this does not instantiate browser authorization.
- [x] Implement reviewed-source foundations for atomic single-use permits, manifest-bound local-only collection, exact Chrome/profile ownership, CDP connection, cache attestation, host/Chrome provenance, immutable artifact hashing, atomic pair commitment, and fail-closed public isolation; no real browser launch is implied.
- [x] Launch exact owned Chrome process/profile for cold runs.
- [x] Implement explicit validation/cold/warm protocol states and retain resource timing; owned-launch cache verification remains below. (State definitions: `docs/cold-start-definition.md`.)
- [x] Alternate paired order with retained seed/block identity.
- [x] Run a separately labelled pilot, then collect the cold/warm schedules at frozen attempted-launch checkpoints 20/30/40/50/60; analyze committed pairs only when at least 20 exist, stop at 3% Bonferroni-protected exact order-statistic precision, or terminate each stratum after its fixed 60-attempt cap as inconclusive when precision is absent (including fewer than 20 committed pairs).
- [x] Retain browser version, flags, console/network, assertions, screenshots, and exact cleanup.

### Results

- [x] Store schema- and hash-validated immutable local raw runs.
- [x] Generate versioned pilot summaries with absolute distributions and full trajectories; paired effects/CI wait for the launch corpus.
- [x] Build an inspectable static page with lifecycle, samples, sizes, provenance, correctness, and unavailable states.
- [x] Add a fail-closed public read-only evidence mode with stable acceptance routes, no raw records or server-side ingestion, and permanent mutation denial.
- [x] Add a non-persistent hosted `/run` journey that hash-binds the executed JS/Wasm bytes, runs heavy scored work in a terminated same-origin module worker, validates every batched invocation, and labels all output exploratory.
- [x] Deploy the exact reviewed read-only evidence source and bind the approved stable domain without provisioning a database.
- [x] Validate keyboard, mobile/desktop layout, dark/reduced-motion/forced-colour states.
- [ ] Independently review and accept the exact M1 commit.

## M2 — families, optimized tracks, and boundaries

- [x] Freeze and publish workload-catalog v1 as an exact 38-row denominator (P0=12/P1=12/P2=14) with closed rights/oracle/equivalence/mode/phase contracts and explicit 0/38 catalog implementation coverage.
- [ ] Add T1 primitive family without presenting tiny intervals before calibration.
- [x] Add representative T2 numeric, parsing, compression, image, and graph kernels.
- [x] Add T4 JS→Wasm, Wasm→JS, round-trip, copy, string, refs, callbacks, and batching tests.
- [ ] Add Track B optimization logs and independent JS/Wasm improvements.
- [ ] Add reviewed WasmGC and hybrid implementations where the workload has a meaningful equivalent; otherwise publish the missing-cell reason.
- [ ] Add `-O3`/`-Oz`, scalar/SIMD, Wasm feature/compiler flags, and other named build variants where supported; retain exact defaults and never silently substitute a non-default mode.
- [ ] Add named JavaScript platform optimization-hint/attribute variants with support probes and dated ChromeStatus plus browser/engine source provenance.
- [x] Add worker creation, clone/transfer/shared-memory, and 1/2/4/N scaling workloads.
- [ ] Permit concurrent variant execution only with preregistered isolation and fair ordering; keep sequential/concurrent cells separate and do not pool them into default-user claims.
- [ ] Review workload balance so microbenchmarks do not dominate.

## M3 — Deno reporting service

### API and storage

- [x] Implement closed-schema `POST /v1/runs` with streaming byte cap before JSON parsing.
- [x] Implement reporter authorization, idempotency, durable rate limits, and timestamp bounds.
- [x] Implement immutable KV run/part/dedupe/index/summary records in one bounded atomic commit.
- [x] Measure key/value/check/mutation/serialized-byte headroom.
- [x] Implement bounded run list/detail, summaries, and health APIs.
- [ ] Implement versioned reconciliation from raw runs.

### Operations

- [ ] Decide raw/public/aggregate retention and deletion policy.
- [ ] Implement owner deletion and non-resurrection tombstones.
- [x] Implement checksummed logical export and isolated restore.
- [x] Test corrupt, partial, stale, foreign, and wrong-schema restores.
- [ ] Model request, KV read/write/storage, egress, and backup cost.
- [x] Obtain explicit approval before Deno app/KV provisioning.
- [ ] Prove production/branch/preview database isolation; never use shared preview KV for destructive tests.
- [ ] Independently review security, privacy, recovery, and exact production source.

## M4 — public results explorer

- [x] Implement AI Focus token layer and editorial/dashboard widths.
- [x] Add URL-backed filters and stable result/run routes.
- [x] Add workload × environment matrix and chart/table pairs.
- [x] Add raw-run, build, environment, correctness, capability, exclusion, and artifact inspectors.
- [x] Avoid winner copy and colour-only status.
- [x] Deploy exact reviewed source.
- [x] Validate live routes, headers, ingestion denial, desktop/mobile controls, console/network, and cleanup.

## M5 — browsers, engines, and devices

- [ ] Add WebDriver BiDi Chrome/Firefox orchestration around the same in-page collector.
- [ ] Add Safari WebDriver Classic orchestration and separately labelled Web Inspector artifacts.
- [ ] Build a browser-product × engine-family/version matrix; do not count products sharing one engine as independent engine evidence.
- [ ] Establish released default-user cells without benchmark-only runtime, tiering, Wasm feature, compiler, or JavaScript optimization overrides.
- [ ] Add separately labelled non-default Wasm baseline/optimizing/tiering, feature, and compiler-flag diagnostic cells with exact launch/runtime flags and authoritative source provenance.
- [ ] Record engine tier identity/transitions only when authoritative evidence exposes them; otherwise publish typed unavailable/blocked states.
- [ ] Add ARM64 desktop host.
- [ ] Add real high/mid/low Android and real iOS Safari evidence as available.
- [ ] Publish capability coverage and unsupported cells without substituting zero.
- [ ] Prevent proprietary diagnostic fields or differently scoped modes entering cross-browser/default-user summaries.

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

## M8 — server and standalone runtime family

- [ ] Add a Node.js harness for accepted workload contracts with exact runtime/version/build/default-mode provenance.
- [ ] Add relevant version-pinned server runtimes or standalone engines only where the same correctness, work, isolation, and stopping contracts apply.
- [ ] Add separately labelled default and non-default Wasm baseline/optimizing/tiering, feature, compiler, and JavaScript optimization modes with exact flags and sources.
- [ ] Validate fair ordering and resource isolation for concurrent tests; retain sequential/concurrent cells separately.
- [ ] Publish per-runtime conclusions separately from browser conclusions and never pool them into a generic default-user claim.

## Standing gates

- [ ] Preserve published IDs, routes, schema versions, and inbound links.
- [ ] Keep raw runs immutable and summaries reproducible.
- [ ] Keep Track A/Track B, cold/warm, browser/server, product/engine, default/non-default, and sequential/concurrent results separate.
- [ ] Never encode unsupported evidence as zero.
- [ ] Never silently exclude a run.
- [ ] Never provision, deploy, spend, use credentials, or mutate production resources without the required approval.

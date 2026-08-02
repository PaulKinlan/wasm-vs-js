# Wasm vs JavaScript benchmark plan

`PLAN.md` is the source of truth for this repository. Scope or acceptance changes update this file in the same commit.

## Product question

When does WebAssembly improve a web application after every user-paid cost is counted?

The suite compares JavaScript, linear-memory WebAssembly, WasmGC, and mixed implementations from transfer through complete browser tasks. It exists to test claims such as “this workload is twice as fast in Wasm” against loading, compilation, initialization, warm-up, boundaries, memory, rendering, workers, and application outcomes.

The result is a matrix, not one score.

## Users

- **Web developers** deciding whether a workload should remain JavaScript, move to Wasm, use WasmGC, or use a hybrid.
- **Compiler/runtime engineers** inspecting where time, size, memory, and boundary costs arise.
- **Tool builders and coding agents** choosing a target from evidence rather than a language default.
- **Editors and researchers** tracing every published claim to raw runs and exact provenance.

## Product surfaces

1. **Benchmark catalog and definitions:** a frozen versioned denominator plus workload variants, inputs, rights/provenance, oracles, work counters, and build recipes.
2. **Runner:** browser page/worker collectors using portable Performance Timeline evidence.
3. **Orchestrator:** fresh-profile cold runs, warm runs, randomized paired blocks, browser/device control, and exact cleanup.
4. **Reporting service:** bounded authorized ingestion, immutable Deno KV records, indexes, summaries, retention, export, and restore.
5. **Results explorer:** AI Focus visual language with matrices, distributions, provenance, caveats, and raw-run inspection.
6. **Article evidence:** a generated, version-pinned claim ledger for an eventual AI Focus article.

## Non-goals

- A universal JavaScript-versus-Wasm winner.
- Ranking browsers by proprietary memory, GC, trace, or throttling metrics.
- Ranking frameworks using unmatched implementations.
- Collapsing browser, server-runtime, or standalone-engine evidence into one conclusion.
- Anonymous executable benchmark submissions.
- Unreported runtime/feature/compiler flags, reduced work, cached expected output, or benchmark-specific special casing.
- Presenting non-default engine modes, optimization hints, or parallel harness throughput as default-user behavior.
- Performance conclusions from authored JSON, mocks, screenshots, prose, or a few best runs.

## Fairness contract

### Track A — controlled

A pair shares:

- algorithm and asymptotic complexity;
- byte-identical immutable inputs;
- data representation where both targets support it;
- output contract and floating-point policy;
- operation, allocation, byte, and boundary counters;
- call topology and concurrency;
- production-equivalent build mode.

Target-specific algorithm substitution is prohibited. Track A estimates runtime and representation effects, subject to declared toolchain limits.

### Track B — independently optimized

Each target may use production-plausible techniques: typed arrays, JS objects/Maps, SIMD, WasmGC layouts, crossing batches, workers, or other reviewed changes. Every change requires an optimization log. Results show absolute performance and improvement over that target's Track A baseline.

Track A and Track B never share a headline aggregate.

## Benchmark taxonomy

| Tier           | Question                              | Initial examples                                            | Required evidence                                   |
| -------------- | ------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| T0 correctness | Is the comparison valid?              | oracle corpus, FP edges, fixed-work audit                   | complete output/digest, invariants, work counters   |
| T1 primitives  | What is a narrow runtime or ABI cost? | arithmetic, memory access, allocation, calls, strings, refs | calibrated duration, operations, bytes              |
| T2 kernels     | How do compute/data patterns behave?  | matrix, hash, compression, parsing, image kernels, graph    | first, warm trajectory, steady, tails, total        |
| T3 components  | What does a production library cost?  | codec, SQLite/query, parser/compiler, ML inference          | lifecycle phases, throughput, footprint             |
| T4 boundaries  | What does composition cost?           | fine/batched calls, copy, string, refs, callbacks           | crossings, copied bytes, end-to-end duration        |
| T5 parallel    | Does concurrency help?                | worker start, clone/transfer/shared memory, 1/2/4/N         | startup, speedup, efficiency, UI interference       |
| T6 application | Does a user benefit?                  | load, edit, filter, sort, chart, render, sustained UI       | first useful output, interaction/render latency     |
| T7 delivery    | What reaches the browser?             | cold/warm cache, buffered/streaming Wasm, network profiles  | request graph, transfer, compile/instantiate, sizes |

The suite uses a preregistered sparse matrix. Every workload does not need every variant, but every missing cell has a reason.

### Frozen workload catalog v1

`catalog/workloads.v1.json` freezes the first public denominator at exactly **38** proposed workloads: P0=12 harness/calibration workloads, P1=12 representative applications, and P2=14 breadth/stress workloads. The stable public route is `/benchmarks/`; the byte-identical machine-readable derivative is `/data/workloads.v1.json`.

Every row retains status, stage, class, domain, story, input rights/provenance state, oracle and equivalence class, algorithm family, fixed work, JavaScript/linear-Wasm/WasmGC/hybrid applicability, lifecycle phases, memory/boundary concerns, prior-art toolchains/licenses, and blockers. The catalog denominator is frozen even though its rows remain proposals. A fixture cannot become frozen without audited rights, verified provenance, permitted redistribution, and an exact SHA-256.

Implementation coverage is separately reconciled. The accepted `sum-u32` controlled slice exercises the harness but is not one of the 38 catalog rows, so current catalog implementation coverage is **0/38**, not 1/38. Results from different algorithm families cannot enter one algorithm-equivalent aggregate; semantic product-choice comparisons remain separate.

## Lifecycle and cache protocol

Each run records separately:

1. navigation and resource fetch;
2. transfer and decoded size;
3. JS parse/evaluation or Wasm compile;
4. Wasm instantiate;
5. application initialization;
6. first useful output;
7. warm-up iterations;
8. steady execution;
9. rendering or interaction completion;
10. validation and result upload outside the timed region.

Cold trials use a fresh browser process/profile, empty relevant storage, no Service Worker, and verified cache policy. Warm trials intentionally prime exact versioned resources. Cold and warm results are never averaged together.

Both buffered `fetch → arrayBuffer → instantiate` and `instantiateStreaming(fetch(...))` are named Wasm variants when relevant.

## Correctness and work gate

No performance cell runs until:

- inputs match the benchmark manifest hash;
- both variants produce equivalent complete output or a canonical digest plus declared structural checks;
- integer overflow, Unicode, exception, ordering, NaN, signed-zero, and f32/f64 policy is explicit;
- work, allocation, bytes, and crossing counters are within the benchmark's declared tolerance;
- result validation prevents dead-code elimination;
- output validation passes on every target browser in scope.

A wrong output rejects the trial and is published as a correctness failure, never as timing data.

## Build and footprint provenance

Every variant records:

- source repository URL plus commit and content hash;
- named generated artifact hashes;
- lockfile hashes and reproducible command;
- compiler, linker, Binaryen/Emscripten, bundler, minifier, and compressor versions;
- full compile, link, browser/runtime launch, engine tiering, and feature flags;
- speed/size optimization, LTO, SIMD, threads, exceptions, memory growth, initial/max memory, i64 ABI, debug/name stripping, Wasm feature set, and baseline/optimizing/tiering mode;
- JavaScript platform optimization hints or attributes, exact values, support probes, and dated ChromeStatus plus browser/engine source provenance where relevant;
- authored source, generated glue, raw payload, gzip, Brotli, request count, transferred bytes, and decoded bytes.

`-O3`, `-Oz`, SIMD, scalar, threads, single-thread, linear Wasm, and WasmGC are distinct variants.

## Sampling and statistics

- Use `performance.now()` and calibrate clock quantum and harness overhead per browser/context.
- Batch fixed work so intervals are at least 100× observed timer quantum and timer overhead is below 1%.
- Preserve the first iteration and every fixed-work iteration.
- Use balanced randomized paired blocks and alternate variant order.
- Tests may run variants concurrently only when preregistered isolation prevents CPU, memory, network, cache, thermal, and scheduler interference and fair ordering remains auditable. Concurrent and sequential modes are separate cells; their samples are never pooled by default.
- Collect independent fresh-browser launches, not only nested iterations in one realm.
- The frozen M1 Chrome experiment uses separate cold and warm headline strata, each with analysis requiring at least 20 committed pairs, fixed attempted-launch checkpoints 20/30/40/50/60, and a cap of 60 attempted launches. Its point estimate is the even-average median per-launch log ratio of Wasm median to JavaScript median. Each checkpoint uses the exact distribution-free two-sided sign/order-statistic interval for the population median at alpha 0.01; Bonferroni allocates family-wise alpha 0.05 across five frozen looks. A stratum stops when `exp((upperLogCi-lowerLogCi)/2)-1 <= 0.03` with finite bounds, or terminates `cap-inconclusive` after 60 attempts, including when failures leave fewer than 20 committed pairs. Ten thousand deterministic paired bootstrap resamples have fully frozen xorshift32/type-7 semantics and are descriptive sensitivity only, never confidence or stopping. See `experiments/m1-chrome-sum-u32-v1/preregistration.json`.
- Publish the paired ratio and median absolute per-launch difference with their exact order-statistic intervals, plus median, mean, p5/p25/p75/p95/p99, MAD/IQR, count, failures, and raw samples.
- Never remove slow samples merely because they are outliers. Integrity exclusions remain machine-readable and visible, with sensitivity summaries where relevant.

A composite, if later provided, is secondary, equal-weight, geometric, versioned, and cannot hide subtest regressions.

## Measurement model

### Portable core

- User Timing marks/measures;
- Navigation and Resource Timing;
- runtime-detected `PerformanceObserver` entries and dropped-entry counts;
- standardized interaction timing only where supported;
- logical Wasm memory size and application-owned counters.

### Browser-specific diagnostics

- Chromium: CDP Performance, Memory, Tracing, HeapProfiler, Network, and Emulation.
- Firefox: WebDriver BiDi plus Gecko Profiler artifacts.
- Safari: WebDriver Classic plus in-page collectors and separately labelled Web Inspector artifacts.

Memory, GC, trace categories, process bytes, engine heap, profiler samples, energy estimates, and browser throttling remain within-browser or diagnostic-only. They do not enter a cross-browser score.

### Availability invariant

A numeric zero is valid only when the metric is supported and zero is its measured semantic value. API absence, redaction, isolation failure, dropped buffers, quota, tool failure, or skipped collection is `unavailable` or `blocked` with a reason.

## Environment matrix

Every run records exact browser product/version/build/engine, OS/kernel/architecture, CPU, core count, RAM, device model, power/thermal state where available, viewport, DPR, refresh rate, headless/headful, launch arguments, automation protocol/version, secure/isolation state, profile/cache identity, Service Worker state, network profile, throttling layer, and collector/profiler state.

Required strata grow by milestone:

- one pinned x86-64 desktop Chrome for the first slice;
- Chrome, Firefox, and Safari on available desktop hosts;
- ARM64 desktop;
- real high/mid/low Android devices and real iOS Safari where available.

Desktop emulation is not mobile hardware evidence. iOS browser labels do not imply independent engines.

### Browser, engine, and runtime modes

The browser matrix identifies both product and engine family/version; products sharing an engine do not count as independent engine evidence. Later matrix milestones cover Chromium/V8, Firefox/Gecko/SpiderMonkey, Safari/WebKit/JavaScriptCore, and other available engines without inventing missing cells.

Each environment is an exact, separately versioned mode:

- **Default-user mode** uses the released product/runtime defaults with no benchmark-only engine, tiering, Wasm feature, or JavaScript optimization override.
- **Non-default diagnostic mode** records every launch/runtime flag, Wasm baseline/optimizing/tiering configuration, enabled/disabled feature, compiler/linker flag, and support probe. These cells explain mechanisms but never stand in for default-user results.
- **Platform-hint mode** records every JavaScript loading/scheduling/optimization hint or attribute, its exact value, runtime support, and dated ChromeStatus plus browser/engine source provenance where relevant. A hint is a named variant, not an invisible advantage.

Engine tier identity or transitions are reported only when authoritative runtime evidence exposes them; otherwise they are typed `unavailable` or `blocked`. Results from different products, engines, default/non-default modes, or sequential/concurrent execution are not pooled into a default-user claim.

A later server/runtime family begins with Node.js and adds relevant version-pinned runtimes or standalone engines only when the same correctness, work, provenance, isolation, and stopping contracts can run. Server/runtime conclusions remain separate from browser conclusions and from one another unless a preregistered comparable stratum justifies aggregation.

## Raw evidence and schemas

`schemas/benchmark.schema.json` defines workload identity and fairness requirements. `schemas/run.schema.json` defines immutable run evidence.

Raw evidence includes:

- run, benchmark, workload, variant, track, build, and environment identities;
- capability probes;
- complete samples and phase marks;
- correctness/work verdicts;
- metric availability, scope, comparability, and provenance;
- exclusions/failures;
- immutable references to larger traces/profiles;
- canonical payload hash.

Canonical hashes use SHA-256 over the UTF-8 bytes of RFC 8785 JSON Canonicalization Scheme output. `payloadSha256` is omitted while canonicalizing and hashing the run envelope, then inserted. Schema version 1 cannot change this algorithm.

Published IDs, schema versions, routes, slugs, and result links are compatibility contracts.

## Reporting architecture

The proposed service is one dynamic Deno Deploy application with one attached managed Deno KV database.

### API

- `POST /v1/runs` — authenticated, idempotent, closed-schema result ingestion; never code execution.
- `GET /v1/runs/:id` — immutable run and evidence metadata.
- `GET /v1/runs` — bounded cursor listing.
- `GET /v1/summaries` — versioned derived summaries.
- `GET /healthz` — bounded service/schema readiness.
- authenticated deletion/export/operator routes defined before deployment.

### KV layout

- `['run', runId]` immutable canonical envelope;
- `['run-part', runId, partNo]` bounded sample chunks when required;
- `['dedupe', reporterId, idempotencyKey]` retry identity;
- explicit by-time, by-suite, by-commit indexes;
- small day/workload/variant/version summary buckets;
- deletion tombstones and reconciliation watermarks.

The run, dedupe marker, indexes, and summary mutations commit atomically. Values remain below 64 KiB with measured headroom. Request bodies are stream-capped before parsing. Writes require signed authorization and durable rate limits; CORS is not authorization.

### Retention and recovery

Initial proposal: detailed raw runs remain in the service for 90 days, but every run used by a published summary or claim must also exist in a checksummed immutable public export for as long as that summary or claim is published. A summary expires or is withdrawn if its complete raw denominator is no longer recoverable. Compact public metadata may remain for one year where useful; aggregate buckets follow a published policy. Final policy is a pre-provisioning decision.

Deno's current managed-KV backup documentation is not sufficient to claim proven restore. Before production data, implement an independent checksummed logical export and perform isolated restore drills. Hosted KV data is documented as stored in and transiting through the US. Preview revisions share one preview database and must never receive production data.

Provisioning, credentials, private data, destructive actions, and material cost require explicit approval.

## Results explorer

The interface uses AI Focus's warm editorial palette and typography, with a wider dashboard canvas. It must include:

- a plain-language claim/provenance strip;
- URL-backed browser/workload/variant/cache/build filters;
- workload × environment evidence matrix;
- absolute units, ratios, confidence intervals, distributions, sample counts, and footprint;
- chart/table pairs with non-colour status encoding;
- expandable raw-run, build, correctness, capability, and exclusion inspectors;
- explicit unavailable/blocked states;
- responsive, keyboard, screen-reader, dark-mode, reduced-motion, and forced-colour support.

No default view may reduce the project to “Wasm won.”

## Anti-gaming rules

Forbidden:

- UA or browser-specific benchmark paths;
- benchmark-name/input special cases;
- reduced work or cached expected outputs;
- benchmark-only compiler patches;
- unreported flags or optimization modes; non-default modes are allowed only as exact, separately labelled diagnostic cells;
- timing manipulation;
- unpublished failed runs or selected minima;
- changing the workload after seeing headline results without versioning it.

Workloads, scoring, input hashes, and exclusion rules freeze before measurement. Public and rotating holdout inputs protect against tuning; rotated holdouts are later published with provenance.

## Milestones

### M0 — public plan and contracts

**Status:** Accepted at `b07694a7473f14a0b217b603a51d8c3d2b9cfa22`; independent exact-commit review returned ACCEPT with no blocker or high finding.

**Deliverable:** public README, canonical plan, task graph, repository rules, benchmark/run schemas, and explicit acceptance gates.

**Acceptance:** files are committed and visible on GitHub; schemas parse; repository validation passes; independent review finds no methodology blocker.

### M1 — one complete vertical slice

**Deliverable:** one Track A workload with equivalent JS and linear-Wasm outputs, reproducible builds, cold/warm runner, portable timing, raw local run records, summary generation, and inspectable static results.

**Journey:** build → correctness/work gate → fresh cold paired runs → warm paired runs → inspect lifecycle, samples, sizes, provenance, and unavailable metrics.

**Acceptance:** at frozen attempted-launch checkpoints and with at least 20 committed fresh pairs, either the preregistered exact-interval precision target is met or collection continues through at most 60 attempted launches per stratum; after the attempt cap, any stratum without the target is labelled inconclusive, including when failures leave fewer than 20 committed pairs. A separately labelled pilot cannot satisfy M1. No database or deployment is required.

### M2 — benchmark family and boundaries

Add T1/T2 kernels plus T4 crossing/copy/string/batching workloads, Track B variants, workers where justified, and reproducible size/speed builds.

### M3 — durable reporting service

Implement bounded authenticated ingestion, immutable KV storage, indexes, summaries, export, deletion, abuse controls, and isolated restore. Provision only after review and approval.

### M4 — public explorer

Deploy the AI Focus-styled accessible results explorer, raw-run inspection, filters, distributions, provenance, and stable routes. Validate desktop/mobile with browser evidence and exact cleanup.

### M5 — browser/engine/device matrix

Add a product × engine matrix for Chromium/V8, Firefox/Gecko/SpiderMonkey, Safari/WebKit/JavaScriptCore, and available additional engines; add ARM64 desktop and real mobile evidence. Establish released default-user cells first. Add separately labelled non-default Wasm baseline/optimizing/tiering and feature/compiler-flag diagnostics only with exact flags, authoritative provenance, and typed unsupported states. Browser-specific diagnostics and products sharing one engine stay distinct.

### M6 — components and applications

Add T3 libraries and T6 complete journeys with first-use, interaction, rendering, and total-task outcomes.

### M7 — corpus scale and article evidence

Grow toward hundreds of versioned workloads through reviewed families, run the preregistered matrix, publish all valid results/failures, and generate a claim ledger for an AI Focus draft. Article conclusions follow the retained evidence.

### M8 — server and standalone runtime family

Run the accepted workload contracts in Node.js first, then in relevant version-pinned server runtimes or standalone engines where a reproducible harness exists. Compare default modes separately from exact non-default tiering/feature/compiler modes, retain isolation and fair-order evidence for any concurrent execution, and publish runtime-specific conclusions without pooling them into browser or generic default-user claims.

## Definition of done

1. Every published timing cell has passing correctness and work equivalence.
2. Track A and Track B are never mixed.
3. Cold, warm, lifecycle, runtime, boundary, rendering, size, and application outcomes remain distinct.
4. Raw runs and exact provenance reproduce every summary.
5. Headline effects include uncertainty and independent-launch counts; inconclusive remains literal.
6. Unsupported metrics are typed unavailable/blocked states.
7. Cross-browser, cross-engine, and later cross-runtime claims use only comparable evidence; product, engine, default/non-default, sequential/concurrent, and server/browser scopes remain explicit.
8. Public routes expose tests, outputs, samples, failures, exclusions, builds, environments, and evidence.
9. Ingestion cannot execute submissions and is authenticated, bounded, idempotent, and rate-limited.
10. Export/restore, deletion, retention, preview isolation, and cost are tested before production data.
11. Desktop/mobile accessibility and browser validation retain exact evidence and owned-process cleanup.
12. The AI Focus article claim ledger points to exact suite version, runs, cells, and residual uncertainty.

## Current status

M0 is accepted. The versioned workload denominator is now frozen at 38 proposed rows (P0=12, P1=12, P2=14), while implementation coverage remains explicitly 0/38 plus one out-of-catalog controlled harness slice. M1 implementation is active: the first controlled `sum-u32` JavaScript/linear-Wasm slice provides an exact input/oracle/work contract, reproducible pinned build, local pilot runner, immutable schema-validated records, versioned summaries, and an inspectable AI Focus-styled results page. A separately bounded public read-only mode can expose the UI, artifacts, manifests, and versioned implementation acceptance package while hiding the runner/raw paths and denying every mutation; this does not advance the result denominator. M1 is not accepted until exact owned-browser paired launches meet the precision target or cap and independent review accepts that evidence. Initial research briefs are complete across methodology, browser measurement, Deno reporting, and AI Focus integration; their decisions still require implementation evidence and milestone review. The read-only Deno application and exploratory browser runner are deployed, but no accepted performance corpus, database, custom domain, or performance claim exists yet.

The M1 Chrome source/build/input/browser/cache/statistics/stopping contract is now frozen and publicly inspectable, including separate cold/warm 20-committed-pair analysis floors, 60-attempt caps, explicit balanced 120-block schedule, committed-pair-only denominator, and a template-only single-use permit envelope. This preregistration does not itself instantiate or consume browser authorization. The next M1 increment adds exact owned-Chrome orchestration, materializes the bounded permit from Paul's explicit corpus request, and collects the required corpus; it does not broaden into more kernels first.

## Primary references

- WebAssembly Web API: https://webassembly.github.io/spec/web-api/
- Performance Timeline: https://www.w3.org/TR/performance-timeline/
- User Timing: https://www.w3.org/TR/user-timing/
- Navigation Timing: https://www.w3.org/TR/navigation-timing-2/
- Resource Timing: https://www.w3.org/TR/resource-timing/
- High Resolution Time: https://www.w3.org/TR/hr-time-2/
- JSON Canonicalization Scheme (RFC 8785): https://www.rfc-editor.org/rfc/rfc8785
- WebDriver BiDi: https://www.w3.org/TR/webdriver-bidi/
- JetStream 3: https://browserbench.org/JetStream/in-depth.html
- Speedometer 3.1: https://browserbench.org/Speedometer3.1/about.html
- Emscripten build guidance: https://emscripten.org/docs/compiling/Building-Projects.html
- Deno Deploy CLI: https://docs.deno.com/runtime/reference/cli/deploy/
- Deno KV transactions: https://docs.deno.com/deploy/kv/transactions/
- Deno KV operations: https://docs.deno.com/deploy/kv/operations/

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
- The frozen M1 Chrome experiment uses separate cold and warm headline strata, each with analysis requiring at least 20 committed pairs, fixed attempted-launch checkpoints 20/30/40/50/60, and a cap of 60 attempted launches. Its point estimate is the even-average median per-launch log ratio of Wasm median to JavaScript median. Each checkpoint uses the exact distribution-free two-sided sign/order-statistic interval for the population median at alpha 0.01; Bonferroni allocates family-wise alpha 0.05 across five frozen looks. A stratum stops when `exp((upperLogCi-lowerLogCi)/2)-1 <= 0.03` with finite bounds, or terminates `cap-inconclusive` after 60 attempts, including when failures leave fewer than 20 committed pairs. Ten thousand deterministic bootstrap resamples of internally derived per-launch paired log ratios have fully frozen xorshift32/type-7 semantics and are descriptive sensitivity only, never confidence or stopping; absolute-difference and target-median vectors are excluded from that bootstrap API. See `experiments/m1-chrome-sum-u32-v1/preregistration.json`.
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

The M1 Chrome source/build/input/browser/cache/statistics/stopping contract is now frozen and publicly inspectable, including separate cold/warm 20-committed-pair analysis floors, 60-attempt caps, explicit balanced 120-block schedule, committed-pair-only denominator, and a template-only single-use permit envelope. This preregistration does not itself instantiate or consume browser authorization. The `/benchmarks/` surface also exposes a separate machine-readable v2 proposal implementation inventory so source, artifacts, validation records, reduced slices, and unavailable states can be inspected without changing frozen-v1 coverage or implying accepted performance evidence. The v2 text proposals `text.diff-patch.v1` and `text.markdown-cms.v1` now have deterministic full-contract JavaScript and authored linear-Wasm correctness packages plus bounded worker demos; their result records remain proposal-validation-only and make no performance claim. The next M1 increment adds exact owned-Chrome orchestration, materializes the bounded permit from Paul's explicit corpus request, and collects the required corpus; it does not broaden into more kernels first.

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

## Complete 50-Benchmark JS + WAT Inventory

All 50 benchmarks execute under the 3-stage architecture; full build recipes across all 300 `.wasm` binaries and 8 build lanes are documented in [`docs/wasm-build-and-equivalence.md`](docs/wasm-build-and-equivalence.md) and verified by `deno run --allow-read scripts/build-all-wasm.ts --verify`:

- **Stage 1 (Mandatory Baseline)**: JavaScript vs primary WebAssembly on identical fixed inputs after pre-timing oracle verification.
- **Stage 2 (Multi-Language Matrix)**: Handwritten WAT, C, C++, Rust, AssemblyScript, and Dart/WasmGC kernels verified against the same oracle.
- **Stage 3 (Track B Optimizations)**: Independently optimized variants (SIMD128, loop tiling, `-O2`/`-O3`/`-O4`) reported separately with declared equivalence class (`bit-identical` or `reassociated`).

| #  | Benchmark & Route                                                                                                                                            | Workload ID                           | Category                    | Type      | JS Source                                                                  | Wasm Source                                                                                                    | Compiled `.wasm`                                                                                                           | Build Command                                                                                                                                                             | Oracle Tests                                                                                                           |
| -- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | --------------------------- | --------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1  | [Modulo-2³² Integer Sum](public/benchmarks/sum-u32/index.html) (`/benchmarks/sum-u32/`)                                                                      | `multilang-wasm`                      | Numeric & Math              | `compute` | [workload.js](benchmarks/sum-u32/workload.js)                              | [sum-u32.wat](benchmarks/sum-u32/sum-u32.wat)                                                                  | [sum-u32.wasm](public/artifacts/sum-u32/sum-u32.wasm)                                                                      | `deno task build`                                                                                                                                                         | `tests/build.test.ts, tests/workload.test.ts, tests/multilang-wasm-benchmark.test.ts`                                  |
| 2  | [PolyBench 9-Kernel Numerical Panel](public/benchmarks/numeric.polybench-panel.v1/index.html) (`/benchmarks/numeric.polybench-panel.v1/`)                    | `numeric.polybench-panel.v1`          | Numeric & Math              | `compute` | [workload.js](benchmarks/base/numeric-polybench-panel/workload.js)         | [polybench-panel.wat](benchmarks/base/numeric-polybench-panel/polybench-panel.wat)                             | [polybench-panel.wasm](public/artifacts/numeric-polybench-panel/polybench-panel.wasm)                                      | `deno run --allow-all scripts/build-base-polybench.ts --source-commit $(git rev-parse HEAD)`                                                                              | `tests/base/polybench-panel.test.ts, tests/multilang-polybench.test.ts`                                                |
| 3  | [FFT Spectral Filter](public/benchmarks/numeric-fft-spectral-filter-v1/index.html) (`/benchmarks/numeric-fft-spectral-filter-v1/`)                           | `numeric.fft-spectral-filter.v1`      | Numeric & Math              | `compute` | [workload.js](benchmarks/base/numeric-fft-spectral-filter/workload.js)     | [numeric-fft-spectral-filter.wat](benchmarks/base/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wat) | [numeric-fft-spectral-filter.wasm](public/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm)          | `deno run --allow-all scripts/build-numeric-fft-spectral-filter.ts --source-commit=$(git rev-parse HEAD)`                                                                 | `tests/base-numeric-fft-spectral-filter.test.ts, tests/multilang-engine-agreement.test.ts`                             |
| 4  | [Radix-2 Complex FFT Butterfly](public/benchmarks/audio-fft/index.html) (`/benchmarks/audio-fft/`)                                                           | `audio.fft.v1`                        | Audio & DSP                 | `compute` | [workload.ts](benchmarks/audio-fft/workload.ts)                            | [audio-fft.wat](benchmarks/audio-fft/audio-fft.wat)                                                            | [audio-fft.wasm](public/artifacts/audio-fft/audio-fft.wasm)                                                                | `deno run --allow-all scripts/build-audio.ts --source-commit=$(git rev-parse HEAD)`                                                                                       | `tests/audio-harness-fft.test.ts, tests/multilang-audio.test.ts, tests/multilang-engine-agreement.test.ts`             |
| 5  | [FIR Direct-Form Convolution](public/benchmarks/audio-fir/index.html) (`/benchmarks/audio-fir/`)                                                             | `audio.fir.v1`                        | Audio & DSP                 | `compute` | [workload.ts](benchmarks/audio-fir/workload.ts)                            | [audio-fir.wat](benchmarks/audio-fir/audio-fir.wat)                                                            | [audio-fir.wasm](public/artifacts/audio-fir/audio-fir.wasm)                                                                | `deno run --allow-all scripts/build-audio.ts --source-commit=$(git rev-parse HEAD)`                                                                                       | `tests/audio-harness-fir.test.ts, tests/multilang-audio.test.ts`                                                       |
| 6  | [Short-Time Fourier Transform (STFT)](public/benchmarks/audio-stft/index.html) (`/benchmarks/audio-stft/`)                                                   | `audio.stft.v1`                       | Audio & DSP                 | `compute` | [workload.ts](benchmarks/audio-stft/workload.ts)                           | [audio-stft.wat](benchmarks/audio-stft/audio-stft.wat)                                                         | [audio-stft.wasm](public/artifacts/audio-stft/audio-stft.wasm)                                                             | `deno run --allow-all scripts/build-audio.ts --source-commit=$(git rev-parse HEAD)`                                                                                       | `tests/audio-harness-stft.test.ts, tests/multilang-audio.test.ts`                                                      |
| 7  | [WebAudio Stereo DSP Effects Rack](public/benchmarks/base/audio-webaudio-effects-v1/index.html) (`/benchmarks/base/audio-webaudio-effects-v1/`)              | `audio.webaudio-effects.v1`           | Audio & DSP                 | `compute` | [workload.js](benchmarks/base/audio-webaudio-effects/workload.js)          | [audio-webaudio-effects.wat](benchmarks/base/audio-webaudio-effects/audio-webaudio-effects.wat)                | [audio-webaudio-effects.wasm](public/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm)                 | `deno run --allow-all scripts/build-base-audio-webaudio-effects.ts --source-commit=$(git rev-parse HEAD) --write`                                                         | `tests/base-audio-webaudio-effects.test.ts, tests/multilang-audio-webaudio-effects.test.ts`                            |
| 8  | [Strict-f32 GEMM Matrix Multiplication](public/benchmarks/ml-gemm/index.html) (`/benchmarks/ml-gemm/`)                                                       | `ml.gemm.v1`                          | Machine Learning            | `compute` | [workload.js](benchmarks/v2/ml-gemm/workload.js)                           | [ml-gemm.wat](benchmarks/v2/ml-gemm/ml-gemm.wat)                                                               | [ml-gemm.wasm](artifacts/v2/ml-gemm/ml-gemm.wasm)                                                                          | `deno run --allow-all scripts/build-v2-neural.ts artifacts $(git rev-parse HEAD)`                                                                                         | `tests/v2/ml-neural-fixtures-oracles.test.ts, tests/multilang-gemm.test.ts, tests/multilang-engine-agreement.test.ts`  |
| 9  | [Dense Multi-Layer Perceptron (MLP) Forward Pass](public/benchmarks/ml-dense-mlp/index.html) (`/benchmarks/ml-dense-mlp/`)                                   | `ml.dense-mlp.v1`                     | Machine Learning            | `compute` | [workload.js](benchmarks/v2/ml-dense-mlp/workload.js)                      | [ml-dense-mlp.wat](benchmarks/v2/ml-dense-mlp/ml-dense-mlp.wat)                                                | [ml-dense-mlp.wasm](artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm)                                                           | `deno run --allow-all scripts/build-v2-neural.ts artifacts $(git rev-parse HEAD)`                                                                                         | `tests/v2/ml-neural-fixtures-oracles.test.ts, tests/multilang-mlp.test.ts`                                             |
| 10 | [ML Inference Numeric Operator Kernels](public/benchmarks/ml-numeric-kernels-v1/index.html) (`/benchmarks/ml-numeric-kernels-v1/`)                           | `ml.numeric-kernels.v1`               | Machine Learning            | `compute` | [workload.js](benchmarks/base/ml-numeric-kernels/workload.js)              | [ml-numeric-kernels.c](benchmarks/base/ml-numeric-kernels/ml-numeric-kernels.c)                                | [ml-numeric-kernels.wasm](public/artifacts/ml-numeric-kernels/ml-numeric-kernels.wasm)                                     | `deno run --allow-all scripts/build-base-ml-numeric-kernels.ts --source-commit=$(git rev-parse HEAD)`                                                                     | `tests/base-ml-numeric-kernels.test.ts, tests/multilang-engine-agreement.test.ts`                                      |
| 11 | [Quantized DS-CNN Keyword Spotting](public/benchmarks/ml-keyword-spotting-v1/index.html) (`/benchmarks/ml-keyword-spotting-v1/`)                             | `ml.keyword-spotting.v1`              | Machine Learning            | `compute` | [engine.js](benchmarks/base/ml-keyword-spotting/engine.js)                 | [keyword-spotting.c](benchmarks/base/ml-keyword-spotting/keyword-spotting.c)                                   | [keyword-spotting.wasm](public/artifacts/base-ml-keyword-spotting/keyword-spotting.wasm)                                   | `deno run --allow-all scripts/build-base-ml-keyword-spotting.ts --source-commit=$(git rev-parse HEAD) --pcm=public/artifacts/base-ml-keyword-spotting/fixture.pcm16le`    | `tests/base/ml-keyword-spotting.test.ts, tests/multilang-keyword-spotting.test.ts`                                     |
| 12 | [Luma + Gaussian Image Editing Pipeline](public/benchmarks/image-editing-demo/index.html) (`/benchmarks/image-editing-demo/`)                                | `image.editing-pipeline.v1`           | Image & Media               | `compute` | [js.ts](benchmarks/image-editing/js.ts)                                    | [image-editing.wat](benchmarks/image-editing/image-editing.wat)                                                | [image-editing.wasm](public/artifacts/image-editing-demo/image-editing.wasm)                                               | `deno run --allow-all scripts/build-image-editing.ts && deno run --allow-all scripts/build-image-demos.ts`                                                                | `tests/image-editing.test.ts, tests/image-demos.test.ts, tests/multilang-engine-agreement.test.ts`                     |
| 13 | [Queue-Based Region Flood Fill](public/benchmarks/image-flood-fill-demo/index.html) (`/benchmarks/image-flood-fill-demo/`)                                   | `image.flood-fill.v1`                 | Image & Media               | `compute` | [js.ts](benchmarks/image-editing/js.ts)                                    | [image-editing.wat](benchmarks/image-editing/image-editing.wat)                                                | [image-editing.wasm](public/artifacts/image-editing-demo/image-editing.wasm)                                               | `deno run --allow-all scripts/build-image-editing.ts && deno run --allow-all scripts/build-image-demos.ts`                                                                | `tests/image-editing.test.ts, tests/image-demos.test.ts, tests/multilang-engine-agreement.test.ts`                     |
| 14 | [Monte Carlo BVH CPU Path Tracer](public/benchmarks/graphics-cpu-path-tracer-v1/index.html) (`/benchmarks/graphics-cpu-path-tracer-v1/`)                     | `graphics.cpu-path-tracer.v1`         | Graphics & 3D               | `compute` | [engine.js](benchmarks/base-v1/graphics-cpu-path-tracer/engine.js)         | [path-tracer.c](benchmarks/base-v1/graphics-cpu-path-tracer/path-tracer.c)                                     | [path-tracer.wasm](public/artifacts/graphics-cpu-path-tracer-v1/path-tracer.wasm)                                          | `deno run --allow-all scripts/build-base-path-tracer.ts --source-commit=$(git rev-parse HEAD)`                                                                            | `tests/base-v1-graphics-cpu-path-tracer.test.ts, tests/multilang-path-tracer.test.ts`                                  |
| 15 | [3D Triangle Mesh Repair & Topology](public/benchmarks/cad-mesh-repair-v1/index.html) (`/benchmarks/cad-mesh-repair-v1/`)                                    | `cad.mesh-repair.v1`                  | CAD & Geometry              | `compute` | [engine.js](benchmarks/base/cad-mesh-repair/engine.js)                     | [mesh-repair.c](benchmarks/base/cad-mesh-repair/mesh-repair.c)                                                 | [mesh-repair.wasm](public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm)                                                   | `deno run --allow-all scripts/build-cad-mesh-repair.ts --source-commit=$(git rev-parse HEAD)`                                                                             | `tests/cad-mesh-repair.test.ts, tests/multilang-engine-agreement.test.ts`                                              |
| 16 | [Parametric CAD Bracket CSG Tessellation](public/benchmarks/cad-parametric-bracket/index.html) (`/benchmarks/cad-parametric-bracket/`)                       | `cad.parametric-bracket.v1`           | CAD & Geometry              | `compute` | [engine.js](benchmarks/base/cad-parametric-bracket/engine.js)              | [bracket.c](benchmarks/base/cad-parametric-bracket/bracket.c)                                                  | [bracket.wasm](public/artifacts/base-cad-parametric-bracket/bracket.wasm)                                                  | `deno run --allow-all scripts/build-base-cad-parametric-bracket.ts`                                                                                                       | `tests/base/cad-parametric-bracket.test.ts, tests/multilang-engine-agreement.test.ts`                                  |
| 17 | [Myers O(ND) Line Diff & Patch](public/benchmarks/text.diff-patch.v1/index.html) (`/benchmarks/text.diff-patch.v1/`)                                         | `text.diff-patch.v1`                  | Text & Parsing              | `compute` | [workload.js](benchmarks/v2/text-diff-patch/workload.js)                   | [text-diff-patch.wat](benchmarks/v2/text-diff-patch/text-diff-patch.wat)                                       | [text-diff-patch.wasm](public/artifacts/text-diff-patch/text-diff-patch.wasm)                                              | `deno run --allow-all scripts/build-v2-text.ts`                                                                                                                           | `tests/v2/text-family.test.ts, tests/multilang-myers.test.ts`                                                          |
| 18 | [Markdown Parser & HTML Sanitizer](public/benchmarks/text.markdown-cms.v1/index.html) (`/benchmarks/text.markdown-cms.v1/`)                                  | `text.markdown-cms.v1`                | Text & Parsing              | `compute` | [workload.js](benchmarks/v2/text-markdown-cms/workload.js)                 | [text-markdown-cms.wat](benchmarks/v2/text-markdown-cms/text-markdown-cms.wat)                                 | [text-markdown-cms.wasm](public/artifacts/text-markdown-cms/text-markdown-cms.wasm)                                        | `deno run --allow-all scripts/build-v2-text.ts`                                                                                                                           | `tests/v2/text-family.test.ts, tests/multilang-markdown-cms.test.ts`                                                   |
| 19 | [Structured Server Log Regex Scanner](public/benchmarks/base/text.regex-log-scan.v1/index.html) (`/benchmarks/base/text.regex-log-scan.v1/`)                 | `text.regex-log-scan.v1`              | Text & Parsing              | `compute` | [workload.js](benchmarks/text-regex-log-scan/workload.js)                  | [text-regex-log-scan.wat](benchmarks/text-regex-log-scan/text-regex-log-scan.wat)                              | [text-regex-log-scan.wasm](public/artifacts/text-regex-log-scan/text-regex-log-scan.wasm)                                  | `deno run --allow-all scripts/build-text-regex-log-scan.ts --source-commit=$(git rev-parse HEAD)`                                                                         | `tests/base-text-regex-log-scan.test.ts, tests/multilang-scanlog.test.ts`                                              |
| 20 | [Thompson NFA / DFA Regex Automata Duel](public/benchmarks/regex-automata-duel-demo/index.html) (`/benchmarks/regex-automata-duel-demo/`)                    | `text.regex-engine-duel.v1`           | Text & Parsing              | `compute` | [workload.js](benchmarks/regex-automata-duel/workload.js)                  | [regex-automata.wat](benchmarks/regex-automata-duel/regex-automata.wat)                                        | [regex-automata-duel.wasm](public/artifacts/regex-automata-duel/regex-automata-duel.wasm)                                  | `deno run --allow-all scripts/build-traditional-web.ts && deno run --allow-all scripts/build-traditional-demos.ts --source-commit=$(git rev-parse HEAD)`                  | `tests/regex-automata-duel.test.ts, tests/multilang-regex-automata-duel.test.ts`                                       |
| 21 | [Piece-Table GC Document Editor](public/benchmarks/text.gc-document-edit.v1/index.html) (`/benchmarks/text.gc-document-edit.v1/`)                            | `text.gc-document-edit.v1`            | Text & Parsing              | `dom`     | [workload.js](benchmarks/v1/text-gc-document-edit/workload.js)             | [Main.kt](benchmarks/v1/text-gc-document-edit/kotlin/src/wasmJsMain/kotlin/Main.kt)                            | [text-gc-document-edit.wasm](public/artifacts/text-gc-document-edit/text-gc-document-edit.wasm)                            | `TEXT_GC_SOURCE_COMMIT=$(git rev-parse HEAD) bash scripts/build-text-gc-document-edit-wasmgc.sh && deno run --allow-all scripts/finalize-text-gc-document-edit-wasmgc.ts` | `tests/text-gc-document-edit.test.ts, tests/multilang-gc-document-edit.test.ts`                                        |
| 22 | [100-Page PDF Object Parser & Glyph Rasterizer](public/benchmarks/document-pdf-viewer-v1/index.html) (`/benchmarks/document-pdf-viewer-v1/`)                 | `document.pdf-viewer.v1`              | Documents & Media           | `compute` | [engine.js](benchmarks/base/document-pdf-viewer/engine.js)                 | [pdf-engine.c](benchmarks/base/document-pdf-viewer/pdf-engine.c)                                               | [pdf-engine.wasm](public/artifacts/document-pdf-viewer/pdf-engine.wasm)                                                    | `deno run --allow-all scripts/build-document-pdf-viewer.ts --source-commit=$(git rev-parse HEAD)`                                                                         | `tests/base-document-pdf-viewer.test.ts, tests/multilang-engine-agreement.test.ts`                                     |
| 23 | [SHA-256 Chunked File Integrity Hashing](public/benchmarks/crypto.file-integrity.v1/index.html) (`/benchmarks/crypto.file-integrity.v1/`)                    | `crypto.file-integrity.v1`            | Cryptography & Archives     | `compute` | [workload.js](benchmarks/base/crypto-file-integrity/workload.js)           | [sha256.c](benchmarks/base/crypto-file-integrity/sha256.c)                                                     | [crypto-file-integrity.wasm](public/artifacts/crypto-file-integrity/crypto-file-integrity.wasm)                            | `deno run --allow-all scripts/build-base-crypto-file-integrity.ts`                                                                                                        | `tests/base-crypto-file-integrity.test.ts, tests/multilang-sha256.test.ts`                                             |
| 24 | [ChaCha20-Poly1305 Authenticated Stream Encryption](public/benchmarks/crypto-authenticated-stream/index.html) (`/benchmarks/crypto-authenticated-stream/`)   | `crypto.authenticated-stream.v1`      | Cryptography & Archives     | `compute` | [workload.js](benchmarks/base/crypto-authenticated-stream/workload.js)     | [aead.c](benchmarks/base/crypto-authenticated-stream/aead.c)                                                   | [crypto-authenticated-stream.wasm](public/artifacts/crypto-authenticated-stream/crypto-authenticated-stream.wasm)          | `deno run --allow-all scripts/build-crypto-authenticated-stream.ts`                                                                                                       | `tests/base-crypto-authenticated-stream.test.ts, tests/multilang-engine-agreement.test.ts`                             |
| 25 | [DEFLATE + CRC32 ZIP Archive Workspace](public/benchmarks/archive-zip-workspace-v1/index.html) (`/benchmarks/archive-zip-workspace-v1/`)                     | `archive.zip-workspace.v1`            | Cryptography & Archives     | `compute` | [engine.js](benchmarks/v1/archive-zip-workspace/engine.js)                 | [archive_zip.c](benchmarks/v1/archive-zip-workspace/archive_zip.c)                                             | [archive-zip-workspace.wasm](public/artifacts/archive-zip-workspace-v1/archive-zip-workspace.wasm)                         | `deno run --allow-all scripts/build-v1-archive.ts --source-commit=$(git rev-parse HEAD)`                                                                                  | `tests/archive-zip-workspace-v1.test.ts, tests/multilang-archive-zip.test.ts`                                          |
| 26 | [NDJSON Telemetry Parser & Schema Aggregator](public/benchmarks/serialization.json-telemetry.v1/index.html) (`/benchmarks/serialization.json-telemetry.v1/`) | `serialization.json-telemetry.v1`     | Serialization & Wire        | `compute` | [workload.js](benchmarks/v1/serialization-json-telemetry/workload.js)      | [telemetry.c](benchmarks/v1/serialization-json-telemetry/telemetry.c)                                          | [telemetry.wasm](public/artifacts/serialization-json-telemetry/telemetry.wasm)                                             | `deno run --allow-all scripts/build-v1-json-telemetry.ts --source-commit=$(git rev-parse HEAD)`                                                                           | `tests/v1-json-telemetry.test.ts, tests/multilang-telemetry.test.ts`                                                   |
| 27 | [Protobuf Binary Wire Codec & Gateway](public/benchmarks/serialization-protobuf-gateway/index.html) (`/benchmarks/serialization-protobuf-gateway/`)          | `serialization.protobuf-gateway.v1`   | Serialization & Wire        | `compute` | [workload.js](benchmarks/base/serialization-protobuf-gateway/workload.js)  | [protobuf-gateway.c](benchmarks/base/serialization-protobuf-gateway/protobuf-gateway.c)                        | [serialization-protobuf-gateway.wasm](public/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm) | `deno run --allow-all scripts/build-base-protobuf.ts`                                                                                                                     | `tests/base-protobuf-gateway.test.ts, tests/multilang-protobuf-gateway.test.ts`                                        |
| 28 | [N-Body Verlet Cloth & Constraint Solver](public/benchmarks/simulation-nbody-cloth/index.html) (`/benchmarks/simulation-nbody-cloth/`)                       | `simulation.nbody-cloth.v1`           | Physics & Simulation        | `compute` | [engine.js](benchmarks/base/simulation-nbody/engine.js)                    | [nbody.c](benchmarks/base/simulation-nbody/nbody.c)                                                            | [nbody.wasm](public/artifacts/base-simulation-nbody/nbody.wasm)                                                            | `deno run --allow-all scripts/build-base-simulation-nbody.ts --source-commit=$(git rev-parse HEAD)`                                                                       | `tests/base/simulation-nbody.test.ts, tests/multilang-nbody.test.ts`                                                   |
| 29 | [2D Impulse Rigid-Body Physics Solver](public/benchmarks/simulation-rigid-body-2d-v1/index.html) (`/benchmarks/simulation-rigid-body-2d-v1/`)                | `simulation.rigid-body-2d.v1`         | Physics & Simulation        | `compute` | [engine.js](benchmarks/v1/simulation-rigid-body-2d/engine.js)              | [rigid-body-2d.c](benchmarks/v1/simulation-rigid-body-2d/rigid-body-2d.c)                                      | [rigid-body-2d.wasm](public/artifacts/simulation-rigid-body-2d-v1/rigid-body-2d.wasm)                                      | `deno run --allow-all scripts/build-rigid-body-2d.ts --source-commit=$(git rev-parse HEAD)`                                                                               | `tests/v1/simulation-rigid-body-2d.test.ts, tests/multilang-engine-agreement.test.ts`                                  |
| 30 | [Columnar OLAP Group-By & Window Rollup](public/benchmarks/database-olap-chart/index.html) (`/benchmarks/database-olap-chart/`)                              | `database.olap-chart.v1`              | Database & Storage          | `compute` | [engine.js](benchmarks/base/database-olap-chart/engine.js)                 | [olap.c](benchmarks/base/database-olap-chart/olap.c)                                                           | [database-olap-chart.wasm](public/artifacts/database-olap-chart/database-olap-chart.wasm)                                  | `deno run --allow-all scripts/build-base-olap.ts --source-commit=$(git rev-parse HEAD)`                                                                                   | `tests/base/database-olap-chart.test.ts, tests/multilang-engine-agreement.test.ts`                                     |
| 31 | [PCAP Ethernet/IPv4/TCP/UDP Flow Dissector](public/benchmarks/network.pcap-decode.v1/index.html) (`/benchmarks/network.pcap-decode.v1/`)                     | `network.pcap-decode.v1`              | Networking & Wire Protocols | `compute` | [engine.js](benchmarks/base/network-pcap-decode/engine.js)                 | [pcap-decode.c](benchmarks/base/network-pcap-decode/pcap-decode.c)                                             | [pcap-decode.wasm](public/artifacts/base-network-pcap-decode/pcap-decode.wasm)                                             | `deno run --allow-all scripts/build-base-network-pcap-decode.ts --source-commit=$(git rev-parse HEAD)`                                                                    | `tests/base-network-pcap-decode.test.ts, tests/multilang-engine-agreement.test.ts`                                     |
| 32 | [Server-Side HTML Template Renderer & Escaper](public/benchmarks/server.ssr-template.v1/index.html) (`/benchmarks/server.ssr-template.v1/`)                  | `server.ssr-template.v1`              | Server & Edge               | `compute` | [workload.js](benchmarks/v1/server-ssr-template/workload.js)               | [server-ssr-template.c](benchmarks/v1/server-ssr-template/server-ssr-template.c)                               | [server-ssr-template.wasm](public/artifacts/base-server-ssr-template/server-ssr-template.wasm)                             | `deno run --allow-all scripts/build-base-server-ssr-template.ts`                                                                                                          | `tests/base-server-ssr-template.test.ts, tests/multilang-server-ssr-template.test.ts`                                  |
| 33 | [Entity-Component-System (ECS) Frame Tick](public/benchmarks/game-ecs-frame-update/index.html) (`/benchmarks/game-ecs-frame-update/`)                        | `game.ecs-frame-update.v1`            | Games & Interactive         | `compute` | [engine.js](benchmarks/v1/game-ecs-frame-update/engine.js)                 | [ecs-frame-update.c](benchmarks/v1/game-ecs-frame-update/ecs-frame-update.c)                                   | [ecs-frame-update.wasm](public/artifacts/game-ecs-frame-update-v1/ecs-frame-update.wasm)                                   | `deno run --allow-all scripts/build-base-game-ecs-frame-update.ts --source-commit=$(git rev-parse HEAD)`                                                                  | `tests/base/game-ecs-frame-update.test.ts, tests/multilang-engine-agreement.test.ts`                                   |
| 34 | [TodoMVC 150-Action User Journey](public/benchmarks/base-dom-todomvc-journey/index.html) (`/benchmarks/base-dom-todomvc-journey/`)                           | `dom.todomvc-journey.v1`              | DOM & Interactive UI        | `dom`     | [engine.js](benchmarks/base/dom-todomvc-journey/engine.js)                 | [todomvc.wat](benchmarks/base/dom-todomvc-journey/todomvc.wat)                                                 | [todomvc.wasm](public/artifacts/base-dom-todomvc-journey/todomvc.wasm)                                                     | `deno run --allow-all scripts/build-base-todomvc.ts --source-commit=$(git rev-parse HEAD)`                                                                                | `tests/base-todomvc.test.ts, tests/dom-conformance.test.ts`                                                            |
| 35 | [2D Spatial Grid Movement & Cell Patching](public/benchmarks/dom-grid-movement/index.html) (`/benchmarks/dom-grid-movement/`)                                | `dom.grid-movement.v1`                | DOM & Interactive UI        | `dom`     | [engine.js](public/benchmarks/dom-grid-movement/engine.js)                 | [dom_grid.c](benchmarks/dom-grid-movement/dom_grid.c)                                                          | [dom_grid.wasm](public/artifacts/dom-grid-movement/dom_grid.wasm)                                                          | `deno run --allow-all scripts/build-all-wasm.ts --only dom-grid-movement`                                                                                                 | `tests/multilang-grid-movement.test.ts, tests/dom-conformance.test.ts`                                                 |
| 36 | [Keyed List Reconciliation & Reordering](public/benchmarks/dom-keyed-list-mutation/index.html) (`/benchmarks/dom-keyed-list-mutation/`)                      | `dom.keyed-list-mutation.v1`          | DOM & Interactive UI        | `dom`     | [engine.js](public/benchmarks/dom-keyed-list-mutation/engine.js)           | [dom_keyed_list.c](benchmarks/dom-keyed-list-mutation/dom_keyed_list.c)                                        | [dom_keyed_list.wasm](public/artifacts/dom-keyed-list-mutation/dom_keyed_list.wasm)                                        | `deno run --allow-all scripts/build-all-wasm.ts --only dom-keyed-list-mutation`                                                                                           | `tests/multilang-keyed-list.test.ts, tests/dom-conformance.test.ts`                                                    |
| 37 | [Hierarchical Nested Tree Expand/Collapse/Move](public/benchmarks/dom-nested-tree-mutation/index.html) (`/benchmarks/dom-nested-tree-mutation/`)             | `dom.nested-tree-mutation.v1`         | DOM & Interactive UI        | `dom`     | [engine.js](public/benchmarks/dom-nested-tree-mutation/engine.js)          | [dom_nested_tree.c](benchmarks/dom-nested-tree-mutation/dom_nested_tree.c)                                     | [dom_nested_tree.wasm](public/artifacts/dom-nested-tree-mutation/dom_nested_tree.wasm)                                     | `deno run --allow-all scripts/build-all-wasm.ts --only dom-nested-tree-mutation`                                                                                          | `tests/multilang-nested-tree.test.ts, tests/dom-conformance.test.ts`                                                   |
| 38 | [Data Table Sort, Filter & Pagination](public/benchmarks/dom-table-sort-filter-pagination/index.html) (`/benchmarks/dom-table-sort-filter-pagination/`)      | `dom.table-sort-filter-pagination.v1` | DOM & Interactive UI        | `dom`     | [engine.js](public/benchmarks/dom-table-sort-filter-pagination/engine.js)  | [dom_table_sort.c](benchmarks/dom-table-sort-filter-pagination/dom_table_sort.c)                               | [dom_table_sort.wasm](public/artifacts/dom-table-sort-filter-pagination/dom_table_sort.wasm)                               | `deno run --allow-all scripts/build-all-wasm.ts --only dom-table-sort-filter-pagination`                                                                                  | `tests/multilang-table-sort.test.ts, tests/dom-conformance.test.ts`                                                    |
| 39 | [Cross-Field Dependent Form Validation](public/benchmarks/dom-dependent-form-validation/index.html) (`/benchmarks/dom-dependent-form-validation/`)           | `dom.dependent-form-validation.v1`    | DOM & Interactive UI        | `dom`     | [engine.js](public/benchmarks/dom-dependent-form-validation/engine.js)     | [dom_form_validate.c](benchmarks/dom-dependent-form-validation/dom_form_validate.c)                            | [dom_form_validate.wasm](public/artifacts/dom-dependent-form-validation/dom_form_validate.wasm)                            | `deno run --allow-all scripts/build-all-wasm.ts --only dom-dependent-form-validation`                                                                                     | `tests/multilang-form-validation.test.ts, tests/dom-conformance.test.ts`                                               |
| 40 | [Virtualized Spreadsheet Formula & Cell Grid](public/benchmarks/dom-virtualized-grid-v1/index.html) (`/benchmarks/dom-virtualized-grid-v1/`)                 | `dom.virtualized-grid.v1`             | DOM & Interactive UI        | `dom`     | [engine.js](benchmarks/base/dom-virtualized-grid/engine.js)                | [grid.c](benchmarks/base/dom-virtualized-grid/grid.c)                                                          | [grid.wasm](public/artifacts/dom-virtualized-grid-v1/grid.wasm)                                                            | `deno run --allow-all scripts/build-dom-virtualized-grid.ts --source-commit=$(git rev-parse HEAD)`                                                                        | `tests/base/dom-virtualized-grid.test.ts, tests/multilang-dom-virtualized-grid.test.ts, tests/dom-conformance.test.ts` |
| 41 | [Virtual DOM Tree Diff & Patch Stream](public/benchmarks/vdom-diff-patch-demo/index.html) (`/benchmarks/vdom-diff-patch-demo/`)                              | `dom.vdom-diff-patch.v1`              | DOM & Interactive UI        | `dom`     | [workload.js](benchmarks/vdom-diff-patch/workload.js)                      | [vdom-diff-patch.wat](benchmarks/vdom-diff-patch/vdom-diff-patch.wat)                                          | [vdom-diff-patch.wasm](public/artifacts/vdom-diff-patch/vdom-diff-patch.wasm)                                              | `deno run --allow-all scripts/build-traditional-web.ts && deno run --allow-all scripts/build-traditional-demos.ts --source-commit=$(git rev-parse HEAD)`                  | `tests/vdom-diff-patch.test.ts, tests/multilang-vdom-diff-patch.test.ts, tests/dom-conformance.test.ts`                |
| 42 | [Turn-Based Tactics Dijkstra Range & Line-of-Sight](public/benchmarks/game-dom-tactics-grid/index.html) (`/benchmarks/game-dom-tactics-grid/`)               | `game.dom-tactics-grid.v1`            | Games & Interactive         | `dom`     | [engine.js](benchmarks/v2/game-family/engine.js)                           | [game-family.c](benchmarks/v2/game-family/game-family.c)                                                       | [game-family.wasm](public/artifacts/game-v2-controlled-family/game-family.wasm)                                            | `deno run --allow-all scripts/build-game-family.ts --source-commit=$(git rev-parse HEAD)`                                                                                 | `tests/v2/game-family.test.ts, tests/multilang-game-tactics-grid.test.ts, tests/dom-conformance.test.ts`               |
| 43 | [2D Canvas Arcade Bullet/Sprite Broadphase](public/benchmarks/game-canvas-arcade/index.html) (`/benchmarks/game-canvas-arcade/`)                             | `game.canvas-arcade.v1`               | Games & Interactive         | `compute` | [engine.js](benchmarks/v2/game-family/engine.js)                           | [game-family.c](benchmarks/v2/game-family/game-family.c)                                                       | [game-family.wasm](public/artifacts/game-v2-controlled-family/game-family.wasm)                                            | `deno run --allow-all scripts/build-game-family.ts --source-commit=$(git rev-parse HEAD)`                                                                                 | `tests/v2/game-family.test.ts, tests/multilang-game-canvas-arcade.test.ts`                                             |
| 44 | [Multi-Agent A* Crowd Pathfinding](public/benchmarks/game-canvas-entity-pathfinding/index.html) (`/benchmarks/game-canvas-entity-pathfinding/`)              | `game.canvas-entity-pathfinding.v1`   | Games & Interactive         | `compute` | [engine.js](benchmarks/v2/game-family/engine.js)                           | [game-family.c](benchmarks/v2/game-family/game-family.c)                                                       | [game-family.wasm](public/artifacts/game-v2-controlled-family/game-family.wasm)                                            | `deno run --allow-all scripts/build-game-family.ts --source-commit=$(git rev-parse HEAD)`                                                                                 | `tests/v2/game-family.test.ts, tests/multilang-game-pathfinding.test.ts`                                               |
| 45 | [glTF 3D Scene Model Loader & Parser](public/benchmarks/base-gltf-viewer/index.html) (`/benchmarks/base-gltf-viewer/`)                                       | `graphics.gltf-viewer.v1`             | Graphics & 3D               | `compute` | [engine.js](benchmarks/base/graphics-gltf-viewer/engine.js)                | [viewer.c](benchmarks/base/graphics-gltf-viewer/viewer.c)                                                      | [viewer.wasm](public/artifacts/base-gltf-viewer/viewer.wasm)                                                               | `deno run --allow-all scripts/build-base-gltf-viewer.ts --source-commit=$(git rev-parse HEAD)`                                                                            | `tests/base-gltf-viewer.test.ts, tests/multilang-engine-agreement.test.ts`                                             |
| 46 | [HTTP/2 & QUIC Frame State Machine](public/benchmarks/base/network-http2-quic-state/index.html) (`/benchmarks/base/network-http2-quic-state/`)               | `network.http2-quic-state.v1`         | Networking & Wire Protocols | `compute` | [engine.js](benchmarks/v1/network-http2-quic-state/engine.js)              | [network-http2-quic-state.c](benchmarks/v1/network-http2-quic-state/network-http2-quic-state.c)                | [network-http2-quic-state.wasm](public/artifacts/network-http2-quic-state/network-http2-quic-state.wasm)                   | `deno run --allow-all scripts/build-network-http2-quic-state.ts`                                                                                                          | `tests/network-http2-quic-state.test.ts`                                                                               |
| 47 | [Virtualized Infinite Window Scrolling](public/benchmarks/dom-virtualized-scrolling/index.html) (`/benchmarks/dom-virtualized-scrolling/`)                   | `dom.virtualized-scrolling.v1`        | DOM & Interactive UI        | `dom`     | [engine.js](public/benchmarks/dom-virtualized-scrolling/engine.js)         | [dom_vscroll.c](benchmarks/dom-virtualized-scrolling/dom_vscroll.c)                                            | [dom_vscroll.wasm](public/artifacts/dom-virtualized-scrolling/dom_vscroll.wasm)                                            | `deno run --allow-all scripts/build-all-wasm.ts --only dom-virtualized-scrolling`                                                                                         | `tests/dom-conformance.test.ts`                                                                                        |
| 48 | [In-Browser C-to-Wasm Compiler](public/benchmarks/tooling-c-to-wasm-compile-v1/index.html) (`/benchmarks/tooling-c-to-wasm-compile-v1/`)                     | `tooling.c-to-wasm-compile.v1`        | Tooling & Compilers         | `compute` | [compiler-js.js](benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js) | [compiler-wasm.c](benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.c)                                   | [compiler.wasm](public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm)                                             | `deno run --allow-all scripts/base/build-tooling-c-to-wasm-compile.ts`                                                                                                    | `tests/base/tooling-c-to-wasm-compile.test.ts`                                                                         |
| 49 | [SQLite In-Browser SQL Notebook](public/benchmarks/database-sqlite-notebook-v1/index.html) (`/benchmarks/database-sqlite-notebook-v1/`)                      | `database.sqlite-notebook.v1`         | Database & Storage          | `compute` | [engine.js](benchmarks/base/sqlite-notebook/engine.js)                     | [contract.js](benchmarks/base/sqlite-notebook/contract.js)                                                     | [sqlite3.wasm](public/artifacts/sqlite-notebook/sqlite3.wasm)                                                              | `deno run --allow-all scripts/vendor-sqlite-notebook-deps.ts && deno run --allow-all scripts/build-sqlite-notebook-runtime-manifest.ts`                                   | `tests/base-sqlite-notebook.test.ts`                                                                                   |
| 50 | [Multi-Language Sum + FFT Panel](public/benchmarks/multilang-wasm/index.html) (`/benchmarks/multilang-wasm/`)                                                | `multilang.wasm.dsp-panel.v1`         | Numeric & Math              | `compute` | [workload.js](benchmarks/sum-u32/workload.js)                              | [fft_kernel.wat](benchmarks/multilang-wasm/fft_kernel.wat)                                                     | [fft_wat.wasm](public/artifacts/multilang-wasm-benchmark/fft_wat.wasm)                                                     | `deno run --allow-all scripts/generate-all-wat-kernels.ts && deno run --allow-all scripts/build-multilang-kernels.ts --only sum-u32,fft-kernel --with-dart`               | `tests/multilang-wasm-benchmark.test.ts, tests/multilang-engine-agreement.test.ts`                                     |

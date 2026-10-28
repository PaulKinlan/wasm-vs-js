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

All benchmarks in the suite execute under the refactored 3-stage architecture:

- **Stage 1 (Mandatory Baseline)**: JavaScript vs WebAssembly (`.wat` text source compiled directly via `wabt` to `.wasm`) on the exact same fixed inputs and oracle equivalence check.
- **Stage 2 (Multi-Language Matrix)**: C, C++, Rust, AssemblyScript, Dart (with & without WasmGC) executing identical kernels against the same oracle.
- **Stage 3 (Track B Optimizations)**: Idiomatic engine optimizations (e.g. v128 SIMD vectorization, cache blocking, unrolling) evaluated strictly after Stage 1 baseline is reported.

| #  | Benchmark                                                                                                                                                         | Workload ID                           | Category                         | Type      | Kernels                  | Stage 1 JS                                                                                                                                           | Stage 1 WAT                                                                                                                                              | Compiled WASM                                                                                                                                            |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------- | --------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | [Modulo-2³² Integer Sum](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/sum-u32.manifest.json)                                        | `multilang-wasm`                      | Numeric & Math                   | `compute` | `sum`                    | [sum_u32.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/sum_u32.ts)                                                         | [sum-u32-simd.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/sum-u32/sum-u32-simd.wat)                                                        | [sum_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/sum_wat.wasm)                                         |
| 2  | [PolyBench 9-Kernel Numerical Panel](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/numeric-polybench-panel.manifest.json)            | `numeric.polybench-panel.v1`          | Numeric & Math                   | `compute` | `polybench`              | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/numeric-polybench-panel/index.html)                                         | [polybench-panel.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/base/numeric-polybench-panel/polybench-panel.wat)                             | [polybench_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/polybench_wat.wasm)                             |
| 3  | [FFT Spectral Filter](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/fft-kernel.manifest.json)                                        | `numeric.fft-spectral-filter.v1`      | Numeric & Math                   | `compute` | `fft`                    | [fft_kernel.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/fft_kernel.ts)                                                   | [numeric-fft-spectral-filter.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/base/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wat) | [fft_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/fft_wat.wasm)                                         |
| 4  | [Radix-2 Complex FFT Butterfly](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/audio-fft.manifest.json)                               | `audio.fft.v1`                        | Audio & DSP                      | `compute` | `fft`                    | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/audio-fft/index.html)                                                       | [audio-fft.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/audio-fft/audio-fft.wat)                                                            | [fft_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/fft_wat.wasm)                                         |
| 5  | [FIR Direct-Form Convolution](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/audio-fir.manifest.json)                                 | `audio.fir.v1`                        | Audio & DSP                      | `compute` | `fir`                    | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/audio-fir/index.html)                                                       | [audio-fir.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/audio-fir/audio-fir.wat)                                                            | [fir_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/fir_wat.wasm)                                         |
| 6  | [Short-Time Fourier Transform (STFT)](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/audio-stft.manifest.json)                        | `audio.stft.v1`                       | Audio & DSP                      | `compute` | `stft`                   | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/audio-stft/index.html)                                                      | [audio-stft.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/audio-stft/audio-stft.wat)                                                         | [stft_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/stft_wat.wasm)                                       |
| 7  | [WebAudio Stereo DSP Effects Rack](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/audio-webaudio-effects-v1.manifest.json)            | `audio.webaudio-effects.v1`           | Audio & DSP                      | `compute` | `audio_dsp`              | [audio_dsp_kernel.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/audio-webaudio-effects/audio_dsp_kernel.ts)                | [audio_dsp.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/audio-webaudio-effects-v1/audio_dsp.wat)                             | [audio_dsp_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/audio_dsp_kernel_wat.wasm)               |
| 8  | [Strict-f32 GEMM Matrix Multiplication](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/ml-gemm.manifest.json)                         | `ml.gemm.v1`                          | Machine Learning                 | `compute` | `gemm`                   | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/ml-gemm/index.html)                                                         | [gemm_wat_simd.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/ml-gemm/gemm_wat_simd.wat)                                       | [gemm_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/gemm_wat.wasm)                                       |
| 9  | [Dense Multi-Layer Perceptron (MLP) Forward Pass](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/ml-dense-mlp.manifest.json)          | `ml.dense-mlp.v1`                     | Machine Learning                 | `compute` | `mlp_forward`            | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/ml-dense-mlp/index.html)                                                    | [mlp_forward.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/ml-dense-mlp/mlp_forward.wat)                                      | [mlp_forward_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/mlp_forward_wat.wasm)                         |
| 10 | [ML Numeric Primitive Kernels](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/ml-numeric-kernels.manifest.json)                       | `ml.numeric-kernels.v1`               | Machine Learning                 | `compute` | `numeric`                | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/ml-numeric-kernels/index.html)                                              | [numeric.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/ml-numeric-kernels/numeric.wat)                                        | [numeric_kernels_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/numeric_kernels_wat.wasm)                 |
| 11 | [Keyword Spotting Audio Classifier](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/ml-keyword-spotting-v1.manifest.json)              | `ml.keyword-spotting.v1`              | Machine Learning                 | `compute` | `kws_run`                | [engine.js](file:////Users/paulkinlan/Code/wasm-vs-js/base/ml-keyword-spotting/engine.js)                                                            | [kws_run.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/ml-keyword-spotting-v1/kws_run.wat)                                    | [kws_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/kws_kernel_wat.wasm)                           |
| 12 | [Image Box Blur & Gaussian Filter](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/image-editing.manifest.json)                        | `image-editing.v1`                    | Image, Graphics & CAD            | `compute` | `luma_gaussian_pipeline` | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/image-editing/index.html)                                                   | [image-editing.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/image-editing/image-editing.wat)                                                | [luma_gaussian_pipeline_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/luma_gaussian_pipeline_wat.wasm)   |
| 13 | [Scanline Queue Flood Fill](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/image-editing.manifest.json)                               | `image-editing.v1`                    | Image, Graphics & CAD            | `compute` | `flood_fill`             | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/image-flood-fill/index.html)                                                | [kernel.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/kernel.wat)                                                             | [flood_fill_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/flood_fill_wat.wasm)                           |
| 14 | [Monte Carlo CPU Path Tracer](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/graphics-cpu-path-tracer.manifest.json)                  | `graphics-cpu-path-tracer.v1`         | Image, Graphics & CAD            | `compute` | `path_trace`             | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/graphics-cpu-path-tracer/index.html)                                        | [render.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/graphics-cpu-path-tracer/render.wat)                                    | [path_tracer_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/path_tracer_wat.wasm)                         |
| 15 | [STL 3D Mesh Topology Repair](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/cad-mesh-repair.manifest.json)                           | `cad.mesh-repair.v1`                  | Image, Graphics & CAD            | `compute` | `mesh_repair`            | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/cad-mesh-repair/index.html)                                                 | [mesh_repair.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/cad-mesh-repair/mesh_repair.wat)                                   | [mesh_repair_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/mesh_repair_wat.wasm)                         |
| 16 | [Parametric Bracket B-Rep & Tessellation](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/cad-parametric-bracket.manifest.json)        | `cad.parametric-bracket.v1`           | Image, Graphics & CAD            | `compute` | `bracket`                | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/cad-parametric-bracket/index.html)                                          | [bracket.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/cad-parametric-bracket/bracket.wat)                                    | [bracket_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/bracket_wat.wasm)                                 |
| 17 | [Myers O(ND) Diff & Patch Algorithm](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/text-diff-patch.manifest.json)                    | `text.diff-patch.v1`                  | Text, Parsing & Document         | `compute` | `myers_diff`             | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/text-diff-patch/index.html)                                                 | [myers_diff.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/text-diff-patch/myers_diff.wat)                                     | [myers_diff_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/myers_diff_wat.wasm)                           |
| 18 | [Markdown CMS Pipeline](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/text-markdown-cms.manifest.json)                               | `text.markdown-cms.v1`                | Text, Parsing & Document         | `compute` | `markdown_cms_render`    | [workload.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/v2/text-markdown-cms/workload.js)                                                 | [markdown_cms_render.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/text-markdown-cms/markdown_cms_render.wat)                 | [markdown_cms_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/markdown_cms_kernel_wat.wasm)         |
| 19 | [Structured Log Scan Regex Matcher](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/text-regex-log-scan.manifest.json)                 | `text.regex-log-scan.v1`              | Text, Parsing & Document         | `compute` | `scan_log`               | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/text-regex-log-scan/index.html)                                             | [scan_log.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/text-regex-log-scan/scan_log.wat)                                     | [scan_log_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/scan_log_wat.wasm)                               |
| 20 | [Thompson NFA to DFA Regex Duel](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/regex-automata-duel-demo.manifest.json)               | `regex-automata-duel-demo`            | Text, Parsing & Document         | `compute` | `regex_scan`             | [js-automata.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/regex-automata-duel/js-automata.ts)                                            | [regex_scan.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/regex-automata-duel-demo/regex_scan.wat)                            | [regex_scan_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/regex_scan_kernel_wat.wasm)             |
| 21 | [GC-Rich Document Tree Mutation](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/text-gc-document-edit.manifest.json)                  | `text.gc-document-edit.v1`            | Text, Parsing & Document         | `compute` | `gc_document_edit_trace` | [workload.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/v1/text-gc-document-edit/workload.js)                                             | [gc_document_edit_trace.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/text-gc-document-edit/gc_document_edit_trace.wat)       | [gc_document_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/gc_document_kernel_wat.wasm)           |
| 22 | [PDF Document Structure Parser](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/document-pdf-viewer.manifest.json)                     | `document.pdf-viewer.v1`              | Text, Parsing & Document         | `compute` | `pdf_parse`              | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/document-pdf-viewer/index.html)                                             | [pdf_parse.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/document-pdf-viewer/pdf_parse.wat)                                   | [pdf_engine_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/pdf_engine_wat.wasm)                           |
| 23 | [SHA-256 Cryptographic Hash](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/crypto-file-integrity.manifest.json)                      | `crypto.file-integrity.v1`            | Crypto, Archives & Serialization | `compute` | `sha256`                 | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/crypto-file-integrity/index.html)                                           | [sha256.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/crypto-file-integrity/sha256.wat)                                       | [sha256_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/sha256_wat.wasm)                                   |
| 24 | [ChaCha20-Poly1305 AEAD Cipher](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/crypto-authenticated-stream.manifest.json)             | `crypto.authenticated-stream.v1`      | Crypto, Archives & Serialization | `compute` | `crypto`                 | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/crypto-authenticated-stream/index.html)                                     | [crypto.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/crypto-authenticated-stream/crypto.wat)                                 | [crypto_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/crypto_wat.wasm)                                   |
| 25 | [ZIP Archive Build & Deflate Compression](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/archive-zip-workspace-v1.manifest.json)      | `archive.zip-workspace.v1`            | Crypto, Archives & Serialization | `compute` | `zip_build`              | [zip_kernel.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/archive-zip-workspace/zip_kernel.ts)                             | [zip_build.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/archive-zip-workspace-v1/zip_build.wat)                              | [zip_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/zip_kernel_wat.wasm)                           |
| 26 | [JSON Telemetry Batch Parsing](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/serialization-json-telemetry.manifest.json)             | `serialization.json-telemetry.v1`     | Crypto, Archives & Serialization | `compute` | `telemetry`              | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/serialization-json-telemetry/index.html)                                    | [telemetry.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/serialization-json-telemetry/telemetry.wat)                          | [telemetry_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/telemetry_wat.wasm)                             |
| 27 | [Protobuf Binary Wire Decode & Filter](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/serialization-protobuf-gateway.manifest.json)   | `serialization.protobuf-gateway.v1`   | Crypto, Archives & Serialization | `compute` | `protobuf_gateway`       | [workload.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/base/serialization-protobuf-gateway/workload.js)                                  | [protobuf_gateway.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/serialization-protobuf-gateway/protobuf_gateway.wat)          | [protobuf_gateway_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/protobuf_gateway_kernel_wat.wasm) |
| 28 | [N-Body Gravitational & Spring Simulation](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/simulation-nbody-cloth.manifest.json)       | `simulation.nbody-cloth.v1`           | Simulation, Data & Systems       | `compute` | `nbody_step`             | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/simulation-nbody-cloth/index.html)                                          | [nbody_step.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/simulation-nbody-cloth/nbody_step.wat)                              | [nbody_step_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/nbody_step_wat.wasm)                           |
| 29 | [2D Rigid Body Physics Engine](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/simulation-rigid-body-2d.manifest.json)                 | `simulation.rigid-body-2d.v1`         | Simulation, Data & Systems       | `compute` | `rigid_engine`           | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/simulation-rigid-body-2d/index.html)                                        | [rigid_engine.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/simulation-rigid-body-2d/rigid_engine.wat)                        | [rigid_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/rigid_wat.wasm)                                     |
| 30 | [Columnar OLAP Query Aggregation](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/database-olap-chart.manifest.json)                   | `database.olap-chart.v1`              | Simulation, Data & Systems       | `compute` | `olap`                   | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/database-olap-chart/index.html)                                             | [olap.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/database-olap-chart/olap.wat)                                             | [olap_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/olap_wat.wasm)                                       |
| 31 | [Network PCAP Packet Decoder](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/network-pcap-decode.manifest.json)                       | `network.pcap-decode.v1`              | Simulation, Data & Systems       | `compute` | `pcap_decode`            | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/network-pcap-decode/index.html)                                             | [pcap_decode.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/network-pcap-decode/pcap_decode.wat)                               | [pcap_decode_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/pcap_decode_wat.wasm)                         |
| 32 | [Server-Side Template Engine & SSR](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/server-ssr-template-v1.manifest.json)              | `server.ssr-template.v1`              | Simulation, Data & Systems       | `compute` | `ssr_render`             | [workload.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/v1/server-ssr-template/workload.js)                                               | [ssr_render.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/server-ssr-template-v1/ssr_render.wat)                              | [server_ssr_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/server_ssr_kernel_wat.wasm)             |
| 33 | [Entity Component System (ECS) Frame Update](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/game-ecs-frame-update.manifest.json)      | `game.ecs-frame-update.v1`            | Simulation, Data & Systems       | `compute` | `ecs_update`             | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/game-ecs-frame-update/index.html)                                           | [ecs_frame_update.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/game-ecs-frame-update/ecs_frame_update.wat)                   | [ecs_frame_update_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/ecs_frame_update_wat.wasm)               |
| 34 | [TodoMVC Reactive State Machine & DOM](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/base-dom-todomvc-journey.manifest.json)         | `dom.todomvc-journey.v1`              | DOM & Interactive UI             | `dom`     | `todomvc_engine`         | [index.html](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/dom-todomvc-journey/index.html)                                             | [todomvc_engine.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/base-dom-todomvc-journey/todomvc_engine.wat)                    | [todomvc_engine_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/todomvc_engine_wat.wasm)                   |
| 35 | [64×64 Entity Grid Movement](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/dom-grid-movement.manifest.json)                          | `dom.grid-movement.v1`                | DOM & Interactive UI             | `dom`     | `grid_trace`             | [grid_kernel.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/dom-grid-movement/grid_kernel.ts)                               | [dom-grid-movement.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/dom-grid-movement/dom-grid-movement.wat)                                    | [grid_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/grid_kernel_wat.wasm)                         |
| 36 | [Keyed List Mutation & Reordering](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/dom-keyed-list-mutation.manifest.json)              | `dom.keyed-list-mutation.v1`          | DOM & Interactive UI             | `dom`     | `keyed_list_trace`       | [keyed_list_kernel.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/dom-keyed-list-mutation/keyed_list_kernel.ts)             | [keyed_list_trace.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/dom-keyed-list-mutation/keyed_list_trace.wat)                 | [keyed_list_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/keyed_list_kernel_wat.wasm)             |
| 37 | [Nested DOM Tree Hierarchy Mutation](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/dom-nested-tree-mutation.manifest.json)           | `dom.nested-tree-mutation.v1`         | DOM & Interactive UI             | `dom`     | `nested_tree_trace`      | [nested_tree_kernel.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/dom-nested-tree-mutation/nested_tree_kernel.ts)          | [nested_tree_trace.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/dom-nested-tree-mutation/nested_tree_trace.wat)              | [nested_tree_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/nested_tree_kernel_wat.wasm)           |
| 38 | [Data Table Sort, Filter & Pagination](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/dom-table-sort-filter-pagination.manifest.json) | `dom.table-sort-filter-pagination.v1` | DOM & Interactive UI             | `dom`     | `table_sort_trace`       | [table_sort_kernel.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/dom-table-sort-filter-pagination/table_sort_kernel.ts)    | [table_sort_trace.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/dom-table-sort-filter-pagination/table_sort_trace.wat)        | [table_sort_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/table_sort_kernel_wat.wasm)             |
| 39 | [Complex Dependent Form Validation](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/dom-dependent-form-validation.manifest.json)       | `dom.dependent-form-validation.v1`    | DOM & Interactive UI             | `dom`     | `form_validate_trace`    | [form_validate_kernel.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/dom-dependent-form-validation/form_validate_kernel.ts) | [form_validate_trace.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/dom-dependent-form-validation/form_validate_trace.wat)     | [form_validate_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/form_validate_kernel_wat.wasm)       |
| 40 | [100,000-Row Virtualized Grid](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/dom-virtualized-grid-v1.manifest.json)                  | `dom.virtualized-grid.v1`             | DOM & Interactive UI             | `dom`     | `grid_trace`             | [engine.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/base/dom-virtualized-grid/engine.js)                                                | [grid_trace.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/dom-virtualized-grid-v1/grid_trace.wat)                             | [grid_trace_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/grid_trace_kernel_wat.wasm)             |
| 41 | [Virtual DOM Tree Diff & Patch Engine](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/vdom-diff-patch.manifest.json)                  | `dom.vdom-diff-patch.v1`              | DOM & Interactive UI             | `dom`     | `vdom_diff_trace`        | [vdom_kernel.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/vdom-diff-patch/vdom_kernel.ts)                                 | [vdom_diff_trace.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/vdom-diff-patch/vdom_diff_trace.wat)                           | [vdom_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/vdom_kernel_wat.wasm)                         |
| 42 | [Tactics Grid Game Loop in DOM](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/game-dom-tactics-grid.manifest.json)                   | `game.dom-tactics-grid.v1`            | DOM & Interactive UI             | `dom`     | `tactics_trace`          | [engine.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/v2/game-family/engine.js)                                                           | [tactics_trace.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/game-dom-tactics-grid/tactics_trace.wat)                         | [tactics_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/tactics_kernel_wat.wasm)                   |
| 43 | [2D Arcade Game Simulation & Canvas](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/game-canvas-arcade.manifest.json)                 | `game.canvas-arcade.v1`               | DOM & Interactive UI             | `dom`     | `arcade_trace`           | [engine.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/v2/game-family/engine.js)                                                           | [arcade_trace.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/game-canvas-arcade/arcade_trace.wat)                              | [arcade_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/arcade_kernel_wat.wasm)                     |
| 44 | [A* Pathfinding & Canvas Swarm Entities](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/game-canvas-entity-pathfinding.manifest.json) | `game.canvas-entity-pathfinding.v1`   | DOM & Interactive UI             | `dom`     | `pathfinding_trace`      | [engine.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/v2/game-family/engine.js)                                                           | [pathfinding_trace.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/game-canvas-entity-pathfinding/pathfinding_trace.wat)        | [pathfinding_kernel_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/pathfinding_kernel_wat.wasm)           |
| 45 | [glTF 3D Scene Model Loader & Parser](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/graphics-gltf-viewer.manifest.json)              | `graphics.gltf-viewer.v1`             | Graphics & 3D                    | `compute` | `viewer`                 | [engine.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/base/graphics-gltf-viewer/engine.js)                                                | [viewer.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/graphics-gltf-viewer/viewer.wat)                                        | [viewer_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/viewer_wat.wasm)                                   |
| 46 | [HTTP/2 & QUIC Frame State Machine](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/v1/network-http2-quic-state/benchmark.json)                       | `network.http2-quic-state.v1`         | Networking & Wire Protocols      | `compute` | `quic_state`             | [network-http2-quic-state.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/v1/network-http2-quic-state/network-http2-quic-state.js)          | [network-http2-quic-state.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/v1/network-http2-quic-state/network-http2-quic-state.wat)            | [quic_state_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/quic_state_wat.wasm)                           |
| 47 | [Virtualized Infinite Window Scrolling](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/dom-virtualized-scrolling/benchmark.json)                     | `dom.virtualized-scrolling.v1`        | DOM & Interactive UI             | `dom`     | `dom_vscroll`            | [dom-virtualized-scrolling.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/dom-virtualized-scrolling/dom-virtualized-scrolling.js)          | [dom-virtualized-scrolling.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/dom-virtualized-scrolling/dom-virtualized-scrolling.wat)            | [dom_vscroll_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/dom_vscroll_wat.wasm)                         |
| 48 | [In-Browser C-to-Wasm Compiler](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/base/tooling-c-to-wasm-compile/benchmark.json)                        | `tooling.c-to-wasm-compile.v1`        | Tooling & Compilers              | `compute` | `compile_c_to_wasm`      | [compiler-js.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js)                                 | [compiler-wasm.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.wat)                               | [compiler_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/compiler_wat.wasm)                               |
| 49 | [SQLite In-Browser SQL Notebook](file:////Users/paulkinlan/Code/wasm-vs-js/Documented library exclusion (C SQLite engine))                                        | `database.sqlite-notebook.v1`         | Database & Storage               | `compute` | `sqlite_exec`            | [sqlite-notebook.js](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/database-sqlite-notebook/sqlite-notebook.js)                               | [sqlite.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/database-sqlite-notebook/sqlite.wat)                                                   | [sqlite3.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/database-sqlite-notebook/sqlite3.wasm)                                         |
| 50 | [Multi-Language 4-Kernel DSP Panel](file:////Users/paulkinlan/Code/wasm-vs-js/public/benchmarks/multilang-wasm/multilang-wasm.manifest.json)                      | `multilang.wasm.dsp-panel.v1`         | Numeric & Math                   | `compute` | `fft, fir, stft, gemm`   | [fft_kernel.ts](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/fft_kernel.ts)                                                   | [fft_kernel.wat](file:////Users/paulkinlan/Code/wasm-vs-js/benchmarks/multilang-wasm/fft_kernel.wat)                                                     | [fft_wat.wasm](file:////Users/paulkinlan/Code/wasm-vs-js/public/artifacts/multilang-wasm-benchmark/fft_wat.wasm)                                         |

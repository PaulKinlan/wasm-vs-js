# Wasm vs JavaScript

When does WebAssembly speed up a web application after the browser has paid for transfer, compilation, initialization, JavaScript↔Wasm crossings, memory, rendering, and the complete user task?

The suite tests JavaScript, linear-memory WebAssembly, WasmGC, and mixed implementations. Results stay grouped by workload, implementation track, lifecycle phase, browser, device, build, and cache state because those conditions can change the answer.

## Measurements

Each workload can record:

- cold transfer, compile, instantiate, initialize, and first useful output;
- warm-up trajectories, steady runtime, tail latency, and total elapsed time;
- calls, copied bytes, strings, references, callbacks, and boundary batching;
- worker startup, message transfer, shared memory, and scaling;
- DOM updates and complete application journeys;
- source, generated glue, raw, gzip, and Brotli sizes;
- memory and browser diagnostics with an explicit browser and scope.

Timing begins only after output and fixed-work checks pass. An unsupported measurement is `unavailable` or `blocked`; numeric zero means the instrument measured zero.

## Fairness tracks

**Track A — controlled:** equivalent algorithm, data representation, inputs, output contract, asymptotic complexity, call topology, and concurrency. This isolates representation and runtime costs as far as browser code permits.

**Track B — optimized:** independently optimized, production-plausible implementations. Target-specific techniques are allowed, but each change is logged and compared with that target's Track A baseline.

The tracks are reported separately.

## Current state

M1 has one accepted implementation slice: `sum-u32`, a controlled JavaScript/linear-Wasm pair with an exact oracle, reproducible build, local runner/store, and versioned summaries.

- [Canonical plan](PLAN.md)
- [Task graph](TASKS.md)
- [Frozen 38-workload catalog](catalog/workloads.v1.json) and [closed catalog schema](schemas/workload-catalog.schema.json)
- [Run evidence schema](schemas/run.schema.json)
- [Benchmark definition schema](schemas/benchmark.schema.json)
- [M1 implementation evidence](public/evidence/v1/acceptance.json)
- [Public source/build inspectability manifest](public/data/sum-u32-inspectability.v1.json) and [closed schema](schemas/public-inspectability.schema.json)
- [Frozen M1 Chrome preregistration](experiments/m1-chrome-sum-u32-v1/preregistration.json) and [closed schema](schemas/preregistration.schema.json)
- [Public read-only deployment procedure](docs/public-deployment.md)
- [WebAssembly build reference and 50-test output equivalence guide](docs/wasm-build-and-equivalence.md)
- [50-test worker lifecycle audit](docs/worker-lifecycle-audit.md) and [isolated SIMD128 auto-research log](docs/autoresearch-log.md)
- [Track B optimization spec](docs/track-b-optimizations.md) and [offline CLI reference snapshot](public/data/reference-snapshot.v1.json)

The public application is [wasm-vs-js.paulkinlan-ea.deno.net](https://wasm-vs-js.paulkinlan-ea.deno.net/).

- `/benchmarks/` freezes the v1 denominator at 38 proposed workloads: P0=12, P1=12, and P2=14. 23/38 catalog workloads have runnable browser demos in the playground; the remaining 15 v1 rows remain documented proposals. Alongside that frozen 38-workload v1 denominator, 20 v2 proposals (14 runnable demos) and out-of-catalog calibration, DOM, and game suites bring the exploratory suite to 50 benchmark specs, 48 playground suites, 45 multi-language kernel manifests (JavaScript, WAT, C, C++, Rust, AssemblyScript, and Dart/WasmGC), 24+ Track B optimization variants, 11 real-DOM iframe stages, and 345 `.wasm` artifacts.
- `/` defaults its overview to Live Browser Runs (0 measured until you click Run) and includes an explicit Data Source toggle for the provenance-tagged Logged Reference Profile (`/data/reference-snapshot.v1.json`, captured in standalone Deno 2.9.0 / V8 14.9.207.2-rusty on Apple M4 Pro across 45 multi-language workloads). Standalone CLI reference measurements are never pooled with live browser runs or preregistered corpus claims.
- `/run/`, `/run`, and `/run.html` now 302-redirect to `/#workload-sum-u32` — the homepage playground's sum-u32 card supersedes the retired standalone runner (the page was removed; playground.js is the runner entry point). The page uploads and stores nothing.
- `/evidence/` records the accepted implementation and the limits of an unverified Chrome 150 attestation whose browser artifacts were not retained. Its source/build panel links the exact commit, executed JavaScript, authored WAT, build recipe, lockfile, versioned build manifest, and compiled Wasm with SHA-256 values.
- `/evidence/v2-proposals/` renders each of the six audio proposal records from its own commit-pinned provenance. Direct JSON links remain in the HTML when JavaScript is disabled or a panel cannot load.
- Inspectability files use exact route entries. `sum-u32` exposes `/benchmarks/sum-u32/benchmark.json`, `/benchmarks/sum-u32/workload.js`, `/artifacts/sum-u32/sum-u32.wasm`, `/artifacts/sum-u32/build-manifest.json`, and `/artifacts/sum-u32/build-manifest.9c309c49.json`. Each of `audio-fft`, `audio-fir`, and `audio-stft` exposes exactly five named manifests (`fixture`, `input`, `reference`, `output`, and `build`), its named Wasm file, `reference-output.f32le`, and the `js-controlled` and `wasm-linear-controlled` result JSON files.
- The server has no wildcard source, artifact, manifest, or result path handler. Unknown and traversal paths return 404; public non-GET requests return 403, and no public mutation or ingestion route is available.
- `/experiments/` publishes the repeated cold/warm protocol. Its 120-launch permit envelope is a template and authorizes no browser launch.

The project has no accepted performance corpus or performance conclusion. M1 remains open until the owned-browser collection reaches its registered precision target or attempt cap.

## Planned reporting service

Later milestones add workload × browser × variant matrices, immutable authenticated result ingestion, raw-run inspection, versioned summaries, export, retention, deletion, and recovery. The proposed store is managed Deno KV; provisioning requires a separately reviewed step.

## Development

Requires Deno 2.9.0.

```sh
deno task build    # reproducible WAT → Wasm plus build/footprint manifest
deno run --allow-read scripts/build-all-wasm.ts --list   # print all 9 Wasm build lanes and 50 per-test recipes
deno run --allow-read scripts/build-all-wasm.ts --verify # verify 50 specs, source routes, and 345 .wasm artifacts
deno run --no-lock --allow-read scripts/build-reference-snapshot.ts --check # verify offline CLI reference snapshot
deno task catalog  # closed-schema, rights, denominator, and public-copy validation
deno run --allow-read=. scripts/check-preregistration.ts # exact M1 experiment contract
deno task check    # build, format, lint, typecheck, contracts, and tests
# Corpus source preflight and fake-only block commit (never launches Chrome):
deno task --config deno.corpus.json corpus:preflight
deno task --config deno.corpus.json corpus:dry-fake
deno task local    # writable local pilot at http://127.0.0.1:8787
deno task summary  # versioned summary from immutable local runs
deno task public   # read-only host and exploratory browser-runner smoke
```

Read the [M1 local pilot protocol](docs/m1-local-pilot.md) before recording a run. It defines the environment manifest, cold/warm states, correctness gate, immutable storage, permit consumption, and cleanup checks.

## Sources

[PLAN.md](PLAN.md) links the WebAssembly Web API, Performance Timeline, User/Navigation/Resource Timing, JetStream 3, Speedometer 3.1, Emscripten, WebDriver BiDi, CDP, Firefox Profiler, Safari WebDriver/Web Inspector, and Deno Deploy/KV sources used for the methodology.

## License

[MIT](LICENSE)

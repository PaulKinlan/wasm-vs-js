# Wasm vs JavaScript

A browser benchmark for a practical question: when does WebAssembly make a web application faster after loading, compilation, JavaScript↔Wasm crossings, memory, rendering, and complete user tasks are counted?

The suite compares JavaScript, linear-memory WebAssembly, WasmGC, and mixed implementations. It does not publish one universal winner. Results are grouped by workload, implementation track, lifecycle phase, browser, device, build, and cache state.

## What will be measured

- cold transfer, compile, instantiate, initialize, and first useful output;
- warm-up trajectories, steady runtime, tail latency, and total elapsed time;
- JavaScript↔Wasm calls, copies, strings, references, callbacks, and batching;
- workers, message transfer, shared memory, and scaling;
- DOM and complete application journeys;
- source, generated glue, raw, gzip, and Brotli sizes;
- memory and browser diagnostics where supported, labelled by scope and browser.

Every timed comparison must first pass output and work-equivalence checks. Unsupported measurements are `unavailable` or `blocked`, never zero.

## Fairness tracks

**Track A — controlled:** equivalent algorithm, data representation, inputs, output contract, asymptotic complexity, call topology, and concurrency. This isolates representation and runtime costs as far as browser code permits.

**Track B — optimized:** independently optimized, production-plausible implementations. Target-specific techniques are allowed, but each change is logged and compared with that target's Track A baseline.

The tracks are reported separately.

## Repository state

The project began on **2026-08-02**. M0 publishes the accepted product plan, methodology, task graph, and evidence contracts. M1 now has its first implementation slice: `sum-u32`, a controlled JavaScript/linear-Wasm pair with an exact oracle, reproducible build, local runner/store, versioned summaries, and inspectable results.

- [Canonical plan](PLAN.md)
- [Task graph](TASKS.md)
- [Run evidence schema](schemas/run.schema.json)
- [Benchmark definition schema](schemas/benchmark.schema.json)
- [M1 implementation evidence](public/evidence/v1/acceptance.json)
- [Hosted exploratory runner](public/run/index.html)
- [Public read-only deployment procedure](docs/public-deployment.md)

The public Deno application is available at [wasm-vs-js.paulkinlan-ea.deno.net](https://wasm-vs-js.paulkinlan-ea.deno.net/). Its `/run/` journey executes only in the current browser tab and never uploads or stores results. No accepted benchmark result, database, custom domain, or performance claim exists yet. M1 remains incomplete until owned-browser paired launches meet the plan's precision target or cap.

## Planned public product

The public Deno application will provide:

- an AI Focus-styled results explorer;
- workload × browser × variant matrices without a single-winner default;
- inspectable raw runs, samples, correctness, build provenance, and exclusions;
- immutable run ingestion through an authorized, bounded API;
- versioned summaries derived from raw runs;
- health, export, retention, deletion, and recovery controls.

The proposed reporting store is managed Deno KV. Provisioning and any material cost require a separate reviewed step.

## Development

Requires Deno 2.9.0.

```sh
deno task build    # reproducible WAT → Wasm plus build/footprint manifest
deno task check    # build, format, lint, typecheck, contracts, and tests
deno task local    # writable local pilot at http://127.0.0.1:8787
deno task summary  # versioned summary from immutable local runs
deno task public   # read-only host and exploratory browser-runner smoke
```

Read the [M1 local pilot protocol](docs/m1-local-pilot.md) before recording a run. It explains the exact environment manifest, cold/warm states, correctness gate, immutable storage, and why manual pilots are not acceptance evidence.

## Research basis

The plan draws on current WebAssembly Web API, Performance Timeline, User/Navigation/Resource Timing, JetStream 3, Speedometer 3.1, Emscripten, WebDriver BiDi, CDP, Firefox Profiler, Safari WebDriver/Web Inspector, and Deno Deploy/KV documentation. Primary links and the decisions derived from them are recorded in [PLAN.md](PLAN.md).

## License

[MIT](LICENSE)

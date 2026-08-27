# Multi-Language Expansion Program (Paul directive, 2026-08-05)

> "what I really want is every benchmark we have to have this multilang support and comparison"

Every **kernel-capable** benchmark must offer the same comparison the multi-language
kernel demo provides: the identical algorithm written in JavaScript, raw WAT,
AssemblyScript, C, C++, Rust, and Dart (WasmGC), compiled to WebAssembly where
applicable, with an in-browser side-by-side run and commit-pinned source for each
implementation. Hand-written WAT files are kept wherever they exist — they are a
first-class variant, not a stepping stone.

The reference implementation is the shipped
[`multilang-wasm` demo](/benchmarks/multilang-wasm/): kernels `sum_u32` + `fft_butterfly`
across 7 engines, real measured report, WasmGC evidence tests, build manifest with
source graph + hashes, artifact routes, production-deployed.

## Scope criterion

A benchmark gets the full multi-language treatment when its **computational core is
an algorithm expressible in any language** — i.e. the workload's cost is dominated by
its own arithmetic/state logic, not by a host API or a third-party engine. Benchmarks
whose essence is DOM interaction, browser APIs, or a vendored library engine get a
documented exclusion (and may still expose an optional "compute core" comparison where
one exists).

### Kernel-capable (waves below)

| Workload                     | Core kernel                | Notes                                |
| ---------------------------- | -------------------------- | ------------------------------------ |
| ml-gemm                      | GEMM, strict f32           | Wave 1 — classic; frozen i/j/k order |
| ml-dense-mlp                 | Dense MLP inference        | Wave 1/2 — frozen GELU exists        |
| text-diff-patch              | Myers diff/apply           | Wave 1/2                             |
| text-regex-log-scan          | Regex engine core          | Naive + Thompson NFA variants        |
| numeric-polybench-panel      | Polybench kernels          | Per-kernel variants                  |
| image-editing / flood-fill   | Pixel kernels (blur, fill) | Wave 2                               |
| audio-fir / audio-stft       | DSP FIR/STFT               | FFT already done; reuse              |
| crypto-file-integrity        | SHA-256                    | Wave 2                               |
| serialization-json-telemetry | JSON parse/stringify       | Wave 2                               |
| simulation-nbody-cloth       | N-body step                | Wave 2                               |
| database-olap-chart          | Aggregation                | Wave 2                               |
| network-pcap-decode          | Packet parse               | Wave 2                               |
| game-ecs-frame-update        | ECS systems                | Wave 2                               |
| numeric-fft-spectral-filter  | FFT                        | Already covered by multilang FFT     |

### Documented exclusions (DOM / platform / library-bound)

### Documented exclusions (platform / library-bound) — 2026-08-11 update

The 2026-08-11 implementation wave (Opus/Gemini worker batches) shipped real
multi-language kernels (JS + C + C++ + Rust + AssemblyScript unless noted) for
previously excluded workloads: all 11 DOM workloads, vdom-diff-patch-demo,
server-ssr-template, serialization-protobuf-gateway, text.markdown-cms,
regex-automata-duel-demo, game-canvas-arcade, game-canvas-entity-pathfinding,
text.gc-document-edit.v1. Those are now in the kernel-capable table, not the
exclusion list.

### Removed from multilang scope — 2026-08-12 (Paul's decision)

The 2026-08-12 wave shipped the remaining tractable cores: audio-webaudio-effects
(DSP rack, live), ml-keyword-spotting (quantized DS-CNN, live), archive-zip-workspace
(fixed-deflate builder, live), and image-editing-demo itself (the image-editing
kernels now run multilang on BOTH image-flood-fill-demo and image-editing-demo,
6 engines incl. Dart / WasmGC). That closes the program at 20 pages (home + 19
workloads).

Paul directed removing the last five from the multilang scope for now:

- **graphics-gltf-viewer** — no lane. Future option if reopened: the scene-graph
  matrix pipeline (node transforms, bounding boxes, skinning blends over a pinned
  rig); Draco decode stays vendored.
- **database-sqlite-notebook-v1** — no lane. Future option if reopened: the
  notebook's OLAP aggregation kernels (grouped sum/avg/count/order over a pinned
  dataset, mirroring database-olap-chart).
- **network-http2-quic-state** — no lane. Future option if reopened: a QUIC
  congestion-control/loss-recovery simulation (RFC 9002-style, pinned packet-event
  fixture), honestly labeled as the algorithm, not the browser stack.
- **tooling-c-to-wasm-compile** — no lane (meta — the page IS the toolchain demo).
- **track-b** — no lane (non-benchmark track index).

Still excluded as before: media/opus/zstd/quantized-inference (vendored engines).

### Multilang lanes status & verification (updated 2026-08-27)

Four pre-existing multilang lanes had pending verification items:

- **simulation-rigid-body-2d** — VERIFIED. Reduced browser shape (120 timesteps,
  checkpoint every 60) runs in ~236ms for Wasm engines (C, C++, Rust, AssemblyScript)
  and ~465ms for JS with agreement checks passing. Active in playground map and
  on the benchmark page.
- **crypto-authenticated-stream** — VERIFIED. Buffer view fix on WebAssembly.Memory
  and cross-engine agreement probes verified. Active in playground map and on the
  benchmark page.
- **document-pdf-viewer** — JS MIRROR VERIFIED. The JavaScript mirror `pdfMirror`
  parses the 100-page report fixture with return code 0 and exact matching counters
  and hit pages. Active in playground map; page runner integration verified.
- **numeric-fft-spectral-filter / fft-kernel** — RESOLVED. The radix-2 FFT kernel
  is verified and deployed via `/benchmarks/multilang-wasm/` (`fft-kernel.manifest.json`)
  and `/benchmarks/audio-fft/` (`audio-fft.manifest.json`). Stale reference to
  non-existent `numeric-fft-spectral-filter.manifest.json` removed from playground map.

Note: the server-ssr-template and text-markdown-cms AssemblyScript kernels
were dropped after the 2026-08-11 VLM pass (counters matched but full-output
bytes drifted from the oracle — honest absence, per the project rule). Their
manifests ship JS/C/C++/Rust.

## Architecture (shared machinery — build once, reuse per workload)

### Source layout

```
benchmarks/multilang-wasm/<workload>/           # one dir per kernel family
  <kernel>.c  <kernel>.cpp  <kernel>.rs  <kernel>.dart  <kernel>.ts  <kernel>.wat(if authored)
```

### Shared build framework

`scripts/build-multilang-<workload>.ts` follows the reference
`scripts/build-multilang-wasm-benchmark.ts`:

1. compile C/C++ (`clang/clang++ --target=wasm32 -O3 -nostdlib`), Rust
   (`rustc --target wasm32-unknown-unknown -O --crate-type cdylib`, no_std),
   AssemblyScript (`asc -O3`), Dart (`dart compile wasm --no-source-maps` + generated
   glue with the `// deno-lint-ignore-file` header);
2. run every variant against the workload's **existing oracle** (same fixed work,
   same frozen order, same tolerances) — no new oracles;
3. measure cold instantiate + warm median in-process; every number real;
4. emit `build-manifest.json` (source graph + artifact hashes) and the workload's
   report rows.

### Shared browser runner

Extract the reference runner (`public/benchmarks/multilang-wasm/runner.js`) into
`public/multilang-runner.js`, driven by a per-workload
`public/benchmarks/multilang-wasm/<workload>.manifest.json`:

```jsonc
{
  "workloadId": "ml.gemm.v1",
  "kernels": [{ "name": "gemm", "inputs": { ... } }],
  "engines": [
    { "key": "js",  "kind": "js" },
    { "key": "c",   "kind": "linear", "file": "gemm_c.wasm", "offset": 0 },
    { "key": "rs",  "kind": "linear", "file": "gemm_rs.wasm", "offset": 0 },
    { "key": "dart","kind": "dart",   "file": "gemm_dart.wasm", "glue": "gemm_dart.mjs" }
  ],
  "sources": [{ "language": "Rust", "path": "benchmarks/multilang-wasm/ml-gemm/gemm.rs" }]
}
```

The runner renders the standard shell + multi-engine tables + commit-pinned source
links. The workload's existing page gains a "Multi-language comparison" section.

### Semantics disclosure (critical)

Dart has no f32 primitive. For strict-f32 kernels (GEMM, MLP), the Dart variant must
either replicate f32 rounding in f64 (documented cost) or disclose looser accumulation.
Every variant row states its exact arithmetic (f32 polynomial vs f64 library trig,
f32 fround-accumulation vs f64, etc.) exactly as the FFT rows do today.

## Waves

- **Wave 1 — DONE (2026-08-05)** — shared `public/multilang-runner.js` (manifest-driven,
  per-kernel adapters, standard controls) + GEMM in C/C++/Rust/Dart, all four variants
  bit-identical to the strict-f32 oracle; report rows, artifact routes, tests, and the
  Multi-Language Comparison section on the ml-gemm page (browser-verified: JS 3.6ms / C 2.7 /
  C++ 2.7 / Rust 2.7 / Dart-WasmGC 111.8 at 128³ — the f32-emulation penalty disclosed).
  Gate green; branch feat/multilang-expansion-plan pushed.
- **Wave 2 (in progress, 2026-08-05)** — text-diff-patch DONE (Myers diff kernels in
  C/C++/Rust/Dart, bit-identical to the oracle, comparison section live on the demo page;
  JS 0.12 / C 0.035 / C++ 0.035 / Rust 0.015 / Dart 0.185ms browser-measured). Remaining:
  text-regex-log-scan DONE (C/C++/Dart bit-identical; Rust flagged in-progress), numeric-polybench-panel, audio-fir, audio-stft.
- **Wave 3 (in progress, 2026-08-05)** — ml-dense-mlp DONE (mlp_forward in C/C++/Rust/Dart,
  bit-identical to the mlpControlled oracle on the full 32×512×8 shape; comparison section
  live; JS 4.8 / C 2.4 / C++ 2.4 / Rust 2.4 / Dart 73.4ms browser-measured). Remaining:
  image-editing, flood-fill, crypto-file-integrity, simulation-nbody-cloth.
- **Wave 4** — serialization-json-telemetry, database-olap-chart, network-pcap-decode,
  game-ecs-frame-update.

Parallelization: independent workloads can be sharded across agents (each wave = one
branch per workload, MASTER integrates). The gate (`deno task check`) must stay green
per merge; new artifacts add server.ts routes (rebind cascade required).

## Backlog / known issues

- **Rust scan_log kernel (text-regex-log-scan) — in-progress.** The wasm build misbehaves
  in a kernel-specific way (myers_diff's Rust is fine): slice-based versions panic with
  empty-message/no-location panics (identical code works in a probe build); a raw-pointer
  rewrite diverges on prefix-comparison counts despite the pattern tables being
  wasm-verified correct (probe exports confirm all 20 prefixes + lengths). Trace notes:
  /tmp scan_dbg/scan_ab/scan_trace probes were used during the 2026-08-05 session; the
  C/C++/Dart reference is committed and bit-identical, so the fix is mechanical once the
  root cause (suspected const/slice codegen quirk on wasm32-unknown-unknown) is pinned.
  Suggested next steps: test the slice version built with `-C debug-assertions=off` and
  `-C overflow-checks=off`; or compare the wasm disassembly of the working dbg3 probe vs
  the failing scan_log from the same build.

## Constraints & risks

- **Deploy file-size limit (~5MB/file via `deno deploy` CLI)**: every new multilang
  artifact is small (<40KB) — fine. The two pre-existing >5MB evidence files
  (base-gltf-viewer/reference-output.bin 21MB, ml-gemm/reference.f64 8MB) currently
  block full CLI deploys; tracked separately (see deploy notes) — MASTER's dashboard
  channel or redirect routes.
- **Frozen evidence**: never touch frozen v1 records or traditional-demos retained
  evidence; multilang additions are additive (new variants/artifacts/sections).
- **Oracles**: reuse existing workload oracles; never weaken tolerances to fit a
  variant.
- **WAT**: keep every existing WAT file; author new WAT only where it adds value
  (tiny kernels like sum_u32).
- **Gate**: `deno task check` green per merge; server.ts route changes → run
  `scripts/rebind-server-ts.sh`.

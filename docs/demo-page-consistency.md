# Demo Page Consistency Program (Paul directive, 2026-08-05)

Owner: DeepSeek instance (subagent-chat-019fcd40). Integrator/reviewer: MASTER (k3).
Consult: Gemini (019fc830) owns the unified-runner template.

## The standard (reference: /benchmarks/dom-grid-movement/ and the 7 other

unified-runner pages)

Every benchmark page MUST:

1. Load `/unified-runner.js` and present the **standard Run Benchmark Loop**:
   - "Target Engine" dropdown DEFAULTING TO "Compare Side-by-Side (JS vs Wasm)"
   - "Loop Iterations" dropdown (default 10 fast check)
   - Start Benchmark Suite / Cancel buttons, per-iteration progress status
   - Side-by-side comparison output: per-target medians, ratio, verdict,
     graphs + tables (whatever unified-runner renders today)
2. Use the standard page shell: "Wasm vs JavaScript benchmark" header with
   BROWSE CATALOG / EXPERIMENT / EVIDENCE / DATA V1 nav, serif h1, eyebrow
   category line, single intro paragraph. Demo-specific content (metadata,
   evidence, provenance links) goes BELOW the runner in the standard section
   style (no bespoke card grids).
3. Run BOTH targets by default. Single-target contract runs may remain as a
   secondary mode where correctness evidence matters (audio pages), but the
   comparison loop is the primary control.

Reference screenshots (2026-08-05): /home/paulkinlan/journal/reports/page-reference.jpeg
(standard), page-todomvc.jpeg / page-cad.jpeg / page-audio.jpeg (problems).

## Paul's named issues (wave 1 — do these first)

1. `/benchmarks/base-dom-todomvc-journey/` — old controller.js generation,
   single-target dropdown, "no performance claim" box. Convert to
   unified-runner side-by-side (the workload has js + wasm-linear controlled
   variants — the playground already times it via its card; reuse that path).
2. `/benchmarks/cad-mesh-repair-v1/` — already on unified-runner but wraps it
   in bespoke card boxes. Restyle to the standard shell/sections; keep the
   runner as-is.
3. `/benchmarks/audio-fft/` (+ audio-fir, audio-stft — same demo-runner.js
   generation) — contract-runner pages (single engine dropdown, one
   iteration). Add the standard benchmark loop as the primary control; keep
   the contract/oracle run as a secondary "correctness evidence" section.
   **PIN WARNING**: tests/audio-demo-page-pins.json byte-pins these pages —
   update the pins in the same change.
4. `/run/` — sum-u32-only runner, redundant with the homepage playground card.
   Retire: replace with an HTTP redirect to `/#workload-sum-u32` (or the
   homepage playground anchor for sum-u32). Remove the page; keep any tests
   green (grep for /run/ references in tests/ and public/playground.js).

## Wave 2 (after wave 1 lands green)

Extend the standard to the remaining older-generation pages, one PR-sized
batch at a time:

- archive-zip-workspace-v1, crypto-authenticated-stream, database-olap-chart,
  database-sqlite-notebook-v1, dom-virtualized-grid-v1, game family pages
  under /benchmarks/base/ and /demos/, graphics-cpu-path-tracer-v1,
  ml-dense-mlp, ml-gemm, ml-keyword-spotting-v1, ml-numeric-kernels-v1,
  numeric-fft-spectral-filter-v1, serialization-protobuf-gateway,
  simulation-rigid-body-2d-v1, tooling-c-to-wasm-compile-v1, base-gltf-viewer,
  base-dom-todomvc-journey (wave 1), image demos (already unified)
- **Audio retained evidence**: the frozen audio browser-validation records
  byte-bind the OLD audio-fft/fir/stft page bytes (tests/audio-demo.test.ts
  compares pins against frozen pageHashes). Any audio page edit MUST either
  re-record the browser validation or update the evidence semantics in the
  same change — a cosmetic-only page edit that leaves the frozen record
  pointing at old bytes fails the gate (learned 2026-08-05, reverted).
- **Do NOT touch** regex-automata-duel-demo or vdom-diff-patch-demo
  (frozen evidence).

## Wave 1b — Unified header + navigation (Paul, 2026-08-05)

"Make the headers and nav better and consistent across all pages. I find it
really hard to navigate fwd, back and across the site."

Design (align with Paul before mass-rolling):

1. **One shared header on every page** (homepage, /benchmarks/ catalog, every
   benchmark/demo page, evidence, experiments, data): brand "Wasm vs
   JavaScript benchmark" linking to /, plus primary nav:
   Playground (/) · Catalog (/benchmarks/) · Experiment · Evidence · Data v1.
   Current page highlighted.
2. **Breadcrumbs on every workload page**: Catalog › <Category> › <Workload>
   — this is the "back/across" affordance; browser back is not site nav.
3. **Implementation**: shared CSS + a static HTML snippet (CSP-friendly, no
   JS dependency for chrome). To keep 30+ pages in sync, generate/verify the
   snippet with a script + freshness gate (routes.generated.ts precedent).
4. Older-generation pages (todomvc-era sans/boxed header) get restyled to
   the standard shell as part of their wave-1/wave-2 conversion.

## Hard constraints (the repo's invariants)

- **Pinned bytes**: many pages/scripts are pinned in build manifests or
  page-pin tests. After ANY edit to a pinned file, run
  `bash scripts/rebind-server-ts.sh` (37 steps, self-verifying) and settle
  commit-embedding records (SSR pin file, v2 text records, traditional-demos
  surgical rebind per the script). The gate tells you what's stale — never
  hand-edit manifest hashes.
- **Worker anchors**: if a change alters bytes pinned by
  public/worker-anchors.generated.js, regenerate via
  `deno run --allow-read --allow-write=public scripts/build-worker-anchors.ts`.
- **Gate**: `deno task check` must be 100% green (incl. CDP smoke stage).
  First run after checkout may be ~20-25s (cold caches); quote the warm run.
- **Isolation**: work in `git worktree add /tmp/wvj-consistency -b feat/demo-consistency`
  from latest origin/main. NEVER commit in /home/paulkinlan/wasm-vs-js
  (shared checkout). Push the branch; MASTER integrates.
- **Live verification**: after integration, verify the changed pages in a
  fresh-profile browser (run both targets to Complete, zero console errors).
- server.ts route changes (e.g. removing /run/) trigger the rebind cascade —
  that's normal; run the script.

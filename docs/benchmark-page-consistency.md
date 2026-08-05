# Benchmark Page Consistency Audit

Status: audit completed 2026-08-05 (page-consistency program, TASKS.md queue item).
Scope: every `/benchmarks/<workload>/` page in `public/benchmarks/*/index.html`.
Standard reference: the multi-language pages (e.g. `audio-fft`, `ml-gemm`, `image-flood-fill-demo`)
and the unified shell pages (e.g. `cad-mesh-repair-v1`).

## What "consistent" means here

1. **Standard shell**: masthead + `data-workload` + `#demo-form` (`#target`, `#iterations`, `#start`,
   `#cancel`), `#status`, `#perf-reporting`, and `/unified-runner.js` (or the multilang family's
   `multilang-runner.js` + `data-multilang-*` wiring).
2. **Results chart**: `unified-runner.js` renders a comparative bar report (`.perf-bar[data-pct]`,
   CSSOM width — CSP-legal) into `#perf-reporting` on every unified page. Bespoke pages that do not
   load `unified-runner.js` have no standard chart.
3. **Multi-language comparison**: pages whose workload has a multilang adapter + manifest
   (`public/benchmarks/multilang-wasm/<id>.manifest.json` + a `KERNEL_ADAPTERS` entry) should expose
   the `Multi-Language Comparison` section. DOM/platform/library-bound workloads are documented
   exclusions in `docs/multilang-expansion.md` and should carry an honest in-page note instead.
4. **Evidence binding**: pages listed in a build-manifest's source graph (or the audio pins) are
   byte-bound — editing them requires the rebind cascade + re-record; treat as frozen for cosmetic
   changes.

## Inventory (35 pages)

Legend: tpl = template (UNIFIED / MULTILANG / BESPOKE); chart = standard results bars present;
ml = multi-language comparison present; excl = documented exclusion; pin = manifest/evidence-sourced
(editable only with rebind).

| Page                               | tpl       | chart | ml  | excl           | pin              | Notes                                                                                                                           |
| ---------------------------------- | --------- | ----- | --- | -------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| multilang-wasm                     | MULTILANG | yes   | yes | —              | no               | Multilang hub page (sum/fft + engines).                                                                                         |
| ml-gemm                            | MULTILANG | yes   | yes | —              | no               | Neural GEMM + multilang comparison.                                                                                             |
| simulation-nbody-cloth             | MULTILANG | yes   | yes | —              | no               | Multilang comparison page.                                                                                                      |
| audio-fft / audio-fir / audio-stft | UNIFIED   | yes   | yes | —              | yes (audio pins) | Standard shell + multilang; bytes frozen via tests/audio-demo-page-pins.json.                                                   |
| image-flood-fill-demo              | UNIFIED   | yes   | yes | —              | no               | Standard shell + multilang (image-editing manifest).                                                                            |
| image-editing-demo                 | UNIFIED   | yes   | no  | —              | no               | Standard shell; image-editing pipeline demo with frozen "no timing" notice; multilang available on the sibling flood-fill page. |
| database-olap-chart                | UNIFIED   | yes   | yes | —              | no               | Standard shell + multilang comparison.                                                                                          |
| ml-dense-mlp                       | UNIFIED   | yes   | yes | —              | no               | Standard shell + multilang comparison.                                                                                          |
| sum-u32                            | UNIFIED   | yes   | yes | —              | no               | Reference workload + multilang section.                                                                                         |
| regex-automata-duel-demo           | UNIFIED   | yes   | no  | —              | no               | Traditional demo on the unified shell.                                                                                          |
| vdom-diff-patch-demo               | UNIFIED   | yes   | no  | —              | no               | Traditional demo on the unified shell.                                                                                          |
| archive-zip-workspace-v1           | UNIFIED   | yes   | no  | library-bound  | yes              | Vendored engine (archive zip); manifest-sourced.                                                                                |
| base-gltf-viewer                   | UNIFIED   | yes   | no  | platform-bound | yes              | GLTF loader; manifest-sourced.                                                                                                  |
| document-pdf-viewer-v1             | UNIFIED   | yes   | no  | platform-bound | yes              | PDF viewer; manifest-sourced.                                                                                                   |
| database-sqlite-notebook-v1        | BESPOKE   | no    | no  | library-bound  | yes              | Bespoke `sqlite-notebook-runner.js` (special notebook UI); manifest-sourced.                                                    |
| serialization-protobuf-gateway     | BESPOKE   | no    | no  | library-bound  | no               | Bespoke `protobuf-runner.js` (owned-Chrome containment demo).                                                                   |
| base-dom-todomvc-journey           | UNIFIED   | yes   | no  | DOM-bound      | yes              | Standard shell but run controls ship `disabled` and the copy overstates the worker run (see findings). Manifest-sourced.        |
| dom-virtualized-grid-v1            | UNIFIED   | yes   | no  | DOM-bound      | yes              | Manifest-sourced.                                                                                                               |
| dom-dependent-form-validation      | UNIFIED   | yes   | no  | DOM-bound      | no               |                                                                                                                                 |
| dom-grid-movement                  | UNIFIED   | yes   | no  | DOM-bound      | no               |                                                                                                                                 |
| dom-keyed-list-mutation            | UNIFIED   | yes   | no  | DOM-bound      | no               |                                                                                                                                 |
| dom-nested-tree-mutation           | UNIFIED   | yes   | no  | DOM-bound      | no               |                                                                                                                                 |
| dom-table-sort-filter-pagination   | UNIFIED   | yes   | no  | DOM-bound      | no               |                                                                                                                                 |
| dom-virtualized-scrolling          | UNIFIED   | yes   | no  | DOM-bound      | no               |                                                                                                                                 |
| ml-keyword-spotting-v1             | UNIFIED   | yes   | no  | model-bound    | no               |                                                                                                                                 |
| tooling-c-to-wasm-compile-v1       | UNIFIED   | yes   | no  | meta           | no               |                                                                                                                                 |
| cad-mesh-repair-v1                 | UNIFIED   | yes   | no  | not assessed   | no               | Kernel candidate; not yet in the multilang plan.                                                                                |
| crypto-authenticated-stream        | UNIFIED   | yes   | no  | not assessed   | no               | Kernel candidate; not yet in the multilang plan.                                                                                |
| ml-numeric-kernels-v1              | UNIFIED   | yes   | no  | not assessed   | no               | Kernel candidate; not yet in the multilang plan.                                                                                |
| graphics-cpu-path-tracer-v1        | UNIFIED   | yes   | no  | not assessed   | no               | Canvas framebuffer demo on the unified shell.                                                                                   |
| numeric-fft-spectral-filter-v1     | UNIFIED   | yes   | no  | covered by FFT | yes              | FFT covered by the multilang FFT kernel; manifest-sourced.                                                                      |

(35 pages audited; audio pages counted as one family.)

## Findings

1. **Every page loading `unified-runner.js` already gets the standard results bar chart** — the
   "no chart" gap is limited to the two bespoke pages (sqlite, protobuf), which use special runners
   by design.
2. **TodoMVC (`base-dom-todomvc-journey`)**: the page ships `disabled` on `#target`/`#start` markup
   (re-enabled at runtime by `unified-runner.js`, but the HTML reads as dead before JS runs), its
   copy says the run does "real DOM mutation" while the homepage worker run is engine-only (the DOM
   journey runs on this page via the host adapter), and it has no multi-language comparison. The
   TodoMVC multi-language item is owned by a separate workstream (engine-level C/C++/Rust/Dart for
   the 100-item state machine); page changes should land with that workstream to avoid conflicts.
   Page is manifest-sourced (edits need the rebind cascade).
3. **DOM/platform-bound pages** (grid family, validation, scrolling, keyword-spotting,
   tooling-c-to-wasm-compile, protobuf) now carry an honest in-page note linking
   `docs/multilang-expansion.md` instead of a missing comparison.
4. **Kernel candidates not yet multilang**: cad-mesh-repair-v1, crypto-authenticated-stream,
   ml-numeric-kernels-v1 — expressible workloads not yet covered by the multilang plan; candidates
   for future waves.
5. **Evidence-bound pages** (editable only with the rebind cascade + re-record): audio family,
   archive-zip, base-gltf-viewer, document-pdf-viewer, sqlite-notebook, todomvc,
   dom-virtualized-grid, numeric-fft-spectral-filter, simulation-rigid-body-2d.

## Recommendations

- TodoMVC: with the multilang workstream — remove the `disabled` markup, reword the copy to
  distinguish the worker engine run from the page's real-DOM journey, add the engine-level
  multi-language comparison.
- Bespoke pages (sqlite, protobuf): acceptable as bespoke-by-design; consider adding a standard
  summary chart if their runners can emit the same stats without changing the workload contract.
- Add the remaining kernel candidates (cad-mesh, crypto-authenticated-stream, ml-numeric-kernels)
  to the multilang expansion waves.
- Re-run the gate after any page edit that touches a manifest-sourced page (rebind cascade).

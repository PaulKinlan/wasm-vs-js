# Repository rules

Read `PLAN.md` before planning or changing the project. It is canonical. Every change must advance one active milestone and preserve published workload IDs, variant IDs, schema versions, routes, and result URLs.

## Benchmark integrity

- Never report one context-free JavaScript-versus-Wasm winner.
- Keep controlled Track A and independently optimized Track B separate.
- Do not time a pair until equivalent outputs and fixed work pass.
- Preserve cold and warm runs separately. Retain first iterations and complete trajectories.
- Record exact browser, OS, device, source, build, compiler, flags, cache, network, and collector provenance.
- Unsupported, blocked, redacted, dropped, or uncollected evidence is never numeric zero.
- Browser-specific memory, GC, tracing, throttling, and process metrics remain explicitly browser-specific diagnostics.
- Raw runs are immutable. Summary algorithms are versioned and reproducible from retained runs.
- No exclusion is silent. Keep the sample and a machine-readable reason unless integrity failed before a valid sample existed.
- Benchmarks measure reality; they never tolerate or reject timing. No slot tolerances, no interval acceptance windows, no "expected duration" assertions. GC pauses, render jitter, and cold-start outliers are real measurements — report them, do not gate on them. Structural checks (trace shape, counts, schema) stay strict; temporal checks report.

## Demo conformance (every benchmark page, no exceptions)

A benchmark is not done when its engine works. It is done when it satisfies
all three requirements below and the gate proves it. These are standing Paul
directives (2026-08-05 onward); the 2026-08-09 full-site audit
(`docs/audits/2026-08-09-demo-audit.txt`, frozen baseline — do not modify)
measured the gaps and every fix must move those numbers.

### 1. The standard template is mandatory

Every benchmark page uses the same shell and the same run controls
(`docs/demo-page-consistency.md` is the standard):

- Load `/unified-runner.js` and present the standard Run Benchmark Loop:
  "Target Engine" defaulting to "Compare Side-by-Side (JS vs Wasm)", "Loop
  Iterations" dropdown, Start/Cancel buttons, and a per-iteration status
  element with `id="status"` — the runner bails silently without it
  (2026-08-05 incident: 9 standardized pages shipped without `#status` and
  the run never started).
- The standard page shell: brand header with BROWSE CATALOG / EXPERIMENT /
  EVIDENCE / DATA V1 nav, serif h1, eyebrow category line, one intro
  paragraph, then standard sections below the runner. No bespoke card grids,
  no legacy extra stylesheets, no inline `style=` attributes (CSP — use
  `data-pct` and DOM property setting).
- Both targets run by default. Single-target contract runs may remain as a
  secondary correctness-evidence mode (audio pages), never as the primary
  control.
- For generated pages the template is the source of truth: edit the
  `index.template.html` / builder script, never the generated output — the
  next build overwrites hand edits.
- Every page asset needs a server route and a regenerated route table
  (`scripts/build-routes.ts`); a page that ships without routes 404s in
  production.

### 2. DOM workloads MUST drive — and test — the real DOM

If a workload's essence is DOM interaction, computing DOM _math_ in a worker
is not the demo. Every DOM-family benchmark MUST:

- Drive a rendered UI through real DOM APIs (createElement / appendChild /
  classList / focus / canvas) via the real-DOM stage: the page carries a
  `data-dom-host` attribute naming a module under `/dom-hosts/`, the
  unified-runner loads `/iframe-benchmark-bridge.js`, and the frozen action
  trace is applied to a visible iframe on the page.
- Keep the final rendered UI visible in the iframe after the run, pinned to
  the top of the iframe viewport — the rendered result is inspectable
  evidence, not a hidden side effect.
- Show every applicable engine driving the same real DOM — JavaScript and
  linear Wasm at minimum, plus each multi-language engine from the page's
  manifest — in the real-DOM results table, with the exploratory-measurement
  disclaimer.
- Have DOM-based tests. At minimum: structural assertions that the engine
  emits the expected typed DOM command stream, that the host applies it to a
  real DOM, and that the rendered result matches the oracle (node counts,
  names, states, reuse, focus/selection where the workload defines them).
  A DOM workload whose tests never assert DOM application fails conformance.
- Serve the iframe page with `frame-ancestors 'self'` (never `'none'` — that
  blocks the host page's own iframe).

The audit found 9 of 11 DOM workloads computing models without touching the
DOM. New DOM workloads without a real-DOM stage and DOM tests are
non-conformant at review time, not after the next audit.

### 3. Multi-language comparison is mandatory

Every benchmark MUST either ship the multi-language comparison or carry a
documented exclusion — no silent omissions:

- Kernel-capable workloads (computational core expressible in any language;
  see the scope criterion and wave tables in `docs/multilang-expansion.md`)
  MUST offer the comparison: the identical algorithm in JavaScript, C, C++,
  Rust, AssemblyScript where authored, and Dart/WasmGC, plus hand-written
  WAT wherever it exists (WAT is a first-class variant).
- Sources live in `benchmarks/multilang-wasm/<workload>/`, artifacts are
  built and measured by `scripts/build-multilang-wasm-benchmark.ts`, and
  every variant is verified bit-identical to the workload's existing oracle
  in a `tests/multilang-*.test.ts` before any timing is reported. Never
  create a new oracle for the multilang lane — mirror the pinned one.
- The page wires the comparison through `/multilang-runner.js`: a
  per-workload manifest under `/benchmarks/multilang-wasm/`, a
  `KERNEL_ADAPTERS` entry, and the standard `data-multilang-*` attributes.
  Manifest `engines[]` entries must name artifacts that actually exist —
  if a language has no artifact, drop the engine row (honest absence), never
  point at a missing file.
- DOM-, platform-, or library-bound workloads get a documented exclusion in
  `docs/multilang-expansion.md` — and still get the real-DOM stage
  (requirement 2), which is where their languages are compared.
- After any multilang change: rerun the builder, regenerate routes, and
  re-run the full gate. The report and artifacts are regenerated wholesale;
  committed outputs are `deno fmt`-clean.

## Provenance, binding, and the gate

- Several manifests and evidence records are commit-bound: they pin a
  `sourceCommit` and sha256 hashes of page/source bytes. Editing a bound
  file without rebinding breaks the gate. The flow is two commits: (1) land
  the change, (2) update the pinned commit in the builder + test + manifest
  and regenerate. Never fake the pin.
- `deno.json` and `deno.lock` stay byte-identical unless a change is
  deliberately about dependencies; a failed or interrupted gate can pollute
  `deno.lock` with localhost entries — `git checkout -- .` restores before
  re-running.
- Frozen evidence stays frozen. Pages with byte-pinned browser-validation
  records (audio family) or a "do NOT touch" note in
  `docs/demo-page-consistency.md` (regex-automata-duel-demo,
  vdom-diff-patch-demo) cannot be cosmetically edited without re-recording
  the validation or updating the evidence semantics in the same change.
- The catalog index must tell the truth: every listed demo exists, runs, and
  links resolve; stale "proposal only" rows are conformance bugs.
- `deno task check` must pass on a clean tree AFTER the final commit, not
  just before it. Never push red.

## Public writing

Load and apply the `anti-slop-writing` skill before creating or revising any public page, README, evidence explanation, benchmark description, result summary, or launch copy. Prefer concrete counts, routes, hashes, mechanisms, limits, and observed results. Cut repeated warnings, generic importance claims, formulaic contrasts, marketing language, and prose that implies evidence the project has not collected.

## Working rules

Use one writer per worktree. Workers do not self-review or push. Run `deno task check` before committing. Independently review milestone commits before claiming acceptance.

Publish testable work early. Pause only for secrets, production-resource creation or mutation, private evidence, destructive actions, or material cost. Deno app/KV provisioning requires explicit approval.

Browser validation must exercise visible controls and retain browser version, launch arguments, routes, console/network evidence, assertions, screenshots, and exact owned-process/profile cleanup. Never globally kill Chrome.

Never accept submitted executable benchmark code. Ingestion accepts only closed, versioned result records. Bound request bodies before parsing, authenticate writes, apply durable abuse controls, and never trust CORS as authorization.

## Deployment protocol

Production deploys happen ONLY via the GitHub integration on pushes to
`main`. Never run `deno deploy` CLI against the production project: CLI
deploys shadow the integration deploy and (2026-08-05 incident) the CLI
fails on files >~5MB, so a CLI deploy with `--ignore` silently drops large
artifacts from production (gltf-viewer reference-output.bin, ml-gemm
reference.f64 404'd until a main push restored them).

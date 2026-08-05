# DOM-family real-DOM orchestration (iframe mode)

> Paul's vision for the suite: the DOM workloads exist to measure **JavaScript
> vs WebAssembly interacting with the REAL DOM** — which is better/faster at
> actual web work — not just headless state machines. Workers cannot touch the
> DOM, so the suite runner loads each DOM demo page inside an iframe and
> orchestrates a real in-page benchmark.

Status: **protocol + bridge + TodoMVC host implemented; other DOM workloads
pending hosts.**

## Why an iframe

The homepage suite runner runs workloads in workers (engine-only — the todomvc
card, for example, literally cannot touch the DOM). The dedicated benchmark
pages run in the main thread where the DOM exists. The iframe is the smallest
unit that gives us both: a real page context (real DOM) per workload, isolated
from the suite runner, with a same-origin postMessage channel to drive it.

## Protocol

Same-origin only — the iframe `src` and the parent share the deployment
origin, and both sides check `event.origin` against `location.origin`.

| Direction      | Message                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| parent → child | `{ type: "wvj-benchmark-start", token, iterations, targets: ["js","wasm"], config }`                                                               |
| child → parent | `{ type: "wvj-benchmark-progress", token, target, iteration, total }`                                                                              |
| child → parent | `{ type: "wvj-benchmark-result", token, perTarget: { js: {coldMs,warmMedianMs,minMs,maxMs,samples,detail}, wasm: {...} }, consoleErrors, detail }` |
| child → parent | `{ type: "wvj-benchmark-error", token, message }`                                                                                                  |

Security: tokens are `crypto.randomUUID()` per run; both sides validate the
message shape (`public/dom-hosts/todomvc-ops.js` `validateStartMessage` /
`validateResultMessage`) and the token before acting.

## Files

- `public/iframe-benchmark-bridge.js` — the protocol: `registerIframeHost()`
  (child side; reads `body[data-dom-host]`, dynamic-imports the host) and
  `runIframeDomBenchmark()` (parent side; creates a hidden iframe, posts the
  start message, resolves/rejects on the token-matched reply, cleans up).
- `public/dom-hosts/todomvc-ops.js` — pure, DOM-free helpers (decode, plan,
  stats, message validation) shared by hosts and tests.
- `public/dom-hosts/base-dom-todomvc-journey.js` — the real-DOM TodoMVC host:
  fetches + hash-verifies the pinned package (same loader contract as the
  worker), imports the runtime + fixture via blob URLs, renders an actual
  TodoMVC UI, applies the frozen 150-command trace with real DOM APIs, and
  verifies the rendered DOM (90 items / 30 completed) after each iteration.
- `public/benchmarks/base-dom-todomvc-journey/index.html` — loads the bridge
  and declares `data-dom-host="/dom-hosts/base-dom-todomvc-journey.js"`.
- `public/playground.js` — the TodoMVC card is `domIframe: true`; the suite
  runner branches to `runIframeDomBenchmark`, renders the standard
  JS-vs-Wasm report, and appends an honest disclosure note.

## What is measured (honest boundaries)

- The **engine run** (state machine → 150 typed commands) is the JS-vs-Wasm
  computation under test: `runtime.runJavaScript(encoded)` vs
  `runtime.runWasm(instantiateTodoWasm(wasm), encoded)`, both self-verifying
  the canonical final state before returning.
- The **DOM application** (rendering the TodoMVC UI + applying the commands
  with `createElement`/`appendChild`/`classList`/`focus`) is a **shared JS
  host** for both targets. The measured iteration includes real DOM mutation;
  layout/paint is not forced and is subject to the environment.
- Numbers are **exploratory in-browser measurements**, not corpus evidence.
  They are not posted to the M3 reporting service.

## Workload matrix

| Workload                         | Route                                           | iframe host                             | status                            |
| -------------------------------- | ----------------------------------------------- | --------------------------------------- | --------------------------------- |
| base-dom-todomvc-journey         | `/benchmarks/base-dom-todomvc-journey/`         | `dom-hosts/base-dom-todomvc-journey.js` | **wired + live host**             |
| dom-virtualized-grid-v1          | `/benchmarks/dom-virtualized-grid-v1/`          | —                                       | pending host (paced-trace driver) |
| dom-grid-movement                | `/benchmarks/dom-grid-movement/`                | —                                       | pending host                      |
| dom-keyed-list-mutation          | `/benchmarks/dom-keyed-list-mutation/`          | —                                       | pending host                      |
| dom-nested-tree-mutation         | `/benchmarks/dom-nested-tree-mutation/`         | —                                       | pending host                      |
| dom-table-sort-filter-pagination | `/benchmarks/dom-table-sort-filter-pagination/` | —                                       | pending host                      |
| dom-dependent-form-validation    | `/benchmarks/dom-dependent-form-validation/`    | —                                       | pending host                      |
| dom-virtualized-scrolling        | `/benchmarks/dom-virtualized-scrolling/`        | —                                       | pending host                      |
| game-dom-tactics-grid            | `/demos/game-family/`                           | —                                       | pending host                      |
| image flood-fill / editing       | `/benchmarks/image-*-demo/`                     | —                                       | pending host (pixel work, canvas) |

Each pending workload needs a host module that renders its own UI and applies
its frozen trace with real DOM APIs, mirroring the todomvc host. The protocol
and the `domIframe` card flag make flipping a new host on a one-line change in
`public/playground.js`.

## CSP

The bridge and hosts are CSP-clean under the site's strict
`style-src 'self'` policy: no inline style attributes anywhere (the bridge
uses CSSOM property assignment and the hosts use classes). Page script
loading uses `script-src 'self'`; the runtime import uses the already-allowed
`blob:` source; Wasm uses the already-allowed `wasm-unsafe-eval`.

// Unified Benchmark Runner & Performance Reporting Module
// Standardized execution harness, graphs, tables, and worker controls for all benchmark detail pages.
//
// Every measurement this module produces carries a scope (see
// /measurement-model.js). Ratios are computed inside one scope only.

import {
  classifyDelivery,
  contamination,
  fetchDurationMs,
  fmtBytes,
  fmtMs,
  networkCost,
  ratio,
  resourcesInWindow,
  SCOPE_ORDER,
  SCOPES,
  summarize,
} from "./measurement-model.js";
import {
  amortizationChartSvg,
  barChartSvg,
  csvExportElement,
  decisionPanelHtml,
  deliveryTableHtml,
  icon,
  scopeLegendHtml,
  scopeTableHtml,
  toCsv,
} from "./benchmark-report.js";

export const WORKLOAD_CONFIGS = {
  "sum-u32": {
    workerScript: "/hosted-runner-worker.js",
    protocol: "sum-u32",
  },
  "audio-fft": {
    workerScript: "/demo-worker.js",
    protocol: "demo",
  },
  "audio-fir": {
    workerScript: "/demo-worker.js",
    protocol: "demo",
  },
  "audio-stft": {
    workerScript: "/demo-worker.js",
    protocol: "demo",
  },
  "ml-gemm": {
    workerScript: "/benchmarks/ml-gemm/neural-gemm-worker.js",
    protocol: "neural-gemm",
  },
  "ml-dense-mlp": {
    workerScript: "/benchmarks/ml-dense-mlp/neural-mlp-worker.js",
    protocol: "neural-mlp",
  },
  "vdom-diff-patch-demo": {
    workerScript: "/benchmarks/vdom-diff-patch-demo/worker.js",
    protocol: "traditional-vdom",
    tokenType: "string",
  },
  "image-editing-demo": {
    tokenType: "string",
    workerScript: "/benchmarks/image-demo-worker.js",
    protocol: "image-editing",
  },
  "image-flood-fill-demo": {
    workerScript: "/benchmarks/image-demo-worker.js",
    protocol: "image-flood-fill",
    tokenType: "string",
  },
  "regex-automata-duel-demo": {
    workerScript: "/benchmarks/regex-automata-duel-demo/worker.js",
    protocol: "traditional-regex",
    tokenType: "string",
  },
  "game-canvas-arcade": {
    workerScript: "/benchmarks/game-family/worker.js",
    protocol: "game-family",
    workloadId: "game.canvas-arcade.v1",
  },
  "game-canvas-entity-pathfinding": {
    workerScript: "/benchmarks/game-family/worker.js",
    protocol: "game-family",
    workloadId: "game.canvas-entity-pathfinding.v1",
  },
  "game-dom-tactics-grid": {
    workerScript: "/benchmarks/game-family/worker.js",
    protocol: "game-family",
    workloadId: "game.dom-tactics-grid.v1",
  },
  "text-diff-patch": {
    workerScript: "/text-diff-patch-worker.js",
    protocol: "text-family",
  },
  "text-markdown-cms": {
    workerScript: "/text-markdown-cms-worker.js",
    protocol: "text-family",
  },
  "cad-mesh-repair-v1": {
    workerScript: "/benchmarks/cad-mesh-repair-v1/worker.js",
    protocol: "cad-mesh",
  },
  "database-sqlite-notebook-v1": {
    workerScript: "/sqlite-notebook-worker.js",
    protocol: "sqlite-notebook",
    iterationTimeoutMs: 300000,
    // The worker drives AlaSQL via importScripts, which module workers forbid.
    workerType: "classic",
  },
  "document-pdf-viewer-v1": {
    workerScript: "/benchmarks/document-pdf-viewer-v1/worker.js",
    protocol: "pdf-viewer",
  },
  "base-dom-todomvc-journey": {
    workerScript: "/benchmarks/base-dom-todomvc-journey/worker.js",
    protocol: "todomvc",
  },
  "archive-zip-workspace-v1": {
    workerScript: "/archive-zip-worker.js",
    protocol: "archive-zip",
  },
  "crypto-authenticated-stream": {
    workerScript: "/crypto-authenticated-stream-worker.js",
    protocol: "crypto-stream",
  },
  "graphics-cpu-path-tracer-v1": {
    workerScript: "/benchmarks/graphics-cpu-path-tracer-v1/worker.js",
    protocol: "path-tracer",
  },
  "base-gltf-viewer": {
    workerScript: "/benchmarks/base-gltf-viewer/worker.js",
    protocol: "gltf-viewer",
  },
  "database-olap-chart": {
    workerScript: "/benchmarks/database-olap-chart/worker.js",
    protocol: "olap-chart",
  },
  "dom-virtualized-grid-v1": {
    workerScript: "/benchmarks/dom-virtualized-grid-v1/grid-worker.js",
    protocol: "virtualized-grid",
    ackEvents: true,
  },
  "ml-keyword-spotting-v1": {
    workerScript: "/base-ml-keyword-spotting-worker.js",
    protocol: "keyword-spotting",
  },
  "ml-numeric-kernels-v1": {
    workerScript: "/ml-numeric-kernels-worker.js",
    protocol: "numeric-kernels",
  },
  "numeric-fft-spectral-filter-v1": {
    workerScript: "/benchmarks/numeric-fft-spectral-filter-v1/worker.js",
    protocol: "spectral-filter",
  },
  "serialization-protobuf-gateway": {
    workerScript: "/benchmarks/serialization-protobuf-gateway/protobuf-worker.js",
    protocol: "protobuf",
  },
  "cad-parametric-bracket": {
    workerScript: "/benchmarks/cad-parametric-bracket/worker.js",
    protocol: "bracket",
  },
  "crypto-file-integrity-v1": {
    workerScript: "/crypto-file-integrity-worker.js",
    protocol: "file-integrity",
  },
  "game-ecs-frame-update": {
    workerScript: "/benchmarks/game-ecs-frame-update/worker.js",
    protocol: "ecs-frame",
  },
  "network-pcap-decode-v1": {
    workerScript: "/pcap-decode-worker.js",
    protocol: "pcap",
    tokenType: "string",
  },
  "network-http2-quic-state": {
    workerScript: "/network-http2-quic-state-worker.js",
    protocol: "quic-state",
  },
  "numeric-polybench-panel-v1": {
    workerScript: "/polybench-panel-worker.js",
    protocol: "polybench",
  },
  "serialization-json-telemetry-v1": {
    workerScript: "/telemetry-worker.js",
    protocol: "telemetry",
  },
  "server-ssr-template-v1": {
    workerScript: "/base-server-ssr-worker.js",
    protocol: "server-ssr",
  },
  "text-gc-document-edit-v1": {
    workerScript: "/text-gc-document-edit-worker.js",
    protocol: "document-edit",
    tokenType: "string",
  },
  "base-audio-webaudio-effects-v1": {
    workerScript: "/base-audio-effects-worker.js",
    protocol: "audio-effects",
  },
  "simulation-nbody-cloth": {
    workerScript: "/benchmarks/simulation-nbody-cloth/worker.js",
    protocol: "nbody-cloth",
  },
  "simulation-rigid-body-2d-v1": {
    workerScript: "/benchmarks/simulation-rigid-body-2d-v1/worker.js",
    protocol: "rigid-body",
  },
  "tooling-c-to-wasm-compile-v1": {
    workerScript: "/benchmarks/tooling-c-to-wasm-compile-v1/worker.js",
    protocol: "c-to-wasm",
  },
  "text-regex-log-scan": {
    workerScript: "/benchmarks/base/text.regex-log-scan.v1/worker.js",
    protocol: "text-regex",
  },
  "dom-dependent-form-validation": {
    workerScript: "/benchmarks/dom-dependent-form-validation/worker.js",
    protocol: "form-validation",
  },
  "dom-grid-movement": {
    workerScript: "/benchmarks/dom-grid-movement/worker.js",
    protocol: "grid-movement",
  },
  "dom-keyed-list-mutation": {
    workerScript: "/benchmarks/dom-keyed-list-mutation/worker.js",
    protocol: "keyed-list",
  },
  "dom-nested-tree-mutation": {
    workerScript: "/benchmarks/dom-nested-tree-mutation/worker.js",
    protocol: "nested-tree",
  },
  "dom-table-sort-filter-pagination": {
    workerScript: "/benchmarks/dom-table-sort-filter-pagination/worker.js",
    protocol: "table-sort",
  },
  "dom-virtualized-scrolling": {
    workerScript: "/benchmarks/dom-virtualized-scrolling/worker.js",
    protocol: "virtualized-scrolling",
  },
};

// Map target name per protocol family
export function formatTargetPayload(slug, target) {
  const isWasm = target === "wasm" || target === "wasm-linear" ||
    target === "wasm-linear-controlled";
  const config = WORKLOAD_CONFIGS[slug] || {};
  const { protocol, workloadId } = config;

  switch (protocol) {
    case "neural-gemm":
    case "neural-mlp":
      return {
        type: "run",
        target: isWasm ? "wasm-linear-controlled" : "js-controlled",
        mode: "validation",
      };
    case "traditional-vdom":
      return { type: "run", target: isWasm ? "wasm-linear-controlled" : "js-controlled" };
    case "traditional-regex":
      return {
        type: "run",
        target: isWasm ? "wasm-automata-controlled" : "js-automata-controlled",
      };
    case "image-editing":
      return {
        type: "run",
        demoId: slug,
        route: "/benchmarks/image-editing-demo/",
        target: isWasm ? "wasm-linear" : "javascript",
      };
    case "image-flood-fill":
      return {
        type: "run",
        demoId: slug,
        route: "/benchmarks/image-flood-fill-demo/",
        target: isWasm ? "wasm-linear" : "javascript",
      };
    case "game-family":
      return {
        type: "start",
        workloadId,
        variantId: isWasm ? "wasm-linear-controlled" : "js-controlled",
      };
    case "todomvc":
      return { type: "start", variantId: isWasm ? "wasm-linear-controlled" : "js-controlled" };
    case "olap-chart":
      return { type: "start", variantId: isWasm ? "wasm-linear-controlled" : "js-controlled" };
    case "bracket":
      return { type: "start", variantId: isWasm ? "wasm-linear-controlled" : "js-controlled" };
    case "ecs-frame":
      return { type: "start", variantId: isWasm ? "wasm-linear-controlled" : "js-controlled" };
    case "nbody-cloth":
      return { type: "start", variantId: isWasm ? "wasm-linear-controlled" : "js-controlled" };
    case "crypto-stream":
      return { variant: isWasm ? "wasm-linear-controlled" : "js-controlled", mode: "bounded" };
    case "file-integrity":
      // The worker's own defaults are outside its registered sets, so the
      // playground must name a registered fixture explicitly.
      return {
        target: isWasm ? "wasm-linear-controlled" : "js-controlled",
        kind: "seeded-pseudorandom",
        byteLength: 1 << 20,
        schedule: 1024,
      };
    case "protobuf":
      return { target: isWasm ? "wasm-linear-controlled" : "js-controlled" };
    case "keyword-spotting":
      // Empty files: the worker fetches and hash-verifies the bundled pinned fixture.
      return { target: isWasm ? "wasm-linear" : "javascript", mode: "exact", files: [] };
    case "pdf-viewer":
      return { type: "start", target: isWasm ? "wasm-linear" : "javascript" };
    case "server-ssr":
    case "spectral-filter":
      return {
        type: "start",
        target: isWasm ? "wasm-linear-controlled" : "js-controlled",
      };
    case "audio-effects":
      return { target: isWasm ? "wasm-linear" : "javascript" };
    case "document-edit":
      return { target: isWasm ? "wasmgc-controlled" : "js-controlled" };
    case "pcap":
      return { target: isWasm ? "wasm-linear-controlled" : "js-controlled" };
    case "quic-state":
      return { target: isWasm ? "wasm" : "js" };
    case "polybench":
      return { target: isWasm ? "wasm" : "javascript", kernel: "all" };
    case "telemetry":
      return {
        values: {
          variant: isWasm ? "wasm-linear-controlled" : "js-controlled",
          mode: "bounded",
          records: 1000,
        },
      };
    case "text-regex":
      return { variant: isWasm ? "wasm-linear-controlled" : "js-controlled" };
    case "form-validation":
    case "grid-movement":
    case "keyed-list":
    case "nested-tree":
    case "table-sort":
    case "virtualized-scrolling":
      return { type: "run", target: isWasm ? "wasm" : "javascript" };
    case "virtualized-grid":
      return {
        type: "start",
        variantId: isWasm ? "wasm-linear-controlled" : "js-controlled",
      };
    case "rigid-body":
      return { type: "run", target: isWasm ? "wasm-linear" : "javascript" };
    case "c-to-wasm":
      return { target: isWasm ? "wasm" : "javascript", program: "01" };
    case "sqlite-notebook":
      // manifest + shellChecks are merged in from the async prepared payload.
      return {
        type: "run",
        target: isWasm ? "linear-wasm-controlled" : "javascript-controlled",
        queryId: null,
        exact: false,
      };
    case "archive-zip":
      return { target: isWasm ? "wasm" : "javascript", mode: "full" };
    case "path-tracer":
      // "preview" (64×64 @ 4spp) is the only non-exact mode the worker accepts.
      return { target: isWasm ? "wasm-linear" : "javascript", mode: "preview" };
    case "gltf-viewer":
      return { type: "run", target: isWasm ? "wasm" : "javascript", mode: "bounded" };
    case "demo":
      return { slug, target: isWasm ? "wasm-linear" : "javascript", mode: "bounded" };
    case "text-family": {
      const variant = isWasm ? "wasm-linear-controlled" : "js-controlled";
      if (slug === "text-diff-patch") {
        return {
          values: {
            variant,
            base: "alpha\nbravo\ncharlie\ndelta\n",
            target: "alpha\nbravo changed\ncharlie\n",
          },
        };
      }
      return {
        values: {
          variant,
          source: "# Playground probe\n\nA **small** deterministic markdown document.\n",
        },
      };
    }
    default:
      return { target: isWasm ? "wasm" : "javascript" };
  }
}

// ── Worker measurement ────────────────────────────────────────────────────
//
// The previous implementation constructed a `new Worker()` inside the timed
// region of every iteration, and the workers re-fetch their .wasm and fixtures
// on each run. So every sample carried worker boot + module fetch + compile +
// instantiate, "cold" meant the first of N equally cold iterations, and the
// warm median was the median of those same contaminated samples. On
// ml-dense-mlp that reported 76.83 ms for JavaScript against 4.89 ms measured
// on the same kernel by the multi-language lane.
//
// Now: first use is measured once, on its own worker, and reported as the
// delivery scope. Steady state is measured on a single reused worker after
// discarded warm-up runs, and reported as the pipeline scope. Neither number
// is folded into the other.

const WARMUP_RUNS = 2;
const REUSE_PROBE_TIMEOUT_MS = 20000;

function isWasmTarget(target) {
  return target === "wasm" || target === "wasm-linear" || target === "wasm-linear-controlled";
}

function makeToken(config) {
  return config.tokenType === "string" ? crypto.randomUUID() : Math.floor(Math.random() * 1000000);
}

/**
 * Post one task to an existing worker and resolve when it reports completion.
 * Listeners are attached per task and removed on settle, so one worker can
 * serve many sequential tasks.
 */
function postTask(worker, payload, config, timeoutMs) {
  return new Promise((resolve, reject) => {
    const token = makeToken(config);
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      fn(value);
    };
    const timer = setTimeout(
      () => finish(reject, new Error(`worker task timed out after ${timeoutMs} ms`)),
      timeoutMs,
    );
    const startTime = performance.now();
    const onMessage = (event) => {
      const msg = event.data;
      if (!msg) return;
      // Interactive trace workers pace actions and wait for an ack per event.
      if (config.ackEvents && msg.type === "event" && msg.actionIndex !== undefined) {
        worker.postMessage({ type: "ack", token: msg.token, actionIndex: msg.actionIndex });
        return;
      }
      if (msg.token !== undefined && msg.token !== token) return;
      if (
        msg.type === "completed" || msg.type === "done" || msg.type === "complete" ||
        msg.type === "result" || msg.ok === true
      ) {
        finish(resolve, { ms: performance.now() - startTime, result: msg.result ?? null });
      } else if (msg.type === "failed" || msg.type === "error" || msg.ok === false) {
        finish(
          reject,
          new Error(msg.message || msg.error || msg.detail || "worker execution failed"),
        );
      }
    };
    const onError = (err) => finish(reject, new Error(err.message || "worker error event"));
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage({ token, ...payload });
  });
}

function spawnWorker(config) {
  return new Worker(config.workerScript, { type: config.workerType || "module" });
}

/** Resource entries recorded while `fn` ran, attributed by start time. */
async function withResourceWindow(fn) {
  const start = performance.now();
  const value = await fn();
  const end = performance.now();
  const entries = typeof performance !== "undefined" && performance.getEntriesByType
    ? resourcesInWindow(performance.getEntriesByType("resource"), start, end)
    : [];
  return { value, entries, windowMs: end - start };
}

/**
 * Measure one workload/target pair.
 *
 * Returns the legacy `coldMs`/`warmMedianMs`/`samples` fields that
 * playground.js still reads, plus scoped summaries the report renders from.
 */
async function executeWorkerLoop(
  slug,
  target,
  iterations = 30,
  /** @type {(p: { phase: string, target: string, iteration: number, total: number }) => void} */
  onProgress = () => {},
) {
  const config = WORKLOAD_CONFIGS[slug];
  if (!config || !config.workerScript) {
    throw new Error(`Worker configuration missing for ${slug}`);
  }

  async function prepareSqliteRuntime() {
    const response = await fetch("/assets/sqlite-notebook/runtime-manifest.json", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`runtime manifest returned ${response.status}`);
    const manifestBytes = new Uint8Array(await response.arrayBuffer());
    const digest = await crypto.subtle.digest("SHA-256", manifestBytes);
    const manifestHash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    return { manifest, shellChecks: [`runtime-manifest:${manifestHash}`] };
  }

  // sum-u32 batches its own iterations inside hosted-runner-worker.
  if (slug === "sum-u32") {
    const wasm = isWasmTarget(target);
    const res = await new Promise((resolve, reject) => {
      let worker;
      try {
        worker = new Worker(config.workerScript, { type: "module" });
      } catch (err) {
        return reject(err);
      }
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("sum-u32 worker timed out after 120s"));
      }, 120000);
      worker.onmessage = (event) => {
        const msg = event.data;
        if (msg?.type === "complete") {
          clearTimeout(timer);
          worker.terminate();
          resolve(msg.result);
        } else if (msg?.type === "error") {
          clearTimeout(timer);
          worker.terminate();
          reject(new Error(msg.message || "sum-u32 worker error"));
        }
      };
      worker.onerror = (err) => {
        clearTimeout(timer);
        worker.terminate();
        reject(err);
      };
      worker.postMessage({ iterations, order: "js-first", serviceWorkerControlled: false });
    });
    const stats = wasm ? res.wasm : res.js;
    const firstMs = wasm ? res.lifecycle?.wasmFirstExecuteMs : res.lifecycle?.jsFirstExecuteMs;
    const pipeline = summarize(stats.samples, { scope: "pipeline", label: target });
    return {
      coldMs: firstMs ?? stats.medianMs,
      warmMedianMs: stats.medianMs,
      minMs: Math.min(...stats.samples),
      maxMs: Math.max(...stats.samples),
      samples: stats.samples,
      iterations: stats.count,
      pipelineSummary: pipeline,
      kernelSummary: null,
      firstUse: {
        totalMs: firstMs ?? null,
        network: networkCost([]),
        entries: [],
      },
      workerReuse: "batched-in-worker",
      contamination: contamination(pipeline?.p50Ms, 0),
      networkAssets: [],
      lastResult: res,
    };
  }

  // Heavy workloads run fewer timed samples; the reduction is reported, not silent.
  const heavyWorkloads = [
    "dom-virtualized-grid-v1",
    "graphics-cpu-path-tracer-v1",
    "base-gltf-viewer",
    "database-sqlite-notebook-v1",
  ];
  const isHeavy = heavyWorkloads.includes(slug);
  const timedRuns = isHeavy ? Math.min(iterations, 5) : iterations;
  const iterationTimeoutMs = config.iterationTimeoutMs || 120000;

  if (config.protocol === "sqlite-notebook" && !config.prepared) {
    config.prepared = await prepareSqliteRuntime();
  }
  const payload = { ...formatTargetPayload(slug, target), ...(config.prepared || {}) };

  // ── First use: one worker, one task, everything counted ─────────────────
  onProgress({ phase: "first-use", target, iteration: 0, total: timedRuns });
  const firstWorker = spawnWorker(config);
  let firstUseMs = null;
  let firstResult = null;
  let firstEntries = [];
  try {
    const measured = await withResourceWindow(() =>
      postTask(firstWorker, payload, config, iterationTimeoutMs)
    );
    firstUseMs = measured.value.ms;
    firstResult = measured.value.result;
    firstEntries = measured.entries;
  } finally {
    firstWorker.terminate();
  }

  // ── Steady state: one reused worker, warm-ups discarded ─────────────────
  const durations = [];
  const computeDurations = [];
  let lastResult = firstResult;
  let workerReuse = "reused";
  let warmEntries = [];

  const warmWindow = await withResourceWindow(async () => {
    let worker = spawnWorker(config);
    try {
      for (let i = 0; i < WARMUP_RUNS; i++) {
        try {
          await postTask(
            worker,
            payload,
            config,
            i === 0 ? REUSE_PROBE_TIMEOUT_MS : iterationTimeoutMs,
          );
        } catch (err) {
          // A worker that will not serve a second task is a one-shot worker.
          // Fall back to a fresh worker per iteration and say so in the report
          // rather than silently reporting boot cost as steady-state cost.
          if (i > 0) {
            workerReuse = "respawned-per-iteration";
            break;
          }
          throw err;
        }
      }
      for (let i = 0; i < timedRuns; i++) {
        if (workerReuse === "respawned-per-iteration") {
          worker.terminate();
          worker = spawnWorker(config);
        }
        const { ms, result } = await postTask(worker, payload, config, iterationTimeoutMs);
        durations.push(ms);
        if (result) {
          lastResult = result;
          const computeTime = extractComputeMs(result, target);
          if (typeof computeTime === "number" && Number.isFinite(computeTime)) {
            computeDurations.push(computeTime);
          }
        }
        onProgress({ phase: "steady", iteration: i + 1, total: timedRuns, target });
      }
    } finally {
      worker.terminate();
    }
  });
  warmEntries = warmWindow.entries;

  const pipelineSummary = summarize(durations, { scope: "pipeline", label: target });
  const kernelSummary = summarize(computeDurations, {
    scope: "kernel",
    label: target,
    note: "reported by the worker for its own compute region",
  });
  const warmNetwork = networkCost(warmEntries);
  const firstNetwork = networkCost(firstEntries);

  return {
    // Legacy fields — playground.js and older callers read these.
    coldMs: firstUseMs,
    warmMedianMs: pipelineSummary ? pipelineSummary.p50Ms : firstUseMs,
    minMs: pipelineSummary ? pipelineSummary.minMs : firstUseMs,
    maxMs: pipelineSummary ? pipelineSummary.maxMs : firstUseMs,
    samples: durations,
    computeMedianMs: kernelSummary ? kernelSummary.p50Ms : null,
    computeSamples: computeDurations.length > 0 ? computeDurations : null,
    iterations: durations.length,
    // Scoped measurements.
    pipelineSummary,
    kernelSummary,
    firstUse: {
      totalMs: firstUseMs,
      network: firstNetwork,
      entries: firstEntries,
    },
    workerReuse,
    reducedSampleCount: isHeavy && iterations > timedRuns
      ? { requested: iterations, taken: timedRuns, reason: "heavy workload" }
      : null,
    contamination: contamination(
      pipelineSummary?.p50Ms,
      warmNetwork.wallMs / Math.max(1, durations.length),
    ),
    warmNetwork,
    networkAssets: warmEntries.map((r) => ({
      name: r.name.split("/").pop()?.split("?")[0] || r.name,
      fullUrl: r.name,
      transferBytes: r.transferSize || 0,
      decodedBytes: r.decodedBodySize || 0,
      durationMs: fetchDurationMs(r),
      delivery: classifyDelivery(r),
    })),
    lastResult,
  };
}

/**
 * Pull the worker's own report of its compute region, if it publishes one.
 *
 * Only fields the worker contract actually defines are read. An absent
 * measurement returns null so the kernel scope stays empty rather than
 * borrowing the pipeline number.
 */
function extractComputeMs(res, target) {
  if (!res || typeof res !== "object") return null;
  const branch = isWasmTarget(target) ? res.wasm : res.js;
  const candidates = [
    branch?.ms,
    res.computeMs,
    res.executionMs,
    res.durationMs,
    res.ms,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
    if (typeof c === "string") {
      const n = parseFloat(c);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

// ── Primary report ────────────────────────────────────────────────────────
//
// One table per scope. The pipeline table and the kernel table never share a
// ratio column, because they do not measure the same thing.

/** Build the per-scope row set for the JS/Wasm primary pair. */
export function primaryScopeRows(jsStats, wasmStats) {
  return {
    pipeline: [
      { label: "JavaScript", summary: jsStats?.pipelineSummary ?? null, toolchain: "V8 JIT" },
      {
        label: "WebAssembly",
        summary: wasmStats?.pipelineSummary ?? null,
        toolchain: "wasm32 linear memory",
      },
    ],
    kernel: [
      { label: "JavaScript", summary: jsStats?.kernelSummary ?? null, toolchain: "V8 JIT" },
      {
        label: "WebAssembly",
        summary: wasmStats?.kernelSummary ?? null,
        toolchain: "wasm32 linear memory",
      },
    ],
  };
}

function firstUseRowsHtml(jsStats, wasmStats) {
  const rows = [
    { label: "JavaScript", stats: jsStats },
    { label: "WebAssembly", stats: wasmStats },
  ].filter((r) => r.stats?.firstUse);
  if (rows.length === 0) return "";
  const body = rows.map((r) => {
    const fu = r.stats.firstUse;
    const net = fu.network;
    return `<tr>
      <th scope="row">${r.label}</th>
      <td class="num">${fmtMs(fu.totalMs)}</td>
      <td class="num">${fmtMs(net.wallMs)}</td>
      <td class="num">${fmtBytes(net.transferBytes)}</td>
      <td class="num">${fmtBytes(net.decodedBytes)}</td>
      <td class="num">${net.count} <small class="muted">(${net.cacheHits} cached)</small></td>
    </tr>`;
  }).join("");
  return `<div class="table-wrap">
    <table class="results-table">
      <caption>First use — one task on a freshly spawned worker, everything counted</caption>
      <thead><tr>
        <th scope="col">Engine</th>
        <th scope="col">First task, end to end</th>
        <th scope="col">of which network</th>
        <th scope="col">Wire bytes</th>
        <th scope="col">Decoded bytes</th>
        <th scope="col">Requests</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function methodNoteHtml(jsStats, wasmStats) {
  const notes = [];
  const reuse = wasmStats?.workerReuse ?? jsStats?.workerReuse;
  if (reuse === "respawned-per-iteration") {
    notes.push(
      "This workload's worker serves one task and exits, so each steady-state sample includes a " +
        "fresh worker boot and module load. The pipeline numbers below are an upper bound on the " +
        "task cost, not a steady-state cost.",
    );
  } else if (reuse === "reused") {
    notes.push(
      `Steady-state samples ran on a single reused worker after ${WARMUP_RUNS} discarded warm-up ` +
        "tasks, so worker boot and module load are charged to first use and not to each sample.",
    );
  }
  const reduced = jsStats?.reducedSampleCount ?? wasmStats?.reducedSampleCount;
  if (reduced) {
    notes.push(
      `Sample count reduced from ${reduced.requested} to ${reduced.taken} (${reduced.reason}).`,
    );
  }
  if (notes.length === 0) return "";
  return `<p class="notice">${icon("info")} ${notes.map((n) => n).join(" ")}</p>`;
}

/**
 * Render the primary JS-vs-Wasm result: decision panel, scope legend, one
 * table per available scope, delivery detail, and charts.
 */
/**
 * Render the primary JS-vs-Wasm evidence: what the run cost on first use, and
 * what it fetched to get there.
 *
 * The scope tables, charts and decision panel are drawn by the unified
 * explorer after every stage has reported — rendering them here as well
 * produced two "Task pipeline" tables, and a decision panel built before the
 * multi-language lane had contributed any kernel-scope evidence.
 */
function renderPerformanceReport(container, jsStats, wasmStats) {
  const rows = primaryScopeRows(jsStats, wasmStats);
  const available = [];
  if (jsStats?.firstUse || wasmStats?.firstUse) available.push("delivery");
  if (rows.kernel.some((r) => r.summary)) available.push("kernel");
  if (rows.pipeline.some((r) => r.summary)) available.push("pipeline");

  container.innerHTML = scopeLegendHtml(available) +
    methodNoteHtml(jsStats, wasmStats) +
    firstUseRowsHtml(jsStats, wasmStats) +
    deliveryTableHtml([
      { label: "JavaScript", entries: jsStats?.firstUse?.entries ?? [] },
      { label: "WebAssembly", entries: wasmStats?.firstUse?.entries ?? [] },
    ]);
  container.hidden = false;
}

// Auto-initialize benchmark detail page runner
// ── Unified "Run Everything" flow ────────────────────────────────────────
// One run control drives every stage the page supports: the primary JS-vs-Wasm
// pair, then the multi-language comparison (all engines), then the Track B
// optimized variants. Pure plan helper (testable without a DOM).
export function composedStagePlan(meta = {}) {
  const plan = {
    primary: Boolean(meta.workload || meta.demo),
    multilangManifest: meta.multilangManifest ?? null,
    trackBRoot: meta.trackBRoot ?? null,
    libcmp: Boolean(meta.libcmp),
    libcmpEngines: Array.isArray(meta.libcmpEngines) ? meta.libcmpEngines : [],
  };
  return plan;
}

function composedStagePlanFromDom() {
  const body = document.body;
  const trackBRoot = document.querySelector("#track-b-root")
    ? "#track-b-root"
    : document.querySelector("#trackb-root")
    ? "#trackb-root"
    : null;
  let libcmpEngines = [];
  if (body?.dataset?.libcmpEngines) {
    try {
      libcmpEngines = JSON.parse(body.dataset.libcmpEngines);
    } catch {
      libcmpEngines = [];
    }
  }
  return composedStagePlan({
    workload: body?.dataset?.workload,
    demo: body?.dataset?.demo,
    multilangManifest: body?.dataset?.multilangManifest ?? null,
    trackBRoot,
    libcmp: body?.dataset?.libcmp,
    libcmpEngines,
  });
}

// Static multi-language pre-render (Paul directive 2026-08-06): every benchmark
// page shows its measured multi-language comparison IMMEDIATELY (from the
// committed report), not only after clicking Run. Run refreshes the numbers.
async function renderReportedComparison(flowEl, manifestPath) {
  const manifestResp = await fetch(manifestPath, { cache: "no-store" });
  if (!manifestResp.ok) return;
  const manifest = await manifestResp.json();
  const reportResp = await fetch("/data/multilang-wasm-benchmark-report.v1.json", {
    cache: "no-store",
  });
  if (!reportResp.ok) return;
  const report = await reportResp.json();
  const entry = report.workloads?.find((w) =>
    manifest.kernels?.length === 1 &&
    (w.name === manifest.workloadId ||
      w.name === manifestPath.split("/").pop().replace(".manifest.json", ""))
  );
  const variants = entry?.variants;
  if (!variants || variants.length === 0) return;
  const mlSection = document.querySelector('section[aria-labelledby="ml-heading"]') ||
    document.querySelector('section[aria-labelledby="multilang-run-heading"]');
  const targetHost = mlSection || flowEl;
  const previous = targetHost.querySelector(`[data-stage="multilang"]`);
  if (previous) previous.remove();
  const wrap = document.createElement("section");
  wrap.dataset.stage = "multilang";
  wrap.className = "stage-result";
  const h = document.createElement("h3");
  h.textContent = "Multi-language comparison (committed measured results)";
  wrap.appendChild(h);
  const note = document.createElement("p");
  note.className = "notice";
  note.textContent = "Shown from the committed report; click Run to re-measure in this browser.";
  wrap.appendChild(note);
  const table = document.createElement("table");
  table.className = "mlr-table";
  table.innerHTML =
    "<thead><tr><th class='mlr-th mlr-th-header'>Engine</th><th class='mlr-th mlr-th-header'>Source &amp; Toolchain</th><th class='mlr-th mlr-th-header'>Warm median</th><th class='mlr-th mlr-th-header'>Wasm bytes</th></tr></thead><tbody>" +
    variants.map((v) => {
      const engine = manifest.engines?.find((e) =>
        e.label === v.language ||
        e.key === v.language.toLowerCase().split("/")[0].trim() ||
        (v.language.includes("C++") && e.key === "cpp") ||
        (v.language.includes("Rust") && e.key === "rs") ||
        (v.language.includes("Dart") && e.key === "dart") ||
        (v.language.includes("WAT") && e.key === "wat") ||
        (v.language.includes("AssemblyScript") && e.key === "as") ||
        (v.language.includes("C ") && e.key === "c")
      );
      let srcLink = "";
      if (engine?.source) {
        const name = engine.source.split("/").pop();
        srcLink =
          `<a class="commit-link" href="/${engine.source}" target="_blank" rel="noopener">${name}</a>`;
      }
      return `<tr><td class="mlr-th"><strong>${v.language}</strong></td>` +
        `<td class="mlr-th">${srcLink ? `<div>${srcLink}</div>` : ""}<div><small><code>${
          v.toolchain ?? "—"
        }</code></small></div></td>` +
        `<td class="mlr-th">${
          typeof v.warmExecutionMs === "number" ? v.warmExecutionMs.toFixed(2) + " ms" : "—"
        }</td>` +
        `<td class="mlr-th">${
          v.binarySizeBytes > 0 ? v.binarySizeBytes.toLocaleString() + " B" : "—"
        }</td></tr>`;
    }).join("") + "</tbody>";
  wrap.appendChild(table);
  targetHost.appendChild(wrap);
}

// Static Track B pre-render: pages with a track-b section show the committed
// A-vs-B comparison immediately (Paul directive 2026-08-06).
async function renderReportedTrackB(flowEl, workloadSlug) {
  const resp = await fetch("/data/track-b-report.v1.json", { cache: "no-store" });
  if (!resp.ok) return;
  const report = await resp.json();
  const entry = report.workloads?.find((w) =>
    w.workloadId === workloadSlug || w.workloadId?.includes(workloadSlug) ||
    workloadSlug.includes(w.workloadId ?? "")
  );
  if (!entry?.languages || entry.languages.length === 0) return;
  const previous = flowEl.querySelector(`[data-stage="trackb"]`);
  if (previous) previous.remove();
  const wrap = document.createElement("section");
  wrap.dataset.stage = "trackb";
  wrap.className = "stage-result";
  const h = document.createElement("h3");
  h.textContent = "Track A vs Track B — independent optimization (committed measured results)";
  wrap.appendChild(h);
  const note = document.createElement("p");
  note.className = "notice";
  note.textContent =
    "Track A baselines are frozen and never modified; Track B variants are independent optimizations. Click Run to re-measure.";
  wrap.appendChild(note);
  const table = document.createElement("table");
  table.className = "mlr-table";
  table.innerHTML =
    "<thead><tr><th class='mlr-th mlr-th-header'>Engine</th><th class='mlr-th mlr-th-header'>Baseline (A)</th><th class='mlr-th mlr-th-header'>Optimized (B)</th><th class='mlr-th mlr-th-header'>Delta</th></tr></thead><tbody>" +
    entry.languages.map((l) => {
      const a = l.baselineMs, b = l.optimizedMs;
      const delta = (typeof a === "number" && typeof b === "number" && a > 0)
        ? ((b - a) / a * 100).toFixed(1) + "%"
        : "—";
      return `<tr><td class="mlr-th"><strong>${l.language}</strong></td>` +
        `<td class="mlr-th">${typeof a === "number" ? a.toFixed(2) + " ms" : "—"}</td>` +
        `<td class="mlr-th">${typeof b === "number" ? b.toFixed(2) + " ms" : "—"}</td>` +
        `<td class="mlr-th">${delta}</td></tr>`;
    }).join("") + "</tbody>";
  wrap.appendChild(table);
  flowEl.appendChild(wrap);
}

async function runComposedStages(
  { workloadSlug, iterations, statusEl, reportingEl, primaryStats = null },
) {
  const plan = composedStagePlanFromDom();
  plan.domHost = document.body?.dataset?.domHost || "";
  // Results each stage produces, collected for the unified explorer. These
  // were previously referenced at the call site without ever being declared,
  // so every composed run threw `multilangResults is not defined` and the
  // explorer never rendered.
  let multilangResults = null;
  let multilangManifest = null;
  let domResults = null;
  // ONE results flow: every additional stage (multi-language, Track B) renders
  // as a labeled sub-block of the SAME run output inside the primary reporting
  // element — not a separate page section (Paul directive 2026-08-06).
  const flowEl = reportingEl ?? document.querySelector("#main") ?? document.body;
  const stageBlock = (stage, heading) => {
    const previous = flowEl.querySelector(`[data-stage="${stage}"]`);
    if (previous) previous.remove();
    const wrap = document.createElement("section");
    wrap.dataset.stage = stage;
    wrap.className = "stage-result";
    const h = document.createElement("h3");
    h.textContent = heading;
    wrap.appendChild(h);
    const box = document.createElement("div");
    wrap.appendChild(box);
    flowEl.appendChild(wrap);
    return box;
  };
  if (plan.multilangManifest) {
    statusEl.textContent = "Multi-language comparison: loading engines…";
    const { runMultilangComparison } = await import("./multilang-runner.js");
    const mlBox = stageBlock("multilang", "Multi-language comparison");
    multilangResults = await runMultilangComparison(plan.multilangManifest, {
      iterations,
      onStatus: (m) => {
        statusEl.textContent = `Multi-language: ${m}`;
      },
      // No table here: the explorer's kernel-scope table renders these same
      // measurements once, with confidence intervals and a shared baseline.
      reportingEl: null,
      heading: false,
    });
    mlBox.closest("[data-stage]")?.remove();
    try {
      const r = await fetch(plan.multilangManifest, { cache: "no-store" });
      if (r.ok) multilangManifest = await r.json();
    } catch {
      multilangManifest = null;
    }
    statusEl.textContent = "Multi-language comparison complete.";
  }
  if (plan.domHost) {
    // Real-DOM stage (Paul directive 2026-08-06): DOM-family pages must
    // actually drive a rendered UI — not just run the model engine. The page
    // loads itself in a hidden same-origin iframe; the iframe registers its
    // dom host (data-dom-host) and applies the frozen action trace to the
    // real DOM with real DOM APIs.
    const iframeNote = document.createElement("p");
    iframeNote.className = "notice";
    iframeNote.textContent =
      "Real-DOM iframe run: the page loaded itself in the VISIBLE iframe below, rendered an actual UI, and applied the frozen action trace with real DOM APIs (createElement/appendChild/classList/focus). The host verifies the rendered DOM against the oracle. Why the different scopes? The primary run measures the engine worker (including per-iteration evidence hashing); this stage measures the full render-and-drive journey in the real DOM; the multi-language section measures the bare kernel — three different scopes, shown honestly side by side.";
    const domBox = stageBlock("real-dom", "Real-DOM iframe run");
    domBox.appendChild(iframeNote);
    const liveCaption = document.createElement("p");
    liveCaption.className = "dom-live-caption";
    liveCaption.textContent = "Loading the page into the frame below…";
    domBox.appendChild(liveCaption);
    const iframeContainer = document.createElement("div");
    iframeContainer.setAttribute("data-wvj-visible-host", "1");
    iframeContainer.className = "dom-live-frame";
    domBox.appendChild(iframeContainer);
    statusEl.textContent = "Real-DOM run: loading the demo page in an iframe…";
    const engineLabels = {
      js: "JavaScript",
      wasm: "WebAssembly",
      c: "C / Wasm",
      cpp: "C++ / Wasm",
      rs: "Rust / Wasm",
      dart: "Dart / WasmGC",
    };
    const { runIframeDomBenchmark } = await import("./iframe-benchmark-bridge.js");
    let realDomTargets = ["js", "wasm"];
    // Multi-language engines drive the SAME real DOM (Paul directive
    // 2026-08-07): include every engine from the page's multilang manifest
    // so the WASM->JS->DOM interaction is measured per language.
    const mlManifestPath = document.body?.dataset?.multilangManifest;
    if (mlManifestPath) {
      try {
        const mlManifest = await (await fetch(mlManifestPath, { cache: "no-store" })).json();
        const engineKeys = (mlManifest.engines ?? [])
          .map((e) => e.key)
          .filter((k) => ["c", "cpp", "rs", "dart"].includes(k));
        realDomTargets = [...realDomTargets, ...engineKeys];
      } catch {
        // keep js+wasm if the manifest is unavailable
      }
    }
    try {
      const result = domResults = await runIframeDomBenchmark({
        route: `${globalThis.location.pathname}${globalThis.location.search}`,
        iterations,
        targets: realDomTargets,
        timeoutMs: 240000,
        visible: true,
        keepAlive: true,
        container: iframeContainer,
        onProgress: ({ target, iteration, total }) => {
          const label = engineLabels[target] ?? (target === "js" ? "JavaScript" : "WebAssembly");
          liveCaption.textContent =
            `Driving the real DOM now: ${label} — journey ${iteration} of ${total}`;
          liveCaption.dataset.engine = target;
          statusEl.textContent = `Real-DOM run: ${label} — iteration ${iteration}/${total}…`;
        },
      });
      liveCaption.textContent =
        "Run complete. The frame below holds the final rendered DOM, left in place as evidence.";
      delete liveCaption.dataset.engine;
      const jsStats = result.perTarget.js;
      const wasmStats = result.perTarget.wasm;
      const rows = [];
      if (jsStats) {
        rows.push(
          `<tr><td class="mlr-th"><strong>JavaScript (real DOM)</strong></td><td class="mlr-th">${
            jsStats.coldMs.toFixed(2)
          } ms</td><td class="mlr-th">${
            jsStats.warmMedianMs.toFixed(2)
          } ms</td><td class="mlr-th">${jsStats.minMs.toFixed(2)} ms</td><td class="mlr-th">${
            jsStats.maxMs.toFixed(2)
          } ms</td><td class="mlr-th"><strong>1.00× (Baseline)</strong></td></tr>`,
        );
      }
      if (wasmStats) {
        rows.push(
          `<tr><td class="mlr-th"><strong>WebAssembly (real DOM)</strong></td><td class="mlr-th">${
            wasmStats.coldMs.toFixed(2)
          } ms</td><td class="mlr-th">${
            wasmStats.warmMedianMs.toFixed(2)
          } ms</td><td class="mlr-th">${wasmStats.minMs.toFixed(2)} ms</td><td class="mlr-th">${
            wasmStats.maxMs.toFixed(2)
          } ms</td><td class="mlr-th"><strong>${
            jsStats ? (jsStats.warmMedianMs / wasmStats.warmMedianMs).toFixed(2) : "—"
          }×</strong></td></tr>`,
        );
      }
      // Multi-language engines that drove the SAME DOM (Paul directive 2026-08-07).
      for (const key of ["c", "cpp", "rs", "dart"]) {
        const stats = result.perTarget[key];
        if (!stats) continue;
        rows.push(
          `<tr><td class="mlr-th"><strong>${
            engineLabels[key]
          } (real DOM)</strong></td><td class="mlr-th">${
            stats.coldMs.toFixed(2)
          } ms</td><td class="mlr-th">${stats.warmMedianMs.toFixed(2)} ms</td><td class="mlr-th">${
            stats.minMs.toFixed(2)
          } ms</td><td class="mlr-th">${stats.maxMs.toFixed(2)} ms</td><td class="mlr-th"><strong>${
            jsStats ? (jsStats.warmMedianMs / stats.warmMedianMs).toFixed(2) : "—"
          }×</strong></td></tr>`,
        );
      }
      if (rows.length > 0) {
        const t = document.createElement("table");
        t.className = "mlr-table";
        t.innerHTML =
          "<thead><tr><th class='mlr-th mlr-th-header'>Engine</th><th class='mlr-th mlr-th-header'>1st Run (Cold)</th><th class='mlr-th mlr-th-header'>Median (Warm)</th><th class='mlr-th mlr-th-header'>Fastest (Min)</th><th class='mlr-th mlr-th-header'>Slowest (Max)</th><th class='mlr-th mlr-th-header'>Speedup Ratio</th></tr></thead><tbody>" +
          rows.join("") + "</tbody>";
        domBox.appendChild(t);
      }
      if (result.detail?.note) {
        const note = document.createElement("p");
        note.className = "notice";
        note.textContent = result.detail.note;
        domBox.appendChild(note);
      }
      statusEl.textContent = "Real-DOM iframe run complete.";
    } catch (domErr) {
      const note = document.createElement("p");
      note.className = "notice";
      note.textContent = `Real-DOM run unavailable: ${
        domErr instanceof Error ? domErr.message : String(domErr)
      }`;
      domBox.appendChild(note);
      statusEl.textContent = "Real-DOM run unavailable (shown honestly).";
    }
  }
  if (plan.trackBRoot) {
    statusEl.textContent = "Track B: loading optimized variants…";
    const { initTrackB } = await import("./track-b.js");
    const tbBox = stageBlock("trackb", "Track A vs Track B — independent optimization");
    await initTrackB(tbBox, workloadSlug);
    statusEl.textContent = "Track B optimized variants rendered.";
  }
  if (plan.libcmp && plan.libcmpEngines.length > 0) {
    statusEl.textContent = "Library comparison: running engine pair…";
    const box = stageBlock("libcmp", "Library comparison (engines, not reimplementations)");
    const p = document.createElement("p");
    p.className = "notice";
    p.textContent = "Each engine below is a real implementation (a library or a port of one). " +
      "This compares engines against each other, not independent language " +
      "reimplementations of a single algorithm.";
    box.appendChild(p);
    const rows = [];
    for (const engine of plan.libcmpEngines) {
      let medianMs = null;
      if (primaryStats) {
        if (engine.key === "js" && primaryStats.jsStats?.pipelineSummary) {
          medianMs = primaryStats.jsStats.pipelineSummary.p50Ms;
        } else if (engine.key === "wasm" && primaryStats.wasmStats?.pipelineSummary) {
          medianMs = primaryStats.wasmStats.pipelineSummary.p50Ms;
        }
      }
      if (medianMs == null) {
        const target = engine.key === "wasm" ? "wasm" : "javascript";
        statusEl.textContent = `Library comparison: running ${engine.label}…`;
        try {
          const stats = await executeWorkerLoop(workloadSlug, target, iterations);
          // `medianMs` was read here; executeWorkerLoop has never returned a
          // field by that name, so every library-comparison row printed an em
          // dash regardless of what the engine actually measured.
          medianMs = stats.pipelineSummary?.p50Ms ?? stats.warmMedianMs ?? null;
        } catch (err) {
          medianMs = null;
          rows.push({
            label: engine.label,
            medianMs: null,
            sourceBytes: 0,
            error: err instanceof Error ? err.message : String(err),
          });
          continue;
        }
      }
      let sourceBytes = 0;
      if (engine.source) {
        try {
          const resp = await fetch(engine.source, { cache: "no-store" });
          if (resp.ok) sourceBytes = (await resp.arrayBuffer()).byteLength;
        } catch {
          sourceBytes = 0;
        }
      }
      rows.push({ label: engine.label, medianMs, sourceBytes, error: "" });
    }
    box.appendChild(renderLibCmpTable(rows));
    statusEl.textContent = "Library comparison complete.";
  }

  // Every engine the page measured, segmented by scope.
  renderUnifiedExplorer({
    flowEl,
    workloadSlug,
    primaryStats,
    multilangResults,
    domResults,
    manifest: multilangManifest,
    iterations,
  });
}

// ── Unified explorer ──────────────────────────────────────────────────────
//
// One place to see every engine the page measured, segmented by scope.
//
// The previous version built a single "warm median" column from
// `domMs ?? workerMs ?? kernelMs` and divided it by the JavaScript row, so a
// real-DOM journey time was reported as a speedup over a bare kernel time. It
// also filled the Min column from the median when a sample had no min, and
// attributed downloads by URL substring, where `findResource("c")` matched
// nearly every request on the page. None of that happens here: each scope is
// its own table with its own baseline, and a scope with no data is absent
// rather than borrowed from a neighbour.

const ENGINE_TOOLCHAINS = {
  js: "V8 JIT (in-browser)",
  wat: "Handwritten WAT → wasm",
  as: "asc -O3 --bindings none --noAssert",
  asc: "asc -O3 --bindings none --noAssert",
  c: "clang --target=wasm32 -O3 -nostdlib",
  cpp: "clang++ --target=wasm32 -O3 -nostdlib",
  rs: "rustc --target wasm32-unknown-unknown -O --crate-type cdylib",
  dart: "dart compile wasm (dart2wasm, WasmGC)",
  kt: "kotlinc-wasm",
  wasm: "wasm32 linear memory",
};

const DOM_ENGINE_LABELS = {
  js: "JavaScript",
  wasm: "WebAssembly",
  c: "C / Wasm",
  cpp: "C++ / Wasm",
  rs: "Rust / Wasm",
  dart: "Dart / WasmGC",
};

/**
 * Assemble the explorer's rows, one list per scope.
 *
 * Pure: takes measurements in, returns rows out, touches no DOM. Kept
 * exported so the row assembly is unit-testable without a browser — the
 * `multilangResults is not defined` defect shipped precisely because this
 * logic had no test that executed it.
 */
export function buildExplorerRows({
  primaryStats,
  multilangResults,
  domResults,
  manifest,
}) {
  /** @type {Record<string, any[]>} */
  const byScope = { kernel: [], pipeline: [], domJourney: [] };

  // Kernel scope: the multi-language lane measures a pre-instantiated engine
  // in-page after warm-up, which is exactly the kernel scope.
  const kernels = manifest?.kernels ?? Object.keys(multilangResults ?? {});
  const primaryKernel = kernels[0] ?? null;
  const kernelRows = primaryKernel ? (multilangResults?.[primaryKernel] ?? []) : [];
  for (const r of kernelRows) {
    byScope.kernel.push({
      key: r.key,
      label: r.label,
      toolchain: ENGINE_TOOLCHAINS[r.key] ?? "—",
      source: manifest?.engines?.find((e) => e.key === r.key)?.source ?? null,
      bytes: r.bytes || null,
      summary: summarize(r.samples ?? [], { scope: "kernel", label: r.label }),
    });
  }
  // When the page has no multi-language lane, the workers' self-reported
  // compute regions are the only kernel-scope evidence available.
  if (byScope.kernel.length === 0) {
    for (
      const [key, label, stats] of [
        ["js", "JavaScript", primaryStats?.jsStats],
        ["wasm", "WebAssembly", primaryStats?.wasmStats],
      ]
    ) {
      if (stats?.kernelSummary) {
        byScope.kernel.push({
          key,
          label,
          toolchain: ENGINE_TOOLCHAINS[key],
          source: null,
          bytes: null,
          summary: stats.kernelSummary,
        });
      }
    }
  }

  // Pipeline scope: the primary worker lane.
  for (
    const [key, label, stats] of [
      ["js", "JavaScript", primaryStats?.jsStats],
      ["wasm", "WebAssembly", primaryStats?.wasmStats],
    ]
  ) {
    if (stats?.pipelineSummary) {
      byScope.pipeline.push({
        key,
        label,
        toolchain: ENGINE_TOOLCHAINS[key],
        source: null,
        bytes: null,
        summary: stats.pipelineSummary,
        note: stats.workerReuse === "respawned-per-iteration"
          ? "includes a worker boot per sample"
          : "",
      });
    }
  }

  // Real-DOM scope: every engine that drove the same rendered UI.
  for (const [key, stats] of Object.entries(domResults?.perTarget ?? {})) {
    if (!stats) continue;
    byScope.domJourney.push({
      key,
      label: DOM_ENGINE_LABELS[key] ?? key,
      toolchain: ENGINE_TOOLCHAINS[key] ?? "—",
      source: null,
      bytes: null,
      summary: summarize(stats.samples ?? [], {
        scope: "domJourney",
        label: DOM_ENGINE_LABELS[key] ?? key,
      }) ?? (typeof stats.warmMedianMs === "number"
        ? summarize([stats.warmMedianMs], {
          scope: "domJourney",
          label: DOM_ENGINE_LABELS[key] ?? key,
          note: "host reported a median only",
        })
        : null),
    });
  }

  return byScope;
}

/** Flatten scoped rows into the long-format records the CSV writes. */
export function explorerCsvRecords(byScope) {
  const out = [];
  for (const scope of SCOPE_ORDER) {
    const rows = byScope[scope] ?? [];
    const present = rows.filter((r) => r.summary);
    if (present.length === 0) continue;
    const baseline = present.find((r) => r.key === "js") ?? present[0];
    for (const r of rows) {
      out.push({
        scope,
        label: r.label,
        toolchain: r.toolchain,
        bytes: r.bytes,
        summary: r.summary,
        ratio: r === baseline || !r.summary ? null : ratio(baseline.summary, r.summary),
      });
    }
  }
  return out;
}

function renderUnifiedExplorer({
  flowEl,
  workloadSlug,
  primaryStats,
  multilangResults,
  domResults,
  manifest,
  iterations,
}) {
  const previous = flowEl.querySelector(`[data-stage="explorer"]`);
  if (previous) previous.remove();

  const byScope = buildExplorerRows({ primaryStats, multilangResults, domResults, manifest });
  const available = SCOPE_ORDER.filter((id) => (byScope[id] ?? []).some((r) => r.summary));
  if (available.length === 0) return;

  const wrap = document.createElement("section");
  wrap.dataset.stage = "explorer";
  wrap.className = "stage-result explorer-section";

  // Best kernel engine drives both the decision panel and the amortization view.
  const kernelRows = (byScope.kernel ?? []).filter((r) => r.summary);
  const jsKernel = kernelRows.find((r) => r.key === "js");
  const bestWasmKernel = kernelRows
    .filter((r) => r.key !== "js")
    .sort((a, b) => a.summary.p50Ms - b.summary.p50Ms)[0];
  const pipelineRows = (byScope.pipeline ?? []).filter((r) => r.summary);
  const jsPipeline = pipelineRows.find((r) => r.key === "js");
  const wasmPipeline = pipelineRows.find((r) => r.key === "wasm");

  // The decision panel is drawn here, not in the primary report, because only
  // at this point has every lane — worker, multi-language, real DOM — reported.
  const decision = document.createElement("div");
  decision.innerHTML = decisionPanelHtml({
    workloadLabel: document.title.split("·")[0].trim() || workloadSlug || "This workload",
    kernel: jsKernel && bestWasmKernel
      ? {
        baseline: jsKernel.summary,
        best: bestWasmKernel.summary,
        bestLabel: bestWasmKernel.label,
      }
      : null,
    pipeline: jsPipeline && wasmPipeline
      ? {
        baseline: jsPipeline.summary,
        best: wasmPipeline.summary,
        bestLabel: wasmPipeline.label,
      }
      : null,
    delivery: {
      baselineMs: primaryStats?.jsStats?.firstUse?.totalMs ?? null,
      candidateMs: primaryStats?.wasmStats?.firstUse?.totalMs ?? null,
      candidateBytes: primaryStats?.wasmStats?.firstUse?.network?.decodedBytes ?? null,
    },
    contamination: primaryStats?.wasmStats?.contamination ??
      primaryStats?.jsStats?.contamination,
  });
  if (decision.innerHTML.trim()) wrap.appendChild(decision);

  const heading = document.createElement("h2");
  heading.textContent = "Every engine, every scope";
  wrap.appendChild(heading);

  const intro = document.createElement("p");
  intro.className = "notice";
  intro.textContent =
    "One table per scope. Each table has its own baseline and its own ratio column, because the " +
    "tables do not time the same amount of work. Comparing a number across two tables is a " +
    "category error and the runner will not do it for you.";
  wrap.appendChild(intro);

  if (kernelRows.length > 1) {
    const chartHost = document.createElement("div");
    chartHost.innerHTML = barChartSvg(
      kernelRows.map((r) => ({
        label: r.label,
        valueMs: r.summary.p50Ms,
        lowMs: r.summary.ci95?.lowMs ?? null,
        highMs: r.summary.ci95?.highMs ?? null,
        kind: r.key === "js" ? "js" : "wasm",
      })),
      {
        title: "Kernel compute across every language",
        caption: "Same algorithm, same input, pre-instantiated engines, warmed up before timing. " +
          "Whiskers are 95% confidence intervals for the median.",
      },
    );
    wrap.appendChild(chartHost);
  }

  if (pipelineRows.length > 1) {
    const pipeHost = document.createElement("div");
    pipeHost.innerHTML = barChartSvg(
      pipelineRows.map((r) => ({
        label: r.label,
        valueMs: r.summary.p50Ms,
        lowMs: r.summary.ci95?.lowMs ?? null,
        highMs: r.summary.ci95?.highMs ?? null,
        kind: r.key === "js" ? "js" : "wasm",
      })),
      {
        title: "Task pipeline — median per complete task",
        caption:
          "Worker dispatch, serialization, compute, result transfer and oracle validation. " +
          "Whiskers are 95% confidence intervals for the median.",
      },
    );
    wrap.appendChild(pipeHost);
  }

  const domRows = (byScope.domJourney ?? []).filter((r) => r.summary);
  if (domRows.length > 1) {
    const domHost = document.createElement("div");
    domHost.innerHTML = barChartSvg(
      domRows.map((r) => ({
        label: r.label,
        valueMs: r.summary.p50Ms,
        lowMs: r.summary.ci95?.lowMs ?? null,
        highMs: r.summary.ci95?.highMs ?? null,
        kind: r.key === "js" ? "js" : "wasm",
      })),
      {
        title: "Real-DOM journey — median per rendered journey",
        caption:
          "Each engine drove the same rendered UI through real DOM APIs in the iframe above.",
      },
    );
    wrap.appendChild(domHost);
  }

  if (jsKernel && bestWasmKernel) {
    const amortHost = document.createElement("div");
    amortHost.innerHTML = amortizationChartSvg(
      [jsKernel, bestWasmKernel].map((r) => ({
        label: r.label,
        deliveryMs: r.key === "js"
          ? (primaryStats?.jsStats?.firstUse?.totalMs ?? 0)
          : (primaryStats?.wasmStats?.firstUse?.totalMs ?? 0),
        perMs: r.summary.p50Ms,
        kind: r.key === "js" ? "js" : "wasm",
      })),
      {
        title: `Cumulative time: JavaScript against ${bestWasmKernel.label}`,
        caption:
          "The marked point is where the compiled engine has repaid the cost of shipping and " +
          "compiling it. Left of that point, JavaScript finishes the work sooner.",
      },
    );
    wrap.appendChild(amortHost);
  }

  const tables = document.createElement("div");
  tables.innerHTML = available
    .map((scopeId) =>
      scopeTableHtml({
        scopeId,
        rows: byScope[scopeId],
        baselineLabel: (byScope[scopeId].find((r) => r.key === "js")?.label) ?? "JavaScript",
        iterations,
      })
    )
    .join("");
  wrap.appendChild(tables);

  const missing = SCOPE_ORDER.filter((id) => !available.includes(id) && id !== "delivery");
  if (missing.length > 0) {
    const note = document.createElement("p");
    note.className = "notice";
    note.textContent = `Not measured on this page: ${
      missing.map((id) => SCOPES[id].label).join(", ")
    }. An absent scope is left absent rather than filled from another scope's numbers.`;
    wrap.appendChild(note);
  }

  wrap.appendChild(
    csvExportElement(
      toCsv(explorerCsvRecords(byScope)),
      `${workloadSlug || "benchmark"}-results.csv`,
    ),
  );

  flowEl.prepend(wrap);
}

function renderLibCmpTable(rows) {
  const table = document.createElement("table");
  table.className = "mlr-table";
  table.innerHTML = "<thead><tr>" +
    ["Engine", "Median (this run)", "Source size", "Notes"]
      .map((h) => `<th class="mlr-th mlr-th-header">${h}</th>`)
      .join("") +
    "</tr></thead><tbody>" +
    rows
      .map((r) =>
        `<tr>` +
        `<td class="mlr-th"><strong>${r.label}</strong></td>` +
        `<td class="mlr-th">${r.medianMs != null ? `${r.medianMs.toFixed(3)} ms` : "—"}</td>` +
        `<td class="mlr-th">${
          r.sourceBytes > 0 ? `${r.sourceBytes.toLocaleString()} B` : "—"
        }</td>` +
        `<td class="mlr-th">${r.error ? `engine unavailable: ${r.error}` : ""}</td>` +
        `</tr>`
      )
      .join("") +
    "</tbody>";
  return table;
}

let lastJsStats = null;
let lastWasmStats = null;

/**
 * `document.querySelector` is typed as returning `Element`, but every call site
 * below needs a specific element's properties (value, disabled, options).
 * @template {HTMLElement} T
 * @param {string} selector
 * @returns {T | null}
 */
function q(selector) {
  return /** @type {T | null} */ (document.querySelector(selector));
}

function initUnifiedRunner() {
  const workloadSlug = document.body.dataset.workload || document.body.dataset.demo;
  if (!workloadSlug) return;

  const form = /** @type {HTMLFormElement | null} */ (
    q("#demo-form") ?? q("form")
  );
  const targetSelect = /** @type {HTMLSelectElement | null} */ (q("#target"));
  const iterationsSelect = /** @type {HTMLSelectElement | null} */ (
    q("#iterations") ?? q("#pg-iterations")
  );
  const startBtn = /** @type {HTMLButtonElement | null} */ (
    q("#start") ?? q("button[type='submit']")
  );
  const cancelBtn = /** @type {HTMLButtonElement | null} */ (q("#cancel"));
  const statusEl = /** @type {HTMLElement | null} */ (q("#status"));
  const reportingEl = /** @type {HTMLElement | null} */ (
    q("#perf-reporting") ?? q("#result")
  );

  if (!form || !startBtn || !statusEl) return;

  // Suppress/remove any secondary multi-language run form (#ml-form, #multilang-form)
  // so the single primary run loop at the top is the ONLY run control on the page,
  // running JS, Wasm, and all multi-language engines sequentially (Paul directive).
  const duplicateMlForms = document.querySelectorAll(
    "form#ml-form, form#multilang-form",
  );
  duplicateMlForms.forEach((f) => f.remove());
  const orphanMlControls = document.querySelectorAll(
    "#ml-status, #ml-reporting, #multilang-status, #multilang-reporting",
  );
  orphanMlControls.forEach((el) => el.remove());

  // A page's static multi-language section describes the same comparison the
  // run now produces with live numbers. Keep the prose, drop the empty shell
  // it wrapped, and move it below the results so the run output leads.
  const staticMlSection = /** @type {HTMLElement | null} */ (
    document.querySelector(
      'section[aria-labelledby="ml-heading"], section[aria-labelledby="multilang-run-heading"]',
    )
  );
  if (staticMlSection && !staticMlSection.querySelector("table")) {
    staticMlSection.dataset.wvjSecondary = "1";
  }

  // The template ships the controls disabled (progressive enhancement for
  // no-JS); the runner enables them once wired (Paul: why is Target Engine disabled?).
  startBtn.disabled = false;
  if (targetSelect) targetSelect.disabled = false;
  if (iterationsSelect) iterationsSelect.disabled = false;

  // Multi-language engines become selectable targets: "All engines" plus each
  // individual engine from the page's manifest (Paul: should the target framework
  // include multilang? — yes).
  const mlManifestPath = document.body?.dataset?.multilangManifest;
  if (targetSelect && mlManifestPath) {
    fetch(mlManifestPath, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((manifest) => {
        if (!manifest || !targetSelect || !Array.isArray(manifest.engines)) return;
        const has = (v) => [...targetSelect.options].some((o) => o.value === v);
        if (!has("ml:all")) {
          const all = document.createElement("option");
          all.value = "ml:all";
          all.textContent = "Multi-Language Comparison (All Engines)";
          targetSelect.appendChild(all);
        }
        for (const engine of manifest.engines) {
          const v = `ml:${engine.key}`;
          if (!has(v)) {
            const opt = document.createElement("option");
            opt.value = v;
            opt.textContent = `${engine.label} (multi-language)`;
            targetSelect.appendChild(opt);
          }
        }
      })
      .catch(() => {});
  }

  let activeRun = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (activeRun) return;

    activeRun = true;
    startBtn.disabled = true;
    if (targetSelect) targetSelect.disabled = true;
    if (iterationsSelect) iterationsSelect.disabled = true;
    if (cancelBtn) cancelBtn.disabled = false;

    const chosenTarget = targetSelect ? targetSelect.value : "both";
    const iterations = iterationsSelect ? parseInt(iterationsSelect.value, 10) : 30;

    statusEl.textContent = `Running benchmark suite (${iterations}× loop)...`;

    try {
      const hasWorkerPair = Boolean(WORKLOAD_CONFIGS[workloadSlug]?.workerScript);
      if (!hasWorkerPair && !chosenTarget.startsWith("ml:")) {
        // Kernel-scope-only page: no JS/Wasm worker pair exists, but the
        // multi-language lane does. Run what the page actually has instead of
        // failing on the stage it does not.
        if (!document.body?.dataset?.multilangManifest) {
          throw new Error(
            `${workloadSlug} has neither a worker pair nor a multi-language manifest`,
          );
        }
        statusEl.textContent = `Running the kernel comparison (${iterations} samples)...`;
      } else if (chosenTarget.startsWith("ml:")) {
        // Target the multi-language comparison directly (Paul: the target
        // framework should include the multilang engines).
        const engineFilter = chosenTarget === "ml:all" ? null : chosenTarget.slice(3);
        const manifestPath = document.body?.dataset?.multilangManifest;
        if (!manifestPath) throw new Error("no multi-language manifest for this page");
        statusEl.textContent = engineFilter
          ? `Running ${engineFilter} engine (${iterations}× loop)...`
          : `Running all multi-language engines (${iterations}× loop)...`;
        const { runMultilangComparison } = await import("./multilang-runner.js");
        const previous = reportingEl?.querySelector(`[data-stage="multilang"]`);
        if (previous) previous.remove();
        const wrap = document.createElement("section");
        wrap.dataset.stage = "multilang";
        wrap.className = "stage-result";
        const h = document.createElement("h3");
        h.textContent = engineFilter
          ? `Multi-language comparison — ${engineFilter} engine only`
          : "Multi-language comparison";
        wrap.appendChild(h);
        const box = document.createElement("div");
        wrap.appendChild(box);
        reportingEl?.appendChild(wrap);
        if (reportingEl) reportingEl.hidden = false;
        await runMultilangComparison(manifestPath, {
          iterations,
          engineFilter,
          onStatus: (m) => {
            statusEl.textContent = m;
          },
          reportingEl: box,
        });
        statusEl.textContent = "Multi-language comparison complete.";
      } else if (chosenTarget === "javascript") {
        statusEl.textContent = `Running JavaScript (${iterations}× loop)...`;
        const jsStats = await executeWorkerLoop(workloadSlug, "javascript", iterations);
        lastJsStats = jsStats;
        statusEl.textContent = `JavaScript completed in ${
          jsStats.warmMedianMs.toFixed(2)
        } ms (median).`;
        if (reportingEl) {
          reportingEl.innerHTML =
            `<p class="notice"><strong>JavaScript Result:</strong> Warm Median = ${
              jsStats.warmMedianMs.toFixed(2)
            } ms, Cold Start = ${jsStats.coldMs.toFixed(2)} ms.</p>`;
          reportingEl.hidden = false;
        }
      } else if (chosenTarget === "wasm" || chosenTarget === "wasm-linear") {
        statusEl.textContent = `Running WebAssembly (${iterations}× loop)...`;
        const wasmStats = await executeWorkerLoop(workloadSlug, "wasm", iterations);
        lastWasmStats = wasmStats;
        statusEl.textContent = `WebAssembly completed in ${
          wasmStats.warmMedianMs.toFixed(2)
        } ms (median).`;
        if (reportingEl) {
          reportingEl.innerHTML =
            `<p class="notice"><strong>WebAssembly Result:</strong> Warm Median = ${
              wasmStats.warmMedianMs.toFixed(2)
            } ms, Cold Start = ${wasmStats.coldMs.toFixed(2)} ms.</p>`;
          reportingEl.hidden = false;
        }
      } else {
        // Compare Side-by-Side (JS vs Wasm)
        statusEl.textContent = `Running JavaScript benchmark (${iterations}× loop)...`;
        const jsStats = await executeWorkerLoop(workloadSlug, "javascript", iterations);
        lastJsStats = jsStats;

        statusEl.textContent = `Running WebAssembly benchmark (${iterations}× loop)...`;
        const wasmStats = await executeWorkerLoop(workloadSlug, "wasm", iterations);
        lastWasmStats = wasmStats;

        statusEl.textContent = `Benchmark suite completed across ${iterations} iterations.`;
        if (reportingEl) {
          renderPerformanceReport(reportingEl, jsStats, wasmStats);
        }
      }

      // Unified "Run Everything": after the primary stage (any target), sequence
      // the multi-language comparison and the Track B optimized variants from
      // the same run control (Paul directive 2026-08-06). When the target IS a
      // multi-language engine, that stage already ran above — don't duplicate it.
      if (!chosenTarget.startsWith("ml:")) {
        try {
          await runComposedStages({
            workloadSlug,
            iterations,
            statusEl,
            reportingEl,
            primaryStats: { jsStats: lastJsStats, wasmStats: lastWasmStats },
          });
        } catch (composedErr) {
          statusEl.textContent = `Additional stages error: ${
            composedErr instanceof Error ? composedErr.message : String(composedErr)
          }`;
          // The composed-stage failure must not be masked by a success banner.
          throw composedErr;
        }
      }
      statusEl.textContent = chosenTarget.startsWith("ml:")
        ? "Benchmark suite complete."
        : "Full benchmark suite complete.";
    } catch (err) {
      statusEl.textContent = `Error: ${err.message || String(err)}`;
    } finally {
      activeRun = false;
      startBtn.disabled = false;
      if (targetSelect) targetSelect.disabled = false;
      if (iterationsSelect) iterationsSelect.disabled = false;
      if (cancelBtn) cancelBtn.disabled = true;
    }
  });

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      activeRun = false;
      statusEl.textContent = "Run cancelled by user.";
      startBtn.disabled = false;
      if (targetSelect) targetSelect.disabled = false;
      if (iterationsSelect) iterationsSelect.disabled = false;
      cancelBtn.disabled = true;
    });
  }

  statusEl.textContent = "Ready. Select target and loop iterations, then click Start.";
  startBtn.disabled = false;
}

if (typeof document !== "undefined") {
  // Marker for the unified composed flow: multilang-runner.js skips its own
  // auto-bind when this flag is present, so the primary run control sequences
  // every stage (primary + multilang + Track B). Set before DOMContentLoaded so
  // other deferred module scripts can read it (module scripts run in order
  // before DOMContentLoaded fires).
  if (document.body) {
    document.body.dataset.unifiedRunnerActive = "1";
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      const mlManifest = document.body?.dataset?.multilangManifest;
      if (mlManifest) {
        const flowEl = document.querySelector("#perf-reporting") ?? document.querySelector("#main");
        if (flowEl) renderReportedComparison(flowEl, mlManifest).catch(() => {});
      }
      const trackBRoot = document.querySelector("#track-b-root") ??
        document.querySelector("#trackb-root");
      if (trackBRoot && document.body?.dataset?.workload) {
        renderReportedTrackB(trackBRoot, document.body.dataset.workload).catch(() => {});
      }
      document.body.dataset.unifiedRunnerActive = "1";
    }, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUnifiedRunner);
  } else {
    initUnifiedRunner();
  }
}

export { executeWorkerLoop, renderPerformanceReport };

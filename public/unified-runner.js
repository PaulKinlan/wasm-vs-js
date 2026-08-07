// Unified Benchmark Runner & Performance Reporting Module
// Standardized execution harness, graphs, tables, and worker controls for all benchmark detail pages.

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

// Executes a worker for N iterations with generous 120-second timeout
async function executeWorkerLoop(slug, target, iterations = 30, onProgress = () => {}) {
  const config = WORKLOAD_CONFIGS[slug];
  if (!config || !config.workerScript) {
    throw new Error(`Worker configuration missing for ${slug}`);
  }

  // Fetch + hash the sqlite notebook runtime manifest the way the demo page's
  // runner does, producing the manifest/shellChecks fields the worker requires.
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

  // sum-u32 handles multi-iteration batches inside hosted-runner-worker
  if (slug === "sum-u32") {
    const isWasm = target === "wasm" || target === "wasm-linear" ||
      target === "wasm-linear-controlled";
    return new Promise((resolve, reject) => {
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
          const res = msg.result;
          const coldMs = isWasm ? res.lifecycle.wasmFirstExecuteMs : res.lifecycle.jsFirstExecuteMs;
          const stats = isWasm ? res.wasm : res.js;
          resolve({
            coldMs: coldMs || stats.medianMs,
            warmMedianMs: stats.medianMs,
            minMs: Math.min(...stats.samples),
            maxMs: Math.max(...stats.samples),
            samples: stats.samples,
            iterations: stats.count,
            lastResult: res,
          });
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
  }

  // Heavy workloads run a capped count to stay fast
  const heavyWorkloads = [
    "dom-virtualized-grid-v1",
    "graphics-cpu-path-tracer-v1",
    "base-gltf-viewer",
    "database-sqlite-notebook-v1",
  ];
  const loopCount = heavyWorkloads.includes(slug) ? Math.min(iterations, 5) : iterations;
  const iterationTimeoutMs = config.iterationTimeoutMs || 120000;

  // Some workers expect caller-prepared, fetch-derived payload fields (e.g.
  // the sqlite notebook's verified runtime manifest + shell checks). Prepare
  // once per card run; both target passes reuse it.
  if (config.protocol === "sqlite-notebook" && !config.prepared) {
    config.prepared = await prepareSqliteRuntime();
  }

  const durations = [];
  let lastResult = null;

  for (let i = 0; i < loopCount; i++) {
    const iterationMs = await new Promise((resolve, reject) => {
      let worker;
      try {
        worker = new Worker(config.workerScript, { type: config.workerType || "module" });
      } catch (err) {
        return reject(err);
      }

      const token = config.tokenType === "string"
        ? crypto.randomUUID()
        : Math.floor(Math.random() * 1000000);
      const startTime = performance.now();

      // Generous 120-second timeout per iteration to avoid premature termination
      const timeoutTimer = setTimeout(() => {
        worker.terminate();
        reject(new Error(`Iteration ${i + 1} timed out after 120 seconds`));
      }, iterationTimeoutMs);

      worker.addEventListener("message", (event) => {
        const msg = event.data;
        if (!msg) return;
        // Interactive trace workers (virtualized grid) pace actions and wait
        // for the driver to acknowledge each event before continuing.
        if (
          config.ackEvents && msg.type === "event" && msg.actionIndex !== undefined
        ) {
          worker.postMessage({ type: "ack", token: msg.token, actionIndex: msg.actionIndex });
          return;
        }
        if (msg.token !== undefined && msg.token !== token) return;

        if (
          msg.type === "completed" || msg.type === "done" ||
          msg.type === "complete" || msg.type === "result" ||
          msg.ok === true
        ) {
          clearTimeout(timeoutTimer);
          const time = performance.now() - startTime;
          worker.terminate();
          if (msg.result) lastResult = msg.result;
          resolve(time);
        } else if (msg.type === "failed" || msg.type === "error" || msg.ok === false) {
          clearTimeout(timeoutTimer);
          worker.terminate();
          reject(new Error(msg.message || msg.error || msg.detail || "Worker execution failed"));
        }
      });

      worker.addEventListener("error", (err) => {
        clearTimeout(timeoutTimer);
        worker.terminate();
        reject(new Error(err.message || "Worker error event"));
      });

      const payload = formatTargetPayload(slug, target);
      worker.postMessage({ token, ...payload, ...(config.prepared || {}) });
    });

    durations.push(iterationMs);
    onProgress({ iteration: i + 1, total: loopCount, target });
  }

  const coldMs = durations[0];
  const warmMsList = durations.slice(1);
  const sortedWarm = [...warmMsList].sort((a, b) => a - b);
  const warmMedianMs = sortedWarm.length > 0
    ? sortedWarm[Math.floor(sortedWarm.length / 2)]
    : coldMs;
  const minMs = Math.min(...durations);
  const maxMs = Math.max(...durations);

  return {
    coldMs,
    warmMedianMs,
    minMs,
    maxMs,
    samples: durations,
    iterations: durations.length,
    lastResult,
  };
}

// Render clean, visual comparative bar graph & statistics table
function renderPerformanceReport(container, jsStats, wasmStats, iterations) {
  const jsWarm = jsStats.warmMedianMs;
  const wasmWarm = wasmStats.warmMedianMs;
  const ratio = (jsWarm / wasmWarm).toFixed(2);

  let speedupBadgeHtml = "";
  if (parseFloat(ratio) > 1.05) {
    speedupBadgeHtml =
      `<div class="speedup-badge wasm-wins">⚡ WebAssembly is <strong>${ratio}× faster</strong> than JavaScript</div>`;
  } else if (parseFloat(ratio) < 0.95) {
    const jsRatio = (1 / parseFloat(ratio)).toFixed(2);
    speedupBadgeHtml =
      `<div class="speedup-badge js-wins">⚡ JavaScript is <strong>${jsRatio}× faster</strong> than WebAssembly</div>`;
  } else {
    speedupBadgeHtml =
      `<div class="speedup-badge tie">⏱️ JavaScript and WebAssembly have <strong>Equal Performance</strong></div>`;
  }

  // Calculate bar width percentages relative to max time
  const maxTime = Math.max(jsStats.coldMs, jsWarm, wasmStats.coldMs, wasmWarm, 1);
  const jsColdPct = Math.max(5, Math.min(100, (jsStats.coldMs / maxTime) * 100));
  const jsWarmPct = Math.max(5, Math.min(100, (jsWarm / maxTime) * 100));
  const wasmColdPct = Math.max(5, Math.min(100, (wasmStats.coldMs / maxTime) * 100));
  const wasmWarmPct = Math.max(5, Math.min(100, (wasmWarm / maxTime) * 100));

  const graphHtml = `
    <div class="perf-graph-card">
      <h3 class="perf-title">Execution Timing Comparison (ms)</h3>
      
      <div class="perf-bar-group">
        <div class="perf-bar-label">
          <strong>JavaScript</strong>
          <span class="muted">Cold Start: ${jsStats.coldMs.toFixed(2)} ms | Warm Median: ${
    jsWarm.toFixed(2)
  } ms</span>
        </div>
        <div class="perf-bar-track">
          <div class="perf-bar js-cold" data-pct="${jsColdPct}" title="Cold Start: ${
    jsStats.coldMs.toFixed(2)
  } ms">
            <span>Cold: ${jsStats.coldMs.toFixed(1)}ms</span>
          </div>
        </div>
        <div class="perf-bar-track">
          <div class="perf-bar js-warm" data-pct="${jsWarmPct}" title="Warm Median: ${
    jsWarm.toFixed(2)
  } ms">
            <span>Warm: ${jsWarm.toFixed(1)}ms</span>
          </div>
        </div>
      </div>

      <div class="perf-bar-group">
        <div class="perf-bar-label">
          <strong>WebAssembly</strong>
          <span class="muted">Cold Start: ${wasmStats.coldMs.toFixed(2)} ms | Warm Median: ${
    wasmWarm.toFixed(2)
  } ms</span>
        </div>
        <div class="perf-bar-track">
          <div class="perf-bar wasm-cold" data-pct="${wasmColdPct}" title="Cold Start: ${
    wasmStats.coldMs.toFixed(2)
  } ms">
            <span>Cold: ${wasmStats.coldMs.toFixed(1)}ms</span>
          </div>
        </div>
        <div class="perf-bar-track">
          <div class="perf-bar wasm-warm" data-pct="${wasmWarmPct}" title="Warm Median: ${
    wasmWarm.toFixed(2)
  } ms">
            <span>Warm: ${wasmWarm.toFixed(1)}ms</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const tableHtml = `
    <div class="table-wrap">
      <table class="results-table">
        <caption>Benchmark Suite Loop Execution Results (${iterations}× iterations)</caption>
        <thead>
          <tr>
            <th>Target Engine</th>
            <th>1st Run (Cold)</th>
            <th>Median (${iterations}× Warm)</th>
            <th>Fastest (Min)</th>
            <th>Slowest (Max)</th>
            <th>Speedup Ratio</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>JavaScript</strong></td>
            <td>${jsStats.coldMs.toFixed(2)} ms</td>
            <td>${jsWarm.toFixed(2)} ms</td>
            <td>${jsStats.minMs.toFixed(2)} ms</td>
            <td>${jsStats.maxMs.toFixed(2)} ms</td>
            <td>1.00× (Baseline)</td>
          </tr>
          <tr>
            <td><strong>WebAssembly</strong></td>
            <td>${wasmStats.coldMs.toFixed(2)} ms</td>
            <td>${wasmWarm.toFixed(2)} ms</td>
            <td>${wasmStats.minMs.toFixed(2)} ms</td>
            <td>${wasmStats.maxMs.toFixed(2)} ms</td>
            <td><strong>${ratio}×</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const lifecycleHtml = renderLifecycleBreakdown(jsStats, wasmStats);

  container.innerHTML = speedupBadgeHtml + graphHtml + tableHtml + lifecycleHtml;
  container.querySelectorAll(".perf-bar[data-pct]").forEach((bar) => {
    bar.style.width = `${bar.dataset.pct}%`;
  });
  container.hidden = false;
}

// Render a phase value that is either a number (ms) or a typed unavailable
// object { status, reason } — never zero-substituted.
function lifecyclePhaseCell(value) {
  if (value && typeof value === "object") {
    if (value.status === "unavailable") return `${value.status}: ${value.reason}`;
    if (value.status === "supported-value" && typeof value.ms === "number") {
      return `${value.ms.toFixed(3)} ms`;
    }
  }
  if (typeof value === "number") return `${value.toFixed(3)} ms`;
  return "not collected";
}

// Cold-start phase breakdown for the playground report. Rendered from the
// retained lifecycle block when the run carried one; otherwise the phase cells
// are marked "not collected" — never invented. Cold = first pre-JIT run;
// the phases below are what that first run cost, broken out so a Wasm-vs-JS
// difference can be traced to transfer, compile, instantiate, or first execute.
function renderLifecycleBreakdown(jsStats, wasmStats) {
  const jsLifecycle = jsStats?.lastResult?.lifecycle;
  const wasmLifecycle = wasmStats?.lastResult?.lifecycle;
  if (!jsLifecycle && !wasmLifecycle) return "";
  const row = (label, jsValue, wasmValue) =>
    `<tr><td>${label}</td><td>${lifecyclePhaseCell(jsValue)}</td><td>${
      lifecyclePhaseCell(wasmValue)
    }</td></tr>`;
  return `<div class="table-wrap lifecycle-breakdown">
    <table class="results-table">
      <caption>First-use lifecycle breakdown · cold = first pre-JIT run</caption>
      <thead><tr><th>Phase</th><th>JavaScript</th><th>WebAssembly</th></tr></thead>
      <tbody>
        ${
    row("Manifest transfer", jsLifecycle?.manifestTransferMs, wasmLifecycle?.manifestTransferMs)
  }
        ${
    row(
      "Manifest network (Resource Timing)",
      jsLifecycle?.manifestNetworkMs,
      wasmLifecycle?.manifestNetworkMs,
    )
  }
        ${row("Module transfer", jsLifecycle?.jsTransferMs, wasmLifecycle?.wasmTransferMs)}
        ${
    row("Module network (Resource Timing)", jsLifecycle?.jsNetworkMs, wasmLifecycle?.wasmNetworkMs)
  }
        ${row("Compile", "—", wasmLifecycle?.wasmCompileMs)}
        ${row("Instantiate", "—", wasmLifecycle?.wasmInstantiateMs)}
        ${row("First execute", jsLifecycle?.jsFirstExecuteMs, wasmLifecycle?.wasmFirstExecuteMs)}
      </tbody>
    </table>
  </div>`;
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
  const previous = flowEl.querySelector(`[data-stage="multilang"]`);
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
    "<thead><tr><th class='mlr-th mlr-th-header'>Engine</th><th class='mlr-th mlr-th-header'>Warm median</th><th class='mlr-th mlr-th-header'>Wasm bytes</th><th class='mlr-th mlr-th-header'>Toolchain</th></tr></thead><tbody>" +
    variants.map((v) =>
      `<tr><td class="mlr-th"><strong>${v.language}</strong></td>` +
      `<td class="mlr-th">${
        typeof v.warmExecutionMs === "number" ? v.warmExecutionMs.toFixed(2) + " ms" : "—"
      }</td>` +
      `<td class="mlr-th">${
        v.binarySizeBytes > 0 ? v.binarySizeBytes.toLocaleString() : "—"
      }</td>` +
      `<td class="mlr-th">${v.toolchain ?? "—"}</td></tr>`
    ).join("") + "</tbody>";
  wrap.appendChild(table);
  flowEl.appendChild(wrap);
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
    const { runMultilangComparison } = await import("/multilang-runner.js");
    const mlBox = stageBlock("multilang", "Multi-language comparison");
    await runMultilangComparison(plan.multilangManifest, {
      iterations,
      onStatus: (m) => {
        statusEl.textContent = m;
      },
      reportingEl: mlBox,
    });
    statusEl.textContent = "✓ Multi-language comparison complete.";
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
    const iframeContainer = document.createElement("div");
    iframeContainer.setAttribute("data-wvj-visible-host", "1");
    domBox.appendChild(iframeContainer);
    statusEl.textContent = "Real-DOM run: loading the demo page in an iframe…";
    const { runIframeDomBenchmark } = await import("/iframe-benchmark-bridge.js");
    try {
      const result = await runIframeDomBenchmark({
        route: `${globalThis.location.pathname}${globalThis.location.search}`,
        iterations,
        targets: ["js", "wasm"],
        timeoutMs: 240000,
        visible: true,
        container: iframeContainer,
        onProgress: ({ target, iteration, total }) => {
          statusEl.textContent = `Real-DOM run: ${
            target === "js" ? "JS" : "Wasm"
          } — iteration ${iteration}/${total}…`;
        },
      });
      const jsStats = result.perTarget.js;
      const wasmStats = result.perTarget.wasm;
      if (jsStats && wasmStats) {
        const t = document.createElement("table");
        t.className = "mlr-table";
        t.innerHTML =
          "<thead><tr><th class='mlr-th mlr-th-header'>Engine</th><th class='mlr-th mlr-th-header'>1st Run (Cold)</th><th class='mlr-th mlr-th-header'>Median (Warm)</th><th class='mlr-th mlr-th-header'>Fastest (Min)</th><th class='mlr-th mlr-th-header'>Slowest (Max)</th><th class='mlr-th mlr-th-header'>Speedup Ratio</th></tr></thead><tbody>" +
          `<tr><td class="mlr-th"><strong>JavaScript (real DOM)</strong></td><td class="mlr-th">${
            jsStats.coldMs.toFixed(2)
          } ms</td><td class="mlr-th">${
            jsStats.warmMedianMs.toFixed(2)
          } ms</td><td class="mlr-th">${jsStats.minMs.toFixed(2)} ms</td><td class="mlr-th">${
            jsStats.maxMs.toFixed(2)
          } ms</td><td class="mlr-th"><strong>1.00× (Baseline)</strong></td></tr>` +
          `<tr><td class="mlr-th"><strong>WebAssembly (real DOM)</strong></td><td class="mlr-th">${
            wasmStats.coldMs.toFixed(2)
          } ms</td><td class="mlr-th">${
            wasmStats.warmMedianMs.toFixed(2)
          } ms</td><td class="mlr-th">${wasmStats.minMs.toFixed(2)} ms</td><td class="mlr-th">${
            wasmStats.maxMs.toFixed(2)
          } ms</td><td class="mlr-th"><strong>${
            (jsStats.warmMedianMs / wasmStats.warmMedianMs).toFixed(2)
          }×</strong></td></tr>` +
          "</tbody>";
        domBox.appendChild(t);
      }
      if (result.detail?.note) {
        const note = document.createElement("p");
        note.className = "notice";
        note.textContent = result.detail.note;
        domBox.appendChild(note);
      }
      statusEl.textContent = "✓ Real-DOM iframe run complete.";
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
    const { initTrackB } = await import("/track-b.js");
    const tbBox = stageBlock("trackb", "Track A vs Track B — independent optimization");
    await initTrackB(tbBox, workloadSlug);
    statusEl.textContent = "✓ Track B optimized variants rendered.";
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
        if (engine.key === "js" && primaryStats.jsStats?.medianMs != null) {
          medianMs = primaryStats.jsStats.medianMs;
        } else if (engine.key === "wasm" && primaryStats.wasmStats?.medianMs != null) {
          medianMs = primaryStats.wasmStats.medianMs;
        }
      }
      if (medianMs == null) {
        const target = engine.key === "wasm" ? "wasm" : "javascript";
        statusEl.textContent = `Library comparison: running ${engine.label}…`;
        try {
          const stats = await executeWorkerLoop(workloadSlug, target, iterations, statusEl);
          medianMs = stats.medianMs;
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
    statusEl.textContent = "✓ Library comparison complete.";
  }
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

function initUnifiedRunner() {
  const workloadSlug = document.body.dataset.workload || document.body.dataset.demo;
  if (!workloadSlug) return;

  const form = document.querySelector("#demo-form") || document.querySelector("form");
  const targetSelect = document.querySelector("#target");
  const iterationsSelect = document.querySelector("#iterations") ||
    document.querySelector("#pg-iterations");
  const startBtn = document.querySelector("#start") ||
    document.querySelector("button[type='submit']");
  const cancelBtn = document.querySelector("#cancel");
  const statusEl = document.querySelector("#status");
  const reportingEl = document.querySelector("#perf-reporting") ||
    document.querySelector("#result");

  if (!form || !startBtn || !statusEl) return;

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
      if (chosenTarget.startsWith("ml:")) {
        // Target the multi-language comparison directly (Paul: the target
        // framework should include the multilang engines).
        const engineFilter = chosenTarget === "ml:all" ? null : chosenTarget.slice(3);
        const manifestPath = document.body?.dataset?.multilangManifest;
        if (!manifestPath) throw new Error("no multi-language manifest for this page");
        statusEl.textContent = engineFilter
          ? `Running ${engineFilter} engine (${iterations}× loop)...`
          : `Running all multi-language engines (${iterations}× loop)...`;
        const { runMultilangComparison } = await import("/multilang-runner.js");
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
        statusEl.textContent = "✓ Multi-language comparison complete.";
      } else if (chosenTarget === "javascript") {
        statusEl.textContent = `Running JavaScript (${iterations}× loop)...`;
        const jsStats = await executeWorkerLoop(workloadSlug, "javascript", iterations);
        lastJsStats = jsStats;
        statusEl.textContent = `✓ JavaScript completed in ${
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
        statusEl.textContent = `✓ WebAssembly completed in ${
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

        statusEl.textContent = `✓ Benchmark suite completed across ${iterations} iterations.`;
        if (reportingEl) {
          renderPerformanceReport(reportingEl, jsStats, wasmStats, iterations);
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
        }
      }
      statusEl.textContent = chosenTarget.startsWith("ml:")
        ? "✓ Benchmark suite complete."
        : "✓ Full benchmark suite complete.";
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

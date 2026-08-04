// Unified Benchmark Runner & Performance Reporting Module
// Standardized execution harness, graphs, tables, and worker controls for all benchmark detail pages.

const WORKLOAD_CONFIGS = {
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
    workerScript: "/demos/game-family/worker.js",
    protocol: "game-family",
    workloadId: "game.canvas-arcade.v1",
  },
  "game-canvas-entity-pathfinding": {
    workerScript: "/demos/game-family/worker.js",
    protocol: "game-family",
    workloadId: "game.canvas-entity-pathfinding.v1",
  },
  "game-dom-tactics-grid": {
    workerScript: "/demos/game-family/worker.js",
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
    workerScript: "/demos/cad-parametric-bracket/worker.js",
    protocol: "bracket",
  },
  "crypto-file-integrity-v1": {
    workerScript: "/crypto-file-integrity-worker.js",
    protocol: "file-integrity",
  },
  "game-ecs-frame-update": {
    workerScript: "/demos/game-ecs-frame-update/worker.js",
    protocol: "ecs-frame",
  },
  "network-pcap-decode-v1": {
    workerScript: "/pcap-decode-worker.js",
    protocol: "pcap",
    tokenType: "string",
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
    workerScript: "/demos/simulation-nbody-cloth/worker.js",
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
    workerScript: "/demos/base/text.regex-log-scan.v1/worker.js",
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
};

// Map target name per protocol family
function formatTargetPayload(slug, target) {
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
      return { target: isWasm ? "wasm" : "javascript", mode: "preview" };
    case "gltf-viewer":
      return { type: "run", target: isWasm ? "wasm" : "javascript" };
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
async function executeWorkerLoop(slug, target, iterations = 30) {
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

  container.innerHTML = speedupBadgeHtml + graphHtml + tableHtml;
  container.querySelectorAll(".perf-bar[data-pct]").forEach((bar) => {
    bar.style.width = `${bar.dataset.pct}%`;
  });
  container.hidden = false;
}

// Auto-initialize benchmark detail page runner
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
      if (chosenTarget === "javascript") {
        statusEl.textContent = `Running JavaScript (${iterations}× loop)...`;
        const jsStats = await executeWorkerLoop(workloadSlug, "javascript", iterations);
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

        statusEl.textContent = `Running WebAssembly benchmark (${iterations}× loop)...`;
        const wasmStats = await executeWorkerLoop(workloadSlug, "wasm", iterations);

        statusEl.textContent = `✓ Benchmark suite completed across ${iterations} iterations.`;
        if (reportingEl) {
          renderPerformanceReport(reportingEl, jsStats, wasmStats, iterations);
        }
      }
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUnifiedRunner);
} else {
  initUnifiedRunner();
}

export { executeWorkerLoop, renderPerformanceReport, WORKLOAD_CONFIGS };

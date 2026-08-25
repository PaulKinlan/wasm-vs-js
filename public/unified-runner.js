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

  // Track network resources loaded during this execution run
  const resourceStartIndex = typeof performance !== "undefined" && performance.getEntriesByType
    ? performance.getEntriesByType("resource").length
    : 0;

  const durations = [];
  const computeDurations = [];
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
          if (msg.result) {
            lastResult = msg.result;
            const computeTime = extractComputeMs(msg.result, target);
            if (typeof computeTime === "number" && !isNaN(computeTime)) {
              computeDurations.push(computeTime);
            }
          }
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

  // Collect any network resources requested by this run (wasm, worker, data fixtures)
  const allResources = typeof performance !== "undefined" && performance.getEntriesByType
    ? performance.getEntriesByType("resource")
    : [];
  const newResources = allResources.slice(resourceStartIndex);
  const relevantResources = newResources.filter((r) =>
    r.name.includes(".wasm") ||
    r.name.includes("worker") ||
    r.name.includes(".f64") ||
    r.name.includes(".f32") ||
    r.name.includes(".bin") ||
    r.name.includes(".pcap") ||
    r.name.includes(".json") ||
    r.name.includes("/artifacts/") ||
    r.name.includes("/benchmarks/") ||
    r.name.includes("/dom-hosts/")
  );

  const networkAssets = relevantResources.map((r) => ({
    name: r.name.split("/").pop()?.split("?")[0] || r.name,
    fullUrl: r.name,
    transferBytes: r.transferSize || 0,
    decodedBytes: r.decodedBodySize || 0,
    durationMs: r.duration || 0,
    isCached: (r.transferSize === 0 && r.decodedBodySize > 0) || r.duration < 2,
  }));

  const coldMs = durations[0];
  const warmMsList = durations.slice(1);
  const sortedWarm = [...warmMsList].sort((a, b) => a - b);
  const warmMedianMs = sortedWarm.length > 0
    ? sortedWarm[Math.floor(sortedWarm.length / 2)]
    : coldMs;
  const minMs = Math.min(...durations);
  const maxMs = Math.max(...durations);

  const sortedCompute = [...computeDurations].sort((a, b) => a - b);
  const computeMedianMs = sortedCompute.length > 0
    ? sortedCompute[Math.floor(sortedCompute.length / 2)]
    : null;

  return {
    coldMs,
    warmMedianMs,
    minMs,
    maxMs,
    samples: durations,
    computeColdMs: computeDurations.length > 0 ? computeDurations[0] : null,
    computeMedianMs,
    computeSamples: computeDurations.length > 0 ? computeDurations : null,
    iterations: durations.length,
    networkAssets,
    lastResult,
  };
}

// Safely extract worker-internal pure compute measurement if reported
function extractComputeMs(res, target) {
  if (!res || typeof res !== "object") return null;
  const isWasm = target.includes("wasm");
  if (isWasm) {
    if (typeof res.wasm?.ms === "number") return res.wasm.ms;
    if (typeof res.wasm?.ms === "string" && !isNaN(parseFloat(res.wasm.ms))) {
      return parseFloat(res.wasm.ms);
    }
  } else {
    if (typeof res.js?.ms === "number") return res.js.ms;
    if (typeof res.js?.ms === "string" && !isNaN(parseFloat(res.js.ms))) {
      return parseFloat(res.js.ms);
    }
  }
  if (typeof res.computeMs === "number") return res.computeMs;
  if (typeof res.executionMs === "number") return res.executionMs;
  if (typeof res.durationMs === "number") return res.durationMs;
  if (typeof res.ms === "number") return res.ms;
  if (typeof res.ms === "string" && !isNaN(parseFloat(res.ms))) return parseFloat(res.ms);
  return null;
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

  const hasCompute = typeof jsStats?.computeMedianMs === "number" ||
    typeof wasmStats?.computeMedianMs === "number";
  const computeTh = hasCompute ? `<th>Raw Compute (Worker)</th>` : "";
  const jsComputeTd = hasCompute
    ? `<td>${
      typeof jsStats?.computeMedianMs === "number"
        ? jsStats.computeMedianMs.toFixed(2) + " ms"
        : "—"
    }</td>`
    : "";
  const wasmComputeTd = hasCompute
    ? `<td>${
      typeof wasmStats?.computeMedianMs === "number"
        ? wasmStats.computeMedianMs.toFixed(2) + " ms"
        : "—"
    }</td>`
    : "";

  const tableHtml = `
    <div class="execution-context-badge">
      <p class="notice">
        <strong>📦 Execution Level: Web Worker Pipeline (End-to-End)</strong> — Measures complete worker task dispatch, asset loading, memory transfers, compute execution, and oracle validation.
      </p>
    </div>
    <div class="table-wrap">
      <table class="results-table">
        <caption>Benchmark Suite Loop Execution Results (${iterations}× iterations)</caption>
        <thead>
          <tr>
            <th>Target Engine</th>
            <th>1st Run (Cold)</th>
            <th>Median (${iterations}× Warm)</th>
            ${computeTh}
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
            ${jsComputeTd}
            <td>${jsStats.minMs.toFixed(2)} ms</td>
            <td>${jsStats.maxMs.toFixed(2)} ms</td>
            <td>1.00× (Baseline)</td>
          </tr>
          <tr>
            <td><strong>WebAssembly</strong></td>
            <td>${wasmStats.coldMs.toFixed(2)} ms</td>
            <td>${wasmWarm.toFixed(2)} ms</td>
            ${wasmComputeTd}
            <td>${wasmStats.minMs.toFixed(2)} ms</td>
            <td>${wasmStats.maxMs.toFixed(2)} ms</td>
            <td><strong>${ratio}×</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const lifecycleHtml = renderLifecycleBreakdown(jsStats, wasmStats);

  const metricsGuideHtml = `
    <p class="notice">
      <strong>Reading the metrics:</strong>
      <strong>1st Run (Cold)</strong> measures initial pre-JIT execution before engine optimizations.
      <strong>Median (${iterations}× Warm)</strong> reflects steady-state throughput after JIT tier-up.
      ${
    hasCompute
      ? "<strong>Raw Compute</strong> isolates pure algorithm execution inside the worker from message transfer overhead. "
      : ""
  }
      <strong>Fastest (Min) / Slowest (Max)</strong> show execution variance and GC pauses.
    </p>
  `;

  container.innerHTML = speedupBadgeHtml + graphHtml + tableHtml + lifecycleHtml + metricsGuideHtml;
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
// are marked "not collected" — never invented. Also renders the Universal
// Asset Downloads, Caching & Resource Timing Audit from browser performance entries.
function renderLifecycleBreakdown(jsStats, wasmStats) {
  const parts = [];
  const jsLifecycle = jsStats?.lastResult?.lifecycle;
  const wasmLifecycle = wasmStats?.lastResult?.lifecycle;
  if (jsLifecycle || wasmLifecycle) {
    const row = (label, jsValue, wasmValue) =>
      `<tr><td>${label}</td><td>${lifecyclePhaseCell(jsValue)}</td><td>${
        lifecyclePhaseCell(wasmValue)
      }</td></tr>`;
    parts.push(`<div class="table-wrap lifecycle-breakdown">
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
      row(
        "Module network (Resource Timing)",
        jsLifecycle?.jsNetworkMs,
        wasmLifecycle?.wasmNetworkMs,
      )
    }
          ${row("Compile", "—", wasmLifecycle?.wasmCompileMs)}
          ${row("Instantiate", "—", wasmLifecycle?.wasmInstantiateMs)}
          ${row("First execute", jsLifecycle?.jsFirstExecuteMs, wasmLifecycle?.wasmFirstExecuteMs)}
        </tbody>
      </table>
    </div>`);
  }

  // Universal Asset Downloads, Caching & Resource Timing Audit
  const jsAssets = jsStats?.networkAssets ?? [];
  const wasmAssets = wasmStats?.networkAssets ?? [];
  const assetsMap = new Map();
  for (const a of [...jsAssets, ...wasmAssets]) {
    if (!assetsMap.has(a.name)) assetsMap.set(a.name, a);
  }
  const assets = Array.from(assetsMap.values());
  if (assets.length > 0) {
    const rows = assets.map((a) => {
      const statusText = a.isCached
        ? `⚡ Browser Cache (0 B wire transfer)`
        : `🌐 Network Fetch (${(a.transferBytes / 1024).toFixed(1)} KB wire)`;
      const decoded = a.decodedBytes > 0 ? `${(a.decodedBytes / 1024).toFixed(1)} KB` : "—";
      const duration = a.durationMs > 0 ? `${a.durationMs.toFixed(2)} ms` : "< 1 ms";
      return `<tr><td><code>${a.name}</code></td><td>${statusText}</td><td>${decoded}</td><td>${duration}</td></tr>`;
    }).join("");

    parts.push(`<div class="table-wrap">
      <table class="results-table">
        <caption>Asset Downloads, Caching &amp; Network Resource Timing</caption>
        <thead>
          <tr>
            <th>Asset / Resource</th>
            <th>Delivery &amp; Cache Status</th>
            <th>Decoded Size</th>
            <th>Fetch Latency</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`);
  }

  return parts.join("");
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
        statusEl.textContent = `Multi-language: ${m}`;
      },
      reportingEl: mlBox,
      heading: false,
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
      const result = await runIframeDomBenchmark({
        route: `${globalThis.location.pathname}${globalThis.location.search}`,
        iterations,
        targets: realDomTargets,
        timeoutMs: 240000,
        visible: true,
        keepAlive: true,
        container: iframeContainer,
        onProgress: ({ target, iteration, total }) => {
          statusEl.textContent = `Real-DOM run: ${
            target === "js" ? "JS" : "Wasm"
          } — iteration ${iteration}/${total}…`;
        },
      });
      // Scroll the kept iframe to show the rendered DOM UI (the DOM
      // is rendered at the bottom of the self-loaded page, but the
      // iframe viewport shows the page chrome by default).
      const iframeEl = iframeContainer.querySelector("iframe[data-wvj-bridge]");
      if (iframeEl && iframeEl.contentDocument) {
        const host = iframeEl.contentDocument.querySelector(
          "[data-wvj-dom-host], #wvj-dom-host, #wvj-todomvc-host",
        );
        if (host) {
          iframeEl.contentWindow?.scrollTo(0, host.offsetTop - 8);
        }
      }
      const jsStats = result.perTarget.js;
      const wasmStats = result.perTarget.wasm;
      const engineLabels = {
        c: "C / Wasm (real DOM)",
        cpp: "C++ / Wasm (real DOM)",
        rs: "Rust / Wasm (real DOM)",
        dart: "Dart / WasmGC (real DOM)",
      };
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
          `<tr><td class="mlr-th"><strong>${engineLabels[key]}</strong></td><td class="mlr-th">${
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

  // Render the Master Unified Benchmark Matrix & Explorer
  renderMasterUnifiedExplorer({
    flowEl,
    workloadSlug,
    primaryStats,
    multilangResults,
    domResults,
    manifest: multilangManifest,
    iterations,
  });
}

// Master Unified Benchmark Matrix & Explorer (Paul directive 2026-08-25):
// Consolidates all tested engines (JavaScript, Raw WAT, C, C++, Rust, Dart,
// AssemblyScript) into ONE unified master explorer table with segregated
// dimensions for pure algorithmic compute, worker/DOM pipeline overhead,
// asset downloads & caching, and total end-to-end time. Includes interactive
// filter tabs, a stacked visual breakdown chart, and raw CSV data export.
function renderMasterUnifiedExplorer({
  flowEl,
  workloadSlug,
  primaryStats,
  multilangResults,
  domResults,
  manifest,
  iterations,
}) {
  const previous = flowEl.querySelector(`[data-stage="master-explorer"]`);
  if (previous) previous.remove();

  const wrap = document.createElement("section");
  wrap.dataset.stage = "master-explorer";
  wrap.className = "stage-result master-explorer-section";

  const heading = document.createElement("h2");
  heading.textContent = "Unified Multi-Language Benchmark Explorer";
  wrap.appendChild(heading);

  const intro = document.createElement("p");
  intro.className = "notice";
  intro.innerHTML =
    "<strong>Complete lifecycle breakdown:</strong> Compares every language implementation across all phases — asset download &amp; caching, module compilation, pure algorithmic compute, and full worker/DOM pipeline overhead. Filter views using the buttons below or export raw CSV data.";
  wrap.appendChild(intro);

  const TOOLCHAIN_MAP = {
    js: "V8 JIT (in-browser)",
    wat: "Handwritten WAT → wasm",
    as: "asc -O3 --bindings none --noAssert",
    asc: "asc -O3 --bindings none --noAssert",
    assemblyscript: "asc -O3 --bindings none --noAssert",
    c: "clang --target=wasm32 -O3 -nostdlib",
    cpp: "clang++ --target=wasm32 -O3 -nostdlib",
    rs: "rustc --target wasm32-unknown-unknown -O --crate-type cdylib",
    dart: "dart compile wasm (dart2wasm, WasmGC)",
    kt: "kotlinc-wasm",
  };

  const records = [];
  const resources = typeof performance !== "undefined" && performance.getEntriesByType
    ? performance.getEntriesByType("resource")
    : [];

  const findResource = (pattern) => {
    if (!pattern) return null;
    const match = resources.find((r) => r.name.includes(pattern));
    if (!match) return null;
    return {
      name: match.name.split("/").pop()?.split("?")[0] || match.name,
      transferBytes: match.transferSize || 0,
      decodedBytes: match.decodedBodySize || 0,
      durationMs: match.duration || 0,
      isCached: (match.transferSize === 0 && match.decodedBodySize > 0) || match.duration < 2,
    };
  };

  const kernels = manifest?.kernels || (multilangResults ? Object.keys(multilangResults) : []);
  const primaryKernel = kernels[0] || "kernel";
  const kernelResults = multilangResults?.[primaryKernel] || [];

  if (manifest?.engines && manifest.engines.length > 0) {
    for (const eng of manifest.engines) {
      const ml = kernelResults.find((r) => r.key === eng.key);
      const resFile = eng.file || (eng.lang ? `${primaryKernel}_${eng.lang}.wasm` : null);
      const res = findResource(resFile) || findResource(eng.key);

      const isJs = eng.key === "js";
      const isLinearWasm = eng.key === "c" || eng.key === "cpp" || eng.key === "rs" ||
        eng.key === "wat";

      const algoMs = typeof ml?.medianMs === "number"
        ? ml.medianMs
        : isJs
        ? primaryStats?.jsStats?.computeMedianMs
        : primaryStats?.wasmStats?.computeMedianMs;

      const domMs = domResults?.perTarget?.[eng.key]?.warmMedianMs ?? null;

      let pipelineOverheadMs = null;
      if (isJs && primaryStats?.jsStats?.warmMedianMs && algoMs) {
        pipelineOverheadMs = Math.max(0, primaryStats.jsStats.warmMedianMs - algoMs);
      } else if (isLinearWasm && primaryStats?.wasmStats?.warmMedianMs && algoMs) {
        pipelineOverheadMs = Math.max(0, primaryStats.wasmStats.warmMedianMs - algoMs);
      }

      const coldMs = isJs && primaryStats?.jsStats
        ? primaryStats.jsStats.coldMs
        : isLinearWasm && primaryStats?.wasmStats
        ? primaryStats.wasmStats.coldMs
        : ml?.coldMs ?? domMs ?? algoMs;

      const warmMs = domMs ??
        (isJs && primaryStats?.jsStats
          ? primaryStats.jsStats.warmMedianMs
          : isLinearWasm && primaryStats?.wasmStats
          ? primaryStats.wasmStats.warmMedianMs
          : ml?.medianMs ?? algoMs);

      records.push({
        key: eng.key,
        label: eng.label,
        toolchain: TOOLCHAIN_MAP[eng.lang || eng.key] || eng.kind || "—",
        source: eng.source ||
          (eng.key === "wat" ? "benchmarks/v2/ml-dense-mlp/ml-dense-mlp.wat" : null),
        download: res,
        algoComputeMs: algoMs,
        pipelineOverheadMs: pipelineOverheadMs,
        domMs: domMs,
        coldMs: coldMs,
        warmMedianMs: warmMs,
        minMs: ml?.minMs ?? warmMs,
        maxMs: ml?.maxMs ?? warmMs,
      });
    }
  } else {
    if (primaryStats?.jsStats) {
      records.push({
        key: "js",
        label: "JavaScript",
        toolchain: "V8 JIT (in-browser)",
        source: null,
        download: findResource("worker"),
        algoComputeMs: primaryStats.jsStats.computeMedianMs,
        pipelineOverheadMs: primaryStats.jsStats.computeMedianMs
          ? Math.max(0, primaryStats.jsStats.warmMedianMs - primaryStats.jsStats.computeMedianMs)
          : null,
        domMs: domResults?.perTarget?.js?.warmMedianMs ?? null,
        coldMs: primaryStats.jsStats.coldMs,
        warmMedianMs: primaryStats.jsStats.warmMedianMs,
        minMs: primaryStats.jsStats.minMs,
        maxMs: primaryStats.jsStats.maxMs,
      });
    }
    if (primaryStats?.wasmStats) {
      records.push({
        key: "wasm",
        label: "WebAssembly",
        toolchain: "wasm32 (linear)",
        source: null,
        download: findResource(".wasm"),
        algoComputeMs: primaryStats.wasmStats.computeMedianMs,
        pipelineOverheadMs: primaryStats.wasmStats.computeMedianMs
          ? Math.max(
            0,
            primaryStats.wasmStats.warmMedianMs - primaryStats.wasmStats.computeMedianMs,
          )
          : null,
        domMs: domResults?.perTarget?.wasm?.warmMedianMs ?? null,
        coldMs: primaryStats.wasmStats.coldMs,
        warmMedianMs: primaryStats.wasmStats.warmMedianMs,
        minMs: primaryStats.wasmStats.minMs,
        maxMs: primaryStats.wasmStats.maxMs,
      });
    }
  }

  const jsWarm = records.find((r) => r.key === "js")?.warmMedianMs || 1;
  for (const r of records) {
    r.speedupRatio = (typeof r.warmMedianMs === "number" && r.warmMedianMs > 0)
      ? (jsWarm / r.warmMedianMs).toFixed(2) + "×"
      : "—";
  }

  // Filter Buttons
  const filterWrap = document.createElement("div");
  filterWrap.className = "results-filters";
  filterWrap.innerHTML = `
    <button type="button" class="active" data-view="all">All Dimensions &amp; Breakdown</button>
    <button type="button" data-view="compute">Pure Algorithmic Compute</button>
    <button type="button" data-view="pipeline">Pipeline &amp; Real-DOM Overhead</button>
    <button type="button" data-view="network">Asset Downloads &amp; Network</button>
  `;
  wrap.appendChild(filterWrap);

  // Visual Breakdown Stacked Chart
  const chartWrap = document.createElement("div");
  chartWrap.className = "perf-graph-card";
  const maxTime = Math.max(...records.map((r) => r.warmMedianMs || 0), 1);

  let chartBars = "";
  for (const r of records) {
    const compute = r.algoComputeMs || 0;
    const overhead = (r.domMs ?? r.pipelineOverheadMs) || 0;
    const total = r.warmMedianMs || (compute + overhead) || 1;
    const computePct = Math.min(100, Math.max(5, (compute / maxTime) * 100));
    const overheadPct = overhead > 0 ? Math.min(100, (overhead / maxTime) * 100) : 0;

    chartBars += `
      <div class="perf-bar-group" data-engine="${r.key}">
        <div class="perf-bar-label">
          <strong>${r.label}</strong>
          <span class="muted">${total.toFixed(2)} ms total (Compute: ${compute.toFixed(2)} ms${
      overhead > 0 ? `, Overhead: ${overhead.toFixed(2)} ms` : ""
    })</span>
        </div>
        <div class="perf-bar-track">
          <div class="perf-bar js-warm" data-pct="${computePct}" title="${r.label} Compute: ${
      compute.toFixed(2)
    } ms">
            <span>${compute.toFixed(1)}ms</span>
          </div>
          ${
      overhead > 0
        ? `<div class="perf-bar wasm-warm" data-pct="${overheadPct}" title="${r.label} Overhead: ${
          overhead.toFixed(2)
        } ms"><span>+${overhead.toFixed(1)}ms overhead</span></div>`
        : ""
    }
        </div>
      </div>
    `;
  }
  chartWrap.innerHTML =
    `<h3 class="perf-title">Execution Breakdown by Engine (ms)</h3>${chartBars}`;
  wrap.appendChild(chartWrap);

  // Master Table
  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap";
  const table = document.createElement("table");
  table.className = "results-table";

  const rows = records.map((r) => {
    let srcHtml = "—";
    if (r.source) {
      const name = r.source.split("/").pop();
      srcHtml =
        `<a class="commit-link" href="/${r.source}" target="_blank" rel="noopener">${name}</a>`;
    } else if (r.key === "js") {
      srcHtml = `<span class="muted">JS baseline</span>`;
    }

    const dl = r.download;
    const dlStatus = dl
      ? (dl.isCached ? "⚡ Cache (0 B)" : `🌐 Network (${(dl.transferBytes / 1024).toFixed(1)} KB)`)
      : "—";
    const dlLatency = dl && dl.durationMs > 0 ? `${dl.durationMs.toFixed(1)} ms` : "< 1 ms";
    const dlCell = dl
      ? `<div>${dlStatus}</div><div><small class="muted">${dlLatency}</small></div>`
      : "—";

    const computeCell = typeof r.algoComputeMs === "number"
      ? `${r.algoComputeMs.toFixed(2)} ms`
      : "—";
    const overheadCell = typeof r.domMs === "number"
      ? `<div>${r.domMs.toFixed(2)} ms</div><div><small class="muted">Real DOM</small></div>`
      : typeof r.pipelineOverheadMs === "number"
      ? `<div>${
        r.pipelineOverheadMs.toFixed(2)
      } ms</div><div><small class="muted">Worker pipe</small></div>`
      : "—";

    const coldCell = typeof r.coldMs === "number" ? `${r.coldMs.toFixed(2)} ms` : "—";
    const warmCell = typeof r.warmMedianMs === "number" ? `${r.warmMedianMs.toFixed(2)} ms` : "—";

    return `
      <tr data-engine="${r.key}">
        <td><strong>${r.label}</strong></td>
        <td><div>${srcHtml}</div><div><small><code>${r.toolchain}</code></small></div></td>
        <td class="col-download">${dlCell}</td>
        <td class="col-compute"><strong>${computeCell}</strong></td>
        <td class="col-overhead">${overheadCell}</td>
        <td>${coldCell}</td>
        <td><strong>${warmCell}</strong></td>
        <td><strong>${r.speedupRatio}</strong></td>
      </tr>
    `;
  }).join("");

  table.innerHTML = `
    <caption>Unified Multi-Language Benchmark Comparison (${iterations}× iterations)</caption>
    <thead>
      <tr>
        <th>Engine &amp; Language</th>
        <th>Source &amp; Toolchain</th>
        <th class="col-download">Download &amp; Cache</th>
        <th class="col-compute">Pure Algorithmic Compute</th>
        <th class="col-overhead">Pipeline / DOM Overhead</th>
        <th>1st Run (Cold)</th>
        <th>Median (Warm)</th>
        <th>Speedup Ratio</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);

  // CSV Data Export
  const csvLines = [
    [
      "Engine",
      "Language",
      "Toolchain",
      "DownloadStatus",
      "WireBytes",
      "LatencyMs",
      "AlgorithmicComputeMs",
      "PipelineOrDomOverheadMs",
      "ColdMs",
      "WarmMedianMs",
      "SpeedupRatio",
    ].join(","),
  ];
  for (const r of records) {
    csvLines.push([
      `"${r.label}"`,
      `"${r.key}"`,
      `"${r.toolchain}"`,
      `"${r.download?.isCached ? "Cached" : "Network"}"`,
      r.download?.transferBytes ?? 0,
      r.download?.durationMs?.toFixed(2) ?? 0,
      r.algoComputeMs?.toFixed(2) ?? "",
      (r.domMs ?? r.pipelineOverheadMs)?.toFixed(2) ?? "",
      r.coldMs?.toFixed(2) ?? "",
      r.warmMedianMs?.toFixed(2) ?? "",
      `"${r.speedupRatio}"`,
    ].join(","));
  }
  const csvString = csvLines.join("\n");

  const exportWrap = document.createElement("div");
  exportWrap.className = "table-wrap";
  exportWrap.innerHTML = `
    <div class="results-filters">
      <button type="button" class="copy-csv-btn">📋 Copy Raw CSV Data</button>
      <button type="button" class="download-csv-btn">💾 Download CSV File</button>
    </div>
    <details>
      <summary>View Raw Tabular Data</summary>
      <pre><code>${csvString}</code></pre>
    </details>
  `;
  wrap.appendChild(exportWrap);

  // Wire Filter Clicks
  const filterButtons = filterWrap.querySelectorAll("button[data-view]");
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.view;
      table.querySelectorAll(".col-download").forEach((c) => {
        c.hidden = mode === "compute" || mode === "pipeline";
      });
      table.querySelectorAll(".col-compute").forEach((c) => {
        c.hidden = mode === "network" || mode === "pipeline";
      });
      table.querySelectorAll(".col-overhead").forEach((c) => {
        c.hidden = mode === "network" || mode === "compute";
      });
    });
  });

  // Wire Copy CSV
  const copyBtn = exportWrap.querySelector(".copy-csv-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(csvString);
        copyBtn.textContent = "✓ CSV Copied to Clipboard!";
        setTimeout(() => {
          copyBtn.textContent = "📋 Copy Raw CSV Data";
        }, 2500);
      } catch {
        copyBtn.textContent = "Failed to copy";
      }
    });
  }

  // Wire Download CSV
  const dlBtn = exportWrap.querySelector(".download-csv-btn");
  if (dlBtn) {
    dlBtn.addEventListener("click", () => {
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${workloadSlug || "benchmark"}-results.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Set bar widths via CSSOM
  wrap.querySelectorAll(".perf-bar[data-pct]").forEach((bar) => {
    bar.style.width = `${bar.dataset.pct}%`;
  });

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
          // The composed-stage failure must not be masked by a success banner.
          throw composedErr;
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

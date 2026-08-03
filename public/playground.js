// Interactive Benchmark Playground
// Runs JS vs Wasm benchmarks in a multi-iteration loop to observe cold vs warm runtime optimizations.

const PLAYGROUND_WORKLOADS = [
  {
    slug: "sum-u32",
    title: "Modulo-2³² Integer Sum",
    category: "Compute Kernel",
    workerScript: "/hosted-runner-worker.js",
    type: "hosted",
    description: "Sums 1,000,000 integers with 32-bit overflow wrapping.",
    explanation: "Tests basic 32-bit integer arithmetic loop performance.",
  },
  {
    slug: "audio-fft",
    title: "Radix-2 Complex FFT",
    category: "Digital Signal Processing",
    workerScript: "/demo-worker.js",
    type: "demo",
    description: "Transforms 4,096 audio frequency samples using Fast Fourier Transform.",
    explanation: "Used in audio equalizers, visualization, and spectral filtering.",
  },
  {
    slug: "audio-fir",
    title: "Direct 256-Tap FIR Convolution",
    category: "Digital Signal Processing",
    workerScript: "/demo-worker.js",
    type: "demo",
    description: "Applies a 256-tap Finite Impulse Response filter to an audio stream.",
    explanation: "Heavy inner product multiply-accumulate operations.",
  },
  {
    slug: "audio-stft",
    title: "Short-Time Fourier Transform",
    category: "Digital Signal Processing",
    workerScript: "/demo-worker.js",
    type: "demo",
    description: "Computes audio spectrograms across overlapping window frames.",
    explanation: "Used for real-time speech, audio analysis, and spectrogram rendering.",
  },
  {
    slug: "ml-gemm",
    title: "Batched Matrix Multiply (GEMM)",
    category: "Neural & AI",
    workerScript: "/benchmarks/ml-gemm/neural-gemm-worker.js",
    type: "demo",
    description: "Multiplies large 512×512 floating-point matrices in f32.",
    explanation: "Essential for machine learning models, 3D graphics, and physics.",
  },
  {
    slug: "ml-dense-mlp",
    title: "9-Layer Deep Neural Network (MLP)",
    category: "Neural & AI",
    workerScript: "/benchmarks/ml-dense-mlp/neural-mlp-worker.js",
    type: "demo",
    description: "Evaluates a 9-layer neural network (147,456 weights) with GELU activation.",
    explanation: "Used in on-device AI inference and deep learning models.",
  },
  {
    slug: "vdom-diff-patch-demo",
    title: "Virtual DOM Diff & Patch",
    category: "DOM & Web UI",
    workerScript: null,
    route: "/benchmarks/vdom-diff-patch-demo/",
    description: "Diffs 1,000 tree nodes with 250 edits to calculate DOM update patches.",
    explanation: "Used by modern UI frameworks like React and Vue to update the DOM efficiently.",
  },
  {
    slug: "image-editing-demo",
    title: "Image Gaussian Blur Pipeline",
    category: "Graphics & Media",
    workerScript: null,
    route: "/benchmarks/image-editing-demo/",
    description: "Applies separable Gaussian blur to pixel arrays.",
    explanation: "2D pixel array convolution and image filter processing.",
  },
  {
    slug: "image-flood-fill-demo",
    title: "Span-Stack Image Flood Fill",
    category: "Graphics & Media",
    description: "Fills contiguous pixel regions using span-stack stack operations.",
    explanation: "Used in paint tools (bucket fill) and image segmentation.",
  },
  {
    slug: "regex-automata-duel-demo",
    title: "Regex Automata Duel (JS vs Wasm DFA)",
    category: "Text & Parsing",
    description: "Scans 1 MB text log matching complex regex patterns.",
    explanation: "Compares JS RegExp engine vs compiled WebAssembly DFA state machine.",
  },
  {
    slug: "game-canvas-arcade",
    title: "Canvas Arcade Game Engine",
    category: "Game Simulation",
    description:
      "Simulates arcade game physics, collision detection, and audio state across 60 frames.",
    explanation: "Object state updates and 2D collision detection loops.",
  },
  {
    slug: "game-canvas-entity-pathfinding",
    title: "Canvas Entity Pathfinding",
    category: "Game Simulation",
    description: "Runs A* pathfinding for 128 game entities on a grid map with ECS updates.",
    explanation: "Priority queue heap operations and grid traversal.",
  },
  {
    slug: "text-diff-patch",
    title: "Unicode Line Diff & Patch",
    category: "Text & Parsing",
    description: "Calculates Myers line-by-line diffs across multi-line text files.",
    explanation: "Dynamic programming matrix allocation and string comparisons.",
  },
  {
    slug: "text-markdown-cms",
    title: "Markdown CMS Render Pipeline",
    category: "Text & Parsing",
    description: "Parses Markdown documents into sanitized HTML syntax trees.",
    explanation: "Text parsing, character scanning, and string building.",
  },
  // ── Base catalog workloads (merged from catalog shards) ──
  {
    slug: "cad-mesh-repair-v1",
    title: "3D Mesh Quantization & Repair",
    category: "CAD & Engineering",
    workerScript: "/benchmarks/cad-mesh-repair-v1/worker.js",
    workerProtocol: "target-only",
    wasmTarget: "wasm",
    route: "/benchmarks/cad-mesh-repair-v1/",
    description:
      "Welds, orients, removes degenerate faces, and simplifies a dirty STL mesh to 50%.",
    explanation:
      "Integer quantization and adjacency-map operations common in 3D printing and CAD pipelines.",
  },
  {
    slug: "database-sqlite-notebook-v1",
    title: "SQLite Analytical Notebook",
    category: "Database",
    workerScript: null,
    route: "/benchmarks/database-sqlite-notebook-v1/",
    description:
      "Imports a sales CSV, creates indexes, and runs eight joins, group-bys, and window queries.",
    explanation:
      "Heavy SQL parsing, query planning, and B-tree traversal in both JS (AlaSQL) and Wasm (SQLite).",
  },
  {
    slug: "document-pdf-viewer-v1",
    title: "PDF Document Parsing & Rendering",
    category: "Document Processing",
    workerScript: "/benchmarks/document-pdf-viewer-v1/worker.js",
    workerProtocol: "target-only",
    wasmTarget: "wasm-linear",
    route: "/benchmarks/document-pdf-viewer-v1/",
    description:
      "Opens a 100-page report, searches for a term, and rasterizes five pages to bitmaps.",
    explanation:
      "Cross-reference table traversal, content stream decoding, and pixel rasterization.",
  },
  {
    slug: "base-dom-todomvc-journey",
    title: "TodoMVC User Journey",
    category: "DOM & Web UI",
    workerScript: "/benchmarks/base-dom-todomvc-journey/worker.js",
    workerProtocol: "variant",
    route: "/benchmarks/base-dom-todomvc-journey/",
    description:
      "Adds, completes, filters, edits, and removes 100 todos through a full TodoMVC interaction.",
    explanation:
      "DOM mutation, event dispatch, and virtual-dom reconciliation under realistic user interaction.",
  },
  {
    slug: "archive-zip-workspace-v1",
    title: "ZIP Archive Compression Workspace",
    category: "Compression & Archival",
    workerScript: null,
    route: "/benchmarks/archive-zip-workspace-v1/",
    description:
      "Zips 10,000 mixed files, lists entries, and extracts selected paths with SHA-256 verification.",
    explanation: "DEFLATE compression, central-directory parsing, and CRC-32 checksum validation.",
  },
  {
    slug: "crypto-authenticated-stream",
    title: "ChaCha20-Poly1305 Stream Encryption",
    category: "Cryptography",
    workerScript: null,
    route: "/benchmarks/crypto-authenticated-stream/",
    description: "Encrypts, verifies, and decrypts 10,000 deterministic message frames with AEAD.",
    explanation:
      "ChaCha20 keystream generation and Poly1305 MAC computation over structured frames.",
  },
  {
    slug: "graphics-cpu-path-tracer-v1",
    title: "CPU Ray-Tracing Path Tracer",
    category: "Graphics & Rendering",
    workerScript: "/benchmarks/graphics-cpu-path-tracer-v1/worker.js",
    workerProtocol: "target-only",
    wasmTarget: "wasm",
    route: "/benchmarks/graphics-cpu-path-tracer-v1/",
    description: "Renders a deterministic 512×512 product preview at 64 samples per pixel.",
    explanation: "Ray-scene intersection, BSDF sampling, and Monte Carlo integration on the CPU.",
  },
  {
    slug: "simulation-nbody-cloth",
    title: "N-Body Particle Simulation",
    category: "Physics Simulation",
    workerScript: "/demos/simulation-nbody-cloth/worker.js",
    workerProtocol: "variant",
    route: "/demos/simulation-nbody-cloth/",
    description:
      "Advances 1,024 seeded bodies with a direct all-pairs gravitational solver for fixed timesteps.",
    explanation: "O(n²) force computation and velocity integration with strict-f32 arithmetic.",
  },
  {
    slug: "simulation-rigid-body-2d-v1",
    title: "2D Rigid-Body Physics Engine",
    category: "Physics Simulation",
    workerScript: "/benchmarks/simulation-rigid-body-2d-v1/worker.js",
    workerProtocol: "rigid-body",
    route: "/benchmarks/simulation-rigid-body-2d-v1/",
    description:
      "Settles 500 stacked boxes and joints over fixed timesteps with constraint solving.",
    explanation:
      "Broad-phase collision detection, contact resolution, and sequential impulse solving.",
  },
  {
    slug: "tooling-c-to-wasm-compile-v1",
    title: "C-to-Wasm Compiler",
    category: "Developer Tooling",
    workerScript: "/benchmarks/tooling-c-to-wasm-compile-v1/worker.js",
    workerProtocol: "target-only",
    wasmTarget: "wasm",
    route: "/benchmarks/tooling-c-to-wasm-compile-v1/",
    description: "Compiles and links 20 small C programs to WebAssembly modules in the browser.",
    explanation: "Lexing, parsing, type checking, code generation, and binary module emission.",
  },
  // ── Additional base catalog workloads with demo routes ──
  {
    slug: "base-gltf-viewer",
    title: "glTF Model Viewer",
    category: "Graphics & Rendering",
    workerScript: "/benchmarks/base-gltf-viewer/worker.js",
    workerProtocol: "target-only",
    wasmTarget: "wasm",
    route: "/benchmarks/base-gltf-viewer/",
    description:
      "Loads a product model, decodes Draco compression, animates 600 frames, and picks objects.",
    explanation: "Binary asset parsing, mesh decoding, and matrix-transform animation on the CPU.",
  },
  {
    slug: "database-olap-chart",
    title: "Interactive OLAP Column Scan",
    category: "Database",
    workerScript: "/benchmarks/database-olap-chart/worker.js",
    workerProtocol: "variant",
    route: "/benchmarks/database-olap-chart/",
    description:
      "Filters, sorts, and aggregates columns while a chart user changes controls interactively.",
    explanation: "Columnar scan, predicate pushdown, and hash aggregation over tabular data.",
  },
  {
    slug: "dom-virtualized-grid-v1",
    title: "Virtualized Data Grid",
    category: "DOM & Web UI",
    workerScript: null,
    route: "/benchmarks/dom-virtualized-grid-v1/",
    description:
      "Scrolls, filters, sorts, and edits 100,000 rows over a recorded interaction trace.",
    explanation:
      "Windowed DOM rendering, sort-index maintenance, and efficient recycle-pool management.",
  },
  {
    slug: "ml-keyword-spotting-v1",
    title: "Keyword Spotting Stream",
    category: "Neural & AI",
    workerScript: null,
    route: "/benchmarks/ml-keyword-spotting-v1/",
    description: "Processes 60 seconds of audio in 20 ms hops and detects spoken commands.",
    explanation: "Convolutional and dense-layer inference over streaming mel-spectrogram features.",
  },
  {
    slug: "ml-numeric-kernels-v1",
    title: "ML Numeric Kernels",
    category: "Neural & AI",
    workerScript: null,
    route: "/benchmarks/ml-numeric-kernels-v1/",
    description:
      "Exercises inference-runtime inner loops (GEMM, convolution, softmax) over frozen tensors.",
    explanation:
      "Core tensor operations that dominate latency in on-device neural network inference.",
  },
  {
    slug: "numeric-fft-spectral-filter-v1",
    title: "FFT Spectral Filter",
    category: "Numeric & Scientific",
    workerScript: "/benchmarks/numeric-fft-spectral-filter-v1/worker.js",
    workerProtocol: "variant",
    route: "/benchmarks/numeric-fft-spectral-filter-v1/",
    description:
      "Windows, transforms, filters, and inverse-transforms a multi-channel sensor trace.",
    explanation:
      "Overlap-add FFT convolution and frequency-domain mask application for signal conditioning.",
  },
  {
    slug: "serialization-protobuf-gateway",
    title: "Protobuf Gateway",
    category: "Serialization",
    workerScript: null,
    route: "/benchmarks/serialization-protobuf-gateway/",
    description:
      "Decodes Protocol Buffer messages, filters records, and emits ProtoJSON responses.",
    explanation:
      "Varint decoding, field-tag dispatch, and JSON serialization of nested message types.",
  },
  {
    slug: "cad-parametric-bracket",
    title: "Parametric Bracket Build",
    category: "CAD & Engineering",
    workerScript: "/demos/cad-parametric-bracket/worker.js",
    workerProtocol: "variant",
    route: "/demos/cad-parametric-bracket/",
    description:
      "Builds boxes, cylinders, boolean holes, fillets, and tessellates a parametric bracket.",
    explanation:
      "CSG boolean operations, edge filleting, and triangle tessellation for manufacturing.",
  },
  {
    slug: "crypto-file-integrity-v1",
    title: "SHA-256 File Integrity",
    category: "Cryptography",
    workerScript: null,
    route: "/demos/crypto.file-integrity.v1/",
    description: "Verifies downloaded assets with SHA-256 using fixed chunk schedules.",
    explanation:
      "Block-level hash compression and streaming digest updates over file-sized inputs.",
  },
  {
    slug: "game-dom-tactics-grid",
    title: "DOM Tactics Grid",
    category: "Game Simulation",
    workerScript: null,
    route: "/demos/game-dom-tactics-grid/",
    description:
      "Runs turn-based movement, range calculation, and AI pathfinding on a tactics grid.",
    explanation: "Grid traversal, BFS flood-fill, and heuristic-based decision trees for game AI.",
  },
  {
    slug: "game-ecs-frame-update",
    title: "Game-Frame ECS Update",
    category: "Game Simulation",
    workerScript: "/demos/game-ecs-frame-update/worker.js",
    workerProtocol: "variant",
    route: "/demos/game-ecs-frame-update/",
    description:
      "Updates movement, collision broadphase, and animation state for 10,000 entities per frame.",
    explanation:
      "Entity-component-system archetype iteration, AABB broadphase, and skeletal animation.",
  },
  {
    slug: "network-pcap-decode-v1",
    title: "PCAP Protocol Decode",
    category: "Networking",
    workerScript: null,
    route: "/demos/network.pcap-decode.v1/",
    description:
      "Parses Ethernet, IP, TCP, DNS, and HTTP records from a capture into a flow table.",
    explanation:
      "Layered protocol dissection, checksum validation, and connection-state reconstruction.",
  },
  {
    slug: "numeric-polybench-panel-v1",
    title: "PolyBench Numeric Panel",
    category: "Numeric & Scientific",
    workerScript: null,
    route: "/demos/numeric.polybench-panel.v1/",
    description: "Runs GEMM, Cholesky decomposition, stencil, and Jacobi-2D notebook kernels.",
    explanation:
      "Dense linear algebra and iterative stencil solvers from the PolyBench benchmark suite.",
  },
  {
    slug: "serialization-json-telemetry-v1",
    title: "JSON Telemetry Pipeline",
    category: "Serialization",
    workerScript: null,
    route: "/demos/serialization.json-telemetry.v1/",
    description:
      "Parses nested multilingual events, runs fixed aggregates, and serializes a canonical summary.",
    explanation: "Streaming JSON tokenizer, tree construction, and canonical re-serialization.",
  },
  {
    slug: "server-ssr-template-v1",
    title: "Template & SSR Endpoint",
    category: "Server & SSR",
    workerScript: null,
    route: "/demos/server.ssr-template.v1/",
    description: "Renders 1,000 personalized catalog HTML responses from a template engine.",
    explanation:
      "String interpolation, partial composition, and HTML escaping at server-render scale.",
  },
  {
    slug: "text-gc-document-edit-v1",
    title: "GC-Rich Document Editor",
    category: "Text & Parsing",
    workerScript: null,
    route: "/demos/text.gc-document-edit.v1/",
    description: "Parses a tree and executes 10,000 insert, delete, and reparent operations.",
    explanation: "Piece-table or rope-based document model with garbage-collection-aware editing.",
  },
];

// Execute workload for N iterations, measuring first (cold) vs subsequent (warm) iterations
async function runTimedLoop(config, target, iterations = 30) {
  const { workerScript: workerScript_, slug, workerProtocol, wasmTarget } = config;
  const effectiveTarget = target === "wasm-linear" && wasmTarget ? wasmTarget : target;
  const durations = [];

  for (let i = 0; i < iterations; i++) {
    const res = await new Promise((resolve, reject) => {
      const worker = new Worker(workerScript_, { type: "module" });
      const token = Math.floor(Math.random() * 1000000);
      const start = performance.now();

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error("Timeout"));
      }, 30000);

      worker.addEventListener("message", (event) => {
        const msg = event.data;
        if (!msg || msg.token !== token) return;
        // Accept varied success signals from different worker families
        if (
          msg.type === "completed" || msg.type === "done" ||
          msg.type === "complete" || msg.type === "result" ||
          msg.ok === true
        ) {
          clearTimeout(timeout);
          const time = performance.now() - start;
          worker.terminate();
          resolve(time);
        } else if (msg.type === "failed" || msg.type === "error") {
          clearTimeout(timeout);
          worker.terminate();
          reject(new Error(msg.message || "Failed"));
        }
      });

      worker.addEventListener("error", (err) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(err);
      });

      if (slug === "sum-u32") {
        worker.postMessage({
          token,
          type: "run",
          jsCode:
            "export function run() { let s = 0; for (let i = 0; i < 1000000; i++) s = (s + i) | 0; return s; }",
          wasmBytes: new Uint8Array([
            0,
            97,
            115,
            109,
            1,
            0,
            0,
            0,
            1,
            5,
            1,
            96,
            0,
            1,
            127,
            3,
            2,
            1,
            0,
            7,
            7,
            1,
            3,
            114,
            117,
            110,
            0,
            0,
            10,
            23,
            1,
            21,
            1,
            1,
            127,
            65,
            0,
            33,
            0,
            65,
            0,
            33,
            1,
            3,
            64,
            32,
            0,
            65,
            1,
            106,
            33,
            0,
            32,
            1,
            32,
            0,
            106,
            33,
            1,
            32,
            0,
            65,
            192,
            196,
            7,
            102,
            13,
            0,
            11,
            32,
            1,
            11,
          ]),
          batchSize: 10,
          iterations: 1,
          mode: "validation",
        });
      } else if (workerProtocol === "target-only") {
        worker.postMessage({ token, target: effectiveTarget });
      } else if (workerProtocol === "variant") {
        const variantId = target === "javascript" ? "js-controlled" : "wasm-linear-controlled";
        worker.postMessage({ type: "start", token, variantId });
      } else if (workerProtocol === "rigid-body") {
        worker.postMessage({ token, type: "start", target: effectiveTarget });
      } else {
        worker.postMessage({ token, slug, target: effectiveTarget, mode: "bounded" });
      }
    });

    durations.push(res);
  }

  // Statistics
  const coldTime = durations[0];
  const warmTimes = durations.slice(1);
  const sortedWarm = [...warmTimes].sort((a, b) => a - b);
  const medianWarm = sortedWarm.length > 0
    ? sortedWarm[Math.floor(sortedWarm.length / 2)]
    : coldTime;
  const totalMs = durations.reduce((a, b) => a + b, 0);

  return { coldMs: coldTime, medianWarmMs: medianWarm, totalMs, samples: durations.length };
}

async function runBenchmarkPair(config, cardElement, iterations = 30) {
  const statusEl = cardElement.querySelector(".playground-status");
  const resultsEl = cardElement.querySelector(".playground-metrics");

  statusEl.textContent = `Running JS (${iterations}× loop)...`;
  statusEl.className = "playground-status running";

  try {
    const jsStats = await runTimedLoop(config, "javascript", iterations);

    statusEl.textContent = `Running Wasm (${iterations}× loop)...`;
    const wasmStats = await runTimedLoop(config, "wasm-linear", iterations);

    const speedupWarm = (jsStats.medianWarmMs / wasmStats.medianWarmMs).toFixed(2);
    const speedupCold = (jsStats.coldMs / wasmStats.coldMs).toFixed(2);

    let speedupBadge = "";
    if (parseFloat(speedupWarm) > 1.05) {
      speedupBadge =
        `<span class="badge-speedup wasm">Wasm is ${speedupWarm}x faster (warm)</span>`;
    } else if (parseFloat(speedupWarm) < 0.95) {
      speedupBadge = `<span class="badge-speedup js">JS is ${
        (1 / parseFloat(speedupWarm)).toFixed(2)
      }x faster (warm)</span>`;
    } else {
      speedupBadge = `<span class="badge-speedup tie">JS & Wasm equal speed</span>`;
    }

    statusEl.textContent = "✓ Complete";
    statusEl.className = "playground-status passed";

    resultsEl.innerHTML = `
      <div class="result-table">
        <div class="result-header">
          <span>Engine</span>
          <span>1st Run (Cold)</span>
          <span>Median (${iterations}× Warm)</span>
        </div>
        <div class="result-row">
          <span>JavaScript</span>
          <span>${jsStats.coldMs.toFixed(2)} ms</span>
          <span>${jsStats.medianWarmMs.toFixed(2)} ms</span>
        </div>
        <div class="result-row">
          <span>WebAssembly</span>
          <span>${wasmStats.coldMs.toFixed(2)} ms</span>
          <span>${wasmStats.medianWarmMs.toFixed(2)} ms</span>
        </div>
      </div>
      <div class="result-summary-bar">
        ${speedupBadge}
        <span class="cold-ratio">Cold ratio: ${speedupCold}x</span>
      </div>
    `;

    return { slug: config.slug, passed: true, jsStats, wasmStats, speedupWarm };
  } catch (err) {
    console.error(`Benchmark error [${config.slug}]:`, err);
    statusEl.textContent = "✕ Error";
    statusEl.className = "playground-status failed";
    resultsEl.textContent = `Run error: ${err.message}`;
    return { slug: config.slug, passed: false, error: err.message };
  }
}

function initPlaygroundUI() {
  const container = document.getElementById("playground-cards");
  const runAllBtn = document.getElementById("pg-run-all");
  const iterSelect = document.getElementById("pg-iterations");
  const progressContainer = document.getElementById("pg-progress-wrap");
  const progressBar = document.getElementById("pg-progress-bar");
  const progressText = document.getElementById("pg-progress-text");

  if (!container) return;

  container.innerHTML = "";

  PLAYGROUND_WORKLOADS.forEach((config) => {
    const card = document.createElement("div");
    card.className = "playground-card";
    card.dataset.slug = config.slug;

    const hasWorker = Boolean(config.workerScript);
    const demoRoute = config.route || `/benchmarks/${config.slug}/`;

    card.innerHTML = `
      <div class="pg-card-header">
        <span class="pg-cat-badge">${config.category}</span>
        <span class="playground-status idle">Idle</span>
      </div>
      <h3>${config.title}</h3>
      <p class="pg-desc"><strong>What it does:</strong> ${config.description}</p>
      <p class="pg-expl"><strong>Why compare:</strong> ${config.explanation}</p>
      <div class="playground-metrics">Select iteration count and click "Run Test Loop" to compare timing.</div>
      <div class="pg-card-actions">
        ${
      hasWorker
        ? `<button type="button" class="btn-pg-run">Run Test Loop (${
          iterSelect ? iterSelect.value : 30
        }×)</button>`
        : ""
    }
        <a href="${demoRoute}" class="btn-pg-link">Inspect Demo Details →</a>
      </div>
    `;

    if (hasWorker) {
      card.querySelector(".btn-pg-run").addEventListener("click", () => {
        const iterations = Number(iterSelect.value);
        runBenchmarkPair(config, card, iterations);
      });
    }

    container.appendChild(card);
  });

  if (iterSelect) {
    iterSelect.addEventListener("change", () => {
      const iter = iterSelect.value;
      container.querySelectorAll(".btn-pg-run").forEach((btn) => {
        btn.textContent = `Run Test Loop (${iter}×)`;
      });
    });
  }

  if (runAllBtn) {
    runAllBtn.addEventListener("click", async () => {
      const iterations = Number(iterSelect.value);
      runAllBtn.disabled = true;
      progressContainer.hidden = false;

      const workerConfigs = PLAYGROUND_WORKLOADS.filter((c) => Boolean(c.workerScript));
      let completed = 0;
      let passedCount = 0;

      for (const config of workerConfigs) {
        progressText.textContent = `Running benchmark ${
          completed + 1
        } of ${workerConfigs.length}: ${config.title} (${iterations}× loop)...`;
        const card = container.querySelector(`[data-slug="${config.slug}"]`);
        const res = await runBenchmarkPair(config, card, iterations);

        if (res.passed) passedCount++;
        completed++;
        const pct = Math.round((completed / workerConfigs.length) * 100);
        progressBar.style.width = `${pct}%`;
      }

      progressText.textContent =
        `Suite run complete: ${passedCount} / ${workerConfigs.length} benchmarks executed across ${iterations} iterations!`;
      runAllBtn.disabled = false;
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPlaygroundUI);
} else {
  initPlaygroundUI();
}

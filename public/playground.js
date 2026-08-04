// Interactive Benchmark Playground & Master Suite Runner
// Runs JS vs Wasm benchmarks in multi-iteration loops to measure cold vs warm execution performance.

import { executeWorkerLoop, renderPerformanceReport } from "./unified-runner.js";

const PLAYGROUND_WORKLOADS = [
  {
    slug: "sum-u32",
    title: "Modulo-2³² Integer Sum",
    category: "Compute Kernel",
    route: "/run/",
    description: "Sums 1,000,000 integers with 32-bit overflow wrapping.",
    explanation: "Basic 32-bit integer arithmetic loop performance.",
  },
  {
    slug: "audio-fft",
    title: "Radix-2 Complex FFT",
    category: "Digital Signal Processing",
    route: "/benchmarks/audio-fft/",
    description: "Transforms 4,096 audio frequency samples using Fast Fourier Transform.",
    explanation: "Used in audio equalizers, visualization, and spectral filtering.",
  },
  {
    slug: "audio-fir",
    title: "Direct 256-Tap FIR Convolution",
    category: "Digital Signal Processing",
    route: "/benchmarks/audio-fir/",
    description: "Applies a 256-tap Finite Impulse Response filter to an audio stream.",
    explanation: "Heavy inner product multiply-accumulate operations.",
  },
  {
    slug: "audio-stft",
    title: "Short-Time Fourier Transform",
    category: "Digital Signal Processing",
    route: "/benchmarks/audio-stft/",
    description: "Computes audio spectrograms across overlapping window frames.",
    explanation: "Used for real-time speech, audio analysis, and spectrogram rendering.",
  },
  {
    slug: "ml-gemm",
    title: "Batched Matrix Multiply (GEMM)",
    category: "Neural & AI",
    route: "/benchmarks/ml-gemm/",
    description: "Multiplies large 512×512 floating-point matrices in f32.",
    explanation: "Essential for machine learning models, 3D graphics, and physics.",
  },
  {
    slug: "ml-dense-mlp",
    title: "9-Layer Deep Neural Network (MLP)",
    category: "Neural & AI",
    route: "/benchmarks/ml-dense-mlp/",
    description: "Evaluates a 9-layer neural network (147,456 weights) with GELU activation.",
    explanation: "Used in on-device AI inference and deep learning models.",
  },
  {
    slug: "cad-mesh-repair-v1",
    title: "3D Mesh Quantization & Repair",
    category: "CAD & Engineering",
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
    route: "/benchmarks/database-sqlite-notebook-v1/",
    description:
      "Imports a sales CSV, creates indexes, and runs eight joins, group-bys, and window queries.",
    explanation:
      "Heavy SQL parsing, query planning, and B-tree traversal in both JS (AlaSQL) and Wasm (SQLite).",
    // AlaSQL compiles queries via eval-class primitives; the site CSP allows
    // 'unsafe-eval' (approved by Paul 2026-08-04), so both targets run here.
  },
  {
    slug: "document-pdf-viewer-v1",
    title: "PDF Document Parsing & Rendering",
    category: "Document Processing",
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
    route: "/benchmarks/archive-zip-workspace-v1/",
    description:
      "Zips 10,000 mixed files, lists entries, and extracts selected paths with SHA-256 verification.",
    explanation: "DEFLATE compression, central-directory parsing, and CRC-32 checksum validation.",
  },
  {
    slug: "crypto-authenticated-stream",
    title: "ChaCha20-Poly1305 Stream Encryption",
    category: "Cryptography",
    route: "/benchmarks/crypto-authenticated-stream/",
    description: "Encrypts, verifies, and decrypts 10,000 deterministic message frames with AEAD.",
    explanation:
      "ChaCha20 keystream generation and Poly1305 MAC computation over structured frames.",
  },
  {
    slug: "graphics-cpu-path-tracer-v1",
    title: "CPU Ray-Tracing Path Tracer",
    category: "Graphics & Rendering",
    route: "/benchmarks/graphics-cpu-path-tracer-v1/",
    description: "Renders a deterministic 512×512 product preview at 64 samples per pixel.",
    explanation: "Ray-scene intersection, BSDF sampling, and Monte Carlo integration on the CPU.",
  },
  {
    slug: "base-gltf-viewer",
    title: "glTF Model Viewer",
    category: "Graphics & Rendering",
    route: "/benchmarks/base-gltf-viewer/",
    description:
      "Loads a product model, decodes Draco compression, animates 600 frames, and picks objects.",
    explanation: "Binary asset parsing, mesh decoding, and matrix-transform animation on the CPU.",
  },
  {
    slug: "database-olap-chart",
    title: "Interactive OLAP Column Scan",
    category: "Database",
    route: "/benchmarks/database-olap-chart/",
    description:
      "Filters, sorts, and aggregates columns while a chart user changes controls interactively.",
    explanation: "Columnar scan, predicate pushdown, and hash aggregation over tabular data.",
  },
  {
    slug: "dom-virtualized-grid-v1",
    title: "Virtualized Data Grid",
    category: "DOM & Web UI",
    route: "/benchmarks/dom-virtualized-grid-v1/",
    description:
      "Scrolls, filters, sorts, and edits 100,000 rows over a recorded interaction trace.",
    explanation:
      "Windowed DOM rendering, sort-index maintenance, and efficient recycle-pool management.",
    // The worker replays a wall-clock-paced interaction trace with ±20 ms
    // slot validation; inside a shared playground page the pacing blows the
    // tolerance, so this one stays on its own demo page.
    manual: "Runs a real-time paced trace that needs an idle page — use the demo page.",
  },
  {
    slug: "ml-keyword-spotting-v1",
    title: "Keyword Spotting Stream",
    category: "Neural & AI",
    route: "/benchmarks/ml-keyword-spotting-v1/",
    description: "Processes 60 seconds of audio in 20 ms hops and detects spoken commands.",
    explanation: "Convolutional and dense-layer inference over streaming mel-spectrogram features.",
    // The pinned fixture is bundled (CC BY 4.0 with attribution; owner-approved
    // 2026-08-04), so the worker fetches and hash-verifies it automatically.
  },
  {
    slug: "ml-numeric-kernels-v1",
    title: "ML Numeric Kernels",
    category: "Neural & AI",
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
    route: "/demos/crypto.file-integrity.v1/",
    description: "Verifies downloaded assets with SHA-256 using fixed chunk schedules.",
    explanation:
      "Block-level hash compression and streaming digest updates over file-sized inputs.",
  },
  {
    slug: "game-dom-tactics-grid",
    title: "DOM Tactics Grid",
    category: "Game Simulation",
    route: "/demos/game-dom-tactics-grid/",
    description:
      "Runs turn-based movement, range calculation, and AI pathfinding on a tactics grid.",
    explanation: "Grid traversal, BFS flood-fill, and heuristic-based decision trees for game AI.",
  },
  {
    slug: "game-ecs-frame-update",
    title: "Game-Frame ECS Update",
    category: "Game Simulation",
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
    route: "/demos/numeric.polybench-panel.v1/",
    description: "Runs GEMM, Cholesky decomposition, stencil, and Jacobi-2D notebook kernels.",
    explanation:
      "Dense linear algebra and iterative stencil solvers from the PolyBench benchmark suite.",
  },
  {
    slug: "serialization-json-telemetry-v1",
    title: "JSON Telemetry Pipeline",
    category: "Serialization",
    route: "/demos/serialization.json-telemetry.v1/",
    description:
      "Parses nested multilingual events, runs fixed aggregates, and serializes a canonical summary.",
    explanation: "Streaming JSON tokenizer, tree construction, and canonical re-serialization.",
  },
  {
    slug: "server-ssr-template-v1",
    title: "Template & SSR Endpoint",
    category: "Server & SSR",
    route: "/demos/server.ssr-template.v1/",
    description: "Renders 1,000 personalized catalog HTML responses from a template engine.",
    explanation:
      "String interpolation, partial composition, and HTML escaping at server-render scale.",
  },
  {
    slug: "text-gc-document-edit-v1",
    title: "GC-Rich Document Editor",
    category: "Text & Parsing",
    route: "/demos/text.gc-document-edit.v1/",
    description: "Parses a tree and executes 10,000 insert, delete, and reparent operations.",
    explanation: "Piece-table or rope-based document model with garbage-collection-aware editing.",
  },
  {
    slug: "base-audio-webaudio-effects-v1",
    title: "WebAudio DSP Effects Chain",
    category: "Digital Signal Processing",
    route: "/benchmarks/base/audio-webaudio-effects-v1/",
    description: "Applies parametric EQ, biquad filtering, and dynamic range compression.",
    explanation: "Real-time audio sample processing and spectral shaping.",
  },
  {
    slug: "vdom-diff-patch-demo",
    title: "Virtual DOM Diff & Patch",
    category: "DOM & Web UI",
    route: "/benchmarks/vdom-diff-patch-demo/",
    description: "Diffs 1,000 tree nodes with 250 edits to calculate DOM update patches.",
    explanation: "Used by modern UI frameworks like React and Vue to update the DOM efficiently.",
  },
  {
    slug: "image-editing-demo",
    title: "Image Gaussian Blur Pipeline",
    category: "Graphics & Media",
    route: "/benchmarks/image-editing-demo/",
    description: "Applies separable Gaussian blur to pixel arrays.",
    explanation: "2D pixel array convolution and image filter processing.",
  },
  {
    slug: "image-flood-fill-demo",
    title: "Span-Stack Image Flood Fill",
    category: "Graphics & Media",
    route: "/benchmarks/image-flood-fill-demo/",
    description: "Fills contiguous pixel regions using span-stack stack operations.",
    explanation: "Used in paint tools (bucket fill) and image segmentation.",
  },
  {
    slug: "regex-automata-duel-demo",
    title: "Regex Automata Duel (JS vs Wasm DFA)",
    category: "Text & Parsing",
    route: "/benchmarks/regex-automata-duel-demo/",
    description: "Scans 1 MB text log matching complex regex patterns.",
    explanation: "Compares JS RegExp engine vs compiled WebAssembly DFA state machine.",
  },
  {
    slug: "game-canvas-arcade",
    title: "Canvas Arcade Game Engine",
    category: "Game Simulation",
    route: "/demos/game-canvas-arcade/",
    description:
      "Simulates arcade game physics, collision detection, and audio state across 60 frames.",
    explanation: "Object state updates and 2D collision detection loops.",
  },
  {
    slug: "game-canvas-entity-pathfinding",
    title: "Canvas Entity Pathfinding",
    category: "Game Simulation",
    route: "/demos/game-canvas-entity-pathfinding/",
    description: "Runs A* pathfinding for 128 game entities on a grid map with ECS updates.",
    explanation: "Priority queue heap operations and grid traversal.",
  },
  {
    slug: "text-diff-patch",
    title: "Unicode Line Diff & Patch",
    category: "Text & Parsing",
    route: "/demos/text.diff-patch.v1/",
    description: "Calculates Myers line-by-line diffs across multi-line text files.",
    explanation: "Dynamic programming matrix allocation and string comparisons.",
  },
  {
    slug: "text-markdown-cms",
    title: "Markdown CMS Render Pipeline",
    category: "Text & Parsing",
    route: "/demos/text.markdown-cms.v1/",
    description: "Parses Markdown documents into sanitized HTML syntax trees.",
    explanation: "Text parsing, character scanning, and string building.",
  },
];

async function runBenchmarkForCard(config, cardEl, iterations = 30) {
  const statusEl = cardEl.querySelector(".playground-status");
  const metricsEl = cardEl.querySelector(".playground-metrics");

  if (config.manual) {
    statusEl.textContent = "➜ Manual demo";
    statusEl.className = "playground-status idle";
    metricsEl.innerHTML =
      `<p class="notice">${config.manual} <a href="${config.route}">Open the demo page →</a></p>`;
    return { slug: config.slug, title: config.title, passed: true, skipped: true };
  }

  statusEl.textContent = `Running JS (${iterations}× loop)...`;
  statusEl.className = "playground-status running";

  try {
    let jsStats;
    let wasmStats;
    if (config.slug === "dom-virtualized-grid-v1") {
      // The paced trace enforces ±20 ms slots; a loaded main thread can blow
      // the tolerance, so allow one retry before reporting an error.
      try {
        jsStats = await executeWorkerLoop(config.slug, "javascript", iterations);
        wasmStats = await executeWorkerLoop(config.slug, "wasm", iterations);
      } catch {
        jsStats = await executeWorkerLoop(config.slug, "javascript", iterations);
        wasmStats = await executeWorkerLoop(config.slug, "wasm", iterations);
      }
    } else {
      jsStats = await executeWorkerLoop(config.slug, "javascript", iterations);
      wasmStats = await executeWorkerLoop(config.slug, "wasm", iterations);
    }

    statusEl.textContent = "✓ Complete";
    statusEl.className = "playground-status passed";

    renderPerformanceReport(metricsEl, jsStats, wasmStats, iterations);

    return { slug: config.slug, title: config.title, passed: true, jsStats, wasmStats };
  } catch (err) {
    console.error(`Benchmark error [${config.slug}]:`, err);
    statusEl.textContent = "✕ Error";
    statusEl.className = "playground-status failed";
    metricsEl.innerHTML = `<p class="notice warning">Run error: ${err.message || String(err)}</p>`;
    return {
      slug: config.slug,
      title: config.title,
      passed: false,
      error: err.message || String(err),
    };
  }
}

function initPlaygroundUI() {
  const container = document.getElementById("playground-cards");
  const runAllBtn = document.getElementById("pg-run-all");
  const iterSelect = document.getElementById("pg-iterations");
  const progressWrap = document.getElementById("pg-progress-wrap");
  const progressBar = document.getElementById("pg-progress-bar");
  const progressText = document.getElementById("pg-progress-text");

  if (!container) return;

  container.innerHTML = "";

  PLAYGROUND_WORKLOADS.forEach((config) => {
    const card = document.createElement("div");
    card.className = "playground-card";
    card.dataset.slug = config.slug;

    card.innerHTML = `
      <div class="pg-card-header">
        <span class="pg-cat-badge">${config.category}</span>
        <span class="playground-status idle">${config.manual ? "➜ Manual demo" : "Idle"}</span>
      </div>
      <h3>${config.title}</h3>
      <p class="pg-desc"><strong>What it does:</strong> ${config.description}</p>
      <p class="pg-expl"><strong>Why compare:</strong> ${config.explanation}</p>
      <div class="playground-metrics">${
      config.manual
        ? `<p class="notice">${config.manual} <a href="${config.route}">Open the demo page →</a></p>`
        : `<p class="muted">Select iterations and click "Run Test Loop" to measure timing.</p>`
    }</div>
      <div class="pg-card-actions">
        <button type="button" class="btn-pg-run">${
      config.manual ? "Show Demo Info" : `Run Test Loop (${iterSelect ? iterSelect.value : 30}×)`
    }</button>
        <a href="${config.route}" class="btn-pg-link">Inspect Demo Details →</a>
      </div>
    `;

    card.querySelector(".btn-pg-run").addEventListener("click", () => {
      const iterations = Number(iterSelect ? iterSelect.value : 30);
      runBenchmarkForCard(config, card, iterations);
    });

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
      const iterations = Number(iterSelect ? iterSelect.value : 30);
      runAllBtn.disabled = true;
      if (progressWrap) progressWrap.hidden = false;

      let completed = 0;
      let passedCount = 0;
      let skippedCount = 0;
      const resultsSummary = [];

      for (const config of PLAYGROUND_WORKLOADS) {
        if (progressText) {
          progressText.textContent = `Running benchmark ${
            completed + 1
          } of ${PLAYGROUND_WORKLOADS.length}: ${config.title} (${iterations}× loop)...`;
        }
        const card = container.querySelector(`[data-slug="${config.slug}"]`);
        const res = await runBenchmarkForCard(config, card, iterations);

        resultsSummary.push(res);
        if (res.skipped) skippedCount++;
        else if (res.passed) passedCount++;
        completed++;

        if (progressBar) {
          const pct = Math.round((completed / PLAYGROUND_WORKLOADS.length) * 100);
          progressBar.style.width = `${pct}%`;
        }
      }

      if (progressText) {
        progressText.textContent =
          `✓ Full Benchmark Suite Complete: ${passedCount} / ${PLAYGROUND_WORKLOADS.length} workloads executed across ${iterations} iterations` +
          (skippedCount > 0 ? ` (${skippedCount} manual-only demo skipped)` : "") + "!";
      }
      runAllBtn.disabled = false;
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPlaygroundUI);
} else {
  initPlaygroundUI();
}

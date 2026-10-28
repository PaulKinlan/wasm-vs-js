// Interactive Benchmark Playground & Master Suite Runner
// Runs JS vs Wasm benchmarks in multi-iteration loops to measure cold vs warm execution performance.

import { executeWorkerLoop, renderPerformanceReport } from "./unified-runner.js";
import { barChartSvg } from "./benchmark-report.js";
import { fmtBytes, fmtMs } from "./measurement-model.js";

// Every workload card with a multi-language comparison lane: slug -> manifest.
// Cards absent from this map have no multilang core (vendored/platform/meta).
const MULTILANG_MANIFESTS = {
  "sum-u32": "/benchmarks/multilang-wasm/sum-u32.manifest.json",
  "audio-fft": "/benchmarks/multilang-wasm/audio-fft.manifest.json",
  "audio-fir": "/benchmarks/multilang-wasm/audio-fir.manifest.json",
  "audio-stft": "/benchmarks/multilang-wasm/audio-stft.manifest.json",
  "ml-gemm": "/benchmarks/multilang-wasm/ml-gemm.manifest.json",
  "ml-dense-mlp": "/benchmarks/multilang-wasm/ml-dense-mlp.manifest.json",
  "cad-mesh-repair-v1": "/benchmarks/multilang-wasm/cad-mesh-repair.manifest.json",
  "base-dom-todomvc-journey": "/benchmarks/multilang-wasm/base-dom-todomvc-journey.manifest.json",
  "archive-zip-workspace-v1": "/benchmarks/multilang-wasm/archive-zip-workspace-v1.manifest.json",
  "graphics-cpu-path-tracer-v1":
    "/benchmarks/multilang-wasm/graphics-cpu-path-tracer.manifest.json",
  "database-olap-chart": "/benchmarks/multilang-wasm/database-olap-chart.manifest.json",
  "dom-virtualized-grid-v1": "/benchmarks/multilang-wasm/dom-virtualized-grid-v1.manifest.json",
  "ml-keyword-spotting-v1": "/benchmarks/multilang-wasm/ml-keyword-spotting-v1.manifest.json",
  "ml-numeric-kernels-v1": "/benchmarks/multilang-wasm/ml-numeric-kernels.manifest.json",
  "serialization-protobuf-gateway":
    "/benchmarks/multilang-wasm/serialization-protobuf-gateway.manifest.json",
  "cad-parametric-bracket": "/benchmarks/multilang-wasm/cad-parametric-bracket.manifest.json",
  "crypto-file-integrity-v1": "/benchmarks/multilang-wasm/crypto-file-integrity.manifest.json",
  "game-dom-tactics-grid": "/benchmarks/multilang-wasm/game-dom-tactics-grid.manifest.json",
  "game-ecs-frame-update": "/benchmarks/multilang-wasm/game-ecs-frame-update.manifest.json",
  "serialization-json-telemetry-v1":
    "/benchmarks/multilang-wasm/serialization-json-telemetry.manifest.json",
  "server-ssr-template-v1": "/benchmarks/multilang-wasm/server-ssr-template-v1.manifest.json",
  "text-gc-document-edit-v1": "/benchmarks/multilang-wasm/text-gc-document-edit.manifest.json",
  "base-audio-webaudio-effects-v1":
    "/benchmarks/multilang-wasm/audio-webaudio-effects-v1.manifest.json",
  "vdom-diff-patch-demo": "/benchmarks/multilang-wasm/vdom-diff-patch.manifest.json",
  "image-editing-demo": "/benchmarks/multilang-wasm/image-editing.manifest.json",
  "image-flood-fill-demo": "/benchmarks/multilang-wasm/image-editing.manifest.json",
  "regex-automata-duel-demo": "/benchmarks/multilang-wasm/regex-automata-duel-demo.manifest.json",
  "game-canvas-arcade": "/benchmarks/multilang-wasm/game-canvas-arcade.manifest.json",
  "game-canvas-entity-pathfinding":
    "/benchmarks/multilang-wasm/game-canvas-entity-pathfinding.manifest.json",
  "text-diff-patch": "/benchmarks/multilang-wasm/text-diff-patch.manifest.json",
  "text-markdown-cms": "/benchmarks/multilang-wasm/text-markdown-cms.manifest.json",
  "dom-dependent-form-validation":
    "/benchmarks/multilang-wasm/dom-dependent-form-validation.manifest.json",
  "dom-grid-movement": "/benchmarks/multilang-wasm/dom-grid-movement.manifest.json",
  "dom-keyed-list-mutation": "/benchmarks/multilang-wasm/dom-keyed-list-mutation.manifest.json",
  "dom-nested-tree-mutation": "/benchmarks/multilang-wasm/dom-nested-tree-mutation.manifest.json",
  "dom-table-sort-filter-pagination":
    "/benchmarks/multilang-wasm/dom-table-sort-filter-pagination.manifest.json",
  "text-regex-log-scan": "/benchmarks/multilang-wasm/text-regex-log-scan.manifest.json",
  "simulation-nbody-cloth": "/benchmarks/multilang-wasm/simulation-nbody-cloth.manifest.json",
  "crypto-authenticated-stream":
    "/benchmarks/multilang-wasm/crypto-authenticated-stream.manifest.json",
  "document-pdf-viewer-v1": "/benchmarks/multilang-wasm/document-pdf-viewer.manifest.json",
  "network-pcap-decode-v1": "/benchmarks/multilang-wasm/network-pcap-decode.manifest.json",
  "numeric-polybench-panel-v1": "/benchmarks/multilang-wasm/numeric-polybench-panel.manifest.json",
  "simulation-rigid-body-2d-v1":
    "/benchmarks/multilang-wasm/simulation-rigid-body-2d.manifest.json",
  "base-gltf-viewer": "/benchmarks/multilang-wasm/base-gltf-viewer.manifest.json",
  "numeric-fft-spectral-filter-v1":
    "/benchmarks/multilang-wasm/numeric-fft-spectral-filter-v1.manifest.json",
};

const PLAYGROUND_WORKLOADS = [
  {
    slug: "sum-u32",
    title: "Modulo-2³² Integer Sum",
    category: "Compute Kernel",
    // Every other card links to its benchmark page; this one pointed at
    // "/#workload-sum-u32", which is the id of this very card. "Inspect Demo
    // Details" scrolled the reader to where they already were. The page it
    // should have linked to has existed all along.
    route: "/benchmarks/sum-u32/",
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
  // database-sqlite-notebook-v1 is unlisted (Paul, 2026-08-26). Its run
  // finishes and reports "every returned value matched the independent
  // reference", and then shows nothing: no decision panel, no result tables,
  // no timings. It is a correctness demo on a bespoke runner, not a benchmark,
  // so listing it among the benchmarks promises a comparison it does not make.
  // The page, its worker, its fixtures and its build scripts are all still
  // here — restoring the entry below is all it takes to bring it back once it
  // reports results.
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
    route: "/benchmarks/cad-parametric-bracket/",
    description:
      "Builds boxes, cylinders, boolean holes, fillets, and tessellates a parametric bracket.",
    explanation:
      "CSG boolean operations, edge filleting, and triangle tessellation for manufacturing.",
  },
  {
    slug: "crypto-file-integrity-v1",
    title: "SHA-256 File Integrity",
    category: "Cryptography",
    route: "/benchmarks/crypto.file-integrity.v1/",
    description: "Verifies downloaded assets with SHA-256 using fixed chunk schedules.",
    explanation:
      "Block-level hash compression and streaming digest updates over file-sized inputs.",
  },
  {
    slug: "game-dom-tactics-grid",
    title: "DOM Tactics Grid",
    category: "Game Simulation",
    route: "/benchmarks/game-dom-tactics-grid/",
    description:
      "Runs turn-based movement, range calculation, and AI pathfinding on a tactics grid.",
    explanation: "Grid traversal, BFS flood-fill, and heuristic-based decision trees for game AI.",
  },
  {
    slug: "game-ecs-frame-update",
    title: "Game-Frame ECS Update",
    category: "Game Simulation",
    route: "/benchmarks/game-ecs-frame-update/",
    description:
      "Updates movement, collision broadphase, and animation state for 10,000 entities per frame.",
    explanation:
      "Entity-component-system archetype iteration, AABB broadphase, and skeletal animation.",
  },
  {
    slug: "network-pcap-decode-v1",
    title: "PCAP Protocol Decode",
    category: "Networking",
    route: "/benchmarks/network.pcap-decode.v1/",
    description:
      "Parses Ethernet, IP, TCP, DNS, and HTTP records from a capture into a flow table.",
    explanation:
      "Layered protocol dissection, checksum validation, and connection-state reconstruction.",
  },
  {
    slug: "numeric-polybench-panel-v1",
    title: "PolyBench Numeric Panel",
    category: "Numeric & Scientific",
    route: "/benchmarks/numeric.polybench-panel.v1/",
    description: "Runs GEMM, Cholesky decomposition, stencil, and Jacobi-2D notebook kernels.",
    explanation:
      "Dense linear algebra and iterative stencil solvers from the PolyBench benchmark suite.",
  },
  {
    slug: "serialization-json-telemetry-v1",
    title: "JSON Telemetry Pipeline",
    category: "Serialization",
    route: "/benchmarks/serialization.json-telemetry.v1/",
    description:
      "Parses nested multilingual events, runs fixed aggregates, and serializes a canonical summary.",
    explanation: "Streaming JSON tokenizer, tree construction, and canonical re-serialization.",
  },
  {
    slug: "server-ssr-template-v1",
    title: "Template & SSR Endpoint",
    category: "Server & SSR",
    route: "/benchmarks/server.ssr-template.v1/",
    description: "Renders 1,000 personalized catalog HTML responses from a template engine.",
    explanation:
      "String interpolation, partial composition, and HTML escaping at server-render scale.",
  },
  {
    slug: "text-gc-document-edit-v1",
    title: "GC-Rich Document Editor",
    category: "Text & Parsing",
    route: "/benchmarks/text.gc-document-edit.v1/",
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
    route: "/benchmarks/game-canvas-arcade/",
    description:
      "Simulates arcade game physics, collision detection, and audio state across 60 frames.",
    explanation: "Object state updates and 2D collision detection loops.",
  },
  {
    slug: "game-canvas-entity-pathfinding",
    title: "Canvas Entity Pathfinding",
    category: "Game Simulation",
    route: "/benchmarks/game-canvas-entity-pathfinding/",
    description: "Runs A* pathfinding for 128 game entities on a grid map with ECS updates.",
    explanation: "Priority queue heap operations and grid traversal.",
  },
  {
    slug: "text-diff-patch",
    title: "Unicode Line Diff & Patch",
    category: "Text & Parsing",
    route: "/benchmarks/text.diff-patch.v1/",
    description: "Calculates Myers line-by-line diffs across multi-line text files.",
    explanation: "Dynamic programming matrix allocation and string comparisons.",
  },
  {
    slug: "text-markdown-cms",
    title: "Markdown CMS Render Pipeline",
    category: "Text & Parsing",
    route: "/benchmarks/text.markdown-cms.v1/",
    description: "Parses Markdown documents into sanitized HTML syntax trees.",
    explanation: "Text parsing, character scanning, and string building.",
  },
  {
    slug: "dom-dependent-form-validation",
    title: "Dependent Form Validation Workflow",
    category: "DOM & Web UI",
    route: "/benchmarks/dom-dependent-form-validation/",
    description:
      "Validates a multi-field form with field dependencies, custom regex rules, and cross-field constraints across 240 input actions.",
    explanation:
      "Cross-field dependency graph resolution, constraint checking, and DOM error state updates.",
  },
  {
    slug: "dom-grid-movement",
    title: "DOM Grid Movement Engine",
    category: "DOM & Web UI",
    route: "/benchmarks/dom-grid-movement/",
    description:
      "Executes 3,600 directional movements across an entity grid, updating spatial position and checking collisions.",
    explanation:
      "Grid coordinate transforms, collision/boundary checks, and spatial layout position updates.",
  },
  {
    slug: "dom-keyed-list-mutation",
    title: "Keyed List DOM Mutation Engine",
    category: "DOM & Web UI",
    route: "/benchmarks/dom-keyed-list-mutation/",
    description:
      "Performs 2,000 keyed list insertions, removals, reorders, swaps, and text updates on a dynamic DOM list.",
    explanation:
      "Keyed reconciliation algorithms, DOM node reordering, and text node mutation benchmarks.",
  },
  {
    slug: "dom-nested-tree-mutation",
    title: "Nested DOM Tree Mutation Engine",
    category: "DOM & Web UI",
    route: "/benchmarks/dom-nested-tree-mutation/",
    description:
      "Executes 1,200 subtree insertions, node moves, replacements, attribute updates, and deletions on a nested DOM tree.",
    explanation:
      "Recursive tree traversal, structural node moves, and attribute modification cascades.",
  },
  {
    slug: "dom-table-sort-filter-pagination",
    title: "Table Sort, Filter & Pagination",
    category: "DOM & Web UI",
    route: "/benchmarks/dom-table-sort-filter-pagination/",
    description:
      "Processes 120 interactive sort, filter, pagination, and cell editing actions over 5,000 table rows.",
    explanation:
      "In-memory sorting/filtering pipelines, DOM row recycling, and pagination view rendering.",
  },
  {
    slug: "network-http2-quic-state",
    title: "HTTP/2 & QUIC Protocol State Machine",
    category: "Networking",
    route: "/benchmarks/base/network-http2-quic-state/",
    description:
      "Parses frames and state transitions for HTTP/2, HPACK, QUIC, and QPACK connection streams.",
    explanation:
      "Stream framing, header table compression/decompression, and packet state machine updates.",
  },
  {
    slug: "dom-virtualized-scrolling",
    title: "Virtualized DOM List Scrolling",
    category: "DOM & Web UI",
    route: "/benchmarks/dom-virtualized-scrolling/",
    description:
      "Simulates 1,800 scroll offset and viewport resize events over 100,000 variable-height rows, computing visible item index windows.",
    explanation:
      "Binary search row indexing, variable height calculations, and virtual window DOM recycling.",
  },
  {
    slug: "simulation-rigid-body-2d-v1",
    title: "2D Rigid-Body Physics Engine",
    category: "Simulation",
    route: "/benchmarks/simulation-rigid-body-2d-v1/",
    description:
      "Simulates 18,000 constraint state updates, contacts, and joint anchors in a 2D physics scene.",
    explanation:
      "Impulse-based constraint solver, broadphase collision detection, and numerical integration.",
  },
  {
    slug: "tooling-c-to-wasm-compile-v1",
    title: "C-to-Wasm Compiler Pipeline",
    category: "Tooling & Compilers",
    route: "/benchmarks/tooling-c-to-wasm-compile-v1/",
    description:
      "Compiles C source code fixtures into WebAssembly modules using a lightweight C compiler.",
    explanation:
      "Lexical analysis, AST parsing, symbol resolution, and WebAssembly binary codegen.",
  },
  {
    slug: "text-regex-log-scan",
    title: "100 MB Log File Regex Scan",
    category: "Text & Parsing",
    route: "/benchmarks/base/text.regex-log-scan.v1/",
    description:
      "Scans a 100 MB server log corpus for multi-field timestamp, IP, and status patterns.",
    explanation: "Stream tokenization, character-class matching, and capture group extraction.",
  },
  {
    slug: "simulation-nbody-cloth",
    title: "N-Body Particle & Cloth Simulation",
    category: "Simulation",
    route: "/benchmarks/simulation-nbody-cloth/",
    description:
      "Simulates gravitational N-body particle dynamics (full benchmark suite with performance output and multi-language comparison).",
    explanation:
      "Verlet integration, spring-damper constraint iteration, and pair-wise particle forces.",
  },
];

const suiteStore = new Map();

PLAYGROUND_WORKLOADS.forEach((cfg) => {
  suiteStore.set(cfg.slug, {
    workKey: cfg.slug,
    title: cfg.title,
    category: cfg.category,
    href: cfg.route,
    manual: Boolean(cfg.manual),
    source: "unmeasured",
    pipeline: null,
    engines: {},
  });
});

function getWorkloadComparison(entry, targetEngine = "best") {
  let jsWarmMs = null;
  let wasmWarmMs = null;
  let wasmColdMs = null;
  let wasmBytes = 0;
  let engineLabel = "Wasm";

  const engines = entry.engines ?? {};
  if (engines.js?.warmMs > 0) {
    jsWarmMs = engines.js.warmMs;
  } else if (entry.pipeline?.jsWarmMs > 0) {
    jsWarmMs = entry.pipeline.jsWarmMs;
  }

  if (targetEngine === "pipeline") {
    if (entry.pipeline?.wasmWarmMs > 0) {
      wasmWarmMs = entry.pipeline.wasmWarmMs;
      wasmColdMs = entry.pipeline.wasmColdMs;
      wasmBytes = entry.pipeline.wasmBytes ?? 0;
      engineLabel = "Worker Wasm";
    }
  } else if (targetEngine === "best-opt") {
    const optCandidates = [];
    for (const [k, e] of Object.entries(engines)) {
      if (k !== "js" && (e.track === "B" || k.endsWith("-opt")) && e.warmMs > 0) {
        optCandidates.push({
          label: e.label,
          warmMs: e.warmMs,
          coldMs: e.coldMs,
          bytes: e.bytes ?? 0,
        });
      }
    }
    if (optCandidates.length > 0) {
      optCandidates.sort((a, b) => a.warmMs - b.warmMs);
      wasmWarmMs = optCandidates[0].warmMs;
      wasmColdMs = optCandidates[0].coldMs;
      wasmBytes = optCandidates[0].bytes;
      engineLabel = optCandidates[0].label;
    } else {
      return getWorkloadComparison(entry, "best");
    }
  } else if (targetEngine !== "best" && engines[targetEngine]?.warmMs > 0) {
    const e = engines[targetEngine];
    wasmWarmMs = e.warmMs;
    wasmColdMs = e.coldMs;
    wasmBytes = e.bytes ?? 0;
    engineLabel = e.label;
  } else {
    // targetEngine === "best": Only Track A baseline candidates
    const candidates = [];
    if (entry.pipeline?.wasmWarmMs > 0) {
      candidates.push({
        label: "Worker Wasm",
        warmMs: entry.pipeline.wasmWarmMs,
        coldMs: entry.pipeline.wasmColdMs,
        bytes: entry.pipeline.wasmBytes ?? 0,
      });
    }
    for (const [k, e] of Object.entries(engines)) {
      if (k !== "js" && e.track !== "B" && !k.endsWith("-opt") && e.warmMs > 0) {
        candidates.push({
          label: e.label,
          warmMs: e.warmMs,
          coldMs: e.coldMs,
          bytes: e.bytes ?? 0,
        });
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.warmMs - b.warmMs);
      wasmWarmMs = candidates[0].warmMs;
      wasmColdMs = candidates[0].coldMs;
      wasmBytes = candidates[0].bytes;
      engineLabel = candidates[0].label;
    }
  }

  const speedup = (jsWarmMs > 0 && wasmWarmMs > 0) ? (jsWarmMs / wasmWarmMs) : null;
  return {
    jsWarmMs,
    wasmWarmMs,
    wasmColdMs,
    wasmBytes,
    speedup,
    engineLabel,
    hasData: jsWarmMs !== null && wasmWarmMs !== null,
  };
}

const overviewState = {
  category: "all",
  search: "",
  engine: "best",
  metric: "speedup",
  sort: "speedup-desc",
  view: "all",
};

function geomMean(arr) {
  const valid = arr.filter((x) => typeof x === "number" && x > 0);
  if (valid.length === 0) return 0;
  const sumLogs = valid.reduce((acc, v) => acc + Math.log(v), 0);
  return Math.exp(sumLogs / valid.length);
}

function exportOverviewCsv(list, targetEngine) {
  const headers = [
    "Workload",
    "Category",
    "JS_Warm_ms",
    "Wasm_Warm_ms",
    "Wasm_Engine",
    "Speedup_Ratio",
    "Wasm_Cold_ms",
    "Wasm_Bytes",
  ];
  const rows = list.map((w) => {
    const cmp = getWorkloadComparison(w, targetEngine);
    return [
      `"${w.title.replace(/"/g, '""')}"`,
      `"${w.category}"`,
      cmp.jsWarmMs ? cmp.jsWarmMs.toFixed(2) : "",
      cmp.wasmWarmMs ? cmp.wasmWarmMs.toFixed(2) : "",
      `"${cmp.engineLabel}"`,
      cmp.speedup ? cmp.speedup.toFixed(2) : "",
      cmp.wasmColdMs ? cmp.wasmColdMs.toFixed(2) : "",
      cmp.wasmBytes || "",
    ].join(",");
  });
  const csvContent = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "wasm-vs-js-benchmark-suite.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function renderHolisticOverview() {
  const container = document.getElementById("playground-overview");
  if (!container) return;

  const categories = Array.from(new Set(PLAYGROUND_WORKLOADS.map((w) => w.category))).sort();

  let list = Array.from(suiteStore.values());
  if (overviewState.category !== "all") {
    list = list.filter((w) => w.category === overviewState.category);
  }
  if (overviewState.search) {
    const q = overviewState.search.toLowerCase().trim();
    list = list.filter((w) =>
      w.title.toLowerCase().includes(q) ||
      w.category.toLowerCase().includes(q) ||
      w.workKey.toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => {
    const cmpA = getWorkloadComparison(a, overviewState.engine);
    const cmpB = getWorkloadComparison(b, overviewState.engine);
    switch (overviewState.sort) {
      case "speedup-desc": {
        const sA = cmpA.speedup ?? -1;
        const sB = cmpB.speedup ?? -1;
        return sB - sA;
      }
      case "speedup-asc": {
        const sA = cmpA.speedup ?? 999999;
        const sB = cmpB.speedup ?? 999999;
        return sA - sB;
      }
      case "wasm-asc": {
        const tA = cmpA.wasmWarmMs ?? 999999;
        const tB = cmpB.wasmWarmMs ?? 999999;
        return tA - tB;
      }
      case "wasm-desc": {
        const tA = cmpA.wasmWarmMs ?? -1;
        const tB = cmpB.wasmWarmMs ?? -1;
        return tB - tA;
      }
      case "js-asc": {
        const jA = cmpA.jsWarmMs ?? 999999;
        const jB = cmpB.jsWarmMs ?? 999999;
        return jA - jB;
      }
      case "js-desc": {
        const jA = cmpA.jsWarmMs ?? -1;
        const jB = cmpB.jsWarmMs ?? -1;
        return jB - jA;
      }
      case "cold-asc": {
        const cA = cmpA.wasmColdMs ?? 999999;
        const cB = cmpB.wasmColdMs ?? 999999;
        return cA - cB;
      }
      case "cold-desc": {
        const cA = cmpA.wasmColdMs ?? -1;
        const cB = cmpB.wasmColdMs ?? -1;
        return cB - cA;
      }
      case "bytes-asc": {
        const bA = cmpA.wasmBytes || 999999999;
        const bB = cmpB.wasmBytes || 999999999;
        return bA - bB;
      }
      case "bytes-desc": {
        const bA = cmpA.wasmBytes || -1;
        const bB = cmpB.wasmBytes || -1;
        return bB - bA;
      }
      case "title-asc":
        return a.title.localeCompare(b.title);
      case "title-desc":
        return b.title.localeCompare(a.title);
      case "category-asc":
        return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  const measured = list.filter((w) => getWorkloadComparison(w, overviewState.engine).hasData);
  const speedups = measured
    .map((w) => getWorkloadComparison(w, overviewState.engine).speedup)
    .sort((a, b) => a - b);
  const medianSpeedup = speedups.length > 0 ? speedups[Math.floor(speedups.length / 2)] : 0;
  const peakItem = measured.reduce((best, w) => {
    const cmp = getWorkloadComparison(w, overviewState.engine);
    return (!best || (cmp.speedup ?? 0) > (best.speedup ?? 0))
      ? { title: w.title, speedup: cmp.speedup }
      : best;
  }, null);
  const wasmFaster =
    measured.filter((w) => (getWorkloadComparison(w, overviewState.engine).speedup ?? 0) >= 1.05)
      .length;
  const jsFaster =
    measured.filter((w) => (getWorkloadComparison(w, overviewState.engine).speedup ?? 0) <= 0.95)
      .length;
  const evenCount = measured.length - wasmFaster - jsFaster;

  // Build Toolbar
  const catOptions = ['<option value="all">All Categories</option>']
    .concat(
      categories.map((c) =>
        `<option value="${c}"${overviewState.category === c ? " selected" : ""}>${c}</option>`
      ),
    ).join("");

  const toolbarHtml = `
    <div class="overview-toolbar">
      <div class="ov-control-group">
        <label for="ov-category">Category:
          <select id="ov-category">${catOptions}</select>
        </label>
        <label for="ov-search">Search:
          <input type="search" id="ov-search" placeholder="Filter workloads..." value="${overviewState.search}">
        </label>
        <label for="ov-engine">Compare Engine:
          <select id="ov-engine">
            <optgroup label="Group 1: Core Baseline (JS vs Raw WAT)">
              <option value="wat"${
    overviewState.engine === "wat" ? " selected" : ""
  }>Raw WAT (Handwritten Bytecode)</option>
            </optgroup>
            <optgroup label="Group 2: Multi-Language (Track A — Controlled Compilers)">
              <option value="best"${
    overviewState.engine === "best" ? " selected" : ""
  }>Fastest Track A Compiler Baseline</option>
              <option value="pipeline"${
    overviewState.engine === "pipeline" ? " selected" : ""
  }>Worker Pipeline (Page Run)</option>
              <option value="c"${overviewState.engine === "c" ? " selected" : ""}>C / Wasm</option>
              <option value="cpp"${
    overviewState.engine === "cpp" ? " selected" : ""
  }>C++ / Wasm</option>
              <option value="rs"${
    overviewState.engine === "rs" ? " selected" : ""
  }>Rust / Wasm</option>
              <option value="asc"${
    overviewState.engine === "asc" ? " selected" : ""
  }>AssemblyScript</option>
              <option value="dart"${
    overviewState.engine === "dart" ? " selected" : ""
  }>Dart / WasmGC</option>
            </optgroup>
            <optgroup label="Group 3: Idiomatic &amp; Hardware Optimizations (Track B)">
              <option value="best-opt"${
    overviewState.engine === "best-opt" ? " selected" : ""
  }>Fastest Track B (SIMD / Tiled / Hardware)</option>
              <option value="rs-opt"${
    overviewState.engine === "rs-opt" ? " selected" : ""
  }>Rust Track B (SIMD / Tuned)</option>
              <option value="c-opt"${
    overviewState.engine === "c-opt" ? " selected" : ""
  }>C Track B (SIMD / Tuned)</option>
              <option value="cpp-opt"${
    overviewState.engine === "cpp-opt" ? " selected" : ""
  }>C++ Track B (SIMD / Tuned)</option>
            </optgroup>
          </select>
        </label>
        <label for="ov-sort">Sort:
          <select id="ov-sort">
            <option value="speedup-desc"${
    overviewState.sort === "speedup-desc" ? " selected" : ""
  }>Speedup: High → Low</option>
            <option value="speedup-asc"${
    overviewState.sort === "speedup-asc" ? " selected" : ""
  }>Speedup: Low → High</option>
            <option value="wasm-asc"${
    overviewState.sort === "wasm-asc" ? " selected" : ""
  }>Wasm Time: Fastest First</option>
            <option value="js-desc"${
    overviewState.sort === "js-desc" ? " selected" : ""
  }>JS Time: Slowest First</option>
            <option value="title-asc"${
    overviewState.sort === "title-asc" ? " selected" : ""
  }>Name: A → Z</option>
            <option value="category-asc"${
    overviewState.sort === "category-asc" ? " selected" : ""
  }>Category: A → Z</option>
          </select>
        </label>
      </div>
      <div class="ov-action-group">
        <div class="ov-view-group" role="group" aria-label="View selection">
          <button type="button" class="btn-ov-view${
    overviewState.view === "all" ? " active" : ""
  }" data-view="all">All</button>
          <button type="button" class="btn-ov-view${
    overviewState.view === "charts" ? " active" : ""
  }" data-view="charts">Charts</button>
          <button type="button" class="btn-ov-view${
    overviewState.view === "table" ? " active" : ""
  }" data-view="table">Table</button>
        </div>
        <button type="button" id="ov-run-filtered" class="btn-ov-run">▶ Run Filtered (${
    list.filter((w) => !w.manual).length
  })</button>
        <button type="button" id="ov-export-csv" class="btn-ov-secondary">Export CSV</button>
      </div>
    </div>
  `;

  // Build KPI Strip
  const kpiStripHtml = `
    <div class="overview-kpis">
      <div class="kpi-card">
        <span class="kpi-label">Workloads Matched</span>
        <strong class="kpi-val">${list.length} / ${PLAYGROUND_WORKLOADS.length}</strong>
        <span class="kpi-sub">${measured.length} measured</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Median Speedup</span>
        <strong class="kpi-val">${medianSpeedup ? medianSpeedup.toFixed(2) + "×" : "—"}</strong>
        <span class="kpi-sub">${
    overviewState.engine === "best"
      ? "Fastest Wasm vs JS"
      : overviewState.engine.toUpperCase() + " vs JS"
  }</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Max Speedup</span>
        <strong class="kpi-val">${
    peakItem?.speedup ? peakItem.speedup.toFixed(2) + "×" : "—"
  }</strong>
        <span class="kpi-sub">${peakItem?.title ? peakItem.title.slice(0, 22) : "None"}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Execution Advantage</span>
        <strong class="kpi-val">${wasmFaster} Wasm / ${jsFaster} JS</strong>
        <span class="kpi-sub">${evenCount} within 5% parity</span>
      </div>
    </div>
  `;

  // Build Charts Grid
  let chartsGridHtml = "";
  if (overviewState.view !== "table") {
    if (measured.length === 0) {
      if (overviewState.view === "charts") {
        chartsGridHtml = `
          <div class="notice">
            No live runs recorded yet. Click <strong>▶ Run Filtered</strong> above or <strong>▶ Run</strong> on any workload below to benchmark in this browser.
          </div>
        `;
      }
    } else {
      // Chart 1: Top measured workloads comparison
      const topWorkloads = measured.slice(0, 10);
      const chartRows = [];
      topWorkloads.forEach((w) => {
        const cmp = getWorkloadComparison(w, overviewState.engine);
        const titleShort = w.title.length > 22 ? w.title.slice(0, 20) + "…" : w.title;
        chartRows.push({
          label: `${titleShort} (JS)`,
          valueMs: cmp.jsWarmMs,
          kind: "js",
        });
        chartRows.push({
          label: `${titleShort} (${
            cmp.engineLabel.length > 10 ? cmp.engineLabel.slice(0, 9) + "…" : cmp.engineLabel
          })`,
          valueMs: cmp.wasmWarmMs,
          kind: "wasm",
        });
      });

      const leftChartHtml = chartRows.length > 0
        ? barChartSvg(chartRows, {
          title: `Workload Execution: JS vs ${
            overviewState.engine === "best" ? "Fastest Wasm" : overviewState.engine.toUpperCase()
          }`,
          caption: "Warm median execution duration in milliseconds (lower is faster).",
        })
        : '<p class="notice">No measured workloads matching the current filter.</p>';

      // Chart 2: Suite-wide cross-language geometric mean
      const crossLangDefs = [
        { key: "js", label: "JavaScript (V8)", kind: "js" },
        { key: "wat", label: "Raw WAT", kind: "wasm" },
        { key: "c", label: "C / Wasm", kind: "wasm" },
        { key: "cpp", label: "C++ / Wasm", kind: "wasm" },
        { key: "rs", label: "Rust / Wasm", kind: "wasm" },
        { key: "asc", label: "AssemblyScript", kind: "wasm" },
        { key: "dart", label: "Dart / WasmGC", kind: "wasm" },
      ];
      const crossLangRows = [];
      crossLangDefs.forEach((d) => {
        const vals = [];
        Array.from(suiteStore.values()).forEach((w) => {
          const m = w.engines?.[d.key]?.warmMs;
          if (typeof m === "number" && m > 0) vals.push(m);
        });
        if (vals.length > 0) {
          crossLangRows.push({
            label: d.label,
            valueMs: geomMean(vals),
            kind: d.kind,
          });
        }
      });

      const rightChartHtml = crossLangRows.length > 1
        ? barChartSvg(crossLangRows, {
          title: "Cross-Language Suite Aggregate",
          caption:
            "Geometric mean execution duration in milliseconds across multi-language workloads.",
        })
        : '<p class="notice">Cross-language measurements loading...</p>';

      chartsGridHtml = `
        <div class="wvj-chart-grid">
          <div class="wvj-chart-cell">${leftChartHtml}</div>
          <div class="wvj-chart-cell">${rightChartHtml}</div>
        </div>
      `;
    }
  }

  // Build Master Comparison Table
  let tableHtml = "";
  if (overviewState.view !== "charts") {
    const tableRows = list.map((item) => {
      const cmp = getWorkloadComparison(item, overviewState.engine);
      const speedupStr = cmp.speedup ? `${cmp.speedup.toFixed(2)}×` : "—";
      const speedupClass = cmp.speedup >= 1.2
        ? "wasm-faster"
        : cmp.speedup <= 0.8
        ? "js-faster"
        : "even";

      const sizeStr = cmp.wasmBytes > 0 ? fmtBytes(cmp.wasmBytes) : "—";

      return `
        <tr>
          <td>
            <a href="#workload-${item.workKey}" class="ov-workload-link"><strong>${item.title}</strong></a>
          </td>
          <td><span class="pg-cat-badge">${item.category}</span></td>
          <td>${cmp.jsWarmMs > 0 ? fmtMs(cmp.jsWarmMs) : "—"}</td>
          <td>
            ${cmp.wasmWarmMs > 0 ? fmtMs(cmp.wasmWarmMs) : "—"}
            <br><small class="muted">${cmp.engineLabel}</small>
          </td>
          <td>
            ${
        cmp.speedup ? `<strong class="speedup-pill ${speedupClass}">${speedupStr}</strong>` : "—"
      }
          </td>
          <td>${cmp.wasmColdMs > 0 ? fmtMs(cmp.wasmColdMs) : "—"}</td>
          <td>${sizeStr}</td>
          <td>
            <button type="button" class="btn-ov-table-run" data-work-key="${item.workKey}">${
        item.manual ? "Inspect" : "▶ Run"
      }</button>
            <a href="${item.href}" class="btn-pg-link">Demo →</a>
          </td>
        </tr>
      `;
    }).join("");

    tableHtml = `
      <div class="master-table-wrap">
        <table class="master-table">
          <caption>Suite Performance Comparison — ${list.length} workloads matching current filter</caption>
          <thead>
            <tr>
              <th data-sort="title" class="sortable-th">Workload</th>
              <th data-sort="category" class="sortable-th">Category</th>
              <th data-sort="js" class="sortable-th">JS Warm</th>
              <th data-sort="wasm" class="sortable-th">Wasm Warm</th>
              <th data-sort="speedup" class="sortable-th">Speedup vs JS</th>
              <th data-sort="cold" class="sortable-th">Wasm Cold</th>
              <th data-sort="bytes" class="sortable-th">Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
      tableRows || '<tr><td colspan="8" class="notice">No matching workloads found.</td></tr>'
    }
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = toolbarHtml + kpiStripHtml + chartsGridHtml + tableHtml;

  // Wire Toolbar Listeners
  const catSel = container.querySelector("#ov-category");
  if (catSel) {
    catSel.addEventListener("change", (e) => {
      overviewState.category = e.target.value;
      renderHolisticOverview();
    });
  }

  const searchInput = container.querySelector("#ov-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      overviewState.search = e.target.value;
      renderHolisticOverview();
    });
  }

  const engineSel = container.querySelector("#ov-engine");
  if (engineSel) {
    engineSel.addEventListener("change", (e) => {
      overviewState.engine = e.target.value;
      renderHolisticOverview();
    });
  }

  const sortSel = container.querySelector("#ov-sort");
  if (sortSel) {
    sortSel.addEventListener("change", (e) => {
      overviewState.sort = e.target.value;
      renderHolisticOverview();
    });
  }

  container.querySelectorAll(".btn-ov-view").forEach((btn) => {
    btn.addEventListener("click", () => {
      overviewState.view = btn.dataset.view;
      renderHolisticOverview();
    });
  });

  const exportBtn = container.querySelector("#ov-export-csv");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportOverviewCsv(list, overviewState.engine);
    });
  }

  const runFilteredBtn = container.querySelector("#ov-run-filtered");
  if (runFilteredBtn) {
    runFilteredBtn.addEventListener("click", async () => {
      const iterSelect = document.getElementById("pg-iterations");
      const iterations = Number(iterSelect ? iterSelect.value : 30);
      runFilteredBtn.disabled = true;
      const progressWrap = document.getElementById("pg-progress-wrap");
      const progressBar = document.getElementById("pg-progress-bar");
      const progressText = document.getElementById("pg-progress-text");
      if (progressWrap) progressWrap.hidden = false;

      const runnable = list.filter((w) => !w.manual);
      let completed = 0;
      for (const item of runnable) {
        if (progressText) {
          progressText.textContent = `Running ${
            completed + 1
          } of ${runnable.length}: ${item.title}...`;
        }
        const cfg = PLAYGROUND_WORKLOADS.find((w) => w.slug === item.workKey);
        const card = document.querySelector(`.playground-card[data-slug="${item.workKey}"]`);
        if (cfg && card) {
          await runBenchmarkForCard(cfg, card, iterations);
        }
        completed++;
        if (progressBar) {
          progressBar.style.width = `${Math.round((completed / runnable.length) * 100)}%`;
        }
      }
      if (progressText) {
        progressText.textContent = `Filtered run complete: ${runnable.length} workloads executed.`;
      }
      runFilteredBtn.disabled = false;
    });
  }

  // Wire Table Sort Headers
  container.querySelectorAll(".sortable-th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const s = th.dataset.sort;
      if (s === "title") {
        overviewState.sort = overviewState.sort === "title-asc" ? "title-desc" : "title-asc";
      } else if (s === "category") {
        overviewState.sort = overviewState.sort === "category-asc" ? "title-asc" : "category-asc";
      } else if (s === "js") {
        overviewState.sort = overviewState.sort === "js-desc" ? "js-asc" : "js-desc";
      } else if (s === "wasm") {
        overviewState.sort = overviewState.sort === "wasm-asc" ? "wasm-desc" : "wasm-asc";
      } else if (s === "speedup") {
        overviewState.sort = overviewState.sort === "speedup-desc" ? "speedup-asc" : "speedup-desc";
      } else if (s === "cold") {
        overviewState.sort = overviewState.sort === "cold-asc" ? "cold-desc" : "cold-asc";
      } else if (s === "bytes") {
        overviewState.sort = overviewState.sort === "bytes-asc" ? "bytes-desc" : "bytes-asc";
      }
      renderHolisticOverview();
    });
  });

  // Wire Table Quick-Run Buttons
  container.querySelectorAll(".btn-ov-table-run").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.workKey;
      const cfg = PLAYGROUND_WORKLOADS.find((w) => w.slug === key);
      const card = document.querySelector(`.playground-card[data-slug="${key}"]`);
      if (cfg && card) {
        const iterSelect = document.getElementById("pg-iterations");
        const iterations = Number(iterSelect ? iterSelect.value : 30);
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        runBenchmarkForCard(cfg, card, iterations);
      }
    });
  });
}

function isTrackBVariant(label, track) {
  if (track === "B") return true;
  const l = String(label || "").toLowerCase();
  return l.includes("-ikj") || l.includes("-tiled") || l.includes("-simd") ||
    l.includes("-opt") || l.includes("-o2") || l.includes("-o3") || l.includes("-o4") ||
    l.includes("track b") || l.includes("simd") || l.includes("optimized") ||
    l.includes("reassociated") || l.includes("i/k/j") || l.includes("tiled");
}

async function runBenchmarkForCard(config, cardEl, iterations = 30) {
  const statusEl = cardEl.querySelector(".playground-status");
  const metricsEl = cardEl.querySelector(".playground-metrics");

  if (config.manual) {
    statusEl.textContent = "➜ Manual demo";
    statusEl.className = "playground-status idle";
    metricsEl.innerHTML =
      `<p class="notice">${config.manual} <a href="${config.route}">Open the demo page →</a></p>`;
    return { ["slug"]: config.slug, title: config.title, passed: true, skipped: true };
  }

  statusEl.textContent = "Running JS — starting…";
  statusEl.className = "playground-status running";

  try {
    let jsStats;
    let wasmStats;
    const report = (label) => ({ iteration, total }) => {
      statusEl.textContent = `Running ${label} — iteration ${iteration}/${total}…`;
    };
    if (config.slug === "dom-virtualized-grid-v1") {
      try {
        jsStats = await executeWorkerLoop(config.slug, "javascript", iterations, report("JS"));
        wasmStats = await executeWorkerLoop(config.slug, "wasm", iterations, report("Wasm"));
      } catch {
        jsStats = await executeWorkerLoop(config.slug, "javascript", iterations, report("JS"));
        wasmStats = await executeWorkerLoop(config.slug, "wasm", iterations, report("Wasm"));
      }
    } else {
      jsStats = await executeWorkerLoop(config.slug, "javascript", iterations, report("JS"));
      wasmStats = await executeWorkerLoop(config.slug, "wasm", iterations, report("Wasm"));
    }

    // Multi-language comparison stage
    const mlManifest = MULTILANG_MANIFESTS[config.slug];
    let mlResult = { passed: true, skipped: !mlManifest };
    let mlData = null;
    let mlBox = null;

    if (mlManifest) {
      statusEl.textContent = "Running multi-language comparison…";
      try {
        mlBox = document.createElement("div");
        mlBox.className = "playground-multilang";
        const mlHeader = document.createElement("h4");
        mlHeader.textContent = "Multi-language comparison";
        mlBox.appendChild(mlHeader);
        const mlReporting = document.createElement("div");
        mlBox.appendChild(mlReporting);
        const { runMultilangComparison } = await import("/multilang-runner.js");
        mlData = await runMultilangComparison(mlManifest, {
          iterations: Math.min(iterations, 3),
          onStatus: (m) => {
            statusEl.textContent = m;
          },
          reportingEl: mlReporting,
          heading: false,
          charts: false,
        });
        mlResult = { passed: true, skipped: false };
        const mlRunner = await import("/multilang-runner.js");
        if (typeof mlRunner.clearEngineCache === "function") mlRunner.clearEngineCache();
      } catch (mlErr) {
        mlResult = { passed: false, skipped: false, error: mlErr.message || String(mlErr) };
      }
    }

    // Extract timing metrics safely across all worker runners
    const jsMed = Number(
      jsStats?.warmMedianMs ??
        jsStats?.pipelineSummary?.p50Ms ??
        jsStats?.kernelSummary?.p50Ms ??
        0,
    );
    const wasmMed = Number(
      wasmStats?.warmMedianMs ??
        wasmStats?.pipelineSummary?.p50Ms ??
        wasmStats?.kernelSummary?.p50Ms ??
        0,
    );
    const jsCold = Number(jsStats?.coldMs ?? jsStats?.firstUse?.totalMs ?? 0);
    const wasmCold = Number(wasmStats?.coldMs ?? wasmStats?.firstUse?.totalMs ?? 0);
    const wasmBytes = Number(
      wasmStats?.firstUse?.network?.transferBytes ??
        wasmStats?.firstUse?.network?.decodedBytes ??
        0,
    );

    // Update suiteStore with live results
    const entry = suiteStore.get(config.slug);
    if (entry) {
      entry.source = "live";
      entry.pipeline = {
        jsWarmMs: jsMed,
        wasmWarmMs: wasmMed,
        jsColdMs: jsCold,
        wasmColdMs: wasmCold,
        wasmBytes: wasmBytes,
      };
      if (mlData) {
        for (const [, kResults] of Object.entries(mlData)) {
          for (const eng of (kResults ?? [])) {
            const isOpt = isTrackBVariant(eng.label, eng.track);
            const k = isOpt ? `${eng.key}-opt` : eng.key;
            entry.engines[k] = {
              label: eng.label,
              warmMs: eng.medianMs,
              coldMs: eng.coldMs ?? 0,
              bytes: eng.bytes ?? 0,
              track: isOpt ? "B" : "A",
            };
          }
        }
      }
    }
    renderHolisticOverview();

    // Render Compact Card Summary
    const speedup = jsMed > 0 && wasmMed > 0 ? (jsMed / wasmMed) : 1;
    const speedupClass = speedup >= 1.2 ? "wasm-faster" : speedup <= 0.8 ? "js-faster" : "even";

    const kpiRowHtml = `
      <div class="pg-kpi-row">
        <div class="pg-kpi"><span>JS Warm</span><strong>${fmtMs(jsMed)}</strong></div>
        <div class="pg-kpi"><span>Wasm Warm</span><strong>${fmtMs(wasmMed)}</strong></div>
        <div class="pg-kpi"><span>Speedup vs JS</span><strong class="speedup-pill ${speedupClass}">${
      speedup.toFixed(2)
    }×</strong></div>
        <div class="pg-kpi"><span>Cold First Run</span><strong>${
      wasmCold > 0 ? fmtMs(wasmCold) : "—"
    }</strong></div>
      </div>
    `;

    const cardChartRows = [
      { label: "JavaScript", valueMs: jsMed, kind: "js" },
      { label: "Worker Wasm", valueMs: wasmMed, kind: "wasm" },
    ];
    if (mlData) {
      const firstK = Object.keys(mlData)[0];
      for (const r of (mlData[firstK] ?? [])) {
        if (r.key !== "js" && r.medianMs > 0) {
          cardChartRows.push({
            label: r.label,
            valueMs: r.medianMs,
            lowMs: r.minMs,
            highMs: r.maxMs,
            kind: "wasm",
          });
        }
      }
    }
    const compactChartHtml = `<div class="pg-compact-chart">${
      barChartSvg(cardChartRows, {
        title: "Measured Execution Timing",
        caption: "Median execution time per iteration (lower is faster).",
      })
    }</div>`;

    const summaryRowsHtml = cardChartRows.map((r) => {
      const rSpeedup = r.valueMs > 0 ? (jsMed / r.valueMs).toFixed(2) + "×" : "—";
      const isJs = r.kind === "js";
      return `<tr>
        <td><strong>${r.label}</strong></td>
        <td>${
        isJs ? (jsCold > 0 ? fmtMs(jsCold) : "—") : (wasmCold > 0 ? fmtMs(wasmCold) : "—")
      }</td>
        <td>${fmtMs(r.valueMs)}</td>
        <td>${isJs ? "1.00× (Baseline)" : `<strong>${rSpeedup}</strong>`}</td>
      </tr>`;
    }).join("");

    const summaryTableHtml = `
      <div class="table-wrap">
        <table class="results-table">
          <thead><tr><th>Implementation</th><th>Cold Start</th><th>Median Warm</th><th>Speedup vs JS</th></tr></thead>
          <tbody>${summaryRowsHtml}</tbody>
        </table>
      </div>
    `;

    // Collapsible deep diagnostic details
    const deepDetails = document.createElement("details");
    deepDetails.className = "pg-deep-details";
    deepDetails.innerHTML =
      `<summary>Inspect full pipeline, delivery &amp; language tables</summary><div class="pg-deep-content"></div>`;
    const deepContent = deepDetails.querySelector(".pg-deep-content");
    renderPerformanceReport(deepContent, jsStats, wasmStats, iterations);
    if (mlBox) deepContent.appendChild(mlBox);
    if (mlResult.error) {
      const errEl = document.createElement("p");
      errEl.className = "notice warning";
      errEl.textContent = `Multi-language run error: ${mlResult.error}`;
      deepContent.appendChild(errEl);
    }

    metricsEl.innerHTML = kpiRowHtml + compactChartHtml + summaryTableHtml;
    metricsEl.appendChild(deepDetails);

    statusEl.textContent = "Complete";
    statusEl.className = "playground-status passed";

    return {
      ["slug"]: config.slug,
      title: config.title,
      passed: true,
      jsStats,
      wasmStats,
      mlResult,
    };
  } catch (err) {
    console.error(`Benchmark error [${config.slug}]:`, err);
    statusEl.textContent = "✕ Error";
    statusEl.className = "playground-status failed";
    metricsEl.innerHTML = `<p class="notice warning">Run error: ${err.message || String(err)}</p>`;
    return {
      ["slug"]: config.slug,
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
  container.className = "playground-cards-grid";

  PLAYGROUND_WORKLOADS.forEach((config) => {
    const card = document.createElement("div");
    card.className = "playground-card";
    card.id = `workload-${config.slug}`;
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

  // Deep-link: scroll to a workload card (e.g. /#workload-sum-u32).
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) {
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    }
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
        else if (res.passed && res.mlResult?.passed !== false) passedCount++;
        completed++;

        if (progressBar) {
          const pct = Math.round((completed / PLAYGROUND_WORKLOADS.length) * 100);
          progressBar.style.width = `${pct}%`;
        }
      }

      if (progressText) {
        progressText.textContent =
          `Full Benchmark Suite Complete: ${passedCount} / ${PLAYGROUND_WORKLOADS.length} workloads executed across ${iterations} iterations` +
          (skippedCount > 0 ? ` (${skippedCount} manual-only demo skipped)` : "") + "!";
      }
      runAllBtn.disabled = false;
    });
  }

  renderHolisticOverview();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPlaygroundUI);
} else {
  initPlaygroundUI();
}

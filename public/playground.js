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
];

// Execute workload for N iterations, measuring first (cold) vs subsequent (warm) iterations
async function runTimedLoop(workerScript, slug, target, iterations = 30) {
  const durations = [];

  for (let i = 0; i < iterations; i++) {
    const res = await new Promise((resolve, reject) => {
      const worker = new Worker(workerScript, { type: "module" });
      const token = Math.floor(Math.random() * 1000000);
      const start = performance.now();

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error("Timeout"));
      }, 30000);

      worker.addEventListener("message", (event) => {
        const msg = event.data;
        if (!msg || msg.token !== token) return;
        if (msg.type === "completed" || msg.type === "done") {
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
      } else {
        worker.postMessage({ token, slug, target, mode: "bounded" });
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
    const jsStats = await runTimedLoop(config.workerScript, config.slug, "javascript", iterations);

    statusEl.textContent = `Running Wasm (${iterations}× loop)...`;
    const wasmStats = await runTimedLoop(
      config.workerScript,
      config.slug,
      "wasm-linear",
      iterations,
    );

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

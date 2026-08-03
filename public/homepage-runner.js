// Homepage Interactive Benchmark Runner
// Runs proposal workloads in dedicated module workers, measuring JS vs Wasm timing,
// validating exact oracles, and building a live interactive scorecard.

const DEMO_REGISTRY_URL = "/demo-registry.json";

const WORKLOAD_CONFIGS = [
  {
    slug: "audio-fft",
    title: "Radix-2 Complex FFT",
    category: "Audio",
    description: "32 transforms over 4,096 complex samples",
    workerScript: "/demo-worker.js",
    target: "both",
  },
  {
    slug: "audio-fir",
    title: "Direct 256-Tap FIR Convolution",
    category: "Audio",
    description: "256-tap FIR filter on audio signal stream",
    workerScript: "/demo-worker.js",
    target: "both",
  },
  {
    slug: "audio-stft",
    title: "Short-Time Fourier Transform",
    category: "Audio",
    description: "Spectrogram computation over time windows",
    workerScript: "/demo-worker.js",
    target: "both",
  },
  {
    slug: "ml-gemm",
    title: "Batched Matrix Multiply (GEMM)",
    category: "Neural ML",
    description: "Batched 512x512 matrix multiplication in f32",
    workerScript: "/benchmarks/ml-gemm/neural-gemm-worker.js",
    target: "both",
  },
  {
    slug: "ml-dense-mlp",
    title: "Multilayer Perceptron (MLP)",
    category: "Neural ML",
    description: "9-layer dense MLP neural network inference",
    workerScript: "/benchmarks/ml-dense-mlp/neural-mlp-worker.js",
    target: "both",
  },
  {
    slug: "vdom-diff-patch-demo",
    title: "Virtual DOM Diff & Patch",
    category: "DOM & Web",
    description: "1,000-node VDOM tree diffing and patch planning",
    workerScript: null,
    route: "/benchmarks/vdom-diff-patch-demo/",
  },
  {
    slug: "image-editing-demo",
    title: "Image Editing Pipeline",
    category: "Graphics & Media",
    description: "Gaussian blur & luma processing pipeline",
    workerScript: null,
    route: "/benchmarks/image-editing-demo/",
  },
  {
    slug: "image-flood-fill-demo",
    title: "Span-Stack Image Flood Fill",
    category: "Graphics & Media",
    description: "Span-stack 4-connected threshold flood fill",
    workerScript: null,
    route: "/benchmarks/image-flood-fill-demo/",
  },
  {
    slug: "regex-automata-duel-demo",
    title: "Regex Automata Duel",
    category: "Text Processing",
    description: "JS NFA vs Wasm DFA regex engine scan",
    workerScript: null,
    route: "/benchmarks/regex-automata-duel-demo/",
  },
  {
    slug: "game-canvas-arcade",
    title: "Canvas Arcade Game Engine",
    category: "Game Family",
    description: "Arcade physics, state, draw & audio trace",
    workerScript: null,
    route: "/demos/game-canvas-arcade/",
  },
  {
    slug: "game-canvas-entity-pathfinding",
    title: "Canvas Entity Pathfinding",
    category: "Game Family",
    description: "A* pathfinding, ECS update & audio trace",
    workerScript: null,
    route: "/demos/game-canvas-entity-pathfinding/",
  },
  {
    slug: "game-dom-tactics-grid",
    title: "DOM Tactics Grid Engine",
    category: "Game Family",
    description: "240 tactical actions over 60 encoded turns",
    workerScript: null,
    route: "/demos/game-dom-tactics-grid/",
  },
  {
    slug: "text-diff-patch",
    title: "Unicode Line Diff & Patch",
    category: "Text Processing",
    description: "Myers line diff and patch generation",
    workerScript: null,
    route: "/demos/text.diff-patch.v1/",
  },
  {
    slug: "text-markdown-cms",
    title: "Markdown CMS Render Pipeline",
    category: "Text Processing",
    description: "Markdown parsing and HTML rendering pipeline",
    workerScript: null,
    route: "/demos/text.markdown-cms.v1/",
  },
];

// Execute a worker-based workload test with timing
function executeWorkerTest(workerScript, slug, target, mode = "bounded") {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerScript, { type: "module" });
    const token = Math.floor(Math.random() * 1000000);
    const startTime = performance.now();

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Timeout after 60s"));
    }, 60000);

    worker.addEventListener("message", (event) => {
      const msg = event.data;
      if (!msg || msg.token !== token) return;
      if (msg.type === "completed") {
        clearTimeout(timeout);
        const durationMs = performance.now() - startTime;
        worker.terminate();
        resolve({
          target,
          durationMs,
          variantId: msg.variantId,
          oracleChecks: msg.oracleChecks,
          inputSha256: msg.inputSha256,
          outputSha256: msg.outputSha256,
        });
      } else if (msg.type === "failed") {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(msg.message || "Execution failed"));
      }
    });

    worker.addEventListener("error", (err) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(err.message || "Worker error"));
    });

    worker.postMessage({ token, slug, target, mode });
  });
}

async function runWorkerBenchmark(config, cardElement) {
  const statusEl = cardElement.querySelector(".card-status");
  const metricsEl = cardElement.querySelector(".card-metrics");

  statusEl.textContent = "Running JS...";
  statusEl.className = "card-status running";

  try {
    const jsResult = await executeWorkerTest(config.workerScript, config.slug, "javascript");

    statusEl.textContent = "Running Wasm...";
    const wasmResult = await executeWorkerTest(config.workerScript, config.slug, "wasm-linear");

    const jsTime = jsResult.durationMs.toFixed(2);
    const wasmTime = wasmResult.durationMs.toFixed(2);
    const ratio = (jsResult.durationMs / wasmResult.durationMs).toFixed(2);

    let speedupText = "";
    if (parseFloat(ratio) > 1.05) {
      speedupText = `Wasm is ${ratio}x faster`;
    } else if (parseFloat(ratio) < 0.95) {
      speedupText = `JS is ${(1 / parseFloat(ratio)).toFixed(2)}x faster`;
    } else {
      speedupText = "JS & Wasm performed identically";
    }

    statusEl.textContent = "✓ Passed";
    statusEl.className = "card-status passed";

    metricsEl.innerHTML = `
      <div class="metric-row">
        <span><strong>JS:</strong> ${jsTime} ms</span>
        <span><strong>Wasm:</strong> ${wasmTime} ms</span>
      </div>
      <div class="metric-summary">${speedupText}</div>
    `;

    return {
      slug: config.slug,
      passed: true,
      jsMs: jsResult.durationMs,
      wasmMs: wasmResult.durationMs,
    };
  } catch (err) {
    statusEl.textContent = "✕ Error";
    statusEl.className = "card-status failed";
    metricsEl.textContent = err.message;
    return { slug: config.slug, passed: false, error: err.message };
  }
}

function initUI() {
  const container = document.getElementById("benchmark-cards");
  const runAllBtn = document.getElementById("run-all-benchmarks");
  const progressContainer = document.getElementById("batch-progress-container");
  const progressBar = document.getElementById("batch-progress-bar");
  const progressText = document.getElementById("batch-progress-text");

  if (!container) return;

  container.innerHTML = "";

  WORKLOAD_CONFIGS.forEach((config) => {
    const card = document.createElement("div");
    card.className = "benchmark-card";
    card.dataset.slug = config.slug;

    const hasWorker = Boolean(config.workerScript);
    const pageRoute = config.route || `/benchmarks/${config.slug}/`;

    card.innerHTML = `
      <div class="card-header">
        <span class="category-badge">${config.category}</span>
        <span class="card-status idle">Idle</span>
      </div>
      <h3>${config.title}</h3>
      <p class="card-desc">${config.description}</p>
      <div class="card-metrics">Click "Run Test" or open the demo route to execute.</div>
      <div class="card-actions">
        ${hasWorker ? `<button type="button" class="btn-run-card">Run JS vs Wasm</button>` : ""}
        <a href="${pageRoute}" class="btn-link-card">Open Demo Page →</a>
      </div>
    `;

    if (hasWorker) {
      card.querySelector(".btn-run-card").addEventListener("click", () => {
        runWorkerBenchmark(config, card);
      });
    }

    container.appendChild(card);
  });

  if (runAllBtn) {
    runAllBtn.addEventListener("click", async () => {
      runAllBtn.disabled = true;
      progressContainer.hidden = false;

      const workerConfigs = WORKLOAD_CONFIGS.filter((c) => Boolean(c.workerScript));
      let completed = 0;
      let passedCount = 0;

      for (const config of workerConfigs) {
        progressText.textContent = `Running ${
          completed + 1
        } of ${workerConfigs.length}: ${config.title}...`;
        const card = container.querySelector(`[data-slug="${config.slug}"]`);
        const result = await runWorkerBenchmark(config, card);

        if (result.passed) passedCount++;
        completed++;
        const pct = Math.round((completed / workerConfigs.length) * 100);
        progressBar.style.width = `${pct}%`;
      }

      progressText.textContent =
        `Batch complete: ${passedCount} / ${workerConfigs.length} worker benchmarks passed!`;
      runAllBtn.disabled = false;
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}

// Shared multi-language benchmark runner for wasm-vs-js.
//
// Drives the same kernel across JavaScript, raw WAT, AssemblyScript, C, C++,
// Rust, and Dart (WasmGC) from a per-workload JSON manifest, renders
// side-by-side tables, and keeps the standard shell/controls contract. The
// unified-runner is a binary JS-vs-Wasm harness; this module is the
// multi-engine comparison harness (deviation documented per page).
//
// Manifests: public/benchmarks/multilang-wasm/<id>.manifest.json
//   {
//     "workloadId": "ml.gemm.v1",
//     "kernelLabel": "128x128x128 strict-f32 product",
//     "artifactsBase": "/artifacts/multilang-wasm-benchmark",
//     "engines": [
//       { "key": "js", "label": "JavaScript", "kind": "js" },
//       { "key": "c", "label": "C / Wasm", "kind": "linear", "file": "gemm_c.wasm", "offset": 0 },
//       { "key": "dart", "label": "Dart / WasmGC", "kind": "dart", "file": "gemm_dart.wasm", "glue": "gemm_dart.mjs" }
//     ]
//   }
//
// Per-workload call adapters live in KERNEL_ADAPTERS below (manifests are
// data-only); each adapter exposes the timed callable for its kernel.

export const KERNEL_ADAPTERS = {
  // --- multilang-wasm reference kernels: sum_u32 + fft_butterfly -----------
  "multilang-wasm": {
    kernels: ["sum", "fft"],
    build(mods) {
      const callables = {};
      for (const key of ["wat", "asc", "c", "cpp", "rs"]) {
        const cfg = mods.manifest.engines.find((e) => e.key === key);
        const { instances } = mods.engines[key];
        const call = {};
        if (instances.sum) {
          call.sum = () => {
            const arr = new Uint32Array(1000);
            for (let i = 0; i < 1000; i++) arr[i] = (i % 100) + 1;
            new Uint32Array(instances.sum.instance.exports.memory.buffer, cfg.offset, 1000).set(
              arr,
            );
            return instances.sum.instance.exports.sum_u32(cfg.offset, 1000);
          };
        }
        if (instances.fft) {
          call.fft = () => {
            const real = new Float32Array(512);
            const imag = new Float32Array(512);
            for (let i = 0; i < 512; i++) {
              real[i] = Math.sin(i * 0.1);
              imag[i] = Math.cos(i * 0.1);
            }
            const mem = instances.fft.instance.exports.memory;
            new Float32Array(mem.buffer, cfg.offset, 512).set(real);
            new Float32Array(mem.buffer, cfg.offset + 512 * 4, 512).set(imag);
            instances.fft.instance.exports.fft_butterfly(cfg.offset, cfg.offset + 512 * 4, 512);
            return real[17] + imag[29];
          };
        }
        callables[key] = call;
      }
      const { kernels } = mods.engines.dart;
      callables.js = {
        sum: () => {
          const arr = new Uint32Array(1000);
          for (let i = 0; i < 1000; i++) arr[i] = (i % 100) + 1;
          let s = 0;
          for (let i = 0; i < 1000; i++) s += arr[i];
          return s;
        },
        fft: () => {
          const real = new Float32Array(512);
          const imag = new Float32Array(512);
          for (let i = 0; i < 512; i++) {
            real[i] = Math.sin(i * 0.1);
            imag[i] = Math.cos(i * 0.1);
          }
          for (let step = 1; step < 512; step <<= 1) {
            const angle = -Math.PI / step;
            const wReal = Math.cos(angle);
            const wImag = Math.sin(angle);
            for (let i = 0; i < 512; i += step << 1) {
              let cwR = 1.0, cwI = 0.0;
              for (let j = 0; j < step; j++) {
                const u = i + j, v = i + j + step;
                const tr = real[v] * cwR - imag[v] * cwI;
                const ti = real[v] * cwI + imag[v] * cwR;
                real[v] = real[u] - tr;
                imag[v] = imag[u] - ti;
                real[u] += tr;
                imag[u] += ti;
                const nwR = cwR * wReal - cwI * wImag;
                const nwI = cwR * wImag + cwI * wReal;
                cwR = nwR;
                cwI = nwI;
              }
            }
          }
          return real[17] + imag[29];
        },
      };
      callables.dart = {
        sum: () => {
          const arr = new Uint32Array(1000);
          for (let i = 0; i < 1000; i++) arr[i] = (i % 100) + 1;
          return kernels.sum_u32(arr);
        },
        fft: () => {
          const real = new Float32Array(512);
          const imag = new Float32Array(512);
          for (let i = 0; i < 512; i++) {
            real[i] = Math.sin(i * 0.1);
            imag[i] = Math.cos(i * 0.1);
          }
          kernels.fft_butterfly(real, imag, 512);
          return real[17] + imag[29];
        },
      };
      return callables;
    },
  },

  // --- ml-gemm: strict-f32 GEMM (mirrors benchmarks/v2/ml-gemm) -------------
  "ml.gemm.v1": {
    kernels: ["gemm"],
    build(mods) {
      const M = 128, N = 128, K = 128;
      function inputs() {
        const a = new Float32Array(M * K);
        const b = new Float32Array(K * N);
        const c0 = new Float32Array(M * N);
        let s = 0x91e10da5;
        for (let i = 0; i < a.length; i++) {
          s = (s * 1664525 + 1013904223) >>> 0;
          a[i] = Math.fround((s / 4294967296) * 2 - 1);
        }
        for (let i = 0; i < b.length; i++) {
          s = (s * 1664525 + 1013904223) >>> 0;
          b[i] = Math.fround((s / 4294967296) * 2 - 1);
        }
        for (let i = 0; i < c0.length; i++) {
          s = (s * 1664525 + 1013904223) >>> 0;
          c0[i] = Math.fround((s / 4294967296) * 2 - 1);
        }
        return { a, b, c0 };
      }
      const callables = {};
      for (const key of ["c", "cpp", "rs"]) {
        const cfg = mods.manifest.engines.find((e) => e.key === key);
        const inst = mods.engines[key].instances.gemm.instance;
        const mem = inst.exports.memory;
        const aOff = 0, bOff = M * K * 4, c0Off = (M * K + K * N) * 4;
        const outOff = (M * K + K * N + M * N) * 4;
        callables[key] = {
          gemm: () => {
            const { a, b, c0 } = inputs();
            new Float32Array(mem.buffer, aOff, M * K).set(a);
            new Float32Array(mem.buffer, bOff, K * N).set(b);
            new Float32Array(mem.buffer, c0Off, M * N).set(c0);
            inst.exports.gemm(aOff, bOff, c0Off, outOff, M, N, K);
          },
        };
      }
      const jsGemm = (a, b, c0, out) => {
        for (let i = 0; i < M; i++) {
          for (let j = 0; j < N; j++) {
            let acc = c0[i * N + j];
            for (let t = 0; t < K; t++) {
              acc = Math.fround(acc + Math.fround(a[i * K + t] * b[t * N + j]));
            }
            out[i * N + j] = acc + 0;
          }
        }
      };
      callables.js = {
        gemm: () => {
          const { a, b, c0 } = inputs();
          jsGemm(a, b, c0, new Float32Array(M * N));
        },
      };
      callables.dart = {
        gemm: () => {
          const { a, b, c0 } = inputs();
          mods.engines.dart.kernels.gemm(a, b, c0, new Float32Array(M * N), M, N, K);
        },
      };
      return callables;
    },
  },
};

let cache = new Map();

async function fetchBytes(base, path) {
  const res = await fetch(`${base}/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function loadEngines(manifest) {
  if (cache.has(manifest.workloadId)) return cache.get(manifest.workloadId);
  const out = { manifest, engines: {} };
  const base = manifest.artifactsBase;

  const linear = manifest.engines.filter((e) => e.kind === "linear");
  const byKernel = {};
  for (const engine of linear) {
    byKernel[engine.key] = {};
    // An engine may declare a kernel subset (e.g. WAT is sum-only); default
    // to every kernel in the manifest.
    const kernels = engine.kernels ?? manifest.kernels;
    for (const kernel of kernels) {
      // Linear engines use one wasm per kernel: <kernel>_<lang>.wasm unless the
      // engine pins a file per kernel via engine.files.
      const file = engine.files?.[kernel] ?? `${kernel}_${engine.lang}.wasm`;
      const bytes = await fetchBytes(base, file);
      const instance = new WebAssembly.Instance(new WebAssembly.Module(bytes));
      byKernel[engine.key][kernel] = { instance, bytes };
    }
  }
  for (const engine of linear) {
    out.engines[engine.key] = {
      cfg: engine,
      instances: byKernel[engine.key],
      bytes: byKernel[engine.key][manifest.kernels[0]].bytes,
    };
  }

  for (const engine of manifest.engines.filter((e) => e.kind === "dart")) {
    const bytes = await fetchBytes(base, engine.file);
    const glueText = await (await fetch(`${base}/${engine.glue}`, { cache: "no-store" })).text();
    const url = URL.createObjectURL(new Blob([glueText], { type: "text/javascript" }));
    const glue = await import(url);
    const app = await glue.compile(bytes);
    const inst = await app.instantiate({});
    inst.invokeMain();
    const kernels = globalThis.dartKernels;
    if (!kernels) throw new Error(`${engine.label}: dartKernels not published`);
    out.engines[engine.key] = { cfg: engine, kernels, bytes };
  }

  cache.set(manifest.workloadId, out);
  return out;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function benchmarkOne(fn, iterations) {
  for (let i = 0; i < 50; i++) fn(); // warm-up (JIT + wasm tiering)
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return {
    medianMs: median(samples),
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
  };
}

async function runWorkload(manifest, kernel, iterations, onProgress) {
  const mods = await loadEngines(manifest);
  const adapter = KERNEL_ADAPTERS[manifest.workloadId];
  if (!adapter || !adapter.kernels.includes(kernel)) {
    throw new Error(`no adapter for ${manifest.workloadId}/${kernel}`);
  }
  const callables = adapter.build(mods);
  const results = [];
  for (const engine of manifest.engines) {
    const fn = callables[engine.key]?.[kernel];
    if (!fn) continue; // engine not applicable to this kernel (e.g. WAT sum-only)
    onProgress(`${engine.label}: ${kernel}...`);
    const stats = benchmarkOne(fn, iterations);
    results.push({
      key: engine.key,
      label: engine.label,
      bytes: mods.engines[engine.key]?.bytes?.byteLength ?? 0,
      ...stats,
    });
  }
  return results;
}

function renderTables(container, manifest, resultsByKernel, iterations) {
  const tables = manifest.kernels.map((kernel) => {
    const results = resultsByKernel[kernel];
    const js = results.find((r) => r.key === "js");
    const jsMs = js ? js.medianMs : Math.max(...results.map((r) => r.medianMs));
    const max = Math.max(...results.map((r) => r.medianMs), 1);
    const rows = results
      .map((r) => {
        const ratio = (r.medianMs / jsMs).toFixed(2);
        const pct = Math.max(2, (r.medianMs / max) * 100);
        const size = r.key === "js" ? "n/a (source)" : `${r.bytes} B`;
        return `
        <tr>
          <td><strong>${r.label}</strong></td>
          <td>${size}</td>
          <td>${r.medianMs.toFixed(3)} ms</td>
          <td>${ratio}×</td>
          <td><div class="perf-bar-track"><div class="perf-bar multilang-bar" data-pct="${pct}" title="${
          r.medianMs.toFixed(3)
        } ms"></div></div></td>
        </tr>`;
      })
      .join("");
    const kernelLabel = manifest.kernelLabels?.[kernel] ?? kernel;
    return `
      <div class="table-wrap">
        <table class="results-table">
          <caption>${kernelLabel} — ${iterations}× warm loop, local run</caption>
          <thead><tr><th>Implementation</th><th>Binary Size</th><th>Warm Median</th><th>vs JS</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  });
  container.innerHTML = tables.join("") +
    `<p class="notice">All timings are measured in this browser tab for this session. They are
      exploratory and depend on engine, device, and load. Per-variant arithmetic semantics are
      disclosed in the report.</p>`;
  container.querySelectorAll(".perf-bar[data-pct]").forEach((bar) => {
    bar.style.width = `${bar.dataset.pct}%`; // CSSOM — CSP style-src 'self'
  });
  container.hidden = false;
}

export async function initMultilangRunner(manifestPath, opts = {}) {
  const form = opts.form ?? document.querySelector("#demo-form");
  const iterationsSelect = opts.iterations ?? document.querySelector("#iterations");
  const startBtn = opts.start ?? document.querySelector("#start");
  const cancelBtn = opts.cancel ?? document.querySelector("#cancel");
  const statusEl = opts.status ?? document.querySelector("#status");
  const reportingEl = opts.reporting ?? document.querySelector("#perf-reporting");
  if (!form || !startBtn || !statusEl || !reportingEl) return;

  const manifest = await (await fetch(manifestPath, { cache: "no-store" })).json();
  let active = false;
  let cancelled = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (active) return;
    active = true;
    cancelled = false;
    startBtn.disabled = true;
    if (iterationsSelect) iterationsSelect.disabled = true;
    cancelBtn.disabled = false;
    reportingEl.hidden = true;

    const iterations = parseInt(iterationsSelect?.value ?? "30", 10);

    try {
      statusEl.textContent = "Loading engines...";
      await loadEngines(manifest);

      const results = {};
      for (const kernel of KERNEL_ADAPTERS[manifest.workloadId].kernels) {
        statusEl.textContent = `Running ${kernel} (${iterations}× loop)...`;
        results[kernel] = await runWorkload(manifest, kernel, iterations, (m) => {
          statusEl.textContent = m;
        });
        if (cancelled) throw new Error("cancelled");
      }
      statusEl.textContent = "✓ Benchmark suite completed.";
      renderTables(reportingEl, manifest, results, iterations);
    } catch (err) {
      if (err.message !== "cancelled") {
        statusEl.textContent = `Error: ${err.message || String(err)}`;
      }
    } finally {
      active = false;
      startBtn.disabled = false;
      if (iterationsSelect) iterationsSelect.disabled = false;
      cancelBtn.disabled = true;
      if (cancelled) statusEl.textContent = "Run cancelled by user.";
    }
  });

  cancelBtn.addEventListener("click", () => {
    cancelled = true;
    statusEl.textContent = "Cancelling after current sample...";
  });

  startBtn.disabled = false;
  statusEl.textContent = "Ready. Select loop iterations, then click Start.";
}

if (typeof document !== "undefined" && document.body?.dataset?.multilangManifest) {
  const init = () => initMultilangRunner(document.body.dataset.multilangManifest);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}

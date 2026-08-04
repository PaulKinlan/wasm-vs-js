// Multi-language benchmark runner for /benchmarks/multilang-wasm/.
//
// Runs the same two kernels (sum_u32, fft_butterfly) across every
// implementation — JavaScript, raw WAT, AssemblyScript, C, C++, Rust, and
// Dart (WasmGC) — and renders a comparison table + bars. The unified-runner
// is a binary JS-vs-Wasm harness, so this page owns a multi-engine runner
// while keeping the standard shell and controls.
//
// Everything here executes locally in the page: no uploads, no storage.

const ARTIFACT_BASE = "/artifacts/multilang-wasm-benchmark";

// Sources are exposed as commit-pinned GitHub links (see index.html); this
// table drives the benchmark loop only.
const ENGINES = {
  js: { label: "JavaScript", kind: "js", artifacts: [], workloads: ["sum", "fft"] },
  wat: {
    label: "Raw WAT",
    kind: "linear",
    file: "sum_wat.wasm",
    offset: 0,
    workloads: ["sum"], // pinned sum-u32 artifact; no FFT WAT module exists
  },
  asc: {
    label: "AssemblyScript",
    kind: "linear",
    file: "sum_asc.wasm",
    offset: 1024,
    workloads: ["sum", "fft"],
  },
  c: {
    label: "C / Wasm",
    kind: "linear",
    file: "sum_c.wasm",
    offset: 1024,
    workloads: ["sum", "fft"],
  },
  cpp: {
    label: "C++ / Wasm",
    kind: "linear",
    file: "sum_cpp.wasm",
    offset: 1024,
    workloads: ["sum", "fft"],
  },
  rs: {
    label: "Rust / Wasm",
    kind: "linear",
    file: "sum_rs.wasm",
    offset: 1024,
    workloads: ["sum", "fft"],
  },
  dart: {
    label: "Dart / WasmGC",
    kind: "dart",
    file: "fft_dart.wasm",
    glue: "fft_dart.mjs",
    workloads: ["sum", "fft"],
  },
};

const SUM_LEN = 1000;
const FFT_LEN = 512;

let cached = null;

async function fetchBytes(path) {
  const res = await fetch(`${ARTIFACT_BASE}/${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function ensureModules() {
  if (cached) return cached;
  const out = {};

  out.js = { cfg: ENGINES.js, bytes: null }; // source-only baseline

  for (const key of ["wat", "asc", "c", "cpp", "rs"]) {
    const cfg = ENGINES[key];
    const instances = {};
    for (const w of cfg.workloads) {
      const file = w === "sum" ? cfg.file : cfg.file.replace("sum_", "fft_");
      const bytes = await fetchBytes(file);
      instances[w] = {
        bytes,
        instance: new WebAssembly.Instance(new WebAssembly.Module(bytes)),
      };
    }
    out[key] = { cfg, instances };
  }

  // Dart / WasmGC via the dart2wasm-generated glue (self-contained module).
  const dartCfg = ENGINES.dart;
  const [dartBytes, glueText] = await Promise.all([
    fetchBytes(dartCfg.file),
    (await fetch(`${ARTIFACT_BASE}/${dartCfg.glue}`, { cache: "no-store" })).text(),
  ]);
  const glueUrl = URL.createObjectURL(
    new Blob([glueText], { type: "text/javascript" }),
  );
  const glue = await import(glueUrl);
  const app = await glue.compile(dartBytes);
  const inst = await app.instantiate({});
  inst.invokeMain();
  const kernels = globalThis.dartKernels;
  if (!kernels || typeof kernels.sum_u32 !== "function") {
    throw new Error("Dart main() did not publish dartKernels");
  }
  out.dart = { cfg: dartCfg, bytes: dartBytes, kernels };

  cached = out;
  return out;
}

// --- kernels ---------------------------------------------------------------

function jsSumU32(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

function jsFftButterfly(real, imag, len) {
  for (let step = 1; step < len; step <<= 1) {
    const angle = -3.14159265358979323846 / step;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let i = 0; i < len; i += step << 1) {
      let curWReal = 1.0;
      let curWImag = 0.0;
      for (let j = 0; j < step; j++) {
        const u = i + j;
        const v = i + j + step;
        const tr = real[v] * curWReal - imag[v] * curWImag;
        const ti = real[v] * curWImag + imag[v] * curWReal;
        real[v] = real[u] - tr;
        imag[v] = imag[u] - ti;
        real[u] += tr;
        imag[u] += ti;
        const nwR = curWReal * wReal - curWImag * wImag;
        const nwI = curWReal * wImag + curWImag * wReal;
        curWReal = nwR;
        curWImag = nwI;
      }
    }
  }
}

function makeSumInput() {
  const arr = new Uint32Array(SUM_LEN);
  for (let i = 0; i < SUM_LEN; i++) arr[i] = (i % 100) + 1;
  return arr;
}

function makeFftInputs() {
  const real = new Float32Array(FFT_LEN);
  const imag = new Float32Array(FFT_LEN);
  for (let i = 0; i < FFT_LEN; i++) {
    real[i] = Math.sin(i * 0.1);
    imag[i] = Math.cos(i * 0.1);
  }
  return { real, imag };
}

function setupLinearMemory(instance, offset, length, typed, values) {
  const view = new typed(instance.exports.memory.buffer, offset, length);
  view.set(values);
  return view;
}

// Builds a callable per engine per workload.
function buildCallables(mods) {
  const callables = {};

  for (const key of ["wat", "asc", "c", "cpp", "rs"]) {
    const { cfg, instances } = mods[key];
    const call = (w, fnName, extraArgs) => {
      const { instance } = instances[w];
      return instance.exports[fnName](...extraArgs);
    };
    callables[key] = {
      sum: () => {
        setupLinearMemory(
          instances.sum.instance,
          cfg.offset,
          SUM_LEN,
          Uint32Array,
          makeSumInput(),
        );
        return call("sum", "sum_u32", [cfg.offset, SUM_LEN]);
      },
      fft: () => {
        const { real, imag } = makeFftInputs();
        setupLinearMemory(instances.fft.instance, cfg.offset, FFT_LEN, Float32Array, real);
        setupLinearMemory(
          instances.fft.instance,
          cfg.offset + FFT_LEN * 4,
          FFT_LEN,
          Float32Array,
          imag,
        );
        call("fft", "fft_butterfly", [cfg.offset, cfg.offset + FFT_LEN * 4, FFT_LEN]);
        return real[17] + imag[29];
      },
    };
  }

  const { kernels } = mods.dart;
  callables.js = {
    sum: () => jsSumU32(makeSumInput()),
    fft: () => {
      const { real, imag } = makeFftInputs();
      jsFftButterfly(real, imag, FFT_LEN);
      return real[17] + imag[29];
    },
  };
  callables.dart = {
    sum: () => kernels.sum_u32(makeSumInput()),
    fft: () => {
      const { real, imag } = makeFftInputs();
      kernels.fft_butterfly(real, imag, FFT_LEN);
      return real[17] + imag[29];
    },
  };
  return callables;
}

// Median helper
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function benchmarkOne(fn, iterations) {
  // warm-up (JIT + wasm tiering)
  for (let i = 0; i < 100; i++) fn();
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

async function runWorkload(name, iterations, onProgress) {
  const mods = await ensureModules();
  const callables = buildCallables(mods);
  const results = [];

  for (const key of Object.keys(ENGINES)) {
    const cfg = ENGINES[key];
    if (!cfg.workloads.includes(name)) continue; // e.g. WAT is sum-only
    onProgress(`${cfg.label}: ${name}...`);
    const stats = benchmarkOne(callables[key][name], iterations);
    const bytes = name === "sum"
      ? (mods[key]?.instances?.sum?.bytes ?? mods[key]?.bytes)?.byteLength ?? 0
      : (mods[key]?.instances?.fft?.bytes ?? mods[key]?.bytes)?.byteLength ?? 0;
    results.push({
      key,
      label: cfg.label,
      kind: cfg.kind,
      bytes,
      ...stats,
    });
  }
  return results;
}

// --- rendering -------------------------------------------------------------

function renderTables(container, workloads, iterations) {
  const jsSum = workloads.sum.find((r) => r.key === "js").medianMs;
  const jsFft = workloads.fft.find((r) => r.key === "js").medianMs;
  const max = Math.max(
    ...workloads.sum.map((r) => r.medianMs),
    ...workloads.fft.map((r) => r.medianMs),
    1,
  );

  const tableFor = (name, results, jsMs) => {
    const rows = results
      .map((r) => {
        const ratio = (r.medianMs / jsMs).toFixed(2);
        const pct = Math.max(2, (r.medianMs / max) * 100);
        const size = r.kind === "js" ? "n/a (source)" : `${r.bytes} B`;
        return `
        <tr>
          <td><strong>${r.label}</strong></td>
          <td>${size}</td>
          <td>${r.medianMs.toFixed(3)} ms</td>
          <td>${ratio}×</td>
          <td>
            <div class="perf-bar-track">
              <div class="perf-bar multilang-bar" data-pct="${pct}" title="${
          r.medianMs.toFixed(3)
        } ms"></div>
            </div>
          </td>
        </tr>`;
      })
      .join("");
    return `
    <div class="table-wrap">
      <table class="results-table">
        <caption>${name} — ${iterations}× warm loop, local run</caption>
        <thead>
          <tr>
            <th>Implementation</th>
            <th>Binary Size</th>
            <th>Warm Median</th>
            <th>vs JS</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  };

  container.innerHTML = tableFor("sum-u32 (1,000 u32 values)", workloads.sum, jsSum) +
    tableFor("fft-kernel (512 floats)", workloads.fft, jsFft) +
    `<p class="notice">All timings are measured in this browser tab for this session.
      They are exploratory and depend on engine, device, and load. Cold-start
      and instantiation costs are shown in the report below.</p>`;
  // Set bar widths via CSSOM (CSP style-src 'self' forbids inline style attrs).
  container.querySelectorAll(".perf-bar[data-pct]").forEach((bar) => {
    bar.style.width = `${bar.dataset.pct}%`;
  });
  container.hidden = false;
}

// --- controls (standard shell contract) ------------------------------------

function initMultilangRunner() {
  const form = document.querySelector("#demo-form");
  const iterationsSelect = document.querySelector("#iterations");
  const startBtn = document.querySelector("#start");
  const cancelBtn = document.querySelector("#cancel");
  const statusEl = document.querySelector("#status");
  const reportingEl = document.querySelector("#perf-reporting");
  if (!form || !startBtn || !statusEl || !reportingEl) return;

  let active = false;
  let cancelled = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (active) return;
    active = true;
    cancelled = false;
    startBtn.disabled = true;
    iterationsSelect.disabled = true;
    cancelBtn.disabled = false;
    reportingEl.hidden = true;

    const iterations = parseInt(iterationsSelect.value, 10);

    try {
      statusEl.textContent = "Loading engines...";
      await ensureModules();

      statusEl.textContent = `Running sum-u32 (${iterations}× loop)...`;
      const sum = await runWorkload("sum", iterations, (m) => {
        statusEl.textContent = m;
      });
      if (cancelled) throw new Error("cancelled");

      statusEl.textContent = `Running fft-kernel (${iterations}× loop)...`;
      const fft = await runWorkload("fft", iterations, (m) => {
        statusEl.textContent = m;
      });
      if (cancelled) throw new Error("cancelled");

      statusEl.textContent = "✓ Benchmark suite completed.";
      renderTables(reportingEl, { sum, fft }, iterations);
    } catch (err) {
      if (err.message !== "cancelled") {
        statusEl.textContent = `Error: ${err.message || String(err)}`;
      }
    } finally {
      active = false;
      startBtn.disabled = false;
      iterationsSelect.disabled = false;
      cancelBtn.disabled = true;
      if (cancelled) statusEl.textContent = "Run cancelled by user.";
    }
  });

  cancelBtn.addEventListener("click", () => {
    cancelled = true;
    statusEl.textContent = "Cancelling after current sample...";
  });

  startBtn.disabled = false;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMultilangRunner);
} else {
  initMultilangRunner();
}

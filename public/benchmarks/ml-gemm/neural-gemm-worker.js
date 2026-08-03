import * as gemm from "/benchmarks/v2/ml-gemm/workload.js";

const GEMM_A_OFF = 0;
const GEMM_B_OFF = 4 * 512 * 512 * 4;
const GEMM_C_OFF = GEMM_B_OFF + 4 * 512 * 512 * 4;
const GEMM_C0_OFF = GEMM_C_OFF + 4 * 512 * 512 * 4;
const BATCH = 4, M = 512, N = 512, K = 512;

let running = false;
let token = 0;

self.onmessage = async (event) => {
  const msg = event.data;
  if (msg.type === "run" && !running) {
    running = true;
    token = msg.token;
    try {
      await runGemm(msg.token, msg.target || "both");
    } catch (err) {
      if (msg.token === token) {
        self.postMessage({ type: "error", detail: String(err?.message || err), token: msg.token });
      }
    }
    running = false;
  } else if (msg.type === "cancel") {
    token++;
    running = false;
  }
};

async function fetchBuf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

function validateOutput(output, reference, bounds, label) {
  if (output.length !== reference.length || output.length !== bounds.length) {
    throw new Error(
      `${label} length mismatch: out=${output.length} ref=${reference.length} bounds=${bounds.length}`,
    );
  }
  let maxDev = 0, violations = 0;
  for (let i = 0; i < output.length; i++) {
    if (!Number.isFinite(output[i])) throw new Error(`${label}[${i}] is NaN/Inf: ${output[i]}`);
    const dev = Math.abs(output[i] - reference[i]);
    if (dev > maxDev) maxDev = dev;
    if (dev > bounds[i]) violations++;
  }
  return { maxDev, violations };
}

async function runGemm(runToken, target, mode) {
  const exact = mode === "exact";
  const post = (type, data = {}) => {
    if (runToken === token) self.postMessage({ type, token: runToken, ...data });
  };
  const myToken = runToken;

  post("phase", { message: "Loading artifacts…" });
  const wasmBytes = await fetchBuf("/artifacts/v2/ml-gemm/ml-gemm.wasm");
  const refBytes = await fetchBuf("/artifacts/v2/ml-gemm/reference.f64");
  const boundsBytes = await fetchBuf("/artifacts/v2/ml-gemm/bounds.f32");
  const reference = new Float64Array(refBytes.buffer, refBytes.byteOffset, refBytes.byteLength / 8);
  const bounds = new Float32Array(
    boundsBytes.buffer,
    boundsBytes.byteOffset,
    boundsBytes.byteLength / 4,
  );
  if (reference.length !== BATCH * M * N) {
    throw new Error(`reference length ${reference.length} ≠ ${BATCH * M * N}`);
  }
  if (bounds.length !== BATCH * M * N) {
    throw new Error(`bounds length ${bounds.length} ≠ ${BATCH * M * N}`);
  }
  post("phase", {
    message:
      `Artifacts loaded: wasm ${wasmBytes.byteLength}B, ref ${reference.length} f64, bounds ${bounds.length} f32`,
  });

  if (exact) {
    post("phase", { message: "Exact mode: hashing raw bytes..." });
    const manifestResp = await fetch("/artifacts/v2/ml-gemm/fixture-manifest.json");
    if (!manifestResp.ok) throw new Error("fixture-manifest.json not available");
    const manifest = await manifestResp.json();
    const wasmHash = await crypto.subtle.digest("SHA-256", wasmBytes);
    const wasmHashHex = [...new Uint8Array(wasmHash)].map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (
      manifest.parameters && manifest.parameters.batch !== BATCH
    ) throw new Error("manifest batch mismatch");
    post("phase", { message: `Exact: wasm sha256=${wasmHashHex.slice(0, 12)}... verified.` });
  }

  post("phase", { message: "Generating input…" });
  const { a, b, c0 } = gemm.generateInput();

  const results = {};

  if (target === "both" || target === "js") {
    if (myToken !== token) return;
    post("phase", { message: "Running JS GEMM…" });
    const jsC = new Float32Array(BATCH * M * N);
    const jsStart = performance.now();
    for (let t = 0; t < BATCH; t++) {
      gemm.gemmMatrixF32(a, b, c0, jsC, M, N, K, t * M * K, t * K * N, t * M * N, t * M * N);
    }
    const jsMs = performance.now() - jsStart;
    const jsVal = validateOutput(jsC, reference, bounds, "JS");
    post("phase", {
      message: `JS: ${jsMs.toFixed(2)}ms, max dev ${
        jsVal.maxDev.toExponential(3)
      }, violations ${jsVal.violations}`,
    });
    results.js = {
      ms: jsMs.toFixed(2),
      maxDeviation: jsVal.maxDev.toExponential(3),
      boundViolations: jsVal.violations,
    };
    if (jsVal.violations > 0) throw new Error(`JS has ${jsVal.violations} bound violations`);
  }

  if (target === "both" || target === "wasm") {
    if (myToken !== token) return;
    post("phase", { message: "Running Wasm GEMM…" });
    const mod = await WebAssembly.compile(wasmBytes);
    const inst = await WebAssembly.instantiate(mod);
    const exp = inst.exports;
    const heap = new Float32Array(exp.memory.buffer);
    heap.set(a, GEMM_A_OFF / 4);
    heap.set(b, GEMM_B_OFF / 4);
    heap.set(c0, GEMM_C0_OFF / 4);
    // Copy C0 → C (gemm_f32 accumulates onto C in-place)
    heap.set(c0, GEMM_C_OFF / 4);
    const wasmStart = performance.now();
    for (let t = 0; t < BATCH; t++) {
      exp.gemm_f32(
        GEMM_A_OFF + t * M * K * 4,
        GEMM_B_OFF + t * K * N * 4,
        GEMM_C_OFF + t * M * N * 4,
        M,
        N,
        K,
      );
    }
    const wasmMs = performance.now() - wasmStart;
    const wasmC = new Float32Array(heap.subarray(GEMM_C_OFF / 4, GEMM_C_OFF / 4 + BATCH * M * N));
    const wasmVal = validateOutput(wasmC, reference, bounds, "Wasm");
    post("phase", {
      message: `Wasm: ${wasmMs.toFixed(2)}ms, max dev ${
        wasmVal.maxDev.toExponential(3)
      }, violations ${wasmVal.violations}`,
    });
    results.wasm = {
      ms: wasmMs.toFixed(2),
      maxDeviation: wasmVal.maxDev.toExponential(3),
      boundViolations: wasmVal.violations,
    };
    if (wasmVal.violations > 0) throw new Error(`Wasm has ${wasmVal.violations} bound violations`);

    // Cross-target check
    if (results.js) {
      let identical = true;
      const jsC = new Float32Array(BATCH * M * N);
      for (let t = 0; t < BATCH; t++) {
        gemm.gemmMatrixF32(a, b, c0, jsC, M, N, K, t * M * K, t * K * N, t * M * N, t * M * N);
      }
      for (let i = 0; i < wasmC.length; i++) {
        if (jsC[i] !== wasmC[i]) {
          identical = false;
          break;
        }
      }
      results.crossTargetIdentical = identical;
    }
  }

  const counters = gemm.workCounters({ target: "javascript" });
  post("result", {
    passed: true,
    outputElements: BATCH * M * N,
    counters,
    wasmBytes: wasmBytes.byteLength,
    ...results,
  });
  post("done");
}

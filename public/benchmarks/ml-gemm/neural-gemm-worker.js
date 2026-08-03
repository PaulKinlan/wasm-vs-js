// Neural GEMM demo worker — runs in a fresh module worker.
// Validates JS and Wasm outputs against committed reference/bounds artifacts.
// No upload, no storage, no performance ranking.

import * as gemm from "/benchmarks/v2/ml-gemm/workload.js";

let running = false;
let token = 0;

self.onmessage = async (event) => {
  const msg = event.data;
  if (msg.type === "run") {
    if (running) {
      self.postMessage({ type: "error", detail: "already running" });
      return;
    }
    running = true;
    token = msg.token;
    try {
      await runGemm(msg.token, msg.mode || "default");
    } catch (err) {
      self.postMessage({ type: "error", detail: String(err?.message || err), token: msg.token });
    }
    running = false;
  } else if (msg.type === "cancel") {
    token++; // invalidate stale token
    running = false;
  }
};

async function fetchArrayBuffer(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`);
  return new Uint8Array(await resp.arrayBuffer());
}

async function runGemm(runToken, _mode) {
  const post = (type, data = {}) => {
    if (runToken === token) self.postMessage({ type, token: runToken, ...data });
  };
  post("phase", { message: "Loading artifacts…" });

  // Load Wasm
  const wasmBytes = await fetchArrayBuffer("/artifacts/v2/ml-gemm/ml-gemm.wasm");
  post("phase", { message: `Wasm artifact loaded: ${wasmBytes.byteLength} bytes` });

  // Load reference and bounds
  const refBytes = await fetchArrayBuffer("/artifacts/v2/ml-gemm/reference.f64");
  const boundsBytes = await fetchArrayBuffer("/artifacts/v2/ml-gemm/bounds.f32");
  const reference = new Float64Array(refBytes.buffer, refBytes.byteOffset, refBytes.byteLength / 8);
  const bounds = new Float32Array(
    boundsBytes.buffer,
    boundsBytes.byteOffset,
    boundsBytes.byteLength / 4,
  );

  post("phase", {
    message: `Reference: ${reference.length} f64 values, bounds: ${bounds.length} f32 values`,
  });

  // Generate input (same as build)
  post("phase", { message: "Generating deterministic input…" });
  const { a, b, c0 } = gemm.generateInput();
  post("phase", { message: `Input: A ${a.length}, B ${b.length}, C0 ${c0.length} f32 values` });

  // Instantiate Wasm
  post("phase", { message: "Instantiating Wasm module…" });
  const wasmModule = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(wasmModule);
  const exports = instance.exports;

  // Prepare JS runner
  post("phase", { message: "Preparing JS and Wasm runners…" });
  const BATCH = gemm.BATCH, M = gemm.M, N = gemm.N, K = gemm.K;
  const jsC = new Float32Array(BATCH * M * N);
  const wasmC = new Float32Array(BATCH * M * N);

  // Allocate Wasm memory and load tensors
  const aBytes = a.byteLength, bBytes = b.byteLength, c0Bytes = c0.byteLength;
  const aOff = 0, bOff = aBytes, c0Off = aBytes + bBytes, cOff = aBytes + bBytes + c0Bytes;
  const wasmHeap = new Float32Array(exports.memory.buffer);

  // Run JS
  post("phase", { message: "Running JS GEMM…" });
  const jsStart = performance.now();
  for (let t = 0; t < BATCH; t++) {
    gemm.gemmMatrixF32(a, b, c0, jsC, M, N, K, t * M * K, t * K * N, t * M * N, t * M * N);
  }
  const jsMs = performance.now() - jsStart;
  post("phase", { message: `JS completed in ${jsMs.toFixed(2)} ms` });

  // Run Wasm
  post("phase", { message: "Running Wasm GEMM…" });
  // Copy input to Wasm memory
  wasmHeap.set(a, aOff / 4);
  wasmHeap.set(b, bOff / 4);
  wasmHeap.set(c0, c0Off / 4);

  const wasmStart = performance.now();
  for (let t = 0; t < BATCH; t++) {
    exports.gemm_f32(
      aOff + t * M * K * 4,
      bOff + t * K * N * 4,
      c0Off + t * M * N * 4,
      M,
      N,
      K,
    );
  }
  const wasmMs = performance.now() - wasmStart;
  // Copy output
  wasmC.set(wasmHeap.subarray(cOff / 4, cOff / 4 + BATCH * M * N));
  post("phase", { message: `Wasm completed in ${wasmMs.toFixed(2)} ms` });

  // Validate against reference and bounds
  post("phase", { message: "Validating outputs…" });
  let jsMaxDev = 0, wasmMaxDev = 0;
  let jsBoundViolations = 0, wasmBoundViolations = 0;
  let jsFinite = true, wasmFinite = true;
  let crossMatch = true;

  for (let i = 0; i < BATCH * M * N; i++) {
    if (!Number.isFinite(jsC[i])) jsFinite = false;
    if (!Number.isFinite(wasmC[i])) wasmFinite = false;
    const ref = reference[i];
    const jsDev = Math.abs(jsC[i] - ref);
    const wasmDev = Math.abs(wasmC[i] - ref);
    if (jsDev > jsMaxDev) jsMaxDev = jsDev;
    if (wasmDev > wasmMaxDev) wasmMaxDev = wasmDev;
    if (jsDev > bounds[i]) jsBoundViolations++;
    if (wasmDev > bounds[i]) wasmBoundViolations++;
    if (jsC[i] !== wasmC[i]) crossMatch = false;
  }

  const passed = jsFinite && wasmFinite && jsBoundViolations === 0 && wasmBoundViolations === 0;
  const counters = gemm.workCounters({ target: "javascript" });

  post("phase", { message: passed ? "Validation passed ✓" : "Validation FAILED ✗" });
  post("result", {
    passed,
    jsMs: jsMs.toFixed(2),
    wasmMs: wasmMs.toFixed(2),
    jsMaxDeviation: jsMaxDev.toExponential(3),
    wasmMaxDeviation: wasmMaxDev.toExponential(3),
    jsBoundViolations,
    wasmBoundViolations,
    crossTargetIdentical: crossMatch,
    outputElements: BATCH * M * N,
    counters,
    wasmBytes: wasmBytes.byteLength,
  });

  post("done");
}

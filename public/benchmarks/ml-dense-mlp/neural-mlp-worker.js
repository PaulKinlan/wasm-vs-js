// Neural MLP demo worker — runs in a fresh module worker.
// Validates JS and Wasm layer outputs against committed reference/bounds artifacts.

import * as mlp from "/benchmarks/v2/ml-dense-mlp/workload.js";

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
      await runMlp(msg.token, msg.mode || "default");
    } catch (err) {
      self.postMessage({ type: "error", detail: String(err?.message || err), token: msg.token });
    }
    running = false;
  } else if (msg.type === "cancel") {
    token++;
    running = false;
  }
};

async function fetchArrayBuffer(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`);
  return new Uint8Array(await resp.arrayBuffer());
}

async function runMlp(runToken, _mode) {
  const post = (type, data = {}) => {
    if (runToken === token) self.postMessage({ type, token: runToken, ...data });
  };
  post("phase", { message: "Loading artifacts…" });

  const wasmBytes = await fetchArrayBuffer("/artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm");
  post("phase", { message: `Wasm artifact loaded: ${wasmBytes.byteLength} bytes` });

  const refBytes = await fetchArrayBuffer("/artifacts/v2/ml-dense-mlp/reference.f64");
  const boundsBytes = await fetchArrayBuffer("/artifacts/v2/ml-dense-mlp/bounds.f32");
  const reference = new Float64Array(refBytes.buffer, refBytes.byteOffset, refBytes.byteLength / 8);
  const bounds = new Float32Array(
    boundsBytes.buffer,
    boundsBytes.byteOffset,
    boundsBytes.byteLength / 4,
  );
  post("phase", {
    message: `Reference: ${reference.length} f64 values, bounds: ${bounds.length} f32 values`,
  });

  post("phase", { message: "Generating deterministic input…" });
  const input = mlp.generateInput();
  const { x, w, bias } = input;
  post("phase", { message: `Input: x ${x.length}, w ${w.length}, bias ${bias.length} f32 values` });

  post("phase", { message: "Instantiating Wasm module…" });
  const wasmModule = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(wasmModule);
  const exports = instance.exports;

  const BATCH = mlp.MLP_BATCH, WIDTH = mlp.WIDTH, LAYERS = mlp.LAYERS;
  const scratchA = new Float32Array(BATCH * WIDTH);
  const scratchB = new Float32Array(BATCH * WIDTH);
  const jsY = new Float32Array(BATCH * WIDTH);
  const wasmY = new Float32Array(BATCH * WIDTH);

  // Prepare Wasm memory layout (matches neural.ts MLP layout)
  const heap = new Float32Array(exports.memory.buffer);
  const X_OFF = 0;
  const W_OFF = BATCH * WIDTH * 4;
  const BIAS_OFF = W_OFF + LAYERS * WIDTH * WIDTH * 4;
  const SCRATCH_A_OFF = BIAS_OFF + LAYERS * WIDTH * 4;
  const SCRATCH_B_OFF = SCRATCH_A_OFF + BATCH * WIDTH * 4;
  const Y_OFF = SCRATCH_B_OFF + BATCH * WIDTH * 4;

  // Run JS
  post("phase", { message: "Running JS MLP…" });
  const jsStart = performance.now();
  mlp.mlpControlled(x, w, bias, scratchA, scratchB, jsY);
  const jsMs = performance.now() - jsStart;
  post("phase", { message: `JS completed in ${jsMs.toFixed(2)} ms (${LAYERS} layers)` });

  // Run Wasm
  post("phase", { message: "Running Wasm MLP…" });
  heap.set(x, X_OFF / 4);
  heap.set(w, W_OFF / 4);
  heap.set(bias, BIAS_OFF / 4);

  const wasmStart = performance.now();
  exports.mlp_forward(
    X_OFF,
    W_OFF,
    BIAS_OFF,
    SCRATCH_A_OFF,
    SCRATCH_B_OFF,
    Y_OFF,
    BATCH,
    WIDTH,
    LAYERS,
  );
  const wasmMs = performance.now() - wasmStart;
  wasmY.set(heap.subarray(Y_OFF / 4, Y_OFF / 4 + BATCH * WIDTH));
  post("phase", { message: `Wasm completed in ${wasmMs.toFixed(2)} ms` });

  // Validate final output against reference/bounds
  post("phase", { message: "Validating outputs…" });
  let jsMaxDev = 0, wasmMaxDev = 0;
  let jsBoundViolations = 0, wasmBoundViolations = 0;
  let jsFinite = true, wasmFinite = true;

  const outputLen = BATCH * WIDTH;
  for (let i = 0; i < outputLen; i++) {
    if (!Number.isFinite(jsY[i])) jsFinite = false;
    if (!Number.isFinite(wasmY[i])) wasmFinite = false;
    const ref = reference[i];
    const jsDev = Math.abs(jsY[i] - ref);
    const wasmDev = Math.abs(wasmY[i] - ref);
    if (jsDev > jsMaxDev) jsMaxDev = jsDev;
    if (wasmDev > wasmMaxDev) wasmMaxDev = wasmDev;
    if (jsDev > bounds[i]) jsBoundViolations++;
    if (wasmDev > bounds[i]) wasmBoundViolations++;
  }

  const passed = jsFinite && wasmFinite && jsBoundViolations === 0 && wasmBoundViolations === 0;
  const counters = mlp.workCounters({ target: "javascript" });

  post("phase", { message: passed ? "Validation passed ✓" : "Validation FAILED ✗" });
  post("result", {
    passed,
    jsMs: jsMs.toFixed(2),
    wasmMs: wasmMs.toFixed(2),
    jsMaxDeviation: jsMaxDev.toExponential(3),
    wasmMaxDeviation: wasmMaxDev.toExponential(3),
    jsBoundViolations,
    wasmBoundViolations,
    outputElements: outputLen,
    layers: LAYERS,
    counters,
    wasmBytes: wasmBytes.byteLength,
  });

  post("done");
}

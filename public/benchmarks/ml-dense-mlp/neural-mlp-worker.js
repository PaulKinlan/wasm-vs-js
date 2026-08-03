import * as mlp from "/benchmarks/v2/ml-dense-mlp/workload.js";

const MLP_BATCH = 32, WIDTH = 512, LAYERS = 9;
const MLP_X_OFF = 0;
const MLP_W_OFF = MLP_BATCH * WIDTH * 4;
const MLP_BIAS_OFF = MLP_W_OFF + LAYERS * WIDTH * WIDTH * 4;
const MLP_SCRATCH_A_OFF = MLP_BIAS_OFF + LAYERS * WIDTH * 4;
const MLP_SCRATCH_B_OFF = MLP_SCRATCH_A_OFF + MLP_BATCH * WIDTH * 4;
const MLP_Y_OFF = MLP_SCRATCH_B_OFF + MLP_BATCH * WIDTH * 4;

let running = false;
let token = 0;

self.onmessage = async (event) => {
  const msg = event.data;
  if (msg.type === "run" && !running) {
    running = true;
    token = msg.token;
    try {
      await runMlp(msg.token, msg.target || "both");
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

async function runMlp(runToken, target) {
  const post = (type, data = {}) => {
    if (runToken === token) self.postMessage({ type, token: runToken, ...data });
  };
  const myToken = runToken;

  post("phase", { message: "Loading artifacts…" });
  const wasmBytes = await fetchBuf("/artifacts/v2/ml-dense-mlp/ml-dense-mlp.wasm");
  const refBytes = await fetchBuf("/artifacts/v2/ml-dense-mlp/reference.f64");
  const boundsBytes = await fetchBuf("/artifacts/v2/ml-dense-mlp/bounds.f32");
  const reference = new Float64Array(refBytes.buffer, refBytes.byteOffset, refBytes.byteLength / 8);
  const bounds = new Float32Array(
    boundsBytes.buffer,
    boundsBytes.byteOffset,
    boundsBytes.byteLength / 4,
  );
  // reference = 9 layers × 32 batch × 512 width = 147456 values
  if (reference.length !== LAYERS * MLP_BATCH * WIDTH) {
    throw new Error(`reference ${reference.length} ≠ ${LAYERS * MLP_BATCH * WIDTH}`);
  }
  if (bounds.length !== LAYERS * MLP_BATCH * WIDTH) {
    throw new Error(`bounds ${bounds.length} ≠ ${LAYERS * MLP_BATCH * WIDTH}`);
  }
  post("phase", {
    message:
      `Artifacts: wasm ${wasmBytes.byteLength}B, ref ${reference.length} f64 (9 layers), bounds ${bounds.length} f32`,
  });

  post("phase", { message: "Generating input…" });
  const { x, w, bias } = mlp.generateInput();

  const results = {};
  const layerLen = MLP_BATCH * WIDTH;

  if (target === "both" || target === "js") {
    if (myToken !== token) return;
    post("phase", { message: "Running JS MLP…" });
    const scratchA = new Float32Array(layerLen);
    const scratchB = new Float32Array(layerLen);
    const jsY = new Float32Array(layerLen);
    const jsStart = performance.now();
    mlp.mlpControlled(x, w, bias, scratchA, scratchB, jsY);
    const jsMs = performance.now() - jsStart;

    // Validate final layer (last layerLen values of reference)
    const jsFinalRef = reference.subarray((LAYERS - 1) * layerLen, LAYERS * layerLen);
    const jsFinalBounds = bounds.subarray((LAYERS - 1) * layerLen, LAYERS * layerLen);
    const jsVal = validateOutput(jsY, jsFinalRef, jsFinalBounds, "JS final");
    post("phase", {
      message: `JS: ${jsMs.toFixed(2)}ms, final max dev ${
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
    post("phase", { message: "Running Wasm MLP…" });
    const mod = await WebAssembly.compile(wasmBytes);
    const inst = await WebAssembly.instantiate(mod);
    const exp = inst.exports;
    const heap = new Float32Array(exp.memory.buffer);
    heap.set(x, MLP_X_OFF / 4);
    heap.set(w, MLP_W_OFF / 4);
    heap.set(bias, MLP_BIAS_OFF / 4);

    const wasmStart = performance.now();
    // Per-layer forward pass matching neural.ts MlpWasmRunner.compute()
    let inOff = MLP_X_OFF;
    for (let layer = 0; layer < LAYERS; layer++) {
      const outOff = layer === LAYERS - 1
        ? MLP_Y_OFF
        : layer % 2 === 0
        ? MLP_SCRATCH_A_OFF
        : MLP_SCRATCH_B_OFF;
      exp.linear_f32(
        inOff,
        MLP_W_OFF + layer * WIDTH * WIDTH * 4,
        MLP_BIAS_OFF + layer * WIDTH * 4,
        outOff,
        MLP_BATCH,
        WIDTH,
      );
      if (layer < LAYERS - 1) exp.gelu_f32(outOff, MLP_BATCH * WIDTH);
      inOff = outOff;
    }
    const wasmMs = performance.now() - wasmStart;

    const wasmY = new Float32Array(heap.subarray(MLP_Y_OFF / 4, MLP_Y_OFF / 4 + layerLen));
    const wasmFinalRef = reference.subarray((LAYERS - 1) * layerLen, LAYERS * layerLen);
    const wasmFinalBounds = bounds.subarray((LAYERS - 1) * layerLen, LAYERS * layerLen);
    const wasmVal = validateOutput(wasmY, wasmFinalRef, wasmFinalBounds, "Wasm final");
    post("phase", {
      message: `Wasm: ${wasmMs.toFixed(2)}ms, final max dev ${
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
      const scratchA2 = new Float32Array(layerLen), scratchB2 = new Float32Array(layerLen);
      const jsY2 = new Float32Array(layerLen);
      mlp.mlpControlled(x, w, bias, scratchA2, scratchB2, jsY2);
      let identical = true;
      for (let i = 0; i < wasmY.length; i++) {
        if (jsY2[i] !== wasmY[i]) {
          identical = false;
          break;
        }
      }
      results.crossTargetIdentical = identical;
    }
  }

  const counters = mlp.workCounters({ target: "javascript" });
  post("result", {
    passed: true,
    outputElements: layerLen,
    layers: LAYERS,
    counters,
    wasmBytes: wasmBytes.byteLength,
    ...results,
  });
  post("done");
}

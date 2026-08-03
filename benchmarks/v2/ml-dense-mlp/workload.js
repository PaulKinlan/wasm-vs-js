import { fillUniformF32 } from "../shared/generator.js";
import { geluFrozenF64 } from "./frozen-transcendentals.js";

// v2 proposal workload ml.dense-mlp.v1 (benchmark slug ml-dense-mlp),
// controlled track. A batch of MLP_BATCH inputs flows through HIDDEN_LAYERS
// WIDTH-wide hidden layers with the frozen GELU-tanh activation and one final
// WIDTH-wide linear projection, all row-major with strict f32 left-to-right
// accumulation, unfused operators, reusable scratch, and one call per
// operator. JavaScript reproduces strict f32 exactly with Math.fround after
// every multiply and every add (the product of two f32 values is exact in f64
// before rounding, and fround(a+b) on f32 operands is bit-identical to
// hardware f32.add, verified exhaustively over 54M adversarial cases).
// GELU promotes the f32 pre-activation to f64 and applies the frozen tanh
// formula from frozen-transcendentals.js, which implements the identical
// algorithm and IEEE 754 operation order as the Wasm kernel, so both
// controlled targets are bit-identical for every finite input and propagate
// NaN identically (the kernel never traps; NaN policy "reject" is enforced
// by validation). Signed-zero policy "normalize-positive" is enforced by
// the +0 store adjustment. The compute path performs zero object
// allocations per repetition: tensors are addressed with explicit base
// offsets instead of subarray views, matching the exact allocations: 0
// counter.

export const MLP_BATCH = 32;
export const WIDTH = 512;
export const HIDDEN_LAYERS = 8;
export const LAYERS = HIDDEN_LAYERS + 1; // hidden layers plus the final projection
export const GENERATOR_SEED = 0x5a17c0de;

export const GELU_COEFF = 0.7978845608028654; // sqrt(2/pi) rounded to f64
export const GELU_BETA = 0.044715;

// Declared tensor order: x, then per layer W then bias.
export function generateInput() {
  const x = new Float32Array(MLP_BATCH * WIDTH);
  const w = new Float32Array(LAYERS * WIDTH * WIDTH);
  const bias = new Float32Array(LAYERS * WIDTH);
  let stream = 0;
  fillUniformF32(GENERATOR_SEED, stream, x, 1);
  stream += 1;
  for (let layer = 0; layer < LAYERS; layer += 1) {
    fillUniformF32(
      GENERATOR_SEED,
      stream,
      w.subarray(layer * WIDTH * WIDTH, (layer + 1) * WIDTH * WIDTH),
      0.0625,
    );
    stream += 1;
    fillUniformF32(
      GENERATOR_SEED,
      stream,
      bias.subarray(layer * WIDTH, (layer + 1) * WIDTH),
      0.25,
    );
    stream += 1;
  }
  return { x, w, bias };
}

// Frozen GELU on an f64 argument. Delegates to the shared frozen
// transcendental module so the JavaScript and Wasm targets execute the
// identical algorithm with the identical operation order; platform
// Math.tanh is intentionally not used in the controlled workload path.
export function geluF64(preActivation) {
  return geluFrozenF64(preActivation);
}

// Strict f32 linear layer: y[bi][o] = normalize+0( bias[o] + sum_i x[bi][i] * W[i][o] ).
// Base-offset addressing keeps the compute path allocation-free.
export function linearLayerF32(
  x,
  w,
  bias,
  y,
  batch = MLP_BATCH,
  width = WIDTH,
  wOff = 0,
  biasOff = 0,
) {
  for (let bi = 0; bi < batch; bi += 1) {
    for (let o = 0; o < width; o += 1) {
      let acc = bias[biasOff + o];
      for (let i = 0; i < width; i += 1) {
        acc = Math.fround(acc + Math.fround(x[bi * width + i] * w[wOff + i * width + o]));
      }
      y[bi * width + o] = acc + 0;
    }
  }
  return y;
}

// In-place frozen GELU over a batch buffer.
export function geluInPlace(buffer) {
  for (let index = 0; index < buffer.length; index += 1) {
    buffer[index] = Math.fround(geluF64(buffer[index])) + 0;
  }
  return buffer;
}

// Controlled-track entry point: unfused operators, one call per operator,
// ping-pong reusable scratch, final projection without activation.
export function mlpControlled(x, w, bias, scratchA, scratchB, y, options) {
  // Optional trailing options are read with optional chaining so an omitted
  // argument performs no default-object allocation: the measured compute
  // path allocates nothing per repetition.
  const batch = options?.batch ?? MLP_BATCH;
  const width = options?.width ?? WIDTH;
  const hiddenLayers = options?.hiddenLayers ?? HIDDEN_LAYERS;
  const layers = hiddenLayers + 1;
  let input = x;
  for (let layer = 0; layer < layers; layer += 1) {
    const out = layer === layers - 1 ? y : layer % 2 === 0 ? scratchA : scratchB;
    linearLayerF32Offset(input, w, bias, out, layer, batch, width);
    if (layer < layers - 1) geluInPlace(out);
    input = out;
  }
  return y;
}

function linearLayerF32Offset(x, w, bias, y, layer, batch, width) {
  linearLayerF32(
    x,
    w,
    bias,
    y,
    batch,
    width,
    layer * width * width,
    layer * width,
  );
}

// Exact analytic counters for one repetition, matching the proposal
// catalog's declared counter set for ml.dense-mlp.v1.
export function workCounters(options) {
  // Optional-chained options: no default-object allocation, consistent with
  // the zero-allocation compute path contract.
  const boundaryCrossings = options?.boundaryCrossings ?? 0;
  if (!Number.isSafeInteger(boundaryCrossings) || boundaryCrossings < 0) {
    throw new Error("invalid boundary crossing count");
  }
  const macs = MLP_BATCH * LAYERS * WIDTH * WIDTH;
  return {
    layers: LAYERS,
    "output-elements": MLP_BATCH * LAYERS * WIDTH,
    "multiply-accumulates": macs,
    "activation-evaluations": MLP_BATCH * HIDDEN_LAYERS * WIDTH,
    "tensor-bytes": 4 * (MLP_BATCH * WIDTH + LAYERS * WIDTH * WIDTH + LAYERS * WIDTH),
    "scratch-bytes": 2 * MLP_BATCH * WIDTH * 4,
    allocations: 0,
    "boundary-crossings": boundaryCrossings,
  };
}

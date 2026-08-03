// Harness for the v2 proposal validation slices ml-gemm and ml-dense-mlp:
// linear-memory layouts, phase-separated runners (load / initialize /
// transfer / compute / validation / end-to-end, plus an explicit reset
// interface), pinned f64 references with stored hybrid per-element bounds,
// and the NaN-reject / normalize-positive-zero validation policies. Not part
// of any measured payload.

import { sha256Hex } from "../canonical.ts";
import { countValue, createF32 } from "../../benchmarks/v2/shared/allocations.js";
import {
  BATCH as GEMM_BATCH,
  gemmControlled,
  K as GEMM_K,
  M as GEMM_M,
  N as GEMM_N,
} from "../../benchmarks/v2/ml-gemm/workload.js";
import {
  geluInPlace,
  HIDDEN_LAYERS,
  LAYERS,
  linearLayerF32,
  MLP_BATCH,
  mlpControlled,
  WIDTH,
} from "../../benchmarks/v2/ml-dense-mlp/workload.js";
import { geluFrozenF64 } from "../../benchmarks/v2/ml-dense-mlp/frozen-transcendentals.js";

export const U_F32 = 2 ** -24;
export const ATOL0 = 2 ** -30;
export const TOL_ABS = 1e-5;
export const TOL_REL = 1e-4;

export function bytesOf(view: Float32Array | Float64Array): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

export async function digestOf(view: Float32Array | Float64Array): Promise<string> {
  return await sha256Hex(bytesOf(view));
}

export function assertRepetitions(repetitions: number): void {
  if (!Number.isSafeInteger(repetitions) || repetitions < 1) {
    throw new Error(`invalid repetitions: ${repetitions}`);
  }
}

export type PhaseTimings = {
  load: number;
  initialize: number;
  transfer: number;
  compute: number;
  validation: number;
  reset: number;
  "end-to-end": number;
};

export type ValidationReport = {
  finite: boolean;
  negativeZeroFree: boolean;
  maxDeviation: number;
  maxBoundRatio: number;
  outputDigest: string;
  intermediateDigests: string[];
};

export function checkFiniteAndZero(view: Float32Array): {
  finite: boolean;
  negativeZeroFree: boolean;
} {
  let finite = true;
  let negativeZeroFree = true;
  for (let index = 0; index < view.length; index += 1) {
    const value = view[index];
    if (!Number.isFinite(value)) finite = false;
    if (value === 0 && 1 / value === -Infinity) negativeZeroFree = false;
  }
  return { finite, negativeZeroFree };
}

export function boundCheck(
  actual: Float32Array,
  reference: Float64Array,
  bound: Float32Array | Float64Array,
): { maxDeviation: number; maxBoundRatio: number } {
  if (actual.length !== reference.length || actual.length !== bound.length) {
    throw new Error("bound check length mismatch");
  }
  let maxDeviation = 0;
  let maxBoundRatio = 0;
  for (let index = 0; index < actual.length; index += 1) {
    const deviation = Math.abs(actual[index] - reference[index]);
    if (deviation > maxDeviation) maxDeviation = deviation;
    const ratio = deviation / bound[index];
    if (ratio > maxBoundRatio) maxBoundRatio = ratio;
  }
  return { maxDeviation, maxBoundRatio };
}

// ---------- ml-gemm ----------

export const GEMM_A_OFF = 0;
export const GEMM_B_OFF = GEMM_BATCH * GEMM_M * GEMM_K * 4;
export const GEMM_C_OFF = GEMM_B_OFF + GEMM_BATCH * GEMM_K * GEMM_N * 4;
export const GEMM_C0_OFF = GEMM_C_OFF + GEMM_BATCH * GEMM_M * GEMM_N * 4;
export const GEMM_PAGES = 256;

export type GemmWasmExports = {
  memory: WebAssembly.Memory;
  gemm_f32: (a: number, b: number, c: number, m: number, n: number, k: number) => void;
};

export function gemmCrossingsPerRepetition(target: "javascript" | "wasm-linear"): number {
  return target === "wasm-linear" ? GEMM_BATCH : 0;
}

export function gemmWorkCounters(target: "javascript" | "wasm-linear") {
  const macs = GEMM_BATCH * GEMM_M * GEMM_N * GEMM_K;
  const outputElements = GEMM_BATCH * GEMM_M * GEMM_N;
  return {
    batch: GEMM_BATCH,
    "output-elements": outputElements,
    "multiply-accumulates": macs,
    loads: 2 * macs + outputElements,
    stores: outputElements,
    "tensor-bytes": 4 * (GEMM_BATCH * GEMM_M * GEMM_K + GEMM_BATCH * GEMM_K * GEMM_N +
      GEMM_BATCH * GEMM_M * GEMM_N),
    allocations: 0,
    "boundary-crossings": gemmCrossingsPerRepetition(target),
  };
}

export class GemmWasmRunner {
  exports: GemmWasmExports;
  a: Float32Array;
  b: Float32Array;
  c0: Float32Array;
  timings: PhaseTimings;

  private constructor(
    exports: GemmWasmExports,
    a: Float32Array,
    b: Float32Array,
    c0: Float32Array,
    timings: PhaseTimings,
  ) {
    this.exports = exports;
    this.a = a;
    this.b = b;
    this.c0 = c0;
    this.timings = timings;
  }

  static async prepare(
    wasmBytes: Uint8Array,
    a: Float32Array,
    b: Float32Array,
    c0: Float32Array,
    timings: PhaseTimings,
  ): Promise<GemmWasmRunner> {
    const start = performance.now();
    const { instance } = await WebAssembly.instantiate(wasmBytes as Uint8Array<ArrayBuffer>);
    const exports = instance.exports as unknown as GemmWasmExports;
    if (exports.memory.buffer.byteLength !== GEMM_PAGES * 65_536) {
      throw new Error("ml-gemm Wasm memory does not match the declared 256-page layout");
    }
    if (exports.memory.buffer.byteLength < GEMM_C0_OFF + c0.byteLength) {
      throw new Error("ml-gemm Wasm memory smaller than the declared layout");
    }
    const runner = countValue(new GemmWasmRunner(exports, a, b, c0, timings));
    timings.initialize += performance.now() - start;
    return runner;
  }

  transfer(): void {
    const start = performance.now();
    countValue(new Float32Array(this.exports.memory.buffer, GEMM_A_OFF, this.a.length)).set(this.a);
    countValue(new Float32Array(this.exports.memory.buffer, GEMM_B_OFF, this.b.length)).set(this.b);
    countValue(new Float32Array(this.exports.memory.buffer, GEMM_C0_OFF, this.c0.length)).set(
      this.c0,
    );
    this.timings.transfer += performance.now() - start;
  }

  // Explicit reset: restore C from the pristine C0 region. Required because
  // the workload accumulates onto initial C; every repetition starts from C0.
  reset(): void {
    const start = performance.now();
    countValue(new Uint8Array(this.exports.memory.buffer, GEMM_C_OFF, this.c0.byteLength)).set(
      countValue(new Uint8Array(this.exports.memory.buffer, GEMM_C0_OFF, this.c0.byteLength)),
    );
    this.timings.reset += performance.now() - start;
  }

  compute(): void {
    const start = performance.now();
    for (let t = 0; t < GEMM_BATCH; t += 1) {
      this.exports.gemm_f32(
        GEMM_A_OFF + t * GEMM_M * GEMM_K * 4,
        GEMM_B_OFF + t * GEMM_K * GEMM_N * 4,
        GEMM_C_OFF + t * GEMM_M * GEMM_N * 4,
        GEMM_M,
        GEMM_N,
        GEMM_K,
      );
    }
    this.timings.compute += performance.now() - start;
  }

  output(): Float32Array {
    return countValue(
      countValue(
        new Float32Array(this.exports.memory.buffer, GEMM_C_OFF, GEMM_BATCH * GEMM_M * GEMM_N),
      ).slice(),
    );
  }

  run(repetitions: number): void {
    assertRepetitions(repetitions);
    const start = performance.now();
    this.reset();
    for (let iteration = 0; iteration < repetitions; iteration += 1) {
      if (iteration > 0) this.reset();
      this.compute();
    }
    this.timings["end-to-end"] += performance.now() - start;
  }
}

// JavaScript GEMM runner with honest phase separation: prepare() times
// initialize (working-buffer allocation), transfer() times moving the input
// tensors into the runner's owned buffers, compute() times the payload, and
// run() brackets end-to-end. No work happens outside a timed phase.
export class GemmJsRunner {
  a: Float32Array;
  b: Float32Array;
  c0: Float32Array;
  c: Float32Array;
  timings: PhaseTimings;

  private constructor(
    a: Float32Array,
    b: Float32Array,
    c0: Float32Array,
    c: Float32Array,
    timings: PhaseTimings,
  ) {
    this.a = a;
    this.b = b;
    this.c0 = c0;
    this.c = c;
    this.timings = timings;
  }

  // initialize: allocate the owned working buffers AND construct the
  // runner inside the timed region (no untimed construction work).
  // Buffers route through the counting allocation factory.
  static prepare(timings: PhaseTimings): GemmJsRunner {
    const start = performance.now();
    const a = createF32(GEMM_BATCH * GEMM_M * GEMM_K);
    const b = createF32(GEMM_BATCH * GEMM_K * GEMM_N);
    const c0 = createF32(GEMM_BATCH * GEMM_M * GEMM_N);
    const c = createF32(GEMM_BATCH * GEMM_M * GEMM_N);
    const runner = countValue(new GemmJsRunner(a, b, c0, c, timings));
    timings.initialize += performance.now() - start;
    return runner;
  }

  // transfer: move the input tensors into the owned buffers (timed).
  transfer(a: Float32Array, b: Float32Array, c0: Float32Array): void {
    if (
      a.length !== this.a.length || b.length !== this.b.length || c0.length !== this.c0.length
    ) {
      throw new Error("ml-gemm transfer shape does not match the frozen layout");
    }
    const start = performance.now();
    this.a.set(a);
    this.b.set(b);
    this.c0.set(c0);
    this.timings.transfer += performance.now() - start;
  }

  reset(): void {
    const start = performance.now();
    this.c.set(this.c0);
    this.timings.reset += performance.now() - start;
  }

  compute(): void {
    const start = performance.now();
    gemmControlled(this.a, this.b, this.c, this.c);
    this.timings.compute += performance.now() - start;
  }

  output(): Float32Array {
    return this.c;
  }

  run(repetitions: number): void {
    assertRepetitions(repetitions);
    const start = performance.now();
    this.reset();
    for (let iteration = 0; iteration < repetitions; iteration += 1) {
      if (iteration > 0) this.reset();
      this.compute();
    }
    this.timings["end-to-end"] += performance.now() - start;
  }
}

// Pinned f64 scalar reference with hybrid per-element bounds:
// max(TOL_ABS, TOL_REL * |ref|, K * u * sum|a||b| + u * |ref| + ATOL0).
export function gemmReference(
  a: Float32Array,
  b: Float32Array,
  c0: Float32Array,
): { reference: Float64Array; bound: Float32Array } {
  const reference = new Float64Array(GEMM_BATCH * GEMM_M * GEMM_N);
  const bound = new Float32Array(reference.length);
  for (let t = 0; t < GEMM_BATCH; t += 1) {
    const aBase = t * GEMM_M * GEMM_K;
    const bBase = t * GEMM_K * GEMM_N;
    const cBase = t * GEMM_M * GEMM_N;
    for (let i = 0; i < GEMM_M; i += 1) {
      for (let j = 0; j < GEMM_N; j += 1) {
        let sum = c0[cBase + i * GEMM_N + j];
        let absSum = Math.abs(c0[cBase + i * GEMM_N + j]);
        for (let kk = 0; kk < GEMM_K; kk += 1) {
          const av = a[aBase + i * GEMM_K + kk];
          const bv = b[bBase + kk * GEMM_N + j];
          sum += av * bv;
          absSum += Math.abs(av) * Math.abs(bv);
        }
        const index = cBase + i * GEMM_N + j;
        reference[index] = sum;
        const analytic = GEMM_K * U_F32 * absSum + U_F32 * Math.abs(sum) + ATOL0;
        bound[index] = Math.max(TOL_ABS, TOL_REL * Math.abs(sum), analytic);
      }
    }
  }
  return { reference, bound };
}

// ---------- ml-dense-mlp ----------

export const MLP_X_OFF = 0;
export const MLP_W_OFF = MLP_X_OFF + MLP_BATCH * WIDTH * 4;
export const MLP_BIAS_OFF = MLP_W_OFF + LAYERS * WIDTH * WIDTH * 4;
export const MLP_SCRATCH_A_OFF = MLP_BIAS_OFF + LAYERS * WIDTH * 4;
export const MLP_SCRATCH_B_OFF = MLP_SCRATCH_A_OFF + MLP_BATCH * WIDTH * 4;
export const MLP_Y_OFF = MLP_SCRATCH_B_OFF + MLP_BATCH * WIDTH * 4;
export const MLP_PAGES = 160;

export type MlpWasmExports = {
  memory: WebAssembly.Memory;
  linear_f32: (x: number, w: number, bias: number, y: number, batch: number, width: number) => void;
  gelu_f32: (ptr: number, len: number) => void;
};

export function mlpCrossingsPerRepetition(target: "javascript" | "wasm-linear"): number {
  // One call per operator: 9 linear layers plus 8 unfused GELU activations.
  return target === "wasm-linear" ? LAYERS + HIDDEN_LAYERS : 0;
}

export function mlpWorkCounters(target: "javascript" | "wasm-linear") {
  const macs = MLP_BATCH * LAYERS * WIDTH * WIDTH;
  return {
    layers: LAYERS,
    "output-elements": MLP_BATCH * LAYERS * WIDTH,
    "multiply-accumulates": macs,
    "activation-evaluations": MLP_BATCH * HIDDEN_LAYERS * WIDTH,
    "tensor-bytes": 4 * (MLP_BATCH * WIDTH + LAYERS * WIDTH * WIDTH + LAYERS * WIDTH),
    "scratch-bytes": 2 * MLP_BATCH * WIDTH * 4,
    allocations: 0,
    "boundary-crossings": mlpCrossingsPerRepetition(target),
  };
}

export class MlpWasmRunner {
  exports: MlpWasmExports;
  timings: PhaseTimings;

  private constructor(exports: MlpWasmExports, timings: PhaseTimings) {
    this.exports = exports;
    this.timings = timings;
  }

  static async prepare(
    wasmBytes: Uint8Array,
    x: Float32Array,
    w: Float32Array,
    bias: Float32Array,
    timings: PhaseTimings,
  ): Promise<MlpWasmRunner> {
    const start = performance.now();
    const { instance } = await WebAssembly.instantiate(wasmBytes as Uint8Array<ArrayBuffer>);
    const exports = instance.exports as unknown as MlpWasmExports;
    if (exports.memory.buffer.byteLength !== MLP_PAGES * 65_536) {
      throw new Error("ml-dense-mlp Wasm memory does not match the declared 160-page layout");
    }
    if (exports.memory.buffer.byteLength < MLP_Y_OFF + x.byteLength) {
      throw new Error("ml-dense-mlp Wasm memory smaller than the declared layout");
    }
    const runner = countValue(new MlpWasmRunner(exports, timings));
    timings.initialize += performance.now() - start;
    runner.transferInputs(x, w, bias);
    return runner;
  }

  transferInputs(x: Float32Array, w: Float32Array, bias: Float32Array): void {
    const start = performance.now();
    countValue(new Float32Array(this.exports.memory.buffer, MLP_X_OFF, x.length)).set(x);
    countValue(new Float32Array(this.exports.memory.buffer, MLP_W_OFF, w.length)).set(w);
    countValue(new Float32Array(this.exports.memory.buffer, MLP_BIAS_OFF, bias.length)).set(bias);
    this.timings.transfer += performance.now() - start;
  }

  // Explicit reset: scratch and output regions are fully overwritten on every
  // forward pass, so reset is a documented no-op for this workload.
  reset(): void {
    this.timings.reset += 0;
  }

  compute(): void {
    const start = performance.now();
    let inOff = MLP_X_OFF;
    for (let layer = 0; layer < LAYERS; layer += 1) {
      const outOff = layer === LAYERS - 1
        ? MLP_Y_OFF
        : layer % 2 === 0
        ? MLP_SCRATCH_A_OFF
        : MLP_SCRATCH_B_OFF;
      this.exports.linear_f32(
        inOff,
        MLP_W_OFF + layer * WIDTH * WIDTH * 4,
        MLP_BIAS_OFF + layer * WIDTH * 4,
        outOff,
        MLP_BATCH,
        WIDTH,
      );
      if (layer < LAYERS - 1) this.exports.gelu_f32(outOff, MLP_BATCH * WIDTH);
      inOff = outOff;
    }
    this.timings.compute += performance.now() - start;
  }

  output(): Float32Array {
    return countValue(
      countValue(new Float32Array(this.exports.memory.buffer, MLP_Y_OFF, MLP_BATCH * WIDTH))
        .slice(),
    );
  }

  run(repetitions: number): void {
    assertRepetitions(repetitions);
    const start = performance.now();
    for (let iteration = 0; iteration < repetitions; iteration += 1) {
      this.reset();
      this.compute();
    }
    this.timings["end-to-end"] += performance.now() - start;
  }
}

// JavaScript MLP runner with the same honest phase separation: prepare()
// times initialize (tensor, scratch, and output buffer allocation),
// transfer() times moving the inputs in, compute() times the payload.
export class MlpJsRunner {
  x: Float32Array;
  w: Float32Array;
  bias: Float32Array;
  scratchA: Float32Array;
  scratchB: Float32Array;
  y: Float32Array;
  timings: PhaseTimings;

  private constructor(
    x: Float32Array,
    w: Float32Array,
    bias: Float32Array,
    scratchA: Float32Array,
    scratchB: Float32Array,
    y: Float32Array,
    timings: PhaseTimings,
  ) {
    this.x = x;
    this.w = w;
    this.bias = bias;
    this.scratchA = scratchA;
    this.scratchB = scratchB;
    this.y = y;
    this.timings = timings;
  }

  // initialize: allocate owned tensors, scratch, and output AND construct
  // the runner inside the timed region. Buffers route through the counting
  // allocation factory.
  static prepare(timings: PhaseTimings): MlpJsRunner {
    const start = performance.now();
    const x = createF32(MLP_BATCH * WIDTH);
    const w = createF32(LAYERS * WIDTH * WIDTH);
    const bias = createF32(LAYERS * WIDTH);
    const scratchA = createF32(MLP_BATCH * WIDTH);
    const scratchB = createF32(MLP_BATCH * WIDTH);
    const y = createF32(MLP_BATCH * WIDTH);
    const runner = countValue(new MlpJsRunner(x, w, bias, scratchA, scratchB, y, timings));
    timings.initialize += performance.now() - start;
    return runner;
  }

  // transfer: move the input tensors into the owned buffers (timed).
  transfer(x: Float32Array, w: Float32Array, bias: Float32Array): void {
    if (
      x.length !== this.x.length || w.length !== this.w.length || bias.length !== this.bias.length
    ) {
      throw new Error("ml-dense-mlp transfer shape does not match the frozen layout");
    }
    const start = performance.now();
    this.x.set(x);
    this.w.set(w);
    this.bias.set(bias);
    this.timings.transfer += performance.now() - start;
  }

  reset(): void {
    this.timings.reset += 0;
  }

  compute(): void {
    const start = performance.now();
    mlpControlled(this.x, this.w, this.bias, this.scratchA, this.scratchB, this.y);
    this.timings.compute += performance.now() - start;
  }

  output(): Float32Array {
    return this.y;
  }

  run(repetitions: number): void {
    assertRepetitions(repetitions);
    const start = performance.now();
    for (let iteration = 0; iteration < repetitions; iteration += 1) {
      this.reset();
      this.compute();
    }
    this.timings["end-to-end"] += performance.now() - start;
  }
}

// Lipschitz constant of the exact tanh-form GELU: max |gelu'(p)| =
// 1.1292..., rounded up. Used to propagate pre-activation error through
// the activation in the stored analytic bounds.
const GELU_LIPSCHITZ = 1.13;
// The frozen tanh saturates at |x| = 9.011 with a discontinuity of at most
// 2.98e-8 in tanh space, i.e. at most ~7.7e-8 after the 0.5*p*(1+t) GELU
// scaling; 8e-8 rounds that up. A discontinuous function has no Lipschitz
// constant, so the snap margin is carried explicitly.
const GELU_SNAP_MARGIN = 8e-8;

// Pinned f64 layer-by-layer reference with stored per-layer hybrid bounds.
// The reference activation uses platform Math.tanh on purpose: both
// controlled targets implement the shared frozen polynomial tanh, so the
// oracle stays independent of the controlled implementations. Per-layer
// pre-activations are returned alongside the post-layer references so
// structural GELU invariants can be checked against the ideal formula.
//
// Stored bounds are a measured-deviation propagated error recursion, sound
// by induction and verified elementwise against both targets before being
// persisted. Pure worst-case interval propagation (sum |W_ij| e_i over
// worst-case e_i) is sound but vacuous at this depth (the |W| row sums of
// ~16 amplify uniform error envelopes ~18x per layer), so the propagation
// term uses the ACTUAL measured per-element input deviations of the
// controlled computation (identical in both targets, verified bit-equal),
// which the triangle inequality bounds exactly:
//   d_in[i]    = |target_layer_input[i] - reference_input[i]|   (measured)
//   propagated = sum_i |W_ij| * d_in[i]                          (exact)
//   rounding   = WIDTH*u*(sum_i |W_ij||x_i| + |bias_j|) + u*|p_j| + 2^-30
//                (proven RN envelope: <= u/2 per multiply and per add,
//                 partial sums bounded by absSum, 2x headroom)
//   e_pre      = propagated + rounding
//   e_out      = L*e_pre + |frozen_gelu(p_j) - ideal_gelu(p_j)|
//                + GELU_SNAP_MARGIN + u*|a_j| + 2^-30   (hidden layers)
//   e_out      = e_pre                                   (final layer)
// The frozen-vs-ideal gap is computed exactly per element at the reference
// point. The build verifies |target - reference| <= stored bound for every
// element of every layer in both targets, so the stored arrays are a
// certified error certificate for the fixture, not a fitted tolerance.
export function mlpReference(
  x: Float32Array,
  w: Float32Array,
  bias: Float32Array,
  targetLayers: Float32Array[],
): { references: Float64Array[]; pres: Float64Array[]; bounds: Float32Array[] } {
  if (targetLayers.length !== LAYERS) {
    throw new Error("mlpReference requires the controlled per-layer outputs");
  }
  const references: Float64Array[] = [];
  const pres: Float64Array[] = [];
  const bounds: Float32Array[] = [];
  let refIn = new Float64Array(MLP_BATCH * WIDTH);
  let devIn = new Float64Array(MLP_BATCH * WIDTH);
  for (let index = 0; index < x.length; index += 1) refIn[index] = x[index];
  for (let layer = 0; layer < LAYERS; layer += 1) {
    const refOut = new Float64Array(MLP_BATCH * WIDTH);
    const preOut = new Float64Array(MLP_BATCH * WIDTH);
    const boundOut = new Float32Array(MLP_BATCH * WIDTH);
    const wBase = layer * WIDTH * WIDTH;
    const bBase = layer * WIDTH;
    for (let bi = 0; bi < MLP_BATCH; bi += 1) {
      for (let o = 0; o < WIDTH; o += 1) {
        let sum = bias[bBase + o];
        let absSum = Math.abs(bias[bBase + o]);
        let propagated = 0;
        for (let i = 0; i < WIDTH; i += 1) {
          const xv = refIn[bi * WIDTH + i];
          const wv = w[wBase + i * WIDTH + o];
          sum += xv * wv;
          absSum += Math.abs(xv) * Math.abs(wv);
          propagated += Math.abs(wv) * devIn[bi * WIDTH + i];
        }
        const index = bi * WIDTH + o;
        const ePre = propagated + WIDTH * U_F32 * absSum + U_F32 * Math.abs(sum) + ATOL0;
        let value = sum;
        let analytic = ePre;
        if (layer < LAYERS - 1) {
          // Ideal f64 reference activation (independent of the targets).
          const inner = 0.7978845608028654 * (sum + 0.044715 * sum * sum * sum);
          value = 0.5 * sum * (1 + Math.tanh(inner));
          const gap = Math.abs(geluFrozenF64(sum) - value);
          analytic = GELU_LIPSCHITZ * ePre + gap + GELU_SNAP_MARGIN +
            U_F32 * Math.abs(value) + ATOL0;
        }
        preOut[index] = sum;
        refOut[index] = value;
        boundOut[index] = Math.max(TOL_ABS, TOL_REL * Math.abs(value), analytic);
      }
    }
    references.push(refOut);
    pres.push(preOut);
    bounds.push(boundOut);
    // Measured per-element input deviation for the next layer, capped by
    // the stored bound (the inductive certificate).
    const target = targetLayers[layer];
    const nextDev = new Float64Array(MLP_BATCH * WIDTH);
    for (let index = 0; index < refOut.length; index += 1) {
      nextDev[index] = Math.min(Math.abs(target[index] - refOut[index]), boundOut[index]);
    }
    refIn = refOut;
    devIn = nextDev;
  }
  return { references, pres, bounds };
}

// Runs the Wasm per-operator trajectory and returns every layer output
// (post-activation for hidden layers), so validation covers all layers,
// not only the final one.
export function mlpWasmLayerOutputs(exports: MlpWasmExports): Float32Array[] {
  const outputs: Float32Array[] = [];
  let inOff = MLP_X_OFF;
  for (let layer = 0; layer < LAYERS; layer += 1) {
    const outOff = layer === LAYERS - 1
      ? MLP_Y_OFF
      : layer % 2 === 0
      ? MLP_SCRATCH_A_OFF
      : MLP_SCRATCH_B_OFF;
    exports.linear_f32(
      inOff,
      MLP_W_OFF + layer * WIDTH * WIDTH * 4,
      MLP_BIAS_OFF + layer * WIDTH * 4,
      outOff,
      MLP_BATCH,
      WIDTH,
    );
    if (layer < LAYERS - 1) exports.gelu_f32(outOff, MLP_BATCH * WIDTH);
    outputs.push(
      new Float32Array(exports.memory.buffer, outOff, MLP_BATCH * WIDTH).slice(),
    );
    inOff = outOff;
  }
  return outputs;
}

// Runs the JS per-operator trajectory and returns every layer output
// (post-activation for hidden layers), mirroring mlpWasmLayerOutputs.
export function mlpJsLayerOutputs(
  x: Float32Array,
  w: Float32Array,
  bias: Float32Array,
): Float32Array[] {
  const outputs: Float32Array[] = [];
  const scratchA = new Float32Array(MLP_BATCH * WIDTH);
  const scratchB = new Float32Array(MLP_BATCH * WIDTH);
  let input = x;
  for (let layer = 0; layer < LAYERS; layer += 1) {
    const out = layer === LAYERS - 1
      ? new Float32Array(MLP_BATCH * WIDTH)
      : layer % 2 === 0
      ? scratchA
      : scratchB;
    linearLayerF32(
      input,
      w.subarray(layer * WIDTH * WIDTH, (layer + 1) * WIDTH * WIDTH),
      bias.subarray(layer * WIDTH, (layer + 1) * WIDTH),
      out,
      MLP_BATCH,
      WIDTH,
    );
    if (layer < LAYERS - 1) geluInPlace(out);
    outputs.push(out.slice());
    input = out;
  }
  return outputs;
}

// Times an arbitrary operation into a named phase. Used for the load and
// validation phases, which live outside the runner compute path by contract.
export async function timedPhase<T>(
  timings: PhaseTimings,
  phase: keyof PhaseTimings,
  fn: () => T | Promise<T>,
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  timings[phase] += performance.now() - start;
  return result;
}

export function emptyPhaseTimings(): PhaseTimings {
  return {
    load: 0,
    initialize: 0,
    transfer: 0,
    compute: 0,
    validation: 0,
    reset: 0,
    "end-to-end": 0,
  };
}

// ---------- Catalog structural oracle checks ----------
// Every check the v2 catalog declares under "structural-invariants" is
// implemented here and executed in artifacts mode before the output
// manifest is written; records mode re-verifies the recorded results.

export type StructuralCheckResult = {
  id: string;
  passed: boolean;
  detail: string;
};

// ml.gemm.v1: "Tensor shape, finite-value, row checksum, and corner-element
// invariants hold." Row checksum tolerance is the row-wise sum of the stored
// per-element bounds (triangle inequality over the complete-output bound).
export function gemmStructuralChecks(
  out: Float32Array,
  reference: Float64Array,
  bound: Float32Array,
): StructuralCheckResult[] {
  const results: StructuralCheckResult[] = [];
  const shapePass = out.length === GEMM_BATCH * GEMM_M * GEMM_N &&
    reference.length === out.length && bound.length === out.length;
  results.push({
    id: "shape",
    passed: shapePass,
    detail: `output ${out.length} elements, expected ${GEMM_BATCH * GEMM_M * GEMM_N}`,
  });
  const health = checkFiniteAndZero(out);
  results.push({
    id: "finite-values",
    passed: health.finite,
    detail: health.finite ? "all output elements finite" : "non-finite output element",
  });

  let checksumPass = true;
  let worstChecksumRatio = 0;
  for (let t = 0; t < GEMM_BATCH && checksumPass; t += 1) {
    for (let i = 0; i < GEMM_M; i += 1) {
      const rowBase = t * GEMM_M * GEMM_N + i * GEMM_N;
      let sumTarget = 0;
      let sumReference = 0;
      let sumBound = 0;
      for (let j = 0; j < GEMM_N; j += 1) {
        sumTarget += out[rowBase + j];
        sumReference += reference[rowBase + j];
        sumBound += bound[rowBase + j];
      }
      const diff = Math.abs(sumTarget - sumReference);
      const ratio = sumBound > 0 ? diff / sumBound : diff === 0 ? 0 : Infinity;
      if (ratio > worstChecksumRatio) worstChecksumRatio = ratio;
      if (!(ratio < 1)) {
        checksumPass = false;
        break;
      }
    }
  }
  results.push({
    id: "row-checksums",
    passed: checksumPass,
    detail: `worst |checksum deviation| / row bound sum ratio ${worstChecksumRatio}`,
  });

  let cornersPass = true;
  let worstCornerRatio = 0;
  const cornerOffsets = [0, GEMM_N - 1, (GEMM_M - 1) * GEMM_N, GEMM_M * GEMM_N - 1];
  for (let t = 0; t < GEMM_BATCH; t += 1) {
    for (const offset of cornerOffsets) {
      const index = t * GEMM_M * GEMM_N + offset;
      const b = bound[index];
      const ratio = b > 0 ? Math.abs(out[index] - reference[index]) / b : Infinity;
      if (ratio > worstCornerRatio) worstCornerRatio = ratio;
      if (!(ratio < 1)) cornersPass = false;
    }
  }
  results.push({
    id: "corner-elements",
    passed: cornersPass,
    detail: `worst corner bound ratio ${worstCornerRatio}`,
  });
  return results;
}

// ml.dense-mlp.v1: "Final logits, ranking, tensor shapes, finite values,
// and GELU formula invariants hold." Ranking: the target's descending order
// of the final logits must have no provable inversion against the f64
// reference (adjacent reference gap within the summed stored bounds). GELU
// invariants are checked on every hidden-layer element against the ideal
// reference pre-activation: activation above the global minimum margin,
// non-negative pre-activation implies non-negative activation, deep
// saturation for p <= -5, and identity behaviour for p >= 5.
export function mlpStructuralChecks(
  layers: Float32Array[],
  references: Float64Array[],
  pres: Float64Array[],
  bounds: Float32Array[],
): StructuralCheckResult[] {
  const results: StructuralCheckResult[] = [];
  const layerSize = MLP_BATCH * WIDTH;
  const shapePass = layers.length === LAYERS &&
    layers.every((layer) => layer.length === layerSize) &&
    references.every((layer) => layer.length === layerSize) &&
    pres.every((layer) => layer.length === layerSize) &&
    bounds.every((layer) => layer.length === layerSize);
  results.push({
    id: "tensor-shapes",
    passed: shapePass,
    detail: `${layers.length} layers of ${layerSize} elements`,
  });
  const finitePass = layers.every((layer) => checkFiniteAndZero(layer).finite);
  results.push({
    id: "finite-values",
    passed: finitePass,
    detail: finitePass ? "all layer outputs finite" : "non-finite layer output element",
  });

  const final = layers[LAYERS - 1];
  const finalRef = references[LAYERS - 1];
  const finalBound = bounds[LAYERS - 1];
  let logitsPass = true;
  let worstLogitRatio = 0;
  for (let index = 0; index < layerSize; index += 1) {
    const b = finalBound[index];
    const ratio = b > 0 ? Math.abs(final[index] - finalRef[index]) / b : Infinity;
    if (ratio > worstLogitRatio) worstLogitRatio = ratio;
    if (!(ratio < 1)) logitsPass = false;
  }
  results.push({
    id: "final-logits",
    passed: logitsPass,
    detail: `worst final-logit bound ratio ${worstLogitRatio}`,
  });

  let rankingPass = true;
  let inversionsChecked = 0;
  const order = new Uint32Array(WIDTH);
  for (let bi = 0; bi < MLP_BATCH && rankingPass; bi += 1) {
    const rowBase = bi * WIDTH;
    for (let o = 0; o < WIDTH; o += 1) order[o] = o;
    const sorted = Array.from(order).sort((a, b) =>
      final[rowBase + b] - final[rowBase + a] || a - b
    );
    for (let rank = 0; rank + 1 < WIDTH; rank += 1) {
      const upper = rowBase + sorted[rank];
      const lower = rowBase + sorted[rank + 1];
      inversionsChecked += 1;
      if (finalRef[upper] + finalBound[upper] < finalRef[lower] - finalBound[lower]) {
        rankingPass = false;
        break;
      }
    }
  }
  results.push({
    id: "ranking",
    passed: rankingPass,
    detail: `${inversionsChecked} adjacent ranking pairs checked, no provable inversion`,
  });

  let geluPass = true;
  let geluElements = 0;
  for (let layer = 0; layer < LAYERS - 1 && geluPass; layer += 1) {
    for (let index = 0; index < layerSize; index += 1) {
      const p = pres[layer][index];
      const a = layers[layer][index];
      geluElements += 1;
      if (!(a >= -0.18)) geluPass = false;
      else if (p >= 0 && !(a >= 0)) geluPass = false;
      else if (p <= -5 && !(Math.abs(a) <= 1e-4)) geluPass = false;
      else if (p >= 5 && !(Math.abs(a - p) <= 1e-2)) geluPass = false;
      if (!geluPass) break;
    }
  }
  results.push({
    id: "gelu-invariants",
    passed: geluPass,
    detail: `${geluElements} hidden activations checked against ideal pre-activations`,
  });
  return results;
}

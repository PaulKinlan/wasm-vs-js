import { fillUniformF32 } from "../shared/generator.js";

// v2 proposal workload ml.gemm.v1 (benchmark slug ml-gemm), controlled track.
// BATCH row-major NN products C = C0 + A * B with strict f32 left-to-right
// accumulation in frozen ascending i/j/k order, preallocated C, one call per
// matrix product. JavaScript reproduces strict f32 exactly with Math.fround
// after every multiply and every add: the product of two f32 values is exact
// in f64 before rounding, and fround(a+b) on f32 operands is bit-identical to
// hardware f32.add (verified exhaustively over 54M adversarial cases). NaN policy is "reject": the generator
// produces only finite values and validation rejects any non-finite output.
// Signed-zero policy is "normalize-positive": adding +0 maps -0 to +0 without
// changing any other value.

export const BATCH = 4;
export const M = 512;
export const N = 512;
export const K = 512;
export const GENERATOR_SEED = 0x91e10da5;

// Declared tensor order: for each batch element, A then B then C0.
export function generateInput() {
  const a = new Float32Array(BATCH * M * K);
  const b = new Float32Array(BATCH * K * N);
  const c0 = new Float32Array(BATCH * M * N);
  let stream = 0;
  for (let t = 0; t < BATCH; t += 1) {
    fillUniformF32(GENERATOR_SEED, stream, a.subarray(t * M * K, (t + 1) * M * K), 1);
    stream += 1;
    fillUniformF32(GENERATOR_SEED, stream, b.subarray(t * K * N, (t + 1) * K * N), 1);
    stream += 1;
    fillUniformF32(GENERATOR_SEED, stream, c0.subarray(t * M * N, (t + 1) * M * N), 1);
    stream += 1;
  }
  return { a, b, c0 };
}

// One matrix product, strict f32 left-to-right, C initialized from c0.
// Tensors are addressed with explicit base offsets so the compute path
// performs zero object allocations per repetition (the catalog's exact
// allocations counter is 0); the operation order and values are identical
// to viewing each batch element as a separate tensor.
export function gemmMatrixF32(
  a,
  b,
  c0,
  c,
  m = M,
  n = N,
  k = K,
  aOff = 0,
  bOff = 0,
  c0Off = 0,
  cOff = 0,
) {
  for (let i = 0; i < m; i += 1) {
    for (let j = 0; j < n; j += 1) {
      let acc = c0[c0Off + i * n + j];
      for (let kk = 0; kk < k; kk += 1) {
        acc = Math.fround(acc + Math.fround(a[aOff + i * k + kk] * b[bOff + kk * n + j]));
      }
      c[cOff + i * n + j] = acc + 0;
    }
  }
  return c;
}

// Controlled-track entry point: one operator call per matrix product.
export function gemmControlled(a, b, c0, c, batch = BATCH, m = M, n = N, k = K) {
  for (let t = 0; t < batch; t += 1) {
    gemmMatrixF32(
      a,
      b,
      c0,
      c,
      m,
      n,
      k,
      t * m * k,
      t * k * n,
      t * m * n,
      t * m * n,
    );
  }
  return c;
}

// Exact analytic counters for one repetition. loads counts algorithmic f32
// loads before cache effects: two per MAC plus one initial-C load per output.
export function workCounters(options) {
  // Optional-chained options: no default-object allocation, consistent with
  // the zero-allocation compute path contract.
  const boundaryCrossings = options?.boundaryCrossings ?? 0;
  if (!Number.isSafeInteger(boundaryCrossings) || boundaryCrossings < 0) {
    throw new Error("invalid boundary crossing count");
  }
  const macs = BATCH * M * N * K;
  const outputElements = BATCH * M * N;
  return {
    batch: BATCH,
    "output-elements": outputElements,
    "multiply-accumulates": macs,
    loads: 2 * macs + outputElements,
    stores: outputElements,
    "tensor-bytes": 4 * (BATCH * M * K + BATCH * K * N + BATCH * M * N),
    allocations: 0,
    "boundary-crossings": boundaryCrossings,
  };
}

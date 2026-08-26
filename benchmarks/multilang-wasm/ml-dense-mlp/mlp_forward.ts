// mlp_forward.ts — AssemblyScript multilang kernel for ml.dense-mlp.v1.
//
// Mirrors mlp_forward.c, which mirrors benchmarks/v2/ml-dense-mlp/workload.js
// mlpControlled exactly: strict f32 linear layers, the frozen f64 GELU-tanh
// activation with the identical IEEE-754 double operation order (frozenExp /
// frozenTanh / geluFrozenF64, including the exponent-bit pow2 scaling),
// ping-pong scratch, a final projection with no activation, and -0
// normalisation through "+0".
//
// The transcendentals are frozen deliberately: calling the platform's exp or
// tanh would make this a different function from every other engine, which is
// the defect the audio-fft AssemblyScript kernel had. Everything here is the
// same polynomial and the same bit-level pow2 construction as the C.

const LN2: f64 = 0.6931471805599453;

// Taylor coefficients for exp, index 0..12, applied by Horner from the top.
// Kept as literals rather than an array: a top-level f64[] would be
// heap-allocated, and AssemblyScript's heap sits in the same low memory the
// adapter and the test fill with the fixture.
const C0: f64 = 1.0;
const C1: f64 = 1.0;
const C2: f64 = 0.5;
const C3: f64 = 0.16666666666666666;
const C4: f64 = 0.041666666666666664;
const C5: f64 = 0.008333333333333333;
const C6: f64 = 0.001388888888888889;
const C7: f64 = 0.0001984126984126984;
const C8: f64 = 0.0000248015873015873;
const C9: f64 = 0.0000027557319223985893;
const C10: f64 = 0.0000002755731922398589;
const C11: f64 = 0.000000025052108385441718;
const C12: f64 = 0.00000000208767569878681;

/**
 * 2^k built straight from the exponent field, matching the JS table that
 * writes (k + 1023) << 20 into the high word. k = 1024 yields +Infinity.
 */
function pow2Exact(k: i32): f64 {
  const bits: u64 = (<u64> (k + 1023)) << 52;
  return reinterpret<f64>(bits);
}

function frozenExp(x: f64): f64 {
  if (x != x) return x; // NaN
  if (x > 709.7827) return Infinity;
  if (x < -708.39) return 0.0;
  const k: f64 = Math.floor(x / LN2 + 0.5);
  const r: f64 = x - k * LN2;
  // Horner from coefficient 12 down to 0 — the same order the C loop uses.
  let p: f64 = C12;
  p = p * r + C11;
  p = p * r + C10;
  p = p * r + C9;
  p = p * r + C8;
  p = p * r + C7;
  p = p * r + C6;
  p = p * r + C5;
  p = p * r + C4;
  p = p * r + C3;
  p = p * r + C2;
  p = p * r + C1;
  p = p * r + C0;
  return p * pow2Exact(<i32> k);
}

function frozenTanh(x: f64): f64 {
  if (x != x) return x; // NaN
  if (x >= 9.011) return 1.0;
  if (x <= -9.011) return -1.0;
  return 1.0 - 2.0 / (frozenExp(2.0 * x) + 1.0);
}

function geluFrozenF64(p: f64): f64 {
  const inner: f64 = 0.7978845608028654 * (p + 0.044715 * ((p * p) * p));
  return 0.5 * p * (1.0 + frozenTanh(inner));
}

function linearLayerF32(
  x: usize,
  w: usize,
  bias: usize,
  y: usize,
  batch: u32,
  width: u32,
  wOff: u32,
  biasOff: u32,
): void {
  for (let bi: u32 = 0; bi < batch; bi++) {
    for (let o: u32 = 0; o < width; o++) {
      let acc: f32 = load<f32>(bias + (<usize> (biasOff + o)) * 4);
      for (let i: u32 = 0; i < width; i++) {
        acc += load<f32>(x + (<usize> (bi * width + i)) * 4) *
          load<f32>(w + (<usize> (wOff + i * width + o)) * 4);
      }
      // "+ 0" normalises -0 to +0, matching the JS oracle.
      store<f32>(y + (<usize> (bi * width + o)) * 4, acc + <f32> 0.0);
    }
  }
}

function geluInPlace(buffer: usize, len: u32): void {
  for (let index: u32 = 0; index < len; index++) {
    const at: usize = buffer + (<usize> index) * 4;
    store<f32>(at, <f32> geluFrozenF64(<f64> load<f32>(at)) + <f32> 0.0);
  }
}

export function mlp_forward(
  x: usize,
  w: usize,
  bias: usize,
  scratchA: usize,
  scratchB: usize,
  y: usize,
  batch: u32,
  width: u32,
  hiddenLayers: u32,
): void {
  const layers: u32 = hiddenLayers + 1;
  let input: usize = x;
  for (let layer: u32 = 0; layer < layers; layer++) {
    const out: usize = layer == layers - 1 ? y : (layer % 2 == 0 ? scratchA : scratchB);
    linearLayerF32(input, w, bias, out, batch, width, layer * width * width, layer * width);
    if (layer < layers - 1) {
      geluInPlace(out, batch * width);
    }
    input = out;
  }
}

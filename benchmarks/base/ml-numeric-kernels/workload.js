// Supplemental controlled implementation for frozen-v1 ml.numeric-kernels.v1.
// Scalar row-major/NHWC baseline. Every f32 multiply, add, comparison and
// normalization is rounded with Math.fround in the same order as the C/Wasm
// target. NaN/Infinity inputs are rejected; output signed zero is normalized
// to +0. INT8 multiplication accumulates exactly in signed i32 with the
// registered shapes chosen to stay far below overflow.
export const CONTRACT_ID = "ml.numeric-kernels.v1-controlled-scalar.v1";
export const SEED = 0x6d6c6b31;
export const GEMM = Object.freeze({ m: 8, n: 7, k: 9 });
export const CONV = Object.freeze({
  batch: 1,
  height: 8,
  width: 8,
  inChannels: 3,
  outChannels: 4,
  kernel: 3,
  stride: 1,
  padding: 1,
});
export const SOFTMAX = Object.freeze({ rows: 8, cols: 16 });
export const SOFTMAX_I8_LUT = Object.freeze([256, 94, 35, 13, 5, 2, 1, 0, 0]);

function xorshift32(state) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

function stream(length, kind, salt) {
  const out = kind === "f32" ? new Float32Array(length) : new Int8Array(length);
  let state = (SEED ^ salt) >>> 0;
  for (let i = 0; i < length; i += 1) {
    state = xorshift32(state);
    out[i] = kind === "f32" ? Math.fround(((state >>> 8) / 0x1000000) * 2 - 1) : ((state % 15) - 7);
  }
  return out;
}

export function generateFixtures() {
  return {
    gemmF32A: stream(GEMM.m * GEMM.k, "f32", 1),
    gemmF32B: stream(GEMM.k * GEMM.n, "f32", 2),
    gemmI8A: stream(GEMM.m * GEMM.k, "i8", 3),
    gemmI8B: stream(GEMM.k * GEMM.n, "i8", 4),
    convF32Input: stream(CONV.batch * CONV.height * CONV.width * CONV.inChannels, "f32", 5),
    convF32Weights: stream(
      CONV.kernel * CONV.kernel * CONV.inChannels * CONV.outChannels,
      "f32",
      6,
    ),
    convI8Input: stream(CONV.batch * CONV.height * CONV.width * CONV.inChannels, "i8", 7),
    convI8Weights: stream(CONV.kernel * CONV.kernel * CONV.inChannels * CONV.outChannels, "i8", 8),
    softmaxF32Input: stream(SOFTMAX.rows * SOFTMAX.cols, "f32", 9),
    softmaxI8Input: stream(SOFTMAX.rows * SOFTMAX.cols, "i8", 10),
  };
}

function requireFinite(values, name) {
  for (let i = 0; i < values.length; i += 1) {
    if (!Number.isFinite(values[i])) throw new Error(`${name} contains non-finite value at ${i}`);
  }
}

export function gemmF32(a, b, out = new Float32Array(GEMM.m * GEMM.n)) {
  requireFinite(a, "gemm f32 A");
  requireFinite(b, "gemm f32 B");
  for (let i = 0; i < GEMM.m; i += 1) {
    for (let j = 0; j < GEMM.n; j += 1) {
      let acc = Math.fround(0);
      for (let k = 0; k < GEMM.k; k += 1) {
        acc = Math.fround(acc + Math.fround(a[i * GEMM.k + k] * b[k * GEMM.n + j]));
      }
      out[i * GEMM.n + j] = acc + 0;
    }
  }
  return out;
}

export function gemmI8(a, b, out = new Int32Array(GEMM.m * GEMM.n)) {
  for (let i = 0; i < GEMM.m; i += 1) {
    for (let j = 0; j < GEMM.n; j += 1) {
      let acc = 0;
      for (let k = 0; k < GEMM.k; k += 1) acc += a[i * GEMM.k + k] * b[k * GEMM.n + j];
      out[i * GEMM.n + j] = acc;
    }
  }
  return out;
}

function convIndex(y, x, c) {
  return (y * CONV.width + x) * CONV.inChannels + c;
}
function weightIndex(ky, kx, c, o) {
  return ((ky * CONV.kernel + kx) * CONV.inChannels + c) * CONV.outChannels + o;
}

export function convF32(
  input,
  weights,
  out = new Float32Array(CONV.height * CONV.width * CONV.outChannels),
) {
  requireFinite(input, "conv f32 input");
  requireFinite(weights, "conv f32 weights");
  for (let y = 0; y < CONV.height; y += 1) {
    for (let x = 0; x < CONV.width; x += 1) {
      for (let o = 0; o < CONV.outChannels; o += 1) {
        let acc = Math.fround(0);
        for (let ky = 0; ky < CONV.kernel; ky += 1) {
          for (let kx = 0; kx < CONV.kernel; kx += 1) {
            const iy = y + ky - CONV.padding, ix = x + kx - CONV.padding;
            if (iy < 0 || ix < 0 || iy >= CONV.height || ix >= CONV.width) continue;
            for (let c = 0; c < CONV.inChannels; c += 1) {
              acc = Math.fround(
                acc + Math.fround(input[convIndex(iy, ix, c)] * weights[weightIndex(ky, kx, c, o)]),
              );
            }
          }
        }
        out[(y * CONV.width + x) * CONV.outChannels + o] = acc + 0;
      }
    }
  }
  return out;
}

export function convI8(
  input,
  weights,
  out = new Int32Array(CONV.height * CONV.width * CONV.outChannels),
) {
  for (let y = 0; y < CONV.height; y += 1) {
    for (let x = 0; x < CONV.width; x += 1) {
      for (let o = 0; o < CONV.outChannels; o += 1) {
        let acc = 0;
        for (let ky = 0; ky < CONV.kernel; ky += 1) {
          for (let kx = 0; kx < CONV.kernel; kx += 1) {
            const iy = y + ky - CONV.padding, ix = x + kx - CONV.padding;
            if (iy < 0 || ix < 0 || iy >= CONV.height || ix >= CONV.width) continue;
            for (let c = 0; c < CONV.inChannels; c += 1) {
              acc += input[convIndex(iy, ix, c)] * weights[weightIndex(ky, kx, c, o)];
            }
          }
        }
        out[(y * CONV.width + x) * CONV.outChannels + o] = acc;
      }
    }
  }
  return out;
}

// Fixed scalar exp approximation: max-subtracted x is clamped to [-8, 0],
// then (1 + x/256)^256 via eight f32 squarings. Both targets use this exact
// topology. It is a frozen approximation variant, not the host Math.exp.
export function expApproxF32(value) {
  const x = Math.fround(Math.max(-8, Math.min(0, value)));
  let y = Math.fround(1 + Math.fround(x / 256));
  for (let i = 0; i < 8; i += 1) y = Math.fround(y * y);
  return y;
}

export function softmaxF32(input, out = new Float32Array(input.length)) {
  requireFinite(input, "softmax f32 input");
  for (let r = 0; r < SOFTMAX.rows; r += 1) {
    const base = r * SOFTMAX.cols;
    let max = input[base];
    for (let c = 1; c < SOFTMAX.cols; c += 1) if (input[base + c] > max) max = input[base + c];
    let sum = Math.fround(0);
    for (let c = 0; c < SOFTMAX.cols; c += 1) {
      const e = expApproxF32(Math.fround(input[base + c] - max));
      out[base + c] = e;
      sum = Math.fround(sum + e);
    }
    for (let c = 0; c < SOFTMAX.cols; c += 1) out[base + c] = Math.fround(out[base + c] / sum) + 0;
  }
  return out;
}

export function softmaxI8(input, out = new Uint8Array(input.length)) {
  for (let r = 0; r < SOFTMAX.rows; r += 1) {
    const base = r * SOFTMAX.cols;
    let max = input[base], maxIndex = 0;
    for (let c = 1; c < SOFTMAX.cols; c += 1) {
      if (input[base + c] > max) {
        max = input[base + c];
        maxIndex = c;
      }
    }
    let sum = 0;
    for (let c = 0; c < SOFTMAX.cols; c += 1) {
      sum += SOFTMAX_I8_LUT[Math.min(8, max - input[base + c])];
    }
    let quantized = 0;
    for (let c = 0; c < SOFTMAX.cols; c += 1) {
      const q = Math.floor(
        (SOFTMAX_I8_LUT[Math.min(8, max - input[base + c])] * 255 + Math.floor(sum / 2)) / sum,
      );
      out[base + c] = q;
      quantized += q;
    }
    out[base + maxIndex] += 255 - quantized;
  }
  return out;
}

export function runAll(fixtures = generateFixtures()) {
  return {
    gemmF32: gemmF32(fixtures.gemmF32A, fixtures.gemmF32B),
    gemmI8: gemmI8(fixtures.gemmI8A, fixtures.gemmI8B),
    convF32: convF32(fixtures.convF32Input, fixtures.convF32Weights),
    convI8: convI8(fixtures.convI8Input, fixtures.convI8Weights),
    softmaxF32: softmaxF32(fixtures.softmaxF32Input),
    softmaxI8: softmaxI8(fixtures.softmaxI8Input),
  };
}

export function workCounters(target = "javascript") {
  const gemmMacs = GEMM.m * GEMM.n * GEMM.k;
  let convMacs = 0;
  for (let y = 0; y < CONV.height; y += 1) {
    for (let x = 0; x < CONV.width; x += 1) {
      for (let ky = 0; ky < CONV.kernel; ky += 1) {
        for (let kx = 0; kx < CONV.kernel; kx += 1) {
          if (
            y + ky - CONV.padding >= 0 && x + kx - CONV.padding >= 0 &&
            y + ky - CONV.padding < CONV.height && x + kx - CONV.padding < CONV.width
          ) convMacs += CONV.inChannels * CONV.outChannels;
        }
      }
    }
  }
  const softmaxElements = SOFTMAX.rows * SOFTMAX.cols;
  return {
    "gemm-macs-per-dtype": gemmMacs,
    "conv-macs-per-dtype": convMacs,
    "total-macs": 2 * (gemmMacs + convMacs),
    "tensor-reads": 4 * (gemmMacs + convMacs) + 4 * softmaxElements,
    "tensor-writes": 2 *
      (GEMM.m * GEMM.n + CONV.height * CONV.width * CONV.outChannels + softmaxElements),
    "exp-approximations": softmaxElements,
    "normalizations": 2 * softmaxElements,
    allocations: 6,
    "boundary-crossings": target === "wasm-linear" ? 6 : 0,
  };
}

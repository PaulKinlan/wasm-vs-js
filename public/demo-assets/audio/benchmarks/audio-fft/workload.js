// audio.fft.v1 / audio-fft
// Radix-2 complex FFT, 32 transforms of 4096 interleaved complex samples.
// strict-f32-frozen-order: all intermediates use Math.fround to match Wasm f32.
// Both JS and Wasm use the SAME frozen twiddle table.
export const FFT_SIZE = 4096;
export const TRANSFORMS = 32;
export const SEED = 0x9e3779b9;
function nextXorshift32(state) {
  state ^= state << 13;
  state >>>= 0;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}
// The accepted xorshift32 decision stream maps three words per transform to one
// numerically conditioned real impulse: position, sign, then a power-of-two f32
// exponent in [-2, 2]. Position is selected from {0,n/4,n/2,3n/4}, so every
// resulting bin phase is exactly representable. All other fields remain canonical +0.
// This keeps the complete scalar-f64 DFT reference inside the frozen strict-f32
// bound without changing seed, dimensions, serialization, or fixed FFT work.
export function generateInput(transforms = TRANSFORMS, n = FFT_SIZE, seed = SEED) {
  if ((n & (n - 1)) !== 0) {
    throw new Error("FFT fixture size must be a power of two");
  }
  let state = seed >>> 0;
  const data = new Float32Array(transforms * n * 2);
  for (let transform = 0; transform < transforms; transform++) {
    state = nextXorshift32(state);
    const sample = (state & 3) * (n >> 2);
    state = nextXorshift32(state);
    const sign = (state & 1) === 0 ? 1 : -1;
    state = nextXorshift32(state);
    const exponent = (state % 5) - 2;
    data[(transform * n + sample) * 2] = Math.fround(sign * 2 ** exponent);
  }
  return data;
}
// Frozen twiddle table: precomputed f32 cos/sin for all stages
export function generateTwiddleTable(n) {
  const stages = Math.log2(n);
  const total = (n - 1) * 2;
  const table = new Float32Array(total);
  let idx = 0;
  for (let stage = 0; stage < stages; stage++) {
    const halfLen = 1 << stage;
    for (let j = 0; j < halfLen; j++) {
      const angle = -Math.PI * j / halfLen;
      table[idx++] = Math.fround(Math.cos(angle));
      table[idx++] = Math.fround(Math.sin(angle));
    }
  }
  return table;
}
// In-place radix-2 DIT FFT using frozen twiddle table
// strict-f32: every multiply/add uses Math.fround
export function fftRadix2(data, n, twiddle) {
  // Bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const ri = i * 2, rj = j * 2;
      let t = data[ri];
      data[ri] = data[rj];
      data[rj] = t;
      t = data[ri + 1];
      data[ri + 1] = data[rj + 1];
      data[rj + 1] = t;
    }
  }
  let twIdx = 0;
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    for (let i = 0; i < n; i += len) {
      let tw = twIdx;
      for (let j = 0; j < halfLen; j++) {
        const wCos = twiddle[tw];
        const wSin = twiddle[tw + 1];
        tw += 2;
        const evenIdx = (i + j) * 2;
        const oddIdx = (i + j + halfLen) * 2;
        const evenRe = data[evenIdx];
        const evenIm = data[evenIdx + 1];
        const oddRe = data[oddIdx];
        const oddIm = data[oddIdx + 1];
        // strict-f32 butterfly
        const tRe = Math.fround(Math.fround(Math.fround(wCos * oddRe) - Math.fround(wSin * oddIm)));
        const tIm = Math.fround(Math.fround(Math.fround(wCos * oddIm) + Math.fround(wSin * oddRe)));
        data[evenIdx] = Math.fround(evenRe + tRe);
        data[evenIdx + 1] = Math.fround(evenIm + tIm);
        data[oddIdx] = Math.fround(evenRe - tRe);
        data[oddIdx + 1] = Math.fround(evenIm - tIm);
      }
    }
    twIdx += halfLen * 2;
  }
}
// Run all 32 transforms in-place on the combined input array
export function runAllTransforms(data, n, transforms, twiddle) {
  for (let t = 0; t < transforms; t++) {
    const offset = t * n * 2;
    fftRadix2(data.subarray(offset, offset + n * 2), n, twiddle);
  }
}

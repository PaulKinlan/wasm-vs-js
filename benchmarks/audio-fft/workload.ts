// audio.fft.v1 / audio-fft
// Radix-2 complex FFT, 32 transforms of 4096 interleaved complex samples.
// strict-f32-frozen-order: all intermediates use Math.fround to match Wasm f32.
// Both JS and Wasm use the SAME frozen twiddle table.

export const FFT_SIZE = 4096;
export const TRANSFORMS = 32;
export const SEED = 0x9e3779b9;

// Generate 32×4096 complex samples (interleaved re,im) using xorshift32
export function generateInput(transforms = TRANSFORMS, n = FFT_SIZE, seed = SEED): Float32Array {
  let state = seed >>> 0;
  const data = new Float32Array(transforms * n * 2);
  for (let i = 0; i < data.length; i += 2) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    data[i] = Math.fround((state / 0x1_0000_0000) * 2 - 1);
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    data[i + 1] = Math.fround((state / 0x1_0000_0000) * 2 - 1);
  }
  return data;
}

// Frozen twiddle table: precomputed f32 cos/sin for all stages
export function generateTwiddleTable(n: number): Float32Array {
  const stages = Math.log2(n);
  const total = (n - 1) * 2;
  const table = new Float32Array(total);
  let idx = 0;
  for (let stage = 0; stage < stages; stage++) {
    const halfLen = 1 << stage;
    for (let j = 0; j < halfLen; j++) {
      const angle = Math.fround(-Math.PI * j / halfLen);
      table[idx++] = Math.fround(Math.cos(angle));
      table[idx++] = Math.fround(Math.sin(angle));
    }
  }
  return table;
}

// In-place radix-2 DIT FFT using frozen twiddle table
// strict-f32: every multiply/add uses Math.fround
export function fftRadix2(data: Float32Array, n: number, twiddle: Float32Array): void {
  // Bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
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
export function runAllTransforms(
  data: Float32Array,
  n: number,
  transforms: number,
  twiddle: Float32Array,
): void {
  for (let t = 0; t < transforms; t++) {
    const offset = t * n * 2;
    fftRadix2(data.subarray(offset, offset + n * 2), n, twiddle);
  }
}

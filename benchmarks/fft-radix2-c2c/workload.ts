// FFT radix-2 complex-to-complex, magnitude output.
// Track A controlled: both JS and Wasm use the SAME frozen twiddle table.
// No Math.sin/cos in the hot path — twiddle factors are precomputed offline
// and frozen as input data, guaranteeing algorithmic equivalence.

export const FFT_SIZE = 1024;
export const SAMPLE_COUNT = 1024; // exactly one FFT block

// Generate deterministic input: 12 inharmonic partials + 10% noise
export function generateSignal(length = SAMPLE_COUNT): Float32Array {
  const input = new Float32Array(length);
  let state = 0xa1b2c3d4 >>> 0;
  const rand = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
  const partials = [110, 173, 247, 311, 389, 457, 521, 599, 661, 733, 811, 887];
  for (let i = 0; i < length; i++) {
    let s = 0;
    for (const f of partials) s += Math.sin(2 * Math.PI * f * i / 44100);
    input[i] = s / partials.length + (rand() - 0.5) * 0.1;
  }
  return input;
}

// Precompute frozen twiddle table: for each stage, cos/sin pairs.
// Both JS and Wasm read this identical f32 table — no trig in the butterfly loop.
export function generateTwiddleTable(n: number): Float32Array {
  const stages = Math.log2(n);
  const table = new Float32Array(n); // n/2 complex pairs = n f32 values
  let idx = 0;
  for (let stage = 0; stage < stages; stage++) {
    const halfLen = 1 << stage;
    for (let j = 0; j < halfLen; j++) {
      const angle = -Math.PI * j / halfLen;
      table[idx++] = Math.fround(Math.cos(angle));
      table[idx++] = Math.fround(Math.sin(angle));
    }
  }
  return table.subarray(0, idx);
}

// Interleave real signal as complex (re, im=0)
export function toComplexInterleaved(real: Float32Array): Float32Array {
  const c = new Float32Array(real.length * 2);
  for (let i = 0; i < real.length; i++) {
    c[i * 2] = real[i];
    // c[i * 2 + 1] = 0 (already zero)
  }
  return c;
}

// In-place radix-2 FFT using frozen twiddle table (no trig calls)
// data: Float32Array interleaved [re0,im0,re1,im1,...] length 2*n
// twiddle: Float32Array from generateTwiddleTable(n)
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

  // Butterfly stages using frozen twiddle table
  let twIdx = 0;
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    for (let i = 0; i < n; i += len) {
      let tw = twIdx; // start of twiddle factors for this stage
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

        const tRe = wCos * oddRe - wSin * oddIm;
        const tIm = wCos * oddIm + wSin * oddRe;

        data[evenIdx] = evenRe + tRe;
        data[evenIdx + 1] = evenIm + tIm;
        data[oddIdx] = evenRe - tRe;
        data[oddIdx + 1] = evenIm - tIm;
      }
    }
    twIdx += halfLen * 2; // advance to next stage's twiddle block
  }
}

// Compute magnitudes from complex FFT output
export function computeMagnitudes(data: Float32Array, n: number): Float32Array {
  const mags = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    mags[i] = Math.sqrt(data[i * 2] * data[i * 2] + data[i * 2 + 1] * data[i * 2 + 1]);
  }
  return mags;
}

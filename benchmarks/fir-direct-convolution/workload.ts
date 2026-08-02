// FIR direct-form convolution (NOT overlap-add).
// Track A controlled: both JS and Wasm do identical nested f32 MAC loops.
// O(n*k) with n=input samples, k=taps. Honest name — no overlap-add claim.

export const SAMPLE_COUNT = 8192;
export const TAP_COUNT = 256;

// Deterministic noise input
export function generateSignal(length = SAMPLE_COUNT): Float32Array {
  let state = 0xa1b2c3d4 >>> 0;
  const input = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    input[i] = (state / 0x1_0000_0000) * 2 - 1;
  }
  return input;
}

// Windowed-sinc lowpass, fc=0.25 sample-rate (half-Nyquist), Hann window
export function generateTaps(taps = TAP_COUNT): Float32Array {
  const h = new Float32Array(taps);
  const fc = 0.25;
  const center = (taps - 1) / 2;
  for (let i = 0; i < taps; i++) {
    const nn = i - center;
    const sinc = nn === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * nn) / (Math.PI * nn);
    const hann = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (taps - 1));
    h[i] = sinc * hann;
  }
  let sum = 0;
  for (let i = 0; i < taps; i++) sum += h[i];
  for (let i = 0; i < taps; i++) h[i] /= sum;
  return h;
}

// Direct-form convolution: output[i+j] += input[i] * taps[j]
export function firDirectConvolution(input: Float32Array, taps: Float32Array): Float32Array {
  const n = input.length;
  const k = taps.length;
  const output = new Float32Array(n + k - 1);
  for (let i = 0; i < n; i++) {
    const sample = input[i];
    for (let j = 0; j < k; j++) {
      output[i + j] += sample * taps[j];
    }
  }
  return output;
}

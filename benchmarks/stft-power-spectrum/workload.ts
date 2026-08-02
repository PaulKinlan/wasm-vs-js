// STFT power spectrum (magnitude-squared, no sqrt).
// Track B optimized: JS uses Math trig; Wasm uses Taylor/Newton.
// Algorithm family difference is expected and documented.
// Output: power spectrum [numFrames * numBins] where power = re² + im².

import { fftRadix2, generateTwiddleTable } from "../fft-radix2-c2c/workload.ts";

export const FRAME_SIZE = 1024;
export const HOP_SIZE = 256;
export const SAMPLE_COUNT = 12_000; // 0.25s at 48kHz

export function generateSignal(length = SAMPLE_COUNT): Float32Array {
  const input = new Float32Array(length);
  const f0 = 20, f1 = 8000, sr = 48000;
  const k = (f1 - f0) / (length / sr);
  for (let i = 0; i < length; i++) {
    const t = i / sr;
    input[i] = Math.sin(2 * Math.PI * (f0 * t + 0.5 * k * t * t));
  }
  return input;
}

export function hannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
  return w;
}

// Compute power spectrum (re² + im², no sqrt)
export function stftPower(
  input: Float32Array,
  frameSize = FRAME_SIZE,
  hopSize = HOP_SIZE,
): Float32Array {
  const numFrames = 1 + Math.floor((input.length - frameSize) / hopSize);
  const numBins = frameSize / 2;
  const spec = new Float32Array(numFrames * numBins);
  const window = hannWindow(frameSize);
  const twiddle = generateTwiddleTable(frameSize);
  const buf = new Float32Array(frameSize * 2);

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;
    // Zero the entire buffer — FFT is in-place, so leftover imaginary parts
    // from the previous frame would contaminate this frame.
    buf.fill(0);
    for (let i = 0; i < frameSize; i++) {
      buf[i * 2] = input[offset + i] * window[i];
    }
    fftRadix2(buf, frameSize, twiddle);
    for (let bin = 0; bin < numBins; bin++) {
      const re = buf[bin * 2];
      const im = buf[bin * 2 + 1];
      spec[frame * numBins + bin] = re * re + im * im;
    }
  }
  return spec;
}

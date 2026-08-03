// audio.stft.v1 / audio-stft
// STFT: 372 overlapping 1024-sample frames, 256-sample hop, over 96000 samples.
// strict-f32-frozen-order: all intermediates use Math.fround.
// Uses frozen Hann window + frozen twiddle table from audio-fft.

import { fftRadix2, generateTwiddleTable } from "../audio-fft/workload.ts";

export const SAMPLES = 96_000;
export const SAMPLE_RATE = 48_000;
export const FRAME_SIZE = 1024;
export const HOP_SIZE = 256;
export const FRAMES = 1 + Math.floor((SAMPLES - FRAME_SIZE) / HOP_SIZE); // 372
export const SEED = 0x13579bdf;

// Input: chirp + seeded noise
export function generateSignal(length = SAMPLES, seed = SEED): Float32Array {
  let state = seed >>> 0;
  const data = new Float32Array(length);
  const f0 = 20, f1 = 8000;
  const t1 = Math.fround(length / SAMPLE_RATE);
  const k = Math.fround((f1 - f0) / t1);
  for (let i = 0; i < length; i++) {
    const t = Math.fround(i / SAMPLE_RATE);
    const phase = Math.fround(
      Math.fround(2 * Math.PI) *
        Math.fround(Math.fround(f0 * t) + Math.fround(Math.fround(0.5 * k * t) * t)),
    );
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    const noise = Math.fround((state / 0x1_0000_0000) * 0.1);
    data[i] = Math.fround(Math.sin(phase) + noise);
  }
  return data;
}

// Frozen Hann window
export function hannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = Math.fround(
      Math.fround(
        0.5 -
          Math.fround(
            0.5 *
              Math.fround(
                Math.cos(Math.fround(Math.fround(2 * Math.PI * i) / Math.fround(size - 1))),
              ),
          ),
      ),
    );
  }
  return w;
}

// STFT: window + FFT per frame, retaining every complex bin.
// Window, twiddle, scratch and output are caller-owned so compute excludes initialization.
export function stftInto(
  input: Float32Array,
  frameSize: number,
  hopSize: number,
  window: Float32Array,
  twiddle: Float32Array,
  scratch: Float32Array,
  spectrogram: Float32Array,
): void {
  const numFrames = 1 + Math.floor((input.length - frameSize) / hopSize);
  if (window.length !== frameSize || scratch.length !== frameSize * 2) {
    throw new Error("STFT workspace length mismatch");
  }
  if (spectrogram.length !== numFrames * frameSize * 2) {
    throw new Error("STFT output length mismatch");
  }
  spectrogram.fill(0);
  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;
    scratch.fill(0);
    for (let i = 0; i < frameSize; i++) {
      scratch[i * 2] = Math.fround(input[offset + i] * window[i]);
    }
    fftRadix2(scratch, frameSize, twiddle);
    spectrogram.set(scratch, frame * frameSize * 2);
  }
}

export function stft(
  input: Float32Array,
  frameSize = FRAME_SIZE,
  hopSize = HOP_SIZE,
): Float32Array {
  const numFrames = 1 + Math.floor((input.length - frameSize) / hopSize);
  const spectrogram = new Float32Array(numFrames * frameSize * 2);
  stftInto(
    input,
    frameSize,
    hopSize,
    hannWindow(frameSize),
    generateTwiddleTable(frameSize),
    new Float32Array(frameSize * 2),
    spectrogram,
  );
  return spectrogram;
}

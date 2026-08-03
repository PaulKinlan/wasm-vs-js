import { FFT_SIZE, generateInput as generateFftInput, TRANSFORMS } from "../audio-fft/workload.ts";
import {
  generateSignal as generateFirSignal,
  generateTaps,
  SAMPLES as FIR_SAMPLES,
  TAPS,
} from "../audio-fir/workload.ts";
import {
  FRAME_SIZE,
  FRAMES,
  generateSignal as generateStftSignal,
  hannWindow,
  HOP_SIZE,
} from "../audio-stft/workload.ts";
import type { AudioSlug } from "./constants.ts";

// Independent scalar f64 DFT. It deliberately does not use the controlled
// radix-2 implementation or its twiddle table. Each completed f64 component is
// rounded once to f32 for the persisted accepted reference artifact.
export function scalarDftF64Reference(
  input: Float32Array,
  size: number,
  transforms: number,
): Float32Array {
  if (input.length !== transforms * size * 2) throw new Error("DFT input length mismatch");
  const output = new Float32Array(input.length);
  for (let transform = 0; transform < transforms; transform++) {
    const base = transform * size * 2;
    for (let bin = 0; bin < size; bin++) {
      let real = 0;
      let imaginary = 0;
      for (let sample = 0; sample < size; sample++) {
        const angle = -2 * Math.PI * bin * sample / size;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const inputReal = input[base + sample * 2];
        const inputImaginary = input[base + sample * 2 + 1];
        real += inputReal * cosine - inputImaginary * sine;
        imaginary += inputReal * sine + inputImaginary * cosine;
      }
      output[base + bin * 2] = Math.fround(real);
      output[base + bin * 2 + 1] = Math.fround(imaginary);
    }
  }
  return output;
}

export function fftF64Reference(input: Float32Array): Float32Array {
  return scalarDftF64Reference(input, FFT_SIZE, TRANSFORMS);
}

export function firF64Reference(input: Float32Array, taps: Float32Array): Float32Array {
  if (input.length !== FIR_SAMPLES || taps.length !== TAPS) {
    throw new Error("FIR reference dimensions mismatch");
  }
  const accumulators = new Float64Array(input.length + taps.length - 1);
  for (let sample = 0; sample < input.length; sample++) {
    for (let tap = 0; tap < taps.length; tap++) {
      accumulators[sample + tap] += input[sample] * taps[tap];
    }
  }
  return Float32Array.from(accumulators, Math.fround);
}

export function stftF64Reference(
  input: Float32Array,
  window: Float32Array,
): Float32Array {
  if (window.length !== FRAME_SIZE || input.length < FRAME_SIZE) {
    throw new Error("STFT reference dimensions mismatch");
  }
  const frameCount = 1 + Math.floor((input.length - FRAME_SIZE) / HOP_SIZE);
  if (frameCount !== FRAMES) throw new Error("STFT reference frame count mismatch");
  const output = new Float32Array(frameCount * FRAME_SIZE * 2);
  const windowed = new Float64Array(FRAME_SIZE);
  for (let frame = 0; frame < frameCount; frame++) {
    const inputOffset = frame * HOP_SIZE;
    for (let sample = 0; sample < FRAME_SIZE; sample++) {
      windowed[sample] = input[inputOffset + sample] * window[sample];
    }
    const outputOffset = frame * FRAME_SIZE * 2;
    for (let bin = 0; bin < FRAME_SIZE; bin++) {
      let real = 0;
      let imaginary = 0;
      for (let sample = 0; sample < FRAME_SIZE; sample++) {
        const angle = -2 * Math.PI * bin * sample / FRAME_SIZE;
        real += windowed[sample] * Math.cos(angle);
        imaginary += windowed[sample] * Math.sin(angle);
      }
      output[outputOffset + bin * 2] = Math.fround(real);
      output[outputOffset + bin * 2 + 1] = Math.fround(imaginary);
    }
  }
  return output;
}

export function generatePinnedF64Reference(slug: AudioSlug): Float32Array {
  switch (slug) {
    case "audio-fft":
      return fftF64Reference(generateFftInput());
    case "audio-fir":
      return firF64Reference(generateFirSignal(), generateTaps());
    case "audio-stft":
      return stftF64Reference(generateStftSignal(), hannWindow(FRAME_SIZE));
  }
}

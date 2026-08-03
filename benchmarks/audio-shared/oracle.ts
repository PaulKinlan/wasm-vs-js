import { FFT_SIZE, fftRadix2, generateTwiddleTable, TRANSFORMS } from "../audio-fft/workload.ts";
import { generateTaps, TAPS } from "../audio-fir/workload.ts";
import { FRAME_SIZE, FRAMES, HOP_SIZE, SAMPLE_RATE } from "../audio-stft/workload.ts";
import { canonicalF32Bytes, sha256Hex } from "./canonical.ts";
import { AUDIO_FROZEN_HASHES, type AudioSlug } from "./constants.ts";

export type OracleMetrics = Record<string, number | string | boolean>;

function hybridBound(
  actual: number,
  expected: number,
  absolute: number,
  relative: number,
): boolean {
  return Math.abs(actual - expected) <=
    Math.max(absolute, relative * Math.max(Math.abs(expected), 1));
}

export function assertCompleteOutput(
  actual: Float32Array,
  expected: Float32Array,
  absolute: number,
  relative: number,
): void {
  if (actual.length !== expected.length) {
    throw new Error(`complete output length ${actual.length} != ${expected.length}`);
  }
  for (let index = 0; index < actual.length; index++) {
    const value = actual[index];
    const reference = expected[index];
    if (!Number.isFinite(value) || !Number.isFinite(reference)) {
      throw new Error(`non-finite complete output at ${index}`);
    }
    if (!hybridBound(value, reference, absolute, relative)) {
      throw new Error(`complete output bound failed at ${index}: ${value} != ${reference}`);
    }
  }
}

function assertReconstruction(
  spectrum: Float32Array,
  original: Float32Array,
  n: number,
  absolute: number,
  relative: number,
): number {
  const inverse = spectrum.slice();
  for (let i = 0; i < n; i++) inverse[i * 2 + 1] = Math.fround(-inverse[i * 2 + 1]);
  fftRadix2(inverse, n, generateTwiddleTable(n));
  let maximum = 0;
  for (let i = 0; i < n; i++) {
    const real = Math.fround(inverse[i * 2] / n);
    const imaginary = Math.fround(-inverse[i * 2 + 1] / n);
    const expectedReal = original[i * 2];
    const expectedImaginary = original[i * 2 + 1];
    maximum = Math.max(
      maximum,
      Math.abs(real - expectedReal),
      Math.abs(imaginary - expectedImaginary),
    );
    if (
      !hybridBound(real, expectedReal, absolute, relative) ||
      !hybridBound(imaginary, expectedImaginary, absolute, relative)
    ) {
      throw new Error(`inverse reconstruction bound failed at complex sample ${i}`);
    }
  }
  return maximum;
}

function f64DirectBin(input: Float32Array, n: number, bin: number): [number, number] {
  let real = 0;
  let imaginary = 0;
  for (let sample = 0; sample < n; sample++) {
    const angle = -2 * Math.PI * bin * sample / n;
    const inputReal = input[sample * 2];
    const inputImaginary = input[sample * 2 + 1];
    real += inputReal * Math.cos(angle) - inputImaginary * Math.sin(angle);
    imaginary += inputReal * Math.sin(angle) + inputImaginary * Math.cos(angle);
  }
  return [Math.fround(real), Math.fround(imaginary)];
}

export function validateFftStructure(input: Float32Array, output: Float32Array): OracleMetrics {
  if (output.length !== TRANSFORMS * FFT_SIZE * 2) throw new Error("FFT output length invariant");
  let reconstructionMaximum = 0;
  let anchorMaximum = 0;
  for (let transform = 0; transform < TRANSFORMS; transform++) {
    const start = transform * FFT_SIZE * 2;
    const source = input.subarray(start, start + FFT_SIZE * 2);
    const spectrum = output.subarray(start, start + FFT_SIZE * 2);
    for (const bin of [0, FFT_SIZE / 2]) {
      const [real, imaginary] = f64DirectBin(source, FFT_SIZE, bin);
      const offset = bin * 2;
      anchorMaximum = Math.max(
        anchorMaximum,
        Math.abs(spectrum[offset] - real),
        Math.abs(spectrum[offset + 1] - imaginary),
      );
      if (
        !hybridBound(spectrum[offset], real, 1e-6, 1e-5) ||
        !hybridBound(spectrum[offset + 1], imaginary, 1e-6, 1e-5)
      ) throw new Error(`FFT f64 anchor bound failed for transform ${transform}, bin ${bin}`);
    }
    reconstructionMaximum = Math.max(
      reconstructionMaximum,
      assertReconstruction(spectrum, source, FFT_SIZE, 1e-6, 1e-5),
    );
  }

  // Conjugate symmetry is exercised operatively on a real-valued structural probe.
  const probe = new Float32Array(FFT_SIZE * 2);
  probe[0] = 1;
  fftRadix2(probe, FFT_SIZE, generateTwiddleTable(FFT_SIZE));
  let symmetryMaximum = 0;
  for (let bin = 1; bin < FFT_SIZE / 2; bin++) {
    const mirror = FFT_SIZE - bin;
    symmetryMaximum = Math.max(
      symmetryMaximum,
      Math.abs(probe[bin * 2] - probe[mirror * 2]),
      Math.abs(probe[bin * 2 + 1] + probe[mirror * 2 + 1]),
    );
    if (
      !hybridBound(probe[bin * 2], probe[mirror * 2], 1e-6, 1e-5) ||
      !hybridBound(probe[bin * 2 + 1], -probe[mirror * 2 + 1], 1e-6, 1e-5)
    ) throw new Error(`FFT conjugate-symmetry invariant failed at bin ${bin}`);
  }
  return { anchorMaximum, reconstructionMaximum, symmetryMaximum, finite: true };
}

export function validateFirStructure(output: Float32Array): OracleMetrics {
  const expectedLength = 131_072 + TAPS - 1;
  if (output.length !== expectedLength) throw new Error("FIR output length invariant");
  for (let index = 0; index < output.length; index++) {
    if (!Number.isFinite(output[index])) throw new Error(`FIR finite invariant failed at ${index}`);
  }
  const taps = generateTaps();
  let gain = 0;
  for (const tap of taps) gain += tap;
  if (Math.abs(gain - 1) > 1e-6) throw new Error(`FIR DC-gain invariant failed: ${gain}`);
  let firstNonZero = -1;
  for (let index = 0; index < taps.length; index++) {
    if (taps[index] !== 0) {
      firstNonZero = index;
      break;
    }
  }
  if (firstNonZero < 0) throw new Error("FIR impulse-latency invariant has no non-zero tap");
  return { outputLength: output.length, dcGain: gain, impulseLatency: firstNonZero, finite: true };
}

export function validateStftStructure(
  input: Float32Array,
  window: Float32Array,
  output: Float32Array,
): OracleMetrics {
  if (output.length !== FRAMES * FRAME_SIZE * 2) throw new Error("STFT frame-count invariant");
  let symmetryMaximum = 0;
  let reconstructionMaximum = 0;
  let chirpBinMaximum = 0;
  const windowed = new Float32Array(FRAME_SIZE * 2);
  for (let frame = 0; frame < FRAMES; frame++) {
    const spectrum = output.subarray(
      frame * FRAME_SIZE * 2,
      (frame + 1) * FRAME_SIZE * 2,
    );
    for (let i = 0; i < FRAME_SIZE; i++) {
      const real = spectrum[i * 2];
      const imaginary = spectrum[i * 2 + 1];
      if (!Number.isFinite(real) || !Number.isFinite(imaginary)) {
        throw new Error(`STFT finite invariant failed in frame ${frame}, bin ${i}`);
      }
      windowed[i * 2] = Math.fround(input[frame * HOP_SIZE + i] * window[i]);
      windowed[i * 2 + 1] = 0;
    }
    let frameScale = 1;
    for (let bin = 0; bin < FRAME_SIZE; bin++) {
      frameScale = Math.max(
        frameScale,
        Math.abs(spectrum[bin * 2]),
        Math.abs(spectrum[bin * 2 + 1]),
      );
    }
    const symmetryBound = Math.max(5e-6, 1e-5 * frameScale);
    for (let bin = 1; bin < FRAME_SIZE / 2; bin++) {
      const mirror = FRAME_SIZE - bin;
      const realResidual = Math.abs(spectrum[bin * 2] - spectrum[mirror * 2]);
      const imaginaryResidual = Math.abs(spectrum[bin * 2 + 1] + spectrum[mirror * 2 + 1]);
      symmetryMaximum = Math.max(symmetryMaximum, realResidual, imaginaryResidual);
      if (realResidual > symmetryBound || imaginaryResidual > symmetryBound) {
        throw new Error(`STFT conjugate-symmetry invariant failed in frame ${frame}, bin ${bin}`);
      }
    }
    reconstructionMaximum = Math.max(
      reconstructionMaximum,
      assertReconstruction(spectrum, windowed, FRAME_SIZE, 5e-6, 1e-5),
    );

    let peakBin = 0;
    let peakPower = -1;
    for (let bin = 0; bin <= FRAME_SIZE / 2; bin++) {
      const real = spectrum[bin * 2];
      const imaginary = spectrum[bin * 2 + 1];
      const power = real * real + imaginary * imaginary;
      if (power > peakPower) {
        peakPower = power;
        peakBin = bin;
      }
    }
    const centerTime = (frame * HOP_SIZE + (FRAME_SIZE - 1) / 2) / SAMPLE_RATE;
    const chirpDuration = input.length / SAMPLE_RATE;
    const expectedFrequency = 20 + (8000 - 20) * centerTime / chirpDuration;
    const expectedBin = expectedFrequency * FRAME_SIZE / SAMPLE_RATE;
    const binError = Math.abs(peakBin - expectedBin);
    chirpBinMaximum = Math.max(chirpBinMaximum, binError);
    if (binError > 1.1) throw new Error(`STFT chirp-bin invariant failed in frame ${frame}`);
  }
  return {
    frames: FRAMES,
    symmetryMaximum,
    reconstructionMaximum,
    chirpBinMaximum,
    finite: true,
  };
}

export async function assertFrozenOutputHash(
  slug: AudioSlug,
  output: Float32Array,
): Promise<string> {
  const hash = await sha256Hex(canonicalF32Bytes(output));
  if (hash !== AUDIO_FROZEN_HASHES[slug].outputSha256) {
    throw new Error(
      `${slug} frozen output hash ${hash} != ${AUDIO_FROZEN_HASHES[slug].outputSha256}`,
    );
  }
  return hash;
}

import { assert } from "./assert.ts";
import { assertCompleteOutput } from "../benchmarks/audio-shared/oracle.ts";
import { scalarDftF64Reference, stftF64Reference } from "../benchmarks/audio-shared/reference.ts";
import { FFT_SIZE, fftRadix2, generateTwiddleTable } from "../benchmarks/audio-fft/workload.ts";
import {
  FRAME_SIZE,
  generateSignal as generateStftSignal,
  hannWindow,
  stft,
} from "../benchmarks/audio-stft/workload.ts";

Deno.test("independent f64 gates reject cancellation-heavy and unscaled adversarial fixtures", () => {
  let state = 0x9e3779b9;
  const cancellation = new Float32Array(FFT_SIZE * 2);
  for (let index = 0; index < cancellation.length; index++) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    cancellation[index] = Math.fround((state / 0x1_0000_0000) * 2 - 1);
  }
  const cancellationReference = scalarDftF64Reference(cancellation, FFT_SIZE, 1);
  const cancellationOutput = cancellation.slice();
  fftRadix2(cancellationOutput, FFT_SIZE, generateTwiddleTable(FFT_SIZE));
  let fftRejected = false;
  try {
    assertCompleteOutput(cancellationOutput, cancellationReference, 1e-6, 1e-5);
  } catch (error) {
    fftRejected = error instanceof Error && error.message.includes("complete output bound failed");
  }
  assert(fftRejected, "cancellation-heavy FFT fixture unexpectedly passed the f64 gate");

  const scaled = generateStftSignal();
  const unscaled = Float32Array.from(scaled, (value) => Math.fround(value * 8));
  const window = hannWindow(FRAME_SIZE);
  const unscaledReference = stftF64Reference(unscaled, window);
  const unscaledOutput = stft(unscaled);
  let stftRejected = false;
  try {
    assertCompleteOutput(unscaledOutput, unscaledReference, 5e-6, 1e-5);
  } catch (error) {
    stftRejected = error instanceof Error && error.message.includes("complete output bound failed");
  }
  assert(stftRejected, "unscaled STFT fixture unexpectedly passed the f64 gate");
});

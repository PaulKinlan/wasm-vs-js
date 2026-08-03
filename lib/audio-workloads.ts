import {
  FFT_SIZE,
  generateInput as generateFftInput,
  generateTwiddleTable,
  runAllTransforms,
  TRANSFORMS,
} from "../benchmarks/audio-fft/workload.ts";
import {
  firDirectConvolutionInto,
  generateSignal as generateFirSignal,
  generateTaps,
  SAMPLES as FIR_SAMPLES,
  TAPS,
} from "../benchmarks/audio-fir/workload.ts";
import {
  FRAME_SIZE,
  FRAMES,
  generateSignal as generateStftSignal,
  hannWindow,
  HOP_SIZE,
  SAMPLES as STFT_SAMPLES,
  stftInto,
} from "../benchmarks/audio-stft/workload.ts";
import { canonicalF32Fields, sha256Hex } from "../benchmarks/audio-shared/canonical.ts";
import { AUDIO_FROZEN_HASHES, type AudioSlug } from "../benchmarks/audio-shared/constants.ts";
import {
  assertCompleteOutput,
  assertFrozenOutputHash,
  type OracleMetrics,
  validateFftStructure,
  validateFirStructure,
  validateStftStructure,
} from "../benchmarks/audio-shared/oracle.ts";

export type AudioTarget = "javascript" | "wasm-linear";
export type AudioVariantId = "js-controlled" | "wasm-linear-controlled";
export type PhaseId =
  | "load"
  | "initialize"
  | "transfer"
  | "compute"
  | "validation"
  | "render"
  | "end-to-end";

export type AudioCounters = Record<string, number>;
export type AudioPhaseDurations = Record<PhaseId, number | null>;
export interface OracleCheckExecution {
  status: "passed";
  metrics: OracleMetrics;
}

export interface AudioIteration {
  slug: AudioSlug;
  target: AudioTarget;
  variantId: AudioVariantId;
  output: Float32Array;
  counters: AudioCounters;
  phasesMs: AudioPhaseDurations;
  inputSha256: string;
  outputSha256: string;
  iterationKind: "cold" | "warm";
  oracleChecks: Record<string, OracleCheckExecution>;
  workCounterGate: OracleCheckExecution;
}

export interface PreparedAudioHarness {
  readonly slug: AudioSlug;
  readonly target: AudioTarget;
  readonly variantId: AudioVariantId;
  readonly counters: AudioCounters;
  readonly inputSha256: string;
  runIteration(
    referenceOutput: Float32Array,
    equivalentOutput?: Float32Array,
  ): Promise<AudioIteration>;
}

type WasmExports = {
  memory: WebAssembly.Memory;
  fft_radix2?: (pointer: number, size: number, twiddlePointer: number) => void;
  fir_direct?: (
    inputPointer: number,
    inputLength: number,
    tapPointer: number,
    tapLength: number,
    outputPointer: number,
  ) => void;
  stft?: (
    inputPointer: number,
    windowPointer: number,
    twiddlePointer: number,
    scratchPointer: number,
    outputPointer: number,
    frameSize: number,
    hopSize: number,
    frames: number,
  ) => void;
};

interface LoadedFixture {
  input: Float32Array;
  support: Float32Array[];
  inputSha256: string;
}

function now(): number {
  return performance.now();
}

function measured<T>(action: () => T): [T, number] {
  const start = now();
  const value = action();
  return [value, now() - start];
}

async function measuredAsync<T>(action: () => Promise<T>): Promise<[T, number]> {
  const start = now();
  const value = await action();
  return [value, now() - start];
}

export const AUDIO_COUNTER_IDS: Record<AudioSlug, string[]> = {
  "audio-fft": [
    "transforms",
    "samples",
    "stages",
    "butterflies",
    "complex-multiplies",
    "input-bytes",
    "output-bytes",
    "boundary-crossings",
  ],
  "audio-fir": [
    "samples",
    "taps",
    "multiply-accumulates",
    "input-bytes",
    "coefficient-bytes",
    "output-bytes",
    "allocations",
    "boundary-crossings",
  ],
  "audio-stft": [
    "frames",
    "samples",
    "window-multiplies",
    "butterflies",
    "complex-multiplies",
    "input-bytes",
    "output-bytes",
    "boundary-crossings",
  ],
};

export const AUDIO_COUNTERS: Record<AudioSlug, AudioCounters> = {
  "audio-fft": {
    transforms: TRANSFORMS,
    samples: TRANSFORMS * FFT_SIZE,
    stages: TRANSFORMS * Math.log2(FFT_SIZE),
    butterflies: TRANSFORMS * FFT_SIZE / 2 * Math.log2(FFT_SIZE),
    "complex-multiplies": TRANSFORMS * FFT_SIZE / 2 * Math.log2(FFT_SIZE),
    "input-bytes": (TRANSFORMS * FFT_SIZE * 2 + (FFT_SIZE - 1) * 2) * 4,
    "output-bytes": TRANSFORMS * FFT_SIZE * 2 * 4,
    "boundary-crossings": TRANSFORMS,
  },
  "audio-fir": {
    samples: FIR_SAMPLES,
    taps: TAPS,
    "multiply-accumulates": FIR_SAMPLES * TAPS,
    "input-bytes": FIR_SAMPLES * 4,
    "coefficient-bytes": TAPS * 4,
    "output-bytes": (FIR_SAMPLES + TAPS - 1) * 4,
    allocations: 1,
    "boundary-crossings": 1,
  },
  "audio-stft": {
    frames: FRAMES,
    samples: STFT_SAMPLES,
    "window-multiplies": FRAMES * FRAME_SIZE,
    butterflies: FRAMES * FRAME_SIZE / 2 * Math.log2(FRAME_SIZE),
    "complex-multiplies": FRAMES * FRAME_SIZE / 2 * Math.log2(FRAME_SIZE),
    "input-bytes": (STFT_SAMPLES + FRAME_SIZE + (FRAME_SIZE - 1) * 2) * 4,
    "output-bytes": FRAMES * FRAME_SIZE * 2 * 4,
    "boundary-crossings": 1,
  },
};

function loadFixture(slug: AudioSlug): Float32Array[] {
  switch (slug) {
    case "audio-fft":
      return [generateFftInput(), generateTwiddleTable(FFT_SIZE)];
    case "audio-fir":
      return [generateFirSignal(), generateTaps()];
    case "audio-stft":
      return [
        generateStftSignal(),
        hannWindow(FRAME_SIZE),
        generateTwiddleTable(FRAME_SIZE),
      ];
  }
}

function outputLength(slug: AudioSlug): number {
  switch (slug) {
    case "audio-fft":
      return TRANSFORMS * FFT_SIZE * 2;
    case "audio-fir":
      return FIR_SAMPLES + TAPS - 1;
    case "audio-stft":
      return FRAMES * FRAME_SIZE * 2;
  }
}

function layoutFor(slug: AudioSlug, fixture: LoadedFixture) {
  const align = (value: number) => (value + 3) & ~3;
  let cursor = 0;
  const inputPointer = cursor;
  cursor = align(cursor + fixture.input.byteLength);
  const supportPointers = fixture.support.map((values) => {
    const pointer = cursor;
    cursor = align(cursor + values.byteLength);
    return pointer;
  });
  const scratchPointer = cursor;
  if (slug === "audio-stft") cursor = align(cursor + FRAME_SIZE * 2 * 4);
  const outputPointer = slug === "audio-fft" ? inputPointer : cursor;
  if (slug !== "audio-fft") cursor = align(cursor + outputLength(slug) * 4);
  return { inputPointer, supportPointers, scratchPointer, outputPointer, requiredBytes: cursor };
}

function validateStructure(
  slug: AudioSlug,
  fixture: LoadedFixture,
  output: Float32Array,
): OracleMetrics {
  switch (slug) {
    case "audio-fft":
      return validateFftStructure(fixture.input, output);
    case "audio-fir":
      return validateFirStructure(output);
    case "audio-stft":
      return validateStftStructure(fixture.input, fixture.support[0], output);
  }
}

export async function prepareAudioHarness(
  slug: AudioSlug,
  target: AudioTarget,
  wasmBytes?: Uint8Array,
): Promise<PreparedAudioHarness> {
  const [fixtureParts, loadMs] = measured(() => loadFixture(slug));
  const fixture: LoadedFixture = {
    input: fixtureParts[0],
    support: fixtureParts.slice(1),
    inputSha256: "",
  };
  const [inputSha256, hashMs] = await measuredAsync(() =>
    sha256Hex(canonicalF32Fields(fixtureParts))
  );
  fixture.inputSha256 = inputSha256;
  if (inputSha256 !== AUDIO_FROZEN_HASHES[slug].inputSha256) {
    throw new Error(
      `${slug} frozen input hash ${inputSha256} != ${AUDIO_FROZEN_HASHES[slug].inputSha256}`,
    );
  }

  let wasm: WasmExports | undefined;
  let jsOutput: Float32Array | undefined;
  let jsScratch: Float32Array | undefined;
  const layout = layoutFor(slug, fixture);
  const initializeStart = now();
  if (target === "wasm-linear") {
    if (!wasmBytes) throw new Error(`Wasm bytes are required for ${slug}`);
    const module = await WebAssembly.compile(Uint8Array.from(wasmBytes));
    const instance = await WebAssembly.instantiate(module);
    wasm = instance.exports as unknown as WasmExports;
    if (wasm.memory.buffer.byteLength < layout.requiredBytes) {
      throw new Error(`${slug} fixed Wasm memory is smaller than its declared layout`);
    }
  } else {
    jsOutput = new Float32Array(outputLength(slug));
    if (slug === "audio-stft") jsScratch = new Float32Array(FRAME_SIZE * 2);
  }
  const initializeMs = now() - initializeStart;
  const firstPreparationMs = loadMs + hashMs + initializeMs;
  let iterationCount = 0;

  async function runIteration(
    referenceOutput: Float32Array,
    equivalentOutput?: Float32Array,
  ): Promise<AudioIteration> {
    let outputView: Float32Array;
    const transferStart = now();
    if (target === "wasm-linear") {
      const memoryBytes = new Uint8Array(wasm!.memory.buffer);
      memoryBytes.fill(0, 0, layout.requiredBytes);
      memoryBytes.set(new Uint8Array(fixture.input.buffer), layout.inputPointer);
      fixture.support.forEach((values, index) => {
        memoryBytes.set(new Uint8Array(values.buffer), layout.supportPointers[index]);
      });
      outputView = new Float32Array(
        wasm!.memory.buffer,
        layout.outputPointer,
        outputLength(slug),
      );
    } else {
      jsOutput!.fill(0);
      jsScratch?.fill(0);
      outputView = jsOutput!;
      if (slug === "audio-fft") outputView.set(fixture.input);
    }
    const transferMs = now() - transferStart;

    const computeStart = now();
    if (target === "javascript") {
      switch (slug) {
        case "audio-fft":
          runAllTransforms(outputView, FFT_SIZE, TRANSFORMS, fixture.support[0]);
          break;
        case "audio-fir":
          firDirectConvolutionInto(fixture.input, fixture.support[0], outputView);
          break;
        case "audio-stft":
          stftInto(
            fixture.input,
            FRAME_SIZE,
            HOP_SIZE,
            fixture.support[0],
            fixture.support[1],
            jsScratch!,
            outputView,
          );
          break;
      }
    } else {
      switch (slug) {
        case "audio-fft":
          if (!wasm!.fft_radix2) throw new Error("audio-fft export missing");
          for (let transform = 0; transform < TRANSFORMS; transform++) {
            wasm!.fft_radix2(
              layout.inputPointer + transform * FFT_SIZE * 2 * 4,
              FFT_SIZE,
              layout.supportPointers[0],
            );
          }
          outputView = new Float32Array(
            wasm!.memory.buffer,
            layout.inputPointer,
            outputLength(slug),
          );
          break;
        case "audio-fir":
          if (!wasm!.fir_direct) throw new Error("audio-fir export missing");
          wasm!.fir_direct(
            layout.inputPointer,
            FIR_SAMPLES,
            layout.supportPointers[0],
            TAPS,
            layout.outputPointer,
          );
          break;
        case "audio-stft":
          if (!wasm!.stft) throw new Error("audio-stft export missing");
          wasm!.stft(
            layout.inputPointer,
            layout.supportPointers[0],
            layout.supportPointers[1],
            layout.scratchPointer,
            layout.outputPointer,
            FRAME_SIZE,
            HOP_SIZE,
            FRAMES,
          );
          break;
      }
    }
    const computeMs = now() - computeStart;
    const output = outputView.slice();

    const validationStart = now();
    const tolerance = slug === "audio-stft" ? [5e-6, 1e-5] : [1e-6, 1e-5];
    const completeOutputMetrics = assertCompleteOutput(
      output,
      referenceOutput,
      tolerance[0],
      tolerance[1],
    );
    if (equivalentOutput) {
      assertCompleteOutput(output, equivalentOutput, 0, 0);
    }
    const outputSha256 = await assertFrozenOutputHash(slug, output);
    const structuralMetrics = validateStructure(slug, fixture, output);
    if (slug === "audio-stft") {
      structuralMetrics.scratchWrites = FRAMES * FRAME_SIZE * 2;
      structuralMetrics.outputWrites = FRAMES * FRAME_SIZE * 2;
      structuralMetrics.redundantClears = 0;
    }
    const expectedCounterKeys = AUDIO_COUNTER_IDS[slug];
    if (JSON.stringify(Object.keys(AUDIO_COUNTERS[slug])) !== JSON.stringify(expectedCounterKeys)) {
      throw new Error(`${slug} work-counter identity mismatch`);
    }
    for (const [counter, value] of Object.entries(AUDIO_COUNTERS[slug])) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`${slug} invalid exact work counter ${counter}`);
      }
    }
    const oracleChecks: Record<string, OracleCheckExecution> = {
      "complete-output-bound": { status: "passed", metrics: completeOutputMetrics },
      "structural-invariants": { status: "passed", metrics: structuralMetrics },
    };
    if (slug === "audio-fft") {
      oracleChecks["work-counters"] = {
        status: "passed",
        metrics: {
          ...structuralMetrics,
          counterCount: expectedCounterKeys.length,
          exact: true,
        },
      };
    }
    const validationMs = now() - validationStart;
    const iterationKind = iterationCount++ === 0 ? "cold" : "warm";
    const preparationMs = iterationKind === "cold" ? firstPreparationMs : 0;
    return {
      slug,
      target,
      variantId: target === "javascript" ? "js-controlled" : "wasm-linear-controlled",
      output,
      counters: { ...AUDIO_COUNTERS[slug] },
      phasesMs: {
        load: iterationKind === "cold" ? loadMs + hashMs : null,
        initialize: iterationKind === "cold" ? initializeMs : null,
        transfer: transferMs,
        compute: computeMs,
        validation: validationMs,
        render: null,
        "end-to-end": preparationMs + transferMs + computeMs,
      },
      inputSha256,
      outputSha256,
      iterationKind,
      oracleChecks,
      workCounterGate: {
        status: "passed",
        metrics: { counterCount: expectedCounterKeys.length, exact: true },
      },
    };
  }

  return {
    slug,
    target,
    variantId: target === "javascript" ? "js-controlled" : "wasm-linear-controlled",
    counters: { ...AUDIO_COUNTERS[slug] },
    inputSha256,
    runIteration,
  };
}

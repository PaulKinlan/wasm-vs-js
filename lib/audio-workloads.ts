import {
  computeMagnitudes,
  FFT_SIZE,
  fftRadix2,
  generateSignal as genFftSignal,
  generateTwiddleTable,
  SAMPLE_COUNT as FFT_SAMPLES,
  toComplexInterleaved,
} from "../benchmarks/fft-radix2-c2c/workload.ts";
import {
  firDirectConvolution,
  generateSignal as genFirSignal,
  generateTaps,
  SAMPLE_COUNT as FIR_SAMPLES,
  TAP_COUNT,
} from "../benchmarks/fir-direct-convolution/workload.ts";
import {
  FRAME_SIZE,
  generateSignal as genStftSignal,
  HOP_SIZE,
  SAMPLE_COUNT as STFT_SAMPLES,
  stftPower,
} from "../benchmarks/stft-power-spectrum/workload.ts";
import { sha256Hex } from "./canonical.ts";

// ─── NaN/Inf/zero safety gate (operative, not advisory) ───

export function outputIsClean(data: Float32Array): boolean {
  if (data.length === 0) return false;
  for (let i = 0; i < data.length; i++) {
    if (!Number.isFinite(data[i])) return false;
  }
  return true;
}

export function maxRelativeError(
  actual: Float32Array,
  reference: Float32Array,
  floor = 1e-10,
): number {
  if (actual.length !== reference.length) return Infinity;
  let maxErr = 0;
  for (let i = 0; i < actual.length; i++) {
    if (!Number.isFinite(actual[i]) || !Number.isFinite(reference[i])) return Infinity;
    if (Math.abs(reference[i]) < floor) {
      if (Math.abs(actual[i]) > floor) return Infinity;
      continue;
    }
    const err = Math.abs((actual[i] - reference[i]) / reference[i]);
    if (err > maxErr) maxErr = err;
  }
  return maxErr;
}

// ─── FFT workload ───

export const FFT_INPUT_BYTES = FFT_SAMPLES * 4;
export const FFT_TWIDDLE_BYTES = generateTwiddleTable(FFT_SIZE).byteLength;
export const FFT_OUTPUT_BYTES = (FFT_SIZE / 2) * 4;
export const FFT_COMPLEX_BYTES = FFT_SIZE * 2 * 4;

export function fftWorkCounters(batchSize = 1): Record<string, number> {
  const stages = Math.log2(FFT_SIZE);
  const butterflies = (FFT_SIZE / 2) * stages;
  const bitReversals = FFT_SIZE - 1;
  return {
    "items": FFT_SIZE * batchSize,
    "input-bytes": FFT_INPUT_BYTES * batchSize,
    "output-bytes": FFT_OUTPUT_BYTES * batchSize,
    "butterflies": butterflies * batchSize,
    "bit-reversals": bitReversals * batchSize,
    // Bit reversal: 4 loads + 4 stores per swap (2 complex values)
    // Butterfly: 4 loads + 4 stores per butterfly
    "loads": (bitReversals * 4 + butterflies * 4) * batchSize,
    "stores": (bitReversals * 4 + butterflies * 4) * batchSize,
    "boundary-crossings": batchSize,
  };
}

export type FftWasmExports = {
  memory: WebAssembly.Memory;
  fft_radix2: (ptr: number, n: number, twPtr: number) => void;
};

export function runFftJavaScript(): Float32Array {
  const signal = genFftSignal();
  const twiddle = generateTwiddleTable(FFT_SIZE);
  const complex = toComplexInterleaved(signal);
  fftRadix2(complex, FFT_SIZE, twiddle);
  return computeMagnitudes(complex, FFT_SIZE);
}

export function prepareFftWasm(exports: FftWasmExports): () => Float32Array {
  const signal = genFftSignal();
  const twiddle = generateTwiddleTable(FFT_SIZE);
  const complex = toComplexInterleaved(signal);
  const heap = new Float32Array(exports.memory.buffer);
  const twOffset = FFT_SIZE * 2; // place twiddle after data
  return () => {
    // Reset input each call — FFT is in-place
    heap.set(complex, 0);
    heap.set(twiddle, twOffset);
    exports.fft_radix2(0, FFT_SIZE, twOffset * 4);
    return computeMagnitudes(heap.subarray(0, FFT_SIZE * 2), FFT_SIZE);
  };
}

// ─── FIR workload ───

export const FIR_INPUT_BYTES = FIR_SAMPLES * 4;
export const FIR_TAP_BYTES = TAP_COUNT * 4;
export const FIR_OUTPUT_SAMPLES = FIR_SAMPLES + TAP_COUNT - 1;
export const FIR_OUTPUT_BYTES = FIR_OUTPUT_SAMPLES * 4;

export function firWorkCounters(batchSize = 1): Record<string, number> {
  return {
    "items": FIR_SAMPLES * batchSize,
    "input-bytes": FIR_INPUT_BYTES * batchSize,
    "tap-bytes": FIR_TAP_BYTES * batchSize,
    "output-bytes": FIR_OUTPUT_BYTES * batchSize,
    "multiply-accumulates": FIR_SAMPLES * TAP_COUNT * batchSize,
    // Per MAC: 1 input load + 1 tap load + 1 output load + 1 output store
    "loads": FIR_SAMPLES * TAP_COUNT * 3 * batchSize,
    "stores": FIR_SAMPLES * TAP_COUNT * batchSize,
    "boundary-crossings": batchSize,
  };
}

export type FirWasmExports = {
  memory: WebAssembly.Memory;
  fir_direct: (
    inPtr: number,
    inLen: number,
    tapPtr: number,
    tapLen: number,
    outPtr: number,
  ) => void;
};

export function runFirJavaScript(): Float32Array {
  return firDirectConvolution(genFirSignal(), generateTaps());
}

export function prepareFirWasm(exports: FirWasmExports): () => Float32Array {
  const signal = genFirSignal();
  const taps = generateTaps();
  const heap = new Float32Array(exports.memory.buffer);
  const inPtr = 0;
  const tapPtr = FIR_SAMPLES;
  const outPtr = FIR_SAMPLES + TAP_COUNT;
  return () => {
    heap.set(signal, inPtr);
    heap.set(taps, tapPtr);
    // Zero output region
    for (let i = 0; i < FIR_OUTPUT_SAMPLES; i++) heap[outPtr + i] = 0;
    exports.fir_direct(inPtr * 4, FIR_SAMPLES, tapPtr * 4, TAP_COUNT, outPtr * 4);
    return new Float32Array(heap.subarray(outPtr, outPtr + FIR_OUTPUT_SAMPLES));
  };
}

// ─── STFT workload (Track B) ───

export const STFT_INPUT_BYTES = STFT_SAMPLES * 4;

export function stftWorkCounters(batchSize = 1): Record<string, number> {
  const numFrames = 1 + Math.floor((STFT_SAMPLES - FRAME_SIZE) / HOP_SIZE);
  const numBins = FRAME_SIZE / 2;
  const stages = Math.log2(FRAME_SIZE);
  const butterflies = (FRAME_SIZE / 2) * stages;
  return {
    "frames": numFrames * batchSize,
    "items": STFT_SAMPLES * batchSize,
    "input-bytes": STFT_INPUT_BYTES * batchSize,
    "output-bytes": numFrames * numBins * 4 * batchSize,
    "window-multiplies": numFrames * FRAME_SIZE * batchSize,
    "butterflies": numFrames * butterflies * batchSize,
    "boundary-crossings": batchSize,
  };
}

export function runStftJavaScript(): Float32Array {
  return stftPower(genStftSignal());
}

// ─── Input hash computation for frozen manifests ───

export async function fftInputHash(): Promise<string> {
  const signal = genFftSignal();
  const twiddle = generateTwiddleTable(FFT_SIZE);
  const combined = new Uint8Array(signal.byteLength + twiddle.byteLength);
  combined.set(new Uint8Array(signal.buffer), 0);
  combined.set(new Uint8Array(twiddle.buffer), signal.byteLength);
  return await sha256Hex(combined);
}

export async function firInputHash(): Promise<string> {
  const signal = genFirSignal();
  const taps = generateTaps();
  const combined = new Uint8Array(signal.byteLength + taps.byteLength);
  combined.set(new Uint8Array(signal.buffer), 0);
  combined.set(new Uint8Array(taps.buffer), signal.byteLength);
  return await sha256Hex(combined);
}

export async function stftInputHash(): Promise<string> {
  const signal = genStftSignal();
  return await sha256Hex(new Uint8Array(signal.buffer));
}

export async function outputHash(data: Float32Array): Promise<string> {
  return await sha256Hex(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}

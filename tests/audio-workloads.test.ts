import {
  FFT_SIZE,
  fftRadix2,
  generateSignal as genFft,
  generateTwiddleTable,
  toComplexInterleaved,
} from "../benchmarks/fft-radix2-c2c/workload.ts";
import {
  firDirectConvolution,
  generateSignal as genFir,
  generateTaps,
  TAP_COUNT,
} from "../benchmarks/fir-direct-convolution/workload.ts";
import { FRAME_SIZE, HOP_SIZE, SAMPLE_COUNT } from "../benchmarks/stft-power-spectrum/workload.ts";
import wabtFactory from "wabt";
import {
  fftInputHash,
  type FftWasmExports,
  fftWorkCounters,
  firInputHash,
  type FirWasmExports,
  firWorkCounters,
  maxRelativeError,
  outputHash,
  outputIsClean,
  prepareFftWasm,
  prepareFirWasm,
  runFftJavaScript,
  runFirJavaScript,
  runStftJavaScript,
  stftInputHash,
  stftWorkCounters,
} from "../lib/audio-workloads.ts";
import { assert } from "./assert.ts";

// ─── FFT tests ───

Deno.test("FFT: frozen input hash is deterministic", async () => {
  const h1 = await fftInputHash();
  const h2 = await fftInputHash();
  assert(h1 === h2, "input hash not deterministic");
  assert(h1.length === 64, "hash not 64 chars");
});

Deno.test("FFT: twiddle table is frozen f32 data", () => {
  const tw = generateTwiddleTable(FFT_SIZE);
  assert(tw.length > 0, "empty twiddle table");
  assert(tw[0] === 1.0, "first twiddle cos should be 1.0");
  assert(tw[1] === 0.0, "first twiddle sin should be 0.0");
});

Deno.test("FFT: forward-then-inverse round-trip", () => {
  const signal = genFft();
  const twiddle = generateTwiddleTable(FFT_SIZE);
  const complex = toComplexInterleaved(signal);
  const original = new Float32Array(complex);

  fftRadix2(complex, FFT_SIZE, twiddle); // forward

  // Inverse: conjugate, forward, conjugate, scale
  for (let i = 1; i < FFT_SIZE * 2; i += 2) complex[i] = -complex[i];
  fftRadix2(complex, FFT_SIZE, twiddle);
  for (let i = 1; i < FFT_SIZE * 2; i += 2) complex[i] = -complex[i];
  for (let i = 0; i < FFT_SIZE * 2; i++) complex[i] /= FFT_SIZE;

  let maxErr = 0;
  for (let i = 0; i < FFT_SIZE * 2; i++) {
    maxErr = Math.max(maxErr, Math.abs(complex[i] - original[i]));
  }
  assert(maxErr < 1e-4, `round-trip error ${maxErr} exceeds 1e-4`);
});

Deno.test("FFT: JS output is finite and non-trivial", () => {
  const mags = runFftJavaScript();
  assert(outputIsClean(mags), "NaN/Inf in FFT magnitudes");
  let nonzero = 0;
  for (const m of mags) if (m > 1e-6) nonzero++;
  assert(nonzero > 10, "too few non-zero magnitude bins");
});

Deno.test("FFT: work counters exact", () => {
  const c = fftWorkCounters(1);
  assert(c["butterflies"] === 5120, `expected 5120 butterflies, got ${c["butterflies"]}`);
  assert(c["bit-reversals"] === 1023, `expected 1023 bit-reversals`);
  assert(c["boundary-crossings"] === 1);
});

Deno.test("FFT WAT: compiles, runs, JS/Wasm equivalent", async () => {
  const wabt = await wabtFactory();
  const wat = await Deno.readTextFile("benchmarks/fft-radix2-c2c/fft.wat");
  const watModule = wabt.parseWat("fft.wat", wat);
  const { buffer } = watModule.toBinary({});
  watModule.destroy();

  const mod = await WebAssembly.compile(buffer as unknown as ArrayBuffer);
  const instance = new WebAssembly.Instance(mod);
  const exports = instance.exports as unknown as FftWasmExports;

  const jsMags = runFftJavaScript();
  const wasmRun = prepareFftWasm(exports);

  const wasmMags1 = wasmRun();
  const wasmMags2 = wasmRun(); // repeat-safe
  assert(outputIsClean(wasmMags1), "NaN/Inf in Wasm output");
  assert(outputIsClean(wasmMags2), "NaN/Inf in Wasm repeat output");

  // Repeat safety: both calls identical
  let repeatErr = 0;
  for (let i = 0; i < wasmMags1.length; i++) {
    repeatErr = Math.max(repeatErr, Math.abs(wasmMags1[i] - wasmMags2[i]));
  }
  assert(repeatErr === 0, `repeat error ${repeatErr} should be 0`);

  // JS/Wasm equivalence
  const err = maxRelativeError(wasmMags1, jsMags);
  assert(err < 1e-3, `JS/Wasm max relative error ${err} exceeds 1e-3`);
});

// ─── FIR tests ───

Deno.test("FIR: frozen input hash includes signal AND taps", async () => {
  const h1 = await firInputHash();
  const h2 = await firInputHash();
  assert(h1 === h2, "hash not deterministic");
  // Hash must differ from signal-only hash
  const signal = genFir();
  const { sha256Hex } = await import("../lib/canonical.ts");
  const signalOnly = await sha256Hex(new Uint8Array(signal.buffer));
  assert(h1 !== signalOnly, "FIR hash must include taps, not just signal");
});

Deno.test("FIR: taps have unity DC gain", () => {
  const taps = generateTaps();
  let sum = 0;
  for (const t of taps) sum += t;
  assert(Math.abs(sum - 1.0) < 1e-5, `DC gain ${sum} ≠ 1.0`);
});

Deno.test("FIR: output length is N+K-1", () => {
  const out = firDirectConvolution(genFir(100), generateTaps());
  assert(out.length === 100 + TAP_COUNT - 1, "wrong output length");
});

Deno.test("FIR: JS output is finite", () => {
  const out = runFirJavaScript();
  assert(outputIsClean(out), "NaN/Inf in FIR output");
});

Deno.test("FIR: work counters exact", () => {
  const c = firWorkCounters(1);
  assert(c["multiply-accumulates"] === 8192 * 256, "wrong MAC count");
});

Deno.test("FIR WAT: compiles, runs, JS/Wasm equivalent", async () => {
  const wabt = await wabtFactory();
  const wat = await Deno.readTextFile("benchmarks/fir-direct-convolution/fir.wat");
  const watModule = wabt.parseWat("fir.wat", wat);
  const { buffer } = watModule.toBinary({});
  watModule.destroy();

  const mod = await WebAssembly.compile(buffer as unknown as ArrayBuffer);
  const instance = new WebAssembly.Instance(mod);
  const exports = instance.exports as unknown as FirWasmExports;

  const jsOut = runFirJavaScript();
  const wasmRun = prepareFirWasm(exports);
  const wasmOut = wasmRun();
  assert(outputIsClean(wasmOut), "NaN/Inf in Wasm FIR output");

  const err = maxRelativeError(wasmOut, jsOut);
  assert(err < 5e-2, `JS/Wasm FIR max relative error ${err} exceeds 5e-2`);
});

// ─── STFT tests ───

Deno.test("STFT: frozen input hash is deterministic", async () => {
  const h1 = await stftInputHash();
  const h2 = await stftInputHash();
  assert(h1 === h2, "hash not deterministic");
});

Deno.test("STFT: JS output is finite power spectrum", () => {
  const spec = runStftJavaScript();
  assert(outputIsClean(spec), "NaN/Inf in STFT output");
  assert(spec.every((v) => v >= 0), "power values must be non-negative");
});

Deno.test("STFT: work counters exact", () => {
  const c = stftWorkCounters(1);
  const numFrames = 1 + Math.floor((SAMPLE_COUNT - FRAME_SIZE) / HOP_SIZE);
  assert(c["frames"] === numFrames, `expected ${numFrames} frames`);
});

// ─── Output hash freeze ───

Deno.test("FFT: output hash is deterministic", async () => {
  const mags = runFftJavaScript();
  const h1 = await outputHash(mags);
  const mags2 = runFftJavaScript();
  const h2 = await outputHash(mags2);
  assert(h1 === h2, "output hash not deterministic");
});

Deno.test("FIR: output hash is deterministic", async () => {
  const out = runFirJavaScript();
  const h1 = await outputHash(out);
  const out2 = runFirJavaScript();
  const h2 = await outputHash(out2);
  assert(h1 === h2, "output hash not deterministic");
});

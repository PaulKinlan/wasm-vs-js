import { assert } from "./assert.ts";
import {
  firDirectConvolution,
  generateSignal as genFirSignal,
  generateTaps as genFirTaps,
} from "../benchmarks/audio-fir/workload.ts";
import {
  generateSignal as genStftSignal,
  hannWindow,
  stft as stftOracle,
} from "../benchmarks/audio-stft/workload.ts";
import { generateTwiddleTable } from "../benchmarks/audio-fft/workload.ts";

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const ARTIFACTS = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;

function assertBitIdentical(label: string, got: Float32Array, ref: Float32Array): void {
  for (let i = 0; i < ref.length; i++) {
    const diff = Math.abs(got[i] - ref[i]);
    assert(
      diff < 1e-4,
      `${label} output mismatch at ${i}: got=${got[i]} ref=${ref[i]} (diff=${diff})`,
    );
  }
}

Deno.test(
  "multilang-audio: C, C++, Rust, AssemblyScript, and Dart/WasmGC FIR kernels match JS oracle",
  async () => {
    const input = genFirSignal(2048);
    const taps = genFirTaps(64);
    const ref = firDirectConvolution(input, taps);

    const linear = [
      ["fir_c.wasm", "C"],
      ["fir_cpp.wasm", "C++"],
      ["fir_rs.wasm", "Rust"],
      ["fir_asc.wasm", "AssemblyScript"],
    ] as const;

    for (const [file, label] of linear) {
      const mod = (await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        // AssemblyScript emits an env.abort import for bounds safety; a
        // correct kernel never calls it.
        { env: { abort: () => {} } },
      )) as unknown as { instance: WebAssembly.Instance };
      const mem = mod.instance.exports.memory as WebAssembly.Memory;
      const exports = mod.instance.exports as Record<string, (...args: unknown[]) => unknown>;

      const inOff = 0;
      const tapsOff = input.byteLength;
      const outOff = tapsOff + taps.byteLength;
      new Float32Array(mem.buffer, inOff, input.length).set(input);
      new Float32Array(mem.buffer, tapsOff, taps.length).set(taps);

      (exports.fir as (i: number, t: number, o: number, il: number, tl: number) => void)(
        inOff,
        tapsOff,
        outOff,
        input.length,
        taps.length,
      );
      assertBitIdentical(label, new Float32Array(mem.buffer, outOff, ref.length), ref);
    }

    // Dart
    const dartGlue = await import(`file://${ARTIFACTS}/fir_dart.mjs`);
    const dartApp = await dartGlue.compile(await Deno.readFile(`${ARTIFACTS}/fir_dart.wasm`));
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      fir: (
        input: Float32Array,
        taps: Float32Array,
        output: Float32Array,
        inputLen: number,
        tapsLen: number,
      ) => void;
    };
    assert(kernels && typeof kernels.fir === "function", "dartKernels.fir not published");

    const out = new Float32Array(ref.length);
    kernels.fir(input, taps, out, input.length, taps.length);
    assertBitIdentical("Dart FIR", out, ref);
  },
);

Deno.test(
  "multilang-audio: C, C++, Rust, AssemblyScript, and Dart/WasmGC STFT kernels match JS oracle",
  async () => {
    const input = genStftSignal(4096);
    const frameSize = 256;
    const hopSize = 64;
    const window = hannWindow(frameSize);
    const twiddle = generateTwiddleTable(frameSize);
    const ref = stftOracle(input, frameSize, hopSize);

    const linear = [
      ["stft_c.wasm", "C"],
      ["stft_cpp.wasm", "C++"],
      ["stft_rs.wasm", "Rust"],
      ["stft_asc.wasm", "AssemblyScript"],
    ] as const;

    for (const [file, label] of linear) {
      const mod = (await WebAssembly.instantiate(
        await Deno.readFile(`${ARTIFACTS}/${file}`),
        // AssemblyScript emits an env.abort import for bounds checks.
        { env: { abort: () => {} } },
      )) as unknown as { instance: WebAssembly.Instance };
      const mem = mod.instance.exports.memory as WebAssembly.Memory;
      const exports = mod.instance.exports as Record<string, (...args: unknown[]) => unknown>;

      let off = 0;
      const inOff = off;
      off += input.byteLength;
      const winOff = off;
      off += window.byteLength;
      const twOff = off;
      off += twiddle.byteLength;
      const scratchOff = off;
      off += frameSize * 2 * 4;
      const specOff = off;

      new Float32Array(mem.buffer, inOff, input.length).set(input);
      new Float32Array(mem.buffer, winOff, window.length).set(window);
      new Float32Array(mem.buffer, twOff, twiddle.length).set(twiddle);

      (exports.stft as (
        i: number,
        il: number,
        fs: number,
        hs: number,
        w: number,
        tw: number,
        sc: number,
        sp: number,
      ) => void)(
        inOff,
        input.length,
        frameSize,
        hopSize,
        winOff,
        twOff,
        scratchOff,
        specOff,
      );
      assertBitIdentical(label, new Float32Array(mem.buffer, specOff, ref.length), ref);
    }

    // Dart
    const dartGlue = await import(`file://${ARTIFACTS}/stft_dart.mjs`);
    const dartApp = await dartGlue.compile(await Deno.readFile(`${ARTIFACTS}/stft_dart.wasm`));
    const dartInst = await dartApp.instantiate({});
    dartInst.invokeMain();
    const kernels = (globalThis as Record<string, unknown>).dartKernels as {
      stft: (
        input: Float32Array,
        inputLen: number,
        frameSize: number,
        hopSize: number,
        window: Float32Array,
        twiddle: Float32Array,
        scratch: Float32Array,
        spectrogram: Float32Array,
      ) => void;
    };
    assert(kernels && typeof kernels.stft === "function", "dartKernels.stft not published");

    const scratch = new Float32Array(frameSize * 2);
    const spec = new Float32Array(ref.length);
    kernels.stft(input, input.length, frameSize, hopSize, window, twiddle, scratch, spec);
    assertBitIdentical("Dart STFT", spec, ref);
  },
);

// A benchmark compares engines only if they compute the same thing.
//
// Seventeen of the forty-one multi-language adapters ran every engine and
// verified nothing about the result: no digest, no counters, at most a status
// code. audio.fft.v1 is why that matters. Its Wasm kernels build twiddle
// factors from a four-term Taylor series in f32 (fft_kernel.c's sinf_custom);
// its JavaScript engine called Math.sin/Math.cos in f64. The four Wasm engines
// agreed with each other and JavaScript disagreed with all of them — it was
// computing a different transform, and the page reported the difference in
// cost as a language difference.
//
// This pins the agreement for the lanes that had none, at the level the
// adapters check it: identical bytes out for identical bytes in.

import { assert } from "./assert.ts";

const ROOT = new URL("../", import.meta.url).pathname;
const ARTIFACTS = `${ROOT}public/artifacts/multilang-wasm-benchmark/`;
const RUNNER = await Deno.readTextFile(`${ROOT}public/multilang-runner.js`);

function fnv1a(bytes: Uint8Array): number {
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = Math.imul(hash ^ bytes[i], 0x01000193) >>> 0;
  }
  return hash;
}

async function instantiate(file: string) {
  const { instance } = await WebAssembly.instantiate(
    await Deno.readFile(ARTIFACTS + file),
    {
      env: {
        abort: () => {
          throw new Error(`${file}: abort()`);
        },
      },
    },
  );
  return instance.exports as Record<string, CallableFunction> & {
    memory: WebAssembly.Memory;
  };
}

function grow(memory: WebAssembly.Memory, need: number): void {
  if (memory.buffer.byteLength < need) {
    memory.grow(Math.ceil((need - memory.buffer.byteLength) / 65536));
  }
}

// --- audio.fft.v1 -----------------------------------------------------------

const FFT_LEN = 512;

function fftInputs(): { real: Float32Array; imag: Float32Array } {
  const real = new Float32Array(FFT_LEN), imag = new Float32Array(FFT_LEN);
  for (let i = 0; i < FFT_LEN; i++) {
    real[i] = Math.sin(i * 0.1);
    imag[i] = Math.cos(i * 0.1);
  }
  return { real, imag };
}

/** The Taylor-series f32 sin the Wasm kernels use, mirrored exactly. */
const fr = Math.fround;
const PI = fr(3.14159265358979323846);
const HALF_PI = fr(1.57079632679489661923);
const TWO_PI = fr(2 * PI);

function sinf(x: number): number {
  while (x > PI) x = fr(x - TWO_PI);
  while (x < -PI) x = fr(x + TWO_PI);
  const x2 = fr(x * x), x3 = fr(x * x2), x5 = fr(x3 * x2), x7 = fr(x5 * x2);
  return fr(fr(fr(x - fr(x3 / fr(6))) + fr(x5 / fr(120))) - fr(x7 / fr(5040)));
}

const cosf = (x: number) => sinf(fr(x + HALF_PI));

function jsFft(real: Float32Array, imag: Float32Array): void {
  for (let step = 1; step < FFT_LEN; step <<= 1) {
    const angle = fr(-PI / fr(step));
    const wReal = cosf(angle), wImag = sinf(angle);
    for (let i = 0; i < FFT_LEN; i += step << 1) {
      let cwR = fr(1), cwI = fr(0);
      for (let j = 0; j < step; j++) {
        const u = i + j, v = i + j + step;
        const tr = fr(fr(real[v] * cwR) - fr(imag[v] * cwI));
        const ti = fr(fr(real[v] * cwI) + fr(imag[v] * cwR));
        real[v] = fr(real[u] - tr);
        imag[v] = fr(imag[u] - ti);
        real[u] = fr(real[u] + tr);
        imag[u] = fr(imag[u] + ti);
        const nwR = fr(fr(cwR * wReal) - fr(cwI * wImag));
        const nwI = fr(fr(cwR * wImag) + fr(cwI * wReal));
        cwR = nwR;
        cwI = nwI;
      }
    }
  }
}

Deno.test("audio.fft.v1: every engine computes the same spectrum", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile(`${ROOT}public/benchmarks/multilang-wasm/audio-fft.manifest.json`),
  ) as {
    engines: Array<{ key: string; kind: string; offset?: number; files?: Record<string, string> }>;
  };

  const digests = new Map<string, number>();
  for (const engine of manifest.engines) {
    if (engine.kind !== "linear") continue;
    const file = engine.files?.fft ?? `fft_${engine.key}.wasm`;
    const exports = await instantiate(file);
    const offset = engine.offset ?? 0;
    grow(exports.memory, offset + FFT_LEN * 8 + 64);
    const { real, imag } = fftInputs();
    new Float32Array(exports.memory.buffer, offset, FFT_LEN).set(real);
    new Float32Array(exports.memory.buffer, offset + FFT_LEN * 4, FFT_LEN).set(imag);
    exports.fft_butterfly(offset, offset + FFT_LEN * 4, FFT_LEN);
    digests.set(
      engine.key,
      fnv1a(new Uint8Array(exports.memory.buffer, offset, FFT_LEN * 8)),
    );
  }
  assert(digests.size >= 4, `only ${digests.size} Wasm FFT engines ran`);

  const { real, imag } = fftInputs();
  jsFft(real, imag);
  const jsBytes = new Uint8Array(FFT_LEN * 8);
  jsBytes.set(new Uint8Array(real.buffer, real.byteOffset, FFT_LEN * 4), 0);
  jsBytes.set(new Uint8Array(imag.buffer, imag.byteOffset, FFT_LEN * 4), FFT_LEN * 4);
  digests.set("js", fnv1a(jsBytes));

  const distinct = new Set(digests.values());
  assert(
    distinct.size === 1,
    `FFT engines disagree: ${[...digests].map(([k, d]) => `${k}=${d.toString(16)}`).join(" ")}`,
  );
});

Deno.test("audio.fft.v1: the JavaScript engine uses the kernels' own sin, not libm", () => {
  const at = RUNNER.indexOf('"audio.fft.v1"');
  assert(at !== -1, "fft adapter not found");
  const block = RUNNER.slice(at, at + 5000);
  assert(
    /function sinf\(/.test(block),
    "the JavaScript FFT must build twiddle factors the same way the kernels do",
  );
  assert(
    !/Math\.cos\(angle\)|Math\.sin\(angle\)/.test(block),
    "the JavaScript FFT must not take its twiddle factors from libm",
  );
});

// --- ml.gemm.v1 -------------------------------------------------------------

const M = 128, N = 128, K = 128;

function gemmInputs() {
  const a = new Float32Array(M * K), b = new Float32Array(K * N), c0 = new Float32Array(M * N);
  let s = 0x91e10da5;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return Math.fround((s / 4294967296) * 2 - 1);
  };
  for (let i = 0; i < a.length; i++) a[i] = next();
  for (let i = 0; i < b.length; i++) b[i] = next();
  for (let i = 0; i < c0.length; i++) c0[i] = next();
  return { a, b, c0 };
}

Deno.test("ml.gemm.v1: every engine computes the same product", async () => {
  const aOff = 0, bOff = M * K * 4, c0Off = (M * K + K * N) * 4;
  const outOff = (M * K + K * N + M * N) * 4;
  const digests = new Map<string, number>();

  for (const key of ["c", "cpp", "rs", "asc"]) {
    const exports = await instantiate(`gemm_${key}.wasm`);
    grow(exports.memory, outOff + M * N * 4);
    const { a, b, c0 } = gemmInputs();
    new Float32Array(exports.memory.buffer, aOff, M * K).set(a);
    new Float32Array(exports.memory.buffer, bOff, K * N).set(b);
    new Float32Array(exports.memory.buffer, c0Off, M * N).set(c0);
    exports.gemm(aOff, bOff, c0Off, outOff, M, N, K);
    digests.set(key, fnv1a(new Uint8Array(exports.memory.buffer, outOff, M * N * 4)));
  }

  const { a, b, c0 } = gemmInputs();
  const out = new Float32Array(M * N);
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < N; j++) {
      let acc = c0[i * N + j];
      for (let t = 0; t < K; t++) acc = fr(acc + fr(a[i * K + t] * b[t * N + j]));
      out[i * N + j] = acc + 0;
    }
  }
  digests.set("js", fnv1a(new Uint8Array(out.buffer, out.byteOffset, out.byteLength)));

  const distinct = new Set(digests.values());
  assert(
    distinct.size === 1,
    `GEMM engines disagree: ${[...digests].map(([k, d]) => `${k}=${d.toString(16)}`).join(" ")}`,
  );
});

// --- the guard itself -------------------------------------------------------

Deno.test("requireEngineAgreement refuses a comparison whose engines differ", async () => {
  const { requireEngineAgreement } = await import(
    `${ROOT}public/multilang-runner.js`
  ) as { requireEngineAgreement: (l: string, p: Record<string, () => number>) => number };

  const agreed = requireEngineAgreement("t", { a: () => 7, b: () => 7 });
  assert(agreed === 7, `agreed digest was ${agreed}`);

  let threw = "";
  try {
    requireEngineAgreement("t", { a: () => 7, b: () => 8 });
  } catch (error) {
    threw = (error as Error).message;
  }
  assert(/disagree/.test(threw), `disagreement was not refused: ${threw}`);
});

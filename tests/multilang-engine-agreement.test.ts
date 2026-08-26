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
  const at = RUNNER.indexOf('"audio.fft.v1": {');
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

// --- audio.stft.v1 ----------------------------------------------------------

Deno.test("audio.stft.v1: the JavaScript engine walks the twiddle table per stage", () => {
  const at = RUNNER.indexOf('"audio.stft.v1": {');
  assert(at !== -1, "stft adapter not found");
  const block = RUNNER.slice(at, at + 8000);
  // The table is stage-structured: stage s holds 2^s pairs, so the next stage
  // begins halfLen*2 entries along. Advancing by 2 made every stage after the
  // first read twiddles belonging to an earlier stage — a different transform,
  // not a rounding difference.
  assert(
    /twIdx \+= halfLen \* 2;/.test(block),
    "the JavaScript STFT must advance the twiddle index by the stage's width",
  );
  assert(
    !/twIdx \+= 2;/.test(block),
    "the JavaScript STFT must not advance the twiddle index by one pair per stage",
  );
  assert(
    /const tr = fr\(/.test(block),
    "the JavaScript STFT butterfly must round at every operation, as the kernels do",
  );
});

Deno.test("every adapter that compares engines states the comparison", () => {
  // Each lane fixed in this sweep must call the guard. The check is on the
  // adapter text because the alternative — running the browser harness here —
  // is what the browser gate already does.
  for (const id of ["audio.fft.v1", "audio.fir.v1", "audio.stft.v1", "ml.gemm.v1"]) {
    // Anchored on the adapter form: the module's header comment quotes
    // "ml.gemm.v1" as an example manifest, and a bare id match found that.
    const at = RUNNER.indexOf(`"${id}": {`);
    assert(at !== -1, `${id} adapter not found`);
    const block = RUNNER.slice(at, at + 12000);
    assert(
      block.includes(`requireEngineAgreement("${id}"`),
      `${id} must require its engines to agree before any of them is timed`,
    );
  }
});

// --- ml.numeric-kernels.v1 --------------------------------------------------

Deno.test("ml.numeric-kernels.v1: every engine runs all six kernels", () => {
  const at = RUNNER.indexOf('"ml.numeric-kernels.v1": {');
  assert(at !== -1, "numeric-kernels adapter not found");
  const block = RUNNER.slice(at, at + 9000);

  // The Wasm engines ran GEMM, Conv and Softmax in both f32 and i8; the
  // JavaScript and Dart callables ran only the three f32 kernels. C++ and Rust
  // were doing roughly twice the work and being reported as slower for it.
  for (const kernel of ["gemmI8", "convI8", "softmaxI8"]) {
    assert(
      block.includes(`k.${kernel}(`),
      `the Dart engine must run ${kernel}, not only the f32 kernels`,
    );
  }
  assert(
    /runAll\(generateFixtures\(\)\)/.test(block),
    "the JavaScript engine must run all six kernels through the workload module",
  );
  // The f32 kernels return non-zero when they reject an input and write
  // nothing; discarding that let a rejecting engine time as the fastest.
  assert(
    /rejected its input/.test(block),
    "a non-zero kernel status must fail rather than be timed",
  );
  assert(
    block.includes('requireEngineAgreement("ml.numeric-kernels.v1"'),
    "ml.numeric-kernels.v1 must require its engines to agree",
  );
});

Deno.test("ml.numeric-kernels.v1: the six kernels agree across engines", async () => {
  const workload = await import(
    `${ROOT}benchmarks/base/ml-numeric-kernels/workload.js`
  ) as {
    generateFixtures: () => Record<string, Float32Array | Int8Array>;
    runAll: (f: Record<string, Float32Array | Int8Array>) => Record<string, ArrayBufferView>;
  };
  const fixtures = workload.generateFixtures();
  const reference = workload.runAll(fixtures);
  const order = ["gemmF32", "gemmI8", "convF32", "convI8", "softmaxF32", "softmaxI8"];

  const digest = (views: ArrayBufferView[]) => {
    let total = 0;
    for (const v of views) total += v.byteLength;
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const v of views) {
      bytes.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), offset);
      offset += v.byteLength;
    }
    return fnv1a(bytes);
  };
  const expected = digest(order.map((k) => reference[k]));

  for (const key of ["cpp", "rs"]) {
    const exports = await instantiate(`numeric_kernels_${key}.wasm`);
    grow(exports.memory, 65536);
    const inA = 0, inB = 1024, inW = 2048, out = 8192;
    const views: ArrayBufferView[] = [];
    const fx = fixtures as Record<string, Float32Array & Int8Array>;

    new Float32Array(exports.memory.buffer, inA, 72).set(fx.gemmF32A);
    new Float32Array(exports.memory.buffer, inB, 63).set(fx.gemmF32B);
    assert(Number(exports.gemm_f32(inA, inB, out)) === 0, `${key}: gemm_f32 rejected its input`);
    views.push(new Float32Array(exports.memory.buffer, out, 56).slice());
    new Int8Array(exports.memory.buffer, inA, 72).set(fx.gemmI8A);
    new Int8Array(exports.memory.buffer, inB, 63).set(fx.gemmI8B);
    exports.gemm_i8(inA, inB, out);
    views.push(new Int32Array(exports.memory.buffer, out, 56).slice());
    new Float32Array(exports.memory.buffer, inA, 192).set(fx.convF32Input);
    new Float32Array(exports.memory.buffer, inW, 108).set(fx.convF32Weights);
    assert(Number(exports.conv_f32(inA, inW, out)) === 0, `${key}: conv_f32 rejected its input`);
    views.push(new Float32Array(exports.memory.buffer, out, 256).slice());
    new Int8Array(exports.memory.buffer, inA, 192).set(fx.convI8Input);
    new Int8Array(exports.memory.buffer, inW, 108).set(fx.convI8Weights);
    exports.conv_i8(inA, inW, out);
    views.push(new Int32Array(exports.memory.buffer, out, 256).slice());
    new Float32Array(exports.memory.buffer, inA, 128).set(fx.softmaxF32Input);
    assert(
      Number(exports.softmax_f32(inA, out)) === 0,
      `${key}: softmax_f32 rejected its input`,
    );
    views.push(new Float32Array(exports.memory.buffer, out, 128).slice());
    new Int8Array(exports.memory.buffer, inA, 128).set(fx.softmaxI8Input);
    exports.softmax_i8(inA, out);
    views.push(new Uint8Array(exports.memory.buffer, out, 128).slice());

    assert(
      digest(views) === expected,
      `${key} disagrees with the workload module across the six kernels`,
    );
  }
});

// --- text.diff-patch.v1 -----------------------------------------------------

Deno.test("text.diff-patch.v1: the Rust engine's memory is smaller than the layout", async () => {
  // Not a regression test for a fix in the kernel — a statement of why the
  // adapter grows memory. The Myers scratch band is ~8.7 MB at these input
  // sizes; the Rust module ships 17 pages against a layout needing 133, so its
  // engine trapped on every run and had never produced a diff on this page.
  // If a future build ships a larger initial memory this test starts failing
  // and the growth can be reconsidered.
  const LEN = 512, EDITS = 30;
  let state = 0xd1ff2026;
  const rnd = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const target: number[] = [];
  for (let i = 0; i < LEN; i++) target.push(i);
  for (let e = 0; e < EDITS; e++) {
    const pos = Math.floor(rnd() * (target.length + 1));
    if (rnd() < 0.5) target.splice(pos, 0, 0xffff0000 + e);
    else if (target.length > 0) target.splice(Math.min(pos, target.length - 1), 1);
  }
  const max = LEN + target.length;
  const vstride = 2 * max + 1;
  const cap = LEN + target.length + 1;
  const need = 8192 + vstride * (max + 2) * 4 + cap * 12 + 8;

  const exports = await instantiate("myers_diff_rs.wasm");
  assert(
    exports.memory.buffer.byteLength < need,
    `the Rust module now ships ${exports.memory.buffer.byteLength} bytes, ` +
      `at or above the ${need} the layout needs — revisit the adapter's grow()`,
  );

  const at = RUNNER.indexOf('"text.diff-patch.v1": {');
  assert(at !== -1, "diff-patch adapter not found");
  const block = RUNNER.slice(at, at + 16000);
  assert(
    /mem\.grow\(/.test(block),
    "the adapter must grow each module's memory to fit the layout it chose",
  );
  assert(
    /produced \$\{count\} edit operations/.test(block),
    "an engine that writes no edit operations must fail rather than be timed",
  );
  assert(
    block.includes('requireEngineAgreement("text.diff-patch.v1"'),
    "text.diff-patch.v1 must require its engines to agree",
  );
});

// --- text.regex-log-scan.v1 -------------------------------------------------

Deno.test("text.regex-log-scan.v1: the corpus must sit above every kernel's tables", async () => {
  // At the original 4096 the corpus landed on the C and C++ pattern tables:
  // both scanned a destroyed table and returned zero matches, with 10,569
  // prefix comparisons and no tail comparisons against the 24,424 and 1,330
  // the work actually takes — and were timed and reported as fast engines.
  // Rust keeps its tables near 1 MB, so it survived 4096 and is destroyed at
  // 1 MB instead. This holds the offset that clears all three, and states the
  // failure it prevents.
  const CAP = 5000;
  const corpus = buildRegexCorpus();

  const scan = async (file: string, dataOff: number) => {
    const exports = await instantiate(file);
    const scratchOff = 2097152;
    const idOff = scratchOff + 256 * 5 * 4;
    const stOff = idOff + CAP * 4, enOff = stOff + CAP * 4;
    const csOff = enOff + CAP * 4, pcOff = csOff + 4, tcOff = pcOff + 4;
    grow(exports.memory, Math.max(tcOff + 4, dataOff + corpus.length));
    new Uint8Array(exports.memory.buffer, dataOff, corpus.length).set(corpus);
    const count = Number(
      exports.scan_log(
        dataOff,
        corpus.length,
        idOff,
        stOff,
        enOff,
        CAP,
        scratchOff,
        csOff,
        pcOff,
        tcOff,
      ),
    );
    return count;
  };

  for (const engine of ["c", "cpp", "rs"]) {
    assert(
      await scan(`scan_log_${engine}.wasm`, 4194304) === 64,
      `${engine} does not find the 64 matches at the adapter's input base`,
    );
  }
  // The specific engines known to be destroyed by the original placement. If a
  // future build changes their data layout this starts failing for the right
  // reason rather than passing for the wrong one.
  for (const engine of ["c", "cpp"]) {
    assert(
      await scan(`scan_log_${engine}.wasm`, 4096) === 0,
      `${engine} at offset 4096 no longer returns 0 — revisit the adapter's dataOff comment`,
    );
  }

  const at = RUNNER.indexOf('"text.regex-log-scan.v1": {');
  assert(at !== -1, "regex-log-scan adapter not found");
  const block = RUNNER.slice(at, at + 16000);
  assert(
    /const dataOff = 4194304/.test(block),
    "the corpus must be placed above every kernel's static data",
  );
  // The JavaScript engine found matches and discarded them: it never wrote the
  // id/start/end arrays or counted a comparison, so it did the scan without
  // the bookkeeping it was compared against and produced nothing checkable.
  assert(
    /outId\[count\] = pi;/.test(block),
    "the JavaScript engine must record its matches, as the kernels do",
  );
  assert(
    /prefixComparisons\+\+/.test(block) && /tailComparisons\+\+/.test(block),
    "the JavaScript engine must count comparisons, as the kernels do",
  );
  assert(
    block.includes('requireEngineAgreement("text.regex-log-scan.v1"'),
    "text.regex-log-scan.v1 must require its engines to agree",
  );
});

/** The adapter's frozen 640-record corpus, rebuilt from its own source. */
function buildRegexCorpus(): Uint8Array {
  const at = RUNNER.indexOf('"text.regex-log-scan.v1": {');
  const source = RUNNER.slice(at, RUNNER.indexOf("const callables = {};", at));
  const body = source.slice(source.indexOf("function corpus()"));
  const PREFIXES = [
    "http://",
    "https://",
    "ws://",
    "wss://",
    "ftp://",
    "asset://",
    "api://",
    "cdn://",
    "ip=",
    "client-ip:",
    "source-ip:",
    "dest-ip:",
    "peer-ip:",
    "origin-ip:",
    "status=",
    "code=",
    "http-status:",
    "response-status:",
    "result-status:",
    "status-code:",
  ];
  const MATCHERS = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3];
  const make = new Function(
    "PREFIXES",
    "MATCHERS",
    "RECORDS",
    "EVENT_INTERVAL",
    `${body}; return corpus;`,
  ) as (p: string[], m: number[], r: number, e: number) => () => Uint8Array;
  return make(PREFIXES, MATCHERS, 640, 10)();
}

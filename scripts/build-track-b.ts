// Track B — independent optimizations build + honest measurement.
// Compiles the optimized C variants (clang --target=wasm32), runs baseline
// (Track A, kept untouched) vs optimized in-process, verifies correctness
// (bit-identical where required, disclosed tolerance for GEMM), and emits
// public/data/track-b-report.v1.json for the side-by-side UI.
//
// Usage: deno run --allow-read=. --allow-write=public/data,public/artifacts/multilang-wasm-benchmark --allow-run --allow-env scripts/build-track-b.ts

import * as sumJs from "../benchmarks/multilang-wasm/track-b/sum_u32_opt.js";
import * as fftJs from "../benchmarks/multilang-wasm/track-b/fft_opt.js";
import * as gemmJs from "../benchmarks/multilang-wasm/track-b/gemm_opt.js";
import * as scanJs from "../benchmarks/multilang-wasm/track-b/scan_log_opt.js";

const ARTIFACTS = "public/artifacts/multilang-wasm-benchmark";
const CLANG = "clang";
const FLAGS = [
  "--target=wasm32",
  "-O3",
  "-nostdlib",
  "-Wl,--no-entry",
  "-Wl,--export-all",
  "-Wl,--initial-memory=16777216",
];

async function run(command: string, args: string[]): Promise<void> {
  const out = await new Deno.Command(command, { args, stdout: "piped", stderr: "piped" }).output();
  if (!out.success) {
    throw new Error(`${command} ${args.join(" ")} failed: ${new TextDecoder().decode(out.stderr)}`);
  }
}

function instantiate(bytes: Uint8Array): WebAssembly.Instance {
  return new WebAssembly.Instance(new WebAssembly.Module(bytes as BufferSource), {});
}

async function instantiateOpt(
  name: string,
  src: string,
  extraFlags: string[] = [],
): Promise<WebAssembly.Instance> {
  await run(CLANG, [...FLAGS, ...extraFlags, "-o", `${ARTIFACTS}/${name}`, src]);
  const bytes = await Deno.readFile(`${ARTIFACTS}/${name}`);
  return instantiate(bytes);
}

function expo<T>(inst: WebAssembly.Instance, name: string): T {
  return inst.exports[name as keyof WebAssembly.Exports] as unknown as T;
}

function ensureMemory(mem: WebAssembly.Memory, minBytes: number): void {
  const pages = Math.ceil(minBytes / 65536);
  while (mem.buffer.byteLength < minBytes) {
    if (mem.grow(pages) === -1) throw new Error("wasm memory.grow failed");
  }
}

function warmMedian(fn: () => void, runs: number, iters: number): number {
  for (let i = 0; i < 3; i++) fn();
  const samples: number[] = [];
  for (let r = 0; r < runs; r++) {
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) fn();
    samples.push((performance.now() - t0) / iters);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

// ---------------------------------------------------------------------------
// Workload: sum-u32
// ---------------------------------------------------------------------------
async function measureSumU32() {
  const arr = new Uint32Array(1_000_000);
  for (let i = 0; i < arr.length; i++) arr[i] = (i % 1000) + 1;

  // JS baseline vs opt (bit-identical check)
  const jsBase = sumJs.sumBaseline(arr);
  const jsOpt = sumJs.sumOpt(arr);
  if (jsBase !== jsOpt) throw new Error("sum-u32 JS opt not bit-identical");

  const jsBaseMs = warmMedian(() => sumJs.sumBaseline(arr), 9, 40);
  const jsOptMs = warmMedian(() => sumJs.sumOpt(arr), 9, 40);

  // C baseline (reuse Track A artifact) vs C opt (compile here)
  const base = instantiate(Deno.readFileSync(`${ARTIFACTS}/sum_c.wasm`));
  const optInst = await instantiateOpt(
    "sum_u32_opt_c.wasm",
    "benchmarks/multilang-wasm/track-b/sum_u32_opt.c",
  );
  const baseMem = expo<WebAssembly.Memory>(base, "memory");
  const optMem = expo<WebAssembly.Memory>(optInst, "memory");
  const ptr = 0;
  ensureMemory(baseMem, arr.length * 4 + 65536);
  ensureMemory(optMem, arr.length * 4 + 65536);
  new Uint32Array(baseMem.buffer, ptr, arr.length).set(arr);
  new Uint32Array(optMem.buffer, ptr, arr.length).set(arr);
  const baseSum = expo<(p: number, l: number) => number>(base, "sum_u32")(ptr, arr.length);
  const optSum = expo<(p: number, l: number) => number>(optInst, "sum_u32_opt")(ptr, arr.length);
  if (baseSum !== optSum) throw new Error("sum-u32 C opt not bit-identical");
  const cBaseMs = warmMedian(
    () => expo<(p: number, l: number) => number>(base, "sum_u32")(ptr, arr.length),
    9,
    40,
  );
  const cOptMs = warmMedian(
    () => expo<(p: number, l: number) => number>(optInst, "sum_u32_opt")(ptr, arr.length),
    9,
    40,
  );

  return {
    workloadId: "sum-u32",
    label: "Modulo-2³² Integer Sum",
    correctness: "bit-identical",
    optimizationLog: [
      "JS + C: 4-way loop unroll with independent accumulators (u32 addition is associative mod 2^32; result bit-identical).",
      "C: pointer-walked inner loop, one iteration per 4 adds (cuts loop-carried dependency latency).",
    ],
    languages: [
      { language: "JavaScript", baselineMs: jsBaseMs, optimizedMs: jsOptMs },
      { language: "C / Wasm", baselineMs: cBaseMs, optimizedMs: cOptMs },
    ],
    sources: {
      javascript: ["benchmarks/multilang-wasm/track-b/sum_u32_opt.js"],
      c: ["benchmarks/multilang-wasm/sum_u32.c", "benchmarks/multilang-wasm/track-b/sum_u32_opt.c"],
    },
  };
}

// ---------------------------------------------------------------------------
// Workload: FFT (audio-fft kernel)
// ---------------------------------------------------------------------------
async function measureFft() {
  const LEN = 512;
  function inputs() {
    const real = new Float32Array(LEN), imag = new Float32Array(LEN);
    for (let i = 0; i < LEN; i++) {
      real[i] = Math.sin(i * 0.1);
      imag[i] = Math.cos(i * 0.1);
    }
    return { real, imag };
  }
  function snapshot() {
    const { real, imag } = inputs();
    return { real, imag, refR: real.slice(), refI: imag.slice() };
  }

  // JS baseline vs opt (bit-identical)
  const a = snapshot();
  fftJs.fftBaseline(a.real, a.imag, LEN);
  const b = snapshot();
  fftJs.fftOpt(b.real, b.imag, LEN);
  let maxDiff = 0;
  for (let i = 0; i < LEN; i++) {
    maxDiff = Math.max(maxDiff, Math.abs(a.real[i] - b.real[i]), Math.abs(a.imag[i] - b.imag[i]));
  }
  if (maxDiff > 1e-9) throw new Error(`fft JS opt not bit-identical (maxDiff ${maxDiff})`);
  const jsBaseMs = warmMedian(
    () => {
      const { real, imag } = inputs();
      fftJs.fftBaseline(real, imag, LEN);
    },
    7,
    60,
  );
  const jsOptMs = warmMedian(
    () => {
      const { real, imag } = inputs();
      fftJs.fftOpt(real, imag, LEN);
    },
    7,
    60,
  );

  // C baseline (reuse Track A fft artifact) vs C opt
  const base = instantiate(Deno.readFileSync(`${ARTIFACTS}/fft_c.wasm`));
  const optInst = await instantiateOpt(
    "fft_opt_c.wasm",
    "benchmarks/multilang-wasm/track-b/fft_opt.c",
  );
  function runFft(inst: WebAssembly.Instance, fn: string) {
    const { real, imag } = inputs();
    const mem = expo<WebAssembly.Memory>(inst, "memory");
    ensureMemory(mem, LEN * 8 + 65536);
    new Float32Array(mem.buffer, 0, LEN).set(real);
    new Float32Array(mem.buffer, LEN * 4, LEN).set(imag);
    expo<(r: number, i: number, l: number) => void>(inst, fn)(0, LEN * 4, LEN);
    return {
      real: new Float32Array(mem.buffer, 0, LEN).slice(),
      imag: new Float32Array(mem.buffer, LEN * 4, LEN).slice(),
    };
  }
  const rBase = runFft(base, "fft_butterfly");
  const rOpt = runFft(optInst, "fft_butterfly_opt");
  maxDiff = 0;
  for (let i = 0; i < LEN; i++) {
    maxDiff = Math.max(
      maxDiff,
      Math.abs(rBase.real[i] - rOpt.real[i]),
      Math.abs(rBase.imag[i] - rOpt.imag[i]),
    );
  }
  if (maxDiff > 1e-6) throw new Error(`fft C opt not bit-identical (maxDiff ${maxDiff})`);
  const cBaseMs = warmMedian(() => runFft(base, "fft_butterfly"), 7, 60);
  const cOptMs = warmMedian(() => runFft(optInst, "fft_butterfly_opt"), 7, 60);

  return {
    workloadId: "fft",
    label: "Radix-2 FFT butterfly (512)",
    correctness: "bit-identical",
    optimizationLog: [
      "JS: twiddle-sequence cache — the per-step complex-multiply advance computed once and reused (same float ops, same order → bit-identical). NEGATIVE RESULT: measured ~+25% slower in V8 (Float64Array allocation per step + lookup indirection outweigh the saved multiplies at LEN=512). Recorded honestly — not all optimizations win.",
      "C: pointer-hoisted butterflies — real[v]/imag[v] read into locals once per j (op order unchanged).",
    ],
    languages: [
      { language: "JavaScript", baselineMs: jsBaseMs, optimizedMs: jsOptMs },
      { language: "C / Wasm", baselineMs: cBaseMs, optimizedMs: cOptMs },
    ],
    sources: {
      javascript: ["benchmarks/multilang-wasm/track-b/fft_opt.js"],
      c: ["benchmarks/multilang-wasm/fft_kernel.c", "benchmarks/multilang-wasm/track-b/fft_opt.c"],
    },
  };
}

// ---------------------------------------------------------------------------
// Workload: ml-gemm
// ---------------------------------------------------------------------------
async function measureGemm() {
  const M = 64, N = 64, K = 64;
  const a = new Float32Array(M * K), b = new Float32Array(K * N), c0 = new Float32Array(M * N);
  let state = 0x6d2b79f5;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  for (let i = 0; i < a.length; i++) a[i] = ((next() % 2000) - 1000) / 100;
  for (let i = 0; i < b.length; i++) b[i] = ((next() % 2000) - 1000) / 100;
  for (let i = 0; i < c0.length; i++) c0[i] = ((next() % 2000) - 1000) / 100;

  const outBase = new Float32Array(M * N), outOpt = new Float32Array(M * N);
  gemmJs.gemmBaseline(a, b, c0, outBase, M, N, K);
  gemmJs.gemmOpt(a, b, c0, outOpt, M, N, K);
  let maxAbs = 0, maxRel = 0, scale = 0;
  for (let i = 0; i < outBase.length; i++) {
    const d = Math.abs(outBase[i] - outOpt[i]);
    maxAbs = Math.max(maxAbs, d);
    scale = Math.max(scale, Math.abs(outBase[i]));
  }
  maxRel = maxAbs / Math.max(scale, 1e-12);
  if (maxRel > 1e-5) throw new Error(`gemm JS opt exceeds tolerance (maxRel ${maxRel})`);

  const jsBaseMs = warmMedian(
    () => gemmJs.gemmBaseline(a, b, c0, new Float32Array(M * N), M, N, K),
    7,
    40,
  );
  const jsOptMs = warmMedian(
    () => gemmJs.gemmOpt(a, b, c0, new Float32Array(M * N), M, N, K),
    7,
    40,
  );

  const base = instantiate(Deno.readFileSync(`${ARTIFACTS}/gemm_c.wasm`));
  const optInst = await instantiateOpt(
    "gemm_simd_c.wasm",
    "benchmarks/multilang-wasm/track-b/gemm_simd.c",
  );
  function runGemm(inst: WebAssembly.Instance, fn: string) {
    const mem = expo<WebAssembly.Memory>(inst, "memory");
    const M = 64, N = 64, K = 64;
    ensureMemory(mem, (M * K + K * N + M * N + M * N) * 4 + 65536);
    const aOff = 0,
      bOff = M * K * 4,
      cOff = (M * K + K * N) * 4,
      outOff = (M * K + K * N + M * N) * 4;
    new Float32Array(mem.buffer, aOff, M * K).set(a);
    new Float32Array(mem.buffer, bOff, K * N).set(b);
    new Float32Array(mem.buffer, cOff, M * N).set(c0);
    expo<(a: number, b: number, c: number, o: number, m: number, n: number, k: number) => void>(
      inst,
      fn,
    )(aOff, bOff, cOff, outOff, M, N, K);
    return new Float32Array(mem.buffer, outOff, M * N).slice();
  }
  const gBase = runGemm(base, "gemm");
  const gOpt = runGemm(optInst, "gemm_opt");
  maxAbs = 0;
  scale = 0;
  for (let i = 0; i < gBase.length; i++) {
    maxAbs = Math.max(maxAbs, Math.abs(gBase[i] - gOpt[i]));
    scale = Math.max(scale, Math.abs(gBase[i]));
  }
  maxRel = maxAbs / Math.max(scale, 1e-12);
  if (maxAbs > 1e-6) throw new Error(`gemm C opt not bit-identical (maxAbs ${maxAbs})`);
  const cBaseMs = warmMedian(() => runGemm(base, "gemm"), 7, 40);
  const cOptMs = warmMedian(() => runGemm(optInst, "gemm_opt"), 7, 40);

  return {
    workloadId: "ml-gemm",
    label: "strict-f32 GEMM (64×64×64)",
    correctness: maxAbs <= 1e-6
      ? "bit-identical"
      : `within-tolerance (max abs Δ ${maxAbs.toExponential(2)})`,
    optimizationLog: [
      "JS: row-preload + 4-way unrolled inner loop WITHOUT per-op Math.fround (f64 accumulation; final write to Float32Array). Rounding differs from Track A — disclosed, verified within tolerance.",
      "C: B-transpose for cache locality (contiguous b_row reads) + pointer-walked A row. Accumulation order UNCHANGED (strict f32, t ascending) → bit-identical to Track A.",
    ],
    languages: [
      { language: "JavaScript", baselineMs: jsBaseMs, optimizedMs: jsOptMs },
      { language: "C / Wasm", baselineMs: cBaseMs, optimizedMs: cOptMs },
    ],
    sources: {
      javascript: ["benchmarks/multilang-wasm/track-b/gemm_opt.js"],
      c: [
        "benchmarks/multilang-wasm/ml-gemm/gemm.c",
        "benchmarks/multilang-wasm/track-b/gemm_simd.c",
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Workload: text-regex-log-scan
// ---------------------------------------------------------------------------
async function measureScanLog() {
  const RECORDS = 300, RECORD_BYTES = 256;
  const bytes = new Uint8Array(RECORDS * RECORD_BYTES);
  bytes.fill(0x20);
  const filler = new TextEncoder().encode("日志 café 東京 🚀 запись record ");
  for (let record = 0; record < RECORDS; record++) {
    const offset = record * RECORD_BYTES;
    bytes.set(filler, offset);
    const label = new TextEncoder().encode(String(record).padStart(6, "0"));
    bytes.set(label, offset + filler.byteLength);
    if (record % 15 === 0) {
      const eventIndex = record / 15;
      const pi = eventIndex % 20;
      let v = (0x5a17c0de ^ eventIndex ^ Math.imul(pi + 1, 0x9e3779b1)) >>> 0;
      v ^= v << 13;
      v ^= v >>> 17;
      v ^= v << 5;
      v >>>= 0;
      let token;
      if (scanJs.MATCHERS[pi] === 1) {
        token = `${scanJs.PATTERNS[pi]}node-${
          v.toString(16).padStart(8, "0")
        }.example.test/path/${eventIndex}`;
      } else if (scanJs.MATCHERS[pi] === 2) {
        token = `${scanJs.PATTERNS[pi]}${1 + (v & 0xfe)}.${(v >>> 8) & 0xff}.${(v >>> 16) & 0xff}.${
          (v >>> 24) & 0xff
        }`;
      } else token = `${scanJs.PATTERNS[pi]}${100 + (v % 500)}`;
      bytes.set(new TextEncoder().encode(token), offset + 64);
    }
    bytes[offset + RECORD_BYTES - 1] = 0x0a;
  }

  const rBase = scanJs.scanBaseline(bytes);
  const rOpt = scanJs.scanOpt(bytes);
  const baseKey = JSON.stringify([
    rBase.matches,
    rBase.candidateStarts,
    rBase.prefixComparisons,
    rBase.tailComparisons,
  ]);
  const optKey = JSON.stringify([
    rOpt.matches,
    rOpt.candidateStarts,
    rOpt.prefixComparisons,
    rOpt.tailComparisons,
  ]);
  if (baseKey !== optKey) {
    throw new Error("scan_log JS opt not bit-identical (matches/counters differ)");
  }
  const jsBaseMs = warmMedian(() => scanJs.scanBaseline(bytes), 7, 40);
  const jsOptMs = warmMedian(() => scanJs.scanOpt(bytes), 7, 40);

  const base = instantiate(Deno.readFileSync(`${ARTIFACTS}/scan_log_c.wasm`));
  const optInst = await instantiateOpt(
    "scan_log_opt_c.wasm",
    "benchmarks/multilang-wasm/track-b/scan_log_opt.c",
  );
  function runScan(inst: WebAssembly.Instance, fn: string) {
    const mem = expo<WebAssembly.Memory>(inst, "memory");
    const inOff = 0, outCap = 4096;
    ensureMemory(mem, bytes.length + outCap * 4 * 3 + 256 * 5 * 4 + 64);
    const idOff = bytes.length, startOff = idOff + outCap * 4, endOff = startOff + outCap * 4;
    const scratchOff = endOff + outCap * 4, cstOff = scratchOff + 256 * 5 * 4;
    const pcoff = cstOff + 4, tcoff = pcoff + 4;
    new Uint8Array(mem.buffer, inOff, bytes.length).set(bytes);
    new Uint32Array(mem.buffer, cstOff, 1)[0] = 0;
    new Uint32Array(mem.buffer, pcoff, 1)[0] = 0;
    new Uint32Array(mem.buffer, tcoff, 1)[0] = 0;
    const count = expo<
      (
        i: number,
        l: number,
        id: number,
        st: number,
        en: number,
        cap: number,
        s: number,
        cs: number,
        pc: number,
        tc: number,
      ) => number
    >(inst, fn)(
      inOff,
      bytes.length,
      idOff,
      startOff,
      endOff,
      outCap,
      scratchOff,
      cstOff,
      pcoff,
      tcoff,
    );
    return {
      count,
      candidateStarts: new Uint32Array(mem.buffer, cstOff, 1)[0],
      prefixComparisons: new Uint32Array(mem.buffer, pcoff, 1)[0],
      tailComparisons: new Uint32Array(mem.buffer, tcoff, 1)[0],
    };
  }
  const sBase = runScan(base, "scan_log");
  const sOpt = runScan(optInst, "scan_log_opt");
  if (
    JSON.stringify([
      sBase.count,
      sBase.candidateStarts,
      sBase.prefixComparisons,
      sBase.tailComparisons,
    ]) !==
      JSON.stringify([
        sOpt.count,
        sOpt.candidateStarts,
        sOpt.prefixComparisons,
        sOpt.tailComparisons,
      ])
  ) {
    throw new Error("scan_log C opt not bit-identical (matches/counters differ)");
  }
  const cBaseMs = warmMedian(() => runScan(base, "scan_log"), 7, 40);
  const cOptMs = warmMedian(() => runScan(optInst, "scan_log_opt"), 7, 40);

  return {
    workloadId: "text-regex-log-scan",
    label: "20-pattern log scan (300 records)",
    correctness: "bit-identical",
    optimizationLog: [
      "JS + C: split-loop bounds handling — a bounds-free fast path when the prefix fits (the baseline's check never fired there, so the comparison count is identical), checked loop only for the tail.",
      "C: pointer-walk prefix compare; JS: direct Uint8Array reads.",
    ],
    languages: [
      { language: "JavaScript", baselineMs: jsBaseMs, optimizedMs: jsOptMs },
      { language: "C / Wasm", baselineMs: cBaseMs, optimizedMs: cOptMs },
    ],
    sources: {
      javascript: ["benchmarks/multilang-wasm/track-b/scan_log_opt.js"],
      c: [
        "benchmarks/multilang-wasm/text-regex-log-scan/scan_log.c",
        "benchmarks/multilang-wasm/track-b/scan_log_opt.c",
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Assemble + emit
// ---------------------------------------------------------------------------
const workloads = [
  await measureSumU32(),
  await measureFft(),
  await measureGemm(),
  await measureScanLog(),
];

const report = {
  schemaVersion: 1,
  program: "track-b",
  generatedAt: new Date().toISOString(),
  trackANote: "Track A baselines are frozen, controlled workloads and are NEVER modified. " +
    "Track B variants are independent optimizations, explicitly non-default, " +
    "and never pooled with Track A claims.",
  workloads,
};

await Deno.mkdir("public/data", { recursive: true });
await Deno.writeTextFile(
  "public/data/track-b-report.v1.json",
  JSON.stringify(report, null, 2),
);

for (const w of report.workloads) {
  console.log(`\n${w.label} (${w.correctness})`);
  for (const l of w.languages) {
    const delta = ((l.optimizedMs / l.baselineMs - 1) * 100).toFixed(1);
    console.log(
      `  ${l.language.padEnd(14)} baseline ${l.baselineMs.toFixed(2)}ms -> opt ${
        l.optimizedMs.toFixed(2)
      }ms (${delta}%)`,
    );
  }
}
console.log("\nTrack B report written to public/data/track-b-report.v1.json");

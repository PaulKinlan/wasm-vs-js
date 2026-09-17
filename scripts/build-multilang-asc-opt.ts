// scripts/build-multilang-asc-opt.ts
//
// Track B lane: cache-blocking and loop-order optimizations of the ml.gemm.v1
// AssemblyScript kernel, measured against the committed Track A baseline.
//
// Why AssemblyScript and not C
// ----------------------------
// Cache blocking is the optimization this suite most wanted to show, and C is
// the obvious language for it. It is also currently unbuildable: the committed
// C/C++/Rust artifacts do not reproduce byte-for-byte under this machine's
// clang/lld, so running the main builder would silently replace 25 committed
// artifacts. AssemblyScript reproduces byte-identically, so the same
// optimizations can be demonstrated honestly today, on a language whose bytes
// we can still vouch for. The C/C++/Rust rows follow once the toolchain
// question in docs/track-b-optimizations.md is settled.
//
// Why a separate builder
// ----------------------
// scripts/build-multilang-wasm-benchmark.ts rebuilds every language in one
// pass and has no per-language filter. This one touches AssemblyScript
// artifacts only, so it can never rewrite another language's committed bytes.
//
// Variants
// --------
//   asc-ikj    loop interchange i/j/k -> i/k/j; B streamed along rows instead
//              of walked down columns.
//   asc-tiled  i/j blocked into 32x32 panels; the k loop is deliberately left
//              intact.
//
// Equivalence: both are `bit-identical` (docs/track-b-optimizations.md).
// Neither changes the order of additions into any output element, so both must
// reproduce the pinned strict-f32 oracle exactly. This builder refuses to
// report a timing for any variant whose digest differs.
//
// Toolchain: AssemblyScript via `npx --yes -p assemblyscript asc`, same flags
// as the Track A row in the main builder (-O3, --bindings none, --noAssert,
// --initialMemory 16).
//
// Usage:
//   deno run --allow-all scripts/build-multilang-asc-opt.ts

const rootDir = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const artifactsDir = `${rootDir}/public/artifacts/multilang-wasm-benchmark`;
const gemmDir = `${rootDir}/benchmarks/multilang-wasm/ml-gemm`;
const dataDir = `${rootDir}/public/data`;

const GEMM_M = 128, GEMM_N = 128, GEMM_K = 128;
const GEMM_ITERATIONS = 200;

/** Linear-memory layout shared with the adapter: A, B, C0, OUT at 64 KiB steps. */
const OFF_A = 0x00000;
const OFF_B = 0x10000;
const OFF_C0 = 0x20000;
const OFF_OUT = 0x30000;

interface VariantSpec {
  key: string;
  source: string;
  outBase: string;
  optimization: string;
  note: string;
}

const VARIANTS: ReadonlyArray<VariantSpec> = [
  {
    key: "asc-ikj",
    source: "gemm_ikj.ts",
    outBase: "gemm_asc_ikj",
    optimization: "loop interchange i/j/k -> i/k/j",
    note:
      "B is read along rows (sequential addresses, full cache-line use) instead of down columns (one line touched per element). Costs a register accumulator: the running sum lives in OUT, so each inner step is a load/store pair.",
  },
  {
    key: "asc-tiled",
    source: "gemm_tiled.ts",
    outBase: "gemm_asc_tiled",
    optimization: "i/j cache blocking, 32x32 panels, k loop unblocked",
    note:
      "Per-panel working set is 16 KiB of A plus 16 KiB of B, against 64 KiB for the whole of B untiled. The k loop is left intact so no accumulation order changes.",
  },
];

async function run(cmd: string, args: string[], label: string): Promise<void> {
  const { code, stderr } = await new Deno.Command(cmd, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (code !== 0) {
    throw new Error(`${label} failed:\n${new TextDecoder().decode(stderr)}`);
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fnv1aBytes(bytes: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Median wall time of a fresh WebAssembly.Module compile, in ms. */
function coldCompileMs(bytes: Uint8Array, samples = 10): number {
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    new WebAssembly.Module(bytes as BufferSource);
    times.push(performance.now() - t0);
  }
  return Number(median(times).toFixed(4));
}

// --- Inputs and oracle: mirrored from the main builder, never redefined. ----

function makeGemmInputs() {
  const a = new Float32Array(GEMM_M * GEMM_K);
  const b = new Float32Array(GEMM_K * GEMM_N);
  const c0 = new Float32Array(GEMM_M * GEMM_N);
  let st = 0x91e10da5;
  const next = () => {
    st = (st * 1664525 + 1013904223) >>> 0;
    return Math.fround((st / 4294967296) * 2 - 1);
  };
  for (let i = 0; i < a.length; i++) a[i] = next();
  for (let i = 0; i < b.length; i++) b[i] = next();
  for (let i = 0; i < c0.length; i++) c0[i] = next();
  return { a, b, c0 };
}

function jsGemmF32(a: Float32Array, b: Float32Array, c0: Float32Array, out: Float32Array): void {
  for (let i = 0; i < GEMM_M; i++) {
    for (let j = 0; j < GEMM_N; j++) {
      let acc = c0[i * GEMM_N + j];
      for (let t = 0; t < GEMM_K; t++) {
        acc = Math.fround(acc + Math.fround(a[i * GEMM_K + t] * b[t * GEMM_N + j]));
      }
      out[i * GEMM_N + j] = acc + 0;
    }
  }
}

interface VariantRecord {
  key: string;
  track: "A" | "B";
  baseline: string | null;
  optimization: string;
  artifact: string;
  artifactSha256: string;
  binarySizeBytes: number;
  outputDigest: number;
  matchesOracle: boolean;
  coldCompileMs: number;
  warmTotalMs: number;
  msPerIteration: number;
  speedupVsBaseline: number | null;
  note: string;
}

async function compileAsc(source: string, outBase: string): Promise<void> {
  await run("npx", [
    "--yes",
    "-p",
    "assemblyscript",
    "asc",
    `${gemmDir}/${source}`,
    "-O3",
    "--bindings",
    "none",
    "--noAssert",
    "--initialMemory",
    "16",
    "-o",
    `${artifactsDir}/${outBase}.wasm`,
  ], `compile ${outBase}`);
}

type GemmExport = (
  a: number,
  b: number,
  c0: number,
  out: number,
  m: number,
  n: number,
  k: number,
) => void;

async function measure(
  key: string,
  outBase: string,
  track: "A" | "B",
  baselineKey: string | null,
  optimization: string,
  note: string,
  oracleDigest: number,
  baselineMsPerIteration: number | null,
): Promise<VariantRecord> {
  const wasmBytes = await Deno.readFile(`${artifactsDir}/${outBase}.wasm`);
  const instance = new WebAssembly.Instance(
    new WebAssembly.Module(wasmBytes as BufferSource),
    {},
  );
  const memory = instance.exports.memory as WebAssembly.Memory;
  const gemm = instance.exports.gemm as GemmExport;

  const { a, b, c0 } = makeGemmInputs();
  new Float32Array(memory.buffer, OFF_A, a.length).set(a);
  new Float32Array(memory.buffer, OFF_B, b.length).set(b);
  new Float32Array(memory.buffer, OFF_C0, c0.length).set(c0);
  const out = new Float32Array(memory.buffer, OFF_OUT, GEMM_M * GEMM_N);

  // Correctness first: nothing is timed until the output matches the oracle.
  gemm(OFF_A, OFF_B, OFF_C0, OFF_OUT, GEMM_M, GEMM_N, GEMM_K);
  const outputDigest = fnv1aBytes(
    new Uint8Array(memory.buffer, OFF_OUT, GEMM_M * GEMM_N * 4),
  );
  const matchesOracle = outputDigest === oracleDigest;
  if (!matchesOracle) {
    throw new Error(
      `${key} is declared bit-identical but its output digest 0x${
        outputDigest.toString(16)
      } != oracle 0x${oracleDigest.toString(16)} — not timed`,
    );
  }
  if (out.length !== GEMM_M * GEMM_N) throw new Error(`${key}: unexpected output view`);

  // Warm up, then time the frozen iteration count.
  for (let i = 0; i < 20; i++) gemm(OFF_A, OFF_B, OFF_C0, OFF_OUT, GEMM_M, GEMM_N, GEMM_K);
  const t0 = performance.now();
  for (let i = 0; i < GEMM_ITERATIONS; i++) {
    gemm(OFF_A, OFF_B, OFF_C0, OFF_OUT, GEMM_M, GEMM_N, GEMM_K);
  }
  const warmTotalMs = performance.now() - t0;
  const msPerIteration = warmTotalMs / GEMM_ITERATIONS;

  return {
    key,
    track,
    baseline: baselineKey,
    optimization,
    artifact: `${outBase}.wasm`,
    artifactSha256: await sha256(wasmBytes),
    binarySizeBytes: wasmBytes.byteLength,
    outputDigest,
    matchesOracle,
    coldCompileMs: coldCompileMs(wasmBytes),
    warmTotalMs: Number(warmTotalMs.toFixed(4)),
    msPerIteration: Number(msPerIteration.toFixed(4)),
    speedupVsBaseline: baselineMsPerIteration === null
      ? null
      : Number((baselineMsPerIteration / msPerIteration).toFixed(4)),
    note,
  };
}

// --- main -------------------------------------------------------------------

const oracleOut = new Float32Array(GEMM_M * GEMM_N);
{
  const { a, b, c0 } = makeGemmInputs();
  jsGemmF32(a, b, c0, oracleOut);
}
const oracleDigest = fnv1aBytes(
  new Uint8Array(oracleOut.buffer, oracleOut.byteOffset, oracleOut.byteLength),
);

for (const v of VARIANTS) {
  console.log(`Compiling ${v.outBase} (${v.optimization})...`);
  await compileAsc(v.source, v.outBase);
}

// Track A baseline: the committed artifact, measured but never rebuilt.
const baseline = await measure(
  "asc",
  "gemm_asc",
  "A",
  null,
  "none — frozen i/j/k order",
  "Track A baseline. Committed artifact, measured here, not rebuilt.",
  oracleDigest,
  null,
);

const variants: VariantRecord[] = [baseline];
for (const v of VARIANTS) {
  variants.push(
    await measure(
      v.key,
      v.outBase,
      "B",
      "asc",
      v.optimization,
      v.note,
      oracleDigest,
      baseline.msPerIteration,
    ),
  );
}

const report = {
  schemaVersion: "multilang-asc-opt.v1",
  generatedBy: "scripts/build-multilang-asc-opt.ts",
  workloadId: "ml.gemm.v1",
  kernel: "gemm",
  shape: `${GEMM_M}x${GEMM_N}x${GEMM_K} strict f32`,
  iterations: GEMM_ITERATIONS,
  equivalence: "bit-identical",
  oracleDigest,
  oracleSource:
    "strict-f32 JavaScript reference mirrored from scripts/build-multilang-wasm-benchmark.ts",
  toolchain: {
    assemblyscript: "npx --yes -p assemblyscript asc",
    flags: ["-O3", "--bindings none", "--noAssert", "--initialMemory 16"],
  },
  environment: {
    runtime: `Deno ${Deno.version.deno}`,
    v8: Deno.version.v8,
    os: Deno.build.os,
    arch: Deno.build.arch,
    caveat:
      "Measured in Deno, not a browser. Comparable within this table only; the ml-gemm page measures the same artifacts in the browser.",
  },
  variants,
};

await Deno.writeTextFile(
  `${dataDir}/multilang-asc-opt.v1.json`,
  JSON.stringify(report, null, 2) + "\n",
);

console.log(`\nml.gemm.v1 — ${GEMM_M}x${GEMM_N}x${GEMM_K}, ${GEMM_ITERATIONS} iterations\n`);
console.log(
  `${"variant".padEnd(12)}${"ms/iter".padStart(10)}${"vs asc".padStart(9)}${
    "bytes".padStart(9)
  }  oracle`,
);
for (const v of variants) {
  const speed = v.speedupVsBaseline === null ? "—" : `${v.speedupVsBaseline.toFixed(3)}x`;
  console.log(
    `${v.key.padEnd(12)}${v.msPerIteration.toFixed(4).padStart(10)}${speed.padStart(9)}${
      String(v.binarySizeBytes).padStart(9)
    }  ${v.matchesOracle ? "exact" : "DRIFT"}`,
  );
}
console.log(`\nwrote ${dataDir}/multilang-asc-opt.v1.json`);

// Build script for audio DSP benchmark artifacts
// Run: deno run --allow-read=. --allow-write=public/artifacts build-audio.ts
import wabtFactory from "wabt";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { canonicalize, sha256Hex } from "./lib/canonical.ts";
import {
  FFT_INPUT_BYTES,
  FFT_OUTPUT_BYTES,
  FFT_TWIDDLE_BYTES,
  fftInputHash,
  FIR_INPUT_BYTES,
  FIR_OUTPUT_BYTES,
  FIR_TAP_BYTES,
  firInputHash,
  outputHash,
  runFftJavaScript,
  runFirJavaScript,
  runStftJavaScript,
  STFT_INPUT_BYTES,
  stftInputHash,
} from "./lib/audio-workloads.ts";

const root = new URL("./", import.meta.url);
const wabt = await wabtFactory();

async function buildBenchmark(
  id,
  watPath,
  sourcePaths,
  inputHash,
  inputBytes,
  oracleRun,
) {
  const outputDir = new URL(`public/artifacts/${id}/`, root);
  await Deno.mkdir(outputDir, { recursive: true });

  const wat = await Deno.readTextFile(new URL(watPath, root));
  const watModule = wabt.parseWat(`${id}.wat`, wat, {
    exceptions: false,
    threads: false,
    simd: false,
  });
  watModule.resolveNames();
  watModule.validate();
  const { buffer } = watModule.toBinary({
    canonicalize_lebs: true,
    relocatable: false,
    write_debug_names: false,
  });
  watModule.destroy();
  const wasm = new Uint8Array(buffer);

  const oracle = oracleRun();
  const oracleSha = await outputHash(oracle);

  const gzip = gzipSync(wasm, { level: 9 });
  const brotli = brotliCompressSync(wasm, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
    },
  });
  const lockfile = await Deno.readFile(new URL("deno.lock", root));

  const sources = [];
  for (const path of sourcePaths) {
    const bytes = await Deno.readFile(new URL(path, root));
    sources.push({ path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
  }
  const sourceBundle = sources.map((s) => `${s.path}\0${s.sha256}\n`).join("");

  const manifest = {
    schemaVersion: 1,
    benchmarkId: id,
    benchmarkVersion: 1,
    sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
    sourceCommit: "supplied by the runner from the exact checked-out commit",
    sourceSha256: await sha256Hex(sourceBundle),
    input: { generation: "", bytes: inputBytes, sha256: inputHash },
    oracle: {
      kind: "complete-output",
      outputSha256: oracleSha,
      outputBytes: oracle.byteLength * 4,
    },
    variants: {
      "js-controlled": {
        source: sourcePaths[0],
        sha256: sources[0].sha256,
        algorithm: "",
        footprint: {
          sourceBytes: sources[0].bytes,
          glueBytes: 0,
          rawBytes: sources[0].bytes,
          gzipBytes: 0,
          brotliBytes: 0,
          requestCount: 1,
        },
      },
      "wasm-linear-controlled": {
        source: watPath,
        artifact: `public/artifacts/${id}/${id}.wasm`,
        sha256: await sha256Hex(wasm),
        algorithm: "",
        features: { simd: false, threads: false, memory64: false, exceptions: false },
        footprint: {
          sourceBytes: wat.length,
          glueBytes: 0,
          rawBytes: wasm.byteLength,
          gzipBytes: gzip.byteLength,
          brotliBytes: brotli.byteLength,
          requestCount: 1,
        },
      },
    },
    build: {
      command: "deno run --allow-read --allow-write build-audio.ts",
      toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37", "node:zlib via Deno"],
      flags: [
        "wabt canonicalize_lebs=true",
        "write_debug_names=false",
        "gzip level=9",
        "brotli quality=11",
      ],
    },
    lockfiles: [{ name: "deno.lock", sha256: await sha256Hex(lockfile) }],
    sources,
  };

  await Deno.writeFile(new URL(`${id}.wasm`, outputDir), wasm);
  await Deno.writeTextFile(
    new URL("build-manifest.json", outputDir),
    `${canonicalize(manifest)}\n`,
  );
  console.log(
    `build: ${id}.wasm ${wasm.byteLength} bytes; gzip ${gzip.byteLength}; brotli ${brotli.byteLength}; oracle sha ${
      oracleSha.slice(0, 12)
    }`,
  );
  return { inputHash, oracleSha, wasmSha: await sha256Hex(wasm) };
}

// Build FFT
const fftHash = await fftInputHash();
await buildBenchmark(
  "fft-radix2-c2c",
  "benchmarks/fft-radix2-c2c/fft.wat",
  [
    "benchmarks/fft-radix2-c2c/workload.ts",
    "benchmarks/fft-radix2-c2c/input.ts",
    "benchmarks/fft-radix2-c2c/js.ts",
    "lib/audio-workloads.ts",
    "build-audio.ts",
    "deno.json",
  ],
  fftHash,
  FFT_INPUT_BYTES + FFT_TWIDDLE_BYTES,
  runFftJavaScript,
  FFT_OUTPUT_BYTES,
);

// Build FIR
const firHash = await firInputHash();
await buildBenchmark(
  "fir-direct-convolution",
  "benchmarks/fir-direct-convolution/fir.wat",
  [
    "benchmarks/fir-direct-convolution/workload.ts",
    "benchmarks/fir-direct-convolution/input.ts",
    "benchmarks/fir-direct-convolution/js.ts",
    "lib/audio-workloads.ts",
    "build-audio.ts",
    "deno.json",
  ],
  firHash,
  FIR_INPUT_BYTES + FIR_TAP_BYTES,
  runFirJavaScript,
  FIR_OUTPUT_BYTES,
);

// Build STFT (Track B — no WAT, JS only for now)
const stftHash = await stftInputHash();
const stftDir = new URL("public/artifacts/stft-power-spectrum/", root);
await Deno.mkdir(stftDir, { recursive: true });
const stftOracle = runStftJavaScript();
const stftOracleSha = await outputHash(stftOracle);
const stftSources = [
  "benchmarks/stft-power-spectrum/workload.ts",
  "benchmarks/stft-power-spectrum/input.ts",
  "benchmarks/stft-power-spectrum/js.ts",
  "lib/audio-workloads.ts",
  "build-audio.ts",
  "deno.json",
];
const stftSourceObjs = [];
for (const p of stftSources) {
  const b = await Deno.readFile(new URL(p, root));
  stftSourceObjs.push({ path: p, bytes: b.byteLength, sha256: await sha256Hex(b) });
}
const lockfile = await Deno.readFile(new URL("deno.lock", root));
const stftManifest = {
  schemaVersion: 1,
  benchmarkId: "stft-power-spectrum",
  benchmarkVersion: 1,
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceCommit: "supplied by the runner from the exact checked-out commit",
  sourceSha256: await sha256Hex(stftSourceObjs.map((s) => `${s.path}\0${s.sha256}\n`).join("")),
  input: {
    generation: "Linear chirp 20Hz to 8kHz at 48kHz, 12000 Float32 samples",
    bytes: STFT_INPUT_BYTES,
    sha256: stftHash,
  },
  oracle: {
    kind: "complete-output",
    outputSha256: stftOracleSha,
    outputBytes: stftOracle.byteLength * 4,
  },
  variants: {
    "js-optimized": {
      source: "benchmarks/stft-power-spectrum/workload.ts",
      sha256: stftSourceObjs[0].sha256,
      algorithm: "STFT with Math trig + frozen twiddle FFT",
      footprint: {
        sourceBytes: stftSourceObjs[0].bytes,
        rawBytes: stftSourceObjs[0].bytes,
        gzipBytes: 0,
        brotliBytes: 0,
        requestCount: 1,
      },
    },
    "wasm-linear-optimized": {
      source: "pending",
      sha256: "pending",
      algorithm: "STFT with Taylor/Newton + frozen twiddle FFT (Track B)",
      footprint: { sourceBytes: 0, rawBytes: 0, gzipBytes: 0, brotliBytes: 0, requestCount: 1 },
    },
  },
  build: {
    command: "deno run --allow-read --allow-write build-audio.ts",
    toolchains: [`Deno ${Deno.version.deno}`],
    flags: [],
  },
  lockfiles: [{ name: "deno.lock", sha256: await sha256Hex(lockfile) }],
  sources: stftSourceObjs,
};
await Deno.writeTextFile(
  new URL("build-manifest.json", stftDir),
  `${canonicalize(stftManifest)}\n`,
);
console.log(
  `build: stft-power-spectrum JS-only manifest; oracle sha ${stftOracleSha.slice(0, 12)}`,
);

console.log("\nDone. Frozen hashes:");
console.log(JSON.stringify({ fft: fftHash, fir: firHash, stft: stftHash }, null, 2));

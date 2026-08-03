import wabtFactory from "wabt";
import { sha256Hex } from "../lib/canonical.ts";
import {
  checkpointValues,
  ENTRY_ID,
  expectedCounters,
  generateFixture,
  IMPLEMENTATION_ID,
  ORACLE_TOLERANCE,
  QUANTIZATION_STEP,
  runPipelineJs,
  runPipelineWasm,
  SAMPLE_COUNT,
  SIGNAL_SEED,
} from "../benchmarks/base/numeric-fft-spectral-filter/workload.js";
import {
  completeOutputSha256,
  quantizedOutputSha256,
  runIndependentF64Oracle,
  validateAgainstOracle,
} from "../benchmarks/base/numeric-fft-spectral-filter/reference.ts";

const root = new URL("../", import.meta.url);
const sourceCommit = Deno.args.find((argument) => argument.startsWith("--source-commit="))
  ?.slice("--source-commit=".length) ?? "";
const checkOnly = Deno.args.includes("--check");
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit=<40 lowercase hex> required");
}

const sourcePaths = [
  "benchmarks/base/numeric-fft-spectral-filter/workload.js",
  "benchmarks/base/numeric-fft-spectral-filter/reference.ts",
  "benchmarks/base/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wat",
  "catalog/base-implementations/numeric.fft-spectral-filter.v1.json",
  "public/benchmarks/numeric-fft-spectral-filter-v1/index.html",
  "public/benchmarks/numeric-fft-spectral-filter-v1/demo.js",
  "public/benchmarks/numeric-fft-spectral-filter-v1/worker.js",
  "scripts/build-numeric-fft-spectral-filter.ts",
  "server.ts",
  "deno.json",
  "deno.lock",
] as const;

const sources = [];
for (const path of sourcePaths) {
  const bytes = await Deno.readFile(new URL(path, root));
  const committed = await new Deno.Command("git", {
    args: ["show", `${sourceCommit}:${path}`],
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!committed.success || await sha256Hex(committed.stdout) !== await sha256Hex(bytes)) {
    throw new Error(`source mismatch at ${sourceCommit}:${path}`);
  }
  sources.push({ path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
}
const sourceSha256 = await sha256Hex(
  sources.map(({ path, sha256 }) => `${path}\0${sha256}\n`).join(""),
);

const watPath = new URL(
  "../benchmarks/base/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wat",
  import.meta.url,
);
const wabt = await wabtFactory();
const parsed = wabt.parseWat("numeric-fft-spectral-filter.wat", await Deno.readTextFile(watPath), {
  exceptions: false,
  threads: false,
  simd: false,
  bulk_memory: false,
  memory64: false,
});
parsed.resolveNames();
parsed.validate();
const binary = parsed.toBinary({
  canonicalize_lebs: true,
  relocatable: false,
  write_debug_names: false,
});
parsed.destroy();
const wasm = new Uint8Array(binary.buffer);

const outputDir = new URL("../public/artifacts/numeric-fft-spectral-filter/", import.meta.url);
if (checkOnly) {
  const existing = await Deno.readFile(new URL("numeric-fft-spectral-filter.wasm", outputDir));
  if (await sha256Hex(existing) !== await sha256Hex(wasm)) {
    throw new Error("Wasm artifact is not reproducible");
  }
} else {
  await Deno.mkdir(outputDir, { recursive: true });
  await Deno.writeFile(new URL("numeric-fft-spectral-filter.wasm", outputDir), wasm);
}

const fixture = generateFixture();
const fieldHashes = {
  signal: await sha256Hex(new Uint8Array(fixture.signal.buffer)),
  window: await sha256Hex(new Uint8Array(fixture.window.buffer)),
  twiddles: await sha256Hex(new Uint8Array(fixture.twiddles.buffer)),
  gains: await sha256Hex(new Uint8Array(fixture.gains.buffer)),
};
const fixtureIdentity = Object.entries(fieldHashes).map(([name, hash]) => `${name}\0${hash}\n`)
  .join("");
const fixtureSha256 = await sha256Hex(fixtureIdentity);

const jsOutput = runPipelineJs(fixture.signal, fixture.window, fixture.twiddles, fixture.gains);
const wasmOutput = await runPipelineWasm(
  wasm,
  fixture.signal,
  fixture.window,
  fixture.twiddles,
  fixture.gains,
);
const reference = runIndependentF64Oracle(
  fixture.signal,
  fixture.window,
  fixture.twiddles,
  fixture.gains,
);
const jsSha256 = await completeOutputSha256(jsOutput);
const wasmSha256 = await completeOutputSha256(wasmOutput);
if (jsSha256 !== wasmSha256) throw new Error("controlled JS/Wasm complete output mismatch");
const jsOracle = validateAgainstOracle(jsOutput, reference);
const wasmOracle = validateAgainstOracle(wasmOutput, reference);
if (!jsOracle.passed || !wasmOracle.passed) {
  throw new Error(`oracle rejected output: ${JSON.stringify({ jsOracle, wasmOracle })}`);
}
const quantizedSha256 = await quantizedOutputSha256(jsOutput);

function jsonBytes(value: unknown) {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}
async function writeJson(name: string, value: unknown) {
  const bytes = jsonBytes(value);
  const destination = new URL(name, outputDir);
  if (checkOnly) {
    const existing = await Deno.readFile(destination);
    if (await sha256Hex(existing) !== await sha256Hex(bytes)) {
      throw new Error(`${name} is not byte-reproducible`);
    }
  } else {
    await Deno.writeFile(destination, bytes);
  }
  return {
    path: `public/artifacts/numeric-fft-spectral-filter/${name}`,
    sha256: await sha256Hex(bytes),
  };
}

const fixtureManifest = await writeJson("fixture-manifest.json", {
  schemaVersion: 1,
  status: "supplemental-implementation-candidate",
  entryId: ENTRY_ID,
  implementationId: IMPLEMENTATION_ID,
  sampleCount: SAMPLE_COUNT,
  signalSeed: `0x${SIGNAL_SEED.toString(16)}`,
  rights: { licenseSpdx: "CC0-1.0", source: "project-generated", redistribution: "permitted" },
  serialization: "raw-little-endian-f32",
  fields: {
    signal: {
      components: SAMPLE_COUNT,
      bytes: fixture.signal.byteLength,
      sha256: fieldHashes.signal,
    },
    window: {
      components: SAMPLE_COUNT,
      bytes: fixture.window.byteLength,
      sha256: fieldHashes.window,
    },
    twiddles: {
      components: fixture.twiddles.length,
      bytes: fixture.twiddles.byteLength,
      sha256: fieldHashes.twiddles,
    },
    gains: { components: SAMPLE_COUNT, bytes: fixture.gains.byteLength, sha256: fieldHashes.gains },
  },
  fixtureSha256,
  sourceCommit,
});
const outputManifest = await writeJson("output-manifest.json", {
  schemaVersion: 1,
  status: "supplemental-implementation-candidate",
  authoritativePerformanceEvidence: false,
  entryId: ENTRY_ID,
  implementationId: IMPLEMENTATION_ID,
  completeOutput: {
    components: jsOutput.length,
    bytes: jsOutput.byteLength,
    sha256: jsSha256,
    quantizationStep: QUANTIZATION_STEP,
    quantizedSha256,
    checkpoints: checkpointValues(jsOutput),
  },
  oracle: {
    method: "independent-scalar-f64-radix-2",
    tolerance: ORACLE_TOLERANCE,
    js: jsOracle,
    wasm: wasmOracle,
  },
  variants: {
    "js-controlled": {
      status: "passed",
      counters: expectedCounters(SAMPLE_COUNT, "js-controlled"),
    },
    "wasm-linear-controlled": {
      status: "passed",
      counters: expectedCounters(SAMPLE_COUNT, "wasm-linear-controlled"),
    },
  },
  performanceClaims: [],
  sourceCommit,
});
const wasmSha = await sha256Hex(wasm);
const buildManifestValue = {
  schemaVersion: 1,
  status: "supplemental-implementation-candidate",
  authoritativePerformanceEvidence: false,
  entryId: ENTRY_ID,
  implementationId: IMPLEMENTATION_ID,
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceCommit,
  sourceSha256,
  fullSourceGraph: sources,
  frozenCatalog: {
    sha256: "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
    immutability: "byte-for-byte",
  },
  manifests: { fixture: fixtureManifest, output: outputManifest },
  variants: {
    "js-controlled": {
      source: "benchmarks/base/numeric-fft-spectral-filter/workload.js",
      sourceSha256: sources.find((source) => source.path.endsWith("workload.js"))!.sha256,
    },
    "wasm-linear-controlled": {
      source: "benchmarks/base/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wat",
      artifact: "public/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm",
      artifactSha256: wasmSha,
      bytes: wasm.byteLength,
      features: {
        scalar: true,
        simd: false,
        threads: false,
        initialPages: 512,
        maximumPages: 512,
        memoryGrowth: false,
      },
    },
  },
  toolchain: {
    runtime: "Deno 2.9.0",
    wabt: "1.0.37",
    command:
      `deno run --allow-read=. --allow-write=public/artifacts/numeric-fft-spectral-filter --allow-run=git scripts/build-numeric-fft-spectral-filter.ts --source-commit=${sourceCommit}`,
  },
};
await writeJson("build-manifest.json", buildManifestValue);

const evidenceDir = new URL(
  "../public/evidence/base-v1/numeric-fft-spectral-filter/",
  import.meta.url,
);
if (!checkOnly) await Deno.mkdir(evidenceDir, { recursive: true });
for (const variantId of ["js-controlled", "wasm-linear-controlled"] as const) {
  const recordBytes = new TextEncoder().encode(`${
    JSON.stringify(
      {
        schemaVersion: 1,
        status: "supplemental-validation-record",
        authoritativePerformanceEvidence: false,
        entryId: ENTRY_ID,
        implementationId: IMPLEMENTATION_ID,
        variantId,
        fixtureSha256,
        completeOutputSha256: jsSha256,
        quantizedOutputSha256: quantizedSha256,
        oracle: variantId === "js-controlled" ? jsOracle : wasmOracle,
        counters: expectedCounters(SAMPLE_COUNT, variantId),
        buildManifest: "/artifacts/numeric-fft-spectral-filter/build-manifest.json",
        performanceSamples: [],
        sourceCommit,
      },
      null,
      2,
    )
  }\n`);
  const recordUrl = new URL(`${variantId}.json`, evidenceDir);
  if (checkOnly) {
    const existing = await Deno.readFile(recordUrl);
    if (await sha256Hex(existing) !== await sha256Hex(recordBytes)) {
      throw new Error(`${variantId} record is not byte-reproducible`);
    }
  } else {
    await Deno.writeFile(recordUrl, recordBytes);
  }
}
if (checkOnly) {
  console.log("numeric FFT artifact, manifests, records and source graph reproduce exactly");
}
console.log(
  JSON.stringify(
    {
      sourceCommit,
      fixtureSha256,
      completeOutputSha256: jsSha256,
      quantizedSha256,
      wasmSha256: wasmSha,
      oracle: jsOracle,
    },
    null,
    2,
  ),
);

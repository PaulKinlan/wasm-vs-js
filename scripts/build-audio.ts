import wabtFactory from "wabt";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { sha256Hex } from "../lib/canonical.ts";
import { canonicalF32Bytes } from "../benchmarks/audio-shared/canonical.ts";
import { generatePinnedF64Reference } from "../benchmarks/audio-shared/reference.ts";
import { AUDIO_COUNTERS, prepareAudioHarness } from "../lib/audio-workloads.ts";
import {
  AUDIO_FROZEN_HASHES,
  AUDIO_MEMORY_PAGES,
  type AudioSlug,
} from "../benchmarks/audio-shared/constants.ts";

const root = new URL("../", import.meta.url);
const repository = "https://github.com/PaulKinlan/wasm-vs-js";
const slugs: AudioSlug[] = ["audio-fft", "audio-fir", "audio-stft"];
const sourceCommitArgument = Deno.args.find((argument) => argument.startsWith("--source-commit="));
const sourceCommit = sourceCommitArgument?.slice("--source-commit=".length) ?? "";
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit=<40 lowercase hex Git commit> is required");
}

const commitProbe = await new Deno.Command("git", {
  args: ["cat-file", "-e", `${sourceCommit}^{commit}`],
  cwd: root.pathname,
  stdout: "null",
  stderr: "piped",
}).output();
if (!commitProbe.success) {
  throw new Error(`source commit is not locally resolvable: ${sourceCommit}`);
}

const sourcePaths = [
  "benchmarks/audio-fft/benchmark.json",
  "benchmarks/audio-fft/input.ts",
  "benchmarks/audio-fft/js.ts",
  "benchmarks/audio-fft/workload.ts",
  "benchmarks/audio-fft/audio-fft.wat",
  "benchmarks/audio-fir/benchmark.json",
  "benchmarks/audio-fir/input.ts",
  "benchmarks/audio-fir/js.ts",
  "benchmarks/audio-fir/workload.ts",
  "benchmarks/audio-fir/audio-fir.wat",
  "benchmarks/audio-stft/benchmark.json",
  "benchmarks/audio-stft/input.ts",
  "benchmarks/audio-stft/js.ts",
  "benchmarks/audio-stft/workload.ts",
  "benchmarks/audio-stft/audio-stft.wat",
  "benchmarks/audio-shared/canonical.ts",
  "benchmarks/audio-shared/constants.ts",
  "benchmarks/audio-shared/oracle.ts",
  "benchmarks/audio-shared/reference.ts",
  "benchmarks/audio-shared/manifest-contract.ts",
  "lib/audio-workloads.ts",
  "scripts/build-audio.ts",
  "scripts/build-audio-results.ts",
  "deno.json",
  "deno.lock",
  "catalog/workloads.v2.proposed.json",
  "benchmarks/v2/shared/workload-contract.js",
  "benchmarks/v2/shared/provenance-contract.js",
  "schemas/workload-result-v2-proposal.schema.json",
  "schemas/audio-fixture-manifest.schema.json",
  "schemas/audio-input-manifest.schema.json",
  "schemas/audio-reference-manifest.schema.json",
  "schemas/audio-output-manifest.schema.json",
  "schemas/audio-build-manifest.schema.json",
] as const;

const sources = await Promise.all(sourcePaths.map(async (path) => {
  const bytes = await Deno.readFile(new URL(path, root));
  const committed = await new Deno.Command("git", {
    args: ["show", `${sourceCommit}:${path}`],
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!committed.success || await sha256Hex(committed.stdout) !== await sha256Hex(bytes)) {
    throw new Error(`working source does not match ${sourceCommit}:${path}`);
  }
  return { path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) };
}));
const sourceIdentity = sources.map(({ path, sha256 }) => `${path}\0${sha256}\n`).join("");
const sourceSha256 = await sha256Hex(sourceIdentity);
const lockSha256 = sources.find((source) => source.path === "deno.lock")!.sha256;

const wabt = await wabtFactory();
const gzipOptions = { level: 9 } as const;
const brotliOptions = {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 11,
    [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
  },
};

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

async function writeJson(url: URL, value: unknown): Promise<Uint8Array> {
  const bytes = jsonBytes(value);
  await Deno.writeFile(url, bytes);
  return bytes;
}

for (const slug of slugs) {
  const watPath = `benchmarks/${slug}/${slug}.wat`;
  const wat = await Deno.readTextFile(new URL(watPath, root));
  const parsed = wabt.parseWat(`${slug}.wat`, wat, {
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
  const outputDir = new URL(`public/artifacts/${slug}/`, root);
  await Deno.mkdir(outputDir, { recursive: true });
  await Deno.writeFile(new URL(`${slug}.wasm`, outputDir), wasm);

  const referenceOutput = generatePinnedF64Reference(slug);
  const referenceBytes = canonicalF32Bytes(referenceOutput);
  const referenceSha256 = await sha256Hex(referenceBytes);
  if (referenceSha256 !== AUDIO_FROZEN_HASHES[slug].referenceSha256) {
    throw new Error(`${slug} pinned f64 reference hash mismatch`);
  }
  await Deno.writeFile(new URL("reference-output.f32le", outputDir), referenceBytes);

  const jsHarness = await prepareAudioHarness(slug, "javascript");
  const jsResult = await jsHarness.runIteration(referenceOutput);
  const wasmHarness = await prepareAudioHarness(slug, "wasm-linear", wasm);
  const wasmResult = await wasmHarness.runIteration(referenceOutput, jsResult.output);
  if (jsResult.outputSha256 !== wasmResult.outputSha256) {
    throw new Error(`${slug} strict JS/Wasm semantic hash mismatch`);
  }

  const descriptorPath = `benchmarks/${slug}/benchmark.json`;
  const descriptor = JSON.parse(await Deno.readTextFile(new URL(descriptorPath, root)));
  const fixtureManifest = {
    schemaVersion: 1,
    status: "proposal-validation-only",
    entryId: descriptor.entryId,
    benchmarkSlug: slug,
    rights: {
      source: "generated solely by repository xorshift32 and coefficient generators",
      licenseSpdx: "CC0-1.0",
      redistribution: "permitted",
    },
    generator: {
      algorithm: "xorshift32",
      seed: descriptor.entryId === "audio.fft.v1"
        ? "0x9e3779b9"
        : descriptor.entryId === "audio.fir.v1"
        ? "0xa1b2c3d4"
        : "0x13579bdf",
      revision: "proposal-generator-v1",
      mapping: descriptor.input.generatorMapping ??
        "xorshift32 seeded-noise PCM plus frozen taps",
    },
    serialization: "canonical little-endian f32 fields in catalog-declared order",
    sourceCommit,
  };
  const fixtureManifestBytes = await writeJson(
    new URL("fixture-manifest.json", outputDir),
    fixtureManifest,
  );
  const inputManifest = {
    schemaVersion: 1,
    status: "proposal-validation-only",
    entryId: descriptor.entryId,
    benchmarkSlug: slug,
    serialization: "canonical-little-endian-f32",
    byteLength: AUDIO_COUNTERS[slug]["input-bytes"],
    sha256: AUDIO_FROZEN_HASHES[slug].inputSha256,
    fields: descriptor.parameters,
    sourceCommit,
  };
  const inputManifestBytes = await writeJson(
    new URL("input-manifest.json", outputDir),
    inputManifest,
  );
  const referenceManifest = {
    schemaVersion: 1,
    contractId: "audio-reference-manifest-v1",
    status: "proposal-validation-only",
    entryId: descriptor.entryId,
    benchmarkSlug: slug,
    method: slug === "audio-fir"
      ? "scalar-f64-direct-convolution-rounded-once-to-f32"
      : slug === "audio-stft"
      ? "scalar-f64-window-and-direct-dft-rounded-once-to-f32"
      : "scalar-f64-direct-dft-rounded-once-to-f32",
    serialization: "canonical-little-endian-f32-signed-zero-normalized-positive",
    artifact: `public/artifacts/${slug}/reference-output.f32le`,
    byteLength: referenceBytes.byteLength,
    components: referenceOutput.length,
    sha256: referenceSha256,
    tolerance: {
      mode: "absolute-and-relative-hybrid",
      absolute: slug === "audio-stft" ? 5e-6 : 1e-6,
      relative: 1e-5,
    },
    sourceCommit,
  };
  const referenceManifestBytes = await writeJson(
    new URL("reference-manifest.json", outputDir),
    referenceManifest,
  );
  const outputManifest = {
    schemaVersion: 1,
    status: "proposal-validation-only",
    authoritativePerformanceEvidence: false,
    entryId: descriptor.entryId,
    benchmarkSlug: slug,
    serialization: "canonical-little-endian-f32-signed-zero-normalized-positive",
    byteLength: AUDIO_COUNTERS[slug]["output-bytes"],
    sha256: AUDIO_FROZEN_HASHES[slug].outputSha256,
    variants: {
      "js-controlled": {
        status: "passed",
        completeOutputSha256: jsResult.outputSha256,
        referenceSha256,
        oracleChecks: jsResult.oracleChecks,
        workCounterGate: jsResult.workCounterGate,
        workCounters: jsResult.counters,
      },
      "wasm-linear-controlled": {
        status: "passed",
        completeOutputSha256: wasmResult.outputSha256,
        referenceSha256,
        oracleChecks: wasmResult.oracleChecks,
        workCounterGate: wasmResult.workCounterGate,
        workCounters: wasmResult.counters,
      },
    },
    performanceClaims: [],
    sourceCommit,
  };
  const outputManifestBytes = await writeJson(
    new URL("output-manifest.json", outputDir),
    outputManifest,
  );

  const wasmHash = await sha256Hex(wasm);
  const buildManifest = {
    schemaVersion: 1,
    status: "proposal-validation-only",
    authoritativePerformanceEvidence: false,
    entryId: descriptor.entryId,
    benchmarkSlug: slug,
    sourceRepository: repository,
    sourceCommit,
    sourceSha256,
    fullSourceGraph: sources,
    manifests: {
      fixture: {
        path: `public/artifacts/${slug}/fixture-manifest.json`,
        sha256: await sha256Hex(fixtureManifestBytes),
      },
      input: {
        path: `public/artifacts/${slug}/input-manifest.json`,
        sha256: await sha256Hex(inputManifestBytes),
      },
      reference: {
        path: `public/artifacts/${slug}/reference-manifest.json`,
        sha256: await sha256Hex(referenceManifestBytes),
      },
      output: {
        path: `public/artifacts/${slug}/output-manifest.json`,
        sha256: await sha256Hex(outputManifestBytes),
      },
    },
    referenceArtifact: {
      path: `public/artifacts/${slug}/reference-output.f32le`,
      sha256: referenceSha256,
      bytes: referenceBytes.byteLength,
      mediaType: "application/octet-stream",
    },
    variants: {
      "js-controlled": {
        artifact: `benchmarks/${slug}/workload.ts`,
        artifactSha256: sources.find((source) =>
          source.path === `benchmarks/${slug}/workload.ts`
        )!.sha256,
      },
      "wasm-linear-controlled": {
        source: watPath,
        artifact: `public/artifacts/${slug}/${slug}.wasm`,
        artifactSha256: wasmHash,
        rawBytes: wasm.byteLength,
        gzipBytes: gzipSync(wasm, gzipOptions).byteLength,
        brotliBytes: brotliCompressSync(wasm, brotliOptions).byteLength,
        features: {
          simd: false,
          threads: false,
          bulkMemory: false,
          memory64: false,
          exceptions: false,
          initialPages: AUDIO_MEMORY_PAGES[slug],
          maximumPages: AUDIO_MEMORY_PAGES[slug],
          memoryGrowth: false,
        },
      },
    },
    build: {
      cwd: ".",
      command: [
        "deno",
        "run",
        "--allow-read=.",
        "--allow-write=public/artifacts/audio-fft,public/artifacts/audio-fir,public/artifacts/audio-stft",
        "--allow-run=git",
        "scripts/build-audio.ts",
        `--source-commit=${sourceCommit}`,
      ],
      toolchain: [
        { name: "deno", version: Deno.version.deno },
        { name: "typescript", version: Deno.version.typescript },
        { name: "wabt", version: "1.0.37" },
        { name: "node-zlib", version: `Deno ${Deno.version.deno} compatibility layer` },
      ],
      flags: {
        compiler: [
          "wabt exceptions=false threads=false simd=false bulk_memory=false memory64=false",
        ],
        linker: ["canonicalize_lebs=true relocatable=false write_debug_names=false"],
        runtime: [
          "fixed initial=max memory",
          "memory.grow unavailable",
          "strict f32 scalar operations",
        ],
      },
      lockfiles: [{ path: "deno.lock", sha256: lockSha256 }],
      environment: [{ name: "AUDIO_EVIDENCE_STATUS", value: "proposal-validation-only" }],
    },
    performanceClaims: [],
  };
  await writeJson(new URL("build-manifest.json", outputDir), buildManifest);
  console.log(`${slug}: ${wasm.byteLength} Wasm bytes; strict output ${jsResult.outputSha256}`);
}

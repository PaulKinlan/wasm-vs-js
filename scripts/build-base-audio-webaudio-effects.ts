import wabtFactory from "wabt";
import { sha256Hex } from "../lib/canonical.ts";
import {
  CONTRACT,
  counters,
  generateFixture,
  interleaveBytes,
  IR,
  processJavaScript,
} from "../benchmarks/base/audio-webaudio-effects/workload.js";
import {
  compareReference,
  processReference,
} from "../benchmarks/base/audio-webaudio-effects/reference.js";
import { processWasm } from "../benchmarks/base/audio-webaudio-effects/wasm.js";

if (Deno.version.deno !== "2.9.0") throw new Error(`Deno 2.9.0 required, got ${Deno.version.deno}`);
const root = new URL("../", import.meta.url);
const sourcePaths = [
  "benchmarks/base/audio-webaudio-effects/workload.js",
  "benchmarks/base/audio-webaudio-effects/reference.js",
  "benchmarks/base/audio-webaudio-effects/wasm.js",
  "benchmarks/base/audio-webaudio-effects/audio-webaudio-effects.wat",
  "benchmarks/base/audio-webaudio-effects/RIGHTS.md",
  "schemas/audio-webaudio-effects-base.schema.json",
  "scripts/build-base-audio-webaudio-effects.ts",
  "scripts/check-planning.mjs",
  "public/benchmarks/base/audio-webaudio-effects-v1/index.html",
  "public/base-audio-effects-demo.js",
  "public/base-audio-effects-worker.js",
  "tests/base-audio-webaudio-effects.test.ts",
  "deno.json",
  "deno.lock",
] as const;
let sourceCommit = Deno.args.find((value) => value.startsWith("--source-commit="))
  ?.slice("--source-commit=".length) ?? "";
if (!sourceCommit) {
  try {
    const committedManifest = JSON.parse(
      await Deno.readTextFile(
        new URL(
          "public/artifacts/base-audio-webaudio-effects-v1/build-manifest.json",
          root,
        ),
      ),
    );
    sourceCommit = committedManifest.sourceCommit;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error("--source-commit is required for the first generated package");
    }
    throw error;
  }
}
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("unable to resolve exact source commit");
}
const sources: Array<{ path: string; bytes: number; sha256: string }> = [];
for (const path of sourcePaths) {
  const bytes = await Deno.readFile(new URL(path, root));
  sources.push({ path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
}

const wat = await Deno.readTextFile(
  new URL(
    "benchmarks/base/audio-webaudio-effects/audio-webaudio-effects.wat",
    root,
  ),
);
const wabt = await wabtFactory();
const parsed = wabt.parseWat("audio-webaudio-effects.wat", wat, {
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
const { instance } = await WebAssembly.instantiate(wasm);

console.log("build-base-audio-effects: generating exact 60 s stereo fixture");
const fixture = generateFixture();
const fixtureBytes = new Uint8Array(CONTRACT.frames * CONTRACT.channels * 4);
fixtureBytes.set(new Uint8Array(fixture.left.buffer), 0);
fixtureBytes.set(new Uint8Array(fixture.right.buffer), fixture.left.byteLength);
const irBytes = new Uint8Array(IR.buffer.slice(0));
const jsOutput = processJavaScript(fixture);
const wasmOutput = processWasm(instance, fixture);
const jsBytes = interleaveBytes(jsOutput);
const wasmBytes = interleaveBytes(wasmOutput);
const jsHash = await sha256Hex(jsBytes);
const wasmHash = await sha256Hex(wasmBytes);
if (jsHash !== wasmHash || jsBytes.byteLength !== wasmBytes.byteLength) {
  throw new Error("complete JS/Wasm output mismatch");
}
for (let i = 0; i < jsBytes.length; i++) {
  if (jsBytes[i] !== wasmBytes[i]) throw new Error(`output byte mismatch at ${i}`);
}
console.log("build-base-audio-effects: computing independent f64 oracle");
const reference = processReference(fixture);
const oracle = compareReference(jsOutput, reference);
if (oracle.violations !== 0 || oracle.nonFinite !== 0) throw new Error("f64 oracle failed");
const checkpointFrames = [
  0,
  1,
  127,
  128,
  11_999,
  12_000,
  23_999,
  24_000,
  35_999,
  36_000,
  47_999,
  48_000,
  527_999,
  528_000,
  CONTRACT.frames - 1,
  CONTRACT.outputFrames - 1,
];
const checkpoints = checkpointFrames.map((frame) => ({
  frame,
  left: jsOutput.left[frame],
  right: jsOutput.right[frame],
}));

const artifactDir = new URL("public/artifacts/base-audio-webaudio-effects-v1/", root);
const evidenceDir = new URL("public/evidence/base/audio-webaudio-effects-v1/", root);
const registrationDir = new URL("catalog/base-implementations/", root);
const writeGenerated = Deno.args.includes("--write");
if (writeGenerated) {
  await Deno.mkdir(artifactDir, { recursive: true });
  await Deno.mkdir(evidenceDir, { recursive: true });
  await Deno.mkdir(registrationDir, { recursive: true });
}

const frozenCatalogBytes = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
const frozenCatalogHash = await sha256Hex(frozenCatalogBytes);
const fixtureManifest = {
  schemaVersion: 1,
  entryId: CONTRACT.entryId,
  status: "supplemental-controlled-implementation",
  rights: {
    owner: "Paul Kinlan / wasm-vs-js project",
    licenseSpdx: "CC0-1.0",
    redistribution: "permitted",
    source:
      "generated solely by the committed project generator; no recorded audio or third-party IR",
  },
  generator: {
    revision: sourceCommit,
    seed: `0x${CONTRACT.seed.toString(16)}`,
    sampleRate: CONTRACT.sampleRate,
    frames: CONTRACT.frames,
    channels: CONTRACT.channels,
    segments: ["1 s impulse/DC/threshold", "10 s deterministic sweep", "49 s xorshift32 noise"],
  },
  serialization:
    "planar little-endian f32: complete left channel followed by complete right channel",
  inputBytes: fixtureBytes.byteLength,
  inputSha256: await sha256Hex(fixtureBytes),
  impulseResponse: { taps: IR.length, bytes: irBytes.byteLength, sha256: await sha256Hex(irBytes) },
};
const outputManifest = {
  schemaVersion: 1,
  entryId: CONTRACT.entryId,
  completeOutput: true,
  serialization: "interleaved stereo little-endian f32, signed zero normalized positive",
  frames: CONTRACT.outputFrames,
  samples: CONTRACT.outputFrames * 2,
  bytes: jsBytes.byteLength,
  jsSha256: jsHash,
  wasmSha256: wasmHash,
  exactCrossTarget: jsHash === wasmHash,
  oracle: { kind: "full-output-f64-tolerance", ...oracle },
  checkpoints,
};
const sourceIdentity = sources.map(({ path, sha256 }) => `${path}\0${sha256}\n`).join("");
const buildManifest = {
  schemaVersion: 1,
  entryId: CONTRACT.entryId,
  implementationId: CONTRACT.implementationId,
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceCommit,
  sourceSha256: await sha256Hex(sourceIdentity),
  frozenCatalog: {
    path: "catalog/workloads.v1.json",
    sha256: frozenCatalogHash,
    immutability: "byte-for-byte",
  },
  artifact: {
    path: "public/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm",
    bytes: wasm.byteLength,
    sha256: await sha256Hex(wasm),
    memory: { initialPages: 1024, maximumPages: 1024, growth: false },
    features: { simd: false, threads: false, exceptions: false, memory64: false },
  },
  build: {
    command: "deno task check",
    toolchains: [`Deno ${Deno.version.deno}`, "wabt 1.0.37"],
    flags: [
      "canonicalize_lebs=true",
      "write_debug_names=false",
      "scalar f32",
      "fixed 64 MiB memory",
    ],
  },
  sources,
};
const registration = {
  schemaVersion: 1,
  kind: "base-workload-implementation-registration",
  status: "implementation-candidate-independent-review-required",
  authoritativePerformanceEvidence: false,
  frozenCatalog: {
    id: "workload-catalog-v1",
    entryId: CONTRACT.entryId,
    sha256: frozenCatalogHash,
  },
  implementation: {
    id: CONTRACT.implementationId,
    track: "controlled",
    targets: ["javascript", "wasm-linear"],
    algorithmFamily: "dsp-fixed-block-effects-chain",
    exactFixedWork: {
      sampleRate: CONTRACT.sampleRate,
      seconds: CONTRACT.seconds,
      channels: CONTRACT.channels,
      frames: CONTRACT.frames,
      blockFrames: CONTRACT.blockFrames,
      blocksPerChannel: CONTRACT.blocks,
      blockInvocations: CONTRACT.blocks * CONTRACT.channels,
      tailFlushFramesPerChannel: CONTRACT.tailFrames,
    },
    fpPolicy: CONTRACT.fpPolicy,
    nativeWebAudio: "separate-host-product-baseline-not-executed",
  },
  artifacts: {
    fixtureManifest: "/artifacts/base-audio-webaudio-effects-v1/fixture-manifest.json",
    outputManifest: "/artifacts/base-audio-webaudio-effects-v1/output-manifest.json",
    buildManifest: "/artifacts/base-audio-webaudio-effects-v1/build-manifest.json",
    wasm: "/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm",
  },
  demoRoute: "/benchmarks/base/audio-webaudio-effects-v1/",
};
const outputs = { javascript: jsOutput, "wasm-linear": wasmOutput };
const targets = ["javascript", "wasm-linear"] as const;
const records = targets.map((target) => ({
  schemaVersion: 1,
  kind: "base-workload-correctness-record",
  status: "correctness-validation-only",
  authoritativePerformanceEvidence: false,
  entryId: CONTRACT.entryId,
  implementationId: CONTRACT.implementationId,
  target,
  sourceCommit,
  completeOutputSha256: jsHash,
  oracle,
  counters: counters(CONTRACT.frames, target, outputs[target].observations),
  artifactSha256: target === "wasm-linear"
    ? buildManifest.artifact.sha256
    : sources.find((s) => s.path.endsWith("workload.js"))?.sha256,
  limitations: [
    "No performance corpus",
    "No browser evidence in this implementation commit",
    "Native WebAudio is not a controlled target",
  ],
}));

const generated = [
  [new URL("audio-webaudio-effects.wasm", artifactDir), wasm],
  [
    new URL("fixture-manifest.json", artifactDir),
    new TextEncoder().encode(`${JSON.stringify(fixtureManifest, null, 2)}\n`),
  ],
  [
    new URL("output-manifest.json", artifactDir),
    new TextEncoder().encode(`${JSON.stringify(outputManifest, null, 2)}\n`),
  ],
  [
    new URL("build-manifest.json", artifactDir),
    new TextEncoder().encode(`${JSON.stringify(buildManifest, null, 2)}\n`),
  ],
  [
    new URL("audio.webaudio-effects.v1.json", registrationDir),
    new TextEncoder().encode(`${JSON.stringify(registration, null, 2)}\n`),
  ],
  [
    new URL("javascript-controlled.json", evidenceDir),
    new TextEncoder().encode(`${JSON.stringify(records[0], null, 2)}\n`),
  ],
  [
    new URL("wasm-linear-controlled.json", evidenceDir),
    new TextEncoder().encode(`${JSON.stringify(records[1], null, 2)}\n`),
  ],
] as const;
for (const [url, bytes] of generated) {
  if (writeGenerated) {
    await Deno.writeFile(url, bytes);
    continue;
  }
  let committed: Uint8Array;
  try {
    committed = await Deno.readFile(url);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`generated file is absent: ${url.pathname}`);
    }
    throw error;
  }
  if (committed.byteLength !== bytes.byteLength) {
    throw new Error(`generated file is stale: ${url.pathname}`);
  }
  for (let index = 0; index < bytes.byteLength; index++) {
    if (committed[index] !== bytes[index]) {
      throw new Error(`generated file is not byte-reproducible: ${url.pathname}`);
    }
  }
}
console.log(
  `build-base-audio-effects: reconciled ${generated.length} files; ${wasm.byteLength} byte Wasm; output ${jsHash}; max abs ${oracle.maxAbsolute}`,
);

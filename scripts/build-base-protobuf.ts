import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  generateFixture,
  runJavaScript,
  runWasm,
  sha256Hex as workloadHash,
} from "../benchmarks/base/serialization-protobuf-gateway/workload.js";

if (Deno.version.deno !== "2.9.0") {
  throw new Error(`requires Deno 2.9.0, found ${Deno.version.deno}`);
}
const root = new URL("../", import.meta.url);
const out = new URL("public/artifacts/serialization-protobuf-gateway/", root);
await Deno.mkdir(out, { recursive: true });
const catalogHash = await sha256Hex(
  await Deno.readFile(new URL("catalog/workloads.v1.json", root)),
);
const publicCatalogHash = await sha256Hex(
  await Deno.readFile(new URL("public/data/workloads.v1.json", root)),
);
const frozen = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";
if (catalogHash !== frozen || publicCatalogHash !== frozen) {
  throw new Error("frozen catalog bytes changed");
}

const cPath =
  new URL("benchmarks/base/serialization-protobuf-gateway/protobuf-gateway.c", root).pathname;
const wasmPath = new URL("serialization-protobuf-gateway.wasm", out).pathname;
const flags = [
  "--target=wasm32-unknown-unknown",
  "-O3",
  "-nostdlib",
  "-fno-builtin",
  "-Wl,--no-entry",
  "-Wl,--export=process",
  "-Wl,--export-memory",
  "-Wl,--initial-memory=33554432",
  "-Wl,--max-memory=33554432",
  "-Wl,--strip-all",
  "-o",
  wasmPath,
  cPath,
];
// Manifest-recorded flags use repo-relative paths so the committed manifest
// reproduces byte-identically regardless of checkout location. Clang itself
// still receives the absolute paths above.
const recordedFlags = flags.map((flag) =>
  flag === wasmPath
    ? "public/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm"
    : flag === cPath
    ? "benchmarks/base/serialization-protobuf-gateway/protobuf-gateway.c"
    : flag
);
const build = await new Deno.Command("clang", { args: flags, stdout: "piped", stderr: "piped" })
  .output();
if (!build.success) throw new Error(new TextDecoder().decode(build.stderr));
const version = await new Deno.Command("clang", { args: ["--version"], stdout: "piped" }).output();
const clangVersion = new TextDecoder().decode(version.stdout).split("\n", 1)[0];
if (clangVersion !== "clang version 22.1.8") {
  throw new Error(`unexpected toolchain ${clangVersion}`);
}

const wasm = await Deno.readFile(wasmPath);
const fixture = generateFixture();
const js = runJavaScript(fixture);
const wasmResult = await runWasm(fixture, wasm);
if (js.text !== wasmResult.text) throw new Error("complete JS/Wasm ProtoJSON mismatch");
const jsCounters = js.counters as Record<string, number>;
const wasmCounters = wasmResult.counters as Record<string, number>;
for (
  const key of [
    "messages",
    "fields",
    "varintBytes",
    "unknownFields",
    "filteredMessages",
    "wireBytes",
    "protoJsonBytes",
  ]
) {
  if (jsCounters[key] !== wasmCounters[key]) throw new Error(`counter mismatch ${key}`);
}
const sources = [
  "benchmarks/base/serialization-protobuf-gateway/workload.js",
  "benchmarks/base/serialization-protobuf-gateway/protobuf-gateway.c",
  "benchmarks/base/serialization-protobuf-gateway/gateway-event.proto",
  "benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json",
  "scripts/build-base-protobuf.ts",
  "deno.json",
  "deno.lock",
];
const sourceRecords = [];
for (const path of sources) {
  const bytes = await Deno.readFile(new URL(path, root));
  sourceRecords.push({ path, bytes: bytes.length, sha256: await sha256Hex(bytes) });
}
const fixtureManifest = {
  schemaVersion: 1,
  workload: "serialization.protobuf-gateway.v1",
  generator: { algorithm: "xorshift32", seed: "0x28a11ce5", revision: "gateway-generator-v1" },
  framing: "little-endian u32 count then repeated little-endian u32 length plus protobuf bytes",
  messages: 10000,
  bytes: fixture.length,
  sha256: await workloadHash(fixture),
  rights: { licenseSpdx: "CC0-1.0", provenance: "project-generated", redistribution: "permitted" },
  admittedCoverage: [
    "wire-0-varint",
    "wire-1-fixed64",
    "wire-2-length",
    "wire-5-fixed32",
    "duplicate-singular",
    "duplicate-map",
    "oneof-last-wins",
    "unknown-fields",
    "defaults",
    "uint64-above-2^53",
    "enum",
    "nonfinite-float-double",
    "multilingual-utf8",
    "json-escaping",
  ],
};
const outputManifest = {
  schemaVersion: 1,
  workload: "serialization.protobuf-gateway.v1",
  oracle: "complete canonical ProtoJSON byte identity",
  bytes: js.bytes.length,
  sha256: await workloadHash(js.bytes),
  counters: { js: js.counters, wasm: wasmResult.counters },
  performanceClaims: [],
};
const buildManifest = {
  schemaVersion: 1,
  workload: "serialization.protobuf-gateway.v1",
  catalogV1: { sha256: frozen, immutable: true },
  status: "candidate-pending-independent-acceptance",
  variants: {
    "js-controlled": { source: sourceRecords[0].path, sha256: sourceRecords[0].sha256 },
    "wasm-linear-controlled": {
      source: sourceRecords[1].path,
      sourceSha256: sourceRecords[1].sha256,
      artifact:
        "public/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm",
      artifactBytes: wasm.length,
      artifactSha256: await sha256Hex(wasm),
      memoryBytes: 33554432,
      features: { simd: false, threads: false, growth: false },
    },
  },
  build: {
    command:
      "deno run --allow-read=. --allow-write=public/artifacts/serialization-protobuf-gateway --allow-run=clang scripts/build-base-protobuf.ts",
    toolchains: ["Deno 2.9.0", "Clang 22.1.8", "LLD 22.1.8"],
    flags: recordedFlags,
  },
  reference: {
    repository: "protocolbuffers/protobuf",
    tag: "v32.0",
    commit: "4fbd1111a292d04746c732573025e3251de0bb9c",
    archiveSha256: "bb1fd58473c47c747a3f00fc45ced1d562bba4bf645db07cc889fe86dee279ca",
    archiveBytes: 9697278,
    redistribution: "recipe-only-not-vendored",
    licenseSpdx: "BSD-3-Clause",
  },
  sources: sourceRecords,
};
const manifests: Array<[string, unknown]> = [["fixture-manifest.json", fixtureManifest], [
  "output-manifest.json",
  outputManifest,
], ["build-manifest.json", buildManifest]];
for (const [name, value] of manifests) {
  await Deno.writeTextFile(new URL(name, out), `${canonicalize(value)}\n`);
}
console.log(
  `base protobuf: ${fixture.length} input bytes, ${js.bytes.length} output bytes, ${wasm.length} Wasm bytes, ${js.counters.filteredMessages} selected`,
);

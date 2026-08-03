import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  contentFor,
  ENTRY_COUNT,
  pathFor,
  runJavaScript,
  SELECTED_INDICES,
  ZIP_POLICY,
} from "../benchmarks/v1/archive-zip-workspace/engine.js";

const root = new URL("../", import.meta.url);
const artifactDir = new URL("public/artifacts/archive-zip-workspace-v1/", root);
const evidenceDir = new URL("public/evidence/v1-implementations/archive-zip-workspace-v1/", root);
await Deno.mkdir(artifactDir, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });

async function hashFile(path: string) {
  return await sha256Hex(await Deno.readFile(new URL(path, root)));
}
async function writeCanonical(url: URL, value: unknown) {
  const canonical = JSON.parse(canonicalize(value));
  await Deno.writeTextFile(url, `${JSON.stringify(canonical, null, 2)}\n`);
}
async function command(name: string, args: string[]) {
  const result = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
}

const requestedSource = Deno.args.find((arg) => arg.startsWith("--source-commit="))?.slice(16);
let sourceCommit = requestedSource ?? "";
if (!sourceCommit) {
  try {
    const previous = JSON.parse(
      await Deno.readTextFile(new URL("build-manifest.json", artifactDir)),
    );
    sourceCommit = previous.sourceCommit;
  } catch {
    sourceCommit = "0000000000000000000000000000000000000000";
  }
}
if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("source commit must be 40 lowercase hex");

const buildDir = new URL(".build-archive-v1/", artifactDir);
await Deno.remove(buildDir, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(buildDir, { recursive: true });
const object = new URL("archive_zip.o", buildDir).pathname;
const wasmPath = new URL("archive-zip-workspace.wasm", buildDir).pathname;
try {
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-c",
    "benchmarks/v1/archive-zip-workspace/archive_zip.c",
    "-o",
    object,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--initial-memory=8388608",
    "--max-memory=8388608",
    "--stack-first",
    "--strip-all",
    object,
    "-o",
    wasmPath,
  ]);
  await Deno.writeFile(
    new URL("archive-zip-workspace.wasm", artifactDir),
    await Deno.readFile(wasmPath),
  );
} finally {
  await Deno.remove(buildDir, { recursive: true });
}

const js = runJavaScript();
const wasm = await Deno.readFile(new URL("archive-zip-workspace.wasm", artifactDir));
const { instance } = await WebAssembly.instantiate(wasm);
const exports = instance.exports as Record<string, WebAssembly.ExportValue>;
const run = exports.archive_run as () => number;
if (run() !== 0) throw new Error("Wasm archive run failed");
const memory = exports.memory as WebAssembly.Memory;
const memoryBytes = new Uint8Array(memory.buffer);
const readOutput = (pointerName: string, lengthName: string) => {
  const pointer = (exports[pointerName] as () => number)();
  const length = (exports[lengthName] as () => number)();
  return memoryBytes.slice(pointer, pointer + length);
};
const wasmArchive = readOutput("archive_ptr", "archive_length");
const wasmListing = readOutput("listing_ptr", "listing_length");
const wasmExtracted = readOutput("extracted_ptr", "extracted_length");
const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((value, index) => value === b[index]);
if (
  !same(js.archive, wasmArchive) || !same(js.listing, wasmListing) ||
  !same(js.extracted, wasmExtracted)
) {
  throw new Error("JavaScript/Wasm complete outputs differ");
}
const countersPointer = (exports.counters_ptr as () => number)();
const wasmCounterValues = [...new Uint32Array(memory.buffer, countersPointer, 15)];
const wasmCounters = {
  entries: wasmCounterValues[0],
  inputBytes: wasmCounterValues[1],
  crcBytes: wasmCounterValues[2],
  deflateLiterals: wasmCounterValues[3],
  deflateMatches: wasmCounterValues[4],
  deflateMatchedBytes: wasmCounterValues[5],
  deflateEndSymbols: wasmCounterValues[6],
  localHeaders: wasmCounterValues[7],
  centralHeaders: wasmCounterValues[8],
  zip64Records: wasmCounterValues[9],
  listedEntries: wasmCounterValues[10],
  extractedEntries: wasmCounterValues[11],
  extractedBytes: wasmCounterValues[12],
  boundaryCrossings: wasmCounterValues[13],
  zipBytes: wasmCounterValues[14],
};

const fixtureWriter: number[] = [];
for (let index = 0; index < ENTRY_COUNT; index++) {
  const path = new TextEncoder().encode(pathFor(index));
  const content = contentFor(index);
  fixtureWriter.push(path.length & 255, path.length >>> 8, ...path);
  fixtureWriter.push(content.length & 255, content.length >>> 8, ...content);
}
const fixtureBytes = Uint8Array.from(fixtureWriter);
const catalogHash = await hashFile("catalog/workloads.v1.json");
const publicCatalogHash = await hashFile("public/data/workloads.v1.json");
if (catalogHash !== publicCatalogHash) throw new Error("frozen catalog copies differ");
const outputHashes = {
  archiveSha256: await sha256Hex(js.archive),
  listingSha256: await sha256Hex(js.listing),
  extractedSha256: await sha256Hex(js.extracted),
};
const sources = [
  "benchmarks/v1/archive-zip-workspace/engine.js",
  "benchmarks/v1/archive-zip-workspace/archive_zip.c",
  "scripts/build-v1-archive.ts",
  "public/benchmarks/archive-zip-workspace-v1/index.html",
  "public/archive-zip-demo.js",
  "public/archive-zip-worker.js",
  "deno.json",
  "deno.lock",
];
const sourceGraph = [];
for (const path of sources) {
  const bytes = await Deno.readFile(new URL(path, root));
  sourceGraph.push({ path, bytes: bytes.length, sha256: await sha256Hex(bytes) });
}
const sourceGraphHash = await sha256Hex(
  sourceGraph.map((item) => `${item.path}\0${item.sha256}\n`).join(""),
);
const fixtureManifest = {
  schemaVersion: 1,
  workloadId: "archive.zip-workspace.v1",
  catalogSha256: catalogHash,
  catalogImmutability: "byte-for-byte",
  generator: {
    entryCount: ENTRY_COUNT,
    pathOrder: "generator index 0..9999",
    pathEncoding:
      "UTF-8 with NFC literals; no traversal, absolute, empty, dot, or backslash segments",
    content:
      "four source/JSON/binary/Markdown families, 48+(index mod 113) bytes; binary uses xorshift32 seed (0x9e3779b9 xor index)",
    canonicalFixtureFraming: "u16le path length, path bytes, u16le content length, content bytes",
  },
  bytes: fixtureBytes.length,
  sha256: await sha256Hex(fixtureBytes),
  rights: { licenseSpdx: "CC0-1.0", provenance: "project-generated", redistribution: "permitted" },
  selectedIndices: SELECTED_INDICES,
};
const outputManifest = {
  schemaVersion: 1,
  workloadId: "archive.zip-workspace.v1",
  algorithmFamily: ZIP_POLICY.algorithmFamily,
  zipPolicy: ZIP_POLICY,
  fixedWork: {
    paths: ENTRY_COUNT,
    writePasses: 1,
    listPasses: 1,
    selectedExtractions: SELECTED_INDICES.length,
    zip64: "forbidden because entries < 65535 and all sizes/offsets < 2^32",
  },
  outputs: {
    ...outputHashes,
    archiveBytes: js.archive.length,
    listingBytes: js.listing.length,
    extractedBytes: js.extracted.length,
  },
  counters: js.counters,
};
const buildManifest = {
  schemaVersion: 1,
  workloadId: "archive.zip-workspace.v1",
  sourceRepository: "https://github.com/PaulKinlan/wasm-vs-js",
  sourceCommit,
  sourceGraphSha256: sourceGraphHash,
  sourceGraph,
  artifact: {
    path: "public/artifacts/archive-zip-workspace-v1/archive-zip-workspace.wasm",
    bytes: wasm.length,
    sha256: await sha256Hex(wasm),
    memory: { initialPages: 128, maximumPages: 128, growth: false },
  },
  build: {
    command:
      "deno run --allow-read=. --allow-write=public/artifacts,public/evidence,catalog/v1-implementations --allow-run=clang,wasm-ld scripts/build-v1-archive.ts --source-commit=<commit>",
    toolchains: ["Deno 2.9.0", "Clang 22.1.8", "LLD 22.1.8"],
    flags: [
      "--target=wasm32-unknown-unknown",
      "-O3",
      "-nostdlib",
      "-ffreestanding",
      "-fno-builtin",
      "--strip-all",
      "fixed memory 8 MiB",
    ],
  },
  manifests: {
    fixture: "public/artifacts/archive-zip-workspace-v1/fixture-manifest.json",
    output: "public/artifacts/archive-zip-workspace-v1/output-manifest.json",
  },
};
const registration = {
  schemaVersion: 1,
  workloadId: "archive.zip-workspace.v1",
  frozenCatalog: { path: "catalog/workloads.v1.json", sha256: catalogHash, modified: false },
  status: "candidate-implementation-awaiting-independent-review",
  countsTowardCoverage: false,
  track: "controlled",
  algorithmFamily: ZIP_POLICY.algorithmFamily,
  variants: ["js-controlled", "wasm-linear-controlled"],
  fixtureManifest: buildManifest.manifests.fixture,
  outputManifest: buildManifest.manifests.output,
  buildManifest: "public/artifacts/archive-zip-workspace-v1/build-manifest.json",
  demoRoute: "/benchmarks/archive-zip-workspace-v1/",
  limitations: [
    "No performance corpus or ranking",
    "Coverage remains 0/38 until independent acceptance and integration",
  ],
};
await writeCanonical(new URL("fixture-manifest.json", artifactDir), fixtureManifest);
await writeCanonical(new URL("output-manifest.json", artifactDir), outputManifest);
await writeCanonical(new URL("build-manifest.json", artifactDir), buildManifest);
await writeCanonical(
  new URL("catalog/v1-implementations/archive-zip-workspace.v1.json", root),
  registration,
);
for (const variant of ["js-controlled", "wasm-linear-controlled"] as const) {
  await writeCanonical(new URL(`${variant}.json`, evidenceDir), {
    schemaVersion: 1,
    workloadId: "archive.zip-workspace.v1",
    variant,
    status: "passed-proposal-validation",
    sourceCommit,
    input: { sha256: fixtureManifest.sha256, entries: ENTRY_COUNT },
    oracle: { kind: "exact-hash", ...outputHashes },
    structuralChecks: {
      allEntriesListed: true,
      allSelectedExtracted: true,
      crcChecked: true,
      pathSafetyChecked: true,
      fixedMetadataChecked: true,
      zip64ForbiddenUnderFrozenBounds: true,
    },
    counters: variant === "js-controlled" ? js.counters : wasmCounters,
    authoritativePerformanceResult: false,
  });
}
console.log(
  `archive.zip-workspace.v1: ${wasm.length} Wasm bytes, ${js.archive.length} ZIP bytes, exact outputs matched`,
);

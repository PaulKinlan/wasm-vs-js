import { sha256Hex } from "../lib/canonical.ts";
import { generateEcsFixture } from "../benchmarks/v1/game-ecs-frame-update/fixture.js";
import {
  instantiateEcsWasm,
  runEcsJavaScript,
  runEcsWasm,
} from "../benchmarks/v1/game-ecs-frame-update/engine.js";

const root = new URL("../", import.meta.url);
const artifactDir = new URL("public/artifacts/game-ecs-frame-update-v1/", root);
const evidenceDir = new URL("public/evidence/base-v1/game-ecs-frame-update-v1/", root);
const registrationUrl = new URL("catalog/implementations.v1/game.ecs-frame-update.v1.json", root);
const sourceOnly = Deno.args.includes("--source-only");
const sourceArgument = Deno.args.find((argument) => argument.startsWith("--source-commit="));
const sourceCommit = sourceArgument?.slice("--source-commit=".length) ?? "";
if (!sourceOnly && !/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit=<40 lowercase hex Git commit> is required");
}
if (Deno.version.deno !== "2.9.0") throw new Error("Deno 2.9.0 is required");

async function command(name: string, args: string[]) {
  const output = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(new TextDecoder().decode(output.stderr));
  return output.stdout;
}
async function writeJson(url: URL, value: unknown) {
  await Deno.writeTextFile(url, `${JSON.stringify(value, null, 2)}\n`);
}
function canonicalStateBytes(words: Uint32Array) {
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < words.length; index += 1) {
    view.setUint32(index * 4, words[index], true);
  }
  return bytes;
}
function commonCounters(counters: Record<string, number>) {
  const { ownedBufferAllocations: _allocations, boundaryCrossings: _crossings, ...common } =
    counters;
  return common;
}

await Deno.mkdir(artifactDir, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });
const buildDir = new URL(".build/", artifactDir);
await Deno.remove(buildDir, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(buildDir, { recursive: true });
const objectPath = new URL("ecs-frame-update.o", buildDir).pathname;
const wasmBuildPath = new URL("ecs-frame-update.wasm", buildDir).pathname;
const compilerFlags = [
  "--target=wasm32-unknown-unknown",
  "-O3",
  "-nostdlib",
  "-ffreestanding",
  "-fno-builtin",
];
const linkerFlags = [
  "--no-entry",
  "--export-memory",
  "--export=input_ptr",
  "--export=result_ptr",
  "--export=run",
  "--initial-memory=1048576",
  "--max-memory=1048576",
  "--stack-first",
];
try {
  await command("clang", [
    ...compilerFlags,
    "-c",
    "benchmarks/v1/game-ecs-frame-update/ecs-frame-update.c",
    "-o",
    objectPath,
  ]);
  await command("wasm-ld", [...linkerFlags, objectPath, "-o", wasmBuildPath]);
  await Deno.writeFile(
    new URL("ecs-frame-update.wasm", artifactDir),
    await Deno.readFile(wasmBuildPath),
  );
} finally {
  await Deno.remove(buildDir, { recursive: true });
}

const fixture = generateEcsFixture();
const fixturePath = "public/artifacts/game-ecs-frame-update-v1/fixture.bin";
await Deno.writeFile(new URL("fixture.bin", artifactDir), fixture);
const wasm = await Deno.readFile(new URL("ecs-frame-update.wasm", artifactDir));
const js = runEcsJavaScript(fixture);
const linear = runEcsWasm(await instantiateEcsWasm(wasm), fixture);
if (js.semanticDigest !== linear.semanticDigest) {
  throw new Error("cross-target semantic digest mismatch");
}
if (js.oracle.finalState.length !== linear.oracle.finalState.length) {
  throw new Error("cross-target final-state length mismatch");
}
for (let index = 0; index < js.oracle.finalState.length; index += 1) {
  if (js.oracle.finalState[index] !== linear.oracle.finalState[index]) {
    throw new Error(`cross-target final-state mismatch at word ${index}`);
  }
}
if (JSON.stringify(js.oracle.checkpoints) !== JSON.stringify(linear.oracle.checkpoints)) {
  throw new Error("cross-target checkpoint mismatch");
}
if (
  JSON.stringify(commonCounters(js.counters)) !== JSON.stringify(commonCounters(linear.counters))
) {
  throw new Error("cross-target common counter mismatch");
}
const fixtureSha256 = await sha256Hex(fixture);
const artifactSha256 = await sha256Hex(wasm);
const finalStateSha256 = await sha256Hex(canonicalStateBytes(js.oracle.finalState));
const fixtureManifest = {
  schemaVersion: 1,
  workloadId: "game.ecs-frame-update.v1",
  immutable: true,
  generator: "benchmarks/v1/game-ecs-frame-update/fixture.js",
  generatorRevision: 1,
  seed: 1858462077,
  entities: 10_000,
  frames: 1_000,
  bytes: fixture.byteLength,
  sha256: fixtureSha256,
  path: fixturePath,
  rights: {
    licenseSpdx: "CC0-1.0",
    redistribution: "permitted",
    provenance: "Generated entirely by the committed project generator from one fixed seed.",
  },
};
const outputManifest = {
  schemaVersion: 1,
  workloadId: "game.ecs-frame-update.v1",
  equivalence:
    "complete exact equality of 60000 canonical state words, ten checkpoints, digests, and common counters",
  oracle: {
    semanticDigest: js.semanticDigest,
    finalStateDigest: js.oracle.finalStateDigest,
    finalStateSha256,
    checkpointDigest: js.oracle.checkpointDigest,
    checkpoints: js.oracle.checkpoints,
    finalStateWords: js.oracle.finalState.length,
    integerTolerance: 0,
  },
  variants: {
    "js-controlled": { status: "passed", counters: js.counters },
    "wasm-linear-controlled": { status: "passed", counters: linear.counters },
  },
  performanceClaims: [],
};
await writeJson(new URL("fixture-manifest.json", artifactDir), fixtureManifest);
await writeJson(new URL("output-manifest.json", artifactDir), outputManifest);
if (sourceOnly) {
  console.log(
    `game.ecs-frame-update.v1 source build: ${wasm.length} byte Wasm; fixture ${fixtureSha256}; semantic ${js.semanticDigest}`,
  );
  Deno.exit(0);
}

async function gitBytes(path: string) {
  return await command("git", ["show", `${sourceCommit}:${path}`]);
}
async function reference(path: string) {
  const disk = await Deno.readFile(new URL(path, root));
  const tree = await gitBytes(path);
  const diskHash = await sha256Hex(disk);
  const treeHash = await sha256Hex(tree);
  if (diskHash !== treeHash) throw new Error(`source tree mismatch at ${path}`);
  return {
    path,
    sha256: treeHash,
    immutableUrl: `https://github.com/PaulKinlan/wasm-vs-js/blob/${sourceCommit}/${path}`,
  };
}
const sourcePaths = [
  "benchmarks/v1/game-ecs-frame-update/fixture.js",
  "benchmarks/v1/game-ecs-frame-update/engine.js",
  "benchmarks/v1/game-ecs-frame-update/ecs-frame-update.c",
  "benchmarks/v1/game-ecs-frame-update/implementation-contract.v1.json",
  "scripts/build-base-game-ecs-frame-update.ts",
  "schemas/game-ecs-frame-update-implementation.v1.schema.json",
  "public/benchmarks/game-ecs-frame-update/index.html",
  "public/demos/game-ecs-frame-update/demo.js",
  "public/demos/game-ecs-frame-update/worker.js",
  "server.ts",
  "catalog/workloads.v1.json",
  "deno.json",
  "deno.lock",
];
const references = await Promise.all(sourcePaths.map(reference));
const catalogReference = references.find(({ path }) => path === "catalog/workloads.v1.json");
if (!catalogReference) throw new Error("catalog reference missing");
const clang = new TextDecoder().decode(await command("clang", ["--version"])).split("\n")[0];
const wasmLd = new TextDecoder().decode(await command("wasm-ld", ["--version"])).trim();
const buildManifest = {
  schemaVersion: 1,
  workloadId: "game.ecs-frame-update.v1",
  source: {
    repository: "https://github.com/PaulKinlan/wasm-vs-js",
    commit: sourceCommit,
    references,
  },
  artifact: {
    path: "public/artifacts/game-ecs-frame-update-v1/ecs-frame-update.wasm",
    bytes: wasm.byteLength,
    sha256: artifactSha256,
    fixedMemoryBytes: 1_048_576,
  },
  fixture: { path: fixturePath, bytes: fixture.byteLength, sha256: fixtureSha256 },
  recipe: {
    path: "scripts/build-base-game-ecs-frame-update.ts",
    command:
      `deno run --allow-read=. --allow-write=public/artifacts/game-ecs-frame-update-v1,public/evidence/base-v1/game-ecs-frame-update-v1,catalog/implementations.v1 --allow-run=git,clang,wasm-ld scripts/build-base-game-ecs-frame-update.ts --source-commit=${sourceCommit}`,
    deno: Deno.version.deno,
    clang,
    wasmLd,
    compilerFlags,
    linkerFlags,
  },
};
await writeJson(new URL("build-manifest.json", artifactDir), buildManifest);
const evidenceBase = {
  schemaVersion: 1,
  status: "passed",
  workloadId: "game.ecs-frame-update.v1",
  sourceCommit,
  fixture: { bytes: fixture.byteLength, sha256: fixtureSha256 },
  artifact: { bytes: wasm.byteLength, sha256: artifactSha256 },
  oracle: {
    semanticDigest: js.semanticDigest,
    finalStateDigest: js.oracle.finalStateDigest,
    finalStateSha256,
    checkpointDigest: js.oracle.checkpointDigest,
    checkpoints: js.oracle.checkpoints,
    finalStateWords: js.oracle.finalState.length,
    integerTolerance: 0,
  },
  completeStateComparedAcrossTargets: true,
  performanceClaims: [],
};
const jsEvidencePath = "public/evidence/base-v1/game-ecs-frame-update-v1/js-controlled.json";
const wasmEvidencePath =
  "public/evidence/base-v1/game-ecs-frame-update-v1/wasm-linear-controlled.json";
await writeJson(new URL("js-controlled.json", evidenceDir), {
  ...evidenceBase,
  variantId: "js-controlled",
  executionTarget: "javascript",
  counters: js.counters,
});
await writeJson(new URL("wasm-linear-controlled.json", evidenceDir), {
  ...evidenceBase,
  variantId: "wasm-linear-controlled",
  executionTarget: "wasm-linear",
  counters: linear.counters,
});
const registration = {
  schemaVersion: 1,
  workloadId: "game.ecs-frame-update.v1",
  catalogBinding: {
    catalogId: "workload-catalog-v1",
    path: "catalog/workloads.v1.json",
    catalogSha256: catalogReference.sha256,
    mutationPolicy: "byte-for-byte-frozen",
  },
  status: "implementation-candidate",
  source: {
    repository: "https://github.com/PaulKinlan/wasm-vs-js",
    commit: sourceCommit,
    references,
  },
  fixture: {
    path: fixturePath,
    bytes: fixture.byteLength,
    sha256: fixtureSha256,
    licenseSpdx: "CC0-1.0",
    redistribution: "permitted",
    entities: 10_000,
    frames: 1_000,
    seed: 1858462077,
  },
  oracle: {
    kind: "canonical-semantic",
    algorithmFamily: "ecs-fixed-system-order",
    integerTolerance: 0,
    finalStateWords: js.oracle.finalState.length,
    finalStateDigest: js.oracle.finalStateDigest,
    checkpointDigest: js.oracle.checkpointDigest,
    semanticDigest: js.semanticDigest,
    counters: commonCounters(js.counters),
  },
  build: {
    artifact: "public/artifacts/game-ecs-frame-update-v1/ecs-frame-update.wasm",
    artifactSha256,
    recipe: "scripts/build-base-game-ecs-frame-update.ts",
    deno: Deno.version.deno,
    clang,
    wasmLd,
    compilerFlags,
    linkerFlags,
    memoryBytes: 1_048_576,
  },
  variants: [
    { id: "js-controlled", target: "javascript", status: "passed", evidence: jsEvidencePath },
    {
      id: "wasm-linear-controlled",
      target: "wasm-linear",
      status: "passed",
      evidence: wasmEvidencePath,
    },
  ],
  demo: {
    route: "/benchmarks/game-ecs-frame-update/",
    status: "runnable-correctness",
    timeoutMs: 120_000,
    persistence: false,
    upload: false,
    ranking: false,
  },
  performanceClaims: [],
};
await writeJson(registrationUrl, registration);
console.log(
  `game.ecs-frame-update.v1 evidence: ${sourceCommit}; fixture ${fixtureSha256}; artifact ${artifactSha256}; semantic ${js.semanticDigest}`,
);

import { sha256Hex } from "../lib/canonical.ts";
import { generateFixture } from "../benchmarks/base/simulation-nbody/fixture.js";
import {
  assertEquivalent,
  instantiateNbodyWasm,
  runJavaScript,
  runWasm,
} from "../benchmarks/base/simulation-nbody/engine.js";

if (Deno.version.deno !== "2.9.0") {
  throw new Error(`Deno 2.9.0 required, found ${Deno.version.deno}`);
}
const root = new URL("../", import.meta.url);
const artifactDir = new URL("public/artifacts/base-simulation-nbody/", root);
const evidenceDir = new URL("public/evidence/base-catalog/simulation-nbody-cloth/", root);
const sourceOnly = Deno.args.includes("--source-only");
const sourceCommit = Deno.args.find((arg) => arg.startsWith("--source-commit="))?.split("=")[1] ??
  "";
if (!sourceOnly && !/^[a-f0-9]{40}$/.test(sourceCommit)) {
  throw new Error("--source-commit=<40 lowercase hex> required");
}
await Deno.mkdir(artifactDir, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });

async function command(name: string, args: string[]) {
  const result = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return result.stdout;
}
const buildDir = new URL(".build/", artifactDir);
await Deno.remove(buildDir, { recursive: true }).catch(() => {});
await Deno.mkdir(buildDir, { recursive: true });
try {
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-c",
    "benchmarks/base/simulation-nbody/nbody.c",
    "-o",
    `${buildDir.pathname}nbody.o`,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=input_ptr",
    "--export=output_ptr",
    "--export=run",
    "--export=run_small",
    "--initial-memory=4194304",
    "--max-memory=4194304",
    "--stack-first",
    `${buildDir.pathname}nbody.o`,
    "-o",
    `${buildDir.pathname}nbody.wasm`,
  ]);
  await Deno.writeFile(
    new URL("nbody.wasm", artifactDir),
    await Deno.readFile(`${buildDir.pathname}nbody.wasm`),
  );
} finally {
  await Deno.remove(buildDir, { recursive: true });
}
const fixture = generateFixture();
await Deno.writeFile(new URL("fixture.bin", artifactDir), fixture);
const js = runJavaScript(fixture);
await Deno.writeFile(new URL("reference-output.bin", artifactDir), js.output);
const wasmBytes = await Deno.readFile(new URL("nbody.wasm", artifactDir));
const wasm = runWasm(await instantiateNbodyWasm(wasmBytes), fixture);
const equivalence = assertEquivalent(js, wasm);
const outputSha256 = await sha256Hex(js.output);
const outputManifest = {
  schemaVersion: 1,
  catalogId: "workload-catalog-v1",
  workloadId: "simulation.nbody-cloth.v1",
  status: "implementation-candidate",
  exactCrossTargetBytes: js.completeOutputDigest === wasm.completeOutputDigest,
  completeOutputSha256: outputSha256,
  quantizedStateDigest: js.quantizedStateDigest,
  maxAbsoluteDifference: equivalence.maxAbsoluteDifference,
  tolerance: equivalence.tolerance,
  energy: js.energy,
  checkpoints: js.checkpoints,
  counters: js.counters,
  performanceClaims: [],
};
await Deno.writeTextFile(
  new URL("output-manifest.json", artifactDir),
  `${JSON.stringify(outputManifest, null, 2)}\n`,
);
if (sourceOnly) {
  console.log(
    `source-only: ${fixture.length} fixture bytes, ${wasmBytes.length} Wasm bytes, ${js.output.length} output bytes`,
  );
  Deno.exit(0);
}

async function gitBytes(path: string) {
  return await command("git", ["show", `${sourceCommit}:${path}`]);
}
async function fileRef(path: string, immutable = true) {
  const bytes = await Deno.readFile(new URL(path, root));
  if (immutable) {
    const tree = await gitBytes(path);
    if (await sha256Hex(tree) !== await sha256Hex(bytes)) {
      throw new Error(`source tree mismatch: ${path}`);
    }
  }
  return {
    path,
    bytes: bytes.length,
    sha256: await sha256Hex(bytes),
    ...(immutable
      ? { immutableUrl: `https://github.com/PaulKinlan/wasm-vs-js/blob/${sourceCommit}/${path}` }
      : {}),
  };
}
const sourcePaths = [
  "benchmarks/base/simulation-nbody/contract.js",
  "benchmarks/base/simulation-nbody/fixture.js",
  "benchmarks/base/simulation-nbody/engine.js",
  "benchmarks/base/simulation-nbody/nbody.c",
  "catalog/base-implementations.v1/simulation.nbody-cloth.v1.json",
  "schemas/base-workload-validation-record.schema.json",
  "scripts/build-base-simulation-nbody.ts",
  "public/demos/simulation-nbody-cloth/index.html",
  "public/demos/simulation-nbody-cloth/demo.js",
  "public/demos/simulation-nbody-cloth/worker.js",
  "server.ts",
  "tests/base/simulation-nbody.test.ts",
  "public/artifacts/base-simulation-nbody/nbody.wasm",
  "public/artifacts/base-simulation-nbody/fixture.bin",
  "public/artifacts/base-simulation-nbody/reference-output.bin",
  "deno.json",
  "deno.lock",
];
const sourceFiles = await Promise.all(sourcePaths.map((path) => fileRef(path)));
const fixtureRef = await fileRef("public/artifacts/base-simulation-nbody/fixture.bin");
const wasmRef = await fileRef("public/artifacts/base-simulation-nbody/nbody.wasm");
const jsRef = await fileRef("benchmarks/base/simulation-nbody/engine.js");
const outputRef = await fileRef("public/artifacts/base-simulation-nbody/reference-output.bin");
const clangVersion = new TextDecoder().decode(await command("clang", ["--version"])).split("\n")[0];
const linkerVersion = new TextDecoder().decode(await command("wasm-ld", ["--version"])).trim();
const fixtureManifest = {
  schemaVersion: 1,
  immutable: true,
  workloadId: "simulation.nbody-cloth.v1",
  generator: {
    path: "benchmarks/base/simulation-nbody/fixture.js",
    seed: "0x31c0ffee",
    stateLayout: "mass,x,y,z,vx,vy,vz structure-of-arrays f64 little-endian",
  },
  rights: {
    license: "CC0-1.0",
    redistribution: "permitted",
    provenance: "Generated solely by committed xorshift32 source; no external inputs or user data.",
  },
  fixture: fixtureRef,
};
await Deno.writeTextFile(
  new URL("fixture-manifest.json", artifactDir),
  `${JSON.stringify(fixtureManifest, null, 2)}\n`,
);
const buildManifest = {
  schemaVersion: 1,
  workloadId: "simulation.nbody-cloth.v1",
  source: {
    repository: "https://github.com/PaulKinlan/wasm-vs-js",
    commit: sourceCommit,
    files: sourceFiles,
  },
  build: {
    command:
      "deno run --allow-read=. --allow-write=public/artifacts/base-simulation-nbody,public/evidence/base-catalog/simulation-nbody-cloth --allow-run=git,clang,wasm-ld scripts/build-base-simulation-nbody.ts --source-commit=<commit>",
    toolchain: { deno: Deno.version.deno, clang: clangVersion, linker: linkerVersion },
    compilerFlags: [
      "--target=wasm32-unknown-unknown",
      "-O3",
      "-nostdlib",
      "-ffreestanding",
      "-fno-builtin",
    ],
    linkerFlags: [
      "--no-entry",
      "--export-memory",
      "--initial-memory=4194304",
      "--max-memory=4194304",
      "--stack-first",
    ],
    fixedMemory: { initialPages: 64, maximumPages: 64, growth: false },
  },
  artifacts: { fixture: fixtureRef, wasm: wasmRef, referenceOutput: outputRef },
  performanceClaims: [],
};
await Deno.writeTextFile(
  new URL("build-manifest.json", artifactDir),
  `${JSON.stringify(buildManifest, null, 2)}\n`,
);
for (
  const [variantId, executionTarget, artifact, result] of [
    ["js-controlled", "javascript", jsRef, js],
    ["wasm-linear-controlled", "wasm-linear", wasmRef, wasm],
  ] as const
) {
  const record = {
    schemaVersion: 1,
    catalogId: "workload-catalog-v1",
    workloadId: "simulation.nbody-cloth.v1",
    status: "implementation-candidate",
    variantId,
    executionTarget,
    source: {
      repository: "https://github.com/PaulKinlan/wasm-vs-js",
      commit: sourceCommit,
      files: sourceFiles,
    },
    fixture: fixtureRef,
    artifact,
    oracle: {
      completeOutputSha256: await sha256Hex(result.output),
      quantizedStateDigest: result.quantizedStateDigest,
      maxAbsoluteDifference: equivalence.maxAbsoluteDifference,
      tolerance: equivalence.tolerance,
      energyRelativeDrift: result.energy.relativeDrift,
      energyTolerance: result.energy.tolerance,
      checkpoints: result.checkpoints,
    },
    counters: result.counters,
    performanceClaims: [],
  };
  await Deno.writeTextFile(
    new URL(`${variantId}.json`, evidenceDir),
    `${JSON.stringify(record, null, 2)}\n`,
  );
}
console.log(
  `built simulation.nbody-cloth.v1: ${outputSha256}, exact max difference ${equivalence.maxAbsoluteDifference}`,
);

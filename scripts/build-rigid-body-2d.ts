import { sha256Hex } from "../lib/canonical.ts";
import {
  BODY_WORDS,
  generateRigidBodyFixture,
  HEADER_BYTES,
  RIGID_CONFIG,
} from "../benchmarks/v1/simulation-rigid-body-2d/fixture.js";
import {
  compareRigidBodyResults,
  instantiateRigidBodyWasm,
  runRigidBodyJavaScript,
  runRigidBodyWasm,
} from "../benchmarks/v1/simulation-rigid-body-2d/engine.js";

const root = new URL("../", import.meta.url);
const artifactDir = new URL("public/artifacts/simulation-rigid-body-2d-v1/", root);
const evidenceDir = new URL("public/evidence/v1-base/simulation-rigid-body-2d-v1/", root);
const sourceArg = Deno.args.find((value) => value.startsWith("--source-commit="));
const sourceCommit = sourceArg?.slice("--source-commit=".length) ?? "uncommitted-candidate";
const sourceOnly = Deno.args.includes("--source-only");
await Deno.mkdir(artifactDir, { recursive: true });
await Deno.mkdir(evidenceDir, { recursive: true });
for (
  const name of [
    "simulation-rigid-body-2d-contract.schema.json",
    "simulation-rigid-body-2d-fixture-manifest.schema.json",
    "simulation-rigid-body-2d-output-manifest.schema.json",
    "simulation-rigid-body-2d-build-manifest.schema.json",
    "simulation-rigid-body-2d-result.schema.json",
  ]
) {
  await Deno.writeFile(
    new URL(`public/data/${name}`, root),
    await Deno.readFile(new URL(`schemas/${name}`, root)),
  );
}

async function command(name: string, args: string[]) {
  const output = await new Deno.Command(name, {
    args,
    cwd: root.pathname,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(new TextDecoder().decode(output.stderr));
  return new TextDecoder().decode(output.stdout).trim();
}

const buildDir = new URL(".build/", artifactDir);
await Deno.remove(buildDir, { recursive: true }).catch((error) => {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
});
await Deno.mkdir(buildDir, { recursive: true });
try {
  await command("clang", [
    "--target=wasm32-unknown-unknown",
    "-O3",
    "-nostdlib",
    "-ffreestanding",
    "-fno-builtin",
    "-ffp-contract=off",
    "-fno-fast-math",
    "-c",
    "benchmarks/v1/simulation-rigid-body-2d/rigid-body-2d.c",
    "-o",
    new URL("rigid-body-2d.o", buildDir).pathname,
  ]);
  await command("wasm-ld", [
    "--no-entry",
    "--export-memory",
    "--export=fixture_ptr",
    "--export=result_ptr",
    "--export=run",
    "--initial-memory=2097152",
    "--max-memory=2097152",
    "--stack-first",
    new URL("rigid-body-2d.o", buildDir).pathname,
    "-o",
    new URL("rigid-body-2d.wasm", buildDir).pathname,
  ]);
  await Deno.writeFile(
    new URL("rigid-body-2d.wasm", artifactDir),
    await Deno.readFile(new URL("rigid-body-2d.wasm", buildDir)),
  );
} finally {
  await Deno.remove(buildDir, { recursive: true });
}

const fixture = generateRigidBodyFixture();
await Deno.writeFile(new URL("fixture.bin", artifactDir), fixture);
const wasmBytes = await Deno.readFile(new URL("rigid-body-2d.wasm", artifactDir));
const wasm = await instantiateRigidBodyWasm(wasmBytes);
const js = runRigidBodyJavaScript(fixture);
const wasmResult = runRigidBodyWasm(fixture, wasm);
const comparison = compareRigidBodyResults(js, wasmResult);
const fixtureView = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
let initialEnergy = 0;
for (let id = 0; id < RIGID_CONFIG.bodies; id += 1) {
  const offset = HEADER_BYTES + id * BODY_WORDS * 4;
  const xVelocity = fixtureView.getFloat32(offset + 12, true);
  const yVelocity = fixtureView.getFloat32(offset + 16, true);
  const angularVelocity = fixtureView.getFloat32(offset + 20, true);
  const inverseMass = fixtureView.getFloat32(offset + 24, true);
  const inverseInertia = fixtureView.getFloat32(offset + 28, true);
  const y = fixtureView.getFloat32(offset + 4, true);
  const mass = 1 / inverseMass;
  const inertia = 1 / inverseInertia;
  initialEnergy += 0.5 * mass * (xVelocity * xVelocity + yVelocity * yVelocity) +
    0.5 * inertia * angularVelocity * angularVelocity + mass * -RIGID_CONFIG.gravityY * y;
}
if (!comparison.passed) {
  throw new Error(`rigid-body cross-target mismatch ${JSON.stringify(comparison)}`);
}
for (const [name, result] of [["javascript", js], ["wasm-linear", wasmResult]] as const) {
  if (result.metrics.groundPenetration > 0.002) throw new Error(`${name} ground penetration`);
  if (result.metrics.jointAnchorError > 0.004) throw new Error(`${name} joint anchor error`);
  if (result.metrics.contactPenetration > 0.025) throw new Error(`${name} contact penetration`);
  if (result.metrics.maxSpeed > 0.04 || result.metrics.maxAngularSpeed > 0.04) {
    throw new Error(`${name} did not settle`);
  }
  if (result.metrics.totalEnergy < 0 || result.metrics.totalEnergy > initialEnergy * 1.01) {
    throw new Error(`${name} energy envelope`);
  }
}
const referenceBytes = new Uint8Array(js.checkpoints.buffer.slice(0));
await Deno.writeFile(new URL("reference-checkpoints.f32le", artifactDir), referenceBytes);

const paths = [
  "benchmarks/v1/simulation-rigid-body-2d/contract.v1.json",
  "benchmarks/v1/simulation-rigid-body-2d/fixture.js",
  "benchmarks/v1/simulation-rigid-body-2d/engine.js",
  "benchmarks/v1/simulation-rigid-body-2d/rigid-body-2d.c",
  "scripts/build-rigid-body-2d.ts",
  "schemas/simulation-rigid-body-2d-contract.schema.json",
  "schemas/simulation-rigid-body-2d-fixture-manifest.schema.json",
  "schemas/simulation-rigid-body-2d-output-manifest.schema.json",
  "schemas/simulation-rigid-body-2d-build-manifest.schema.json",
  "schemas/simulation-rigid-body-2d-result.schema.json",
  "public/benchmarks/simulation-rigid-body-2d-v1/index.html",
  "public/benchmarks/simulation-rigid-body-2d-v1/runner.js",
  "public/benchmarks/simulation-rigid-body-2d-v1/worker.js",
  "server.ts",
  "deno.json",
  "deno.lock",
];
const sourceGraph = [];
for (const path of paths) {
  const bytes = await Deno.readFile(new URL(path, root));
  const hash = await sha256Hex(bytes);
  if (/^[a-f0-9]{40}$/.test(sourceCommit)) {
    const committed = await new Deno.Command("git", {
      args: ["show", `${sourceCommit}:${path}`],
      cwd: root.pathname,
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!committed.success || await sha256Hex(committed.stdout) !== hash) {
      throw new Error(`source tree mismatch at ${path}`);
    }
  }
  sourceGraph.push({ path, sha256: hash });
}
const frozenCatalog = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
const publicCatalog = await Deno.readFile(new URL("public/data/workloads.v1.json", root));
const frozenHash = await sha256Hex(frozenCatalog);
if (frozenHash !== "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4") {
  throw new Error("frozen catalog hash changed");
}
if (await sha256Hex(publicCatalog) !== frozenHash) {
  throw new Error("public frozen catalog mismatch");
}
const clangVersion = (await command("clang", ["--version"])).split("\n")[0];
const linkerVersion = (await command("wasm-ld", ["--version"])).split("\n")[0];
const denoVersion = Deno.version.deno;
if (denoVersion !== "2.9.0") throw new Error(`Deno 2.9.0 required, got ${denoVersion}`);
const fixtureManifest = {
  schemaVersion: 1,
  registrationId: "simulation-rigid-body-2d-v1-controlled",
  frozenCatalogId: RIGID_CONFIG.id,
  frozenCatalogSha256: frozenHash,
  sourceCommit,
  fixture: {
    path: "public/artifacts/simulation-rigid-body-2d-v1/fixture.bin",
    bytes: fixture.length,
    sha256: await sha256Hex(fixture),
    generator: "generateRigidBodyFixture; xorshift32 seed 0x5242474e",
    licenseSpdx: "CC0-1.0",
    redistribution: "permitted",
    containsExternalData: false,
  },
};
const outputManifest = {
  schemaVersion: 1,
  status: "supplemental-validation-candidate",
  performanceClaims: [],
  oracle: {
    completeCheckpointValues: js.checkpoints.length,
    checkpoints: RIGID_CONFIG.checkpoints,
    absoluteTolerance: 0.0005,
    relativeTolerance: 0.00005,
    referencePath: "public/artifacts/simulation-rigid-body-2d-v1/reference-checkpoints.f32le",
    referenceSha256: await sha256Hex(referenceBytes),
    initialEnergy,
    finalEnergyMaximum: initialEnergy * 1.01,
    javascriptDigest: js.checkpointDigest,
    wasmDigest: wasmResult.checkpointDigest,
    comparison,
    javascriptMetrics: js.metrics,
    wasmMetrics: wasmResult.metrics,
  },
  counters: {
    javascript: js.counters,
    wasm: wasmResult.counters,
  },
};
const artifactSha256 = await sha256Hex(wasmBytes);
const fixtureSha256 = await sha256Hex(fixture);
const referenceSha256 = await sha256Hex(referenceBytes);
const recordValues = [
  {
    schemaVersion: 1,
    status: "supplemental-validation-candidate",
    frozenCatalogId: RIGID_CONFIG.id,
    registrationId: "simulation-rigid-body-2d-v1-controlled",
    variantId: "js-controlled",
    executionTarget: "javascript",
    sourceCommit,
    fixtureSha256,
    artifactSha256: null,
    referenceSha256,
    checkpointDigest: js.checkpointDigest,
    completeStateValues: js.checkpoints.length,
    counters: js.counters,
    metrics: js.metrics,
    performanceClaims: [],
  },
  {
    schemaVersion: 1,
    status: "supplemental-validation-candidate",
    frozenCatalogId: RIGID_CONFIG.id,
    registrationId: "simulation-rigid-body-2d-v1-controlled",
    variantId: "wasm-linear-controlled",
    executionTarget: "wasm-linear",
    sourceCommit,
    fixtureSha256,
    artifactSha256,
    referenceSha256,
    checkpointDigest: wasmResult.checkpointDigest,
    completeStateValues: wasmResult.checkpoints.length,
    counters: wasmResult.counters,
    metrics: wasmResult.metrics,
    performanceClaims: [],
  },
];
const jsonBytes = (value: unknown) =>
  new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
const resultRecords = [];
for (const record of recordValues) {
  const path = `public/evidence/v1-base/simulation-rigid-body-2d-v1/${record.variantId}.json`;
  const bytes = jsonBytes(record);
  await Deno.writeFile(new URL(path, root), bytes);
  resultRecords.push({ path, sha256: await sha256Hex(bytes) });
}
const buildManifest = {
  schemaVersion: 1,
  registrationId: "simulation-rigid-body-2d-v1-controlled",
  sourceCommit,
  toolchain: {
    deno: denoVersion,
    clang: clangVersion,
    linker: linkerVersion,
    target: "wasm32-unknown-unknown",
    flags: [
      "-O3",
      "-nostdlib",
      "-ffreestanding",
      "-fno-builtin",
      "-ffp-contract=off",
      "-fno-fast-math",
    ],
    memory: { initialBytes: 2097152, maximumBytes: 2097152, growth: false },
  },
  command:
    "deno run --allow-read=. --allow-write=public/artifacts,public/evidence,public/data --allow-run=clang,wasm-ld,git scripts/build-rigid-body-2d.ts --source-commit=<commit>",
  sourceGraph,
  artifact: {
    path: "public/artifacts/simulation-rigid-body-2d-v1/rigid-body-2d.wasm",
    bytes: wasmBytes.length,
    sha256: artifactSha256,
  },
  fixtureManifestSha256: "filled-after-serialization",
  outputManifestSha256: "filled-after-serialization",
  resultRecords,
};
const fixtureManifestBytes = jsonBytes(fixtureManifest);
const outputManifestBytes = jsonBytes(outputManifest);
buildManifest.fixtureManifestSha256 = await sha256Hex(fixtureManifestBytes);
buildManifest.outputManifestSha256 = await sha256Hex(outputManifestBytes);
await Deno.writeFile(new URL("fixture-manifest.json", artifactDir), fixtureManifestBytes);
await Deno.writeFile(new URL("output-manifest.json", artifactDir), outputManifestBytes);
await Deno.writeFile(new URL("build-manifest.json", artifactDir), jsonBytes(buildManifest));
if (!sourceOnly) {
  console.log(
    `rigid-body: ${wasmBytes.length} byte Wasm, ${js.checkpoints.length} complete state values, max error ${comparison.maximumAbsoluteError}`,
  );
}

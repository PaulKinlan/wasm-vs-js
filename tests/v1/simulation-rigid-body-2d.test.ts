import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../../lib/canonical.ts";
import { createHandler } from "../../server.ts";
import {
  BODY_WORDS,
  generateRigidBodyFixture,
  HEADER_BYTES,
  JOINT_BYTES,
  RIGID_CONFIG,
} from "../../benchmarks/v1/simulation-rigid-body-2d/fixture.js";
import {
  compareRigidBodyResults,
  instantiateRigidBodyWasm,
  runRigidBodyJavaScript,
  runRigidBodyWasm,
} from "../../benchmarks/v1/simulation-rigid-body-2d/engine.js";
import { assert, assertEquals } from "../assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const root = new URL("../../", import.meta.url);
const artifact = new URL("public/artifacts/simulation-rigid-body-2d-v1/", root);
const evidence = new URL("public/evidence/v1-base/simulation-rigid-body-2d-v1/", root);
const schemaNames = [
  "simulation-rigid-body-2d-contract.schema.json",
  "simulation-rigid-body-2d-fixture-manifest.schema.json",
  "simulation-rigid-body-2d-output-manifest.schema.json",
  "simulation-rigid-body-2d-build-manifest.schema.json",
  "simulation-rigid-body-2d-result.schema.json",
];

// Spawn the builder synchronously so it works in its own process while the
// test's synchronous JS physics below blocks this event loop. An async spawn
// would not actually start the child until the physics finished.
function spawnBuild() {
  const pinned = JSON.parse(
    Deno.readTextFileSync(new URL("build-manifest.json", artifact)),
  ).sourceCommit;
  return new Deno.Command(Deno.execPath(), {
    cwd: root,
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts,public/evidence,public/data",
      "--allow-run=clang,wasm-ld,git",
      "scripts/build-rigid-body-2d.ts",
      "--source-only",
      `--source-commit=${pinned}`,
    ],
    stdout: "piped",
    stderr: "piped",
  }).spawn();
}

async function finishBuild(child: Deno.ChildProcess) {
  const output = await child.output();
  assert(output.success, new TextDecoder().decode(output.stderr));
}
function controlledTwoBodyFixture(seed: number, joint = false) {
  const fixture = generateRigidBodyFixture().slice(), view = new DataView(fixture.buffer);
  view.setUint32(16, joint ? 1 : 0, true);
  for (let id = 0; id < RIGID_CONFIG.bodies; id += 1) {
    const offset = HEADER_BYTES + id * BODY_WORDS * 4;
    view.setFloat32(offset, 1000 + id * 3, true);
    view.setFloat32(offset + 4, 1000, true);
    view.setFloat32(offset + 8, 0, true);
    view.setFloat32(offset + 12, 0, true);
    view.setFloat32(offset + 16, 0, true);
    view.setFloat32(offset + 20, 0, true);
    view.setFloat32(offset + 24, 0, true);
    view.setFloat32(offset + 28, 0, true);
    view.setFloat32(offset + 32, 0.45, true);
    view.setFloat32(offset + 36, 0.42, true);
    view.setFloat32(offset + 40, 0, true);
  }
  const a = HEADER_BYTES, b = HEADER_BYTES + BODY_WORDS * 4;
  const jitter = ((seed >>> 8) & 15) * 0.001;
  for (const offset of [a, b]) {
    view.setFloat32(offset + 24, 1, true);
    view.setFloat32(offset + 28, 4, true);
  }
  view.setFloat32(a, 0, true);
  view.setFloat32(a + 4, 0.5, true);
  view.setFloat32(a + 8, 0.18, true);
  view.setFloat32(a + 20, 0.04, true);
  view.setFloat32(b, joint ? 0.95 : 0.1, true);
  view.setFloat32(b + 4, joint ? 1.4 : 1.22 - jitter, true);
  view.setFloat32(b + 8, -0.21, true);
  view.setFloat32(b + 16, -0.1, true);
  if (joint) {
    const offset = HEADER_BYTES + RIGID_CONFIG.bodies * BODY_WORDS * 4;
    view.setUint32(offset, 0, true);
    view.setUint32(offset + 4, 1, true);
    view.setFloat32(offset + 8, 0.45, true);
    view.setFloat32(offset + 12, 0.1, true);
    view.setFloat32(offset + 16, -0.45, true);
    view.setFloat32(offset + 20, -0.1, true);
    view.setFloat32(offset + 24, 1, true);
    view.setFloat32(offset + 28, 0.8, true);
    assertEquals(JOINT_BYTES, 32);
  }
  return fixture;
}
function clone<T>(value: T): T {
  return structuredClone(value);
}

Deno.test("oriented rigid-body implementation is reproducible, differential, complete, and operative", async () => {
  const catalogBefore = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
  assertEquals(
    await sha256Hex(catalogBefore),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  // Spawn the reproducible build, then run the JS-side physics while the
  // builder works in its own process. The build rewrites the artifact in
  // place, so everything that touches wasm bytes still happens after the
  // build promise resolves; only pure-JS computation moves earlier.
  const build = spawnBuild();
  const fixture = generateRigidBodyFixture();
  let jsAllocations = 0;
  const js = runRigidBodyJavaScript(fixture, { onAllocate: () => jsAllocations++ });
  const seedRuns = [];
  for (let seed = 1; seed <= 8; seed += 1) {
    const seedFixture = controlledTwoBodyFixture(Math.imul(seed, 0x9e3779b9), seed % 2 === 0);
    const options = { timesteps: 12, checkpointEvery: 3, allowTestFixture: true };
    seedRuns.push({
      seed,
      fixture: seedFixture,
      options,
      js: runRigidBodyJavaScript(seedFixture, options),
    });
  }
  await finishBuild(build);
  assertEquals(
    await sha256Hex(await Deno.readFile(new URL("catalog/workloads.v1.json", root))),
    await sha256Hex(catalogBefore),
  );
  const wasmBytes = await Deno.readFile(new URL("rigid-body-2d.wasm", artifact));
  const module = await WebAssembly.compile(wasmBytes);
  assertEquals(WebAssembly.Module.imports(module), []);
  const exportNames = WebAssembly.Module.exports(module).map(({ name }) => name);
  for (const name of ["memory", "fixture_ptr", "result_ptr", "run"]) {
    assert(exportNames.includes(name));
  }
  const wasm = await instantiateRigidBodyWasm(wasmBytes);
  for (const { seed, fixture: seedFixture, options, js: seedJs } of seedRuns) {
    const linear = runRigidBodyWasm(seedFixture, wasm, options);
    const comparison = compareRigidBodyResults(seedJs, linear, 0, 0);
    assert(comparison.passed, `oriented scene ${seed}: ${JSON.stringify(comparison)}`);
    assertEquals(seedJs.counters.rotatedManifoldTests, linear.counters.rotatedManifoldTests);
    assertEquals(seedJs.counters.angularContactImpulses, linear.counters.angularContactImpulses);
    assertEquals(seedJs.counters.jointImpulses, linear.counters.jointImpulses);
  }
  let wasmAllocations = 0;
  const boundaries: string[] = [];
  const linear = runRigidBodyWasm(fixture, wasm, {
    onAllocate: () => wasmAllocations++,
    onBoundary: (name: string) => boundaries.push(name),
  });
  const comparison = compareRigidBodyResults(js, linear);
  assert(comparison.passed, JSON.stringify(comparison));
  assertEquals(comparison.maximumAbsoluteError, 0);
  assertEquals(js.checkpoints.length, 18_000);
  assertEquals(linear.checkpoints.length, 18_000);
  assertEquals(js.counters.timesteps, 1_800);
  assertEquals(js.counters.velocityIterations, 10_800);
  assertEquals(js.counters.positionIterations, 115_200);
  assertEquals(js.counters.jointImpulses, 2_394_000);
  assertEquals(js.counters.torqueApplications, 60_000);
  for (
    const key of [
      "broadphasePairs",
      "rotatedManifoldTests",
      "manifolds",
      "contactPoints",
      "normalImpulses",
      "frictionImpulses",
      "angularContactImpulses",
      "jointImpulses",
    ] as const
  ) {
    assert(js.counters[key] > 0, key);
    assertEquals(js.counters[key], linear.counters[key]);
  }
  assertEquals(js.counters.typedArrayAllocations, jsAllocations);
  assertEquals(jsAllocations, 28);
  assertEquals(linear.counters.typedArrayAllocations, wasmAllocations);
  assertEquals(wasmAllocations, 5);
  assertEquals(boundaries, ["fixture_ptr", "run", "result_ptr"]);
  assertEquals(linear.counters.exportedCallBoundaries, boundaries.length);
  assertEquals(js.metrics.groundPenetration <= 0.002, true);
  assertEquals(js.metrics.jointAnchorError <= 0.004, true);
  assertEquals(js.metrics.contactPenetration <= 0.025, true);
  assertEquals(js.metrics.maxSpeed <= 0.04, true);
  assertEquals(js.metrics.maxAngularSpeed <= 0.04, true);

  const fixtureManifest = JSON.parse(
    await Deno.readTextFile(new URL("fixture-manifest.json", artifact)),
  );
  const outputManifest = JSON.parse(
    await Deno.readTextFile(new URL("output-manifest.json", artifact)),
  );
  const buildManifest = JSON.parse(
    await Deno.readTextFile(new URL("build-manifest.json", artifact)),
  );
  assertEquals(fixtureManifest.fixture.sha256, await sha256Hex(fixture));
  assertEquals(outputManifest.performanceClaims, []);
  assert(outputManifest.oracle.initialEnergy <= outputManifest.oracle.finalEnergyMaximum);
  assert(
    outputManifest.oracle.javascriptMetrics.totalEnergy <= outputManifest.oracle.finalEnergyMaximum,
  );
  assertEquals(buildManifest.toolchain.deno, "2.9.0");
  assertEquals(buildManifest.artifact.sha256, await sha256Hex(wasmBytes));
  assertEquals(buildManifest.resultRecords.length, 2);
  for (const record of buildManifest.resultRecords) {
    assertEquals(record.sha256, await sha256Hex(await Deno.readFile(new URL(record.path, root))));
  }
});

Deno.test("rigid-body schemas close every contract, manifest, and result with negative cases", async () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validators = new Map<string, Validator>();
  for (const name of schemaNames) {
    const schemaBytes = await Deno.readFile(new URL(`schemas/${name}`, root));
    assertEquals(schemaBytes, await Deno.readFile(new URL(`public/data/${name}`, root)));
    validators.set(name, ajv.compile(JSON.parse(new TextDecoder().decode(schemaBytes))));
  }
  const contract = JSON.parse(
    await Deno.readTextFile(
      new URL("benchmarks/v1/simulation-rigid-body-2d/contract.v1.json", root),
    ),
  );
  const fixtureManifest = JSON.parse(
    await Deno.readTextFile(new URL("fixture-manifest.json", artifact)),
  );
  const outputManifest = JSON.parse(
    await Deno.readTextFile(new URL("output-manifest.json", artifact)),
  );
  const buildManifest = JSON.parse(
    await Deno.readTextFile(new URL("build-manifest.json", artifact)),
  );
  const jsRecord = JSON.parse(await Deno.readTextFile(new URL("js-controlled.json", evidence)));
  const wasmRecord = JSON.parse(
    await Deno.readTextFile(new URL("wasm-linear-controlled.json", evidence)),
  );
  const cases: Array<[string, unknown]> = [
    [schemaNames[0], contract],
    [schemaNames[1], fixtureManifest],
    [schemaNames[2], outputManifest],
    [schemaNames[3], buildManifest],
    [schemaNames[4], jsRecord],
    [schemaNames[4], wasmRecord],
  ];
  for (const [name, value] of cases) {
    assert(
      validators.get(name)!(value),
      `${name}: ${JSON.stringify(validators.get(name)!.errors)}`,
    );
  }
  const negatives: Array<[string, unknown]> = [];
  const badContract = clone(contract);
  badContract.translationOnly = true;
  negatives.push([schemaNames[0], badContract]);
  const badFixture = clone(fixtureManifest);
  delete badFixture.fixture.sha256;
  negatives.push([schemaNames[1], badFixture]);
  const badOutput = clone(outputManifest);
  delete badOutput.counters.wasm.angularContactImpulses;
  negatives.push([schemaNames[2], badOutput]);
  const badBuild = clone(buildManifest);
  badBuild.resultRecords = [];
  negatives.push([schemaNames[3], badBuild]);
  const badJs = clone(jsRecord);
  badJs.executionTarget = "wasm-linear";
  negatives.push([schemaNames[4], badJs]);
  const badWasm = clone(wasmRecord);
  badWasm.extra = 1;
  negatives.push([schemaNames[4], badWasm]);
  for (const [name, value] of negatives) {
    assert(!validators.get(name)!(value), `${name} accepted negative`);
  }
});

Deno.test("rigid-body route allowlist serves schemas and immutable result records", async () => {
  const handler = createHandler(null, "public");
  const paths = [
    "/benchmarks/simulation-rigid-body-2d-v1/",
    "/benchmarks/simulation-rigid-body-2d-v1/runner.js",
    "/benchmarks/simulation-rigid-body-2d-v1/worker.js",
    "/benchmarks/v1/simulation-rigid-body-2d/engine.js",
    "/artifacts/simulation-rigid-body-2d-v1/rigid-body-2d.wasm",
    "/artifacts/simulation-rigid-body-2d-v1/fixture.bin",
    "/artifacts/simulation-rigid-body-2d-v1/reference-checkpoints.f32le",
    "/artifacts/simulation-rigid-body-2d-v1/build-manifest.json",
    "/evidence/v1-base/simulation-rigid-body-2d-v1/js-controlled.json",
    "/evidence/v1-base/simulation-rigid-body-2d-v1/wasm-linear-controlled.json",
    ...schemaNames.map((name) => `/data/${name}`),
  ];
  for (const path of paths) {
    assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 200);
  }
  const runner = await Deno.readTextFile(
    new URL("public/benchmarks/simulation-rigid-body-2d-v1/runner.js", root),
  );
  const html = await Deno.readTextFile(
    new URL("public/benchmarks/simulation-rigid-body-2d-v1/index.html", root),
  );
  for (const required of ["new Worker", "terminate()", "30_000", "token", "pagehide"]) {
    assert(runner.includes(required));
  }
  assert(html.includes("aria-live"));
  assert(html.includes("18,000"));
  assert(html.includes("oriented-box SAT"));
  assertEquals(
    (await handler(
      new Request("http://127.0.0.1/benchmarks/simulation-rigid-body-2d-v1/unknown.js"),
    )).status,
    404,
  );
});

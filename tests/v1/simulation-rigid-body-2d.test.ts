import { sha256Hex } from "../../lib/canonical.ts";
import { createHandler } from "../../server.ts";
import {
  generateRigidBodyFixture,
  RIGID_CONFIG,
} from "../../benchmarks/v1/simulation-rigid-body-2d/fixture.js";
import {
  compareRigidBodyResults,
  instantiateRigidBodyWasm,
  runRigidBodyJavaScript,
  runRigidBodyWasm,
} from "../../benchmarks/v1/simulation-rigid-body-2d/engine.js";
import { assert, assertEquals } from "../assert.ts";

const root = new URL("../../", import.meta.url);
const artifact = new URL("public/artifacts/simulation-rigid-body-2d-v1/", root);

async function build() {
  const command = new Deno.Command(Deno.execPath(), {
    cwd: root,
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts",
      "--allow-run=clang,wasm-ld",
      "scripts/build-rigid-body-2d.ts",
      "--source-only",
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  assert(output.success, new TextDecoder().decode(output.stderr));
}

function controlledTwoBodyFixture(seed: number, joint = false) {
  const fixture = generateRigidBodyFixture().slice();
  const view = new DataView(fixture.buffer);
  view.setUint32(16, joint ? 1 : 0, true);
  for (let id = 0; id < RIGID_CONFIG.bodies; id += 1) {
    const offset = 64 + id * 28;
    view.setFloat32(offset, 1000 + id * 3, true);
    view.setFloat32(offset + 4, 1000, true);
    view.setFloat32(offset + 8, 0, true);
    view.setFloat32(offset + 12, 0, true);
    view.setFloat32(offset + 16, 0, true);
    view.setFloat32(offset + 20, 0.5, true);
    view.setFloat32(offset + 24, 0.5, true);
  }
  const offsetA = 64, offsetB = 64 + 28;
  const jitter = ((seed >>> 8) & 15) * 0.001;
  view.setFloat32(offsetA, 0, true);
  view.setFloat32(offsetA + 4, 0.5, true);
  view.setFloat32(offsetA + 16, 1, true);
  view.setFloat32(offsetB, joint ? 1.02 : 0, true);
  view.setFloat32(offsetB + 4, joint ? 2 : 1.45 - jitter, true);
  view.setFloat32(offsetB + 12, -0.1, true);
  view.setFloat32(offsetB + 16, 1, true);
  if (joint) {
    const jointOffset = 64 + RIGID_CONFIG.bodies * 28;
    view.setUint32(jointOffset, 0, true);
    view.setUint32(jointOffset + 4, 1, true);
    view.setFloat32(jointOffset + 8, Math.fround(Math.hypot(1.02, 1.5)), true);
    view.setFloat32(jointOffset + 12, 0.8, true);
  }
  return fixture;
}

Deno.test("frozen rigid-body base implementation is reproducible, differential, complete, and routed", async () => {
  const catalogBefore = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
  assertEquals(
    await sha256Hex(catalogBefore),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  await build();
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

  for (let seed = 1; seed <= 8; seed += 1) {
    const fixture = controlledTwoBodyFixture(Math.imul(seed, 0x9e3779b9), seed % 2 === 0);
    const options = { timesteps: 12, checkpointEvery: 3, allowTestFixture: true };
    const js = runRigidBodyJavaScript(fixture, options);
    const linear = runRigidBodyWasm(fixture, wasm, options);
    const comparison = compareRigidBodyResults(js, linear, 0, 0);
    assert(comparison.passed, `small-scene seed ${seed}: ${JSON.stringify(comparison)}`);
    assertEquals(js.counters.broadphasePairs, linear.counters.broadphasePairs);
    assertEquals(js.counters.contactConstraints, linear.counters.contactConstraints);
    assertEquals(js.counters.jointConstraints, linear.counters.jointConstraints);
    for (const value of linear.checkpoints) assert(Number.isFinite(value));
  }

  const fixture = generateRigidBodyFixture();
  const js = runRigidBodyJavaScript(fixture);
  const linear = runRigidBodyWasm(fixture, wasm);
  const comparison = compareRigidBodyResults(js, linear);
  assert(comparison.passed, JSON.stringify(comparison));
  assertEquals(comparison.maximumAbsoluteError, 0);
  assertEquals(js.checkpoints.length, 12_000);
  assertEquals(linear.checkpoints.length, 12_000);
  assertEquals(js.counters.timesteps, 1_800);
  assertEquals(js.counters.velocityIterations, 7_200);
  assertEquals(js.counters.positionIterations, 115_200);
  assertEquals(js.counters.jointConstraints, 2_325_600);
  assertEquals(js.counters.broadphasePairs, linear.counters.broadphasePairs);
  assertEquals(js.counters.narrowphaseTests, linear.counters.narrowphaseTests);
  assertEquals(js.counters.contacts, linear.counters.contacts);
  assertEquals(js.counters.contactConstraints, linear.counters.contactConstraints);
  assertEquals(js.counters.jointConstraints, linear.counters.jointConstraints);
  assertEquals(js.metrics.groundPenetration, 0);
  assert(js.metrics.contactPenetration <= 0.003);
  assert(js.metrics.jointLengthError <= 0.0031);
  assert(js.metrics.maxSpeed <= 0.025);

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
  assertEquals(fixtureManifest.fixture.licenseSpdx, "CC0-1.0");
  assertEquals(outputManifest.performanceClaims, []);
  assertEquals(buildManifest.toolchain.deno, "2.9.0");
  assertEquals(buildManifest.artifact.sha256, await sha256Hex(wasmBytes));
  assert(
    buildManifest.sourceGraph.some(({ path }: { path: string }) =>
      path.endsWith("rigid-body-2d.c")
    ),
  );

  const handler = createHandler(null, "public");
  for (
    const path of [
      "/benchmarks/simulation-rigid-body-2d-v1/",
      "/benchmarks/simulation-rigid-body-2d-v1/runner.js",
      "/benchmarks/simulation-rigid-body-2d-v1/worker.js",
      "/benchmarks/v1/simulation-rigid-body-2d/engine.js",
      "/artifacts/simulation-rigid-body-2d-v1/rigid-body-2d.wasm",
      "/artifacts/simulation-rigid-body-2d-v1/fixture.bin",
      "/artifacts/simulation-rigid-body-2d-v1/reference-checkpoints.f32le",
      "/artifacts/simulation-rigid-body-2d-v1/build-manifest.json",
    ]
  ) {
    const response = await handler(new Request(`http://127.0.0.1${path}`));
    assert(response.status === 200, `${path}: ${response.status}`);
  }
  const runner = await Deno.readTextFile(
    new URL("public/benchmarks/simulation-rigid-body-2d-v1/runner.js", root),
  );
  for (
    const required of ["new Worker", "terminate()", "30_000", "token", "pagehide", "aria-live"]
  ) {
    const haystack = required === "aria-live"
      ? await Deno.readTextFile(
        new URL("public/benchmarks/simulation-rigid-body-2d-v1/index.html", root),
      )
      : runner;
    assert(haystack.includes(required), required);
  }
  assertEquals(
    (await handler(
      new Request("http://127.0.0.1/benchmarks/simulation-rigid-body-2d-v1/unknown.js"),
    )).status,
    404,
  );
});

import Ajv2020Module from "ajv2020";
import { assert, assertEquals } from "../assert.ts";
import { sha256Hex } from "../../lib/canonical.ts";
import { createHandler } from "../../server.ts";
import {
  ECS_FULL_ENTITIES,
  ECS_FULL_FRAMES,
  generateEcsFixture,
} from "../../benchmarks/v1/game-ecs-frame-update/fixture.js";
import {
  instantiateEcsWasm,
  runEcsJavaScript,
  runEcsWasm,
} from "../../benchmarks/v1/game-ecs-frame-update/engine.js";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const artifactPath = "public/artifacts/game-ecs-frame-update-v1/ecs-frame-update.wasm";
const fixturePath = "public/artifacts/game-ecs-frame-update-v1/fixture.bin";
const registrationPath = "catalog/implementations.v1/game.ecs-frame-update.v1.json";
const sourceBase = "e836bf78313074da3a055621fb0c0291b8632b6c";

async function runtime() {
  return await instantiateEcsWasm(await Deno.readFile(artifactPath));
}
function comparableCounters(counters: Record<string, number>) {
  const { ownedBufferAllocations: _allocation, boundaryCrossings: _boundary, ...common } = counters;
  return common;
}
async function command(name: string, args: string[]) {
  const output = await new Deno.Command(name, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(new TextDecoder().decode(output.stderr));
  return output.stdout;
}

Deno.test("frozen catalog bytes stay identical while the ECS implementation registers separately", async () => {
  const catalog = await Deno.readFile("catalog/workloads.v1.json");
  const frozen = await command("git", ["show", `${sourceBase}:catalog/workloads.v1.json`]);
  assertEquals(catalog, frozen);
  const parsed = JSON.parse(new TextDecoder().decode(catalog));
  const entry = parsed.entries.find((item: { id: string }) =>
    item.id === "game.ecs-frame-update.v1"
  );
  assertEquals(entry.status, "proposed");
  assertEquals(
    entry.fixedWork.description,
    "10,000 entities over 1,000 frames with frozen system order.",
  );

  const schema = JSON.parse(
    await Deno.readTextFile("schemas/game-ecs-frame-update-implementation.v1.schema.json"),
  );
  const registration = JSON.parse(await Deno.readTextFile(registrationPath));
  const validate = new (Ajv2020 as unknown as new (
    options: Record<string, unknown>,
  ) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ strict: true, allErrors: true }).compile(schema);
  assert(validate(registration), JSON.stringify(validate.errors));
  assertEquals(registration.catalogBinding.catalogSha256, await sha256Hex(catalog));
  assertEquals(registration.status, "implementation-candidate");
});

Deno.test("the exact generated fixture and artifact match the supplemental registration", async () => {
  const fixture = generateEcsFixture();
  const committedFixture = await Deno.readFile(fixturePath);
  assertEquals(fixture, committedFixture);
  assertEquals(fixture.byteLength, 81_016);
  assertEquals(
    await sha256Hex(fixture),
    "9ad7ed255f244425f3da0d281f7dffcaa8a8923e03907d5ac0bf0322968df769",
  );
  const wasm = await Deno.readFile(artifactPath);
  assertEquals(wasm.byteLength, 3_911);
  assertEquals(
    await sha256Hex(wasm),
    "e76d6c13392a6cb2d570d14c03de0147528a84267b7d527a84209f3b7d79b12f",
  );
  const contract = JSON.parse(
    await Deno.readTextFile(
      "benchmarks/v1/game-ecs-frame-update/implementation-contract.v1.json",
    ),
  );
  assertEquals(contract.fixture.entities, ECS_FULL_ENTITIES);
  assertEquals(contract.fixture.frames, ECS_FULL_FRAMES);
  assertEquals(contract.systems.map((system: { id: string }) => system.id), [
    "movement",
    "collision-broadphase",
    "animation",
  ]);
});

Deno.test("small worlds differentially compare every state word, checkpoint, and common counter", async () => {
  const wasm = await runtime();
  for (
    const options of [
      { entities: 2, frames: 1 },
      { entities: 64, frames: 25 },
      { entities: 2_048, frames: 20 },
    ]
  ) {
    const fixture = generateEcsFixture(options);
    const js = runEcsJavaScript(fixture);
    const linear = runEcsWasm(wasm, fixture);
    assertEquals(linear.semanticDigest, js.semanticDigest);
    assertEquals(linear.oracle.finalState, js.oracle.finalState);
    assertEquals(linear.oracle.checkpoints, js.oracle.checkpoints);
    assertEquals(comparableCounters(linear.counters), comparableCounters(js.counters));
  }
});

Deno.test("full JavaScript and Wasm targets execute all systems with exact complete output and work", async () => {
  const fixture = generateEcsFixture();
  const js = runEcsJavaScript(fixture);
  const linear = runEcsWasm(await runtime(), fixture);
  assertEquals(js.semanticDigest, "fe967b61");
  assertEquals(linear.semanticDigest, js.semanticDigest);
  assertEquals(linear.oracle.finalState, js.oracle.finalState);
  assertEquals(linear.oracle.finalState.length, 60_000);
  assertEquals(linear.oracle.finalStateDigest, "4f0cc1ca");
  assertEquals(linear.oracle.checkpointDigest, "434e9372");
  assertEquals(linear.oracle.checkpoints, js.oracle.checkpoints);
  assertEquals(comparableCounters(linear.counters), comparableCounters(js.counters));
  assertEquals(comparableCounters(js.counters), {
    frames: 1_000,
    entities: 10_000,
    systemPasses: 3_000,
    movementUpdates: 10_000_000,
    broadphaseCellClears: 16_384_000,
    broadphaseCellScans: 81_920_000,
    broadphaseInsertions: 10_000_000,
    pairTests: 27_086_270,
    collisions: 8_538,
    animationUpdates: 10_000_000,
    controlMutations: 77_862,
    stateMutations: 30_113_243,
    checkpointCount: 10,
    inputBytes: 81_016,
    outputBytes: 240_128,
  });
  assertEquals(js.counters.ownedBufferAllocations, 9);
  assertEquals(js.counters.boundaryCrossings, 0);
  assertEquals(linear.counters.ownedBufferAllocations, 0);
  assertEquals(linear.counters.boundaryCrossings, 2);
  const adapterSource = await Deno.readTextFile(
    "benchmarks/v1/game-ecs-frame-update/engine.js",
  );
  const wasmAdapter = adapterSource.slice(adapterSource.indexOf("export function runEcsWasm"));
  assert(!wasmAdapter.includes("runEcsJavaScript"));
  const cSource = await Deno.readTextFile(
    "benchmarks/v1/game-ecs-frame-update/ecs-frame-update.c",
  );
  for (const symbol of ["process_pair", "process_cross_cells", "canonical_state"]) {
    assert(cSource.includes(symbol));
  }
});

Deno.test("source-only build reproduces the fixture, Wasm, and exact output manifests", async () => {
  const paths = [
    artifactPath,
    fixturePath,
    "public/artifacts/game-ecs-frame-update-v1/fixture-manifest.json",
    "public/artifacts/game-ecs-frame-update-v1/output-manifest.json",
  ];
  const before = new Map<string, Uint8Array>();
  for (const path of paths) before.set(path, await Deno.readFile(path));
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts/game-ecs-frame-update-v1,public/evidence/base-v1/game-ecs-frame-update-v1",
      "--allow-run=clang,wasm-ld",
      "scripts/build-base-game-ecs-frame-update.ts",
      "--source-only",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(output.success, new TextDecoder().decode(output.stderr));
  for (const path of paths) assertEquals(await Deno.readFile(path), before.get(path));
});

Deno.test("registration provenance and evidence bind exact Git bytes and complete-state results", async () => {
  const registration = JSON.parse(await Deno.readTextFile(registrationPath));
  for (const reference of registration.source.references) {
    const disk = await Deno.readFile(reference.path);
    const tree = await command("git", [
      "show",
      `${registration.source.commit}:${reference.path}`,
    ]);
    assertEquals(await sha256Hex(disk), reference.sha256);
    assertEquals(await sha256Hex(tree), reference.sha256);
    assert(reference.immutableUrl.includes(registration.source.commit));
  }
  for (const variant of registration.variants) {
    const evidence = JSON.parse(await Deno.readTextFile(variant.evidence));
    assertEquals(evidence.status, "passed");
    assertEquals(evidence.sourceCommit, registration.source.commit);
    assertEquals(evidence.oracle.finalStateWords, 60_000);
    assertEquals(
      evidence.oracle.finalStateSha256,
      "c514e7e9f50a62707af610bca1bf222ff88061ccbf55aa711bcdc1929adc4210",
    );
    assertEquals(evidence.completeStateComparedAcrossTargets, true);
    assertEquals(evidence.performanceClaims, []);
  }
});

Deno.test("public routes are closed, readable, and the demo owns worker lifecycle", async () => {
  const handler = createHandler(null, "public");
  for (
    const path of [
      "/benchmarks/game-ecs-frame-update/",
      "/demos/game-ecs-frame-update/demo.js",
      "/demos/game-ecs-frame-update/worker.js",
      "/benchmarks/v1/game-ecs-frame-update/engine.js",
      "/benchmarks/v1/game-ecs-frame-update/fixture.js",
      "/artifacts/game-ecs-frame-update-v1/ecs-frame-update.wasm",
      "/artifacts/game-ecs-frame-update-v1/fixture.bin",
      "/artifacts/game-ecs-frame-update-v1/build-manifest.json",
      "/evidence/base-v1/game-ecs-frame-update-v1/js-controlled.json",
      "/evidence/base-v1/game-ecs-frame-update-v1/wasm-linear-controlled.json",
      "/data/implementations.v1/game.ecs-frame-update.v1.json",
    ]
  ) {
    const response = await handler(new Request(`http://127.0.0.1${path}`));
    assert(response.status === 200, `${path} returned ${response.status}`);
  }
  assertEquals(
    (await handler(new Request("http://127.0.0.1/artifacts/game-ecs-frame-update-v1/unknown")))
      .status,
    404,
  );
  const page = await Deno.readTextFile("public/benchmarks/game-ecs-frame-update/index.html");
  assert(page.includes("10,000 entities over 1,000 frames"));
  assert(page.includes("No performance claim."));
  assert(page.includes("Nothing is uploaded or stored."));
  assert(!page.includes("<script>"));
  const runner = await Deno.readTextFile("public/demos/game-ecs-frame-update/demo.js");
  for (
    const required of ["new Worker", "120_000", "terminate()", "pagehide", "token !== runToken"]
  ) {
    assert(runner.includes(required));
  }
  const worker = await Deno.readTextFile("public/demos/game-ecs-frame-update/worker.js");
  for (const required of ["complete state SHA-256", "27_086_270", "8_538", "wasmSha256"]) {
    assert(worker.includes(required));
  }
  for (const forbidden of ["localStorage", "sessionStorage", "indexedDB", 'fetch("/api/']) {
    assert(!runner.includes(forbidden));
    assert(!worker.includes(forbidden));
  }
});

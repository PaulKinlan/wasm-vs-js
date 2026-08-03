import Ajv2020Module from "ajv2020";
import { assert, assertEquals } from "../assert.ts";
import { sha256Hex } from "../../lib/canonical.ts";
import { validateProposalProvenanceSemantics } from "../../benchmarks/v2/shared/provenance-contract.js";
import { GAME_IDS, generateFixture } from "../../benchmarks/v2/game-family/fixtures.js";
import {
  instantiateGameWasm,
  runGameJavaScript,
  runGameWasm,
} from "../../benchmarks/v2/game-family/engine.js";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const expected = {
  "game.canvas-arcade.v1": {
    bytes: 14_424,
    sha256: "fd58ad78008171e86ee187483661e929a693b6c8f5e9bf6ca01430f4ed09054c",
    digest: "8fe31dbe",
  },
  "game.canvas-entity-pathfinding.v1": {
    bytes: 106_552,
    sha256: "3eb783e411cf4a21948efdff81ef624640dad8d512487ef30948060320cd9fb0",
    digest: "073b8a16",
  },
  "game.dom-tactics-grid.v1": {
    bytes: 7_064,
    sha256: "93ea1b049be33d4a2d1fcf08d58e433181195b24c03e36326bfecd328c3a5262",
    digest: "14997b1e",
  },
} as const;

async function runtime() {
  return await instantiateGameWasm(
    await Deno.readFile("public/artifacts/game-v2-controlled-family/game-family.wasm"),
  );
}

Deno.test("game fixtures reproduce exact binary manifests without external inputs", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/game-v2-controlled-family/fixture-manifest.json"),
  );
  for (const id of GAME_IDS) {
    const fixture = generateFixture(id);
    const oracle = expected[id as keyof typeof expected];
    assertEquals(fixture.byteLength, oracle.bytes);
    assertEquals(await sha256Hex(fixture), oracle.sha256);
    const entry = manifest.fixtures.find((item: { workloadId: string }) => item.workloadId === id);
    assert(entry);
    assertEquals(entry.bytes, fixture.byteLength);
    assertEquals(entry.sha256, oracle.sha256);
    assertEquals(await Deno.readFile(entry.path), fixture);
  }
  assertEquals(manifest.rights.license, "CC0-1.0");
  assertEquals(manifest.rights.redistribution, "permitted");
});

Deno.test("all three catalog algorithms execute independently in JavaScript and linear Wasm", async () => {
  const wasm = await runtime();
  for (const id of GAME_IDS) {
    const fixture = generateFixture(id);
    const js = runGameJavaScript(id, fixture);
    const linear = runGameWasm(id, wasm, fixture);
    assertEquals({ ...linear, variantId: null, executionTarget: null }, {
      ...js,
      variantId: null,
      executionTarget: null,
    });
    assertEquals(js.digest, expected[id as keyof typeof expected].digest);
    assertEquals(linear.executionTarget, "wasm-linear");
  }
  const source = await Deno.readTextFile("benchmarks/v2/game-family/engine.js");
  const wasmAdapter = source.slice(
    source.indexOf("export function runGameWasm"),
    source.indexOf("function decodeWasm"),
  );
  assert(!wasmAdapter.includes("runCore("), "Wasm adapter reused the JavaScript semantic reducer");
  const c = await Deno.readTextFile("benchmarks/v2/game-family/game-family.c");
  for (
    const symbol of [
      "run_arcade",
      "run_pathfinding",
      "run_tactics",
      "heap_push",
      "tactics_path",
      "tactics_los_visible",
    ]
  ) assert(c.includes(symbol));
});

Deno.test("one cached Wasm instance is byte-identical across repeated and reordered workloads", async () => {
  const wasm = await runtime();
  const baselineBytes = new Map<string, Uint8Array>();
  const exactCounters = {
    "game.canvas-arcade.v1": {
      frames: 3600,
      entityUpdates: 169501,
      collisionTests: 169501,
      drawCommands: 180301,
      audioEvents: 91,
      inputBytes: 14424,
      outputBytes: 204,
      boundaryCrossings: 2,
    },
    "game.canvas-entity-pathfinding.v1": {
      frames: 1800,
      entities: 4096,
      systemUpdates: 7_372_800,
      pathNodesExpanded: 974592,
      frontierOperations: 2213135,
      drawCommands: 7_372_800,
      audioEvents: 1,
      boundaryCrossings: 2,
    },
    "game.dom-tactics-grid.v1": {
      actions: 240,
      turns: 60,
      pathNodesExpanded: 95614,
      lineOfSightTests: 450,
      stateUpdates: 81,
      domMutations: 423,
      transferredBytes: 7064,
      boundaryCrossings: 2,
    },
  } as const;
  const order = [
    GAME_IDS[0],
    GAME_IDS[1],
    GAME_IDS[2],
    GAME_IDS[1],
    GAME_IDS[2],
    GAME_IDS[0],
    GAME_IDS[2],
    GAME_IDS[0],
    GAME_IDS[1],
  ];
  for (const id of order) {
    const result = runGameWasm(id, wasm, generateFixture(id));
    assertEquals(result.digest, expected[id as keyof typeof expected].digest);
    assertEquals(result.counters, exactCounters[id as keyof typeof exactCounters]);
    const pointer = (wasm.result_ptr as () => number)();
    const bytes = new Uint8Array((wasm.memory as WebAssembly.Memory).buffer, pointer, 2048 * 4)
      .slice();
    const baseline = baselineBytes.get(id);
    if (baseline) assertEquals(bytes, baseline);
    else baselineBytes.set(id, bytes);
  }
  assertEquals(baselineBytes.size, GAME_IDS.length);
});

Deno.test("arcade freezes complete state, draw, audio, checkpoints, and exact work", () => {
  const result = runGameJavaScript(GAME_IDS[0]);
  assertEquals(result.oracle.finalStateDigest, "87695460");
  assertEquals(result.oracle.drawCommandStreamDigest, "f3a03070");
  assertEquals(result.oracle.audioEventStreamDigest, "8b4cb497");
  assertEquals(result.oracle.checkpoints.length, 6);
  assertEquals(result.oracle.checkpoints.at(-1).drawDigest, result.oracle.drawCommandStreamDigest);
  assertEquals(result.oracle.checkpoints.at(-1).audioDigest, result.oracle.audioEventStreamDigest);
  assertEquals(result.counters, {
    frames: 3600,
    entityUpdates: 169501,
    collisionTests: 169501,
    drawCommands: 180301,
    audioEvents: 91,
    inputBytes: 14424,
    outputBytes: 204,
    boundaryCrossings: 2,
  });
  assertEquals(result.replay.map((item: { frame: number }) => item.frame), [
    600,
    1200,
    1800,
    2400,
    3000,
    3600,
  ]);
});

Deno.test("pathfinding freezes 128 node sequences, heap tie-breaks, ECS and host-command traces", () => {
  const result = runGameJavaScript(GAME_IDS[1]);
  assertEquals(result.oracle.pathNodeSequenceDigest, "55c75f61");
  assertEquals(result.oracle.tieBreakDigest, "8108145d");
  assertEquals(result.oracle.ecsCheckpointDigest, "c497aa94");
  assertEquals(result.oracle.animationCommandStreamDigest, "569ffa98");
  assertEquals(result.oracle.drawCommandStreamDigest, "992a9d1d");
  assertEquals(result.oracle.audioEventStreamDigest, "d1fcc811");
  assertEquals(result.oracle.pathOracles.length, 128);
  assertEquals(result.oracle.checkpoints.length, 6);
  assert(result.oracle.pathOracles.some((item: { length: number }) => item.length > 0));
  assert(
    result.oracle.pathOracles.every((
      item: { length: number; pathDigest: string; tieBreakDigest: string },
    ) =>
      item.length >= 0 && /^[a-f0-9]{8}$/.test(item.pathDigest) &&
      /^[a-f0-9]{8}$/.test(item.tieBreakDigest)
    ),
  );
  assertEquals(result.counters, {
    frames: 1800,
    entities: 4096,
    systemUpdates: 7_372_800,
    pathNodesExpanded: 974592,
    frontierOperations: 2213135,
    drawCommands: 7_372_800,
    audioEvents: 1,
    boundaryCrossings: 2,
  });
});

Deno.test("tactics applies 240 actions in 60 encoded turns with complete canonical state oracles", async () => {
  const fixture = generateFixture(GAME_IDS[2]);
  const view = new DataView(fixture.buffer, fixture.byteOffset, fixture.byteLength);
  const actionOffset = 24 + 4096 + 1024;
  const encodedTurns = Array.from(
    { length: 240 },
    (_, action) => view.getUint16(actionOffset + action * 8 + 6, true),
  );
  assertEquals([...new Set(encodedTurns)], Array.from({ length: 60 }, (_, turn) => turn));
  const result = runGameJavaScript(GAME_IDS[2]);
  assertEquals(result.counters, {
    actions: 240,
    turns: 60,
    pathNodesExpanded: 95614,
    lineOfSightTests: 450,
    stateUpdates: 81,
    domMutations: 423,
    transferredBytes: 7064,
    boundaryCrossings: 2,
  });
  assertEquals(result.oracle.turnCheckpoints.length, 60);
  assertEquals(
    result.oracle.turnCheckpoints.map((item: { turn: number }) => item.turn),
    Array.from({ length: 60 }, (_, turn) => turn + 1),
  );
  assertEquals({
    unit: result.oracle.finalUnitDigest,
    occupancy: result.oracle.finalOccupancyDigest,
    initiative: result.oracle.finalInitiativeDigest,
    objective: result.oracle.finalObjectiveDigest,
    dom: result.oracle.canonicalDomDigest,
    focus: result.oracle.focusStateDigest,
    accessibility: result.oracle.accessibilityStateDigest,
  }, {
    unit: "adaea4e5",
    occupancy: "8d730f69",
    initiative: "67cf2fa8",
    objective: "dc971318",
    dom: "ea6127a1",
    focus: "103c75c2",
    accessibility: "e819fe54",
  });
  const source = await Deno.readTextFile("benchmarks/v2/game-family/engine.js");
  assert(!source.includes("Math.max(config.turns"));
});

Deno.test("game family rejects unknown IDs, mutated fixtures, output forgery, and memory growth", async () => {
  for (const invalid of ["", "game.canvas-arcade.v2", "../game.canvas-arcade.v1"]) {
    let denied = false;
    try {
      runGameJavaScript(invalid);
    } catch (error) {
      denied = error instanceof Error && error.message.includes("denied");
    }
    assert(denied, `did not deny ${invalid}`);
  }
  const mutated = generateFixture(GAME_IDS[0]);
  mutated[mutated.length - 1] ^= 1;
  for (
    const execute of [
      (_wasm: WebAssembly.Exports) => runGameJavaScript(GAME_IDS[0], mutated),
      (wasm: WebAssembly.Exports) => runGameWasm(GAME_IDS[0], wasm, mutated),
    ]
  ) {
    let mismatch = false;
    try {
      execute(await runtime());
    } catch (error) {
      mismatch = error instanceof Error && error.message.includes("mismatch");
    }
    assert(mismatch);
  }
  const wasm = await runtime();
  assertEquals((wasm.memory as WebAssembly.Memory).buffer.byteLength, 64 * 65536);
  let fixed = false;
  try {
    (wasm.memory as WebAssembly.Memory).grow(1);
  } catch (error) {
    fixed = error instanceof RangeError;
  }
  assert(fixed, "fixed Wasm memory unexpectedly grew");
});

Deno.test("six game records validate against the closed v2 result schema and exact Git-tree provenance", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/workload-result-v2-proposal.schema.json"),
  );
  const catalog = JSON.parse(await Deno.readTextFile("catalog/workloads.v2.proposed.json"));
  const validate = new (Ajv2020 as unknown as new (
    options: Record<string, unknown>,
  ) => { compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown } })({
    allErrors: true,
    strict: false,
  }).compile(schema);
  const files = [];
  for await (const entry of Deno.readDir("public/evidence/v2-proposals/games")) {
    if (entry.isFile && entry.name.endsWith(".json")) files.push(entry.name);
  }
  assertEquals(files.length, 6);
  for (const file of files) {
    const record = JSON.parse(
      await Deno.readTextFile(`public/evidence/v2-proposals/games/${file}`),
    );
    assert(validate(record), `${file}: ${JSON.stringify(validate.errors)}`);
    const semantics = await validateProposalProvenanceSemantics(record, catalog, {
      requireLocalFiles: true,
      expectedSourceCommit: record.source.commit,
    });
    assert(semantics.ok, `${file}: ${semantics.errors.join("; ")}`);
    assertEquals(record.performanceClaims, []);
    assertEquals(record.correctness.status, "passed");
  }
});

Deno.test("game builder reproduces committed artifacts and records from its exact source commit", async () => {
  const manifestPath = "public/artifacts/game-v2-controlled-family/build-manifest.json";
  const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
  const paths = [
    manifestPath,
    "public/artifacts/game-v2-controlled-family/game-family.wasm",
    "public/artifacts/game-v2-controlled-family/fixture-manifest.json",
    "public/artifacts/game-v2-controlled-family/input-manifest.json",
    "public/artifacts/game-v2-controlled-family/output-manifest.json",
    ...GAME_IDS.map((id) =>
      `public/artifacts/game-v2-controlled-family/${id.replaceAll(".", "-")}.bin`
    ),
  ];
  for await (const entry of Deno.readDir("public/evidence/v2-proposals/games")) {
    if (entry.isFile && entry.name.endsWith(".json")) {
      paths.push(`public/evidence/v2-proposals/games/${entry.name}`);
    }
  }
  const before = await Promise.all(paths.map((path) => Deno.readFile(path)));
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts/game-v2-controlled-family,public/evidence/v2-proposals/games",
      "--allow-run=git,clang,wasm-ld",
      "scripts/build-game-family.ts",
      `--source-commit=${manifest.source.commit}`,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  for (let index = 0; index < paths.length; index += 1) {
    assertEquals(await Deno.readFile(paths[index]), before[index]);
  }
});

Deno.test("runnable pages use fixed worker controls, real replay traces, accessible text, and no-JS fallback", async () => {
  const demo = await Deno.readTextFile("public/demos/game-family/demo.js");
  const worker = await Deno.readTextFile("public/demos/game-family/worker.js");
  assert(demo.includes("data.token !== token"));
  assert(demo.includes("worker?.terminate()"));
  assert(demo.includes("result.replay"));
  assert(demo.includes("15000"));
  assert(worker.includes("GAME_IDS.includes(workloadId)"));
  assert(worker.includes("GAME_VARIANTS.includes(variantId)"));
  for (
    const slug of ["game-canvas-arcade", "game-canvas-entity-pathfinding", "game-dom-tactics-grid"]
  ) {
    const html = await Deno.readTextFile(`public/demos/${slug}/index.html`);
    assert(html.includes("Proposal-validation demo, not a performance result."));
    assert(html.includes("<noscript>"));
    assert(html.includes('id="start" type="button" disabled'));
    assert(html.includes('role="status"'));
    assert(html.includes('id="result"'));
    assert(html.includes("stores nothing, and uploads nothing"));
  }
});

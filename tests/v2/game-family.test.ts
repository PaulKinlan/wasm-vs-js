import { assert, assertEquals } from "../assert.ts";
import { sha256Hex } from "../../lib/canonical.ts";
import { GAME_IDS, generateFixture } from "../../benchmarks/v2/game-family/fixtures.js";
import {
  instantiateGameWasm,
  runGameJavaScript,
  runGameWasmHybrid,
} from "../../benchmarks/v2/game-family/engine.js";

const expected = {
  "game.canvas-arcade.v1": {
    bytes: 14_424,
    sha256: "fd58ad78008171e86ee187483661e929a693b6c8f5e9bf6ca01430f4ed09054c",
    digest: "2731e61d",
    checkpoints: 6,
  },
  "game.canvas-entity-pathfinding.v1": {
    bytes: 106_552,
    sha256: "3eb783e411cf4a21948efdff81ef624640dad8d512487ef30948060320cd9fb0",
    digest: "d8f8a3e1",
    checkpoints: 134,
  },
  "game.dom-tactics-grid.v1": {
    bytes: 7_064,
    sha256: "93ea1b049be33d4a2d1fcf08d58e433181195b24c03e36326bfecd328c3a5262",
    digest: "8534253e",
    checkpoints: 60,
  },
} as const;

async function runtime() {
  return await instantiateGameWasm(
    await Deno.readFile("public/artifacts/game-v2-controlled-family/game-family.wasm"),
  );
}

Deno.test("game fixtures reproduce exact binary manifests without external inputs", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/game-v2-controlled-family/build-manifest.json"),
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
    assertEquals(await Deno.readFile(`public${entry.path}`), fixture);
  }
});

Deno.test("game family builder reproduces byte-identical fixtures, Wasm, manifest, and records", async () => {
  const paths = [
    "public/artifacts/game-v2-controlled-family/build-manifest.json",
    "public/artifacts/game-v2-controlled-family/game-family.wasm",
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
      "scripts/build-game-family.ts",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  for (let index = 0; index < paths.length; index += 1) {
    assertEquals(await Deno.readFile(paths[index]), before[index]);
  }
});

Deno.test("all three full fixed workloads have exact JavaScript and honest Wasm-hybrid outputs", async () => {
  const wasm = await runtime();
  for (const id of GAME_IDS) {
    const fixture = generateFixture(id);
    const js = runGameJavaScript(id, fixture);
    const hybrid = runGameWasmHybrid(id, wasm, fixture);
    assertEquals(hybrid.digest, js.digest);
    assertEquals(hybrid.fixtureDigest, js.fixtureDigest);
    assertEquals(hybrid.semanticDigest, js.semanticDigest);
    assertEquals(hybrid.checkpoints, js.checkpoints);
    assertEquals(hybrid.counters, js.counters);
    assertEquals(hybrid.visual, js.visual);
    assertEquals(js.digest, expected[id as keyof typeof expected].digest);
    assertEquals(js.checkpoints.length, expected[id as keyof typeof expected].checkpoints);
    assertEquals(hybrid.executionTarget, "linear-wasm-hash-kernel-with-javascript-host-adapter");
  }
});

Deno.test("game work counters freeze exact full work rather than reduced slices", () => {
  const arcade = runGameJavaScript(GAME_IDS[0]);
  assertEquals(arcade.counters, {
    frames: 3600,
    entityUpdates: 169501,
    collisionTests: 169501,
    drawCommands: 176701,
    audioEvents: 91,
    inputBytes: 14424,
    outputBytes: 68,
    boundaryCrossings: 2,
  });
  const path = runGameJavaScript(GAME_IDS[1]) as unknown as { counters: Record<string, number> };
  assertEquals(path.counters.frames, 1800);
  assertEquals(path.counters.entities, 4096);
  assertEquals(path.counters.systemUpdates, 7_372_800);
  assert(path.counters.pathNodesExpanded > 0);
  assert(path.counters.frontierOperations >= path.counters.pathNodesExpanded);
  const tactics = runGameJavaScript(GAME_IDS[2]) as unknown as { counters: Record<string, number> };
  assertEquals(tactics.counters.actions, 240);
  assertEquals(tactics.counters.turns, 60);
  assertEquals(tactics.counters.lineOfSightTests, 96);
  assert(tactics.counters.pathNodesExpanded > 0);
});

Deno.test("game family rejects unknown IDs, wrong fixture types, mutations, and memory growth", async () => {
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
  let mismatch = false;
  try {
    runGameJavaScript(GAME_IDS[0], mutated);
  } catch (error) {
    mismatch = error instanceof Error && error.message.includes("mismatch");
  }
  assert(mismatch);
  const wasm = await runtime();
  let fixed = false;
  try {
    (wasm.memory as WebAssembly.Memory).grow(1);
  } catch (error) {
    fixed = error instanceof RangeError;
  }
  assert(fixed, "four-page Wasm memory unexpectedly grew");
});

Deno.test("six validation records contain no timing values or performance claims", async () => {
  const files = [];
  for await (const entry of Deno.readDir("public/evidence/v2-proposals/games")) {
    if (entry.isFile && entry.name.endsWith(".json")) files.push(entry.name);
  }
  assertEquals(files.length, 6);
  for (const file of files) {
    const record = JSON.parse(
      await Deno.readTextFile(`public/evidence/v2-proposals/games/${file}`),
    );
    assertEquals(record.status, "proposal-validation-only");
    assertEquals(record.validation, {
      completeOutput: "pass",
      structuralInvariants: "pass",
      workCounters: "pass",
      crossTargetEquivalence: "pass",
    });
    assertEquals(record.timing.status, "not-collected");
    assertEquals(record.performanceClaims, []);
    assert(!("durationMs" in record.timing));
  }
});

Deno.test("runnable game pages retain worker, cancellation, timeout, stale-token, and accessible text contracts", async () => {
  const demo = await Deno.readTextFile("public/demos/game-family/demo.js");
  const worker = await Deno.readTextFile("public/demos/game-family/worker.js");
  assert(demo.includes("data.token !== token"));
  assert(demo.includes("worker?.terminate()"));
  assert(demo.includes("15000"));
  assert(worker.includes("GAME_IDS.includes(workloadId)"));
  assert(worker.includes("GAME_VARIANTS.includes(variantId)"));
  for (
    const slug of ["game-canvas-arcade", "game-canvas-entity-pathfinding", "game-dom-tactics-grid"]
  ) {
    const html = await Deno.readTextFile(`public/demos/${slug}/index.html`);
    assert(html.includes("Proposal-validation demo, not a performance result."));
    assert(html.includes('role="status"'));
    assert(html.includes('id="result"'));
    assert(html.includes('id="start"'));
    assert(html.includes('id="cancel"'));
    assert(html.includes("stores nothing, and uploads nothing"));
  }
});

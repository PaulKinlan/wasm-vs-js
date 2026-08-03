import { assert, assertEquals } from "./assert.ts";
function assertThrows(fn: () => unknown, includes: string) {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes(includes)) return;
    throw error;
  }
  throw new Error("expected throw");
}
import { sha256Hex } from "../lib/canonical.ts";
import { fixtureParameters, generateDirtyStl } from "../benchmarks/base/cad-mesh-repair/fixture.js";
import {
  instantiateMeshWasm,
  repairMeshJavaScript,
  repairMeshWasm,
} from "../benchmarks/base/cad-mesh-repair/engine.js";

const root = new URL("../", import.meta.url);
const frozenHash = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";

Deno.test("cad mesh fixture is exact, generated and frozen-catalog safe", async () => {
  const a = generateDirtyStl(), b = generateDirtyStl();
  assertEquals(a, b);
  assertEquals(a.length, 105684);
  assertEquals(new DataView(a.buffer).getUint32(80, true), 2112);
  assertEquals(
    await sha256Hex(a),
    "46fa97b0518e96edd1a2bb01d362955f5fae7f9d3e1371c0056ff17ba7d95a91",
  );
  assertEquals(
    await sha256Hex(await Deno.readFile(new URL("catalog/workloads.v1.json", root))),
    frozenHash,
  );
  assertEquals(
    await sha256Hex(await Deno.readFile(new URL("public/data/workloads.v1.json", root))),
    frozenHash,
  );
  assertEquals(fixtureParameters.targetFaces, 1024);
});

Deno.test("cad mesh JS and material Wasm return identical complete repaired bytes", async () => {
  const input = generateDirtyStl();
  const js = repairMeshJavaScript(input);
  const runtime = await instantiateMeshWasm(
    await Deno.readFile(new URL("public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm", root)),
  );
  const wasm = repairMeshWasm(runtime, input);
  assertEquals(js.bytes, wasm.bytes);
  assertEquals(
    await sha256Hex(js.bytes),
    "8e5abc003ef884f807630e4cbc0afaa555ef0aa7eacb9a3012ebd3c78590566b",
  );
  assertEquals(js.counters.sourceFaces, 2112);
  assertEquals(js.counters.removedDegenerates, 64);
  assertEquals(js.counters.weldedVertices, 1089);
  assertEquals(js.counters.orientedFaces, 2048);
  assertEquals(js.counters.simplifiedFaces, 1024);
  assertEquals(js.counters.simplifiedVertices, 561);
  assertEquals(js.counters.collapsedVertices, 528);
  assertEquals(js.counters.volumeTerms, 1024);
  assertEquals(js.invariants.signedVolumeSixQuantized, 0);
  assertEquals(js.counters.targetFaces, 1024);
  assert(js.counters.flippedFaces > 0);
  assertEquals({ ...wasm.counters, boundaryCrossings: 0, allocations: 5 }, js.counters);
  assertEquals(js.invariants, wasm.invariants);
});

Deno.test("cad mesh rejects malformed lengths, nonfinite coordinates and non-manifold edges", async () => {
  assertThrows(() => repairMeshJavaScript(new Uint8Array(83)), "invalid STL length");
  const bad = generateDirtyStl();
  new DataView(bad.buffer).setUint32(80, 1, true);
  assertThrows(() => repairMeshJavaScript(bad), "invalid STL framing");
  const nan = generateDirtyStl();
  new DataView(nan.buffer).setFloat32(96, Number.NaN, true);
  assertThrows(() => repairMeshJavaScript(nan), "invalid STL coordinate");
  const tri = new Uint8Array(84 + 4 * 50);
  const view = new DataView(tri.buffer);
  view.setUint32(80, 4, true);
  for (let f = 0; f < 4; f++) {
    const p = 84 + f * 50 + 12;
    const points = f < 3 ? [[0, 0], [1, 0], [0, 1]] : [[2, 0], [3, 0], [2, 1]];
    for (const [i, [x, y]] of points.entries()) {
      view.setFloat32(p + i * 12, x, true);
      view.setFloat32(p + i * 12 + 4, y, true);
    }
  }
  assertThrows(() => repairMeshJavaScript(tri), "non-manifold edge");
  const runtime = await instantiateMeshWasm(
    await Deno.readFile(new URL("public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm", root)),
  );
  assertThrows(() => repairMeshWasm(runtime, tri), "-6");
});

Deno.test("cad mesh build is byte-reproducible under pinned Deno/Clang/LLD", async () => {
  const beforeWasm = await sha256Hex(
    await Deno.readFile(new URL("public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm", root)),
  );
  const beforeManifest = await sha256Hex(
    await Deno.readFile(new URL("public/artifacts/cad-mesh-repair-v1/build-manifest.json", root)),
  );
  const result = await new Deno.Command(Deno.execPath(), {
    cwd: root.pathname,
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts",
      "--allow-run=clang,wasm-ld",
      "scripts/build-cad-mesh-repair.ts",
    ],
    stdout: "null",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  assertEquals(
    await sha256Hex(
      await Deno.readFile(new URL("public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm", root)),
    ),
    beforeWasm,
  );
  assertEquals(
    await sha256Hex(
      await Deno.readFile(new URL("public/artifacts/cad-mesh-repair-v1/build-manifest.json", root)),
    ),
    beforeManifest,
  );
});

Deno.test("cad mesh public route is closed and runnable assets are explicit", async () => {
  const source = await Deno.readTextFile(new URL("server.ts", root));
  for (
    const route of [
      "/benchmarks/cad-mesh-repair-v1/",
      "/benchmarks/cad-mesh-repair-v1/demo.js",
      "/benchmarks/cad-mesh-repair-v1/worker.js",
      "/benchmarks/base/cad-mesh-repair/engine.js",
      "/artifacts/cad-mesh-repair-v1/dirty-grid.stl",
      "/artifacts/cad-mesh-repair-v1/mesh-repair.wasm",
      "/artifacts/cad-mesh-repair-v1/build-manifest.json",
    ]
  ) assert(source.includes(route), route);
  const runner = await Deno.readTextFile(
    new URL("public/benchmarks/cad-mesh-repair-v1/demo.js", root),
  );
  for (
    const behavior of [
      "new Worker",
      "terminate()",
      "setTimeout",
      "pagehide",
      "event.data.token !== runToken",
    ]
  ) assert(runner.includes(behavior), behavior);
});

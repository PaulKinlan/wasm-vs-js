import Ajv2020Module from "ajv2020";
import { createCadMeshSemanticValidator } from "../lib/cad-mesh-semantics.ts";
import { assert, assertEquals } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

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
  quantizeMeshCoordinate,
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
    "9176fd44b472ec6369d880a0f605c9a1a0c518f4fbe55485da399b5718228309",
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
  const contract = JSON.parse(
    await Deno.readTextFile(
      new URL("benchmarks/base/cad-mesh-repair/implementation-contract.v1.json", root),
    ),
  );
  for (const name of contract.work.equivalentCounters as string[]) {
    const jsValue = (js.counters as Record<string, number>)[name];
    const wasmValue = (wasm.counters as Record<string, number>)[name];
    assert(jsValue === wasmValue, `${name}: ${jsValue} !== ${wasmValue}`);
  }
  assertEquals(js.counters.boundaryCrossings, 0);
  assertEquals(wasm.counters.boundaryCrossings, 3);
  assertEquals(js.counters.operativeAllocations, 9);
  assertEquals(wasm.counters.operativeAllocations, 0);
  assertEquals(js.invariants, wasm.invariants);
});

Deno.test("cad mesh quantization uses exact f32 half-away policy on the negative half", async () => {
  const negativeHalf = Math.fround(-0.00004999999873689376);
  assertEquals(negativeHalf, -0.00004999999873689376);
  assertEquals(quantizeMeshCoordinate(negativeHalf), -1);
  assertEquals(quantizeMeshCoordinate(-0.000049), 0);
  assertEquals(quantizeMeshCoordinate(0.00004999999873689376), 1);

  const adversarial = generateDirtyStl();
  const view = new DataView(adversarial.buffer);
  const degenerateFace = 84 + 2048 * 50 + 12;
  for (let vertex = 0; vertex < 3; vertex++) {
    view.setFloat32(degenerateFace + vertex * 12, negativeHalf, true);
  }
  const js = repairMeshJavaScript(adversarial);
  const runtime = await instantiateMeshWasm(
    await Deno.readFile(new URL("public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm", root)),
  );
  const wasm = repairMeshWasm(runtime, adversarial);
  assertEquals(js.bytes, wasm.bytes);
  assertEquals(js.counters.vertexWeldComparisons, wasm.counters.vertexWeldComparisons);
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
  const beforeEvidence = await sha256Hex(
    await Deno.readFile(
      new URL("public/artifacts/cad-mesh-repair-v1/validation-evidence.json", root),
    ),
  );
  const result = await new Deno.Command(Deno.execPath(), {
    cwd: root.pathname,
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts",
      "--allow-run=clang,wasm-ld,git",
      "scripts/build-cad-mesh-repair.ts",
      `--source-commit=${
        JSON.parse(
          await Deno.readTextFile(
            new URL("public/artifacts/cad-mesh-repair-v1/build-manifest.json", root),
          ),
        ).source.commit
      }`,
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
  assertEquals(
    await sha256Hex(
      await Deno.readFile(
        new URL("public/artifacts/cad-mesh-repair-v1/validation-evidence.json", root),
      ),
    ),
    beforeEvidence,
  );
});

Deno.test("cad mesh contract, build manifest, and evidence have closed schemas", async () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const records = [
    {
      label: "contract",
      schema: "schemas/cad-mesh-repair-contract.schema.json",
      record: "benchmarks/base/cad-mesh-repair/implementation-contract.v1.json",
      nested: "fixture",
    },
    {
      label: "build",
      schema: "schemas/cad-mesh-repair-build-manifest.schema.json",
      record: "public/artifacts/cad-mesh-repair-v1/build-manifest.json",
      nested: "source",
    },
    {
      label: "evidence",
      schema: "schemas/cad-mesh-repair-evidence.schema.json",
      record: "public/artifacts/cad-mesh-repair-v1/validation-evidence.json",
      nested: "oracle",
    },
  ];
  for (const entry of records) {
    const schema = JSON.parse(await Deno.readTextFile(new URL(entry.schema, root)));
    assertEquals(schema.additionalProperties, false);
    const validate = ajv.compile(schema);
    const value = JSON.parse(await Deno.readTextFile(new URL(entry.record, root)));
    assert(validate(value), `${entry.label}: ${JSON.stringify(validate.errors)}`);
    assert(!validate({ ...value, undeclared: true }), `${entry.label} accepted root extra`);
    assert(
      !validate({ ...value, [entry.nested]: { ...value[entry.nested], undeclared: true } }),
      `${entry.label} accepted nested extra`,
    );
  }
});

Deno.test("cad mesh semantic validator rejects poisoned identities, hashes, graph, oracle, and every counter", async () => {
  const records = {
    contract: JSON.parse(
      await Deno.readTextFile(
        new URL("benchmarks/base/cad-mesh-repair/implementation-contract.v1.json", root),
      ),
    ),
    buildManifest: JSON.parse(
      await Deno.readTextFile(
        new URL("public/artifacts/cad-mesh-repair-v1/build-manifest.json", root),
      ),
    ),
    evidence: JSON.parse(
      await Deno.readTextFile(
        new URL("public/artifacts/cad-mesh-repair-v1/validation-evidence.json", root),
      ),
    ),
  };
  const validate = await createCadMeshSemanticValidator(root);
  validate(records);

  const poisonedHash = "0".repeat(64);
  const reject = (label: string, mutate: (copy: typeof records) => void) => {
    const copy = structuredClone(records);
    mutate(copy);
    assertThrows(() => validate(copy), label);
  };

  reject("contract catalog identity", (copy) => copy.contract.catalogId = "poisoned.mesh");
  reject("contract frozen catalog hash", (copy) => {
    copy.contract.frozenCatalogSha256 = poisonedHash;
  });
  reject("build source repository", (copy) => {
    copy.buildManifest.source.repository = "https://example.invalid/poisoned";
  });
  reject("build source commit", (copy) => copy.buildManifest.source.commit = "0".repeat(40));
  reject("build source graph nodes", (copy) => {
    copy.buildManifest.sourceGraph.nodes[0].sha256 = poisonedHash;
  });
  reject("build source graph edges", (copy) => copy.buildManifest.sourceGraph.edges.reverse());
  reject("build.artifact.bytes", (copy) => copy.buildManifest.artifact.bytes++);
  reject("build.artifact.sha256", (copy) => copy.buildManifest.artifact.sha256 = poisonedHash);
  reject("evidence identity", (copy) => copy.evidence.evidenceId = "poisoned-evidence");
  for (const link of ["buildManifest", "contract", "fixture", "artifact"] as const) {
    reject(`evidence.${link}.sha256`, (copy) => copy.evidence[link].sha256 = poisonedHash);
  }
  reject("evidence complete output hash", (copy) => {
    copy.evidence.oracle.completeOutputSha256 = poisonedHash;
  });
  reject("evidence complete output bytes", (copy) => copy.evidence.oracle.bytes++);
  reject("evidence invariants", (copy) => {
    copy.evidence.oracle.invariants.exactTarget = false;
  });
  reject("evidence equivalent counter names", (copy) => {
    copy.evidence.oracle.equivalentCounterNames.reverse();
  });
  for (const target of ["jsCounters", "wasmCounters"] as const) {
    for (const counter of Object.keys(records.evidence.oracle[target])) {
      reject(`evidence ${target === "jsCounters" ? "JavaScript" : "Wasm"} counters`, (copy) => {
        copy.evidence.oracle[target][counter]++;
      });
    }
  }
});

Deno.test("cad mesh provenance resolves every source node and public link", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile(
      new URL("public/artifacts/cad-mesh-repair-v1/build-manifest.json", root),
    ),
  );
  assertEquals(
    manifest.source.commitUrl,
    `${manifest.source.repository}/commit/${manifest.source.commit}`,
  );
  for (const node of manifest.sourceGraph.nodes) {
    const result = await new Deno.Command("git", {
      cwd: root.pathname,
      args: ["show", `${manifest.source.commit}:${node.path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(result.success, node.path);
    assert(
      await sha256Hex(result.stdout) === node.sha256,
      `${node.path} does not match its source commit`,
    );
  }
  const paths = new Set(manifest.sourceGraph.nodes.map((node: { path: string }) => node.path));
  for (const edge of manifest.sourceGraph.edges) {
    assert(paths.has(edge.from), edge.from);
    assert(paths.has(edge.to), edge.to);
  }
  for (
    const path of [
      manifest.frozenCatalog.path,
      manifest.fixture.path,
      manifest.artifact.path,
      manifest.contract.path,
      manifest.contract.schema.path,
      manifest.evidence.path,
      manifest.evidence.schema.path,
      manifest.build.schema.path,
    ]
  ) assert(await exists(new URL(path, root)), path);
});

async function exists(url: URL) {
  try {
    await Deno.stat(url);
    return true;
  } catch {
    return false;
  }
}

Deno.test("cad mesh public route is closed and runnable assets are explicit", async () => {
  const source = (await Deno.readTextFile(new URL("server.ts", root))) +
    (await Deno.readTextFile(new URL("routes.generated.ts", root)));
  for (
    const route of [
      "/benchmarks/cad-mesh-repair-v1/",
      "/benchmarks/cad-mesh-repair-v1/demo.js",
      "/benchmarks/cad-mesh-repair-v1/worker.js",
      "/benchmarks/base/cad-mesh-repair/engine.js",
      "/artifacts/cad-mesh-repair-v1/dirty-grid.stl",
      "/artifacts/cad-mesh-repair-v1/mesh-repair.wasm",
      "/artifacts/cad-mesh-repair-v1/build-manifest.json",
      "/artifacts/cad-mesh-repair-v1/validation-evidence.json",
    ]
  ) assert(source.includes(route), route);
  const page = await Deno.readTextFile(
    new URL("public/benchmarks/cad-mesh-repair-v1/index.html", root),
  );
  assert(!/<script(?![^>]*\bsrc=)/i.test(page), "CSP-blocked inline script");
  assert(page.includes("/artifacts/cad-mesh-repair-v1/validation-evidence.json"));
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

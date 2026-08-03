import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals } from "../assert.ts";
import { sha256Hex } from "../../lib/canonical.ts";
import { createHandler } from "../../server.ts";
import {
  ANALYTIC_TOPOLOGY,
  INPUT_BYTES,
} from "../../benchmarks/base/cad-parametric-bracket/contract.js";
import { generateFixture } from "../../benchmarks/base/cad-parametric-bracket/fixture.js";
import {
  assertEquivalent,
  buildFeatureTree,
  decodeResult,
  instantiateBracketWasm,
  runJavaScript,
  runWasm,
} from "../../benchmarks/base/cad-parametric-bracket/engine.js";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const addFormats = (addFormatsModule as unknown as { default?: typeof addFormatsModule }).default ??
  addFormatsModule;
async function runtime() {
  return await instantiateBracketWasm(
    await Deno.readFile("public/artifacts/base-cad-parametric-bracket/bracket.wasm"),
  );
}

Deno.test("frozen v1 remains byte-identical and bracket registration is supplemental", async () => {
  assertEquals(
    await sha256Hex(await Deno.readFile("catalog/workloads.v1.json")),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  const registration = JSON.parse(
    await Deno.readTextFile("catalog/base-implementations.v1/cad.parametric-bracket.v1.json"),
  );
  assertEquals(registration.catalogMutation, false);
  assertEquals(registration.contract.topology.genus, 2);
  assertEquals(registration.contract.featureTree.length, 7);
  assert(registration.contract.excludedVariants.includes("OCCT"));
});

Deno.test("fixture freezes the exact box, cylinders, cuts, fillets and tessellation policy", async () => {
  const fixture = generateFixture();
  assertEquals(fixture.byteLength, INPUT_BYTES);
  const view = new DataView(fixture.buffer);
  assertEquals(view.getUint32(8, true), 2);
  assertEquals(view.getFloat64(24, true), 80);
  assertEquals(view.getFloat64(32, true), 40);
  assertEquals(view.getFloat64(40, true), 12);
  assertEquals(view.getFloat64(48, true), 5);
  assertEquals(view.getFloat64(56, true), 4);
  assertEquals(
    await sha256Hex(fixture),
    "69db74cd284702632eb67d52fc6f00c18a101afc8c671badb6097a7921e74922",
  );
});

Deno.test("complete JavaScript and material Wasm B-rep/tessellation outputs match every byte", async () => {
  const fixture = generateFixture();
  const js = runJavaScript(fixture);
  const wasm = runWasm(await runtime(), fixture);
  assertEquals(assertEquivalent(js, wasm), {
    exactBytes: true,
    completeOutputDigest: "50670daa6b950c62",
  });
  assertEquals(js.output, wasm.output);
  assertEquals(
    await sha256Hex(js.output),
    "47244801c8cc678e2e71aa53606b53b32939a65aa30700133b1fbf048e516433",
  );
  assertEquals(js.triangleCount, 5804);
  assertEquals(js.topology, {
    ...ANALYTIC_TOPOLOGY,
    watertight: true,
    oriented: true,
    tessellationEdges: 8706,
  });
  const jsCounters = js.counters as Record<string, number>;
  const wasmCounters = wasm.counters as Record<string, number>;
  assertEquals(jsCounters.featureNodes, 10);
  assertEquals(jsCounters.boxSolids, 1);
  assertEquals(jsCounters.cylinderSolids, 2);
  assertEquals(jsCounters.booleanCuts, 2);
  assertEquals(jsCounters.filletEdges, 4);
  assertEquals(jsCounters.booleanIntersectionTests, 64);
  assertEquals(jsCounters.intersectionTests, 3400);
  assertEquals(jsCounters.surfaceTriangles, 5804);
  assertEquals(jsCounters.tessellationVertices, 17412);
  assertEquals(jsCounters.allocations, 8);
  assertEquals(jsCounters.boundaryCrossings, 0);
  assertEquals(wasmCounters.allocations, 0);
  assertEquals(wasmCounters.boundaryCrossings, 2);
  const tree = buildFeatureTree(fixture).solid;
  assertEquals(tree.vertices.length, 20);
  assertEquals(tree.edges.length, 30);
  assertEquals(tree.faces.length, 12);
  assertEquals(
    tree.faces.filter((face: { surface: { kind: string } }) => face.surface.kind === "cylinder")
      .length,
    6,
  );
  assert(tree.edges.every((edge: { faces: number[] }) => edge.faces.length === 2));
  const c = await Deno.readTextFile("benchmarks/base/cad-parametric-bracket/bracket.c");
  for (
    const token of [
      "make_box_solid",
      "make_cylinder_solid",
      "boolean_cut",
      "fillet_vertical_edges",
      "finish_brep",
      "tessellate_faces",
      "SURFACE_CYLINDER",
    ]
  ) assert(c.includes(token));
});

Deno.test("simple solids, one cut and a fragile near-fillet cut differentially match", async () => {
  const cases = [
    generateFixture({ holeCenters: [] }),
    generateFixture({ holeCenters: [[20, 20]] }),
    generateFixture({ holeCenters: [[9, 9], [60, 20]] }),
    generateFixture({
      width: 48,
      height: 32,
      depth: 7,
      filletRadius: 3,
      holeRadius: 2,
      holeCenters: [[12, 16], [36, 16]],
    }),
  ];
  for (const fixture of cases) {
    const js = runJavaScript(fixture);
    const wasm = runWasm(await runtime(), fixture);
    assertEquivalent(js, wasm);
    assert(js.triangleCount > 0);
    const holeCount = new DataView(fixture.buffer).getUint32(8, true);
    assertEquals((js.counters as Record<string, number>).cylinderSolids, holeCount);
    assertEquals(js.topology.throughHoles, holeCount);
    assertEquals(js.topology.genus, holeCount);
    assertEquals(js.topology.faces, 10 + holeCount);
    assertEquals(js.topology.edges, 24 + holeCount * 3);
    assertEquals(js.topology.vertices, 16 + holeCount * 2);
  }
});

Deno.test("independent oracle rejects forged topology and feature counters", () => {
  const fixture = generateFixture({ holeCenters: [[20, 20]] });
  const valid = runJavaScript(fixture).output;
  for (const [offset, message] of [[24, "topology"], [64, "featureNodes"]] as const) {
    const forged = valid.slice();
    const view = new DataView(forged.buffer);
    if (offset === 24) view.setUint32(offset, 999, true);
    else view.setBigUint64(offset, 999n, true);
    let rejected = false;
    try {
      decodeResult(forged, "js-controlled", fixture);
    } catch (error) {
      rejected = error instanceof Error && error.message.includes(message);
    }
    assert(rejected, `forged ${message} was accepted`);
  }
  const sharp = runJavaScript(generateFixture({ holeCenters: [], filletRadius: 0 }));
  assertEquals(sharp.topology, {
    connectedComponents: 1,
    shells: 1,
    throughHoles: 0,
    genus: 0,
    faces: 6,
    edges: 12,
    vertices: 8,
    watertight: true,
    oriented: true,
    tessellationEdges: 18,
  });
  assertEquals((sharp.counters as Record<string, number>).featureNodes, 2);
});

Deno.test("Wasm memory is fixed and repeat runs clear complete output state", async () => {
  const wasm = await runtime();
  const first = runWasm(wasm, generateFixture());
  runWasm(wasm, generateFixture({ holeCenters: [] }));
  const third = runWasm(wasm, generateFixture());
  assertEquals(third.output, first.output);
  assertEquals((wasm.memory as WebAssembly.Memory).buffer.byteLength, 128 * 65536);
  let fixed = false;
  try {
    (wasm.memory as WebAssembly.Memory).grow(1);
  } catch (error) {
    fixed = error instanceof RangeError;
  }
  assert(fixed);
});

Deno.test("bracket demo lifecycle is fresh-worker, cancellable, token-bound and non-persistent", async () => {
  const demo = await Deno.readTextFile("public/demos/cad-parametric-bracket/demo.js");
  assert(demo.includes('new Worker("/demos/cad-parametric-bracket/worker.js"'));
  assert(demo.includes("worker !== owned") && demo.includes("token !== runToken"));
  assert(demo.includes("worker?.terminate()") && demo.includes("10_000"));
  assert(demo.includes('addEventListener("pagehide"'));
  assert(demo.includes("oracleVerified") && demo.includes("Frozen exact-output oracle verified"));
  const worker = await Deno.readTextFile("public/demos/cad-parametric-bracket/worker.js");
  assert(worker.includes('crypto.subtle.digest("SHA-256"'));
  assert(worker.includes("completeOutputSha256 !== manifest.completeOutputSha256"));
  assert(!/(localStorage|sessionStorage|indexedDB)/u.test(demo));
  const page = await Deno.readTextFile("public/demos/cad-parametric-bracket/index.html");
  assert(page.includes('role="status"') && page.includes('aria-live="polite"'));
  assert(page.includes("No performance claim.") && page.includes("stores and uploads nothing"));
});

Deno.test("bracket routes are closed, typed and mutation-safe", async () => {
  const handler = createHandler(null, "public");
  for (
    const path of [
      "/demos/cad-parametric-bracket/",
      "/demos/cad-parametric-bracket/worker.js",
      "/benchmarks/base/cad-parametric-bracket/engine.js",
      "/artifacts/base-cad-parametric-bracket/bracket.wasm",
      "/evidence/base-catalog/cad-parametric-bracket/js-controlled.json",
    ]
  ) assertEquals((await handler(new Request(`http://127.0.0.1${path}`))).status, 200);
  assertEquals(
    (await handler(
      new Request("http://127.0.0.1/demos/cad-parametric-bracket/", { method: "POST" }),
    )).status,
    403,
  );
  assertEquals(
    (await handler(
      new Request("http://127.0.0.1/artifacts/base-cad-parametric-bracket/../server.ts"),
    )).status,
    404,
  );
});

Deno.test("pinned bracket builder reproduces artifacts and records byte-identically", async () => {
  const paths = [
    "public/artifacts/base-cad-parametric-bracket/bracket.wasm",
    "public/artifacts/base-cad-parametric-bracket/fixture.bin",
    "public/artifacts/base-cad-parametric-bracket/reference-output.bin",
    "public/artifacts/base-cad-parametric-bracket/fixture-manifest.json",
    "public/artifacts/base-cad-parametric-bracket/build-manifest.json",
    "public/artifacts/base-cad-parametric-bracket/output-manifest.json",
    "public/artifacts/base-cad-parametric-bracket/source-bundle.txt",
    "public/evidence/base-catalog/cad-parametric-bracket/js-controlled.json",
    "public/evidence/base-catalog/cad-parametric-bracket/wasm-linear-controlled.json",
  ];
  const before = await Promise.all(
    paths.map(async (path) => await sha256Hex(await Deno.readFile(path))),
  );
  const build = JSON.parse(
    await Deno.readTextFile("public/artifacts/base-cad-parametric-bracket/build-manifest.json"),
  );
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts/base-cad-parametric-bracket,public/evidence/base-catalog/cad-parametric-bracket",
      "--allow-run=git,clang,wasm-ld",
      "scripts/build-base-cad-parametric-bracket.ts",
      `--source-commit=${build.source.commit}`,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  const after = await Promise.all(
    paths.map(async (path) => await sha256Hex(await Deno.readFile(path))),
  );
  assertEquals(after, before);
});

Deno.test("bracket records satisfy closed schema and retain exact bytes", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/cad-parametric-bracket-validation.schema.json"),
  );
  const ajv = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ allErrors: true, strict: false });
  (addFormats as unknown as (instance: unknown) => void)(ajv);
  const validate = ajv.compile(schema);
  const build = JSON.parse(
    await Deno.readTextFile("public/artifacts/base-cad-parametric-bracket/build-manifest.json"),
  );
  for (const variant of ["js-controlled", "wasm-linear-controlled"]) {
    const record = JSON.parse(
      await Deno.readTextFile(
        `public/evidence/base-catalog/cad-parametric-bracket/${variant}.json`,
      ),
    );
    assert(validate(record), JSON.stringify(validate.errors));
    assertEquals(record.sourceCommit, build.source.commit);
    assertEquals(
      record.source.sha256,
      await sha256Hex(await Deno.readFile(record.source.path)),
    );
    assertEquals(record.fixture.sha256, await sha256Hex(await Deno.readFile(record.fixture.path)));
    assertEquals(
      record.oracle.completeOutputSha256,
      "47244801c8cc678e2e71aa53606b53b32939a65aa30700133b1fbf048e516433",
    );
    assertEquals(record.oracle.exactCrossTargetBytes, true);

    const wrongTarget = structuredClone(record);
    wrongTarget.executionTarget = variant === "js-controlled" ? "wasm-linear" : "javascript";
    assert(!validate(wrongTarget), "variant/target mismatch passed schema");
    const forgedTopology = structuredClone(record);
    forgedTopology.oracle.topology = { forged: true };
    assert(!validate(forgedTopology), "open topology passed schema");
    const emptyCounters = structuredClone(record);
    emptyCounters.counters = {};
    assert(!validate(emptyCounters), "empty counters passed schema");
    const extraCounter = structuredClone(record);
    extraCounter.counters.forged = 1;
    assert(!validate(extraCounter), "extra counter passed schema");
  }
});

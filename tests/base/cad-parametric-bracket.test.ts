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
    completeOutputDigest: "d60fbade9eff2ffb",
  });
  assertEquals(js.output, wasm.output);
  assertEquals(
    await sha256Hex(js.output),
    "a1b9fe34b51782221b30aadd54b36aa6a45ba38846d6b44cca2669b75993b39f",
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
  assertEquals(jsCounters.allocations, 1);
  assertEquals(jsCounters.boundaryCrossings, 0);
  assertEquals(wasmCounters.allocations, 1);
  assertEquals(wasmCounters.boundaryCrossings, 2);
  const tree = buildFeatureTree(fixture).solid as unknown as {
    vertices: unknown[];
    edges: { coedges: number[] }[];
    faces: { id: number; surface: { kind: string }; loops: number[] }[];
    loops: { id: number; face: number; coedges: number[] }[];
    coedges: { id: number; loop: number; orientation: number; next: number; previous: number }[];
  };
  assertEquals(tree.vertices.length, 20);
  assertEquals(tree.edges.length, 30);
  assertEquals(tree.faces.length, 12);
  assertEquals(tree.loops.length, 16);
  assertEquals(tree.coedges.length, 60);
  assertEquals(
    tree.faces.filter((face: { surface: { kind: string } }) => face.surface.kind === "cylinder")
      .length,
    6,
  );
  assert(
    tree.edges.every((edge: { coedges: number[] }) =>
      edge.coedges.length === 2 &&
      edge.coedges.reduce(
          (sum: number, id: number) => sum + tree.coedges[id].orientation,
          0,
        ) === 0
    ),
  );
  assert(
    tree.faces.every((face: { id: number; loops: number[] }) =>
      face.loops.length > 0 &&
      tree.loops.every((loop: { id: number; face: number }) =>
        !face.loops.includes(loop.id) || loop.face === face.id
      )
    ),
  );
  assert(
    tree.coedges.every((coedge: { id: number; loop: number; next: number; previous: number }) => {
      const loop = tree.loops[coedge.loop];
      const index = loop.coedges.indexOf(coedge.id);
      return index >= 0 &&
        coedge.next === loop.coedges[(index + 1) % loop.coedges.length] &&
        coedge.previous === loop.coedges[(index + loop.coedges.length - 1) % loop.coedges.length];
    }),
  );
  const c = await Deno.readTextFile("benchmarks/base/cad-parametric-bracket/bracket.c");
  for (
    const token of [
      "make_box_solid",
      "make_cylinder_solid",
      "boolean_cut",
      "fillet_vertical_edges",
      "add_loop",
      "validate_brep",
      "construct_face_loops_from_brep",
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

Deno.test("deterministic parameter corpus preserves exact JS/Wasm B-rep results", async () => {
  const cases = [
    { width: 20, height: 20, depth: 1, filletRadius: 0, holeRadius: 1, holeCenters: [] },
    { width: 20, height: 20, depth: 2, filletRadius: 0, holeRadius: 1, holeCenters: [[5, 5]] },
    {
      width: 20,
      height: 20,
      depth: 3,
      filletRadius: 0,
      holeRadius: 1,
      holeCenters: [[5, 5], [15, 15]],
    },
    { width: 24, height: 18, depth: 4, filletRadius: 2, holeRadius: 1, holeCenters: [] },
    {
      width: 24,
      height: 18,
      depth: 5,
      filletRadius: 2,
      holeRadius: 1,
      holeCenters: [[12, 9]],
    },
    {
      width: 24,
      height: 18,
      depth: 6,
      filletRadius: 2,
      holeRadius: 1,
      holeCenters: [[6, 9], [18, 9]],
    },
    {
      width: 48,
      height: 32,
      depth: 7,
      filletRadius: 3,
      holeRadius: 2,
      holeCenters: [[12, 16], [36, 16]],
    },
    {
      width: 64,
      height: 48,
      depth: 8,
      filletRadius: 6,
      holeRadius: 3,
      holeCenters: [[16, 13], [48, 35]],
    },
    {
      width: 80,
      height: 40,
      depth: 12,
      filletRadius: 5,
      holeRadius: 4,
      holeCenters: [[9, 9], [60, 20]],
    },
  ];
  const wasm = await runtime();
  for (const parameters of cases) {
    const fixture = generateFixture(parameters);
    const js = runJavaScript(fixture);
    const linear = runWasm(wasm, fixture);
    assertEquivalent(js, linear);
    const profileEdges = parameters.filletRadius > 0 ? 8 : 4;
    const holes = parameters.holeCenters.length;
    assertEquals(js.topology.faces, 2 + profileEdges + holes);
    assertEquals(js.topology.edges, 3 * profileEdges + 3 * holes);
    assertEquals(js.topology.vertices, 2 * profileEdges + 2 * holes);
    assertEquals(js.topology.eulerCharacteristic, 2 - 2 * holes);
    assertEquals(js.topology.genus, holes);
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
    loops: 6,
    coedges: 24,
    eulerCharacteristic: 2,
    watertight: true,
    oriented: true,
    tessellationEdges: 18,
  });
  assertEquals((sharp.counters as Record<string, number>).featureNodes, 2);

  let missingOperativeCounters = false;
  try {
    decodeResult(valid, "js-controlled", fixture);
  } catch (error) {
    missingOperativeCounters = error instanceof Error &&
      error.message.includes("operative execution counters");
  }
  assert(missingOperativeCounters, "variant identity injected execution counters");

  const corruptedMesh = valid.slice();
  const corruptView = new DataView(corruptedMesh.buffer);
  const triangleOffset = 256 + (36 + 32) * 16;
  corruptView.setFloat64(
    triangleOffset,
    corruptView.getFloat64(triangleOffset, true) + 0.125,
    true,
  );
  let meshRejected = false;
  try {
    decodeResult(corruptedMesh, "js-controlled", fixture, {
      allocations: 1,
      boundaryCrossings: 0,
    });
  } catch (error) {
    meshRejected = error instanceof Error &&
      (error.message.includes("2-manifold") || error.message.includes("Euler"));
  }
  assert(meshRejected, "independent mesh topology oracle accepted a forged mesh");
});

Deno.test("overlapping and tangent holes are rejected by both input contracts", async () => {
  for (const secondX of [21, 28]) {
    let generatorRejected = false;
    try {
      generateFixture({ holeCenters: [[20, 20], [secondX, 20]] });
    } catch (error) {
      generatorRejected = error instanceof Error && error.message.includes("through-holes");
    }
    assert(generatorRejected, `fixture generator accepted second center ${secondX}`);
  }

  const overlapping = generateFixture();
  new DataView(overlapping.buffer).setFloat64(80, 21, true);
  let jsRejected = false;
  try {
    runJavaScript(overlapping);
  } catch (error) {
    jsRejected = error instanceof Error && error.message.includes("through-holes");
  }
  assert(jsRejected, "JavaScript accepted overlapping holes");

  const wasm = await runtime();
  const raw = wasm as unknown as {
    memory: WebAssembly.Memory;
    input_ptr: () => number;
    run: () => number;
  };
  new Uint8Array(raw.memory.buffer, raw.input_ptr(), INPUT_BYTES).set(overlapping);
  assertEquals(raw.run(), 0);
  let wrapperRejected = false;
  try {
    runWasm(wasm, overlapping);
  } catch (error) {
    wrapperRejected = error instanceof Error && error.message.includes("through-holes");
  }
  assert(wrapperRejected, "Wasm wrapper accepted overlapping holes");
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
  const page = await Deno.readTextFile("public/benchmarks/cad-parametric-bracket/index.html");
  assert(page.includes('role="status"') && page.includes('aria-live="polite"'));
  assert(page.includes("No performance claim.") && page.includes("stores and uploads nothing"));
});

Deno.test("bracket routes are closed, typed and mutation-safe", async () => {
  const handler = createHandler(null, "public");
  for (
    const path of [
      "/benchmarks/cad-parametric-bracket/",
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

Deno.test("pinned bracket builder and extracted source bundle reproduce independently", async () => {
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

  const bundle = await Deno.readTextFile(
    "public/artifacts/base-cad-parametric-bracket/source-bundle.txt",
  );
  const retainedFiles = new Map<string, string>();
  for (const file of build.source.files) {
    const start = `===== BEGIN ${file.path} sha256=${file.sha256} =====\n`;
    const end = `===== END ${file.path} =====\n`;
    const startIndex = bundle.indexOf(start);
    const endIndex = bundle.indexOf(end, startIndex + start.length);
    assert(startIndex >= 0 && endIndex > startIndex, `missing bundled content for ${file.path}`);
    const content = bundle.slice(startIndex + start.length, endIndex);
    assertEquals(await sha256Hex(new TextEncoder().encode(content)), file.sha256);
    retainedFiles.set(file.path, content);
  }
  assertEquals([...retainedFiles.keys()], [
    "lib/canonical.ts",
    "benchmarks/base/cad-parametric-bracket/contract.js",
    "benchmarks/base/cad-parametric-bracket/fixture.js",
    "benchmarks/base/cad-parametric-bracket/engine.js",
    "benchmarks/base/cad-parametric-bracket/bracket.c",
    "scripts/reproduce-base-cad-parametric-bracket.ts",
  ]);

  const extractedRoot = await Deno.makeTempDir({ prefix: "cad-bracket-retained-source-" });
  try {
    const initialEntries: string[] = [];
    for await (const entry of Deno.readDir(extractedRoot)) initialEntries.push(entry.name);
    assertEquals(initialEntries, []);
    for (const [path, content] of retainedFiles) {
      assert(!path.startsWith("/") && !path.split("/").includes(".."), `unsafe path ${path}`);
      const destination = `${extractedRoot}/${path}`;
      await Deno.mkdir(destination.slice(0, destination.lastIndexOf("/")), { recursive: true });
      await Deno.writeTextFile(destination, content);
    }
    const reproduction = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--cached-only",
        "--no-config",
        "--allow-read=.",
        "--allow-write=reproduced",
        "--allow-run=clang,wasm-ld",
        "scripts/reproduce-base-cad-parametric-bracket.ts",
      ],
      cwd: extractedRoot,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(reproduction.success, new TextDecoder().decode(reproduction.stderr));
    const summary = JSON.parse(new TextDecoder().decode(reproduction.stdout));
    assertEquals(summary.exactCrossTargetBytes, true);
    assertEquals(summary.completeOutputDigest, "d60fbade9eff2ffb");
    for (
      const [reproduced, published] of [
        ["fixture.bin", build.artifacts.fixture],
        ["bracket.wasm", build.artifacts.wasm],
        ["reference-output.bin", build.artifacts.referenceOutput],
      ] as const
    ) {
      const bytes = await Deno.readFile(
        `${extractedRoot}/reproduced/base-cad-parametric-bracket/${reproduced}`,
      );
      assertEquals(bytes.byteLength, published.bytes);
      assertEquals(await sha256Hex(bytes), published.sha256);
    }
  } finally {
    await Deno.remove(extractedRoot, { recursive: true });
  }
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
      "a1b9fe34b51782221b30aadd54b36aa6a45ba38846d6b44cca2669b75993b39f",
    );
    assertEquals(record.oracle.exactCrossTargetBytes, true);

    const wrongTarget = structuredClone(record);
    wrongTarget.executionTarget = variant === "js-controlled" ? "wasm-linear" : "javascript";
    assert(!validate(wrongTarget), "variant/target mismatch passed schema");
    const forgedTopology = structuredClone(record);
    forgedTopology.oracle.topology = { forged: true };
    assert(!validate(forgedTopology), "open topology passed schema");
    const wrongTopologyCount = structuredClone(record);
    wrongTopologyCount.oracle.topology.faces = 999;
    assert(!validate(wrongTopologyCount), "forged topology count passed schema");
    const wrongCounter = structuredClone(record);
    wrongCounter.counters.featureNodes = 999;
    assert(!validate(wrongCounter), "forged feature counter passed schema");
    const emptyCounters = structuredClone(record);
    emptyCounters.counters = {};
    assert(!validate(emptyCounters), "empty counters passed schema");
    const extraCounter = structuredClone(record);
    extraCounter.counters.forged = 1;
    assert(!validate(extraCounter), "extra counter passed schema");
  }
});

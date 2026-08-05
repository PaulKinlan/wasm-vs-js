import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../../lib/canonical.ts";
import { createHandler } from "../../server.ts";
import { assert, assertEquals } from "../assert.ts";

function assertThrows(fn: () => unknown, includes: string) {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes(includes)) return;
    throw error;
  }
  throw new Error("expected throw");
}
import {
  fixtureWords,
  generateOlapFixture,
  OLAP,
} from "../../benchmarks/base/database-olap-chart/fixture.js";
import { validateOlapBrowserResults } from "../../benchmarks/base/database-olap-chart/browser-validation.js";
import {
  instantiateOlapWasm,
  runOlapJavaScript,
  runOlapWasm,
} from "../../benchmarks/base/database-olap-chart/engine.js";

const Ajv2020 =
  ((Ajv2020Module as unknown as { default?: unknown }).default ?? Ajv2020Module) as unknown as new (
    options: { strict: boolean },
  ) => { compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown } };
const expectedCatalogSha = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";
const expectedFixtureSha = "5cf987b48dffafc4d11f11f23d25c2064e631a8ac8070ef89fdb2090751b9e8c";
const expectedDigest = "e26a152f";

async function runtime() {
  return await instantiateOlapWasm(
    await Deno.readFile("public/artifacts/database-olap-chart/database-olap-chart.wasm"),
  );
}

Deno.test("base OLAP supplemental registration preserves the frozen v1 catalog bytes", async () => {
  assertEquals(
    await sha256Hex(await Deno.readFile("catalog/workloads.v1.json")),
    expectedCatalogSha,
  );
  assertEquals(
    await sha256Hex(await Deno.readFile("public/data/workloads.v1.json")),
    expectedCatalogSha,
  );
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-implementation/registration.schema.json"),
  );
  const registration = JSON.parse(
    await Deno.readTextFile("benchmarks/base/database-olap-chart/implementation-contract.v1.json"),
  );
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert(validate(registration), JSON.stringify(validate.errors));
  assertEquals(registration.catalogEquivalenceClass, "semantic-product-choice");
  assertEquals(registration.performanceClaims, []);
  const recordSchema = JSON.parse(
    await Deno.readTextFile("schemas/base-implementation/correctness-record.schema.json"),
  );
  const record = JSON.parse(
    await Deno.readTextFile("public/evidence/base/database-olap-chart/correctness-record.json"),
  );
  const validateRecord = new Ajv2020({ strict: true }).compile(recordSchema);
  assert(validateRecord(record), JSON.stringify(validateRecord.errors));
});

Deno.test("base OLAP generator freezes 10,000 rows and exactly five query-control updates", async () => {
  const fixture = generateOlapFixture();
  assertEquals(fixture.byteLength, 240_152);
  assertEquals(await sha256Hex(fixture), expectedFixtureSha);
  assertEquals(fixture, await Deno.readFile("public/artifacts/database-olap-chart/fixture.bin"));
  const words = fixtureWords(fixture);
  assertEquals(Array.from(words.slice(0, 8)), [OLAP.magic, 1, 10_000, 5, 16, 8, 6, 6]);
  const queryStart = 8 + 10_000 * 6;
  assertEquals(Array.from(words.slice(queryStart)), [
    0xff,
    0xffff,
    0,
    0,
    0,
    1,
    0x55,
    0x0f0f,
    30,
    1,
    0,
    2,
    0xaa,
    0xf0f0,
    55,
    0,
    1,
    3,
    0x0f,
    0x3333,
    20,
    1,
    1,
    4,
    0xf0,
    0xcccc,
    70,
    0,
    0,
    5,
  ]);
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/database-olap-chart/fixture-manifest.json"),
  );
  assertEquals(manifest.fixture.sha256, expectedFixtureSha);
  assertEquals(manifest.rights, {
    licenseSpdx: "CC0-1.0",
    owner: "Paul Kinlan / wasm-vs-js project",
    source: "project-generated",
    redistribution: "permitted",
    externalInputs: [],
  });
});

Deno.test("JavaScript and material linear Wasm execute the complete five-query trace identically", async () => {
  const fixture = generateOlapFixture();
  const js = runOlapJavaScript(fixture);
  const wasmRuntime = await runtime();
  const inputPtr = wasmRuntime.input_ptr as () => number;
  const run = wasmRuntime.run as (bytes: number) => number;
  const resultPtr = wasmRuntime.result_ptr as () => number;
  const counter = wasmRuntime.counter as (index: number) => number;
  let exportedCalls = 0;
  const countedRuntime = {
    memory: wasmRuntime.memory,
    input_ptr: () => {
      exportedCalls += 1;
      return inputPtr();
    },
    run: (bytes: number) => {
      exportedCalls += 1;
      return run(bytes);
    },
    result_ptr: () => {
      exportedCalls += 1;
      return resultPtr();
    },
    counter: (index: number) => {
      exportedCalls += 1;
      return counter(index);
    },
  };
  const wasm = runOlapWasm(countedRuntime, fixture);
  assertEquals(js.digest, expectedDigest);
  assertEquals(wasm.digest, expectedDigest);
  assertEquals(wasm.output, js.output);
  assertEquals(wasm.chartModels, js.chartModels);
  assertEquals(js.chartModels.length, 5);
  assertEquals(js.chartModels.map((model) => model.controlRevision), [1, 2, 3, 4, 5]);
  const shared = { ...js.counters, allocations: 0, boundaryCrossings: 0 };
  assertEquals({ ...wasm.counters, allocations: 0, boundaryCrossings: 0 }, shared);
  assertEquals(js.counters, {
    queries: 5,
    rowsVisited: 50_000,
    predicateChecks: 150_000,
    matchedRows: 18_297,
    sortComparisons: 207_481,
    aggregateRows: 18_297,
    chartBins: 80,
    outputRows: 40,
    outputWords: 560,
    allocations: 41,
    boundaryCrossings: 0,
  });
  assertEquals(wasm.counters.allocations, 0);
  assertEquals(wasm.counters.boundaryCrossings, 12);
  assertEquals(exportedCalls, wasm.counters.boundaryCrossings);
  const c = await Deno.readTextFile("benchmarks/base/database-olap-chart/olap.c");
  for (
    const material of [
      "stable_sort",
      "row_key",
      "region_mask",
      "category_mask",
      "revenue",
      "result_words",
    ]
  ) assert(c.includes(material));
  const adapter = await Deno.readTextFile("benchmarks/base/database-olap-chart/engine.js");
  assert(!adapter.includes("return [next"));
  assert(!adapter.includes("output.set(["));
  const wasmAdapter = adapter.slice(adapter.indexOf("export function runOlapWasm"));
  assert(!wasmAdapter.includes("runOlapJavaScript"));
});

Deno.test("every retained chart model satisfies predicates, stable ordering, and complete bins", () => {
  const fixture = generateOlapFixture();
  const words = new Uint32Array(fixture.buffer);
  const models = runOlapJavaScript(fixture).chartModels;
  const queryStart = 8 + OLAP.rows * OLAP.rowWords;
  for (const model of models) {
    const qp = queryStart + model.query * OLAP.queryWords;
    const regionMask = words[qp], categoryMask = words[qp + 1], minUnits = words[qp + 2];
    const descending = words[qp + 3] !== 0, sortColumn = words[qp + 4];
    let previousKey: number | undefined;
    let previousId = 0;
    for (const row of model.topRows) {
      const value = (column: number) => words[8 + column * OLAP.rows + row.stableRowId];
      assert(((regionMask >>> value(1)) & 1) === 1);
      assert(((categoryMask >>> value(2)) & 1) === 1);
      assert(value(4) >= minUnits);
      const key = value(sortColumn === 0 ? 5 : 4);
      if (previousKey !== undefined) {
        assert(descending ? previousKey >= key : previousKey <= key);
        if (previousKey === key) assert(previousId < row.stableRowId);
      }
      previousKey = key;
      previousId = row.stableRowId;
    }
    assertEquals(model.bins.reduce((sum, bin) => sum + bin.count, 0), model.matchedRows);
    assertEquals(model.bins.length, 16);
  }
});

Deno.test("OLAP fixture and target boundaries fail closed on corruption and unknown targets", async () => {
  const corrupt = generateOlapFixture();
  corrupt[40] ^= 1;
  assertThrows(() => fixtureWords(corrupt), "fixture mismatch");
  const wasm = await runtime();
  new Uint8Array((wasm.memory as WebAssembly.Memory).buffer, (wasm.input_ptr as () => number)(), 16)
    .fill(0);
  assertEquals((wasm.run as (length: number) => number)(16), 0);
  const worker = await Deno.readTextFile("public/benchmarks/database-olap-chart/worker.js");
  assert(worker.includes("OLAP_VARIANTS.includes"));
  assert(worker.includes('crypto.subtle.digest("SHA-256"'));
  assert(worker.includes("FROZEN_ARTIFACTS"));
  assert(worker.includes("de1bb41b8e1053b7639a4c96f150698bb3542c6278ba4e6d277c49f9715374c1"));
  assert(worker.includes("validateOlapBrowserResults(javascript, wasm"));
  assert(!worker.includes("localStorage"));
  assert(!worker.includes('fetch("/api/'));
  assertThrows(() => fixtureWords(new Uint8Array(3)), "aligned Uint8Array");
});

Deno.test("browser OLAP gate rejects full-output, counter, cross-target, and oracle corruption", async () => {
  const fixture = generateOlapFixture();
  const js = runOlapJavaScript(fixture);
  const wasm = runOlapWasm(await runtime(), fixture);
  const oracle = JSON.parse(
    await Deno.readTextFile("public/artifacts/database-olap-chart/output-manifest.json"),
  );
  assertEquals(validateOlapBrowserResults(js, wasm, oracle), {
    expectedDigest,
    exactArtifactHashes: true,
    fullOutputValidated: true,
    countersValidated: true,
    crossTargetValidated: true,
    oracleValidated: true,
    allFiveModelsValidated: true,
  });

  const wrongOutput = { ...wasm, output: wasm.output.slice() };
  wrongOutput.output[559] ^= 1;
  assertThrows(
    () => validateOlapBrowserResults(js, wrongOutput, oracle),
    "Wasm complete output mismatch",
  );
  const wrongCounters = { ...wasm, counters: { ...wasm.counters, rowsVisited: 0 } };
  assertThrows(
    () => validateOlapBrowserResults(js, wrongCounters, oracle),
    "Wasm counters mismatch",
  );
  const crossTargetWasm = { ...wasm, counters: { ...wasm.counters, rowsVisited: 0 } };
  const crossTargetOracle = structuredClone(oracle);
  crossTargetOracle.variants["wasm-linear-controlled"].counters.rowsVisited = 0;
  assertThrows(
    () => validateOlapBrowserResults(js, crossTargetWasm, crossTargetOracle),
    "cross-target rowsVisited counter mismatch",
  );
  const wrongOracle = structuredClone(oracle);
  wrongOracle.completeOutput.digest = "00000000";
  assertThrows(
    () => validateOlapBrowserResults(js, wasm, wrongOracle),
    "oracle output contract mismatch",
  );
});

Deno.test("pinned OLAP build reproduces Wasm, fixture, manifests, and correctness record", async () => {
  const paths = [
    "public/artifacts/database-olap-chart/database-olap-chart.wasm",
    "public/artifacts/database-olap-chart/fixture.bin",
    "public/artifacts/database-olap-chart/fixture-manifest.json",
    "public/artifacts/database-olap-chart/output-manifest.json",
    "public/artifacts/database-olap-chart/build-manifest.json",
    "public/evidence/base/database-olap-chart/correctness-record.json",
  ];
  const before = new Map<string, string>();
  for (const path of paths) before.set(path, await sha256Hex(await Deno.readFile(path)));
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/database-olap-chart/build-manifest.json"),
  );
  for (const artifact of manifest.artifacts) {
    assertEquals(await sha256Hex(await Deno.readFile(artifact.path)), artifact.sha256);
    assertEquals((await Deno.stat(artifact.path)).size, artifact.bytes);
  }
  const result = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read=.",
      "--allow-write=public/artifacts,public/evidence",
      "--allow-run=clang,wasm-ld",
      "scripts/build-base-olap.ts",
      `--source-commit=${manifest.sourceCommit}`,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  for (const path of paths) {
    assertEquals(await sha256Hex(await Deno.readFile(path)), before.get(path));
  }
});

Deno.test("public OLAP routes are closed, typed, and read-only", async () => {
  const handler = createHandler(null, "public");
  for (
    const [path, type] of [
      ["/benchmarks/database-olap-chart/", "text/html"],
      ["/benchmarks/database-olap-chart/runner.js", "text/javascript"],
      ["/benchmarks/database-olap-chart/worker.js", "text/javascript"],
      ["/benchmarks/base/database-olap-chart/engine.js", "text/javascript"],
      ["/benchmarks/base/database-olap-chart/browser-validation.js", "text/javascript"],
      ["/artifacts/database-olap-chart/database-olap-chart.wasm", "application/wasm"],
      ["/artifacts/database-olap-chart/fixture.bin", "application/octet-stream"],
      ["/artifacts/database-olap-chart/build-manifest.json", "application/json"],
      ["/artifacts/database-olap-chart/fixture-manifest.json", "application/json"],
      ["/artifacts/database-olap-chart/output-manifest.json", "application/json"],
      ["/evidence/base/database-olap-chart/correctness-record.json", "application/json"],
    ]
  ) {
    const response = await handler(new Request(`http://127.0.0.1${path}`));
    assertEquals(response.status, 200);
    assert(response.headers.get("content-type")?.includes(type), path);
  }
  assertEquals(
    (await handler(new Request("http://127.0.0.1/artifacts/database-olap-chart/unknown"))).status,
    404,
  );
  assertEquals(
    (await handler(
      new Request("http://127.0.0.1/benchmarks/database-olap-chart/", { method: "POST" }),
    )).status,
    403,
  );
});

Deno.test("runner lifecycle owns fresh workers, timeout, stale-token, cancel, and pagehide cleanup", async () => {
  const runner = await Deno.readTextFile("public/benchmarks/database-olap-chart/runner.js");
  for (
    const text of [
      "new Worker",
      "acceptedToken !== token",
      "worker?.terminate()",
      "15_000",
      "pagehide",
      "Cancelled",
      "aria-label",
      "exactArtifactHashes",
      "crossTargetValidated",
    ]
  ) assert(runner.includes(text));
  const page = await Deno.readTextFile("public/benchmarks/database-olap-chart/index.html");
  for (
    const text of [
      'role="status"',
      'aria-live="polite"',
      // standard-shell copy (consistency wave 2): lede carries the disclosures
      "Exact canonical",
      "output is verified before any timing",
      "stores and uploads nothing",
      "five canonical chart models",
    ]
  ) assert(page.includes(text));
});

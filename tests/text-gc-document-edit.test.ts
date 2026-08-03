import Ajv2020Module from "ajv2020";
import { createHandler } from "../server.ts";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { executeFixture, parseFixture } from "../benchmarks/v1/text-gc-document-edit/workload.js";
import * as kotlinModule from "../public/artifacts/text-gc-document-edit/text-gc-document-edit.mjs";
import { assert, assertEquals, assertRejects } from "./assert.ts";

const runDocumentFixture = kotlinModule.runDocumentFixture as unknown as (input: string) => string;
const wasmGcFeatureProof = kotlinModule.wasmGcFeatureProof as unknown as () => string;

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

const root = new URL("../", import.meta.url);
const artifact = new URL("public/artifacts/text-gc-document-edit/", root);
const fixture = await Deno.readTextFile(new URL("fixture.v1.txt", artifact));
const reference = JSON.parse(await Deno.readTextFile(new URL("reference.json", artifact)));
const fixtureManifest = JSON.parse(
  await Deno.readTextFile(new URL("fixture-manifest.json", artifact)),
);
const buildManifest = JSON.parse(
  await Deno.readTextFile(new URL("build-manifest.json", artifact)),
);

function wasmResult(input = fixture) {
  return JSON.parse(runDocumentFixture(input));
}

function expectBothReject(input: string) {
  let jsRejected = false;
  let wasmRejected = false;
  try {
    executeFixture(input);
  } catch {
    jsRejected = true;
  }
  try {
    wasmResult(input);
  } catch {
    wasmRejected = true;
  }
  assert(jsRejected, "JavaScript target must reject invalid fixture");
  assert(wasmRejected, "WasmGC target must reject invalid fixture");
}

Deno.test("text.gc-document-edit runs the exact 10,000-edit fixture in both targets", async () => {
  const parsed = parseFixture(fixture);
  assertEquals(parsed.initial.length, 256);
  assertEquals(parsed.operations.length, 10_000);
  assertEquals(
    parsed.operations.filter((operation: { kind: string }) => operation.kind === "insert").length,
    3_334,
  );
  assertEquals(
    parsed.operations.filter((operation: { kind: string }) => operation.kind === "delete").length,
    3_333,
  );
  assertEquals(
    parsed.operations.filter((operation: { kind: string }) => operation.kind === "reparent").length,
    3_333,
  );
  const js = executeFixture(fixture);
  const wasm = wasmResult();
  assertEquals(js.canonical, wasm.canonical);
  assertEquals(await sha256Hex(new TextEncoder().encode(js.canonical)), reference.canonicalSha256);
  assertEquals(new TextEncoder().encode(js.canonical).length, reference.canonicalBytes);
  assertEquals(js.counters.operations, 10_000);
  assertEquals(js.counters["final-nodes"], 257);
  assertEquals(wasm.counters["boundary-crossings"], 2);
  assertEquals(js.counters["boundary-crossings"], 0);
  assertEquals(canonicalize(js.identity), canonicalize(reference.identity));
  assertEquals(canonicalize(wasm.identity), canonicalize(reference.identity));
  assertEquals(js.gcDiagnostics.status, "unavailable");
  assertEquals(wasm.gcDiagnostics.status, "unavailable");
});

Deno.test("text.gc-document-edit preserves ordered labels and escaping differentially", () => {
  const replacements = [
    ["436166c3a92d30", "5b5d28293a5cc3a9"],
    ["e69db1e4baac2d31", "f09f9a805be69db1e4baac5d"],
    ["d985d8b1d8add8a8d8a72d32", "d986d8b5d985d8aad8a85c3a"],
  ];
  for (const [from, to] of replacements) {
    const candidate = fixture.replace(from, to);
    const js = executeFixture(candidate);
    const wasm = wasmResult(candidate);
    assertEquals(js.canonical, wasm.canonical);
    assertEquals(
      canonicalize(js.counters),
      canonicalize({ ...wasm.counters, "boundary-crossings": 0 }),
    );
    assertEquals(canonicalize(js.identity), canonicalize(wasm.identity));
  }
});

Deno.test("text.gc-document-edit rejects invalid ids, positions, deletion, and cycles", () => {
  const lines = fixture.trimEnd().split("\n");
  const firstInsert = lines.findIndex((line) => line.startsWith("I\t"));
  const firstDelete = lines.findIndex((line) => line.startsWith("D\t"));
  const firstReparent = lines.findIndex((line) => line.startsWith("R\t"));
  const cases: string[] = [];

  let copy = [...lines];
  copy[4] = copy[3];
  cases.push(`${copy.join("\n")}\n`);

  copy = [...lines];
  const insertFields = copy[firstInsert].split("\t");
  insertFields[3] = "999999";
  copy[firstInsert] = insertFields.join("\t");
  cases.push(`${copy.join("\n")}\n`);

  copy = [...lines];
  copy[firstDelete] = "D\t0";
  cases.push(`${copy.join("\n")}\n`);

  copy = [...lines];
  copy[firstDelete] = "D\t1";
  cases.push(`${copy.join("\n")}\n`);

  copy = [...lines];
  copy[firstReparent] = "R\t1\t5\t0";
  cases.push(`${copy.join("\n")}\n`);

  for (const candidate of cases) expectBothReject(candidate);
});

Deno.test("Kotlin artifact executes WasmGC-managed node/list/string proof", async () => {
  const bytes = await Deno.readFile(new URL("text-gc-document-edit.wasm", artifact));
  const compileWithOptions = WebAssembly.compile as unknown as (
    bytes: BufferSource,
    options: { builtins: string[]; importedStringConstants: string },
  ) => Promise<WebAssembly.Module>;
  const module = await compileWithOptions(bytes, {
    builtins: ["js-string"],
    importedStringConstants: "'",
  });
  const exports = WebAssembly.Module.exports(module).map((entry) => entry.name);
  assert(exports.includes("runDocumentFixture"));
  assert(exports.includes("wasmGcFeatureProof"));
  assertEquals(wasmGcFeatureProof(), "0:array-backed child:1");
  assert(bytes.includes(0x5f), "compiled Wasm must contain a struct type form");
  assert(bytes.includes(0x5e), "compiled Wasm must contain an array type form");
  assertEquals(buildManifest.wasmFeatures.gc, true);
  assertEquals(buildManifest.toolchain.kotlinPlugin, "2.3.21");
  assertEquals(buildManifest.toolchain.gradle, "9.6.1");
});

Deno.test("text.gc-document-edit fixture, source tree, and artifacts match manifests", async () => {
  const fixtureBytes = await Deno.readFile(new URL("fixture.v1.txt", artifact));
  assertEquals(await sha256Hex(fixtureBytes), fixtureManifest.fixture.sha256);
  assertEquals(
    fixtureManifest.frozenCatalog.sha256,
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  for (const entry of buildManifest.sources) {
    const bytes = await Deno.readFile(new URL(entry.path, root));
    assert(bytes.length === entry.bytes, entry.path);
    assert((await sha256Hex(bytes)) === entry.sha256, entry.path);
  }
  for (const entry of buildManifest.outputs) {
    const bytes = await Deno.readFile(new URL(entry.path, root));
    assert(bytes.length === entry.bytes, entry.path);
    assert((await sha256Hex(bytes)) === entry.sha256, entry.path);
  }
  const catalog = await Deno.readFile(new URL("catalog/workloads.v1.json", root));
  const publicCatalog = await Deno.readFile(new URL("public/data/workloads.v1.json", root));
  assertEquals(await sha256Hex(catalog), buildManifest.frozenCatalog.sha256);
  assertEquals(await sha256Hex(publicCatalog), buildManifest.frozenCatalog.sha256);
});

Deno.test("text.gc-document-edit public routes are explicit and read-only", async () => {
  const handler = createHandler(null, "public");
  const routes = [
    ["/demos/text.gc-document-edit.v1/", "text/html"],
    ["/text-gc-document-edit-runner.js", "text/javascript"],
    ["/text-gc-document-edit-worker.js", "text/javascript"],
    ["/benchmarks/v1/text-gc-document-edit/workload.js", "text/javascript"],
    ["/artifacts/text-gc-document-edit/fixture.v1.txt", "text/plain"],
    ["/artifacts/text-gc-document-edit/text-gc-document-edit.wasm", "application/wasm"],
    ["/artifacts/text-gc-document-edit/build-manifest.json", "application/json"],
    ["/evidence/v1-base/text-gc-document-edit/js-controlled.json", "application/json"],
    ["/evidence/v1-base/text-gc-document-edit/wasmgc-controlled.json", "application/json"],
    ["/data/v1-base-implementation-status.v1.json", "application/json"],
  ];
  for (const [path, contentType] of routes) {
    const response = await handler(new Request(`http://127.0.0.1${path}`));
    assert(response.status === 200, path);
    assert(response.headers.get("content-type")?.startsWith(contentType), path);
  }
  const mutation = await handler(
    new Request("http://127.0.0.1/demos/text.gc-document-edit.v1/", { method: "POST" }),
  );
  assertEquals(mutation.status, 403);
  const unknown = await handler(
    new Request("http://127.0.0.1/artifacts/text-gc-document-edit/private.json"),
  );
  assertEquals(unknown.status, 404);
});

Deno.test("text.gc-document-edit runner contains bounded lifecycle and no persistence", async () => {
  const runner = await Deno.readTextFile(new URL("public/text-gc-document-edit-runner.js", root));
  const worker = await Deno.readTextFile(new URL("public/text-gc-document-edit-worker.js", root));
  for (
    const required of ["120_000", "worker.terminate()", "runGeneration", "pagehide", "Cancelled."]
  ) {
    assert(runner.includes(required), required);
  }
  for (
    const forbidden of ["localStorage", "sessionStorage", "indexedDB", "sendBeacon", 'fetch("/api/']
  ) {
    assert(!runner.includes(forbidden), forbidden);
    assert(!worker.includes(forbidden), forbidden);
  }
  assert(worker.includes("WebAssembly.CompileError"));
  assert(worker.includes('type: "unsupported"'));
  assert(worker.includes("complete canonical output mismatch"));
  assert(worker.includes("__TEXT_GC_DOCUMENT_EDIT_WASM_BYTES__"));
  assert(worker.includes("URL.createObjectURL"));
  assert(!worker.includes('import("/artifacts/text-gc-document-edit/'));
  const generatedGlue = await Deno.readTextFile(
    new URL("public/artifacts/text-gc-document-edit/text-gc-document-edit.mjs", root),
  );
  assert(generatedGlue.includes("pinned WasmGC bytes missing"));
  assert(!generatedGlue.includes("instantiateStreaming(fetch"));
});

Deno.test("text.gc-document-edit supplemental ledger and records pass closed schemas", async () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const statusSchema = JSON.parse(
    await Deno.readTextFile(new URL("schemas/v1-base-implementation-status.schema.json", root)),
  );
  const recordSchema = JSON.parse(
    await Deno.readTextFile(new URL("schemas/v1-base-correctness-record.schema.json", root)),
  );
  const validateStatus = ajv.compile(statusSchema);
  const validateRecord = ajv.compile(recordSchema);
  const status = JSON.parse(
    await Deno.readTextFile(new URL("catalog/v1-base-implementation-status.v1.json", root)),
  );
  assert(validateStatus(status), JSON.stringify(validateStatus.errors));
  for (const variant of ["js-controlled", "wasmgc-controlled"]) {
    const record = JSON.parse(
      await Deno.readTextFile(
        new URL(`public/evidence/v1-base/text-gc-document-edit/${variant}.json`, root),
      ),
    );
    assert(validateRecord(record), `${variant}: ${JSON.stringify(validateRecord.errors)}`);
  }
});

Deno.test("text.gc-document-edit validation records retain exact counters and no performance claim", async () => {
  for (const variant of ["js-controlled", "wasmgc-controlled"]) {
    const record = JSON.parse(
      await Deno.readTextFile(
        new URL(`public/evidence/v1-base/text-gc-document-edit/${variant}.json`, root),
      ),
    );
    assertEquals(record.passed, true);
    assertEquals(record.fixedWork.operations, 10_000);
    assertEquals(record.counters.operations, 10_000);
    assertEquals(record.oracle.fullOutputCompared, true);
    assertEquals(record.performanceClaim, null);
    assertEquals(record.gcDiagnostics.status, "unavailable");
  }
  const status = JSON.parse(
    await Deno.readTextFile(new URL("catalog/v1-base-implementation-status.v1.json", root)),
  );
  assertEquals(status.coverage.acceptedImplementedEntries, 0);
  assertEquals(status.coverage.denominator, 38);
  assert(status.coverage.statement.includes("does not change 0/38"));
});

Deno.test("text.gc-document-edit malformed fixture parser is bounded", async () => {
  await assertRejects(
    async () =>
      await Promise.resolve(
        parseFixture("text-gc-document-edit-fixture-v1\ninitial\t1\noperations\t9999\n"),
      ),
    "exactly 10,000",
  );
});

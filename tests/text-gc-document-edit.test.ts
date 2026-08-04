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

// The playground worker hardcodes this exact anchor chain — keep it bound to
// the served bytes so a surgical manifest rebind can never leave it stale.
const workerSource = await Deno.readTextFile(
  new URL("public/text-gc-document-edit-worker.js", root),
);

function wasmResult(input = fixture) {
  return JSON.parse(runDocumentFixture(input));
}

async function gitBytes(...args: string[]) {
  const result = await new Deno.Command("git", {
    cwd: new URL(".", root),
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  return result.stdout;
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

Deno.test("playground worker EXPECTED anchors match the served artifact bytes", async () => {
  const expected: Record<string, [string, string]> = {
    fixture: ["fixture.v1.txt", "public/artifacts/text-gc-document-edit/"],
    fixtureManifest: ["fixture-manifest.json", "public/artifacts/text-gc-document-edit/"],
    reference: ["reference.json", "public/artifacts/text-gc-document-edit/"],
    buildManifest: ["build-manifest.json", "public/artifacts/text-gc-document-edit/"],
    js: ["workload.js", "benchmarks/v1/text-gc-document-edit/"],
    wasm: ["text-gc-document-edit.wasm", "public/artifacts/text-gc-document-edit/"],
  };
  for (const [key, [file, dir]] of Object.entries(expected)) {
    const m = workerSource.match(new RegExp(`${key}: "([0-9a-f]{64})"`));
    assert(m, `worker EXPECTED.${key} anchor missing`);
    const bytes = await Deno.readFile(new URL(dir + file, root));
    assert(
      (await sha256Hex(bytes)) === m[1],
      `worker EXPECTED.${key} stale: pinned ${m[1]} vs served ${await sha256Hex(bytes)}`,
    );
  }
});

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

Deno.test("text.gc-document-edit rejects every malformed numeric field in both targets", () => {
  const lines = fixture.trimEnd().split("\n");
  const firstInsert = lines.findIndex((line) => line.startsWith("I\t"));
  const firstDelete = lines.findIndex((line) => line.startsWith("D\t"));
  const firstReparent = lines.findIndex((line) => line.startsWith("R\t"));
  const mutations: Array<[number, number]> = [
    [1, 1],
    [3, 1],
    [3, 2],
    [3, 3],
    [firstInsert, 1],
    [firstInsert, 2],
    [firstInsert, 3],
    [firstDelete, 1],
    [firstReparent, 1],
    [firstReparent, 2],
    [firstReparent, 3],
  ];
  for (const malformed of ["NaN", "1.5", "1e2", "", "2147483648", "-2147483649"]) {
    for (const [row, field] of mutations) {
      const candidate = [...lines];
      const fields = candidate[row].split("\t");
      fields[field] = malformed;
      candidate[row] = fields.join("\t");
      expectBothReject(`${candidate.join("\n")}\n`);
    }
  }
});

Deno.test("text.gc-document-edit rejects adversarial label encodings in both targets", () => {
  const lines = fixture.trimEnd().split("\n");
  const firstInsert = lines.findIndex((line) => line.startsWith("I\t"));
  for (const row of [3, firstInsert]) {
    const fields = lines[row].split("\t");
    const label = fields[4];
    const adversarial = [
      label.replace(/[a-f]/u, (character) => character.toUpperCase()),
      `+${label.slice(1)}`,
      `-${label.slice(1)}`,
      `g${label.slice(1)}`,
      label.slice(1),
    ];
    for (const encodedLabel of adversarial) {
      const candidate = [...lines];
      const candidateFields = candidate[row].split("\t");
      candidateFields[4] = encodedLabel;
      candidate[row] = candidateFields.join("\t");
      expectBothReject(`${candidate.join("\n")}\n`);
    }
  }
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
  assertEquals(buildManifest.toolchain.dependencyVerification.mode, "strict");
  const verificationBytes = await Deno.readFile(
    new URL(
      "benchmarks/v1/text-gc-document-edit/kotlin/gradle/verification-metadata.xml",
      root,
    ),
  );
  const verification = new TextDecoder().decode(verificationBytes);
  assert(verification.includes('name="kotlin-gradle-plugin" version="2.3.21"'));
  assert(verification.includes('name="binaryen" version="125"'));
  assertEquals(
    await sha256Hex(verificationBytes),
    buildManifest.toolchain.dependencyVerification.sha256,
  );
  const javaBytes = await Deno.readFile("/usr/lib/jvm/java-26-openjdk/bin/java");
  const javaRelease = await Deno.readFile("/usr/lib/jvm/java-26-openjdk/release");
  assertEquals(await sha256Hex(javaBytes), buildManifest.toolchain.java.executableSha256);
  assertEquals(await sha256Hex(javaRelease), buildManifest.toolchain.java.releaseFileSha256);
});

Deno.test("text.gc-document-edit fixture, source tree, and artifacts match manifests", async () => {
  const fixtureBytes = await Deno.readFile(new URL("fixture.v1.txt", artifact));
  assertEquals(await sha256Hex(fixtureBytes), fixtureManifest.fixture.sha256);
  assertEquals(
    fixtureManifest.frozenCatalog.sha256,
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  assert(/^[a-f0-9]{40}$/u.test(buildManifest.sourceCommit));
  await gitBytes("cat-file", "-e", `${buildManifest.sourceCommit}^{commit}`);
  for (const entry of buildManifest.sources) {
    const bytes = await Deno.readFile(new URL(entry.path, root));
    assert(bytes.length === entry.bytes, entry.path);
    assert((await sha256Hex(bytes)) === entry.sha256, entry.path);
    const committedBytes = await gitBytes("show", `${buildManifest.sourceCommit}:${entry.path}`);
    assertEquals(committedBytes, bytes);
    const blobOid = new TextDecoder().decode(
      await gitBytes("rev-parse", `${buildManifest.sourceCommit}:${entry.path}`),
    ).trim();
    assertEquals(blobOid, entry.gitBlobOid);
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
  const fixtureSchema = JSON.parse(
    await Deno.readTextFile(
      new URL("schemas/text-gc-document-edit-fixture-manifest.schema.json", root),
    ),
  );
  const referenceSchema = JSON.parse(
    await Deno.readTextFile(new URL("schemas/text-gc-document-edit-reference.schema.json", root)),
  );
  const buildSchema = JSON.parse(
    await Deno.readTextFile(
      new URL("schemas/text-gc-document-edit-build-manifest.schema.json", root),
    ),
  );
  const validateStatus = ajv.compile(statusSchema);
  const validateRecord = ajv.compile(recordSchema);
  const validateFixture = ajv.compile(fixtureSchema);
  const validateReference = ajv.compile(referenceSchema);
  const validateBuild = ajv.compile(buildSchema);
  const status = JSON.parse(
    await Deno.readTextFile(new URL("catalog/v1-base-implementation-status.v1.json", root)),
  );
  assert(validateStatus(status), JSON.stringify(validateStatus.errors));
  assert(validateFixture(fixtureManifest), JSON.stringify(validateFixture.errors));
  assert(validateReference(reference), JSON.stringify(validateReference.errors));
  assert(validateBuild(buildManifest), JSON.stringify(validateBuild.errors));
  const records = [];
  for (const variant of ["js-controlled", "wasmgc-controlled"]) {
    const record = JSON.parse(
      await Deno.readTextFile(
        new URL(`public/evidence/v1-base/text-gc-document-edit/${variant}.json`, root),
      ),
    );
    records.push(record);
    assert(validateRecord(record), `${variant}: ${JSON.stringify(validateRecord.errors)}`);
  }

  const contradictoryJs = structuredClone(records[0]);
  contradictoryJs.target = "wasmgc";
  contradictoryJs.counters["boundary-crossings"] = 2;
  contradictoryJs.wasmGcFeatureProof = records[1].wasmGcFeatureProof;
  assert(!validateRecord(contradictoryJs), "contradictory JS record must fail");
  const contradictoryWasm = structuredClone(records[1]);
  contradictoryWasm.target = "javascript";
  contradictoryWasm.counters["boundary-crossings"] = 0;
  contradictoryWasm.wasmGcFeatureProof = null;
  assert(!validateRecord(contradictoryWasm), "contradictory WasmGC record must fail");
  const openStatus = structuredClone(status);
  openStatus.entries[0].fixedWork.bogus = true;
  assert(!validateStatus(openStatus), "open fixedWork must fail");
  const emptyFixture = structuredClone(status);
  emptyFixture.entries[0].fixture = {};
  assert(!validateStatus(emptyFixture), "empty fixture must fail");
  const openFixtureManifest = structuredClone(fixtureManifest);
  openFixtureManifest.fixture.unregistered = true;
  assert(!validateFixture(openFixtureManifest), "open fixture manifest must fail");
  const openReference = structuredClone(reference);
  openReference.unregistered = true;
  assert(!validateReference(openReference), "open reference must fail");
  const invalidBuild = structuredClone(buildManifest);
  invalidBuild.sourceCommit = "candidate prose";
  assert(!validateBuild(invalidBuild), "non-OID build source must fail");
  for (let index = 0; index < buildManifest.sources.length; index++) {
    const omission = structuredClone(buildManifest);
    omission.sources.splice(index, 1);
    assert(!validateBuild(omission), `source omission ${index} must fail`);

    const duplicate = structuredClone(buildManifest);
    const replacementIndex = (index + 1) % buildManifest.sources.length;
    duplicate.sources[replacementIndex] = {
      ...structuredClone(buildManifest.sources[index]),
      bytes: buildManifest.sources[index].bytes + 1,
      sha256: "0".repeat(64),
      gitBlobOid: "0".repeat(40),
    };
    assert(
      !validateBuild(duplicate),
      `source duplicate with differing metadata ${index} must fail`,
    );

    const addition = structuredClone(buildManifest);
    addition.sources.push(structuredClone(buildManifest.sources[index]));
    assert(!validateBuild(addition), `source addition ${index} must fail`);
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

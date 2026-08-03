import Ajv2020Module from "ajv2020";
import sqlite3InitModule from "../public/artifacts/sqlite-notebook/sqlite3-node.mjs";
import {
  assertContract,
  IMPORT_ORDER,
  QUERIES,
} from "../benchmarks/base/sqlite-notebook/contract.js";
import {
  canonicalResults,
  parseCsv,
  runAlaSql,
  runSqlite,
} from "../benchmarks/base/sqlite-notebook/engine.js";
import { assert, assertEquals } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

async function sha256(bytes: Uint8Array) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function loadFixture() {
  const fixture: Record<string, unknown[][]> = {};
  for (const table of IMPORT_ORDER) {
    fixture[table] = parseCsv(
      await Deno.readTextFile(`public/artifacts/sqlite-notebook/fixtures/${table}.csv`),
      table,
    );
  }
  return fixture;
}

async function loadAlaSql() {
  const source = await Deno.readTextFile("public/artifacts/sqlite-notebook/alasql.min.js");
  const alasql = new Function(`${source}\nreturn this.alasql;`).call(globalThis);
  assert(typeof alasql === "function", "vendored AlaSQL must initialize as executable JavaScript");
  return alasql;
}

Deno.test("SQLite notebook preserves frozen catalog bytes and supplies an additive exact contract", async () => {
  const frozen = await Deno.readFile("catalog/workloads.v1.json");
  assertEquals(
    await sha256(frozen),
    "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
  );
  const publicFrozen = await Deno.readFile("public/data/workloads.v1.json");
  assertEquals(await sha256(publicFrozen), await sha256(frozen));
  const catalog = JSON.parse(new TextDecoder().decode(frozen));
  const entry = catalog.entries.find((candidate: { id: string }) =>
    candidate.id === "database.sqlite-notebook.v1"
  );
  assertEquals(entry.status, "proposed");
  assertEquals(
    entry.fixedWork.description,
    "Fresh database, frozen SQL/schema/PRAGMAs and eight ordered queries.",
  );
  assertContract();
  assertEquals(QUERIES.length, 8);
  assert(QUERIES.some((query) => query.features.includes("two-joins")));
  assertEquals(
    QUERIES.filter((query) => query.features.some((feature) => feature.startsWith("window-")))
      .length,
    2,
  );
});

Deno.test("SQLite notebook fixture manifest freezes exact project-owned rows and hashes", async () => {
  const manifest = JSON.parse(
    await Deno.readTextFile("public/artifacts/sqlite-notebook/fixtures/fixture-manifest.json"),
  );
  assertEquals(manifest.rights, {
    licenseSpdx: "CC0-1.0",
    provenance: "project-generated",
    redistribution: "permitted",
    notice: "fixtures/RIGHTS.md",
  });
  assertEquals(manifest.importOrder, ["customers", "products", "sales"]);
  assertEquals(manifest.files["customers.csv"].rows, 64);
  assertEquals(manifest.files["products.csv"].rows, 32);
  assertEquals(manifest.files["sales.csv"].rows, 4096);
  for (
    const [name, record] of Object.entries(manifest.files) as [
      string,
      { bytes: number; sha256: string },
    ][]
  ) {
    const bytes = await Deno.readFile(`public/artifacts/sqlite-notebook/fixtures/${name}`);
    assertEquals(bytes.byteLength, record.bytes);
    assertEquals(await sha256(bytes), record.sha256);
  }
  const rights = await Deno.readTextFile("public/artifacts/sqlite-notebook/fixtures/RIGHTS.md");
  assert(rights.includes("do not contain TPC data"));
});

Deno.test({
  name:
    "pure JavaScript SQL and material SQLite Wasm execute all eight queries and equal the independent reference",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const fixture = await loadFixture();
    const alasql = await loadAlaSql();
    const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });
    const [javascript, wasm] = await Promise.all([
      runAlaSql(alasql, fixture),
      runSqlite(sqlite3, fixture),
    ]);
    const reference = JSON.parse(
      await Deno.readTextFile("public/artifacts/sqlite-notebook/reference.json"),
    );
    const expected = await canonicalResults(reference.results);
    assertEquals(javascript.canonical, expected.canonical);
    assertEquals(wasm.canonical, expected.canonical);
    assertEquals(
      javascript.sha256,
      "fae41d80865456365118c98ee8dd74a502fb359ace69878190edca22e4f6572d",
    );
    assertEquals(wasm.sha256, javascript.sha256);
    assertEquals(javascript.results.reduce((sum, query) => sum + query.rows.length, 0), 744);
    assertEquals(javascript.counters, {
      imports: 3,
      "imported-rows": 4192,
      queries: 8,
      scans: 14,
      joins: 6,
      groups: 6,
      windows: 2,
      sorts: 8,
      allocations: 11,
      "boundary-crossings": 0,
    });
    assertEquals(wasm.counters, { ...javascript.counters, "boundary-crossings": 2 });

    const q5 = javascript.results.find((query) =>
      query.id === "q5-customer-purchase-sequence"
    )!.rows;
    const customers = new Map<number, number>();
    for (const row of q5) {
      const expectedNumber = (customers.get(row.customer_id) ?? 0) + 1;
      assertEquals(row.purchase_number, expectedNumber);
      customers.set(row.customer_id, expectedNumber);
    }
    const q6 = javascript.results.find((query) => query.id === "q6-product-partition-total")!.rows;
    const totals = new Map<number, number>();
    for (const row of q6) {
      totals.set(
        row.product_id,
        (totals.get(row.product_id) ?? 0) + row.quantity,
      );
    }
    for (const row of q6) assertEquals(row.product_units, totals.get(row.product_id));
    const q7 = javascript.results.find((query) => query.id === "q7-null-coupon-groups")!.rows;
    assertEquals(q7[0].coupon_code, null);
    for (const query of javascript.results) {
      for (const row of query.rows) {
        for (const value of Object.values(row)) {
          assert(value === null || typeof value === "string" || Number.isSafeInteger(value));
        }
      }
    }
  },
});

Deno.test("independent oracle rejects changed fixture semantics", async () => {
  const fixture = await loadFixture();
  fixture.sales[0] = [...fixture.sales[0]];
  fixture.sales[0][5] = Number(fixture.sales[0][5]) + 1;
  const changed = await runAlaSql(await loadAlaSql(), fixture);
  assert(changed.sha256 !== "fae41d80865456365118c98ee8dd74a502fb359ace69878190edca22e4f6572d");
});

Deno.test("SQLite notebook runtime manifest hashes every served dependency before use", async () => {
  const bytes = await Deno.readFile("public/artifacts/sqlite-notebook/runtime-manifest.json");
  const hash = await sha256(bytes);
  const worker = await Deno.readTextFile("public/sqlite-notebook-worker.js");
  assert(worker.includes(`const RUNTIME_MANIFEST_SHA256 = "${hash}"`));
  const manifest = JSON.parse(new TextDecoder().decode(bytes));
  assertEquals(manifest.files.length, 13);
  for (const entry of manifest.files) {
    const disk = await Deno.readFile(entry.source);
    assertEquals(disk.byteLength, entry.bytes);
    assertEquals(await sha256(disk), entry.sha256);
  }
  assert(worker.includes("output.canonical !== expected.canonical"));
  assert(worker.includes("Complete SQL output mismatch"));
});

Deno.test("SQLite notebook evidence records are closed, source-pinned static packages", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-sqlite-notebook-record.schema.json"),
  );
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  for (const variant of ["javascript-controlled", "linear-wasm-controlled"]) {
    const record = JSON.parse(
      await Deno.readTextFile(
        `public/evidence/base-implementations/sqlite-notebook/${variant}.json`,
      ),
    );
    assert(validate(record), JSON.stringify(validate.errors));
    assertEquals(record.performanceResult, null);
    assertEquals(record.browserEvidence, "not-collected");
    assertEquals(
      record.completeOutputSha256,
      "fae41d80865456365118c98ee8dd74a502fb359ace69878190edca22e4f6572d",
    );
  }
  const build = JSON.parse(
    await Deno.readTextFile("public/artifacts/sqlite-notebook/build-manifest.json"),
  );
  assert(/^[a-f0-9]{40}$/.test(build.sourceCommit));
  assertEquals(build.oracle.queryCount, 8);
  assertEquals(build.oracle.resultRows, 744);
  assertEquals(
    build.productConfiguration.equivalence,
    "semantic-product-choice; plans and product internals are not aggregated",
  );
});

Deno.test("SQLite notebook route is closed, accessible, cancellable, and non-persistent", async () => {
  const page = await Deno.readTextFile("public/benchmarks/database-sqlite-notebook-v1/index.html");
  const runner = await Deno.readTextFile("public/sqlite-notebook-runner.js");
  const worker = await Deno.readTextFile("public/sqlite-notebook-worker.js");
  const server = await Deno.readTextFile("server.ts");
  assert(page.includes("All eight ordered queries"));
  assert(page.includes('role="status"'));
  assert(page.includes('aria-live="polite"'));
  assert(page.includes('aria-label="Notebook validation progress"'));
  assert(runner.includes("new Worker"));
  assert(runner.includes("worker?.terminate()"));
  assert(runner.includes('self.addEventListener("pagehide", cleanup)'));
  assert(runner.includes("runToken !== token"));
  assert(runner.includes("TIMEOUT_MS = 120_000"));
  for (
    const forbidden of [
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "sendBeacon",
      "XMLHttpRequest",
      "WebSocket",
      'method: "POST"',
    ]
  ) {
    assert(!runner.includes(forbidden) && !worker.includes(forbidden), forbidden);
  }
  for (
    const route of [
      "/benchmarks/database-sqlite-notebook-v1/",
      "/sqlite-notebook-runner.js",
      "/sqlite-notebook-worker.js",
      "/assets/sqlite-notebook/sqlite3.wasm",
      "/assets/sqlite-notebook/fixtures/sales.csv",
    ]
  ) assert(server.includes(`"${route}"`), route);
});

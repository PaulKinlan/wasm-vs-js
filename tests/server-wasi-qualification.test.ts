import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals } from "./assert.ts";
import { sha256Hex } from "../lib/canonical.ts";
import {
  INDEPENDENT_JAVASCRIPT_SQLITE_CANDIDATES,
  probeIndependentJavaScriptSqliteCandidates,
  verifyRecordedQualification,
} from "../scripts/qualify-server-wasi.ts";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const addFormats = (addFormatsModule as unknown as { default?: typeof addFormatsModule }).default ??
  addFormatsModule;
const contractPath = "benchmarks/base/server-wasi-request-handler/implementation-contract.v1.json";
const schemaPath = "schemas/server-wasi-qualification.schema.json";
const frozenHash = "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4";
const contract = JSON.parse(await Deno.readTextFile(contractPath));
const schema = JSON.parse(await Deno.readTextFile(schemaPath));

function validateContract(): void {
  const ajv = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ allErrors: true, strict: false });
  (addFormats as unknown as (ajv: unknown) => void)(ajv);
  const validate = ajv.compile(schema);
  assert(validate(contract), JSON.stringify(validate.errors, null, 2));
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isFile;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

Deno.test("server WASI blocked qualification validates against its closed schema", () => {
  validateContract();
  assertEquals(contract.status, "blocked-before-implementation");
  assertEquals(contract.coverage.counted, false);
  assertEquals(contract.coverage.implementedCatalogEntriesDelta, 0);
  assertEquals(contract.fixedWork.requests, 10_000);
  assertEquals(contract.fixedWork.concurrencyCells, [1, 32]);
});

Deno.test("server WASI qualification preserves the frozen catalog and exact base contract", async () => {
  const catalogBytes = await Deno.readFile("catalog/workloads.v1.json");
  const publicBytes = await Deno.readFile("public/data/workloads.v1.json");
  assertEquals(await sha256Hex(catalogBytes), frozenHash);
  assertEquals(await sha256Hex(publicBytes), frozenHash);
  assertEquals(catalogBytes, publicBytes);

  const catalog = JSON.parse(new TextDecoder().decode(catalogBytes));
  const entry = catalog.entries.find((candidate: { id: string }) =>
    candidate.id === "server.wasi-request-handler.v1"
  );
  assert(entry);
  assertEquals(
    entry.fixedWork.description,
    "10,000 frozen requests at concurrency 1 and 32 in separate cells.",
  );
  assertEquals(entry.oracle.algorithmFamily, "wasi-handler-fixed-request-trace");
  assertEquals(entry.status, "proposed");
});

Deno.test("server WASI qualification records every semantic and counter requirement", () => {
  assert(contract.requiredTargets.javascript.includes("SQLite execution"));
  assert(contract.requiredTargets.javascript.includes("native SQLite"));
  assert(contract.requiredTargets.wasiLinearWasm.includes("material WASI module"));
  assertEquals(contract.requiredOracle, {
    completeResponseBytes: true,
    checkpoints: true,
    finalDatabaseState: true,
    tamperRejection: true,
    concurrencyDeterminism: true,
  });
  assertEquals(contract.requiredCounters, [
    "requests",
    "json-bytes",
    "json-tokens",
    "hmac-bytes",
    "hmac-compressions",
    "sql-statements",
    "rows-read",
    "rows-written",
    "rendered-bytes",
    "wasi-calls",
    "boundary-crossings",
    "allocations",
  ]);
});

Deno.test("server WASI machine qualification reproduces the recorded blockers", async () => {
  const observed = await verifyRecordedQualification();
  assertEquals(observed.deno, "2.9.0");
  assertEquals(observed.hostSqliteCliObserved, "3.53.3");
  assertEquals(observed.wasiSdkClangAtOptPathAvailable, false);
  assertEquals(observed.wasiSysrootAtUsrSharePathAvailable, false);
  assertEquals(observed.rustWasip1StandardLibraryAvailable, false);
  assertEquals(observed.repositoryPinnedSqliteSourceAvailable, false);
  assertEquals(observed.repositoryPinnedSqliteWasiArtifactAvailable, false);
  assertEquals(
    observed.independentJavaScriptSqliteCandidates,
    contract.qualification.independentJavaScriptSqliteAudit.inspectedCandidates,
  );
  assertEquals(observed.independentJavaScriptSqliteAvailable, false);
  assertEquals(
    INDEPENDENT_JAVASCRIPT_SQLITE_CANDIDATES,
    contract.qualification.independentJavaScriptSqliteAudit.inspectedCandidates.map(
      ({ id, path }: { id: string; path: string }) => ({ id, path }),
    ),
  );
});

Deno.test("server WASI JavaScript SQLite candidate probe fails the blocked record closed", async () => {
  const directory = await Deno.makeTempDir();
  const presentPath = `${directory}/sqlite.ts`;
  const missingPath = `${directory}/sqlite.js`;
  try {
    await Deno.writeTextFile(presentPath, "export {};\n");
    const candidates = await probeIndependentJavaScriptSqliteCandidates([
      { id: "missing", path: missingPath },
      { id: "present", path: presentPath },
    ]);
    assertEquals(candidates, [
      { id: "missing", path: missingPath, available: false },
      { id: "present", path: presentPath, available: true },
    ]);
    assert(
      candidates.some((candidate) => candidate.available),
      "a present candidate must force requalification instead of preserving the blocked record",
    );
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("server WASI blocked package exposes no fake implementation or artifact", async () => {
  for (
    const path of [
      "benchmarks/base/server-wasi-request-handler/javascript.ts",
      "benchmarks/base/server-wasi-request-handler/server-wasi.wat",
      "benchmarks/base/server-wasi-request-handler/server-wasi.c",
      "public/artifacts/server-wasi-request-handler/server-wasi.wasm",
      "public/benchmarks/server-wasi-request-handler-v1/index.html",
    ]
  ) {
    assert(!(await exists(path)), `${path} must remain unavailable while blocked`);
  }
});

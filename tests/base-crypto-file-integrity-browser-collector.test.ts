import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import {
  assertBrowserCase,
  assertCleanStatus,
  assertFetchedAssets,
  expectedCaseContracts,
  expectedCounters,
  expectedMemoryPages,
  FETCHED_ASSETS,
} from "../scripts/collect-base-crypto-file-integrity-browser-evidence.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const addFormats = ((addFormatsModule as unknown as {
  default?: (instance: unknown) => void;
}).default ?? addFormatsModule) as unknown as (instance: unknown) => void;
const registration = JSON.parse(
  await Deno.readTextFile("registrations/base/crypto.file-integrity.v1.json"),
);
const schema = JSON.parse(
  await Deno.readTextFile("schemas/base-crypto-file-integrity-browser-evidence.schema.json"),
);
function validatorFor(property: string) {
  const ajv = new (Ajv2020 as unknown as new (
    options: Record<string, unknown>,
  ) => { compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown } })({
    allErrors: true,
    strict: true,
  });
  addFormats(ajv);
  return ajv.compile({
    $schema: schema.$schema,
    $defs: schema.$defs,
    ...schema.properties[property],
  });
}

Deno.test("crypto Chrome collector freezes the exact 36-case output, counters, and memory contract", async () => {
  const cases = expectedCaseContracts(registration);
  assertEquals(cases.length, 36);
  assertEquals(new Set(cases.map((entry) => entry.id)).size, 36);
  assertEquals(
    cases.filter((entry) => entry.target === "js-controlled").length,
    18,
  );
  assertEquals(
    cases.filter((entry) => entry.target === "wasm-linear-controlled").length,
    18,
  );
  for (const entry of cases) {
    assertEquals(entry.output.digestSha256, entry.expectedDigestSha256);
    assertEquals(
      entry.output.counters,
      expectedCounters(entry.byteLength, entry.schedule, entry.target),
    );
    assertEquals(
      entry.wasmMemoryPages,
      expectedMemoryPages(entry.byteLength, entry.schedule, entry.target),
    );
    assertBrowserCase(entry, entry);
  }
  const full = cases.filter((entry) =>
    entry.target === "wasm-linear-controlled" && entry.byteLength === 268_435_456 &&
    entry.schedule === "whole-buffer"
  );
  assertEquals(full.length, 2);
  assert(full.every((entry) => entry.wasmMemoryPages === 4098));
  assertEquals(full[0].output.counters, {
    "input-bytes": 268_435_456,
    "scheduled-chunks": 1,
    "sha256-compression-blocks": 4_194_305,
    "copied-bytes": 268_435_456,
    "boundary-crossings": 3,
    "engine-buffer-allocations": 0,
  });

  const wrongDigest = structuredClone(cases[0]);
  wrongDigest.output.digestSha256 = "0".repeat(64);
  await assertRejects(
    () => Promise.resolve(assertBrowserCase(wrongDigest, cases[0])),
    "browser case mismatch",
  );
  const wrongPages = structuredClone(full[0]);
  wrongPages.wasmMemoryPages = 4099;
  await assertRejects(
    () => Promise.resolve(assertBrowserCase(wrongPages, full[0])),
    "browser case mismatch",
  );
});

Deno.test("browser evidence schema closes every case and lifecycle control without retaining authored evidence", () => {
  const validateCases = validatorFor("cases");
  const cases = expectedCaseContracts(registration);
  assert(validateCases(cases), JSON.stringify(validateCases.errors));

  const duplicateCombination = structuredClone(cases);
  duplicateCombination[35] = structuredClone(duplicateCombination[0]);
  duplicateCombination[35].id = "different-id-does-not-change-the-Cartesian-case";
  assert(!validateCases(duplicateCombination), "schema accepted a duplicate Cartesian case");
  const missing = structuredClone(cases);
  missing.pop();
  assert(!validateCases(missing), "schema accepted 35/36 cases");
  const extraProperty = structuredClone(cases);
  (extraProperty[0] as Record<string, unknown>).timingMs = 0;
  assert(!validateCases(extraProperty), "schema accepted an unregistered timing field");
  const impossiblePages = structuredClone(cases);
  impossiblePages.find((entry) => entry.wasmMemoryPages === 4098)!.wasmMemoryPages = 4099;
  assert(!validateCases(impossiblePages), "schema accepted 4,099 Wasm pages");

  const lifecycle = [
    "wrong-token",
    "stale-error",
    "restart",
    "cancel",
    "timeout",
    "pagehide",
  ].map((id) => ({
    id,
    instrumentation: "collector-controlled Worker test double; not correctness evidence",
    assertions: ["visible control exercised", "owned worker terminated"],
    stateBeforeCleanup: {
      status: "observed browser state",
      output: "observed browser output",
      startDisabled: false,
      cancelDisabled: true,
    },
    stateAfterCleanup: {
      status: "observed browser cleanup state",
      output: "observed browser output",
      startDisabled: false,
      cancelDisabled: true,
    },
    workers: [{
      url: "/crypto-file-integrity-worker.js",
      type: "module",
      token: 1,
      terminated: true,
    }],
    passed: true,
  }));
  const validateLifecycle = validatorFor("lifecycle");
  assert(validateLifecycle(lifecycle), JSON.stringify(validateLifecycle.errors));
  lifecycle[5].id = "cancel";
  assert(!validateLifecycle(lifecycle), "schema accepted missing pagehide and duplicate cancel");
});

Deno.test("collector binds clean source, exact fetched bytes, Chrome identity, loopback, and owned cleanup", async () => {
  assertCleanStatus("");
  await assertRejects(
    () => Promise.resolve(assertCleanStatus("?? evidence.json\0")),
    "exact clean HEAD",
  );
  assertEquals(Object.keys(FETCHED_ASSETS).length, 10);
  assertEquals(
    FETCHED_ASSETS["/demos/crypto.file-integrity.v1/"],
    "public/demos/crypto.file-integrity.v1/index.html",
  );
  assertEquals(
    FETCHED_ASSETS["/artifacts/crypto-file-integrity/crypto-file-integrity.wasm"],
    "public/artifacts/crypto-file-integrity/crypto-file-integrity.wasm",
  );
  const expected = await Promise.all(
    Object.entries(FETCHED_ASSETS).map(async ([route, path]) => {
      const bytes = await Deno.readFile(path);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      return {
        route,
        bytes: bytes.byteLength,
        sha256: Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join(""),
      };
    }),
  );
  const observations = expected.map((entry) => ({
    ...entry,
    observedResponses: [{ requestId: "unit-contract-only" }],
  }));
  assertFetchedAssets(observations, expected);
  const missing = structuredClone(observations);
  missing[0].observedResponses = [];
  await assertRejects(
    () => Promise.resolve(assertFetchedAssets(missing, expected)),
    "fetched asset mismatch",
  );

  const collector = await Deno.readTextFile(
    "scripts/collect-base-crypto-file-integrity-browser-evidence.ts",
  );
  for (
    const required of [
      'git", ["rev-parse", "HEAD"]',
      'git", ["rev-parse", "HEAD^{tree}"]',
      "assertCleanStatus(new TextDecoder().decode(status.stdout))",
      "Chrome hash mismatch",
      "Browser.getVersion",
      "Browser.getBrowserCommandLine",
      "127.0.0.1",
      "remote-debugging-address=127.0.0.1",
      "wasm-crypto-file-integrity-chrome-",
      "Network.getResponseBody",
      "Accessibility.getFullAXTree",
      "Page.captureScreenshot",
      "wrong-token",
      "stale-error",
      "restart",
      "cancel",
      "timeout",
      "pagehide",
      "wasmMemoryPages !== 4098",
      "Browser.close",
      "identityStillRunning",
      "owned Chrome processes survived cleanup",
      "owned Chrome profile survived cleanup",
      "owned loopback server survived cleanup",
    ]
  ) assert(collector.includes(required), `collector contract missing: ${required}`);
  assert(!collector.includes("puppeteer"));
  assert(!collector.includes("playwright"));
  assert(!collector.includes("evidence = JSON.parse"));
});

Deno.test("browser evidence schema is closed at every declared object boundary", () => {
  const ajv = new (Ajv2020 as unknown as new (
    options: Record<string, unknown>,
  ) => { compile: (schema: unknown) => unknown })({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.compile(schema);
  const seen = new Set<unknown>();
  function visit(value: unknown, path: string): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    const record = value as Record<string, unknown>;
    if (record.type === "object") {
      if (!path.endsWith("/contains")) {
        assert(record.additionalProperties === false, `${path} is not closed`);
      }
      assert(Array.isArray(record.required), `${path} omits required fields`);
    }
    for (const [key, child] of Object.entries(record)) visit(child, `${path}/${key}`);
  }
  visit(schema, "schema");
  assertEquals(schema.properties.cases.minItems, 36);
  assertEquals(schema.properties.cases.maxItems, 36);
  assertEquals(schema.properties.cases.allOf.length, 36);
  assertEquals(schema.properties.lifecycle.minItems, 6);
  assertEquals(schema.properties.lifecycle.maxItems, 6);
  assertEquals(schema.properties.lifecycle.allOf.length, 6);
  assertEquals(schema.properties.fetchedAssets.minItems, 10);
  assertEquals(schema.properties.fetchedAssets.maxItems, 10);
});

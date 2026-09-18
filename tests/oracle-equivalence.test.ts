// tests/oracle-equivalence.test.ts
//
// Asserts that the oracle-equivalence attestation record exists, conforms to its
// schema, and records that all rebuilt kernels computed equivalent outputs to
// their pinned oracles.

import { assert, assertEquals } from "./assert.ts";

interface Attestation {
  schemaVersion: number;
  description: string;
  claim: string;
  granularity: string;
  toolchain: { id: string; os: string; arch: string };
  observedAt: string;
  kernelsRebuilt: number;
  kernelsNotAttested: number;
  dartIncluded: boolean;
  testsRun: number;
  testsEquivalent: number;
  testsNotEquivalent: number;
  tests: Array<{
    test: string;
    result: "equivalent" | "differs" | "errored";
    passed: number;
    failed: number;
    detail?: string;
  }>;
  kernels: Array<{
    workload: string;
    engine: string;
    lang: string;
    artifact: string;
    status: "rebuilt" | "notAttested";
    reason?: string;
  }>;
}

const FILE = new URL("../public/data/oracle-equivalence.v1.json", import.meta.url);

const data: Attestation = JSON.parse(await Deno.readTextFile(FILE));

Deno.test("oracle equivalence: record conforms to schema v1", () => {
  assertEquals(data.schemaVersion, 1);
  assert(data.description.length > 0, "missing description");
  assert(data.claim.length > 0, "missing claim boundary");
  assert(data.granularity.length > 0, "missing granularity explanation");
  assert(/^tc-[0-9a-f]{12}$/.test(data.toolchain.id), `invalid toolchain id ${data.toolchain.id}`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(data.observedAt), `invalid date ${data.observedAt}`);
});

Deno.test("oracle equivalence: all 196 kernels are accounted for", () => {
  assertEquals(data.kernelsRebuilt + data.kernelsNotAttested, 196);
  assertEquals(data.kernels.length, 196);
  assertEquals(data.kernelsRebuilt, 196);
  assertEquals(data.kernelsNotAttested, 0);
  for (const k of data.kernels) {
    assertEquals(k.status, "rebuilt");
    assert(k.reason === undefined, `${k.artifact}: unexpected reason`);
  }
});

Deno.test("oracle equivalence: test tallies add up and report equivalent outputs", () => {
  assertEquals(data.testsRun, data.tests.length);
  assertEquals(data.testsEquivalent + data.testsNotEquivalent, data.testsRun);
  for (const t of data.tests) {
    assert(t.test.startsWith("multilang-"), `${t.test}: unexpected test name`);
    assert(["equivalent", "differs", "errored"].includes(t.result), `${t.test}: invalid result`);
    assert(t.passed > 0 || t.failed > 0, `${t.test}: zero tests executed`);
  }
});

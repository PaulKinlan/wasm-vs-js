import { assertEquals, assertRejects } from "./assert.ts";
import { assertCorpusSchema, assertLaunchEvidenceSchema } from "../lib/corpus-contracts.ts";

const evidence = (value: unknown) => ({
  status: "supported-value",
  value,
  source: "fixture",
  scope: "fixture",
  collectedAt: "2026-08-02T00:00:00Z",
});

Deno.test("launch evidence schema accepts a complete closed fixture and rejects undeclared data", async () => {
  const fixture = {
    schemaVersion: 1,
    launchId: "launch-fixture",
    blockId: "cold-01",
    sourceCommit: "a".repeat(40),
    browser: { version: evidence("150") },
    profile: { rootSha256: "b".repeat(64), fresh: true, removed: true },
    host: { os: evidence("linux") },
    page: { assertion: evidence(true) },
    network: { attestationSha256: "c".repeat(64), stratum: "cold" },
    artifacts: { workerResultJson: "d".repeat(64) },
    cleanup: { complete: true, ownedPids: [100], remainingPids: [], profileRemoved: true },
  };
  assertLaunchEvidenceSchema(fixture);
  await assertRejects(
    () => Promise.resolve().then(() => assertLaunchEvidenceSchema({ ...fixture, invented: true })),
    "schema invalid",
  );
});

Deno.test("corpus schema accepts typed per-stratum accounting and rejects omitted medians", () => {
  const fixture = {
    schemaVersion: 1,
    corpusId: "corpus-fixture",
    experimentId: "m1-chrome-sum-u32-v1",
    permitDigest: "a".repeat(64),
    sourceManifestSha256: "b".repeat(64),
    preregistrationSha256: "d13aed9404ec289046f885f79a1d7b9f04923d2264de22b1fee60a4e7a8d6f61",
    planned: 120,
    attempted: 1,
    committed: 1,
    failed: 0,
    blocked: 0,
    unstarted: 119,
    blocks: [{
      blockId: "cold-01",
      scheduleIndex: 0,
      stratum: "cold",
      order: ["js-controlled", "wasm-linear-controlled"],
      status: "committed",
      category: "committed",
      reason: null,
      jsMedianMs: 10,
      wasmMedianMs: 5,
      sha256: "c".repeat(64),
    }],
    strata: {
      cold: { attempted: 1, committed: 1, failed: 0, blocked: 0, terminal: "continue" },
      warm: { attempted: 0, committed: 0, failed: 0, blocked: 0, terminal: "continue" },
    },
    stop: null,
    status: "containment-blocked",
  };
  assertCorpusSchema(fixture);
  const broken = structuredClone(fixture) as Record<string, unknown>;
  delete (broken.blocks as Array<Record<string, unknown>>)[0].jsMedianMs;
  let rejected = false;
  try {
    assertCorpusSchema(broken);
  } catch {
    rejected = true;
  }
  assertEquals(rejected, true);
});

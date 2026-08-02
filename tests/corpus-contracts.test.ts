import { assertEquals, assertRejects } from "./assert.ts";
import {
  assertAttemptRecordSchema,
  assertChromePackageManifestSchema,
  assertCollectionStopSchema,
  assertCorpusSchema,
  assertLaunchEvidenceSchema,
  assertPermitReceiptSchema,
  assertSourceManifestSchema,
} from "../lib/corpus-contracts.ts";

Deno.test("permit receipt and Chrome package manifests are closed", async () => {
  assertPermitReceiptSchema({
    permitId: "permit-1234",
    digest: "a".repeat(64),
    consumedAt: new Date().toISOString(),
    operation: "pilot-m1-corpus",
  });
  assertChromePackageManifestSchema({
    schemaVersion: 1,
    binaryRelativePath: "chrome",
    binarySha256: "b".repeat(64),
    manifestSha256: "c".repeat(64),
    files: { chrome: "b".repeat(64) },
  });
  await assertRejects(
    () => Promise.resolve().then(() => assertPermitReceiptSchema({ invented: true })),
    "schema invalid",
  );
});

Deno.test("source, attempt, and stop artifacts are closed and pair hashes are mandatory", async () => {
  assertSourceManifestSchema({
    sourceCommit: "a".repeat(40),
    files: { "server.ts": "b".repeat(64) },
    sha256: "c".repeat(64),
  });
  assertCollectionStopSchema({
    scheduleIndex: 0,
    blockId: "cold-01",
    attempted: true,
    category: "blocked-containment",
    reason: "cleanup failed",
  });
  const committed = {
    blockId: "cold-01",
    scheduleIndex: 0,
    stratum: "cold",
    order: ["js-controlled", "wasm-linear-controlled"],
    status: "committed",
    category: "committed",
    reason: null,
    jsMedianMs: 10,
    wasmMedianMs: 8,
    pairSha256: "d".repeat(64),
  };
  assertAttemptRecordSchema(committed);
  const missingPair = structuredClone(committed) as Record<string, unknown>;
  delete missingPair.pairSha256;
  await assertRejects(
    () => Promise.resolve().then(() => assertAttemptRecordSchema(missingPair)),
    "schema invalid",
  );
});

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
    chromePackageManifestSha256: "c".repeat(64),
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

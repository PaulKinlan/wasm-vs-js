import { assertEquals, assertRejects } from "./assert.ts";
import {
  assertAttemptRecordSchema,
  assertBenchmarkSchema,
  assertBuildManifestSchema,
  assertChromePackageManifestSchema,
  assertCollectionStopSchema,
  assertCollectorHealthSchema,
  assertCorpusSchema,
  assertLaunchEvidenceSchema,
  assertLaunchManifestSchema,
  assertPermitReceiptSchema,
  assertPrelaunchFailureSchema,
  assertPreregistrationSchema,
  assertSourceManifestSchema,
  assertStageOwnerSchema,
} from "../lib/corpus-contracts.ts";

Deno.test("permit receipt and Chrome package manifests are closed", async () => {
  assertPermitReceiptSchema({
    permitId: "permit-1234",
    digest: "a".repeat(64),
    consumedAt: new Date().toISOString(),
    operation: "pilot-m1-corpus",
  });
  const legacyManifest = {
    schemaVersion: 1,
    binaryRelativePath: "chrome",
    binarySha256: "b".repeat(64),
    manifestSha256: "c".repeat(64),
    files: { chrome: "b".repeat(64) },
  };
  assertChromePackageManifestSchema(legacyManifest);
  assertChromePackageManifestSchema({
    ...legacyManifest,
    schemaVersion: 2,
    sourceFileModes: { chrome: 493 },
    stagedFileModes: { chrome: 320 },
    sourceDirectoryModes: { ".": 448, helpers: 493 },
    stagedDirectoryModes: { ".": 320, helpers: 320 },
  });
  await assertRejects(
    () =>
      Promise.resolve().then(() =>
        assertChromePackageManifestSchema({
          ...legacyManifest,
          sourceFileModes: { chrome: 493 },
        })
      ),
    "schema invalid",
  );
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
    prelaunchFailures: [],
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

Deno.test("collection preflight manifests and lifecycle artifacts use closed schemas", async () => {
  const benchmark = JSON.parse(await Deno.readTextFile("benchmarks/sum-u32/benchmark.json"));
  const build = JSON.parse(
    await Deno.readTextFile("public/artifacts/sum-u32/build-manifest.json"),
  );
  const preregistration = JSON.parse(
    await Deno.readTextFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
  );
  assertBenchmarkSchema(benchmark);
  assertBuildManifestSchema(build);
  assertPreregistrationSchema(preregistration);
  const launch = {
    experimentId: "m1-chrome-sum-u32-v1",
    corpusId: "m1-permit-test",
    blockId: preregistration.pairing.schedule[0].blockId,
    scheduleIndex: 0,
    stratum: preregistration.pairing.schedule[0].stratum,
    order: preregistration.pairing.schedule[0].order,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  assertLaunchManifestSchema(launch);
  const prelaunch = {
    blockId: launch.blockId,
    scheduleIndex: 0,
    stratum: launch.stratum,
    order: launch.order,
    attempted: false,
    category: "blocked-provenance",
    reason: "fixture",
    cleanupLifecycle: "verified-no-owned-launch",
  };
  assertPrelaunchFailureSchema(prelaunch);
  const stageOwner = {
    schemaVersion: 1,
    stageId: "permit-test",
    permitId: "permit-test",
    sourceCommit: "a".repeat(40),
    root: "/tmp/wasm-vs-js-staged-chrome/permit-test",
    stageParentDev: 1,
    stageParentIno: 2,
    rootDev: 1,
    rootIno: 3,
    cleanupLifecycle: "ready-no-owned-launch",
    package: {
      schemaVersion: 2,
      binaryRelativePath: "chrome",
      binarySha256: "b".repeat(64),
      manifestSha256: "c".repeat(64),
      files: { chrome: "b".repeat(64) },
      sourceFileModes: { chrome: 493 },
      stagedFileModes: { chrome: 320 },
      sourceDirectoryModes: { ".": 448 },
      stagedDirectoryModes: { ".": 320 },
    },
  };
  assertStageOwnerSchema(stageOwner);
  const collectorAssets = Object.fromEntries([
    "/corpus-run",
    "/corpus-run.js",
    "/styles.css",
    "/hosted-runner-core.js",
    "/hosted-runner-worker.js",
    "/benchmarks/sum-u32/workload.js",
    "/artifacts/sum-u32/build-manifest.json",
    "/artifacts/sum-u32/sum-u32.wasm",
  ].map((route) => [route, "a".repeat(64)]));
  assertCollectorHealthSchema({
    status: "ok",
    mode: "local-m1-pilot",
    schemaVersion: 1,
    acceptedImplementationCommit: "a".repeat(40),
    localCheckoutCommit: "b".repeat(40),
    collectorAssets,
  });
  for (const value of [benchmark, build, launch]) {
    await assertRejects(
      () =>
        Promise.resolve().then(() => {
          const open = structuredClone(value) as Record<string, unknown>;
          open.invented = true;
          if (value === benchmark) assertBenchmarkSchema(open);
          else if (value === build) assertBuildManifestSchema(open);
          else assertLaunchManifestSchema(open);
        }),
      "schema invalid",
    );
  }
  for (
    const [value, validate] of [
      [prelaunch, assertPrelaunchFailureSchema],
      [stageOwner, assertStageOwnerSchema],
    ] as const
  ) {
    await assertRejects(
      () => Promise.resolve().then(() => validate({ ...value, invented: true })),
      "schema invalid",
    );
  }
  const inlineCorpus = {
    schemaVersion: 1,
    corpusId: "corpus-prelaunch",
    experimentId: "m1-chrome-sum-u32-v1",
    permitDigest: "a".repeat(64),
    sourceManifestSha256: "b".repeat(64),
    chromePackageManifestSha256: "c".repeat(64),
    preregistrationSha256: "d13aed9404ec289046f885f79a1d7b9f04923d2264de22b1fee60a4e7a8d6f61",
    planned: 120,
    attempted: 0,
    committed: 0,
    failed: 0,
    blocked: 0,
    unstarted: 120,
    blocks: [],
    prelaunchFailures: [{ ...prelaunch, artifactSha256: "d".repeat(64), invented: true }],
    strata: {
      cold: { attempted: 0, committed: 0, failed: 0, blocked: 0, terminal: "continue" },
      warm: { attempted: 0, committed: 0, failed: 0, blocked: 0, terminal: "continue" },
    },
    stop: {
      scheduleIndex: 0,
      blockId: launch.blockId,
      category: "blocked-containment",
      reason: "fixture",
      artifactSha256: "e".repeat(64),
    },
    status: "containment-blocked",
  };
  await assertRejects(
    () => Promise.resolve().then(() => assertCorpusSchema(inlineCorpus)),
    "schema invalid",
  );
});

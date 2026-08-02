import { assertEquals, assertRejects } from "./assert.ts";
import { classifyAttemptError, validateWorkerResult } from "../scripts/run-m1-chrome-corpus.ts";
import { LaunchManifest } from "../lib/corpus-store.ts";
const manifest: LaunchManifest = {
  experimentId: "m1-chrome-sum-u32-v1",
  corpusId: "corpus-1",
  blockId: "block-1",
  scheduleIndex: 0,
  stratum: "cold",
  order: ["js-controlled", "wasm-linear-controlled"],
  expiresAt: "2026-08-03T00:00:00Z",
};
const variant = (value: number) => ({
  count: 20,
  medianMs: value,
  p95Ms: value,
  firstScoredMs: value,
  samples: Array(20).fill(value),
});
const workerEnvelope = () => ({
  manifest,
  result: {
    order: "js-first",
    iterations: 20,
    batchSize: 1,
    correctness: {
      passed: true,
      oracle: 145417951,
      jsFirstOutput: 145417951,
      wasmFirstOutput: 145417951,
      everyScoredInvocationValidated: true,
      expectedBatchDigest: 1,
      scoredInvocationsPerVariant: 20,
    },
    identities: {
      inputSha256: "4f0516549fc9d6952c8d42d642927dd5c43a8c01d03c286e0c80da919bfaf9d7",
      manifestSha256: "38136e96462c5b98e3057e4ea18ae339150918aa50f1270eb3db88586185cf98",
      javascriptSha256: "4d8379672c1b51b0b315d2bee119880694e5a4f6412ef59b7fe2593ef6b179b7",
      wasmSha256: "9c4ce5f0d9e32cdd364b73b2697566e7396368d9867d9bc3d939bb2063583a6d",
    },
    work: {
      items: 65536,
      inputBytes: 262144,
      additions: 65536,
      loads: 65536,
      boundaryCrossings: 1,
    },
    lifecycle: {
      manifestTransferMs: 1,
      jsTransferMs: 1,
      wasmTransferMs: 1,
      wasmCompileMs: 1,
      wasmInstantiateMs: 1,
      jsFirstExecuteMs: 1,
      wasmFirstExecuteMs: 1,
    },
    wasmLinearMemory: { value: { beforeScoredBytes: 1, afterScoredBytes: 1 } },
    js: variant(10),
    wasm: variant(5),
  },
});
Deno.test("worker evidence gate requires exact manifest, correctness, fixed work, lifecycle, and complete samples", async () => {
  const valid = validateWorkerResult(workerEnvelope(), manifest);
  assertEquals(valid.records.map((r) => r.medianMs), [10, 5]);
  const wrongWork = workerEnvelope();
  wrongWork.result.work.items = 1;
  await assertRejects(async () => validateWorkerResult(wrongWork, manifest), "fixed work");
  const wrongSample = workerEnvelope();
  wrongSample.result.js.samples[0] = -1;
  await assertRejects(async () => validateWorkerResult(wrongSample, manifest), "trajectory");
  await assertRejects(
    async () =>
      validateWorkerResult(
        { ...workerEnvelope(), manifest: { ...manifest, blockId: "other" } },
        manifest,
      ),
    "manifest identity",
  );
});
Deno.test("attempt failures are typed and only containment failures stop the schedule", () => {
  assertEquals(
    classifyAttemptError(new Error("correctness oracle mismatch")).category,
    "failed-correctness",
  );
  assertEquals(
    classifyAttemptError(new Error("warm cache contradiction")).category,
    "blocked-cache",
  );
  assertEquals(
    classifyAttemptError(new Error("source identity mismatch")).category,
    "blocked-provenance",
  );
  const containment = classifyAttemptError(new Error("owned Chrome cleanup failed"));
  assertEquals([containment.category, containment.stop], ["blocked-containment", true]);
  assertEquals(classifyAttemptError(new Error("timer failure")).stop, false);
});
Deno.test("headline collector statically excludes heavy diagnostics and retains prime/full-result/source artifacts", async () => {
  const source = await Deno.readTextFile("scripts/run-m1-chrome-corpus.ts");
  for (
    const forbidden of [
      "Performance.enable",
      "Performance.getMetrics",
      "Runtime.getHeapUsage",
      "Memory.getDOMCounters",
      "collectProcessMemory",
      "SystemInfo.getProcessInfo",
    ]
  ) {
    assertEquals(source.includes(forbidden), false);
  }
  for (
    const required of [
      "network-prime.json",
      "worker-result.json",
      "source-manifest.json",
      "assertPermitActive",
      "sourceManifest(permit.sourceCommit)",
    ]
  ) {
    assertEquals(source.includes(required), true);
  }
});

import { assertEquals, assertRejects } from "./assert.ts";
import { classifyAttemptError, validateWorkerResult } from "../scripts/run-m1-chrome-corpus.ts";
import { LaunchManifest } from "../lib/corpus-store.ts";
import { expectedBatchDigest } from "../public/hosted-runner-core.js";
const buildManifest = JSON.parse(
  await Deno.readTextFile("public/artifacts/sum-u32/build-manifest.json"),
);
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
    capturedAt: new Date().toISOString(),
    order: "js-first",
    iterations: 20,
    cache:
      "No Service Worker controlled this page. Exact controlled cache state is attested externally.",
    resourceTiming: [
      "/artifacts/sum-u32/build-manifest.json",
      "/benchmarks/sum-u32/workload.js",
      "/artifacts/sum-u32/sum-u32.wasm",
    ].map((route) => ({ route, status: "not-observed", reason: "fixture" })),
    batchSize: 1,
    correctness: {
      passed: true,
      oracle: 145417951,
      jsFirstOutput: 145417951,
      wasmFirstOutput: 145417951,
      everyScoredInvocationValidated: true,
      expectedBatchDigest: expectedBatchDigest(1),
      scoredInvocationsPerVariant: 20,
    },
    identities: {
      inputSha256: "4f0516549fc9d6952c8d42d642927dd5c43a8c01d03c286e0c80da919bfaf9d7",
      manifestSha256: "9e49ef5203dc41c3ed92118a40fe350966851bd309f1cd7c5b571477bb43ecfa",
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
    manifest: structuredClone(buildManifest),
    jsSha256: "4d8379672c1b51b0b315d2bee119880694e5a4f6412ef59b7fe2593ef6b179b7",
    wasmSha256: "9c4ce5f0d9e32cdd364b73b2697566e7396368d9867d9bc3d939bb2063583a6d",
    lifecycle: {
      manifestTransferMs: 1,
      manifestBytes: 1,
      manifestDecodeParseMs: 1,
      jsTransferMs: 1,
      jsBytes: 1,
      jsHashVerifyMs: 1,
      jsVerifiedModuleImportMs: 1,
      jsModuleParseMs: { status: "unavailable", reason: "not isolated" },
      jsModuleEvaluationMs: { status: "unavailable", reason: "not isolated" },
      wasmTransferMs: 1,
      wasmBytes: 1,
      wasmHashVerifyMs: 1,
      wasmCompileMs: 1,
      wasmInstantiateMs: 1,
      inputGenerateMs: 1,
      inputCopyMs: 1,
      jsFirstExecuteMs: 1,
      wasmFirstExecuteMs: 1,
    },
    wasmLinearMemory: {
      status: "supported-value",
      scope: "webassembly-linear-memory-buffer-length",
      caveat: "JavaScript-visible buffer length, not committed or resident physical memory.",
      value: { beforeScoredBytes: 65536, afterScoredBytes: 65536 },
    },
    js: variant(10),
    wasm: variant(5),
  },
});
Deno.test("worker evidence gate requires exact manifest, correctness, fixed work, lifecycle, and complete samples", async () => {
  const valid = validateWorkerResult(workerEnvelope(), manifest);
  assertEquals(valid.records.map((r) => r.medianMs), [10, 5]);
  const wrongWork = workerEnvelope();
  wrongWork.result.work.items = 1;
  await assertRejects(
    () => Promise.resolve().then(() => validateWorkerResult(wrongWork, manifest)),
    "fixed work",
  );
  const wrongSample = workerEnvelope();
  wrongSample.result.js.samples[0] = -1;
  await assertRejects(
    () => Promise.resolve().then(() => validateWorkerResult(wrongSample, manifest)),
    "trajectory",
  );
  const changedManifest = workerEnvelope();
  changedManifest.result.manifest.build.command = "unreviewed build";
  await assertRejects(
    () => Promise.resolve().then(() => validateWorkerResult(changedManifest, manifest)),
    "build manifest",
  );
  const openResource = workerEnvelope();
  (openResource.result.resourceTiming[0] as Record<string, unknown>).invented = true;
  await assertRejects(
    () => Promise.resolve().then(() => validateWorkerResult(openResource, manifest)),
    "resource evidence shape",
  );
  await assertRejects(
    () =>
      Promise.resolve().then(() =>
        validateWorkerResult(
          { ...workerEnvelope(), manifest: { ...manifest, blockId: "other" } },
          manifest,
        )
      ),
    "manifest identity",
  );
});
Deno.test("local worker remains attached until response bodies are captured and explicitly released", async () => {
  const page = await Deno.readTextFile("local/corpus-run.js");
  const worker = await Deno.readTextFile("public/hosted-runner-worker.js");
  const collector = await Deno.readTextFile("scripts/run-m1-chrome-corpus.ts");
  assertEquals(page.includes("__releaseCorpusWorker"), true);
  assertEquals(page.includes("finally {\n    worker.terminate()"), false);
  assertEquals(worker.includes("globalThis.close()"), false);
  assertEquals(
    collector.indexOf("networkRecords(\n      events") <
      collector.indexOf("__releaseCorpusWorker()"),
    true,
  );
  assertEquals(collector.includes("drainSessionSetups"), true);
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
  const sourceIdentity = classifyAttemptError(new Error("source identity mismatch"));
  assertEquals([sourceIdentity.category, sourceIdentity.stop], ["blocked-provenance", true]);
  const originEscape = classifyAttemptError(new Error("unexpected origin or method"));
  assertEquals([originEscape.category, originEscape.stop], ["blocked-provenance", true]);
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
      "network-prime-attestation.json",
      "network-prime-events.json",
      "worker-result.json",
      "source-manifest.json",
      "assertPermitActive",
      "dependencies.sourceManifest ?? sourceManifest",
    ]
  ) {
    assertEquals(source.includes(required), true);
  }
});

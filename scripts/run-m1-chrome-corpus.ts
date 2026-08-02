import { assertPermitActive, consumePermit, validatePermit } from "../lib/browser-permit.ts";
import { collectHostProvenance } from "../lib/host-provenance.ts";
import { closeOwnedChrome, launchOwnedChrome } from "../lib/owned-chrome.ts";
import {
  inspectChromePackage,
  removeStagedChrome,
  stageChromePackage,
  StagedChrome,
  verifyStagedChrome,
} from "../lib/chrome-stage.ts";
import { refreshLedger } from "../lib/process-ledger.ts";
import { commitPairedBlock, LaunchManifest, writeImmutableArtifact } from "../lib/corpus-store.ts";
import { attestNetwork, NetworkRecord } from "../lib/chrome-evidence.ts";
import { collectChromeProvenance } from "../lib/chrome-provenance.ts";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { evaluateAttemptCheckpoint } from "../lib/paired-statistics.ts";
import {
  assertAttemptRecordSchema,
  assertChromePackageManifestSchema,
  assertCollectionStopSchema,
  assertCorpusSchema,
  assertLaunchEvidenceSchema,
  assertSourceManifestSchema,
} from "../lib/corpus-contracts.ts";
import { expectedBatchDigest } from "../public/hosted-runner-core.js";
import frozenBuildManifest from "../public/artifacts/sum-u32/build-manifest.json" with {
  type: "json",
};
import {
  AttemptRecord,
  median,
  validateCorpusSemantics,
  validateLaunchEvidenceSemantics,
} from "../lib/corpus-validation.ts";
import {
  COLLECTOR_ROUTES,
  collectorRouteHashes,
  FROZEN_PREREGISTRATION_SHA256,
  sourceManifest,
} from "../lib/source-identity.ts";

const args = new Set(Deno.args);
const permitPath = Deno.args.find((x) => x.startsWith("--permit="))?.slice(9);
const manifestPath = Deno.args.find((x) => x.startsWith("--manifest="))?.slice(11);
const sourceCommit = Deno.env.get("WASM_VS_JS_COMMIT") ?? "";
const BENCHMARK_ASSETS = [
  "/artifacts/sum-u32/build-manifest.json",
  "/benchmarks/sum-u32/workload.js",
  "/artifacts/sum-u32/sum-u32.wasm",
] as const;
const COLLECTOR_GET_ROUTES = Object.keys(COLLECTOR_ROUTES).sort();

async function preflight(requireClean = true) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("exact source commit required");
  const manifest = requireClean ? await sourceManifest(sourceCommit) : null;
  const prereg = JSON.parse(
    await Deno.readTextFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
  );
  if (prereg.experimentId !== "m1-chrome-sum-u32-v1" || prereg.pairing?.schedule?.length !== 120) {
    throw new Error("preregistration denied");
  }
  for (
    const path of [
      "attempt-record.schema.json",
      "browser-permit.schema.json",
      "chrome-package-manifest.schema.json",
      "collection-stop.schema.json",
      "corpus.schema.json",
      "launch-evidence.schema.json",
      "paired-block.schema.json",
      "network-attestation.schema.json",
      "permit-receipt.schema.json",
      "source-manifest.schema.json",
    ]
  ) await Deno.stat(`schemas/${path}`);
  return {
    sourceCommit,
    experimentId: prereg.experimentId,
    plannedLaunches: prereg.pairing.schedule.length,
    hostFields: Object.keys(await collectHostProvenance()).length,
    sourceManifestSha256: manifest?.sha256 ?? "dry-fake",
    sourceFiles: manifest?.files ?? {},
  };
}
export { closeOwnedChrome };
export async function launchReviewedChrome(
  permit: ReturnType<typeof validatePermit>,
  stage: StagedChrome,
  suffix: string,
  onSpawn?: (pid: number) => void,
) {
  await verifyStagedChrome(stage);
  return await launchOwnedChrome({
    stagedChrome: stage,
    profileRoot: `${permit.profileRoot}/${suffix}`,
    extraArguments: [],
    beforeSpawn: () => assertPermitActive(permit),
    onSpawn,
  });
}
function nestedValue(result: Record<string, unknown>): unknown {
  return (result.result as Record<string, unknown>)?.value;
}
async function waitForEvent(
  client: {
    on: (
      method: string,
      listener: (params: Record<string, unknown>, sessionId?: string) => void,
    ) => () => void;
  },
  method: string,
  sessionId: string,
  timeoutMs = 10_000,
): Promise<Record<string, unknown>> {
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`${method} timeout`));
    }, timeoutMs);
    const off = client.on(method, (params, sid) => {
      if (sid !== sessionId) return;
      clearTimeout(timer);
      off();
      resolve(params);
    });
  });
}
async function verifyOrigin(
  permit: ReturnType<typeof validatePermit>,
  expectedHashes: Record<string, string>,
) {
  const response = await fetch(`${permit.origin}/healthz`, {
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok || new URL(response.url).origin !== permit.origin) {
    throw new Error("local origin health denied");
  }
  const health = await response.json();
  if (
    health.status !== "ok" || health.mode !== "local-m1-pilot" ||
    health.localCheckoutCommit !== permit.sourceCommit ||
    JSON.stringify(health.collectorAssets) !== JSON.stringify(expectedHashes)
  ) throw new Error("local origin source identity mismatch");
}
export function classifyAttemptError(
  error: unknown,
): { status: "failed" | "blocked"; category: string; stop: boolean; reason: string } {
  const reason = error instanceof Error ? error.message : String(error),
    lower = reason.toLowerCase();
  if (
    /cleanup|containment|profile|pid|process|listener|socket|executable|chrome root|permit expired/
      .test(lower)
  ) return { status: "blocked", category: "blocked-containment", stop: true, reason };
  if (/correct|oracle|digest|work|output/.test(lower)) {
    return { status: "failed", category: "failed-correctness", stop: false, reason };
  }
  if (/cache/.test(lower)) {
    return { status: "blocked", category: "blocked-cache", stop: false, reason };
  }
  if (
    /unexpected origin|unexpected request|origin health|source identity|source manifest/.test(lower)
  ) {
    return { status: "blocked", category: "blocked-provenance", stop: true, reason };
  }
  if (/identity|source|provenance|origin|network|hash|unexpected|storage|version/.test(lower)) {
    return { status: "blocked", category: "blocked-provenance", stop: false, reason };
  }
  return { status: "failed", category: "failed-measurement", stop: false, reason };
}
function assertClosed(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} object invalid`);
  }
  const object = value as Record<string, unknown>;
  if (JSON.stringify(Object.keys(object).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(`${label} shape invalid`);
  }
  return object;
}
function finiteNonnegative(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} invalid`);
  return number;
}
function type7(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b), position = (sorted.length - 1) * p;
  const lo = Math.floor(position), hi = Math.ceil(position);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (position - lo);
}
export function validateWorkerResult(
  value: Record<string, unknown>,
  expectedManifest: LaunchManifest,
) {
  assertClosed(value, ["manifest", "result"], "worker envelope");
  const result = assertClosed(value.result, [
    "capturedAt",
    "order",
    "iterations",
    "cache",
    "resourceTiming",
    "batchSize",
    "work",
    "correctness",
    "identities",
    "manifest",
    "jsSha256",
    "wasmSha256",
    "wasmLinearMemory",
    "lifecycle",
    "js",
    "wasm",
  ], "worker result");
  if (JSON.stringify(value.manifest) !== JSON.stringify(expectedManifest)) {
    throw new Error("worker result manifest identity mismatch");
  }
  const capturedAt = Date.parse(String(result.capturedAt));
  if (!Number.isFinite(capturedAt) || capturedAt > Date.now() + 1_000) {
    throw new Error("worker capturedAt invalid");
  }
  const expectedOrder = expectedManifest.order[0] === "js-controlled" ? "js-first" : "wasm-first";
  if (result.order !== expectedOrder || result.iterations !== 20) {
    throw new Error("worker execution identity mismatch");
  }
  if (typeof result.cache !== "string" || !result.cache.includes("No Service Worker controlled")) {
    throw new Error("worker cache evidence invalid");
  }
  const correctness = assertClosed(result.correctness, [
      "passed",
      "oracle",
      "jsFirstOutput",
      "wasmFirstOutput",
      "everyScoredInvocationValidated",
      "expectedBatchDigest",
      "scoredInvocationsPerVariant",
    ], "correctness"),
    identities = assertClosed(result.identities, [
      "inputSha256",
      "manifestSha256",
      "javascriptSha256",
      "wasmSha256",
    ], "identities"),
    work = assertClosed(result.work, [
      "items",
      "inputBytes",
      "additions",
      "loads",
      "boundaryCrossings",
    ], "work");
  if (
    correctness.passed !== true || correctness.oracle !== 145417951 ||
    correctness.jsFirstOutput !== 145417951 || correctness.wasmFirstOutput !== 145417951 ||
    correctness.everyScoredInvocationValidated !== true
  ) throw new Error("correctness evidence invalid");
  const expectedIdentities = {
    inputSha256: "4f0516549fc9d6952c8d42d642927dd5c43a8c01d03c286e0c80da919bfaf9d7",
    manifestSha256: "38136e96462c5b98e3057e4ea18ae339150918aa50f1270eb3db88586185cf98",
    javascriptSha256: "4d8379672c1b51b0b315d2bee119880694e5a4f6412ef59b7fe2593ef6b179b7",
    wasmSha256: "9c4ce5f0d9e32cdd364b73b2697566e7396368d9867d9bc3d939bb2063583a6d",
  };
  if (
    JSON.stringify(identities) !== JSON.stringify(expectedIdentities) ||
    result.jsSha256 !== expectedIdentities.javascriptSha256 ||
    result.wasmSha256 !== expectedIdentities.wasmSha256
  ) {
    throw new Error("worker artifact identity mismatch");
  }
  const buildManifest = result.manifest as Record<string, unknown>;
  if (JSON.stringify(buildManifest) !== JSON.stringify(frozenBuildManifest)) {
    throw new Error("worker build manifest invalid");
  }
  const batchSize = Number(result.batchSize);
  const exactWork = {
    items: 65_536 * batchSize,
    inputBytes: 262_144 * batchSize,
    additions: 65_536 * batchSize,
    loads: 65_536 * batchSize,
    boundaryCrossings: batchSize,
  };
  if (
    !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 4096 ||
    JSON.stringify(work) !== JSON.stringify(exactWork) ||
    correctness.expectedBatchDigest !== expectedBatchDigest(batchSize) ||
    correctness.scoredInvocationsPerVariant !== batchSize * 20
  ) throw new Error("fixed work evidence invalid");

  const lifecycle = assertClosed(result.lifecycle, [
    "manifestTransferMs",
    "manifestBytes",
    "manifestDecodeParseMs",
    "jsTransferMs",
    "jsBytes",
    "jsHashVerifyMs",
    "jsVerifiedModuleImportMs",
    "jsModuleParseMs",
    "jsModuleEvaluationMs",
    "wasmTransferMs",
    "wasmBytes",
    "wasmHashVerifyMs",
    "wasmCompileMs",
    "wasmInstantiateMs",
    "inputGenerateMs",
    "inputCopyMs",
    "jsFirstExecuteMs",
    "wasmFirstExecuteMs",
  ], "lifecycle");
  for (const key of Object.keys(lifecycle).filter((key) => !key.startsWith("jsModule"))) {
    finiteNonnegative(lifecycle[key], `lifecycle ${key}`);
  }
  for (const key of ["jsModuleParseMs", "jsModuleEvaluationMs"]) {
    const unavailable = assertClosed(lifecycle[key], ["status", "reason"], key);
    if (
      unavailable.status !== "unavailable" || typeof unavailable.reason !== "string" ||
      !unavailable.reason
    ) {
      throw new Error(`${key} availability invalid`);
    }
  }
  const memory = assertClosed(
    result.wasmLinearMemory,
    ["status", "scope", "caveat", "value"],
    "Wasm memory",
  );
  const memoryValue = assertClosed(
    memory.value,
    ["beforeScoredBytes", "afterScoredBytes"],
    "Wasm memory value",
  );
  if (
    memory.status !== "supported-value" ||
    memory.scope !== "webassembly-linear-memory-buffer-length" ||
    typeof memory.caveat !== "string" || !memory.caveat.includes("not committed or resident") ||
    !Number.isSafeInteger(memoryValue.beforeScoredBytes) ||
    Number(memoryValue.beforeScoredBytes) <= 0 ||
    !Number.isSafeInteger(memoryValue.afterScoredBytes) || Number(memoryValue.afterScoredBytes) <= 0
  ) {
    throw new Error("Wasm memory evidence invalid");
  }
  const resourceTiming = result.resourceTiming;
  if (!Array.isArray(resourceTiming) || resourceTiming.length !== BENCHMARK_ASSETS.length) {
    throw new Error("resource evidence denominator invalid");
  }
  const routes = new Set<string>();
  for (const item of resourceTiming) {
    const evidence = item as Record<string, unknown>;
    if (
      typeof evidence.route !== "string" ||
      !BENCHMARK_ASSETS.includes(evidence.route as typeof BENCHMARK_ASSETS[number])
    ) throw new Error("resource evidence route invalid");
    routes.add(evidence.route);
    if (evidence.status === "supported-value") {
      assertClosed(evidence, ["route", "status", "scope", "value", "caveat"], "resource evidence");
      const timing = assertClosed(evidence.value, [
        "initiatorType",
        "startTime",
        "duration",
        "fetchStart",
        "requestStart",
        "responseStart",
        "responseEnd",
        "nextHopProtocol",
        "deliveryType",
        "responseStatus",
        "transferSize",
        "encodedBodySize",
        "decodedBodySize",
      ], "resource timing value");
      for (
        const key of [
          "startTime",
          "duration",
          "fetchStart",
          "requestStart",
          "responseStart",
          "responseEnd",
          "transferSize",
          "encodedBodySize",
          "decodedBodySize",
        ]
      ) {
        finiteNonnegative(timing[key], `resource ${key}`);
      }
      if (
        typeof timing.initiatorType !== "string" || typeof timing.nextHopProtocol !== "string" ||
        !(timing.deliveryType === null || typeof timing.deliveryType === "string") ||
        !(timing.responseStatus === null || Number.isFinite(timing.responseStatus)) ||
        evidence.scope !== "same-origin-resource-timing" || typeof evidence.caveat !== "string"
      ) {
        throw new Error("resource evidence scope invalid");
      }
    } else {
      assertClosed(evidence, ["route", "status", "reason"], "unavailable resource evidence");
      if (
        evidence.status !== "not-observed" || typeof evidence.reason !== "string" ||
        !evidence.reason
      ) {
        throw new Error("resource evidence availability invalid");
      }
    }
  }
  if (routes.size !== BENCHMARK_ASSETS.length) throw new Error("duplicate resource evidence");

  const records = [];
  for (const [key, id] of [["js", "js-controlled"], ["wasm", "wasm-linear-controlled"]] as const) {
    const variant = assertClosed(result[key], [
        "count",
        "medianMs",
        "p95Ms",
        "firstScoredMs",
        "samples",
      ], `${key} trajectory`),
      samples = variant.samples as number[];
    if (
      !Array.isArray(samples) || samples.length !== 20 || variant.count !== 20 ||
      samples.some((v) => !Number.isFinite(v) || v <= 0) ||
      variant.medianMs !== median(samples) || variant.p95Ms !== type7(samples, .95) ||
      variant.firstScoredMs !== samples[0]
    ) {
      throw new Error("complete scored trajectory invalid");
    }
    records.push({ variantId: id, payloadSha256: "", medianMs: Number(variant.medianMs), samples });
  }
  return { result, records };
}

export function assertContainedRequests(
  events: Array<Record<string, unknown>>,
  origin: string,
): void {
  for (const event of events.filter((entry) => entry.type === "request")) {
    const request = event.request as Record<string, unknown>,
      url = new URL(String(request?.url ?? ""));
    if (url.origin !== origin || request?.method !== "GET") {
      throw new Error("unexpected origin or method");
    }
    if (![...COLLECTOR_GET_ROUTES, "/api/corpus/manifest"].includes(url.pathname)) {
      throw new Error(`unexpected request: ${url.pathname}`);
    }
  }
}

function networkRecords(
  events: Array<Record<string, unknown>>,
  expectedPaths: string[],
  browser: {
    send: (
      method: string,
      params?: Record<string, unknown>,
      sid?: string,
    ) => Promise<Record<string, unknown>>;
  },
  sessionId: string,
) {
  return (async () => {
    const requests = new Map<string, { url: string; method: string; cdpSessionId: string }>(),
      responses = new Map<
        string,
        { status: number; fromDiskCache: boolean; fromServiceWorker: boolean }
      >(),
      cached = new Set<string>();
    for (const event of events) {
      const requestId = String(event.requestId ?? ""),
        cdpSessionId = String(event.cdpSessionId ?? sessionId),
        id = `${cdpSessionId}:${requestId}`;
      if (event.type === "request") {
        const request = event.request as Record<string, unknown>;
        requests.set(id, {
          url: String(request?.url ?? ""),
          method: String(request?.method ?? ""),
          cdpSessionId,
        });
      } else if (event.type === "response") {
        const response = event.response as Record<string, unknown>;
        responses.set(id, {
          status: Number(response?.status),
          fromDiskCache: response?.fromDiskCache === true,
          fromServiceWorker: response?.fromServiceWorker === true,
        });
      } else if (event.type === "cache") cached.add(id);
    }
    const records: NetworkRecord[] = [];
    for (const [id, request] of requests) {
      const url = new URL(request.url), path = url.pathname;
      if (!expectedPaths.includes(path)) continue;
      if (records.some((r) => new URL(r.url).pathname === path)) continue;
      const response = responses.get(id);
      if (!response) throw new Error(`asset response missing: ${path}`);
      const bodyResult = await browser.send(
        "Network.getResponseBody",
        { requestId: id.slice(id.indexOf(":") + 1) },
        request.cdpSessionId,
      );
      const text = String(bodyResult.body ?? ""),
        body = bodyResult.base64Encoded === true
          ? Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
          : new TextEncoder().encode(text);
      records.push({
        ...request,
        ...response,
        fromDiskCache: response.fromDiskCache || cached.has(id),
        body,
      });
    }
    return records;
  })();
}
type CollectionDependencies = {
  sourceManifest?: (commit: string) => ReturnType<typeof sourceManifest>;
  verifyOrigin?: typeof verifyOrigin;
  verifyStage?: typeof verifyStagedChrome;
  issueToken?: (
    permit: ReturnType<typeof validatePermit>,
    manifest: LaunchManifest,
  ) => Promise<string>;
  launch?: typeof launchReviewedChrome;
  close?: typeof closeOwnedChrome;
  refreshLedger?: typeof refreshLedger;
  rawBase?: string;
};
export async function collectOwnedBlock(
  permit: ReturnType<typeof validatePermit>,
  manifest: LaunchManifest,
  expectedHashes?: Record<string, string>,
  expectedSourceManifestSha256?: string,
  onLaunchBegan?: (pid: number) => void,
  stagedChrome?: StagedChrome,
  dependencies: CollectionDependencies = {},
): Promise<
  {
    blockSha256: string;
    cleanup: true;
    stratum: "cold" | "warm";
    jsMedianMs: number;
    wasmMedianMs: number;
  }
> {
  assertPermitActive(permit);
  const currentSource = await (dependencies.sourceManifest ?? sourceManifest)(permit.sourceCommit);
  if (expectedSourceManifestSha256 && currentSource.sha256 !== expectedSourceManifestSha256) {
    throw new Error("executed source manifest changed after preflight");
  }
  expectedHashes ??= await collectorRouteHashes();
  await (dependencies.verifyOrigin ?? verifyOrigin)(permit, expectedHashes);
  let token: string;
  if (dependencies.issueToken) token = await dependencies.issueToken(permit, manifest);
  else {
    const issued = await fetch(`${permit.origin}/api/corpus/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(manifest),
      redirect: "error",
    });
    if (issued.status !== 201 || new URL(issued.url).origin !== permit.origin) {
      throw new Error("local corpus launch token issue failed");
    }
    const issuedBody = await issued.json();
    if (typeof issuedBody.token !== "string") throw new Error("local corpus launch token missing");
    token = issuedBody.token;
  }
  assertPermitActive(permit);
  if (!stagedChrome) throw new Error("staged Chrome package required");
  if (
    stagedChrome.binarySha256 !== permit.chromeSha256 ||
    stagedChrome.manifestSha256 !== permit.chromePackageManifestSha256
  ) throw new Error("staged Chrome package not bound by permit");
  await (dependencies.verifyStage ?? verifyStagedChrome)(stagedChrome);
  const owned = await (dependencies.launch ?? launchReviewedChrome)(
    permit,
    stagedChrome,
    `${String(manifest.scheduleIndex).padStart(3, "0")}-${manifest.blockId}`,
    onLaunchBegan,
  );
  let cleanupComplete = false;
  let cleanupAttempted = false;
  try {
    // Cleanup coverage begins immediately after launch, before any evidence path can be authored.
    const corpusRoot = dependencies.rawBase ?? "raw/corpora",
      rawRoot = `${corpusRoot}/${manifest.corpusId}/launches/${manifest.blockId}`,
      events: Array<Record<string, unknown>> = [],
      consoleEvents: Array<Record<string, unknown>> = [];
    const chromePackageManifest = {
      schemaVersion: 1,
      binaryRelativePath: stagedChrome.binary.slice(stagedChrome.root.length + 1),
      binarySha256: stagedChrome.binarySha256,
      manifestSha256: stagedChrome.manifestSha256,
      files: stagedChrome.files,
    };
    assertChromePackageManifestSchema(chromePackageManifest);
    const chromePackageArtifact = await writeImmutableArtifact(
      `${rawRoot}/chrome-package-manifest.json`,
      canonicalize(chromePackageManifest) + "\n",
    );
    if (!String(owned.version.product ?? "").includes("150.0.7871.24")) {
      throw new Error("exact Chrome version mismatch");
    }
    const browser = owned.browser,
      target = await browser.send("Target.createTarget", { url: "about:blank" });
    if (typeof target.targetId !== "string") throw new Error("target creation denied");
    const attached = await browser.send("Target.attachToTarget", {
        targetId: target.targetId,
        flatten: true,
      }),
      sessionId = attached.sessionId;
    if (typeof sessionId !== "string") throw new Error("target attachment denied");
    for (const method of ["Page.enable", "Runtime.enable", "Network.enable", "Log.enable"]) {
      await browser.send(method, {}, sessionId);
    }
    const sessions = new Map<string, { targetId: string; type: string }>([
        [sessionId, { targetId: String(target.targetId), type: "page" }],
      ]),
      sessionSetups: Promise<void>[] = [];
    const drainSessionSetups = async () => {
      let observed = -1;
      while (observed !== sessionSetups.length) {
        observed = sessionSetups.length;
        await Promise.all(sessionSetups.slice(0, observed));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    };
    const offs = [
      browser.on("Target.attachedToTarget", (p) => {
        const childSession = p.sessionId,
          info = p.targetInfo as Record<string, unknown> | undefined;
        const type = String(info?.type ?? ""), targetId = String(info?.targetId ?? "");
        if (
          typeof childSession !== "string" || !targetId ||
          !["worker", "shared_worker"].includes(type)
        ) {
          consoleEvents.push({ containmentError: "unknown auto-attached target", type, targetId });
          return;
        }
        sessions.set(childSession, { targetId, type });
        sessionSetups.push((async () => {
          await browser.send("Network.enable", {}, childSession);
          await browser.send("Runtime.enable", {}, childSession);
          await browser.send("Runtime.runIfWaitingForDebugger", {}, childSession);
        })());
      }),
      browser.on("Network.requestWillBeSent", (p, s) => {
        const target = s ? sessions.get(s) : undefined;
        if (target) {
          events.push({
            type: "request",
            cdpSessionId: s,
            targetId: target.targetId,
            targetType: target.type,
            ...structuredClone(p),
          });
        }
      }),
      browser.on("Network.responseReceived", (p, s) => {
        const target = s ? sessions.get(s) : undefined;
        if (target) {
          events.push({
            type: "response",
            cdpSessionId: s,
            targetId: target.targetId,
            targetType: target.type,
            ...structuredClone(p),
          });
        }
      }),
      browser.on("Network.requestServedFromCache", (p, s) => {
        const target = s ? sessions.get(s) : undefined;
        if (target) {
          events.push({
            type: "cache",
            cdpSessionId: s,
            targetId: target.targetId,
            targetType: target.type,
            ...structuredClone(p),
          });
        }
      }),
      browser.on("Runtime.consoleAPICalled", (p, s) => {
        const target = s ? sessions.get(s) : undefined;
        if (target) {
          consoleEvents.push({
            targetId: target.targetId,
            targetType: target.type,
            ...structuredClone(p),
          });
        }
      }),
    ];
    await browser.send("Target.setAutoAttach", {
      autoAttach: true,
      waitForDebuggerOnStart: true,
      flatten: true,
    }, sessionId);
    const navigate = async (url: string) => {
      const loaded = waitForEvent(browser, "Page.loadEventFired", sessionId);
      await browser.send("Page.navigate", { url }, sessionId);
      await loaded;
    };
    await navigate(`${permit.origin}/healthz`);
    const storage = nestedValue(
      await browser.send("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression:
          `(async()=>({localStorage:localStorage.length,sessionStorage:sessionStorage.length,indexedDB:(await indexedDB.databases()).length,serviceWorkers:(await navigator.serviceWorker.getRegistrations()).length,controlled:Boolean(navigator.serviceWorker.controller)}))()`,
      }, sessionId),
    ) as Record<string, unknown>;
    if (!storage || Object.values(storage).some((v) => v !== 0 && v !== false)) {
      throw new Error("fresh-profile storage contradiction");
    }
    events.length = 0;
    let primeAttestationArtifact: { sha256: string } | undefined;
    let primeEventsArtifact: { sha256: string } | undefined;
    const expectedMeasurement = Object.fromEntries(
      BENCHMARK_ASSETS.map((path) => [path, expectedHashes[path]]),
    );
    if (manifest.stratum === "warm") {
      await browser.send("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression: `Promise.all(${
          JSON.stringify(BENCHMARK_ASSETS)
        }.map(async p=>{const r=await fetch(p,{cache:'reload'});if(!r.ok)throw new Error('prime failed');await r.arrayBuffer();return p}))`,
      }, sessionId);
      await new Promise((r) => setTimeout(r, 100));
      const primeEvents = structuredClone(events);
      assertContainedRequests(primeEvents, permit.origin);
      const primeRecords = await networkRecords(
        primeEvents,
        [...BENCHMARK_ASSETS],
        browser,
        sessionId,
      );
      const prime = await attestNetwork(
        primeRecords,
        "warm",
        permit.origin,
        expectedMeasurement,
        "prime",
      );
      primeAttestationArtifact = await writeImmutableArtifact(
        `${rawRoot}/network-prime-attestation.json`,
        canonicalize(prime) + "\n",
      );
      primeEventsArtifact = await writeImmutableArtifact(
        `${rawRoot}/network-prime-events.json`,
        canonicalize(primeEvents) + "\n",
      );
      events.length = 0;
    }
    const before = await collectChromeProvenance(browser, browser, sessionId);
    const targetUrl = `${permit.origin}/corpus-run?token=${encodeURIComponent(token)}`;
    await navigate(targetUrl);
    const actualUrl = nestedValue(
      await browser.send(
        "Runtime.evaluate",
        { returnByValue: true, expression: "location.href" },
        sessionId,
      ),
    );
    if (actualUrl !== targetUrl) throw new Error("final collector target mismatch");
    await browser.send("Runtime.evaluate", {
      expression: `document.querySelector('#run-corpus').click()`,
    }, sessionId);
    let collected: Record<string, unknown> | undefined;
    const deadline = Date.now() + 120_000;
    let nextLedgerRefresh = Date.now();
    while (Date.now() < deadline) {
      if (Date.now() >= nextLedgerRefresh) {
        owned.ledger = await (dependencies.refreshLedger ?? refreshLedger)(owned.ledger);
        nextLedgerRefresh = Date.now() + 1_000;
      }
      const value = nestedValue(
        await browser.send("Runtime.evaluate", {
          returnByValue: true,
          expression:
            `globalThis.__corpusError?({error:globalThis.__corpusError}):globalThis.__corpusResult`,
        }, sessionId),
      );
      if (value && typeof value === "object") {
        collected = value as Record<string, unknown>;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!collected || "error" in collected) {
      throw new Error(`collector failed: ${String(collected?.error ?? "timeout")}`);
    }
    await drainSessionSetups();
    if (consoleEvents.some((event) => "containmentError" in event)) {
      throw new Error("unknown auto-attached target denied");
    }
    owned.ledger = await (dependencies.refreshLedger ?? refreshLedger)(owned.ledger);
    const validated = validateWorkerResult(collected, manifest),
      after = await collectChromeProvenance(browser, browser, sessionId);
    assertContainedRequests(events, permit.origin);
    const measurementRecords = await networkRecords(
      events,
      [...BENCHMARK_ASSETS],
      browser,
      sessionId,
    );
    const measurement = await attestNetwork(
      measurementRecords,
      manifest.stratum,
      permit.origin,
      expectedMeasurement,
      "measurement",
    );
    // Bodies must have been collected while a worker target was still observable.
    const targetsBeforeRelease = (await browser.send("Target.getTargets")).targetInfos;
    if (
      !Array.isArray(targetsBeforeRelease) ||
      !targetsBeforeRelease.some((target) =>
        ["worker", "shared_worker"].includes(String((target as Record<string, unknown>).type)) &&
        String((target as Record<string, unknown>).url).startsWith(permit.origin)
      )
    ) throw new Error("collector worker target detached before evidence capture");
    await browser.send("Runtime.evaluate", {
      returnByValue: true,
      expression: "globalThis.__releaseCorpusWorker()",
    }, sessionId);
    await new Promise((resolve) => setTimeout(resolve, 25));
    await drainSessionSetups();
    const liveTargets = (await browser.send("Target.getTargets")).targetInfos;
    if (
      Array.isArray(liveTargets) &&
      liveTargets.some((target) =>
        ["worker", "shared_worker"].includes(String((target as Record<string, unknown>).type)) &&
        String((target as Record<string, unknown>).url).startsWith(permit.origin)
      )
    ) throw new Error("collector worker target did not detach after evidence capture");
    const screenshot = await browser.send("Page.captureScreenshot", { format: "png" }, sessionId);
    offs.forEach((off) => off());
    const workerArtifact = await writeImmutableArtifact(
      `${rawRoot}/worker-result.json`,
      canonicalize(collected) + "\n",
    );
    const networkAttestationArtifact = await writeImmutableArtifact(
      `${rawRoot}/network-measurement-attestation.json`,
      canonicalize(measurement) + "\n",
    );
    const networkEventsArtifact = await writeImmutableArtifact(
      `${rawRoot}/network-measurement-events.json`,
      canonicalize(events) + "\n",
    );
    const consoleArtifact = await writeImmutableArtifact(
      `${rawRoot}/console.json`,
      canonicalize(consoleEvents) + "\n",
    );
    const screenshotArtifact = await writeImmutableArtifact(
      `${rawRoot}/page.png`,
      Uint8Array.from(atob(String(screenshot.data ?? "")), (c) => c.charCodeAt(0)),
    );
    const records = await Promise.all(
      validated.records.map(async (record) => ({
        ...record,
        payloadSha256: await sha256Hex(
          canonicalize(validated.result[record.variantId === "js-controlled" ? "js" : "wasm"]),
        ),
      })),
    );
    cleanupAttempted = true;
    const closed = await (dependencies.close ?? closeOwnedChrome)(owned);
    cleanupComplete = closed.cleaned;
    const typed = (value: unknown, source: string, scope: string) => ({
      status: "supported-value",
      value,
      source,
      scope,
      collectedAt: new Date().toISOString(),
    });
    const launchEvidence = {
      schemaVersion: 1,
      launchId: crypto.randomUUID(),
      blockId: manifest.blockId,
      sourceCommit: permit.sourceCommit,
      browser: {
        ...before,
        ...Object.fromEntries(
          Object.entries(after).map(([k, v]) => [`after${k[0].toUpperCase()}${k.slice(1)}`, v]),
        ),
      },
      profile: {
        rootSha256: await sha256Hex(owned.ledger.profileRoot),
        fresh: true,
        removed: true,
      },
      host: await collectHostProvenance(),
      page: {
        ownership: typed(
          {
            unit: owned.ledger.unit,
            controlGroup: owned.ledger.controlGroup,
            cgroupDev: owned.ledger.cgroupDev,
            cgroupIno: owned.ledger.cgroupIno,
            invocationId: owned.ledger.invocationId,
            chromePackageManifestSha256: stagedChrome.manifestSha256,
            mainPid: owned.ledger.mainPid,
            members: owned.ledger.members,
            membershipSnapshots: owned.ledger.membershipSnapshots,
            executable: owned.ledger.executable,
            argv: owned.ledger.commandLine,
            launchedAt: owned.ledger.launchedAt,
            recordedAt: owned.ledger.recordedAt,
            stoppedAt: closed.stoppedAt,
          },
          "systemd-user-cgroup",
          "exact-owned-chrome-service",
        ),
        collector: typed({ route: "/corpus-run", tokenBound: true }, "orchestrator", "collector"),
        interaction: typed(
          { kind: "visible-button-click", selector: "#run-corpus" },
          "cdp-target",
          "collector-control",
        ),
        assertions: typed(
          {
            resultPresent: true,
            completeWorkerResultSha256: workerArtifact.sha256,
            correctnessPassed: true,
            fixedWorkPresent: true,
          },
          "orchestrator",
          "post-run-assertions",
        ),
      },
      network: {
        attestationSha256: networkAttestationArtifact.sha256,
        stratum: manifest.stratum,
      },
      artifacts: {
        networkMeasurementAttestationJson: networkAttestationArtifact.sha256,
        networkMeasurementEventsJson: networkEventsArtifact.sha256,
        ...(primeAttestationArtifact
          ? { networkPrimeAttestationJson: primeAttestationArtifact.sha256 }
          : {}),
        ...(primeEventsArtifact ? { networkPrimeEventsJson: primeEventsArtifact.sha256 } : {}),
        chromePackageManifestJson: chromePackageArtifact.sha256,
        consoleJson: consoleArtifact.sha256,
        screenshotPng: screenshotArtifact.sha256,
        workerResultJson: workerArtifact.sha256,
      },
      cleanup: {
        complete: true,
        ownedPids: owned.ledger.members,
        remainingPids: [],
        profileRemoved: true,
      },
    };
    assertLaunchEvidenceSchema(launchEvidence);
    validateLaunchEvidenceSemantics(launchEvidence);
    const launchArtifact = await writeImmutableArtifact(
      `${rawRoot}/launch-evidence.json`,
      canonicalize(launchEvidence) + "\n",
    );
    const ordered = manifest.order.map((id) => records.find((r) => r.variantId === id)!);
    const committed = await commitPairedBlock(`${corpusRoot}/${manifest.corpusId}`, {
      schemaVersion: 1,
      corpusId: manifest.corpusId,
      blockId: manifest.blockId,
      experimentId: "m1-chrome-sum-u32-v1",
      scheduleIndex: manifest.scheduleIndex,
      stratum: manifest.stratum,
      order: manifest.order,
      records: ordered,
      launchEvidenceSha256: launchArtifact.sha256,
      workerResultSha256: workerArtifact.sha256,
      cleanup: { complete: true, remainingPids: [], profileRemoved: true },
    });
    const js = records.find((r) => r.variantId === "js-controlled")!,
      wasm = records.find((r) => r.variantId === "wasm-linear-controlled")!;
    return {
      blockSha256: committed.sha256,
      cleanup: true,
      stratum: manifest.stratum,
      jsMedianMs: js.medianMs,
      wasmMedianMs: wasm.medianMs,
    };
  } finally {
    if (!cleanupComplete && !cleanupAttempted) {
      await (dependencies.close ?? closeOwnedChrome)(owned);
    }
  }
}
async function collectAll(
  permit: ReturnType<typeof validatePermit>,
  permitDigest: string,
  checked: Awaited<ReturnType<typeof preflight>>,
  collector: typeof collectOwnedBlock = collectOwnedBlock,
  rawBase = "raw/corpora",
  stagedChrome?: StagedChrome,
): Promise<Record<string, unknown>> {
  const prereg = JSON.parse(
      await Deno.readTextFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
    ),
    corpusId = `m1-${permit.permitId}`;
  const state = {
    cold: { attempted: 0, js: [] as number[], wasm: [] as number[], terminal: "continue" },
    warm: { attempted: 0, js: [] as number[], wasm: [] as number[], terminal: "continue" },
  };
  const blocks: AttemptRecord[] = [];
  let containmentStop = false;
  let stop: null | {
    scheduleIndex: number;
    blockId: string;
    category: "blocked-containment";
    reason: string;
    artifactSha256: string;
  } = null;
  const sourceArtifact = {
    sourceCommit: checked.sourceCommit,
    files: checked.sourceFiles,
    sha256: checked.sourceManifestSha256,
  };
  assertSourceManifestSchema(sourceArtifact);
  await writeImmutableArtifact(
    `${rawBase}/${corpusId}/source-manifest.json`,
    canonicalize(sourceArtifact) + "\n",
  );
  for (let index = 0; index < prereg.pairing.schedule.length; index += 1) {
    const scheduled = prereg.pairing.schedule[index],
      stratum = scheduled.stratum as "cold" | "warm",
      cell = state[stratum];
    if (
      containmentStop || cell.terminal !== "continue" || blocks.length >= permit.maximumLaunches
    ) continue;
    assertPermitActive(permit);
    const manifest: LaunchManifest = {
      experimentId: "m1-chrome-sum-u32-v1",
      corpusId,
      blockId: scheduled.blockId,
      scheduleIndex: index,
      stratum,
      order: scheduled.order,
      expiresAt: new Date(Math.min(Date.now() + 10 * 60 * 1000, Date.parse(permit.expiresAt)))
        .toISOString(),
    };
    let attempt: Omit<AttemptRecord, "sha256">;
    let launchBegan = false;
    try {
      const result = await collector(
        permit,
        manifest,
        undefined,
        checked.sourceManifestSha256,
        () => {
          if (launchBegan) throw new Error("duplicate launch begin signal");
          launchBegan = true;
          cell.attempted += 1;
        },
        stagedChrome,
      );
      cell.js.push(result.jsMedianMs);
      cell.wasm.push(result.wasmMedianMs);
      attempt = {
        blockId: manifest.blockId,
        scheduleIndex: index,
        stratum,
        order: [...manifest.order],
        status: "committed",
        category: "committed",
        reason: null,
        jsMedianMs: result.jsMedianMs,
        wasmMedianMs: result.wasmMedianMs,
      };
      const pairSha256 = result.blockSha256;
      const committedAttempt = { ...attempt, pairSha256 };
      assertAttemptRecordSchema(committedAttempt);
      const artifact = await writeImmutableArtifact(
        `${rawBase}/${corpusId}/attempts/${
          String(index).padStart(3, "0")
        }-${manifest.blockId}.json`,
        canonicalize(committedAttempt) + "\n",
      );
      blocks.push({ ...attempt, sha256: artifact.sha256 });
    } catch (error) {
      const failure = classifyAttemptError(error);
      // Fail closed before a spawn without inventing an attempted launch.
      if (!launchBegan) {
        containmentStop = true;
        const stopRecord = {
          scheduleIndex: index,
          blockId: manifest.blockId,
          attempted: false,
          category: "blocked-containment" as const,
          reason: failure.reason,
        };
        assertCollectionStopSchema(stopRecord);
        const stopArtifact = await writeImmutableArtifact(
          `${rawBase}/${corpusId}/collection-stop.json`,
          canonicalize(stopRecord) + "\n",
        );
        stop = {
          scheduleIndex: index,
          blockId: manifest.blockId,
          category: "blocked-containment",
          reason: failure.reason,
          artifactSha256: stopArtifact.sha256,
        };
        break;
      }
      containmentStop ||= failure.stop;
      attempt = {
        blockId: manifest.blockId,
        scheduleIndex: index,
        stratum,
        order: [...manifest.order],
        status: failure.status,
        category: failure.category,
        reason: failure.reason,
        jsMedianMs: null,
        wasmMedianMs: null,
      };
      assertAttemptRecordSchema(attempt);
      const artifact = await writeImmutableArtifact(
        `${rawBase}/${corpusId}/attempts/${
          String(index).padStart(3, "0")
        }-${manifest.blockId}.json`,
        canonicalize(attempt) + "\n",
      );
      blocks.push({ ...attempt, sha256: artifact.sha256 });
      if (failure.stop) {
        const stopRecord = {
          scheduleIndex: index,
          blockId: manifest.blockId,
          attempted: true,
          category: "blocked-containment" as const,
          reason: failure.reason,
        };
        assertCollectionStopSchema(stopRecord);
        const stopArtifact = await writeImmutableArtifact(
          `${rawBase}/${corpusId}/collection-stop.json`,
          canonicalize(stopRecord) + "\n",
        );
        stop = {
          scheduleIndex: index,
          blockId: manifest.blockId,
          category: "blocked-containment",
          reason: failure.reason,
          artifactSha256: stopArtifact.sha256,
        };
      }
    }
    if ([20, 30, 40, 50, 60].includes(cell.attempted)) {
      const counts = blocks.filter((b) => b.stratum === stratum),
        category = (name: string) => counts.filter((b) => b.category === name).length;
      cell.terminal = evaluateAttemptCheckpoint(
        {
          attempted: cell.attempted,
          committed: cell.js.length,
          failedCorrectness: category("failed-correctness"),
          failedMeasurement: category("failed-measurement"),
          blockedContainment: category("blocked-containment"),
          blockedCache: category("blocked-cache"),
          blockedProvenance: category("blocked-provenance"),
        },
        cell.js,
        cell.wasm,
      ).terminal;
    }
  }
  const attempted = blocks.length,
    committed = blocks.filter((b) => b.status === "committed").length,
    failed = blocks.filter((b) => b.status === "failed").length,
    blocked = blocks.filter((b) => b.status === "blocked").length;
  const status = containmentStop
    ? "containment-blocked"
    : state.cold.terminal === "precision-met" && state.warm.terminal === "precision-met"
    ? "precision-met"
    : "cap-inconclusive";
  const strata = Object.fromEntries((["cold", "warm"] as const).map((name) => {
    const attempts = blocks.filter((block) => block.stratum === name);
    return [name, {
      attempted: state[name].attempted,
      committed: attempts.filter((block) => block.status === "committed").length,
      failed: attempts.filter((block) => block.status === "failed").length,
      blocked: attempts.filter((block) => block.status === "blocked").length,
      terminal: state[name].terminal,
    }];
  }));
  const corpus = {
    schemaVersion: 1,
    corpusId,
    experimentId: "m1-chrome-sum-u32-v1",
    permitDigest,
    sourceManifestSha256: checked.sourceManifestSha256,
    chromePackageManifestSha256: permit.chromePackageManifestSha256,
    preregistrationSha256: FROZEN_PREREGISTRATION_SHA256,
    planned: 120,
    attempted,
    committed,
    failed,
    blocked,
    unstarted: 120 - attempted,
    blocks,
    strata,
    stop,
    status,
  };
  assertCorpusSchema(corpus);
  validateCorpusSemantics(corpus, prereg.pairing.schedule);
  const artifact = await writeImmutableArtifact(
    `${rawBase}/${corpusId}/corpus.json`,
    canonicalize(corpus) + "\n",
  );
  return { ...corpus, corpusSha256: artifact.sha256 };
}
function fakeWorkerEnvelope(manifest: LaunchManifest) {
  const variant = (value: number) => ({
    count: 20,
    medianMs: value,
    p95Ms: value,
    firstScoredMs: value,
    samples: Array(20).fill(value),
  });
  return {
    manifest,
    result: {
      capturedAt: new Date().toISOString(),
      order: manifest.order[0] === "js-controlled" ? "js-first" : "wasm-first",
      iterations: 20,
      cache:
        "No Service Worker controlled this page. Fake CDP cache evidence is attested externally.",
      resourceTiming: BENCHMARK_ASSETS.map((route) => ({
        route,
        status: "not-observed",
        reason: "dependency-injected CDP fixture",
      })),
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
      manifest: structuredClone(frozenBuildManifest),
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
      wasm: variant(9),
    },
  };
}
async function fakeCdpBrowser(manifest: LaunchManifest, origin: string) {
  type Listener = (params: Record<string, unknown>, sessionId?: string) => void;
  const listeners = new Map<string, Set<Listener>>(), bodies = new Map<string, Uint8Array>();
  for (const route of BENCHMARK_ASSETS) bodies.set(route, await Deno.readFile(`public${route}`));
  let currentUrl = "about:blank", result: Record<string, unknown> | undefined;
  let workerAlive = false;
  const lifecycle = {
    workerSeenBeforeRelease: false,
    bodyReadsWhileAlive: 0,
    explicitReleaseCalls: 0,
    workerAbsentAfterRelease: false,
  };
  const emit = (method: string, params: Record<string, unknown>, sessionId?: string) =>
    listeners.get(method)?.forEach((listener) => listener(params, sessionId));
  const emitAssets = (sessionId: string, cached: boolean) => {
    BENCHMARK_ASSETS.forEach((route, index) => {
      const requestId = `${sessionId}-${index}`;
      emit("Network.requestWillBeSent", {
        requestId,
        request: { url: `${origin}${route}`, method: "GET" },
      }, sessionId);
      emit("Network.responseReceived", {
        requestId,
        response: { status: 200, fromDiskCache: cached, fromServiceWorker: false },
      }, sessionId);
      if (cached) emit("Network.requestServedFromCache", { requestId }, sessionId);
    });
  };
  const browser = {
    on(method: string, listener: Listener) {
      const set = listeners.get(method) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(method, set);
      return () => set.delete(listener);
    },
    close() {},
    async send(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
      await Promise.resolve();
      if (method === "Target.createTarget") return { targetId: "fake-page" };
      if (method === "Target.attachToTarget") return { sessionId: "fake-page-session" };
      if (method === "Page.navigate") {
        currentUrl = String(params.url);
        queueMicrotask(() => emit("Page.loadEventFired", {}, sessionId));
        return { frameId: "fake-frame" };
      }
      if (method === "Runtime.evaluate") {
        const expression = String(params.expression ?? "");
        if (expression.includes("indexedDB.databases")) {
          return {
            result: {
              value: {
                localStorage: 0,
                sessionStorage: 0,
                indexedDB: 0,
                serviceWorkers: 0,
                controlled: false,
              },
            },
          };
        }
        if (expression.startsWith("Promise.all(")) {
          emitAssets(String(sessionId), false);
          return { result: { value: [...BENCHMARK_ASSETS] } };
        }
        if (expression === "location.href") return { result: { value: currentUrl } };
        if (expression.includes("#run-corpus")) {
          workerAlive = true;
          emit("Target.attachedToTarget", {
            sessionId: "fake-worker-session",
            targetInfo: {
              targetId: "fake-worker",
              type: "worker",
              url: `${origin}/hosted-runner-worker.js`,
            },
          });
          emitAssets("fake-worker-session", manifest.stratum === "warm");
          result = fakeWorkerEnvelope(manifest);
          return { result: { value: true } };
        }
        if (expression.includes("__corpusError")) return { result: { value: result } };
        if (expression.includes("__releaseCorpusWorker")) {
          lifecycle.explicitReleaseCalls += 1;
          workerAlive = false;
          return { result: { value: true } };
        }
        return { result: { value: {} } };
      }
      if (method === "Network.getResponseBody") {
        if (!workerAlive && sessionId === "fake-worker-session") {
          throw new Error("fake worker response body unavailable after release");
        }
        if (workerAlive && sessionId === "fake-worker-session") {
          lifecycle.bodyReadsWhileAlive += 1;
        }
        const id = String(params.requestId), index = Number(id.slice(id.lastIndexOf("-") + 1));
        const bytes = bodies.get(BENCHMARK_ASSETS[index])!;
        return { body: Uint8Array.from(bytes).toBase64(), base64Encoded: true };
      }
      if (method === "Target.getTargets") {
        if (workerAlive) {
          lifecycle.workerSeenBeforeRelease = true;
          return {
            targetInfos: [{
              targetId: "fake-worker",
              type: "worker",
              url: `${origin}/hosted-runner-worker.js`,
            }],
          };
        }
        if (lifecycle.explicitReleaseCalls > 0) lifecycle.workerAbsentAfterRelease = true;
        return { targetInfos: [] };
      }
      if (method === "Page.captureScreenshot") {
        return { data: new TextEncoder().encode("fake-png").toBase64() };
      }
      if (method === "Browser.getVersion") return { product: "Chrome/150.0.7871.24" };
      if (method === "Browser.getBrowserCommandLine") return { arguments: ["fake-reviewed"] };
      return {};
    },
  };
  return Object.assign(browser, { lifecycle });
}
export async function dryFake() {
  const root = "/tmp/wasm-vs-js-dry-fake";
  await Deno.remove(root, { recursive: true }).catch(() => {});
  await Deno.mkdir(root, { recursive: true, mode: 0o700 });
  try {
    const packageManifestSha256 = "c".repeat(64),
      now = new Date(),
      permit = validatePermit({
        schemaVersion: 1,
        permitId: `dry-fake-${crypto.randomUUID()}`,
        experimentId: "m1-chrome-sum-u32-v1",
        operation: "pilot-m1-corpus",
        sourceCommit,
        chromeBinary: "/home/paulkinlan/.local/bin/google-chrome-stable",
        chromeSha256: "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
        chromePackageManifestSha256: packageManifestSha256,
        origin: "http://127.0.0.1:8787",
        strata: ["cold", "warm"],
        maximumLaunches: 120,
        profileRoot: `/tmp/wasm-vs-js-owned-profiles/dry-${crypto.randomUUID()}`,
        issuedAt: new Date(now.getTime() - 1_000).toISOString(),
        expiresAt: new Date(now.getTime() + 3_600_000).toISOString(),
        authorizationReference: "dry-fake-no-browser",
        retryOf: null,
      });
    const stage = {
      root: `${root}/stage`,
      binary: `${root}/stage/chrome`,
      binarySha256: permit.chromeSha256,
      manifestSha256: packageManifestSha256,
      files: { chrome: permit.chromeSha256 },
      rootDev: 1,
      rootIno: 1,
    };
    let productionBlocks = 0, lifecycleValidatedBlocks = 0;
    const fakeCollector: typeof collectOwnedBlock = async (
      p,
      manifest,
      hashes,
      source,
      onLaunch,
      staged,
    ) => {
      const browser = await fakeCdpBrowser(manifest, p.origin);
      const block = await collectOwnedBlock(p, manifest, hashes, source, onLaunch, staged, {
        sourceManifest: () =>
          Promise.resolve({
            sourceCommit,
            files: { "dry-fake.ts": "2".repeat(64) },
            sha256: "1".repeat(64),
          }),
        verifyOrigin: () => Promise.resolve(),
        verifyStage: () => Promise.resolve(),
        issueToken: () => Promise.resolve("fake-token"),
        launch: async (_p, _s, _suffix, began) => {
          await Promise.resolve();
          productionBlocks += 1;
          began?.(70_000 + manifest.scheduleIndex);
          return {
            browser,
            version: { product: "Chrome/150.0.7871.24" },
            ledger: {
              unit: "fake.service",
              controlGroup: "/fake",
              cgroupPath: "/fake",
              cgroupDev: 1,
              cgroupIno: 1,
              invocationId: "0".repeat(32),
              mainPid: 70_000 + manifest.scheduleIndex,
              members: [70_000 + manifest.scheduleIndex],
              membershipSnapshots: [],
              executable: { path: "/fake/chrome", dev: 1, ino: 1, sha256: permit.chromeSha256 },
              commandLine: ["/fake/chrome"],
              profileRoot: "/fake/profile",
              profile: {
                ownershipRoot: "/fake",
                ownershipDev: 1,
                ownershipIno: 1,
                profileRoot: "/fake/profile",
                profileDev: 1,
                profileIno: 2,
              },
              launchedAt: new Date().toISOString(),
              recordedAt: new Date().toISOString(),
            },
          } as never;
        },
        refreshLedger: (ledger) =>
          Promise.resolve({
            ...ledger,
            membershipSnapshots: [...ledger.membershipSnapshots, {
              collectedAt: new Date().toISOString(),
              members: [...ledger.members],
            }],
          }),
        close: () =>
          Promise.resolve({
            cleaned: true,
            remaining: [],
            identityMismatches: [],
            stoppedAt: new Date().toISOString(),
          }),
        rawBase: `${root}/corpora`,
      });
      if (
        browser.lifecycle.workerSeenBeforeRelease &&
        browser.lifecycle.bodyReadsWhileAlive === BENCHMARK_ASSETS.length &&
        browser.lifecycle.explicitReleaseCalls === 1 &&
        browser.lifecycle.workerAbsentAfterRelease
      ) lifecycleValidatedBlocks += 1;
      else throw new Error("production-path fake did not prove worker evidence lifecycle");
      return block;
    };
    const checked = {
      sourceCommit,
      experimentId: "m1-chrome-sum-u32-v1",
      plannedLaunches: 120,
      hostFields: 9,
      sourceManifestSha256: "1".repeat(64),
      sourceFiles: { "dry-fake.ts": "2".repeat(64) },
    };
    const result = await collectAll(
      permit,
      "0".repeat(64),
      checked,
      fakeCollector,
      `${root}/corpora`,
      stage,
    );
    return {
      dependencyInjectedProductionCollectAll: true,
      collectOwnedBlockEntrypointExercised: true,
      browserCdpPathExercised: productionBlocks > 0,
      workerAutoAttachBodiesAndReleaseExercised: productionBlocks > 0 &&
        lifecycleValidatedBlocks === productionBlocks,
      productionBlocks,
      lifecycleValidatedBlocks,
      status: result.status,
      attempted: result.attempted,
      committed: result.committed,
      firstAttempt: Array.isArray(result.blocks) ? result.blocks[0] : null,
      noBrowserOrSystemdLaunched: true,
    };
  } finally {
    await Deno.remove(root, { recursive: true }).catch(() => {});
  }
}

if (import.meta.main) {
  const dry = args.has("--dry-run-fake"), check = await preflight(!dry);
  if (dry) console.log(JSON.stringify({ preflight: check, dryFake: await dryFake() }));
  else if (args.has("--inspect-chrome-package")) {
    const inspected = await inspectChromePackage(
      "/home/paulkinlan/.local/bin/google-chrome-stable",
      "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
    );
    console.log(JSON.stringify({
      ...check,
      chromePackageManifestSha256: inspected.manifestSha256,
      chromeBinarySha256: inspected.binarySha256,
      fileCount: Object.keys(inspected.files).length,
      permitField: { chromePackageManifestSha256: inspected.manifestSha256 },
      browserLaunched: false,
    }));
  } else if (args.has("--diagnostic-stub")) {
    console.log(
      JSON.stringify({
        preflight: check,
        implemented: false,
        browserLaunched: false,
        reason:
          "Diagnostics require a future separate permit, launch family, schema, and review; headline collection cannot invoke them.",
      }),
    );
  } else if (args.has("--consume-permit")) {
    if (!permitPath) throw new Error("--permit required");
    const receipt = await consumePermit(permitPath, "raw/permits", { sourceCommit });
    console.log(
      JSON.stringify({
        preflight: check,
        consumed: receipt.digest,
        permitId: receipt.permit.permitId,
        next: "permit consumed; no retry or second invocation is permitted",
      }),
    );
  } else if (args.has("--collect-all")) {
    if (!permitPath) throw new Error("--permit required");
    const permit = validatePermit(JSON.parse(await Deno.readTextFile(permitPath)), {
      sourceCommit,
      operation: "collect-uninstrumented-headline-paired-corpus",
      maximumLaunches: 120,
    });
    const stage = await stageChromePackage(
      permit.chromeBinary,
      permit.chromeSha256,
      permit.permitId,
    );
    let safeToRemoveStage = false;
    try {
      if (stage.manifestSha256 !== permit.chromePackageManifestSha256) {
        throw new Error("Chrome package manifest differs from authorized permit");
      }
      const receipt = await consumePermit(permitPath, "raw/permits", permit);
      const corpus = await collectAll(
        permit,
        receipt.digest,
        check,
        collectOwnedBlock,
        "raw/corpora",
        stage,
      );
      console.log(JSON.stringify(corpus));
      await verifyStagedChrome(stage);
      safeToRemoveStage = corpus.status !== "containment-blocked";
    } finally {
      if (safeToRemoveStage) await removeStagedChrome(stage);
    }
  } else if (args.has("--collect-one")) {
    if (!permitPath || !manifestPath) throw new Error("--permit and --manifest required");
    const permit = validatePermit(JSON.parse(await Deno.readTextFile(permitPath)), {
      sourceCommit,
      operation: "pilot-m1-corpus",
    });
    const stage = await stageChromePackage(
      permit.chromeBinary,
      permit.chromeSha256,
      permit.permitId,
    );
    let safeToRemoveStage = false;
    try {
      if (stage.manifestSha256 !== permit.chromePackageManifestSha256) {
        throw new Error("Chrome package manifest differs from authorized permit");
      }
      await consumePermit(permitPath, "raw/permits", permit);
      console.log(
        JSON.stringify(
          await collectOwnedBlock(
            permit,
            JSON.parse(await Deno.readTextFile(manifestPath)) as LaunchManifest,
            undefined,
            check.sourceManifestSha256,
            undefined,
            stage,
          ),
        ),
      );
      await verifyStagedChrome(stage);
      safeToRemoveStage = true;
    } finally {
      if (safeToRemoveStage) await removeStagedChrome(stage);
    }
  } else {console.log(JSON.stringify({
      preflight: check,
      permit: permitPath
        ? validatePermit(JSON.parse(await Deno.readTextFile(permitPath)), { sourceCommit })
        : "not supplied",
      noBrowserLaunched: true,
    }));}
}

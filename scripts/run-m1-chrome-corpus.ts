import { assertPermitActive, consumePermit, validatePermit } from "../lib/browser-permit.ts";
import { collectHostProvenance } from "../lib/host-provenance.ts";
import {
  assertListenerOwned,
  closeOwnedChrome,
  launchOwnedChrome,
  waitDevToolsActivePort,
} from "../lib/owned-chrome.ts";
import { CdpClient } from "../lib/cdp-client.ts";
import {
  createLedger,
  prepareProfile,
  refreshLedger,
  teardownLedger,
} from "../lib/process-ledger.ts";
import { commitPairedBlock, LaunchManifest, writeImmutableArtifact } from "../lib/corpus-store.ts";
import { attestNetwork, NetworkRecord } from "../lib/chrome-evidence.ts";
import { collectChromeProvenance } from "../lib/chrome-provenance.ts";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { evaluateAttemptCheckpoint } from "../lib/paired-statistics.ts";
import { assertCorpusSchema, assertLaunchEvidenceSchema } from "../lib/corpus-contracts.ts";
import { expectedBatchDigest } from "../public/hosted-runner-core.js";
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
      "browser-permit.schema.json",
      "corpus.schema.json",
      "launch-evidence.schema.json",
      "paired-block.schema.json",
      "network-attestation.schema.json",
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
  suffix: string,
  onSpawn?: (pid: number) => void,
) {
  return await launchOwnedChrome({
    binary: permit.chromeBinary,
    expectedSha256: permit.chromeSha256,
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
  const variants = buildManifest?.variants as Record<string, Record<string, unknown>>;
  if (
    !buildManifest || variants?.["js-controlled"]?.sha256 !== expectedIdentities.javascriptSha256 ||
    variants?.["wasm-linear-controlled"]?.sha256 !== expectedIdentities.wasmSha256
  ) {
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
    ) {
      throw new Error("resource evidence route invalid");
    }
    routes.add(evidence.route);
    if (evidence.status === "supported-value") {
      const timing = evidence.value as Record<string, unknown>;
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
        finiteNonnegative(timing?.[key], `resource ${key}`);
      }
      if (evidence.scope !== "same-origin-resource-timing" || typeof evidence.caveat !== "string") {
        throw new Error("resource evidence scope invalid");
      }
    } else if (evidence.status !== "not-observed" || typeof evidence.reason !== "string") {
      throw new Error("resource evidence availability invalid");
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
    const requests = new Map<string, { url: string; method: string }>(),
      responses = new Map<
        string,
        { status: number; fromDiskCache: boolean; fromServiceWorker: boolean }
      >(),
      cached = new Set<string>();
    for (const event of events) {
      const id = String(event.requestId ?? "");
      if (event.type === "request") {
        const request = event.request as Record<string, unknown>;
        requests.set(id, {
          url: String(request?.url ?? ""),
          method: String(request?.method ?? ""),
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
        { requestId: id },
        sessionId,
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
export async function collectOwnedBlock(
  permit: ReturnType<typeof validatePermit>,
  manifest: LaunchManifest,
  expectedHashes?: Record<string, string>,
  expectedSourceManifestSha256?: string,
  onLaunchBegan?: (pid: number) => void,
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
  const currentSource = await sourceManifest(permit.sourceCommit);
  if (expectedSourceManifestSha256 && currentSource.sha256 !== expectedSourceManifestSha256) {
    throw new Error("executed source manifest changed after preflight");
  }
  expectedHashes ??= await collectorRouteHashes();
  await verifyOrigin(permit, expectedHashes);
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
  assertPermitActive(permit);
  const token = issuedBody.token,
    owned = await launchReviewedChrome(
      permit,
      `${String(manifest.scheduleIndex).padStart(3, "0")}-${manifest.blockId}`,
      onLaunchBegan,
    );
  if (!String(owned.version.product ?? "").includes("150.0.7871.24")) {
    await closeOwnedChrome(owned).catch(() => {});
    throw new Error("exact Chrome version mismatch");
  }
  const rawRoot = `raw/corpora/${manifest.corpusId}/launches/${manifest.blockId}`,
    events: Array<Record<string, unknown>> = [],
    consoleEvents: Array<Record<string, unknown>> = [];
  let cleanupComplete = false;
  try {
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
    const offs = [
      browser.on("Network.requestWillBeSent", (p, s) => {
        if (s === sessionId) events.push({ type: "request", ...structuredClone(p) });
      }),
      browser.on("Network.responseReceived", (p, s) => {
        if (s === sessionId) events.push({ type: "response", ...structuredClone(p) });
      }),
      browser.on("Network.requestServedFromCache", (p, s) => {
        if (s === sessionId) events.push({ type: "cache", ...structuredClone(p) });
      }),
      browser.on("Runtime.consoleAPICalled", (p, s) => {
        if (s === sessionId) consoleEvents.push(structuredClone(p));
      }),
    ];
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
      const primeEvents = structuredClone(events),
        primeRecords = await networkRecords(primeEvents, [...BENCHMARK_ASSETS], browser, sessionId);
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
        owned.ledger = await refreshLedger(owned.ledger);
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
    owned.ledger = await refreshLedger(owned.ledger);
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
    const closed = await closeOwnedChrome(owned);
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
        consoleJson: consoleArtifact.sha256,
        screenshotPng: screenshotArtifact.sha256,
        workerResultJson: workerArtifact.sha256,
      },
      cleanup: {
        complete: true,
        ownedPids: owned.ledger.ownedPids,
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
    const committed = await commitPairedBlock(`raw/corpora/${manifest.corpusId}`, {
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
    if (!cleanupComplete) await closeOwnedChrome(owned);
  }
}
async function collectAll(
  permit: ReturnType<typeof validatePermit>,
  permitDigest: string,
  checked: Awaited<ReturnType<typeof preflight>>,
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
  await writeImmutableArtifact(
    `raw/corpora/${corpusId}/source-manifest.json`,
    canonicalize({
      sourceCommit: checked.sourceCommit,
      files: checked.sourceFiles,
      sha256: checked.sourceManifestSha256,
    }) + "\n",
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
      const result = await collectOwnedBlock(
        permit,
        manifest,
        undefined,
        checked.sourceManifestSha256,
        () => {
          if (launchBegan) throw new Error("duplicate launch begin signal");
          launchBegan = true;
          cell.attempted += 1;
        },
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
      const artifact = await writeImmutableArtifact(
        `raw/corpora/${corpusId}/attempts/${
          String(index).padStart(3, "0")
        }-${manifest.blockId}.json`,
        canonicalize({ ...attempt, pairSha256 }) + "\n",
      );
      blocks.push({ ...attempt, sha256: artifact.sha256 });
    } catch (error) {
      const failure = classifyAttemptError(error);
      // Fail closed before a spawn without inventing an attempted launch.
      if (!launchBegan) {
        containmentStop = true;
        await writeImmutableArtifact(
          `raw/corpora/${corpusId}/collection-stop.json`,
          canonicalize({
            scheduleIndex: index,
            blockId: manifest.blockId,
            attempted: false,
            category: "blocked-containment",
            reason: failure.reason,
          }) + "\n",
        );
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
      const artifact = await writeImmutableArtifact(
        `raw/corpora/${corpusId}/attempts/${
          String(index).padStart(3, "0")
        }-${manifest.blockId}.json`,
        canonicalize(attempt) + "\n",
      );
      blocks.push({ ...attempt, sha256: artifact.sha256 });
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
    preregistrationSha256: FROZEN_PREREGISTRATION_SHA256,
    planned: 120,
    attempted,
    committed,
    failed,
    blocked,
    unstarted: 120 - attempted,
    blocks,
    strata,
    status,
  };
  assertCorpusSchema(corpus);
  validateCorpusSemantics(corpus, prereg.pairing.schedule);
  const artifact = await writeImmutableArtifact(
    `raw/corpora/${corpusId}/corpus.json`,
    canonicalize(corpus) + "\n",
  );
  return { ...corpus, corpusSha256: artifact.sha256 };
}
async function dryFake() {
  const { handler: localServerHandler } = await import("../server.ts");
  const root = await Deno.makeTempDir();
  const token = `dry-${crypto.randomUUID()}`;
  const permitValue = {
    schemaVersion: 1 as const,
    permitId: token,
    experimentId: "m1-chrome-sum-u32-v1",
    operation: "pilot-m1-corpus" as const,
    sourceCommit,
    chromeBinary: "/home/paulkinlan/.local/bin/google-chrome-stable",
    chromeSha256: "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
    origin: "http://127.0.0.1:8787",
    strata: ["cold", "warm"] as ["cold", "warm"],
    maximumLaunches: 1,
    profileRoot: `/tmp/wasm-vs-js-owned-profiles/${token}`,
    issuedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    authorizationReference: "dry-fake-integration-only",
    retryOf: null,
  };
  const permitFile = `${root}/permit.json`;
  await Deno.writeTextFile(permitFile, JSON.stringify(permitValue));
  const consumed = await consumePermit(permitFile, `${root}/receipts`, {
    sourceCommit,
    operation: "pilot-m1-corpus",
  });
  const profilePath = `${consumed.permit.profileRoot}/launch`;
  const profile = await prepareProfile(profilePath);
  const proc = `${root}/proc`, exe = `${root}/fake-chrome`;
  await Deno.mkdir(`${proc}/700/fd`, { recursive: true });
  await Deno.mkdir(`${proc}/net`, { recursive: true });
  await Deno.writeTextFile(exe, "fake chrome executable");
  await Deno.writeTextFile(
    `${proc}/700/stat`,
    `700 (fake chrome) S 1 700 700 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 7000\n`,
  );
  await Deno.writeFile(
    `${proc}/700/cmdline`,
    new TextEncoder().encode(`${exe}\0--user-data-dir=${profilePath}\0`),
  );
  await Deno.symlink(exe, `${proc}/700/exe`);
  await Deno.symlink("socket:[12345]", `${proc}/700/fd/9`);
  await Deno.writeTextFile(
    `${proc}/net/tcp`,
    "  sl  local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n   0: 0100007F:2406 00000000:0000 0A 00000000:00000000 00:00000000 00000000 1000 0 12345 1\n",
  );
  await Deno.writeTextFile(
    `${proc}/net/tcp6`,
    "  sl  local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n",
  );
  await Deno.writeTextFile(
    `${profilePath}/DevToolsActivePort`,
    "9222\n/devtools/browser/dry-fake\n",
  );
  class FakeSocket extends EventTarget {
    static OPEN = 1;
    readyState = 1;
    onmessage: ((event: { data: string }) => void) | null = null;
    sent: string[] = [];
    constructor(_url: string) {
      super();
    }
    send(value: string) {
      this.sent.push(value);
      const request = JSON.parse(value);
      queueMicrotask(() =>
        this.onmessage?.({
          data: JSON.stringify({ id: request.id, result: { product: "FakeChrome/150" } }),
        })
      );
    }
    close() {
      this.readyState = 3;
    }
  }
  try {
    const endpoint = await waitDevToolsActivePort(profilePath, 100);
    const cdp = new CdpClient(
      `ws://127.0.0.1:${endpoint.port}${endpoint.browserPath}`,
      FakeSocket as unknown as typeof WebSocket,
    );
    const fakeVersion = await cdp.send("Browser.getVersion");
    cdp.close();
    const ledger = await createLedger(700, profile, proc);
    await assertListenerOwned(endpoint.port, ledger, proc);
    const cleanup = await teardownLedger(ledger, {
      procRoot: proc,
      kill: (pid) => Deno.removeSync(`${proc}/${pid}`, { recursive: true }),
      sleep: async () => {},
    });
    if (!cleanup.cleaned || fakeVersion.product !== "FakeChrome/150") {
      throw new Error("fake Chrome/CDP containment integration failed");
    }
    const routeHashes = await collectorRouteHashes();
    const health = await localServerHandler(new Request(`${consumed.permit.origin}/healthz`));
    const healthBody = await health.json();
    if (
      health.status !== 200 || healthBody.localCheckoutCommit !== sourceCommit ||
      JSON.stringify(healthBody.collectorAssets) !== JSON.stringify(routeHashes)
    ) {
      throw new Error("dry fake local server source identity failed");
    }
    assertContainedRequests([{
      type: "request",
      request: { url: `${consumed.permit.origin}/styles.css`, method: "GET" },
    }], consumed.permit.origin);
    const styles = await localServerHandler(new Request(`${consumed.permit.origin}/styles.css`));
    if (
      !styles.ok ||
      await sha256Hex(new Uint8Array(await styles.arrayBuffer())) !== routeHashes["/styles.css"]
    ) {
      throw new Error("dry fake styles route/hash failed");
    }
    const launchManifest: LaunchManifest = {
      experimentId: "m1-chrome-sum-u32-v1",
      corpusId: "dry-fake",
      blockId: "cold-01",
      scheduleIndex: 0,
      stratum: "cold",
      order: ["js-controlled", "wasm-linear-controlled"],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const issue = await localServerHandler(
      new Request(`${consumed.permit.origin}/api/corpus/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(launchManifest),
      }),
    );
    const launchToken = (await issue.json()).token;
    if (issue.status !== 201 || typeof launchToken !== "string") {
      throw new Error("dry fake token issue failed");
    }
    const page = await localServerHandler(
      new Request(`${consumed.permit.origin}/corpus-run?token=${launchToken}`),
    );
    const manifestResponse = await localServerHandler(
      new Request(`${consumed.permit.origin}/api/corpus/manifest?token=${launchToken}`),
    );
    if (
      !page.ok || page.url && new URL(page.url).pathname !== "/corpus-run" ||
      JSON.stringify(await manifestResponse.json()) !== JSON.stringify(launchManifest)
    ) {
      throw new Error("dry fake navigation/manifest binding failed");
    }
    const benchmarkHashes = Object.fromEntries(
      BENCHMARK_ASSETS.map((path) => [path, routeHashes[path]]),
    );
    const networkFixture = async (cached: boolean) =>
      await Promise.all(BENCHMARK_ASSETS.map(async (path) => ({
        url: `${consumed.permit.origin}${path}`,
        method: "GET",
        status: 200,
        fromDiskCache: cached,
        fromServiceWorker: false,
        body: await Deno.readFile(COLLECTOR_ROUTES[path]),
      })));
    await attestNetwork(
      await networkFixture(false),
      "cold",
      consumed.permit.origin,
      benchmarkHashes,
      "measurement",
    );
    await attestNetwork(
      await networkFixture(false),
      "warm",
      consumed.permit.origin,
      benchmarkHashes,
      "prime",
    );
    await attestNetwork(
      await networkFixture(true),
      "warm",
      consumed.permit.origin,
      benchmarkHashes,
      "measurement",
    );
    const buildManifest = JSON.parse(
      await Deno.readTextFile("public/artifacts/sum-u32/build-manifest.json"),
    );
    const variant = (medianMs: number) => ({
      count: 20,
      medianMs,
      p95Ms: medianMs,
      firstScoredMs: medianMs,
      samples: Array(20).fill(medianMs),
    });
    const dryWorker = {
      manifest: launchManifest,
      result: {
        capturedAt: new Date().toISOString(),
        order: "js-first",
        iterations: 20,
        cache:
          "No Service Worker controlled this page. Dry fake external cache attestation passed.",
        resourceTiming: BENCHMARK_ASSETS.map((route) => ({
          route,
          status: "not-observed",
          reason: "dependency-injected dry fake",
        })),
        batchSize: 1,
        work: {
          items: 65536,
          inputBytes: 262144,
          additions: 65536,
          loads: 65536,
          boundaryCrossings: 1,
        },
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
        manifest: buildManifest,
        jsSha256: "4d8379672c1b51b0b315d2bee119880694e5a4f6412ef59b7fe2593ef6b179b7",
        wasmSha256: "9c4ce5f0d9e32cdd364b73b2697566e7396368d9867d9bc3d939bb2063583a6d",
        wasmLinearMemory: {
          status: "supported-value",
          scope: "webassembly-linear-memory-buffer-length",
          caveat: "JavaScript-visible buffer length, not committed or resident physical memory.",
          value: { beforeScoredBytes: 65536, afterScoredBytes: 65536 },
        },
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
        js: variant(10),
        wasm: variant(5),
      },
    };
    validateWorkerResult(dryWorker, launchManifest);
    const samples = [10, 11],
      records = [{
        variantId: "js-controlled" as const,
        payloadSha256: "a".repeat(64),
        medianMs: 10.5,
        samples,
      }, {
        variantId: "wasm-linear-controlled" as const,
        payloadSha256: "b".repeat(64),
        medianMs: 5.5,
        samples: [5, 6],
      }];
    const result = await commitPairedBlock(root, {
      schemaVersion: 1,
      corpusId: "dry-fake",
      blockId: "block-000",
      experimentId: "m1-chrome-sum-u32-v1",
      scheduleIndex: 0,
      stratum: "cold",
      order: ["js-controlled", "wasm-linear-controlled"],
      records,
      launchEvidenceSha256: "c".repeat(64),
      workerResultSha256: "d".repeat(64),
      cleanup: { complete: true, remainingPids: [], profileRemoved: true },
    });
    return {
      dependencyInjectedCollectOwnedBlock: true,
      permitConsumed: consumed.digest,
      localServerNavigationStylesWarmWorkerValidated: true,
      fakeChromeProfileCdpTeardown: true,
      devToolsEndpoint: endpoint,
      committed: true,
      artifactSha256: result.sha256,
    };
  } finally {
    await Deno.remove(root, { recursive: true }).catch(() => {});
    await Deno.remove(profile.ownershipRoot, { recursive: true }).catch(() => {});
  }
}
if (import.meta.main) {
  const dry = args.has("--dry-run-fake"), check = await preflight(!dry);
  if (dry) console.log(JSON.stringify({ preflight: check, dryFake: await dryFake() }));
  else if (args.has("--diagnostic-stub")) {
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
    const receipt = await consumePermit(permitPath, "raw/permits", permit);
    console.log(JSON.stringify(await collectAll(permit, receipt.digest, check)));
  } else if (args.has("--collect-one")) {
    if (!permitPath || !manifestPath) throw new Error("--permit and --manifest required");
    const permit = validatePermit(JSON.parse(await Deno.readTextFile(permitPath)), {
      sourceCommit,
      operation: "pilot-m1-corpus",
    });
    await consumePermit(permitPath, "raw/permits", permit);
    console.log(
      JSON.stringify(
        await collectOwnedBlock(
          permit,
          JSON.parse(await Deno.readTextFile(manifestPath)) as LaunchManifest,
          undefined,
          check.sourceManifestSha256,
        ),
      ),
    );
  } else {console.log(JSON.stringify({
      preflight: check,
      permit: permitPath
        ? validatePermit(JSON.parse(await Deno.readTextFile(permitPath)), { sourceCommit })
        : "not supplied",
      noBrowserLaunched: true,
    }));}
}

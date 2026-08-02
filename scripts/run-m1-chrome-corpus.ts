import { assertPermitActive, consumePermit, validatePermit } from "../lib/browser-permit.ts";
import { collectHostProvenance } from "../lib/host-provenance.ts";
import {
  assertListenerOwned,
  closeOwnedChrome,
  launchOwnedChrome,
  waitDevToolsActivePort,
} from "../lib/owned-chrome.ts";
import { CdpClient } from "../lib/cdp-client.ts";
import { createLedger, prepareProfile, teardownLedger } from "../lib/process-ledger.ts";
import { commitPairedBlock, LaunchManifest, writeImmutableArtifact } from "../lib/corpus-store.ts";
import { attestNetwork, NetworkRecord } from "../lib/chrome-evidence.ts";
import { collectChromeProvenance } from "../lib/chrome-provenance.ts";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { evaluateAttemptCheckpoint } from "../lib/paired-statistics.ts";
import { AttemptRecord, median, validateCorpusSemantics } from "../lib/corpus-validation.ts";
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
const HEADLINE_ASSETS = Object.keys(COLLECTOR_ROUTES).filter((path) => path !== "/corpus-run")
  .sort();

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
) {
  return await launchOwnedChrome({
    binary: permit.chromeBinary,
    expectedSha256: permit.chromeSha256,
    profileRoot: `${permit.profileRoot}/${suffix}`,
    extraArguments: [],
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
  if (/identity|source|provenance|origin|network|hash|unexpected|storage|version/.test(lower)) {
    return { status: "blocked", category: "blocked-provenance", stop: false, reason };
  }
  return { status: "failed", category: "failed-measurement", stop: false, reason };
}
export function validateWorkerResult(
  value: Record<string, unknown>,
  expectedManifest: LaunchManifest,
) {
  const result = value.result as Record<string, unknown>;
  if (!result || JSON.stringify(value.manifest) !== JSON.stringify(expectedManifest)) {
    throw new Error("worker result manifest identity mismatch");
  }
  const expectedOrder = expectedManifest.order[0] === "js-controlled" ? "js-first" : "wasm-first";
  if (result.order !== expectedOrder || result.iterations !== 20) {
    throw new Error("worker execution identity mismatch");
  }
  const correctness = result.correctness as Record<string, unknown>,
    identities = result.identities as Record<string, unknown>,
    work = result.work as Record<string, unknown>;
  if (
    !correctness || correctness.passed !== true || correctness.oracle !== 145417951 ||
    correctness.jsFirstOutput !== 145417951 || correctness.wasmFirstOutput !== 145417951 ||
    correctness.everyScoredInvocationValidated !== true
  ) throw new Error("correctness evidence invalid");
  if (
    identities?.inputSha256 !==
      "4f0516549fc9d6952c8d42d642927dd5c43a8c01d03c286e0c80da919bfaf9d7" ||
    identities?.manifestSha256 !==
      "38136e96462c5b98e3057e4ea18ae339150918aa50f1270eb3db88586185cf98" ||
    identities?.javascriptSha256 !==
      "4d8379672c1b51b0b315d2bee119880694e5a4f6412ef59b7fe2593ef6b179b7" ||
    identities?.wasmSha256 !== "9c4ce5f0d9e32cdd364b73b2697566e7396368d9867d9bc3d939bb2063583a6d"
  ) throw new Error("worker artifact identity mismatch");
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
    correctness.scoredInvocationsPerVariant !== batchSize * 20
  ) throw new Error("fixed work evidence invalid");
  const lifecycle = result.lifecycle as Record<string, unknown>;
  if (
    !lifecycle ||
    [
      "manifestTransferMs",
      "jsTransferMs",
      "wasmTransferMs",
      "wasmCompileMs",
      "wasmInstantiateMs",
      "jsFirstExecuteMs",
      "wasmFirstExecuteMs",
    ].some((key) => !Number.isFinite(lifecycle[key]) || Number(lifecycle[key]) < 0)
  ) throw new Error("complete lifecycle evidence invalid");
  if (!(result.wasmLinearMemory as Record<string, unknown>)?.value) {
    throw new Error("Wasm memory evidence missing");
  }
  const records = [];
  for (const [key, id] of [["js", "js-controlled"], ["wasm", "wasm-linear-controlled"]] as const) {
    const variant = result[key] as Record<string, unknown>, samples = variant?.samples as number[];
    if (
      !Array.isArray(samples) || samples.length !== 20 || variant.count !== 20 ||
      samples.some((v) => !Number.isFinite(v) || v <= 0) || variant.medianMs !== median(samples)
    ) throw new Error("complete scored trajectory invalid");
    records.push({ variantId: id, payloadSha256: "", medianMs: Number(variant.medianMs), samples });
  }
  return { result, records };
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
  const token = issuedBody.token,
    owned = await launchReviewedChrome(
      permit,
      `${String(manifest.scheduleIndex).padStart(3, "0")}-${manifest.blockId}`,
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
    let primeArtifact: { sha256: string } | undefined;
    const expectedMeasurement = Object.fromEntries(
      HEADLINE_ASSETS.map((path) => [path, expectedHashes[path]]),
    );
    if (manifest.stratum === "warm") {
      await browser.send("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression: `Promise.all(${
          JSON.stringify(HEADLINE_ASSETS)
        }.map(async p=>{const r=await fetch(p,{cache:'reload'});if(!r.ok)throw new Error('prime failed');await r.arrayBuffer();return p}))`,
      }, sessionId);
      await new Promise((r) => setTimeout(r, 100));
      const primeEvents = structuredClone(events),
        primeRecords = await networkRecords(primeEvents, HEADLINE_ASSETS, browser, sessionId);
      const prime = await attestNetwork(
        primeRecords,
        "warm",
        permit.origin,
        expectedMeasurement,
        "prime",
      );
      primeArtifact = await writeImmutableArtifact(
        `${rawRoot}/network-prime.json`,
        canonicalize({ events: primeEvents, attestation: prime }) + "\n",
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
    while (Date.now() < deadline) {
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
    const validated = validateWorkerResult(collected, manifest),
      after = await collectChromeProvenance(browser, browser, sessionId);
    for (const event of events.filter((e) => e.type === "request")) {
      const request = event.request as Record<string, unknown>,
        url = new URL(String(request?.url ?? ""));
      if (url.origin !== permit.origin || request?.method !== "GET") {
        throw new Error("unexpected origin or method");
      }
      if (![...HEADLINE_ASSETS, "/corpus-run", "/api/corpus/manifest"].includes(url.pathname)) {
        throw new Error(`unexpected request: ${url.pathname}`);
      }
    }
    const measurementRecords = await networkRecords(events, HEADLINE_ASSETS, browser, sessionId);
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
    const networkArtifact = await writeImmutableArtifact(
      `${rawRoot}/network-measurement.json`,
      canonicalize({ events, attestation: measurement }) + "\n",
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
      network: { attestationSha256: networkArtifact.sha256, stratum: manifest.stratum },
      artifacts: {
        networkMeasurementJson: networkArtifact.sha256,
        ...(primeArtifact ? { networkPrimeJson: primeArtifact.sha256 } : {}),
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
    cell.attempted += 1;
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
    try {
      const result = await collectOwnedBlock(
        permit,
        manifest,
        undefined,
        checked.sourceManifestSha256,
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
      containmentStop ||= failure.stop;
      attempt = {
        blockId: manifest.blockId,
        scheduleIndex: index,
        stratum,
        order: [...manifest.order],
        status: failure.status,
        category: failure.category,
        reason: failure.reason,
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
    status,
  };
  validateCorpusSemantics(corpus);
  const artifact = await writeImmutableArtifact(
    `raw/corpora/${corpusId}/corpus.json`,
    canonicalize(corpus) + "\n",
  );
  return { ...corpus, corpusSha256: artifact.sha256 };
}
async function dryFake() {
  const root = await Deno.makeTempDir();
  const token = `dry-${crypto.randomUUID()}`;
  const profilePath = `/tmp/wasm-vs-js-owned-profiles/${token}/launch`;
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

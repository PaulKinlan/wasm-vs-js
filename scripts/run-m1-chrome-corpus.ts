import { consumePermit, validatePermit } from "../lib/browser-permit.ts";
import { collectHostProvenance, collectProcessMemory } from "../lib/host-provenance.ts";
import { closeOwnedChrome, launchOwnedChrome } from "../lib/owned-chrome.ts";
import {
  commitPairedBlock,
  CorpusCoordinator,
  LaunchManifest,
  PairInput,
  writeImmutableArtifact,
} from "../lib/corpus-store.ts";
import { attestNetwork, NetworkRecord } from "../lib/chrome-evidence.ts";
import { collectChromeProvenance } from "../lib/chrome-provenance.ts";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { createLedger } from "../lib/process-ledger.ts";
import { evaluateAttemptCheckpoint } from "../lib/paired-statistics.ts";

const args = new Set(Deno.args);
const permitPath = Deno.args.find((x) => x.startsWith("--permit="))?.slice(9);
const manifestPath = Deno.args.find((x) => x.startsWith("--manifest="))?.slice(11);
const sourceCommit = Deno.env.get("WASM_VS_JS_COMMIT") ?? "";

async function preflight() {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("exact source commit required");
  const prereg = JSON.parse(
    await Deno.readTextFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
  );
  if (
    prereg.experimentId !== "m1-chrome-sum-u32-v1" ||
    prereg.pairing?.schedule?.length !== 120
  ) {
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
  const host = await collectHostProvenance();
  return {
    sourceCommit,
    experimentId: prereg.experimentId,
    plannedLaunches: prereg.pairing.schedule.length,
    hostFields: Object.keys(host).length,
  };
}

export { closeOwnedChrome };

export async function launchReviewedChrome(
  permit: ReturnType<typeof validatePermit>,
  profileSuffix: string,
) {
  return await launchOwnedChrome({
    binary: permit.chromeBinary,
    expectedSha256: permit.chromeSha256,
    profileRoot: `${permit.profileRoot}/${profileSuffix}`,
    extraArguments: [],
  });
}

function nestedValue(result: Record<string, unknown>): unknown {
  return ((result.result as Record<string, unknown>)?.value);
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
    const off = client.on(method, (params, eventSession) => {
      if (eventSession !== sessionId) return;
      clearTimeout(timer);
      off();
      resolve(params);
    });
  });
}

export async function collectOwnedBlock(
  permit: ReturnType<typeof validatePermit>,
  manifest: LaunchManifest,
): Promise<{
  blockSha256: string;
  cleanup: true;
  stratum: "cold" | "warm";
  jsMedianMs: number;
  wasmMedianMs: number;
}> {
  const issued = await fetch(`${permit.origin}/api/corpus/launch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(manifest),
  });
  if (issued.status !== 201) throw new Error("local corpus launch token issue failed");
  const issuedBody = await issued.json();
  if (typeof issuedBody.token !== "string") throw new Error("local corpus launch token missing");
  const token = issuedBody.token;
  const owned = await launchReviewedChrome(
    permit,
    `${String(manifest.scheduleIndex).padStart(3, "0")}-${manifest.blockId}`,
  );
  const browser = owned.browser;
  if (!String(owned.version.product ?? "").includes("150.0.7871.24")) {
    await closeOwnedChrome(owned).catch(() => {});
    throw new Error("exact Chrome version mismatch");
  }
  const rawRoot = `raw/corpora/${manifest.corpusId}/launches/${manifest.blockId}`;
  const networkEvents: Array<Record<string, unknown>> = [];
  const consoleEvents: Array<Record<string, unknown>> = [];
  let cleanupComplete = false;
  try {
    const processMemoryBefore = await collectProcessMemory(owned.ledger.ownedPids);
    const target = await browser.send("Target.createTarget", { url: "about:blank" });
    const targetId = target.targetId;
    if (typeof targetId !== "string") throw new Error("target creation denied");
    const attached = await browser.send("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = attached.sessionId;
    if (typeof sessionId !== "string") throw new Error("target attachment denied");
    for (
      const method of [
        "Page.enable",
        "Runtime.enable",
        "Network.enable",
        "Performance.enable",
        "Log.enable",
      ]
    ) {
      await browser.send(method, {}, sessionId);
    }
    const offRequest = browser.on("Network.requestWillBeSent", (params, sid) => {
      if (sid === sessionId) networkEvents.push({ type: "request", ...structuredClone(params) });
    });
    const offResponse = browser.on("Network.responseReceived", (params, sid) => {
      if (sid === sessionId) networkEvents.push({ type: "response", ...structuredClone(params) });
    });
    const offCache = browser.on("Network.requestServedFromCache", (params, sid) => {
      if (sid === sessionId) networkEvents.push({ type: "cache", ...structuredClone(params) });
    });
    const offConsole = browser.on("Runtime.consoleAPICalled", (params, sid) => {
      if (sid === sessionId) consoleEvents.push(structuredClone(params));
    });
    const navigate = async (url: string) => {
      const loaded = waitForEvent(browser, "Page.loadEventFired", sessionId);
      await browser.send("Page.navigate", { url }, sessionId);
      await loaded;
    };
    await navigate(`${permit.origin}/healthz`);
    const storage = await browser.send("Runtime.evaluate", {
      awaitPromise: true,
      returnByValue: true,
      expression:
        `(async()=>({localStorage:localStorage.length,sessionStorage:sessionStorage.length,indexedDB:(await indexedDB.databases()).length,serviceWorkers:(await navigator.serviceWorker.getRegistrations()).length,controlled:Boolean(navigator.serviceWorker.controller)}))()`,
    }, sessionId);
    const storageValue = nestedValue(storage) as Record<string, unknown>;
    if (
      !storageValue || Object.values(storageValue).some((value) => value !== 0 && value !== false)
    ) {
      throw new Error("fresh-profile storage contradiction");
    }
    const assetPaths = [
      "/artifacts/sum-u32/build-manifest.json",
      "/benchmarks/sum-u32/workload.js",
      "/artifacts/sum-u32/sum-u32.wasm",
    ];
    if (manifest.stratum === "warm") {
      await browser.send("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression: `Promise.all(${
          JSON.stringify(assetPaths)
        }.map(async p=>{const r=await fetch(p);if(!r.ok)throw new Error('prime failed');await r.arrayBuffer();return p}))`,
      }, sessionId);
      networkEvents.length = 0;
    }
    const before = await collectChromeProvenance(browser, browser, sessionId);
    await navigate(`${permit.origin}/corpus-run?token=${encodeURIComponent(token)}`);
    await browser.send("Runtime.evaluate", {
      expression: `document.querySelector('#run-corpus').click()`,
    }, sessionId);
    let collected: Record<string, unknown> | undefined;
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const probe = await browser.send("Runtime.evaluate", {
        returnByValue: true,
        expression:
          `globalThis.__corpusError?({error:globalThis.__corpusError}):globalThis.__corpusResult`,
      }, sessionId);
      const value = nestedValue(probe);
      if (value && typeof value === "object") {
        collected = value as Record<string, unknown>;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!collected || "error" in collected) {
      throw new Error(`collector failed: ${String(collected?.error ?? "timeout")}`);
    }
    const after = await collectChromeProvenance(browser, browser, sessionId);
    const refreshed = await createLedger(owned.ledger.rootPid, owned.ledger.profileRoot);
    owned.ledger.ownedPids = [...new Set([...owned.ledger.ownedPids, ...refreshed.ownedPids])];
    const processMemoryAfter = await collectProcessMemory(owned.ledger.ownedPids);
    const requests = new Map<string, { url: string; method: string }>();
    const responses = new Map<
      string,
      { status: number; fromDiskCache: boolean; fromServiceWorker: boolean }
    >();
    const cached = new Set<string>();
    for (const event of networkEvents) {
      const requestId = String(event.requestId ?? "");
      if (event.type === "request") {
        const request = event.request as Record<string, unknown>;
        requests.set(requestId, {
          url: String(request?.url ?? ""),
          method: String(request?.method ?? ""),
        });
      } else if (event.type === "response") {
        const response = event.response as Record<string, unknown>;
        responses.set(requestId, {
          status: Number(response?.status),
          fromDiskCache: response?.fromDiskCache === true,
          fromServiceWorker: response?.fromServiceWorker === true,
        });
      } else if (event.type === "cache") cached.add(requestId);
    }
    const records: NetworkRecord[] = [];
    for (const [requestId, request] of requests) {
      const path = (() => {
        try {
          return new URL(request.url).pathname;
        } catch {
          return "";
        }
      })();
      if (!assetPaths.includes(path)) continue;
      const response = responses.get(requestId);
      if (!response) throw new Error("asset response missing");
      const bodyResult = await browser.send("Network.getResponseBody", { requestId }, sessionId);
      const bodyText = String(bodyResult.body ?? "");
      const body = bodyResult.base64Encoded === true
        ? Uint8Array.from(atob(bodyText), (char) => char.charCodeAt(0))
        : new TextEncoder().encode(bodyText);
      records.push({
        ...request,
        ...response,
        fromDiskCache: response.fromDiskCache || cached.has(requestId),
        body,
      });
    }
    for (const event of networkEvents.filter((item) => item.type === "request")) {
      const request = event.request as Record<string, unknown>;
      const url = String(request?.url ?? "");
      const method = String(request?.method ?? "");
      if (url && !url.startsWith(permit.origin) || method && method !== "GET") {
        throw new Error("unexpected origin or method");
      }
    }
    const network = await attestNetwork(records, manifest.stratum, permit.origin);
    const screenshot = await browser.send("Page.captureScreenshot", { format: "png" }, sessionId);
    offRequest();
    offResponse();
    offCache();
    offConsole();
    const screenshotBytes = Uint8Array.from(
      atob(String(screenshot.data ?? "")),
      (char) => char.charCodeAt(0),
    );
    const networkArtifact = await writeImmutableArtifact(
      `${rawRoot}/network.json`,
      canonicalize({ events: networkEvents, attestation: network }) + "\n",
    );
    const consoleArtifact = await writeImmutableArtifact(
      `${rawRoot}/console.json`,
      canonicalize(consoleEvents) + "\n",
    );
    const screenshotArtifact = await writeImmutableArtifact(`${rawRoot}/page.png`, screenshotBytes);
    const host = {
      ...await collectHostProvenance(),
      processMemoryBefore,
      processMemoryAfter,
    };
    const result = collected.result as Record<string, unknown>;
    const js = result.js as Record<string, unknown>, wasm = result.wasm as Record<string, unknown>;
    const jsRecord = {
      variantId: "js-controlled" as const,
      payloadSha256: await sha256Hex(canonicalize(js)),
      medianMs: Number(js.medianMs),
      samples: js.samples as number[],
    };
    const wasmRecord = {
      variantId: "wasm-linear-controlled" as const,
      payloadSha256: await sha256Hex(canonicalize(wasm)),
      medianMs: Number(wasm.medianMs),
      samples: wasm.samples as number[],
    };
    const closed = await closeOwnedChrome(owned);
    cleanupComplete = closed.cleaned;
    const launchEvidence = {
      schemaVersion: 1,
      launchId: crypto.randomUUID(),
      blockId: manifest.blockId,
      sourceCommit: permit.sourceCommit,
      browser: {
        ...before,
        ...Object.fromEntries(
          Object.entries(after).map((
            [key, value],
          ) => [`after${key[0].toUpperCase()}${key.slice(1)}`, value]),
        ),
      },
      profile: {
        rootSha256: await sha256Hex(owned.ledger.profileRoot),
        fresh: true,
        removed: true,
      },
      host,
      page: {
        collector: {
          status: "supported-value",
          value: { route: "/corpus-run", tokenBound: true },
          source: "orchestrator",
          scope: "collector",
          collectedAt: new Date().toISOString(),
        },
        interaction: {
          status: "supported-value",
          value: { kind: "visible-button-click", selector: "#run-corpus" },
          source: "cdp-target",
          scope: "collector-control",
          collectedAt: new Date().toISOString(),
        },
        assertions: {
          status: "supported-value",
          value: {
            resultPresent: true,
            variants: ["js-controlled", "wasm-linear-controlled"],
            samplesPerVariant: [jsRecord.samples.length, wasmRecord.samples.length],
          },
          source: "orchestrator",
          scope: "post-run-assertions",
          collectedAt: new Date().toISOString(),
        },
      },
      network: { attestationSha256: networkArtifact.sha256, stratum: manifest.stratum },
      artifacts: {
        networkJson: networkArtifact.sha256,
        consoleJson: consoleArtifact.sha256,
        screenshotPng: screenshotArtifact.sha256,
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
    const ordered = manifest.order.map((id) => id === "js-controlled" ? jsRecord : wasmRecord);
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
      cleanup: { complete: true, remainingPids: [], profileRemoved: true },
    });
    return {
      blockSha256: committed.sha256,
      cleanup: true,
      stratum: manifest.stratum,
      jsMedianMs: jsRecord.medianMs,
      wasmMedianMs: wasmRecord.medianMs,
    };
  } finally {
    if (!cleanupComplete) await closeOwnedChrome(owned).catch(() => {});
  }
}

async function collectAll(
  permit: ReturnType<typeof validatePermit>,
  permitDigest: string,
): Promise<Record<string, unknown>> {
  const prereg = JSON.parse(
    await Deno.readTextFile("experiments/m1-chrome-sum-u32-v1/preregistration.json"),
  );
  const corpusId = `m1-${permit.permitId}`;
  const state = {
    cold: { attempted: 0, js: [] as number[], wasm: [] as number[], terminal: "continue" },
    warm: { attempted: 0, js: [] as number[], wasm: [] as number[], terminal: "continue" },
  };
  const blocks: Array<{ blockId: string; status: "committed" | "blocked"; sha256: string | null }> =
    [];
  try {
    for (let index = 0; index < prereg.pairing.schedule.length; index += 1) {
      const scheduled = prereg.pairing.schedule[index];
      const stratum = scheduled.stratum as "cold" | "warm";
      const cell = state[stratum];
      if (cell.terminal !== "continue") continue;
      if (state.cold.attempted + state.warm.attempted >= permit.maximumLaunches) break;
      cell.attempted += 1;
      const manifest: LaunchManifest = {
        experimentId: "m1-chrome-sum-u32-v1",
        corpusId,
        blockId: scheduled.blockId,
        scheduleIndex: index,
        stratum,
        order: scheduled.order,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      };
      const result = await collectOwnedBlock(permit, manifest);
      cell.js.push(result.jsMedianMs);
      cell.wasm.push(result.wasmMedianMs);
      blocks.push({ blockId: manifest.blockId, status: "committed", sha256: result.blockSha256 });
      if ([20, 30, 40, 50, 60].includes(cell.attempted)) {
        const evaluation = evaluateAttemptCheckpoint(
          {
            attempted: cell.attempted,
            committed: cell.js.length,
            failedCorrectness: 0,
            failedMeasurement: 0,
            blockedContainment: 0,
            blockedCache: 0,
            blockedProvenance: 0,
          },
          cell.js,
          cell.wasm,
        );
        cell.terminal = evaluation.terminal;
      }
    }
    const attempted = state.cold.attempted + state.warm.attempted;
    const committed = state.cold.js.length + state.warm.js.length;
    const status =
      state.cold.terminal === "precision-met" && state.warm.terminal === "precision-met"
        ? "precision-met"
        : "cap-inconclusive";
    const corpus = {
      schemaVersion: 1,
      corpusId,
      experimentId: "m1-chrome-sum-u32-v1",
      permitDigest,
      planned: 120,
      attempted,
      committed,
      failed: 0,
      blocked: 0,
      unstarted: 120 - attempted,
      blocks,
      status,
    };
    const artifact = await writeImmutableArtifact(
      `raw/corpora/${corpusId}/corpus.json`,
      canonicalize(corpus) + "\n",
    );
    return { ...corpus, corpusSha256: artifact.sha256 };
  } catch (error) {
    const failure = {
      schemaVersion: 1,
      corpusId,
      status: "containment-blocked",
      error: error instanceof Error ? error.message : String(error),
      attempted: state.cold.attempted + state.warm.attempted,
      blocks,
    };
    await writeImmutableArtifact(
      `raw/corpora/${corpusId}/containment-failure.json`,
      canonicalize(failure) + "\n",
    ).catch(() => {});
    throw error;
  }
}

async function dryFake() {
  const root = await Deno.makeTempDir();
  try {
    const coordinator = new CorpusCoordinator(root);
    const manifest = {
      experimentId: "m1-chrome-sum-u32-v1" as const,
      corpusId: "dry-fake",
      blockId: "block-000",
      scheduleIndex: 0,
      stratum: "cold" as const,
      order: ["js-controlled", "wasm-linear-controlled"] as PairInput["order"],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const token = coordinator.issue(manifest);
    coordinator.lookup(token);
    const records = [{
      variantId: "js-controlled" as const,
      payloadSha256: "a".repeat(64),
      medianMs: 10,
      samples: [10, 11],
    }, {
      variantId: "wasm-linear-controlled" as const,
      payloadSha256: "b".repeat(64),
      medianMs: 5,
      samples: [5, 6],
    }];
    const result = await coordinator.commit(token, {
      schemaVersion: 1,
      corpusId: "dry-fake",
      blockId: "block-000",
      experimentId: "m1-chrome-sum-u32-v1",
      scheduleIndex: 0,
      stratum: "cold",
      order: ["js-controlled", "wasm-linear-controlled"],
      records,
      launchEvidenceSha256: "c".repeat(64),
      cleanup: { complete: true, remainingPids: [], profileRemoved: true },
    });
    return { committed: true, artifactSha256: result.sha256 };
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

if (import.meta.main) {
  const check = await preflight();
  if (args.has("--dry-run-fake")) {
    console.log(JSON.stringify({ preflight: check, dryFake: await dryFake() }));
  } else if (args.has("--consume-permit")) {
    if (!permitPath) throw new Error("--permit required");
    const value = JSON.parse(await Deno.readTextFile(permitPath));
    const permit = validatePermit(value, { sourceCommit });
    const receipt = await consumePermit(permitPath, "raw/permits", { sourceCommit });
    console.log(JSON.stringify({
      preflight: check,
      consumed: receipt.digest,
      permitId: permit.permitId,
      next: "permit consumed; no retry or second invocation is permitted",
    }));
  } else if (args.has("--collect-all")) {
    if (!permitPath) throw new Error("--permit required");
    const permit = validatePermit(JSON.parse(await Deno.readTextFile(permitPath)), {
      sourceCommit,
      operation: "collect-uninstrumented-headline-paired-corpus",
      maximumLaunches: 120,
    });
    const receipt = await consumePermit(permitPath, "raw/permits", permit);
    console.log(JSON.stringify(await collectAll(permit, receipt.digest)));
  } else if (args.has("--collect-one")) {
    if (!permitPath || !manifestPath) throw new Error("--permit and --manifest required");
    const permit = validatePermit(JSON.parse(await Deno.readTextFile(permitPath)), {
      sourceCommit,
      operation: "pilot-m1-corpus",
    });
    await consumePermit(permitPath, "raw/permits", permit);
    const manifest = JSON.parse(await Deno.readTextFile(manifestPath)) as LaunchManifest;
    console.log(JSON.stringify(await collectOwnedBlock(permit, manifest)));
  } else {
    console.log(JSON.stringify({
      preflight: check,
      permit: permitPath
        ? validatePermit(JSON.parse(await Deno.readTextFile(permitPath)), { sourceCommit })
        : "not supplied",
      noBrowserLaunched: true,
    }));
  }
}

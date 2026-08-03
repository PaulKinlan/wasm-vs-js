import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import {
  ARCHIVE_ZIP_BROWSER_POLICY,
  ARCHIVE_ZIP_SCENARIOS,
  ARCHIVE_ZIP_SOURCE_PATHS,
  assertArchiveZipScenarioSemantics,
  parseArchiveZipVisibleResult,
} from "../lib/archive-zip-browser-evidence.ts";
import { assert, assertEquals } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats =
  (addFormatsModule as unknown as { default?: (ajv: AjvInstance) => void }).default ??
    addFormatsModule as unknown as (ajv: AjvInstance) => void;
const sha = "a".repeat(64);
const commit = "b".repeat(40);

function fullCounters(target: "javascript" | "wasm") {
  return {
    entries: 10_000,
    inputBytes: 1_038_404,
    crcBytes: 1_038_404,
    deflateLiterals: 427_105,
    deflateMatches: 7_501,
    deflateMatchedBytes: 611_299,
    deflateEndSymbols: 10_000,
    localHeaders: 10_000,
    centralHeaders: 10_000,
    zip64Records: 0,
    listedEntries: 10_000,
    extractedEntries: 10,
    extractedBytes: 905,
    boundaryCrossings: target === "wasm" ? 3 : 0,
    ...(target === "wasm" ? { zipBytes: 1_710_792 } : {}),
  };
}
function boundedCounters(target: "javascript" | "wasm") {
  return {
    entries: 1_000,
    inputBytes: 99_999,
    crcBytes: 99_999,
    deflateLiterals: 1,
    deflateMatches: 1,
    deflateMatchedBytes: 1,
    deflateEndSymbols: 1_000,
    localHeaders: 1_000,
    centralHeaders: 1_000,
    zip64Records: 0,
    listedEntries: 1_000,
    extractedEntries: 4,
    extractedBytes: 100,
    boundaryCrossings: target === "wasm" ? 3 : 0,
    ...(target === "wasm" ? { zipBytes: 100_000 } : {}),
  };
}
function artifact(name: string) {
  return {
    path: `artifacts/archive-zip-browser-evidence/${commit}/raw/${name}`,
    bytes: 10,
    sha256: sha,
  };
}
function result(target: "javascript" | "wasm", mode: "full" | "bounded") {
  return {
    mode,
    target,
    entryCount: mode === "full" ? 10_000 : 1_000,
    hashes: mode === "full"
      ? {
        archiveSha256: "5838f8e2ebe9db24e2c21131425d8bd7de517c1263b45090947d87c28b7afee8",
        listingSha256: "0fe8c100fe59cef8c3120a200f57101cc9ea9a6a77672bd8e35cddd483424478",
        extractedSha256: "d91c23bc264f65c087bc9b848b8becee1424decbcfb5c92fd26aa669328bfb4c",
      }
      : { archiveSha256: sha, listingSha256: sha, extractedSha256: sha },
    counters: mode === "full" ? fullCounters(target) : boundedCounters(target),
  };
}
function network(id: string, ordinal: number) {
  return {
    requestId: String(ordinal),
    sessionId: "page-session",
    source: "page",
    url: `http://127.0.0.1:8123/${ordinal}`,
    method: "GET",
    type: "Document",
    initiator: "other",
    response: {
      status: 200,
      mimeType: "text/html",
      protocol: "http/1.1",
      fromDiskCache: false,
      fromServiceWorker: false,
    },
    end: { encodedDataLength: 10, failed: false, errorText: null, blockedReason: null },
    raw: artifact(`${id}/network-${ordinal}.bin`),
  };
}
function scenarioCheckpoints(kind: string, id: string) {
  const labels: Record<string, string[]> = {
    complete: ["ready", "started", "completed"],
    "wrong-token": ["ready", "started", "wrong-token-ignored", "wrong-token-cleanup"],
    stale: ["ready", "started", "stale-completion-ignored", "stale-cleanup"],
    restart: ["ready", "started", "restart-replaced-worker", "restart-cleanup"],
    timeout: ["ready", "started", "timeout-terminated"],
    cancel: ["ready", "started", "cancel-terminated"],
    pagehide: ["ready", "started", "pagehide-terminated"],
    "closed-negative": ["ready", "closed-negative-rejected"],
  };
  return labels[kind].map((label, sequence, all) => ({
    sequence,
    label,
    monotonicMs: sequence + 1,
    status: label === "wrong-token-ignored" ? "Running the reduced 1,000-entry demo…" : "done",
    output: label === "closed-negative-rejected"
      ? (id === "unknown-target" ? "unknown target" : "unknown demo mode")
      : "",
    workerCount: ["stale-completion-ignored", "restart-replaced-worker"].includes(label) ? 2 : 1,
    terminatedWorkers: ["stale-completion-ignored", "restart-replaced-worker"].includes(label) ||
        (["timeout", "cancel", "pagehide"].includes(kind) && sequence === all.length - 1)
      ? 1
      : 0,
  }));
}

function evidenceFixture() {
  const requestedArguments = [
    "--user-data-dir=/tmp/wasm-vs-js-owned-profiles/test/profile",
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    ...ARCHIVE_ZIP_BROWSER_POLICY.extraArguments,
    "about:blank",
  ];
  return {
    schemaVersion: 1,
    evidenceId: `archive-zip-workspace-browser-${commit}-v1`,
    collectedAt: "2026-08-03T00:00:00.000Z",
    source: {
      commit,
      tree: commit,
      graphSha256: sha,
      files: ARCHIVE_ZIP_SOURCE_PATHS.map((path) => ({ path, bytes: 1, sha256: sha })),
    },
    collector: {
      command: "deno task --config deno.corpus.json browser:collect-archive-zip",
      startedAt: "2026-08-03T00:00:00.000Z",
      endedAt: "2026-08-03T00:01:00.000Z",
      setupCleanupProtected: true,
      performanceEvidence: false,
    },
    browser: {
      channel: "chrome-for-testing",
      productName: "Google Chrome for Testing",
      version: "150.0.7871.24",
      cdpProduct: "Chrome/150.0.7871.24",
      revision: "r1",
      userAgent: "ua",
      jsVersion: "v8",
      sourceBinary: ARCHIVE_ZIP_BROWSER_POLICY.sourceBinary,
      resolvedStagedBinary: "/tmp/wasm-vs-js-staged-chrome/test/chrome",
      binarySha256: ARCHIVE_ZIP_BROWSER_POLICY.binarySha256,
      packageManifestSha256: ARCHIVE_ZIP_BROWSER_POLICY.packageManifestSha256,
      packageFileCount: 303,
      requestedArguments,
      effectiveArguments: requestedArguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
    },
    server: {
      origin: "http://127.0.0.1:8123",
      mode: "public",
      process: { pid: 100, parentPid: 1, startTimeTicks: "200", executable: "/usr/bin/deno" },
    },
    scenarios: ARCHIVE_ZIP_SCENARIOS.map((scenario) => ({
      ...scenario,
      route: "/benchmarks/archive-zip-workspace-v1/",
      targetOwnership: {
        targetId: `target-${scenario.id}`,
        pageSessionId: "page-session",
        childTargets: [],
      },
      source: artifact(`${scenario.id}/source.html`),
      end: artifact(`${scenario.id}/end.html`),
      checkpoints: scenarioCheckpoints(scenario.kind, scenario.id),
      result: scenario.kind === "complete" ? result(scenario.target, scenario.mode) : null,
      assertions: ["first", "second"],
      console: [],
      exceptions: [],
      network: [network(scenario.id, 0), network(scenario.id, 1), network(scenario.id, 2)],
      accessibility: {
        source: artifact(`${scenario.id}/source-ax.json`),
        end: artifact(`${scenario.id}/end-ax.json`),
      },
      screenshots: {
        source: artifact(`${scenario.id}/source.png`),
        end: artifact(`${scenario.id}/end.png`),
      },
    })),
    ownership: {
      systemdUnit: "wasm-vs-js-1234567890abcdef.service",
      controlGroup: "/user.slice/test.service",
      cgroupPath: "/sys/fs/cgroup/user.slice/test.service",
      cgroupDev: 1,
      cgroupIno: 2,
      invocationId: "c".repeat(32),
      mainPid: 101,
      commandLine: ["/tmp/chrome", ...requestedArguments],
      membershipSnapshots: [
        { collectedAt: "2026-08-03T00:00:00.000Z", members: [101] },
        { collectedAt: "2026-08-03T00:01:00.000Z", members: [101, 102] },
      ],
      allTargetSessionsOwned: true,
    },
    cleanup: {
      browser: {
        cgroupKilled: true,
        remaining: [],
        identityMismatches: [],
        stoppedAt: "2026-08-03T00:01:00.000Z",
      },
      profile: { path: "/tmp/wasm-vs-js-owned-profiles/test/profile", absent: true },
      stage: {
        path: "/tmp/wasm-vs-js-staged-chrome/test",
        lifecycle: "cleanup-verified",
        absent: true,
      },
      server: {
        identityMatched: true,
        signal: "SIGTERM",
        processAbsent: true,
        exit: { success: false, code: 143, signal: "SIGTERM" },
      },
      candidatePublished: true,
    },
  };
}

Deno.test("archive ZIP browser evidence schema is closed and accepts the exact twelve-scenario contract", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/archive-zip-browser-evidence.schema.json"),
  );
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const evidence = evidenceFixture();
  assert(validate(evidence), JSON.stringify(validate.errors));
  assertArchiveZipScenarioSemantics(evidence);
  assertEquals(
    evidence.scenarios.map((scenario) => scenario.id),
    ARCHIVE_ZIP_SCENARIOS.map((scenario) => scenario.id),
  );
  assertEquals(evidence.scenarios.filter((scenario) => scenario.kind === "complete").length, 4);
});

Deno.test("archive ZIP semantic gate rejects denominator, full work, hashes, bytes, counters, network and partial negative results", () => {
  const mutations: Array<(value: ReturnType<typeof evidenceFixture>) => void> = [
    (value) => value.browser.requestedArguments.splice(7, 1),
    (value) => value.scenarios.pop(),
    (value) => value.scenarios[0].result!.entryCount = 9_999,
    (value) => value.scenarios[0].result!.hashes.archiveSha256 = sha,
    (value) => value.scenarios[0].result!.counters.extractedEntries = 9,
    (value) => delete value.scenarios[1].result!.counters.zipBytes,
    (value) => value.scenarios[2].result!.counters.listedEntries = 999,
    (value) => value.scenarios[3].result!.counters.extractedEntries = 3,
    (value) => value.scenarios[4].network[0].end.failed = true,
    (value) => value.scenarios[4].network[1].url = "http://127.0.0.1:9999/wrong-origin",
    (value) => value.scenarios[5].checkpoints[1].sequence = 9,
    (value) => value.scenarios[8].result = result("javascript", "bounded"),
    (value) => (value.scenarios[10] as { id: string }).id = "open-target",
  ];
  for (const mutate of mutations) {
    const value = evidenceFixture();
    mutate(value);
    let rejected = false;
    try {
      assertArchiveZipScenarioSemantics(value);
    } catch {
      rejected = true;
    }
    assert(rejected, `semantic mutation ${mutations.indexOf(mutate)} was accepted`);
  }
});

Deno.test("archive ZIP collector pins CfT package/version/automation and protects owned cleanup", async () => {
  assertEquals(ARCHIVE_ZIP_BROWSER_POLICY.version, "150.0.7871.24");
  assertEquals(
    ARCHIVE_ZIP_BROWSER_POLICY.binarySha256,
    "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
  );
  assertEquals(
    ARCHIVE_ZIP_BROWSER_POLICY.packageManifestSha256,
    "e3d5088a5244a494b206819630d4eb2d7e3ee999d1a04cab9d2d95d0daf292db",
  );
  assert(ARCHIVE_ZIP_BROWSER_POLICY.extraArguments.includes("--enable-automation"));
  const collector = await Deno.readTextFile("scripts/collect-archive-zip-browser-evidence.ts");
  const contract = await Deno.readTextFile("lib/archive-zip-browser-evidence.ts");
  const implementation = `${collector}\n${contract}`;
  for (
    const required of [
      "inspectChromePackage",
      "stageChromePackage",
      "launchOwnedChrome",
      "refreshLedger",
      "recordStageCleanupLifecycle",
      "closeOwnedChrome",
      "removeStagedChrome",
      "finally",
      "Target.setAutoAttach",
      "Network.getResponseBody",
      "Runtime.consoleAPICalled",
      "Runtime.exceptionThrown",
      "Accessibility.getFullAXTree",
      "Page.captureScreenshot",
      "wrong-token",
      "stale-completion",
      "restart",
      "timeout",
      "cancel",
      "pagehide",
      "unknown-target",
      "unknown-mode",
    ]
  ) assert(implementation.includes(required), `collector omitted ${required}`);
  assert(
    !collector.includes("Browser.close"),
    "collector must clean the cgroup before closing CDP",
  );
});

Deno.test("archive ZIP visible result retains output hashes and every counter while collector retains raw response bytes", async () => {
  const counters = fullCounters("wasm");
  const text =
    `Mode: full\nTarget: wasm\nEntries: 10000\nArchive SHA-256: 5838f8e2ebe9db24e2c21131425d8bd7de517c1263b45090947d87c28b7afee8\nListing SHA-256: 0fe8c100fe59cef8c3120a200f57101cc9ea9a6a77672bd8e35cddd483424478\nExtracted SHA-256: d91c23bc264f65c087bc9b848b8becee1424decbcfb5c92fd26aa669328bfb4c\nCounters: ${
      JSON.stringify(counters, null, 2)
    }`;
  assertEquals(parseArchiveZipVisibleResult(text), result("wasm", "full"));
  const collector = await Deno.readTextFile("scripts/collect-archive-zip-browser-evidence.ts");
  assert(collector.includes("Network.getResponseBody"));
  assert(collector.includes("verifyRawArtifacts(evidence.scenarios)"));
});

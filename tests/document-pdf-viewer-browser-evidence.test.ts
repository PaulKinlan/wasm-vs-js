import Ajv2020Module from "ajv2020";
import {
  ACCEPTED_PARENT_COMMIT,
  ACCEPTED_PARENT_TREE,
  assertBrowserContract,
  EXPECTED_HITS,
  EXPECTED_RASTER_HASHES,
  EXPECTED_RASTER_PAGES,
  EXPECTED_TEXT_SHA256,
  expectedCounters,
  parseDisplayedResult,
  parseOptions,
  SCENARIO_CONTRACT,
  STATIC_LAUNCH_ARGUMENTS,
  validateEvidenceSemantics,
} from "../scripts/collect-document-pdf-viewer-browser-evidence.ts";
import { assert, assertEquals } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const HASH = "1".repeat(64);
const OTHER_HASH = "2".repeat(64);
const GIT = "3".repeat(40);
const BLOB = "4".repeat(40);
const DATE = "2026-08-03T12:00:00.000Z";
const ORIGIN = "http://127.0.0.1:43123";
const PROFILE = "/tmp/wasm-document-pdf-viewer-chrome-fixture";
const CHROME_HASH = "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";

function launchArguments() {
  return [
    ...STATIC_LAUNCH_ARGUMENTS,
    "--remote-debugging-port=43124",
    `--user-data-dir=${PROFILE}`,
    "about:blank",
  ];
}

function result(target: "javascript" | "wasm-linear") {
  const pageHashes = EXPECTED_RASTER_PAGES.map((page, index) => ({
    page,
    sha256: EXPECTED_RASTER_HASHES[index],
  }));
  const rawText = [
    `Target: ${target}`,
    "Pages parsed: 100",
    `Search hit pages: ${EXPECTED_HITS.join(", ")}`,
    `Complete extracted-text SHA-256: ${EXPECTED_TEXT_SHA256}`,
    `Selected page 1 RGBA SHA-256: ${EXPECTED_RASTER_HASHES[0]}`,
    `All five raster hashes: ${JSON.stringify(pageHashes, null, 2)}`,
    `Counters: ${JSON.stringify(expectedCounters(target), null, 2)}`,
  ].join("\n");
  return {
    rawText,
    target,
    pageCount: 100,
    hits: [...EXPECTED_HITS],
    textSha256: EXPECTED_TEXT_SHA256,
    selectedPage: 1,
    selectedRgbaSha256: EXPECTED_RASTER_HASHES[0],
    pageHashes,
    counters: expectedCounters(target),
  };
}

function process(pid: number) {
  return { pid, parentPid: 1, startTimeTicks: String(pid * 100), executable: "/cft/chrome" };
}

function sourceFiles() {
  const entries = [
    ["/benchmarks/document-pdf-viewer-v1/", "public/benchmarks/document-pdf-viewer-v1/index.html"],
    ["/styles.css", "public/styles.css"],
    [
      "/benchmarks/document-pdf-viewer-v1/runner.js",
      "public/benchmarks/document-pdf-viewer-v1/runner.js",
    ],
    [
      "/benchmarks/document-pdf-viewer-v1/worker.js",
      "public/benchmarks/document-pdf-viewer-v1/worker.js",
    ],
    [
      "/benchmarks/base/document-pdf-viewer/engine.js",
      "benchmarks/base/document-pdf-viewer/engine.js",
    ],
    [
      "/artifacts/document-pdf-viewer/report-100-pages.pdf",
      "public/artifacts/document-pdf-viewer/report-100-pages.pdf",
    ],
    [
      "/artifacts/document-pdf-viewer/pdf-engine.wasm",
      "public/artifacts/document-pdf-viewer/pdf-engine.wasm",
    ],
    ["/favicon.ico", "public/favicon.svg"],
  ];
  return entries.map(([route, path], index) => ({
    route,
    path,
    bytes: 100 + index,
    sha256: index === 5
      ? "2386b4ae40ea64903c16517e796546f2bfca7b7e8d8746f1cf1622bf25cd25c4"
      : String(index + 1).repeat(64),
    gitBlob: String(index + 1).repeat(40),
    acceptedCommitBytesMatch: true,
  }));
}

type SourceFile = ReturnType<typeof sourceFiles>[number];

function scenario(
  definition: (typeof SCENARIO_CONTRACT)[number],
  files: SourceFile[],
) {
  const resourceNegative = ["resource-key", "font-key", "font-nesting"].includes(definition.mode);
  const completedTargets = definition.id === "restart"
    ? definition.targets.map((target) => result(target))
    : ["complete-javascript", "complete-wasm", "wrong-token", "stale-after-restart"].includes(
        definition.id,
      )
    ? [result(definition.targets.at(-1)!)]
    : [];
  const sessions = [
    {
      sessionId: `${definition.id}-page`,
      targetId: `${definition.id}-page-target`,
      type: "page",
      parentSessionId: null,
    },
    {
      sessionId: `${definition.id}-worker`,
      targetId: `${definition.id}-worker-target`,
      type: "worker",
      parentSessionId: `${definition.id}-page`,
    },
  ];
  const event = (kind: string, detail: Record<string, unknown>, worker = false) => ({
    kind,
    detail,
    sessionId: worker ? sessions[1].sessionId : sessions[0].sessionId,
    targetId: worker ? sessions[1].targetId : sessions[0].targetId,
  });
  const pageSource = files[0];
  const network = Array.from({ length: 3 }, (_, index) => ({
    requestId: `${definition.id}-${index}`,
    sessionId: sessions[0].sessionId,
    targetId: sessions[0].targetId,
    targetType: "page",
    url: `${ORIGIN}${pageSource.route}`,
    method: "GET",
    resourceType: "Document",
    status: 200,
    mimeType: "text/html",
    headers: [],
    fromDiskCache: false,
    fromServiceWorker: false,
    failed: false,
    errorText: null,
    body: {
      status: "supported",
      bytes: pageSource.bytes,
      sha256: pageSource.sha256,
      sourcePath: pageSource.path,
      gitBlob: pageSource.gitBlob,
      cdpEncoding: "utf8",
    },
  }));
  const executedSources = Array.from({ length: 3 }, () => ({
    sessionId: sessions[0].sessionId,
    targetId: sessions[0].targetId,
    targetType: "page",
    url: `${ORIGIN}${pageSource.route}`,
    sourcePath: pageSource.path,
    bytes: pageSource.bytes,
    sha256: pageSource.sha256,
    gitBlob: pageSource.gitBlob,
  }));
  const mutation = resourceNegative
    ? event("resource-mutation", {
      id: definition.mode,
      url: `${ORIGIN}/artifacts/document-pdf-viewer/report-100-pages.pdf`,
      bytes: files[5].bytes,
      originalSha256: files[5].sha256,
      mutatedSha256: OTHER_HASH,
      changedOffset: 100,
    }, true)
    : null;
  const executionEvents: Array<ReturnType<typeof event>> = [];
  if (resourceNegative || completedTargets.length) {
    executionEvents.push(event("fetched-body", {
      url: `${ORIGIN}/artifacts/document-pdf-viewer/report-100-pages.pdf`,
      bytes: files[5].bytes,
      sha256: files[5].sha256,
    }, true));
  }
  if (mutation) executionEvents.push(mutation);
  if (resourceNegative && (definition.targets as readonly string[]).includes("wasm-linear")) {
    executionEvents.push(event("fetched-body", {
      url: `${ORIGIN}/artifacts/document-pdf-viewer/pdf-engine.wasm`,
      bytes: files[6].bytes,
      sha256: files[6].sha256,
    }, true));
    executionEvents.push(event("wasm-instantiated", {
      bytes: files[6].bytes,
      sha256: files[6].sha256,
      base64: btoa("x".repeat(files[6].bytes)),
    }, true));
  }
  for (const completed of completedTargets) {
    for (const sha256 of EXPECTED_RASTER_HASHES) {
      executionEvents.push(event("digest-input", {
        algorithm: "SHA-256",
        bytes: 1224 * 1584 * 4,
        sha256,
      }, true));
    }
    executionEvents.push(event("digest-input", {
      algorithm: "SHA-256",
      bytes: 3569,
      sha256: EXPECTED_TEXT_SHA256,
    }, true));
    if (completed.target === "wasm-linear") {
      executionEvents.push(event("wasm-instantiated", {
        bytes: files[6].bytes,
        sha256: files[6].sha256,
        base64: btoa("x".repeat(files[6].bytes)),
      }, true));
    }
  }
  return {
    id: definition.id,
    mode: definition.mode,
    targetSequence: [...definition.targets],
    ownership: {
      browserContextId: "context",
      pageTargetId: sessions[0].targetId,
      pageSessionId: sessions[0].sessionId,
      sessions,
    },
    statusHistory: ["Ready.", resourceNegative ? "Failed." : "Complete."],
    finalState: {
      heading: "Parse, search and raster a 100-page report",
      status: resourceNegative ? "Failed." : "Complete.",
      result: resourceNegative
        ? "page font resources missing"
        : completedTargets[0]?.rawText ?? "No result retained.",
      bodyText: "Complete accessible textual page output",
      startDisabled: false,
      cancelDisabled: true,
      target: definition.targets.at(-1),
      page: 1,
      statuses: ["Ready.", resourceNegative ? "Failed." : "Complete."],
    },
    completedTargets,
    rejection: resourceNegative
      ? {
        mutation: definition.mode,
        target: definition.targets[0],
        rejected: true,
        errorText: "page font resources missing",
      }
      : null,
    causal: {
      wrongTokenIgnored: definition.id === "wrong-token",
      staleResultAndErrorIgnored: definition.id === "stale-after-restart",
      freshWorkers: definition.id === "restart",
      timeoutTerminated: definition.id === "timeout",
      cancelTerminated: definition.id === "cancel",
      pagehideTerminated: definition.id === "pagehide",
      resourceMutationRejected: resourceNegative,
    },
    assertions: ["causal visible-control assertion retained"],
    lifecycleEvents: [
      event("instrumentation-ready", { mode: definition.mode }),
      event("worker-created", { index: 0, url: "/benchmarks/document-pdf-viewer-v1/worker.js" }),
      event("worker-terminated", { index: 0 }),
    ],
    executionEvents,
    console: [],
    exceptions: [],
    network,
    executedSources,
    accessibility: {
      inspectedBy: "Accessibility.getFullAXTree",
      nodes: [{
        role: "heading",
        name: "Parse, search and raster a 100-page report",
        ignored: false,
      }],
      treeSha256: HASH,
      assertions: {
        headingPresent: true,
        targetPresent: true,
        startPresent: true,
        cancelPresent: true,
        statusPresent: true,
        textualOutputPresent: true,
      },
    },
    screenshot: { path: `screenshots/${definition.id}.png`, bytes: 1000, sha256: HASH },
  };
}

function fixture() {
  const files = sourceFiles();
  const args = launchArguments();
  return {
    schemaVersion: 1,
    workload: "document.pdf-viewer.v1",
    evidenceId: `document-pdf-viewer-browser-${GIT.slice(0, 12)}`,
    collectedAt: DATE,
    authority: {
      kind: "authoritative-parent-run-browser-collection",
      browserWasLaunchedByCollector: true,
      importedOrChildGeneratedEvidenceAccepted: false,
    },
    collection: {
      script: "scripts/collect-document-pdf-viewer-browser-evidence.ts",
      command:
        "deno run -A scripts/collect-document-pdf-viewer-browser-evidence.ts --chrome=/cft/chrome --output-dir=/tmp/pdf-evidence",
      outputDirectory: "/tmp/pdf-evidence",
    },
    source: {
      head: GIT,
      tree: BLOB,
      acceptedParentCommit: ACCEPTED_PARENT_COMMIT,
      acceptedParentTree: ACCEPTED_PARENT_TREE,
      root: "/repo",
      initialClean: true,
      collector: {
        path: "scripts/collect-document-pdf-viewer-browser-evidence.ts",
        bytes: 1000,
        sha256: HASH,
        headBytesMatch: true,
      },
      files,
      oracle: {
        path: "public/artifacts/document-pdf-viewer/output-manifest.json",
        bytes: 1000,
        sha256: HASH,
        acceptedCommitBytesMatch: true,
      },
      endRecheck: {
        status: "clean",
        head: GIT,
        tree: BLOB,
        filesMatch: true,
        oracleMatches: true,
        collectorMatches: true,
        checkedAt: DATE,
      },
    },
    browser: {
      product: "Chrome/150.0.7871.24",
      revision: "r1",
      userAgent: "CfT",
      jsVersion: "15",
      executable: { path: "/cft/chrome", bytes: 281758968, sha256: CHROME_HASH },
      launchArguments: args,
      effectiveArguments: ["/cft/chrome", ...args],
      headless: true,
      protocol: "Chrome DevTools Protocol",
      debuggerOrigin: "http://127.0.0.1:43124",
      debuggerListener: { socketInode: "999", ownedPid: 100, cgroupOwned: true },
      profile: { path: PROFILE, dev: 1, ino: 2, mode: 448, initiallyEmpty: true },
      cgroup: {
        unit: "wasm-document-pdf-viewer-1234567890abcdef.service",
        path: "/sys/fs/cgroup/user.slice/test.service",
        dev: 1,
        ino: 3,
        controlGroup: "/user.slice/test.service",
        invocationId: "a".repeat(32),
        mainPid: 100,
        snapshots: Array.from({ length: 15 }, () => ({ at: DATE, pids: [100] })),
      },
      processes: [process(100)],
    },
    server: { origin: ORIGIN, host: "127.0.0.1", mode: "public", launcher: process(200) },
    scenarios: SCENARIO_CONTRACT.map((definition) => scenario(definition, files)),
    cleanup: {
      sessionTargets: {
        outcome: "success",
        browserContextId: "context",
        targetsBefore: [],
        targetsAfter: [],
      },
      cgroup: { outcome: "success", killed: true, remainingPids: [] },
      browserProcesses: { outcome: "success", remainingPids: [] },
      profile: { outcome: "success", path: PROFILE, absent: true },
      server: { outcome: "success", processAbsent: true },
      output: { outcome: "success", path: "/tmp/pdf-evidence", retained: true },
    },
  };
}

async function validator() {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/document-pdf-viewer-browser-evidence.schema.json"),
  );
  return new Ajv2020({ strict: false, allErrors: true, formats: { "date-time": true } }).compile(
    schema,
  );
}

Deno.test("PDF browser collector freezes exact CfT hash and argument vector", () => {
  const args = launchArguments();
  assertBrowserContract("Chrome/150.0.7871.24", CHROME_HASH, args, ["/cft/chrome", ...args]);
  assert(args.includes("--enable-automation"));
  for (
    const mutate of [
      () => assertBrowserContract("Chrome/151.0.0.0", CHROME_HASH, args, args),
      () => assertBrowserContract("Chrome/150.0.7871.24", HASH, args, args),
      () => assertBrowserContract("Chrome/150.0.7871.24", CHROME_HASH, args.slice(1), args),
      () => assertBrowserContract("Chrome/150.0.7871.24", CHROME_HASH, args, args.slice(1)),
    ]
  ) {
    let rejected = false;
    try {
      mutate();
    } catch {
      rejected = true;
    }
    assert(rejected);
  }
  assertEquals(parseOptions(["--chrome=/cft/chrome", "--output-dir=/tmp/new"]), {
    chrome: "/cft/chrome",
    outputDir: "/tmp/new",
  });
});

Deno.test("visible PDF output parser retains all pages, hits, rasters, text and counters", () => {
  for (const target of ["javascript", "wasm-linear"] as const) {
    assertEquals(parseDisplayedResult(result(target).rawText), result(target));
  }
});

Deno.test("closed PDF browser schema accepts the exact fourteen-scenario parent record", async () => {
  const validate = await validator();
  const value = fixture();
  assert(validate(value), JSON.stringify(validate.errors));
  validateEvidenceSemantics(value);
  assertEquals(
    value.scenarios.map((entry) => entry.id),
    SCENARIO_CONTRACT.map((entry) => entry.id),
  );
});

Deno.test("PDF browser evidence rejects source, byte, result, lifecycle and cleanup contradictions", async () => {
  const validate = await validator();
  const mutations: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => Object.assign(value, { fabricated: true }),
    (value) => value.source.acceptedParentCommit = "0".repeat(40),
    (value) => value.source.acceptedParentTree = "0".repeat(40),
    (value) => value.source.endRecheck.status = "dirty",
    (value) => value.source.endRecheck.head = "0".repeat(40),
    (value) => value.source.files[1].route = value.source.files[0].route,
    (value) => value.browser.product = "Chrome/151.0.0.0",
    (value) => value.browser.executable.sha256 = HASH,
    (value) => value.browser.launchArguments[0] = "--not-automation",
    (value) => value.browser.debuggerListener.ownedPid = 999,
    (value) => value.scenarios.reverse(),
    (value) => value.scenarios[0].network[0].body.sha256 = OTHER_HASH,
    (value) => value.scenarios[0].network[0].sessionId = "foreign-session",
    (value) => value.scenarios[0].executedSources[0].sha256 = OTHER_HASH,
    (value) => value.scenarios[0].completedTargets[0].pageCount = 99,
    (value) => value.scenarios[1].completedTargets[0].hits.pop(),
    (value) => value.scenarios[1].completedTargets[0].pageHashes[0].sha256 = OTHER_HASH,
    (value) => value.scenarios[1].completedTargets[0].counters.boundaryCrossings = 0,
    (value) => value.scenarios[2].rejection = null,
    (value) =>
      value.scenarios[2].executionEvents[1].detail.mutatedSha256 =
        value.scenarios[2].executionEvents[1].detail.originalSha256,
    (value) => value.scenarios[8].causal.wrongTokenIgnored = false,
    (value) => value.scenarios[9].causal.staleResultAndErrorIgnored = false,
    (value) => value.scenarios[10].causal.freshWorkers = false,
    (value) =>
      (value.scenarios[0].exceptions as Array<Record<string, unknown>>).push({
        sessionId: value.scenarios[0].ownership.pageSessionId,
        targetId: value.scenarios[0].ownership.pageTargetId,
        targetType: "page",
        text: "boom",
        lineNumber: 0,
        columnNumber: 0,
      }),
    (value) => value.scenarios[0].accessibility.assertions.textualOutputPresent = false,
    (value) => value.scenarios[0].screenshot.bytes = 0,
    (value) => value.cleanup.cgroup.killed = false,
    (value) => (value.cleanup.browserProcesses.remainingPids as number[]).push(100),
    (value) => value.cleanup.profile.absent = false,
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(fixture());
    mutate(changed);
    const schemaAccepted = validate(changed);
    let semanticAccepted = true;
    try {
      validateEvidenceSemantics(changed);
    } catch {
      semanticAccepted = false;
    }
    assert(!schemaAccepted || !semanticAccepted, "closed schema/semantics accepted contradiction");
  }
});

Deno.test("PDF browser schema closes every declared object", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/document-pdf-viewer-browser-evidence.schema.json"),
  );
  const open: string[] = [];
  const visit = (value: unknown, path: string) => {
    if (!value || typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    if (object.type === "object" && object.additionalProperties !== false) open.push(path);
    for (const [key, child] of Object.entries(object)) visit(child, `${path}/${key}`);
  };
  visit(schema, "#");
  assertEquals(open, []);
});

Deno.test("PDF parent collector owns cgroup/session setup, exhaustive evidence and protected cleanup", async () => {
  const source = await Deno.readTextFile(
    "scripts/collect-document-pdf-viewer-browser-evidence.ts",
  );
  for (
    const required of [
      "/usr/bin/systemd-run",
      "--property=KillMode=control-group",
      "cgroup.kill",
      "Target.createBrowserContext",
      "Target.setAutoAttach",
      "waitForDebuggerOnStart: true",
      "Network.getResponseBody",
      "Debugger.getScriptSource",
      "Runtime.consoleAPICalled",
      "Runtime.exceptionThrown",
      "Accessibility.getFullAXTree",
      "Page.captureScreenshot",
      "resource-mutation",
      "digest-input",
      "wasm-instantiated",
      "source HEAD/tree/bytes changed during browser collection",
      "finally",
    ]
  ) assert(source.includes(required), `collector omitted ${required}`);
  for (const forbidden of ["puppeteer", "playwright", "killall", "Deno.kill(-1"]) {
    assert(
      !source.toLowerCase().includes(forbidden),
      `collector contains forbidden driver/kill: ${forbidden}`,
    );
  }
  assert(!/\bpkill\b/u.test(source), "collector contains forbidden global pkill");
  assert(source.indexOf("server = new Deno.Command") > source.indexOf("  try {"));
  assert(source.indexOf("cgroupKill.write") < source.indexOf("Deno.remove(profilePath"));
});

import { sha256Hex } from "./canonical.ts";

export const CAD_BROWSER_POLICY = {
  evidenceId: "cad-mesh-repair-a86c35e-cft150-v1",
  acceptedCommit: "a86c35eed537b5c8f0fcb9c267d180656eee2181",
  acceptedTree: "ea486c9c7b58ff29da29dbe81ded76ed4c4dda35",
  channel: "chrome-for-testing",
  version: "150.0.7871.24",
  product: "Chrome/150.0.7871.24",
  requestedBinary:
    "/home/paulkinlan/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome",
  binarySha256: "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
  packageManifestSha256: "e3d5088a5244a494b206819630d4eb2d7e3ee999d1a04cab9d2d95d0daf292db",
  route: "/benchmarks/cad-mesh-repair-v1/",
  outputBytes: 19_100,
  outputSha256: "9176fd44b472ec6369d880a0f605c9a1a0c518f4fbe55485da399b5718228309",
  launchArgumentSuffix: [
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--headless=new",
    "--enable-automation",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--metrics-recording-only",
    "--hide-scrollbars",
    "--window-size=1440,1200",
    "about:blank",
  ],
  lifecycle: [
    "collector-started",
    "server-listening",
    "package-inspected",
    "stage-created",
    "profile-reserved",
    "browser-launch-began",
    "browser-connected",
    "page-session-attached",
    "javascript-started",
    "javascript-complete",
    "wasm-started",
    "wasm-complete",
    "browser-cleanup-verified",
    "stage-cleanup-verified",
    "profile-reservation-cleanup-verified",
    "server-stopped",
    "collection-complete",
  ],
} as const;

export const CAD_INVARIANTS = {
  finiteCoordinates: true,
  quantizationScale: 10_000,
  quantizationArithmetic: "f32-multiply-round-half-away-from-zero",
  manifoldEdgeMaximum: 2,
  consistentPositiveZ: true,
  exactTarget: true,
  canonicalLittleEndian: true,
  signedVolumeSixQuantized: 0,
  volumePolicy: "planar open mesh has exact zero signed volume; no watertight-volume claim",
} as const;

const EQUIVALENT_COUNTERS = {
  sourceFaces: 2112,
  vertexReferences: 6336,
  vertexWeldComparisons: 3_351_963,
  weldedVertices: 1089,
  removedDegenerates: 64,
  orientedFaces: 2048,
  flippedFaces: 352,
  cleanEdgeComparisons: 37_748_736,
  simplificationWeldComparisons: 305_168,
  simplifiedEdgeComparisons: 9_437_184,
  uniqueEdges: 1584,
  simplifiedFaces: 1024,
  simplifiedVertices: 561,
  collapsedVertices: 528,
  volumeTerms: 1024,
  targetFaces: 1024,
} as const;

export const CAD_TARGETS = {
  javascript: {
    id: "javascript",
    counters: { ...EQUIVALENT_COUNTERS, boundaryCrossings: 0, operativeAllocations: 9 },
  },
  wasm: {
    id: "wasm",
    counters: { ...EQUIVALENT_COUNTERS, boundaryCrossings: 3, operativeAllocations: 0 },
  },
} as const;

export const CAD_ACCEPTED_ASSETS = {
  "/benchmarks/base/cad-mesh-repair/engine.js":
    "a35593509a9925e97f9ecfef1786f97d9db8f8b3ed4fe560735374ad03657531",
  "/artifacts/cad-mesh-repair-v1/dirty-grid.stl":
    "46fa97b0518e96edd1a2bb01d362955f5fae7f9d3e1371c0056ff17ba7d95a91",
  "/artifacts/cad-mesh-repair-v1/mesh-repair.wasm":
    "ac2f086d3cda9c7ffa8c59caf7121a8b6f131a0bf87718a2390d46c935a63dbf",
} as const;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exact(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} does not match the authoritative CAD browser contract`);
  }
}

function same(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`${label} does not match the authoritative CAD browser contract`);
  }
}

function decodeBase64(value: unknown, label: string): Uint8Array {
  if (typeof value !== "string") throw new Error(`${label} must be base64 text`);
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new Error(`${label} is not valid base64`);
  }
}

export function assertExactCadLaunchArguments(arguments_: unknown, profileRoot: unknown): void {
  if (typeof profileRoot !== "string") throw new Error("profile root is unavailable");
  exact("browser launch arguments", arguments_, [
    `--user-data-dir=${profileRoot}`,
    ...CAD_BROWSER_POLICY.launchArgumentSuffix,
  ]);
}

export async function validateCadBrowserEvidenceSemantics(value: unknown): Promise<void> {
  const evidence = object(value, "evidence");
  same("schema version", evidence.schemaVersion, 1);
  same("evidence identity", evidence.evidenceId, CAD_BROWSER_POLICY.evidenceId);
  same("authoritative status", evidence.status, "authoritative-browser-correctness");
  same("performance claim", evidence.performanceClaim, false);

  const source = object(evidence.source, "source");
  same("accepted source commit", source.acceptedCommit, CAD_BROWSER_POLICY.acceptedCommit);
  same("accepted source tree", source.acceptedTree, CAD_BROWSER_POLICY.acceptedTree);
  same("checkout clean at start", source.cleanAtStart, true);
  same("checkout clean at end", source.cleanAtEnd, true);
  if (!/^[a-f0-9]{40}$/.test(String(source.collectorCommit))) {
    throw new Error("collector commit is not exact git identity");
  }

  const collector = object(evidence.collector, "collector");
  same("parent-run collector", collector.parentRun, true);
  same("collector protocol", collector.protocol, "Chrome DevTools Protocol");
  if (!String(collector.command).includes(`--source-commit=${CAD_BROWSER_POLICY.acceptedCommit}`)) {
    throw new Error("collection command is not accepted-source-bound");
  }
  const collectorProcess = object(collector.process, "collector process");
  if (
    !Number.isSafeInteger(collectorProcess.pid) || Number(collectorProcess.pid) < 2 ||
    !Number.isSafeInteger(collectorProcess.parentPid) ||
    !Number.isSafeInteger(collectorProcess.sessionId) ||
    typeof collectorProcess.startTimeTicks !== "string" ||
    typeof collectorProcess.executable !== "string"
  ) throw new Error("collector process/session identity is incomplete");

  const browser = object(evidence.browser, "browser");
  same("browser channel", browser.channel, CAD_BROWSER_POLICY.channel);
  same("browser version", browser.version, CAD_BROWSER_POLICY.version);
  same("browser product", browser.product, CAD_BROWSER_POLICY.product);
  same("requested CfT binary", browser.requestedBinary, CAD_BROWSER_POLICY.requestedBinary);
  same("browser binary hash", browser.binarySha256, CAD_BROWSER_POLICY.binarySha256);
  same(
    "browser package manifest hash",
    browser.packageManifestSha256,
    CAD_BROWSER_POLICY.packageManifestSha256,
  );

  const ownership = object(evidence.ownership, "ownership");
  const profile = object(ownership.profile, "profile ownership");
  assertExactCadLaunchArguments(browser.launchArguments, profile.path);
  same("profile mode", profile.mode, 448);
  same("profile removed", profile.removed, true);
  same("profile absent", profile.absent, true);
  const stage = object(ownership.stage, "stage ownership");
  same("stage package hash", stage.packageManifestSha256, CAD_BROWSER_POLICY.packageManifestSha256);
  same("stage lifecycle", stage.cleanupLifecycle, "cleanup-verified");
  same("stage removed", stage.removed, true);
  same("stage absent", stage.absent, true);
  const cgroup = object(ownership.cgroup, "cgroup ownership");
  if (
    !String(cgroup.unit).startsWith("wasm-vs-js-") ||
    !String(cgroup.controlGroup).startsWith("/") ||
    !/^[a-f0-9]{32}$/.test(String(cgroup.invocationId)) ||
    !Number.isSafeInteger(cgroup.mainPid) || Number(cgroup.mainPid) < 2
  ) throw new Error("cgroup identity is incomplete");
  const snapshots = cgroup.membershipSnapshots;
  if (!Array.isArray(snapshots) || snapshots.length < 1) {
    throw new Error("cgroup membership was not observed");
  }
  for (const snapshotValue of snapshots) {
    const snapshot = object(snapshotValue, "cgroup membership snapshot");
    if (!Array.isArray(snapshot.members) || !snapshot.members.includes(cgroup.mainPid)) {
      throw new Error("cgroup main PID is absent from membership evidence");
    }
  }
  same("cgroup cleanup", cgroup.cleanupVerified, true);
  exact("cgroup remaining members", cgroup.remainingMembers, []);

  const lifecycle = evidence.lifecycle;
  if (!Array.isArray(lifecycle)) throw new Error("causal lifecycle is unavailable");
  exact(
    "causal lifecycle names",
    lifecycle.map((entry) => object(entry, "lifecycle entry").event),
    CAD_BROWSER_POLICY.lifecycle,
  );
  for (let index = 0; index < lifecycle.length; index++) {
    const entry = object(lifecycle[index], "lifecycle entry");
    same(`lifecycle sequence ${index + 1}`, entry.sequence, index + 1);
    if (typeof entry.at !== "string") throw new Error("lifecycle timestamp is unavailable");
  }

  const scenarios = evidence.scenarios;
  if (!Array.isArray(scenarios) || scenarios.length !== 2) {
    throw new Error("both CAD material targets are required");
  }
  exact(
    "target order",
    scenarios.map((scenario) => object(scenario, "scenario").target),
    ["javascript", "wasm"],
  );
  let firstOutput: Uint8Array | undefined;
  for (const scenarioValue of scenarios) {
    const scenario = object(scenarioValue, "scenario");
    const target = String(scenario.target) as keyof typeof CAD_TARGETS;
    const expected = CAD_TARGETS[target];
    if (!expected) throw new Error("unknown CAD browser target");
    same(`${target} route`, scenario.route, CAD_BROWSER_POLICY.route);
    exact(`${target} assertions`, scenario.assertions, [
      "visible Start control entered running state",
      "visible status reached Complete.",
      "raw complete output bytes matched accepted oracle",
      "exact invariants and work counters matched",
    ]);
    const result = object(scenario.result, `${target} result`);
    const output = object(result.output, `${target} output`);
    same(`${target} output bytes`, output.bytes, CAD_BROWSER_POLICY.outputBytes);
    same(`${target} output hash`, output.sha256, CAD_BROWSER_POLICY.outputSha256);
    const raw = decodeBase64(output.base64, `${target} raw output`);
    same(`${target} raw output length`, raw.length, CAD_BROWSER_POLICY.outputBytes);
    same(`${target} raw output digest`, await sha256Hex(raw), CAD_BROWSER_POLICY.outputSha256);
    if (firstOutput) exact("cross-target raw output bytes", raw, firstOutput);
    else firstOutput = raw;
    exact(`${target} counters`, result.counters, expected.counters);
    exact(`${target} invariants`, result.invariants, CAD_INVARIANTS);

    const session = object(scenario.session, `${target} session`);
    if (
      typeof session.pageTargetId !== "string" || typeof session.pageSessionId !== "string" ||
      !Array.isArray(session.workerSessions) || session.workerSessions.length !== 1 ||
      session.pageAttached !== true || session.workersDetached !== true
    ) throw new Error(`${target} CDP page/worker session ownership is incomplete`);

    const network = scenario.network;
    if (!Array.isArray(network) || network.length < 5) {
      throw new Error(`${target} exhaustive network evidence is incomplete`);
    }
    for (const requestValue of network) {
      const request = object(requestValue, `${target} network request`);
      if (
        request.method !== "GET" || request.status !== 200 || request.failed !== false ||
        request.fromServiceWorker !== false || request.bodyCaptured !== true ||
        typeof request.sourceSessionId !== "string" || typeof request.sourceTargetId !== "string" ||
        !(Number(request.requestSequence) < Number(request.responseSequence) &&
          Number(request.responseSequence) < Number(request.endSequence))
      ) throw new Error(`${target} network request lifecycle is not causally complete`);
      const url = new URL(String(request.url));
      if (url.origin !== collector.origin) {
        throw new Error(`${target} network escaped exact origin`);
      }
      const body = object(request.rawBody, `${target} raw network body`);
      const bodyBytes = decodeBase64(body.base64, `${target} raw network body`);
      same(`${target} raw network byte count`, body.bytes, bodyBytes.length);
      same(`${target} raw network body hash`, body.sha256, await sha256Hex(bodyBytes));
      const acceptedHash = CAD_ACCEPTED_ASSETS[url.pathname as keyof typeof CAD_ACCEPTED_ASSETS];
      if (acceptedHash) same(`${target} accepted asset ${url.pathname}`, body.sha256, acceptedHash);
    }
    same(`${target} network events exhaustive`, scenario.networkEventsComplete, true);
    same(`${target} console events exhaustive`, scenario.consoleEventsComplete, true);
    same(`${target} exception events exhaustive`, scenario.exceptionEventsComplete, true);
    if (!Array.isArray(scenario.console) || !Array.isArray(scenario.exceptions)) {
      throw new Error(`${target} console/exception arrays are unavailable`);
    }
    if (
      scenario.console.some((entry) => object(entry, "console entry").type === "error") ||
      scenario.exceptions.length !== 0
    ) throw new Error(`${target} emitted browser errors or exceptions`);

    const accessibility = object(scenario.accessibility, `${target} accessibility`);
    same(`${target} AX completeness`, accessibility.complete, true);
    if (!Array.isArray(accessibility.nodes) || accessibility.nodes.length < 8) {
      throw new Error(`${target} AX tree is incomplete`);
    }
    const roles = new Set(accessibility.nodes.map((node) => object(node, "AX node").role));
    for (const role of ["main", "heading", "combobox", "button", "status", "progressbar"]) {
      if (!roles.has(role)) throw new Error(`${target} AX tree omitted ${role}`);
    }

    const screenshot = object(scenario.screenshot, `${target} screenshot`);
    const screenshotBytes = decodeBase64(screenshot.base64, `${target} screenshot`);
    exact(`${target} PNG signature`, [...screenshotBytes.slice(0, 8)], [
      137,
      80,
      78,
      71,
      13,
      10,
      26,
      10,
    ]);
    same(`${target} screenshot bytes`, screenshot.bytes, screenshotBytes.length);
    same(`${target} screenshot hash`, screenshot.sha256, await sha256Hex(screenshotBytes));
  }

  const cleanup = object(evidence.cleanup, "cleanup");
  same("browser cleanup", cleanup.browserCgroupKilled, true);
  same("profile cleanup", cleanup.profileRemoved, true);
  same("stage cleanup", cleanup.stageRemoved, true);
  same("profile reservation cleanup", cleanup.profileReservationRemoved, true);
  same("server cleanup", cleanup.serverStopped, true);
  same("temporary output cleanup", cleanup.temporaryOutputRemoved, true);
}

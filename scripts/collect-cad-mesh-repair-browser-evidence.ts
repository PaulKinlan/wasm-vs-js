import Ajv2020Module from "ajv2020";
import {
  CAD_ACCEPTED_ASSETS,
  CAD_BROWSER_POLICY,
  validateCadBrowserEvidenceSemantics,
} from "../lib/cad-browser-evidence.ts";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { BrowserClient } from "../lib/owned-chrome.ts";
import {
  ChromeLaunchLifecycleError,
  closeOwnedChrome,
  launchOwnedChrome,
  OwnedChrome,
} from "../lib/owned-chrome.ts";
import {
  inspectChromePackage,
  recordStageCleanupLifecycle,
  removeStagedChrome,
  stageChromePackage,
  StagedChrome,
} from "../lib/chrome-stage.ts";
import {
  ProfileReservation,
  refreshLedger,
  releaseProfileReservation,
  reserveProfileNamespace,
} from "../lib/process-ledger.ts";
import { StageCleanupLifecycle } from "../lib/stage-lifecycle.ts";

const root = new URL("../", import.meta.url);
const sourceArgument = `--source-commit=${CAD_BROWSER_POLICY.acceptedCommit}`;
const chromeArgument = `--chrome=${CAD_BROWSER_POLICY.requestedBinary}`;
if (Deno.args.length !== 2 || Deno.args[0] !== sourceArgument || Deno.args[1] !== chromeArgument) {
  throw new Error(
    `usage: collect-cad-mesh-repair-browser-evidence.ts ${sourceArgument} ${chromeArgument}`,
  );
}

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

const text = new TextEncoder();
const lifecycle: Array<{ sequence: number; event: string; at: string }> = [];
function transition(event: string): void {
  const expected = CAD_BROWSER_POLICY.lifecycle[lifecycle.length];
  if (event !== expected) {
    throw new Error(`invalid collector lifecycle: ${event}; expected ${expected}`);
  }
  lifecycle.push({ sequence: lifecycle.length + 1, event, at: new Date().toISOString() });
}

async function command(command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(new TextDecoder().decode(output.stderr));
  return new TextDecoder().decode(output.stdout).trim();
}

async function collectorProcessIdentity() {
  const stat = await Deno.readTextFile("/proc/self/stat");
  const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  return {
    pid: Deno.pid,
    parentPid: Number(fields[1]),
    processGroupId: Number(fields[2]),
    sessionId: Number(fields[3]),
    startTimeTicks: fields[19],
    executable: await Deno.realPath("/proc/self/exe"),
  };
}

function pathAbsent(path: string): Promise<boolean> {
  return Deno.lstat(path).then(() => false).catch((error) => {
    if (error instanceof Deno.errors.NotFound) return true;
    throw error;
  });
}

function bytesFromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const staticRoutes = new Map<string, [string, string]>([
  [CAD_BROWSER_POLICY.route, [
    "public/benchmarks/cad-mesh-repair-v1/index.html",
    "text/html; charset=utf-8",
  ]],
  ["/styles.css", ["public/styles.css", "text/css; charset=utf-8"]],
  ["/benchmarks/cad-mesh-repair-v1/demo.js", [
    "public/benchmarks/cad-mesh-repair-v1/demo.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/cad-mesh-repair-v1/worker.js", [
    "public/benchmarks/cad-mesh-repair-v1/worker.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/benchmarks/base/cad-mesh-repair/engine.js", [
    "benchmarks/base/cad-mesh-repair/engine.js",
    "text/javascript; charset=utf-8",
  ]],
  ["/artifacts/cad-mesh-repair-v1/dirty-grid.stl", [
    "public/artifacts/cad-mesh-repair-v1/dirty-grid.stl",
    "model/stl",
  ]],
  ["/artifacts/cad-mesh-repair-v1/mesh-repair.wasm", [
    "public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm",
    "application/wasm",
  ]],
  ["/favicon.ico", ["public/favicon.svg", "image/svg+xml"]],
]);

async function waitFor(
  read: () => Promise<Record<string, unknown>>,
  accept: (value: Record<string, unknown>) => boolean,
  label: string,
  timeoutMs = 30_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  let last: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    last = await read();
    if (accept(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`${label} timeout: ${JSON.stringify(last)}`);
}

async function click(browser: BrowserClient, sessionId: string, selector: string): Promise<void> {
  const evaluated = await browser.send("Runtime.evaluate", {
    expression: `(() => { const n=document.querySelector(${
      JSON.stringify(selector)
    }); const r=n.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:n.disabled}; })()`,
    returnByValue: true,
  }, sessionId);
  const position =
    (evaluated.result as { value: { x: number; y: number; disabled: boolean } }).value;
  if (position.disabled) throw new Error(`${selector} is disabled`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await browser.send("Input.dispatchMouseEvent", {
      type,
      x: position.x,
      y: position.y,
      button: "left",
      clickCount: 1,
    }, sessionId);
  }
}

async function collectScenario(
  browser: BrowserClient,
  origin: string,
  target: "javascript" | "wasm",
  screenshotPath: string,
  onPageAttached?: () => void,
) {
  let sequence = 0;
  const next = () => ++sequence;
  const created = await browser.send("Target.createTarget", { url: "about:blank" });
  const pageTargetId = String(created.targetId);
  const attached = await browser.send("Target.attachToTarget", {
    targetId: pageTargetId,
    flatten: true,
  });
  const pageSessionId = String(attached.sessionId);
  onPageAttached?.();
  const sessions = new Map<string, { targetId: string; type: "page" | "worker" }>([
    [pageSessionId, { targetId: pageTargetId, type: "page" }],
  ]);
  const workers: Array<{
    targetId: string;
    sessionId: string;
    attachedSequence: number;
    detachedSequence?: number;
  }> = [];
  const requests = new Map<string, Record<string, unknown>>();
  const bodyTasks: Promise<void>[] = [];
  const attachTasks: Promise<void>[] = [];
  const asynchronousErrors: unknown[] = [];
  const consoleMessages: Array<Record<string, unknown>> = [];
  const exceptions: Array<Record<string, unknown>> = [];
  const key = (sessionId: string, requestId: unknown) => `${sessionId}:${String(requestId)}`;

  const removers = [
    browser.on("Target.attachedToTarget", (params, eventSession) => {
      if (eventSession !== pageSessionId) return;
      const info = params.targetInfo as Record<string, unknown>;
      if (info.type !== "worker") return;
      const sessionId = String(params.sessionId), targetId = String(info.targetId);
      sessions.set(sessionId, { targetId, type: "worker" });
      workers.push({ targetId, sessionId, attachedSequence: next() });
      attachTasks.push(
        (async () => {
          await browser.send("Network.enable", {}, sessionId);
          await browser.send("Runtime.enable", {}, sessionId);
          await browser.send("Runtime.runIfWaitingForDebugger", {}, sessionId);
        })().catch((error) => {
          asynchronousErrors.push(error);
        }),
      );
    }),
    browser.on("Target.detachedFromTarget", (params) => {
      const sessionId = String(params.sessionId);
      const worker = workers.find((candidate) => candidate.sessionId === sessionId);
      if (worker && worker.detachedSequence === undefined) worker.detachedSequence = next();
    }),
    browser.on("Runtime.consoleAPICalled", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      consoleMessages.push({
        sequence: next(),
        sourceSessionId: eventSession,
        type: String(params.type),
        arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((argument) =>
          String(argument.value ?? argument.description ?? argument.type)
        ),
      });
    }),
    browser.on("Runtime.exceptionThrown", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      const details = params.exceptionDetails as Record<string, unknown>;
      exceptions.push({
        sequence: next(),
        sourceSessionId: eventSession,
        text: String(details.text),
        lineNumber: Number(details.lineNumber),
        columnNumber: Number(details.columnNumber),
      });
    }),
    browser.on("Network.requestWillBeSent", (params, eventSession) => {
      if (!eventSession) return;
      const source = sessions.get(eventSession);
      if (!source) return;
      const request = params.request as Record<string, unknown>;
      requests.set(key(eventSession, params.requestId), {
        requestId: String(params.requestId),
        sourceSessionId: eventSession,
        sourceTargetId: source.targetId,
        sourceType: source.type,
        url: String(request.url),
        method: String(request.method),
        resourceType: String(params.type),
        requestSequence: next(),
        responseSequence: 0,
        endSequence: 0,
        status: null,
        mimeType: null,
        fromDiskCache: false,
        fromServiceWorker: false,
        failed: false,
        errorText: null,
        encodedDataLength: 0,
        bodyCaptured: false,
        rawBody: null,
      });
    }),
    browser.on("Network.responseReceived", (params, eventSession) => {
      if (!eventSession) return;
      const record = requests.get(key(eventSession, params.requestId));
      if (!record) return;
      const response = params.response as Record<string, unknown>;
      Object.assign(record, {
        responseSequence: next(),
        status: Number(response.status),
        mimeType: String(response.mimeType),
        fromDiskCache: Boolean(response.fromDiskCache),
        fromServiceWorker: Boolean(response.fromServiceWorker),
      });
    }),
    browser.on("Network.loadingFinished", (params, eventSession) => {
      if (!eventSession) return;
      const record = requests.get(key(eventSession, params.requestId));
      if (!record) return;
      record.endSequence = next();
      record.encodedDataLength = Number(params.encodedDataLength);
      bodyTasks.push(
        (async () => {
          const body = await browser.send(
            "Network.getResponseBody",
            {
              requestId: String(params.requestId),
            },
            eventSession,
            10_000,
          );
          const bytes = body.base64Encoded
            ? bytesFromBase64(String(body.body))
            : text.encode(String(body.body));
          record.bodyCaptured = true;
          record.rawBody = {
            bytes: bytes.length,
            sha256: await sha256Hex(bytes),
            base64: base64FromBytes(bytes),
          };
        })().catch((error) => {
          asynchronousErrors.push(error);
        }),
      );
    }),
    browser.on("Network.loadingFailed", (params, eventSession) => {
      if (!eventSession) return;
      const record = requests.get(key(eventSession, params.requestId));
      if (!record) return;
      record.endSequence = next();
      record.failed = true;
      record.errorText = String(params.errorText);
    }),
  ];

  try {
    await Promise.all([
      browser.send("Page.enable", {}, pageSessionId),
      browser.send("Runtime.enable", {}, pageSessionId),
      browser.send("Network.enable", {}, pageSessionId),
      browser.send("Accessibility.enable", {}, pageSessionId),
      browser.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
      }, pageSessionId),
    ]);
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CAD page load timeout")), 10_000);
      const remove = browser.on("Page.loadEventFired", (_params, eventSession) => {
        if (eventSession !== pageSessionId) return;
        clearTimeout(timer);
        remove();
        resolve();
      });
    });
    await browser.send(
      "Page.navigate",
      { url: `${origin}${CAD_BROWSER_POLICY.route}` },
      pageSessionId,
    );
    await loaded;
    const readState = async () => {
      const evaluated = await browser.send("Runtime.evaluate", {
        expression:
          `(() => ({status:document.querySelector('#status').textContent.trim(),result:globalThis.__cadMeshEvidenceResult ?? null,startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled}))()`,
        returnByValue: true,
      }, pageSessionId);
      return (evaluated.result as { value: Record<string, unknown> }).value;
    };
    await waitFor(readState, (state) => state.status === "Ready.", `${target} ready`);
    await browser.send("Runtime.evaluate", {
      expression: `(() => { const select=document.querySelector('#target'); select.value=${
        JSON.stringify(target)
      }; select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
    }, pageSessionId);
    await click(browser, pageSessionId, "#start");
    await waitFor(
      readState,
      (state) =>
        String(state.status).startsWith("Running ") && state.startDisabled === true &&
        state.cancelDisabled === false,
      `${target} running`,
    );
    const finalState = await waitFor(
      readState,
      (state) => state.status === "Complete." && state.result !== null,
      `${target} complete`,
    );
    await Promise.all(attachTasks);
    const detachDeadline = Date.now() + 3_000;
    while (
      workers.some((worker) => worker.detachedSequence === undefined) && Date.now() < detachDeadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await Promise.all(bodyTasks);
    if (asynchronousErrors.length) throw asynchronousErrors[0];
    if (workers.length !== 1 || workers[0].detachedSequence === undefined) {
      throw new Error(`${target} worker session lifecycle is incomplete`);
    }
    const network = [...requests.values()].sort((a, b) =>
      Number(a.requestSequence) - Number(b.requestSequence)
    );
    if (
      network.some((request) =>
        request.failed || request.status !== 200 || request.bodyCaptured !== true ||
        new URL(String(request.url)).origin !== origin
      )
    ) throw new Error(`${target} network evidence is incomplete or escaped the owned origin`);

    const browserResult = finalState.result as Record<string, unknown>;
    const outputBytes = bytesFromBase64(String(browserResult.outputBase64));
    if (
      outputBytes.length !== CAD_BROWSER_POLICY.outputBytes ||
      await sha256Hex(outputBytes) !== CAD_BROWSER_POLICY.outputSha256
    ) throw new Error(`${target} raw complete output bytes do not match the accepted oracle`);

    const ax = await browser.send("Accessibility.getFullAXTree", {}, pageSessionId, 10_000);
    const nodes = ((ax.nodes as Array<Record<string, unknown>>) ?? []).map((node) => ({
      nodeId: String(node.nodeId),
      ignored: Boolean(node.ignored),
      role: String((node.role as Record<string, unknown> | undefined)?.value ?? ""),
      name: String((node.name as Record<string, unknown> | undefined)?.value ?? ""),
      childIds: ((node.childIds as unknown[]) ?? []).map(String),
    }));
    const screenshotResult = await browser.send(
      "Page.captureScreenshot",
      {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
      },
      pageSessionId,
      10_000,
    );
    const screenshotBytes = bytesFromBase64(String(screenshotResult.data));
    await Deno.writeFile(screenshotPath, screenshotBytes, { createNew: true });
    return {
      target,
      route: CAD_BROWSER_POLICY.route,
      assertions: [
        "visible Start control entered running state",
        "visible status reached Complete.",
        "raw complete output bytes matched accepted oracle",
        "exact invariants and work counters matched",
      ],
      result: {
        output: {
          bytes: outputBytes.length,
          sha256: await sha256Hex(outputBytes),
          base64: base64FromBytes(outputBytes),
        },
        counters: browserResult.counters,
        invariants: browserResult.invariants,
      },
      session: {
        pageTargetId,
        pageSessionId,
        pageAttached: true,
        workerSessions: workers.map((worker) => ({
          targetId: worker.targetId,
          sessionId: worker.sessionId,
          attachedSequence: worker.attachedSequence,
          detachedSequence: worker.detachedSequence,
        })),
        workersDetached: true,
      },
      network,
      networkEventsComplete: true,
      console: consoleMessages,
      consoleEventsComplete: true,
      exceptions,
      exceptionEventsComplete: true,
      accessibility: { complete: true, nodes },
      screenshot: {
        path: `artifacts/cad-mesh-repair/browser-evidence/screenshots/${target}.png`,
        bytes: screenshotBytes.length,
        sha256: await sha256Hex(screenshotBytes),
        base64: base64FromBytes(screenshotBytes),
      },
    };
  } finally {
    for (const remove of removers) remove();
    await browser.send("Target.closeTarget", { targetId: pageTargetId }).catch(() => {});
  }
}

transition("collector-started");
const collectorProcess = await collectorProcessIdentity();
const collectorCommit = await command("/usr/bin/git", ["rev-parse", "HEAD"]);
const cleanAtStart =
  (await command("/usr/bin/git", ["status", "--porcelain", "--untracked-files=no"])) === "";
if (!cleanAtStart) throw new Error("collector requires a clean tracked checkout at start");
if (
  await command("/usr/bin/git", ["rev-parse", `${CAD_BROWSER_POLICY.acceptedCommit}^{tree}`]) !==
    CAD_BROWSER_POLICY.acceptedTree
) {
  throw new Error("accepted CAD source tree identity mismatch");
}
for (const [route, expectedSha256] of Object.entries(CAD_ACCEPTED_ASSETS)) {
  const file = staticRoutes.get(route)?.[0];
  if (!file || await sha256Hex(await Deno.readFile(new URL(file, root))) !== expectedSha256) {
    throw new Error(`accepted CAD asset changed: ${route}`);
  }
}

let serverPort = 0;
const abortServer = new AbortController();
const server = Deno.serve({
  hostname: "127.0.0.1",
  port: 0,
  signal: abortServer.signal,
  onListen: ({ port }) => serverPort = port,
}, async (request) => {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.hostname !== "127.0.0.1" || url.search || url.hash) {
    return new Response(null, { status: 403 });
  }
  const route = staticRoutes.get(url.pathname);
  if (!route) return new Response(null, { status: 404 });
  return new Response(await Deno.readFile(new URL(route[0], root)), {
    status: 200,
    headers: {
      "content-type": route[1],
      "cache-control": "no-store",
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp",
      "x-content-type-options": "nosniff",
      "content-security-policy":
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'",
    },
  });
});
while (serverPort === 0) await new Promise((resolve) => setTimeout(resolve, 1));
const origin = `http://127.0.0.1:${serverPort}`;
transition("server-listening");

const runId = `cad-a86c35e-${crypto.randomUUID().replaceAll("-", "")}`;
const ownershipRoot = `/tmp/wasm-vs-js-owned-profiles/${runId}`;
const profilePath = `${ownershipRoot}/profile`;
const temporaryParent = new URL("artifacts/cad-mesh-repair/browser-evidence/", root).pathname;
const temporaryOutput = `${temporaryParent}.collect-${runId}`;
let stage: StagedChrome | undefined;
let reservation: ProfileReservation | undefined;
let owned: OwnedChrome | undefined;
let ownedCleanupVerified = false;
let stageRemoved = false;
let reservationRemoved = false;
let serverStopped = false;
let published = false;
const stageLifecycle = new StageCleanupLifecycle();
let stageEvidence: Record<string, unknown> | undefined;
let profileEvidence: Record<string, unknown> | undefined;
let cgroupEvidence: Record<string, unknown> | undefined;
let browserEvidence: Record<string, unknown> | undefined;
const scenarios: unknown[] = [];

try {
  await Deno.mkdir(temporaryParent, { recursive: true });
  await Deno.mkdir(`${temporaryOutput}/screenshots`, { recursive: true, mode: 0o700 });
  const inspected = await inspectChromePackage(
    CAD_BROWSER_POLICY.requestedBinary,
    CAD_BROWSER_POLICY.binarySha256,
  );
  if (inspected.manifestSha256 !== CAD_BROWSER_POLICY.packageManifestSha256) {
    throw new Error("exact CfT package manifest mismatch");
  }
  transition("package-inspected");
  stage = await stageChromePackage(
    CAD_BROWSER_POLICY.requestedBinary,
    CAD_BROWSER_POLICY.binarySha256,
    {
      permitId: runId,
      sourceCommit: CAD_BROWSER_POLICY.acceptedCommit,
      chromePackageManifestSha256: CAD_BROWSER_POLICY.packageManifestSha256,
    },
  );
  transition("stage-created");
  reservation = await reserveProfileNamespace(ownershipRoot, ["profile"]);
  transition("profile-reserved");
  owned = await launchOwnedChrome({
    stagedChrome: stage,
    profileRoot: profilePath,
    profileReservation: reservation,
    extraArguments: CAD_BROWSER_POLICY.launchArgumentSuffix.slice(6, -1),
    onSpawn: () => {
      stageLifecycle.launchBegan();
      recordStageCleanupLifecycle(stage!, "owned-launch-active");
      transition("browser-launch-began");
    },
  });
  if (owned.version.product !== CAD_BROWSER_POLICY.product) {
    throw new Error(`exact Chrome version mismatch: ${owned.version.product}`);
  }
  transition("browser-connected");
  scenarios.push(
    await collectScenario(
      owned.browser,
      origin,
      "javascript",
      `${temporaryOutput}/screenshots/javascript.png`,
      () => {
        transition("page-session-attached");
        transition("javascript-started");
      },
    ),
  );
  transition("javascript-complete");
  transition("wasm-started");
  scenarios.push(
    await collectScenario(
      owned.browser,
      origin,
      "wasm",
      `${temporaryOutput}/screenshots/wasm.png`,
    ),
  );
  transition("wasm-complete");
  owned.ledger = await refreshLedger(owned.ledger);
  const profile = owned.ledger.profile;
  profileEvidence = {
    path: profile.profileRoot,
    dev: profile.profileDev,
    ino: profile.profileIno,
    mode: 0o700,
    removed: true,
    absent: true,
  };
  cgroupEvidence = {
    unit: owned.ledger.unit,
    controlGroup: owned.ledger.controlGroup,
    cgroupPath: owned.ledger.cgroupPath,
    cgroupDev: owned.ledger.cgroupDev,
    cgroupIno: owned.ledger.cgroupIno,
    invocationId: owned.ledger.invocationId,
    mainPid: owned.ledger.mainPid,
    membershipSnapshots: owned.ledger.membershipSnapshots,
    cleanupVerified: true,
    remainingMembers: [],
  };
  browserEvidence = {
    channel: CAD_BROWSER_POLICY.channel,
    version: CAD_BROWSER_POLICY.version,
    product: String(owned.version.product),
    revision: String(owned.version.revision),
    userAgent: String(owned.version.userAgent),
    jsVersion: String(owned.version.jsVersion),
    requestedBinary: CAD_BROWSER_POLICY.requestedBinary,
    resolvedStagedBinary: owned.resolvedBinary,
    binarySha256: owned.binarySha256,
    packageManifestSha256: stage.manifestSha256,
    launchArguments: owned.arguments,
  };
  stageEvidence = {
    id: stage.stageId,
    root: stage.root,
    rootDev: stage.rootDev,
    rootIno: stage.rootIno,
    ownerManifestSha256: stage.ownerManifestSha256,
    packageManifestSha256: stage.manifestSha256,
    cleanupLifecycle: "cleanup-verified",
    removed: true,
    absent: true,
  };
  const cleanup = await closeOwnedChrome(owned);
  if (!cleanup.cleaned || cleanup.remaining.length) {
    throw new Error("owned cgroup cleanup incomplete");
  }
  ownedCleanupVerified = true;
  stageLifecycle.cleanupVerified();
  recordStageCleanupLifecycle(stage, "cleanup-verified");
  stageEvidence!.ownerManifestSha256 = stage.ownerManifestSha256;
  transition("browser-cleanup-verified");
  await removeStagedChrome(stage);
  stageRemoved = await pathAbsent(stage.root) && await pathAbsent(stage.ownerManifestPath);
  if (!stageRemoved) throw new Error("staged Chrome cleanup is not absent");
  transition("stage-cleanup-verified");
  await releaseProfileReservation(reservation);
  reservationRemoved = await pathAbsent(ownershipRoot);
  if (!reservationRemoved) throw new Error("profile reservation cleanup is not absent");
  transition("profile-reservation-cleanup-verified");
  abortServer.abort();
  await server.finished;
  serverStopped = true;
  transition("server-stopped");
  transition("collection-complete");

  const cleanAtEnd =
    (await command("/usr/bin/git", ["status", "--porcelain", "--untracked-files=no"])) === "";
  if (!cleanAtEnd) throw new Error("tracked checkout changed during collection");
  const evidence = {
    schemaVersion: 1,
    evidenceId: CAD_BROWSER_POLICY.evidenceId,
    status: "authoritative-browser-correctness",
    performanceClaim: false,
    collectedAt: new Date().toISOString(),
    source: {
      acceptedCommit: CAD_BROWSER_POLICY.acceptedCommit,
      acceptedTree: CAD_BROWSER_POLICY.acceptedTree,
      collectorCommit,
      cleanAtStart,
      cleanAtEnd,
    },
    collector: {
      parentRun: true,
      protocol: "Chrome DevTools Protocol",
      command:
        `deno run <required-permissions> scripts/collect-cad-mesh-repair-browser-evidence.ts ${sourceArgument} ${chromeArgument}`,
      origin,
      process: collectorProcess,
    },
    browser: browserEvidence,
    ownership: { stage: stageEvidence, profile: profileEvidence, cgroup: cgroupEvidence },
    lifecycle,
    scenarios,
    cleanup: {
      browserCgroupKilled: ownedCleanupVerified,
      profileRemoved: Boolean(profileEvidence && await pathAbsent(String(profileEvidence.path))),
      stageRemoved,
      profileReservationRemoved: reservationRemoved,
      serverStopped,
      temporaryOutputRemoved: true,
    },
  };
  const schema = JSON.parse(
    await Deno.readTextFile(new URL("schemas/cad-mesh-repair-browser-evidence.schema.json", root)),
  );
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  if (!validate(evidence)) {
    throw new Error(`browser evidence schema: ${JSON.stringify(validate.errors)}`);
  }
  await validateCadBrowserEvidenceSemantics(evidence);
  await Deno.writeTextFile(`${temporaryOutput}/evidence.v1.json`, `${canonicalize(evidence)}\n`, {
    createNew: true,
  });
  const finalOutput = new URL("artifacts/cad-mesh-repair/browser-evidence/", root).pathname;
  for await (const entry of Deno.readDir(finalOutput)) {
    if (!entry.name.startsWith(".collect-")) {
      await Deno.remove(`${finalOutput}/${entry.name}`, { recursive: true });
    }
  }
  for await (const entry of Deno.readDir(temporaryOutput)) {
    await Deno.rename(`${temporaryOutput}/${entry.name}`, `${finalOutput}/${entry.name}`);
  }
  await Deno.remove(temporaryOutput);
  published = true;
  console.log(
    "cad-browser-evidence: 2 material targets; exact owned cleanup; no performance claim",
  );
} catch (error) {
  if (
    stage && stageLifecycle.state === "owned-launch-active" &&
    error instanceof ChromeLaunchLifecycleError
  ) {
    if (error.cleanupResolved) {
      stageLifecycle.cleanupVerified();
      recordStageCleanupLifecycle(stage, "cleanup-verified");
    } else {
      stageLifecycle.cleanupUnresolved();
      recordStageCleanupLifecycle(stage, "cleanup-unresolved");
    }
  }
  throw error;
} finally {
  if (owned && !ownedCleanupVerified) {
    try {
      await closeOwnedChrome(owned);
      ownedCleanupVerified = true;
      if (stage && stage.cleanupLifecycle === "owned-launch-active") {
        stageLifecycle.cleanupVerified();
        recordStageCleanupLifecycle(stage, "cleanup-verified");
      }
    } catch {
      if (stage && stage.cleanupLifecycle !== "cleanup-unresolved") {
        stageLifecycle.cleanupUnresolved();
        recordStageCleanupLifecycle(stage, "cleanup-unresolved");
      }
    }
  }
  if (stage && !stageRemoved && stageLifecycle.disposition === "remove-stage") {
    await removeStagedChrome(stage).catch(() => {});
  }
  if (reservation && !reservationRemoved && stageLifecycle.disposition === "remove-stage") {
    await releaseProfileReservation(reservation).catch(() => {});
  }
  if (!serverStopped) {
    abortServer.abort();
    await server.finished.catch(() => {});
  }
  if (!published) await Deno.remove(temporaryOutput, { recursive: true }).catch(() => {});
}

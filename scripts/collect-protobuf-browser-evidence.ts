import Ajv2020Module from "ajv2020";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  BrowserClient,
  ChromeLaunchLifecycleError,
  closeOwnedChrome,
  launchOwnedChrome,
  OwnedChrome,
} from "../lib/owned-chrome.ts";
import {
  recordStageCleanupLifecycle,
  removeStagedChrome,
  stageChromePackage,
  StagedChrome,
} from "../lib/chrome-stage.ts";
import { refreshLedger } from "../lib/process-ledger.ts";
import {
  assertProtobufBrowserEvidenceSemantics,
  buildProtobufParentOracle,
  PROTOBUF_CFT,
  PROTOBUF_ROUTE_HASHES,
  PROTOBUF_SOURCE,
} from "../lib/protobuf-browser-evidence.ts";

if (Deno.args.length !== 0) {
  throw new Error(
    "collect-protobuf-browser-evidence.ts accepts no arguments; CfT and source are frozen",
  );
}

const root = new URL("../", import.meta.url);
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const COLLECTION_COMMAND = "deno task --config deno.corpus.json protobuf:collect-browser-evidence";
const ROUTE_FILES: Record<keyof typeof PROTOBUF_ROUTE_HASHES, string> = {
  "/benchmarks/serialization-protobuf-gateway/":
    "public/benchmarks/serialization-protobuf-gateway/index.html",
  "/benchmarks/serialization-protobuf-gateway/protobuf-runner.js":
    "public/benchmarks/serialization-protobuf-gateway/protobuf-runner.js",
  "/benchmarks/serialization-protobuf-gateway/protobuf-worker.js":
    "public/benchmarks/serialization-protobuf-gateway/protobuf-worker.js",
  "/benchmarks/base/serialization-protobuf-gateway/workload.js":
    "benchmarks/base/serialization-protobuf-gateway/workload.js",
  "/benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json":
    "benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json",
  "/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm":
    "public/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm",
  "/artifacts/serialization-protobuf-gateway/fixture-manifest.json":
    "public/artifacts/serialization-protobuf-gateway/fixture-manifest.json",
  "/artifacts/serialization-protobuf-gateway/output-manifest.json":
    "public/artifacts/serialization-protobuf-gateway/output-manifest.json",
  "/artifacts/serialization-protobuf-gateway/build-manifest.json":
    "public/artifacts/serialization-protobuf-gateway/build-manifest.json",
  "/styles.css": "public/styles.css",
  "/favicon.ico": "public/favicon.svg",
};

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

async function command(command: string, args: string[], cwd?: string) {
  const result = await new Deno.Command(command, {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) {
    throw new Error(`${command} failed: ${decoder.decode(result.stderr).trim()}`);
  }
  return decoder.decode(result.stdout).trim();
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

async function waitFor(
  fn: () => Promise<boolean>,
  label: string,
  timeoutMs = 120_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`${label} timeout`);
}

function nestedValue(result: Record<string, unknown>): unknown {
  return (result.result as Record<string, unknown> | undefined)?.value;
}

async function evaluate(
  browser: BrowserClient,
  sessionId: string,
  expression: string,
): Promise<unknown> {
  return nestedValue(
    await browser.send(
      "Runtime.evaluate",
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId,
      10_000,
    ),
  );
}

async function click(browser: BrowserClient, sessionId: string, selector: string): Promise<void> {
  const point = await evaluate(
    browser,
    sessionId,
    `(()=>{const n=document.querySelector(${
      JSON.stringify(selector)
    });if(!n)throw new Error('missing control');const r=n.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,disabled:n.disabled}})()`,
  ) as { x: number; y: number; disabled: boolean };
  if (point.disabled) throw new Error(`${selector} is disabled`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await browser.send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1,
    }, sessionId);
  }
}

function consoleArguments(args: unknown): string[] {
  return Array.isArray(args)
    ? args.map((arg) => {
      const value = arg as Record<string, unknown>;
      return String(value.value ?? value.description ?? value.type ?? "");
    })
    : [];
}

async function writeArtifact(path: string, bytes: Uint8Array) {
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  const handle = await Deno.open(path, { createNew: true, write: true, mode: 0o400 });
  try {
    let offset = 0;
    while (offset < bytes.length) offset += await handle.write(bytes.subarray(offset));
    await handle.sync();
  } finally {
    handle.close();
  }
  return { path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) };
}

interface NetworkDraft {
  requestId: string;
  sessionId: string;
  targetType: "page" | "worker";
  url: string;
  path: string;
  method: string;
  status: number;
  mimeType: string;
  encodedDataLength: number;
  fromDiskCache: boolean;
  fromServiceWorker: boolean;
  failed: boolean;
  errorText: string | null;
  responseBodyBytes: number;
  responseBodySha256: string;
}

async function collectScenario(
  browser: BrowserClient,
  origin: string,
  outputRoot: string,
  target: "javascript" | "wasm",
): Promise<Record<string, unknown>> {
  const id = `${target}-exact`;
  const created = await browser.send("Target.createTarget", { url: "about:blank" });
  const targetId = String(created.targetId ?? "");
  if (!targetId) throw new Error("protobuf page target creation failed");
  const attached = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = String(attached.sessionId ?? "");
  if (!sessionId) throw new Error("protobuf page target attachment failed");
  const sessions = new Map<string, "page" | "worker">([[sessionId, "page"]]);
  const workerSessions = new Set<string>();
  const detachedWorkers = new Set<string>();
  const setupTasks: Promise<void>[] = [];
  const responseTasks: Promise<void>[] = [];
  const eventErrors: string[] = [];
  const network: NetworkDraft[] = [];
  const responseMetadata = new Map<string, Record<string, unknown>>();
  const consoleEvents: Array<Record<string, unknown>> = [];
  const exceptions: Array<Record<string, unknown>> = [];
  const logs: Array<Record<string, unknown>> = [];

  const setupSession = async (child: string) => {
    await Promise.all([
      browser.send("Network.enable", {}, child),
      browser.send("Runtime.enable", {}, child),
      browser.send("Log.enable", {}, child),
      browser.send("Fetch.enable", {
        patterns: [{ urlPattern: `${origin}/*`, requestStage: "Response" }],
      }, child),
    ]);
  };
  const removers = [
    browser.on("Target.attachedToTarget", (params, eventSession) => {
      if (eventSession !== sessionId) return;
      const info = params.targetInfo as Record<string, unknown> | undefined;
      const child = String(params.sessionId ?? ""), type = String(info?.type ?? "");
      if (!child || type !== "worker") {
        eventErrors.push(`unexpected auto-attached target: ${type}`);
        return;
      }
      sessions.set(child, "worker");
      workerSessions.add(child);
      setupTasks.push(
        setupSession(child).then(() =>
          browser.send("Runtime.runIfWaitingForDebugger", {}, child).then(() => undefined)
        ).catch((error) => {
          eventErrors.push(`worker setup: ${error}`);
        }),
      );
    }),
    browser.on("Target.detachedFromTarget", (params) => {
      const child = String(params.sessionId ?? "");
      if (workerSessions.has(child)) detachedWorkers.add(child);
    }),
    browser.on("Network.responseReceived", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      responseMetadata.set(
        `${eventSession}:${String(params.requestId)}`,
        params.response as Record<string, unknown>,
      );
    }),
    browser.on("Network.loadingFailed", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      eventErrors.push(`network failure ${String(params.requestId)}: ${String(params.errorText)}`);
    }),
    browser.on("Fetch.requestPaused", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      responseTasks.push((async () => {
        const fetchId = String(params.requestId), networkId = String(params.networkId ?? "");
        const request = params.request as Record<string, unknown>;
        try {
          if (params.responseStatusCode === undefined) throw new Error("non-response Fetch pause");
          const url = new URL(String(request.url));
          const path = url.pathname as keyof typeof PROTOBUF_ROUTE_HASHES;
          if (
            url.origin !== origin || url.search || url.hash || request.method !== "GET" ||
            !(path in PROTOBUF_ROUTE_HASHES) || Number(params.responseStatusCode) !== 200
          ) throw new Error(`unexpected browser request ${request.method} ${url.href}`);
          const bodyResult = await browser.send(
            "Fetch.getResponseBody",
            { requestId: fetchId },
            eventSession,
            10_000,
          );
          const bodyText = String(bodyResult.body ?? "");
          const body = bodyResult.base64Encoded === true
            ? Uint8Array.from(atob(bodyText), (char) => char.charCodeAt(0))
            : encoder.encode(bodyText);
          const digest = await sha256Hex(body);
          if (digest !== PROTOBUF_ROUTE_HASHES[path]) {
            throw new Error(`raw response hash mismatch: ${path}`);
          }
          await browser.send(
            "Fetch.continueResponse",
            { requestId: fetchId },
            eventSession,
            10_000,
          );
          await new Promise((resolve) => setTimeout(resolve, 0));
          const response = responseMetadata.get(`${eventSession}:${networkId}`) ?? {};
          const headers = (params.responseHeaders as Array<Record<string, unknown>> | undefined) ??
            [];
          const contentType = headers.find((header) =>
            String(header.name).toLowerCase() === "content-type"
          );
          network.push({
            requestId: networkId || fetchId,
            sessionId: eventSession,
            targetType: sessions.get(eventSession)!,
            url: url.href,
            path,
            method: "GET",
            status: 200,
            mimeType:
              String(response.mimeType ?? contentType?.value ?? "application/octet-stream").split(
                ";",
              )[0],
            encodedDataLength: Number(response.encodedDataLength ?? body.byteLength),
            fromDiskCache: Boolean(response.fromDiskCache),
            fromServiceWorker: Boolean(response.fromServiceWorker),
            failed: false,
            errorText: null,
            responseBodyBytes: body.byteLength,
            responseBodySha256: digest,
          });
        } catch (error) {
          eventErrors.push(`response capture: ${error}`);
          await browser.send("Fetch.continueResponse", { requestId: fetchId }, eventSession).catch(
            () => {},
          );
        }
      })());
    }),
    browser.on("Runtime.consoleAPICalled", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      consoleEvents.push({
        sessionId: eventSession,
        targetType: sessions.get(eventSession),
        type: String(params.type ?? ""),
        arguments: consoleArguments(params.args),
      });
    }),
    browser.on("Runtime.exceptionThrown", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      const details = params.exceptionDetails as Record<string, unknown>;
      exceptions.push({
        sessionId: eventSession,
        targetType: sessions.get(eventSession),
        text: String(details.text ?? ""),
        lineNumber: Number(details.lineNumber ?? 0),
        columnNumber: Number(details.columnNumber ?? 0),
        url: String(details.url ?? ""),
      });
    }),
    browser.on("Log.entryAdded", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      const entry = params.entry as Record<string, unknown>;
      logs.push({
        sessionId: eventSession,
        targetType: sessions.get(eventSession),
        source: String(entry.source ?? ""),
        level: String(entry.level ?? ""),
        text: String(entry.text ?? ""),
        url: String(entry.url ?? ""),
        lineNumber: Number(entry.lineNumber ?? 0),
      });
    }),
  ];

  try {
    await Promise.all([
      browser.send("Page.enable", {}, sessionId),
      browser.send("Runtime.enable", {}, sessionId),
      browser.send("Network.enable", {}, sessionId),
      browser.send("Log.enable", {}, sessionId),
      browser.send("Accessibility.enable", {}, sessionId),
      browser.send("Fetch.enable", {
        patterns: [{ urlPattern: `${origin}/*`, requestStage: "Response" }],
      }, sessionId),
      browser.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
      }, sessionId),
    ]);
    let loaded = false;
    const removeLoad = browser.on("Page.loadEventFired", (_params, eventSession) => {
      if (eventSession === sessionId) loaded = true;
    });
    await browser.send("Page.navigate", {
      url: `${origin}/benchmarks/serialization-protobuf-gateway/`,
    }, sessionId);
    await waitFor(() => Promise.resolve(loaded), `${id} page load`, 15_000);
    removeLoad();
    await waitFor(
      async () =>
        await evaluate(browser, sessionId, "document.querySelector('#status')?.textContent") ===
          "Ready.",
      `${id} ready`,
      10_000,
    );
    const lifecycle = ["ready"];
    await evaluate(
      browser,
      sessionId,
      `(()=>{const s=document.querySelector('select[name=target]');s.value=${
        JSON.stringify(target)
      };s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('select[name=mode]').value='exact';return{s:s.value,m:document.querySelector('select[name=mode]').value}})()`,
    );
    await click(browser, sessionId, "#start");
    await waitFor(
      async () =>
        String(await evaluate(browser, sessionId, "document.querySelector('#status')?.textContent"))
          .startsWith("Running exactly"),
      `${id} running`,
      10_000,
    );
    lifecycle.push("running");
    await waitFor(
      async () =>
        await evaluate(browser, sessionId, "document.querySelector('#status')?.textContent") ===
          "Complete. Correctness evidence only; no performance claim.",
      `${id} complete`,
    );
    lifecycle.push("complete");
    const resultText = String(
      await evaluate(browser, sessionId, "document.querySelector('#output')?.textContent"),
    );
    const result = JSON.parse(resultText);
    let observedSetups = -1;
    while (observedSetups !== setupTasks.length) {
      observedSetups = setupTasks.length;
      await Promise.all(setupTasks.slice(0, observedSetups));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await waitFor(
      () =>
        Promise.resolve(
          workerSessions.size > 0 &&
            [...workerSessions].every((child) => detachedWorkers.has(child)),
        ),
      `${id} worker detach`,
      10_000,
    );
    lifecycle.push("worker-absent");
    await new Promise((resolve) => setTimeout(resolve, 100));
    let observedResponses = -1;
    while (observedResponses !== responseTasks.length) {
      observedResponses = responseTasks.length;
      await Promise.all(responseTasks.slice(0, observedResponses));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (eventErrors.length) {
      throw new Error(`${id} event evidence failed: ${eventErrors.join("; ")}`);
    }
    if (consoleEvents.length || exceptions.length || logs.some((log) => log.level === "error")) {
      throw new Error(`${id} emitted console, exception, or error log evidence`);
    }
    const observed = new Set(network.map((record) => record.path));
    for (const path of Object.keys(PROTOBUF_ROUTE_HASHES)) {
      if (path !== "/favicon.ico" && !observed.has(path)) {
        throw new Error(`${id} missing request ${path}`);
      }
    }
    const ax = await browser.send("Accessibility.getFullAXTree", {}, sessionId, 10_000);
    const axBytes = encoder.encode(canonicalize(ax) + "\n");
    const axPath = `${outputRoot}/accessibility/${id}.json`;
    const accessibility = {
      ...await writeArtifact(axPath, axBytes),
      nodeCount: Array.isArray(ax.nodes) ? ax.nodes.length : 0,
    };
    if (!accessibility.nodeCount) throw new Error(`${id} AX tree is empty`);
    const screenshotResult = await browser.send(
      "Page.captureScreenshot",
      {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
      },
      sessionId,
      10_000,
    );
    const screenshotBytes = Uint8Array.from(
      atob(String(screenshotResult.data ?? "")),
      (char) => char.charCodeAt(0),
    );
    if (
      JSON.stringify([...screenshotBytes.subarray(0, 8)]) !==
        JSON.stringify([137, 80, 78, 71, 13, 10, 26, 10])
    ) {
      throw new Error(`${id} screenshot is not PNG`);
    }
    const screenshot = await writeArtifact(`${outputRoot}/screenshots/${id}.png`, screenshotBytes);
    return {
      id,
      target,
      mode: "exact",
      targetId,
      sessionId,
      workerSessionIds: [...workerSessions].sort(),
      finalStatus: "complete",
      lifecycle,
      result,
      assertions: [
        "visible Start control entered running state",
        "fresh module worker completed",
        "worker target detached after completion",
        "exact source and artifact hashes passed",
        "complete 10000-message output oracle matched",
        "exact work counters matched",
        "all observed response bodies matched accepted raw bytes",
        "no console errors, exceptions, or error logs",
        "accessibility tree and screenshot retained",
      ],
      network: network.sort((a, b) =>
        a.path.localeCompare(b.path) || a.requestId.localeCompare(b.requestId)
      ),
      console: consoleEvents,
      exceptions,
      logs,
      accessibility,
      screenshot,
    };
  } finally {
    for (const remove of removers) remove();
    await browser.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

async function main(): Promise<void> {
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const evidenceId = `protobuf-gateway-ae8e0c9-${suffix}`;
  const outputRoot = `raw/protobuf-browser-evidence/${evidenceId}`;
  const sourceRoot = "/tmp/wasm-vs-js-protobuf-source";
  await Deno.mkdir(sourceRoot, { mode: 0o700 }).catch((error) => {
    if (!(error instanceof Deno.errors.AlreadyExists)) throw error;
  });
  const sourceRootInfo = await Deno.lstat(sourceRoot);
  if (
    sourceRootInfo.isSymlink || !sourceRootInfo.isDirectory ||
    await Deno.realPath(sourceRoot) !== sourceRoot ||
    (Number(sourceRootInfo.mode) & 0o777) !== 0o700
  ) throw new Error("unsafe Protobuf source checkout root");
  const tempParent = await Deno.makeTempDir({ dir: sourceRoot, prefix: "protobuf-source-" });
  const checkout = `${tempParent}/source`;
  let worktreeAdded = false;
  let server: Deno.HttpServer | undefined;
  let stage: StagedChrome | undefined;
  let owned: OwnedChrome | undefined;
  let launchBegan = false;
  let cleanupResolved = true;
  let serverStopped = false;
  let sourceCheckoutAbsent = false;
  let chromeStageAbsent = false;
  let profileAbsent = false;
  let closedAt = "";
  let collected: Record<string, unknown> | undefined;
  let primaryError: unknown;
  let cleanupError: unknown;
  try {
    const [commit, tree] = await Promise.all([
      command(
        "/usr/bin/git",
        ["rev-parse", `${PROTOBUF_SOURCE.commit}^{commit}`],
        new URL(".", root).pathname,
      ),
      command(
        "/usr/bin/git",
        ["rev-parse", `${PROTOBUF_SOURCE.commit}^{tree}`],
        new URL(".", root).pathname,
      ),
    ]);
    if (commit !== PROTOBUF_SOURCE.commit || tree !== PROTOBUF_SOURCE.tree) {
      throw new Error("accepted Protobuf source identity mismatch");
    }
    await command(
      "/usr/bin/git",
      ["worktree", "add", "--detach", checkout, PROTOBUF_SOURCE.commit],
      new URL(".", root).pathname,
    );
    worktreeAdded = true;
    for (const [route, file] of Object.entries(ROUTE_FILES)) {
      const digest = await sha256Hex(await Deno.readFile(`${checkout}/${file}`));
      if (digest !== PROTOBUF_ROUTE_HASHES[route as keyof typeof PROTOBUF_ROUTE_HASHES]) {
        throw new Error(`accepted route source hash mismatch: ${route}`);
      }
    }
    if (await command("/usr/bin/git", ["status", "--porcelain"], checkout)) {
      throw new Error("accepted source checkout is not clean");
    }
    const workload = await import(
      `${
        new URL(`file://${checkout}/benchmarks/base/serialization-protobuf-gateway/workload.js`)
          .href
      }?accepted=${suffix}`
    );
    const fixture = workload.generateFixture();
    const javascript = workload.runJavaScript(fixture);
    const wasm = await workload.runWasm(
      fixture,
      await Deno.readFile(
        `${checkout}/public/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm`,
      ),
    );
    const parentOracle = await buildProtobufParentOracle(fixture, javascript, wasm);
    const serverModule = await import(
      `${new URL(`file://${checkout}/server.ts`).href}?accepted=${suffix}`
    );
    const handler = serverModule.createHandler(null, "public");
    server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen: () => {} }, handler);
    const port = (server.addr as Deno.NetAddr).port;
    const origin = `http://127.0.0.1:${port}`;
    const health = await fetch(`${origin}/healthz`, { redirect: "error" });
    if (!health.ok) throw new Error("owned accepted-source server failed health check");
    stage = await stageChromePackage(
      PROTOBUF_CFT.sourceExecutable,
      PROTOBUF_CFT.binarySha256,
      {
        permitId: `protobuf-${suffix}`,
        sourceCommit: PROTOBUF_SOURCE.commit,
        chromePackageManifestSha256: PROTOBUF_CFT.packageManifestSha256,
      },
    );
    owned = await launchOwnedChrome({
      stagedChrome: stage,
      profileRoot: `/tmp/wasm-vs-js-owned-profiles/protobuf-${suffix}/launch`,
      extraArguments: [...PROTOBUF_CFT.extraArguments],
      onSpawn: () => {
        launchBegan = true;
        recordStageCleanupLifecycle(stage!, "owned-launch-active");
      },
    });
    if (owned.version.product !== PROTOBUF_CFT.product) {
      throw new Error("exact CfT version mismatch");
    }
    const effective = await owned.browser.send("Browser.getBrowserCommandLine");
    const effectiveArguments = effective.arguments;
    if (
      !Array.isArray(effectiveArguments) ||
      !owned.arguments.every((arg) => effectiveArguments.includes(arg))
    ) {
      throw new Error("exact effective CfT arguments mismatch");
    }
    const scenarios = [];
    for (const target of ["javascript", "wasm"] as const) {
      scenarios.push(await collectScenario(owned.browser, origin, outputRoot, target));
      owned.ledger = await refreshLedger(owned.ledger);
    }
    const version = owned.version;
    collected = {
      schemaVersion: 1,
      evidenceId,
      collectedAt: new Date().toISOString(),
      collectionCommand: COLLECTION_COMMAND,
      source: { ...PROTOBUF_SOURCE, routeHashes: PROTOBUF_ROUTE_HASHES },
      browser: {
        channel: PROTOBUF_CFT.channel,
        product: String(version.product),
        version: PROTOBUF_CFT.version,
        revision: String(version.revision),
        userAgent: String(version.userAgent),
        jsVersion: String(version.jsVersion),
        sourceExecutable: PROTOBUF_CFT.sourceExecutable,
        resolvedExecutable: owned.resolvedBinary,
        binarySha256: owned.binarySha256,
        packageManifestSha256: stage.manifestSha256,
        launchArguments: owned.arguments,
        effectiveArguments: effectiveArguments.map(String),
        protocol: "Chrome DevTools Protocol",
      },
      server: { origin, mode: "public", sourceCheckout: checkout, sessionOwnedByCollector: true },
      parentOracle,
      scenarios,
      ownership: {
        unit: owned.ledger.unit,
        controlGroup: owned.ledger.controlGroup,
        invocationId: owned.ledger.invocationId,
        cgroupDev: owned.ledger.cgroupDev,
        cgroupIno: owned.ledger.cgroupIno,
        mainPid: owned.ledger.mainPid,
        members: owned.ledger.members,
        membershipSnapshots: owned.ledger.membershipSnapshots,
      },
    };
  } catch (error) {
    if (error instanceof ChromeLaunchLifecycleError && error.launchBegan) {
      launchBegan = true;
      cleanupResolved = error.cleanupResolved;
      if (stage) {
        recordStageCleanupLifecycle(
          stage,
          cleanupResolved ? "cleanup-verified" : "cleanup-unresolved",
        );
      }
    }
    primaryError = error;
  } finally {
    if (owned) {
      try {
        const closed = await closeOwnedChrome(owned);
        closedAt = closed.stoppedAt;
        profileAbsent = !(await exists(owned.ledger.profileRoot));
        recordStageCleanupLifecycle(stage!, "cleanup-verified");
      } catch (error) {
        cleanupResolved = false;
        recordStageCleanupLifecycle(stage!, "cleanup-unresolved");
        cleanupError = error;
      }
    } else if (!launchBegan) profileAbsent = true;
    if (stage && cleanupResolved) {
      try {
        await removeStagedChrome(stage);
        chromeStageAbsent = !(await exists(stage.root)) && !(await exists(stage.ownerManifestPath));
      } catch (error) {
        cleanupError ??= error;
      }
    }
    if (server) {
      try {
        await server.shutdown();
        await server.finished;
        serverStopped = true;
      } catch (error) {
        cleanupError ??= error;
      }
    }
    if (worktreeAdded) {
      try {
        await command(
          "/usr/bin/git",
          ["worktree", "remove", "--force", checkout],
          new URL(".", root).pathname,
        );
        await Deno.remove(tempParent, { recursive: true });
        sourceCheckoutAbsent = !(await exists(tempParent));
      } catch (error) {
        cleanupError ??= error;
      }
    } else {
      await Deno.remove(tempParent, { recursive: true }).catch(() => {});
      sourceCheckoutAbsent = !(await exists(tempParent));
    }
    if (primaryError || cleanupError) {
      await Deno.remove(outputRoot, { recursive: true }).catch(() => {});
    }
  }
  if (cleanupError) throw cleanupError;
  if (primaryError) throw primaryError;
  if (!collected) throw new Error("protobuf browser collection produced no evidence");
  collected.cleanup = {
    browserCgroupEmpty: true,
    remainingPids: [],
    profileAbsent,
    chromeStageAbsent,
    serverStopped,
    sourceCheckoutAbsent,
    stoppedAt: closedAt || new Date().toISOString(),
  };
  try {
    assertProtobufBrowserEvidenceSemantics(collected);
    const schema = JSON.parse(
      await Deno.readTextFile(
        new URL("../schemas/protobuf-browser-evidence.schema.json", import.meta.url),
      ),
    );
    const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
    if (!validate(collected)) {
      throw new Error(`protobuf evidence schema mismatch: ${JSON.stringify(validate.errors)}`);
    }
    await writeArtifact(
      `${outputRoot}/evidence.v1.json`,
      encoder.encode(canonicalize(collected) + "\n"),
    );
    console.log(
      `${evidenceId}: authoritative Protobuf browser evidence collected with exact cleanup`,
    );
  } catch (error) {
    await Deno.remove(outputRoot, { recursive: true }).catch(() => {});
    throw error;
  }
}

await main();

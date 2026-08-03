import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

const root = new URL("../", import.meta.url);
const sourceCommit = Deno.args.find((value) => value.startsWith("--source-commit="))?.slice(16) ??
  "";
const chromeExecutable = Deno.args.find((value) => value.startsWith("--chrome="))?.slice(9) ?? "";
if (!/^[a-f0-9]{40}$/.test(sourceCommit) || !chromeExecutable || Deno.args.length !== 2) {
  throw new Error(
    "usage: validate-dom-virtualized-grid-browser.ts --source-commit=<40 hex> --chrome=<path>",
  );
}

async function commandText(command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(new TextDecoder().decode(output.stderr));
  return new TextDecoder().decode(output.stdout).trim();
}

const sourceTree = await commandText("git", ["rev-parse", `${sourceCommit}^{tree}`]);
const executable = await Deno.realPath(chromeExecutable);
const screenshotDir = new URL("evidence/browser/dom-virtualized-grid-v1/screenshots/", root);
await Deno.remove(new URL("evidence/browser/dom-virtualized-grid-v1/", root), {
  recursive: true,
}).catch(() => {});
await Deno.mkdir(screenshotDir, { recursive: true });

function unusedPort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

async function waitFor(url: string, timeoutMs = 10_000): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "error" });
      if (response.ok) return response;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${url} unavailable: ${last}`);
}

interface ProcessIdentity {
  pid: number;
  parentPid: number;
  startTimeTicks: string;
  executable: string;
}

async function processIdentity(pid: number): Promise<ProcessIdentity | null> {
  try {
    const stat = await Deno.readTextFile(`/proc/${pid}/stat`);
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return {
      pid,
      parentPid: Number(fields[1]),
      startTimeTicks: fields[19],
      executable: await Deno.realPath(`/proc/${pid}/exe`),
    };
  } catch {
    return null;
  }
}

async function ownedProcesses(rootPid: number): Promise<ProcessIdentity[]> {
  const identities: ProcessIdentity[] = [];
  for await (const entry of Deno.readDir("/proc")) {
    if (!entry.isDirectory || !/^\d+$/.test(entry.name)) continue;
    const identity = await processIdentity(Number(entry.name));
    if (identity) identities.push(identity);
  }
  const owned = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const identity of identities) {
      if (owned.has(identity.parentPid) && !owned.has(identity.pid)) {
        owned.add(identity.pid);
        changed = true;
      }
    }
  }
  return identities.filter((identity) => owned.has(identity.pid)).sort((a, b) => a.pid - b.pid);
}

async function identityStillRunning(identity: ProcessIdentity): Promise<boolean> {
  const current = await processIdentity(identity.pid);
  return current?.startTimeTicks === identity.startTimeTicks &&
    current.executable === identity.executable;
}

async function waitForOwnedExit(
  identities: ProcessIdentity[],
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await Promise.all(identities.map(identityStillRunning))).some(Boolean)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function click(client: CdpClient, sessionId: string, selector: string): Promise<void> {
  const evaluated = await client.send("Runtime.evaluate", {
    expression: `(() => { const node = document.querySelector(${
      JSON.stringify(selector)
    }); const r = node.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:node.disabled}; })()`,
    returnByValue: true,
  }, sessionId);
  const value = (evaluated.result as { value: { x: number; y: number; disabled: boolean } }).value;
  if (value.disabled) throw new Error(`${selector} is disabled`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: value.x,
    y: value.y,
    button: "left",
    clickCount: 1,
  }, sessionId);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: value.x,
    y: value.y,
    button: "left",
    clickCount: 1,
  }, sessionId);
}

async function pageState(client: CdpClient, sessionId: string) {
  const evaluated = await client.send("Runtime.evaluate", {
    expression:
      `(() => { const grid=document.querySelector('#grid'); return {status:document.querySelector('#status').textContent.trim(),result:document.querySelector('#result').textContent.trim(),startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled,mountedRows:grid.children.length,role:grid.getAttribute('role'),rowCount:grid.getAttribute('aria-rowcount'),selectedCount:grid.querySelectorAll('[aria-selected="true"]').length,activeDescendant:grid.getAttribute('aria-activedescendant'),focusedRow:grid.dataset.focusedRow,selectedRow:grid.dataset.selectedRow,activeElement:document.activeElement?.id||null,workerActive:document.documentElement.dataset.gridWorkerActive||"false"}; })()`,
    returnByValue: true,
  }, sessionId);
  return (evaluated.result as { value: Record<string, unknown> }).value;
}

async function waitForState(
  client: CdpClient,
  sessionId: string,
  predicate: (state: Record<string, unknown>) => boolean,
  timeoutMs = 35_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  let state: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    state = await pageState(client, sessionId);
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`browser state timeout: ${JSON.stringify(state)}`);
}

const serverPort = unusedPort();
const debuggerPort = unusedPort();
const origin = `http://127.0.0.1:${serverPort}`;
const server = new Deno.Command(Deno.execPath(), {
  cwd: root,
  args: [
    "run",
    "--allow-env=PORT,HOST,SERVER_MODE",
    "--allow-net=127.0.0.1",
    "--allow-read=.",
    "deploy.ts",
  ],
  env: { PORT: String(serverPort), HOST: "127.0.0.1", SERVER_MODE: "public" },
  stdout: "null",
  stderr: "null",
}).spawn();
const serverStatusPromise = server.status;
await waitFor(`${origin}/healthz`);

const profilePath = await Deno.makeTempDir({ prefix: "wasm-grid-chrome-" });
const launchArguments = [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-sync",
  "--metrics-recording-only",
  "--no-first-run",
  "--hide-scrollbars",
  "--window-size=1440,1200",
  "--remote-debugging-address=127.0.0.1",
  `--remote-debugging-port=${debuggerPort}`,
  `--user-data-dir=${profilePath}`,
  "about:blank",
];
const browserProcess = new Deno.Command(executable, {
  args: launchArguments,
  stdout: "null",
  stderr: "null",
}).spawn();
const browserStatusPromise = browserProcess.status;
let collectionComplete = false;
let emergencyClient: CdpClient | null = null;

try {
  const versionResponse = await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`);
  const discovery = await versionResponse.json();
  const webSocketUrl = new URL(discovery.webSocketDebuggerUrl);
  if (webSocketUrl.hostname !== "127.0.0.1" || Number(webSocketUrl.port) !== debuggerPort) {
    throw new Error("Chrome CDP endpoint escaped the owned loopback port");
  }
  const client = new CdpClient(webSocketUrl.href);
  emergencyClient = client;
  await client.ready();
  const browserVersion = await client.send("Browser.getVersion");
  if (browserVersion.product !== "Chrome/150.0.7871.24") {
    throw new Error(`unexpected browser ${browserVersion.product}`);
  }

  const scenarios = [
    {
      id: "grid-js-controlled",
      route: "/benchmarks/dom-virtualized-grid-v1/",
      target: "js-controlled",
      action: "complete",
    },
    {
      id: "grid-wasm-linear-controlled",
      route: "/benchmarks/dom-virtualized-grid-v1/",
      target: "wasm-linear-controlled",
      action: "complete",
    },
    {
      id: "grid-cancel-control",
      route: "/benchmarks/dom-virtualized-grid-v1/?demo-test=1",
      target: "js-controlled",
      action: "cancel",
    },
    {
      id: "grid-pagehide-control",
      route: "/benchmarks/dom-virtualized-grid-v1/?demo-test=1",
      target: "wasm-linear-controlled",
      action: "pagehide",
    },
    {
      id: "grid-cancel-stale-restart-control",
      route: "/benchmarks/dom-virtualized-grid-v1/?demo-test=1",
      target: "js-controlled",
      action: "restart",
    },
  ] as const;

  const records = [];
  for (const scenario of scenarios) {
    const created = await client.send("Target.createTarget", { url: "about:blank" });
    const targetId = String(created.targetId);
    const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = String(attached.sessionId);
    const consoleMessages: Array<Record<string, unknown>> = [];
    const exceptions: Array<Record<string, unknown>> = [];
    const requests = new Map<string, Record<string, unknown>>();
    const observedSessions = new Set([sessionId]);
    const workerAttachTasks: Promise<void>[] = [];
    const removers = [
      client.on("Target.attachedToTarget", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        const targetInfo = params.targetInfo as Record<string, unknown>;
        if (targetInfo.type !== "worker") return;
        const workerSession = String(params.sessionId);
        observedSessions.add(workerSession);
        workerAttachTasks.push((async () => {
          await client.send("Network.enable", {}, workerSession);
          await client.send("Runtime.runIfWaitingForDebugger", {}, workerSession);
        })());
      }),
      client.on("Runtime.consoleAPICalled", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        consoleMessages.push({
          type: String(params.type),
          arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((arg) =>
            String(arg.value ?? arg.description ?? arg.type)
          ),
        });
      }),
      client.on("Runtime.exceptionThrown", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        const details = params.exceptionDetails as Record<string, unknown>;
        exceptions.push({ text: String(details.text), lineNumber: Number(details.lineNumber) });
      }),
      client.on("Network.requestWillBeSent", (params, eventSession) => {
        if (!eventSession || !observedSessions.has(eventSession)) return;
        const request = params.request as Record<string, unknown>;
        requests.set(String(params.requestId), {
          url: String(request.url),
          method: String(request.method),
          type: String(params.type),
          status: null,
          mimeType: null,
          fromDiskCache: false,
          fromServiceWorker: false,
          failed: false,
          errorText: null,
        });
      }),
      client.on("Network.responseReceived", (params, eventSession) => {
        if (!eventSession || !observedSessions.has(eventSession)) return;
        const record = requests.get(String(params.requestId));
        const response = params.response as Record<string, unknown>;
        if (record) {
          Object.assign(record, {
            status: Number(response.status),
            mimeType: String(response.mimeType),
            fromDiskCache: Boolean(response.fromDiskCache),
            fromServiceWorker: Boolean(response.fromServiceWorker),
          });
        }
      }),
      client.on("Network.loadingFailed", (params, eventSession) => {
        if (!eventSession || !observedSessions.has(eventSession)) return;
        const record = requests.get(String(params.requestId));
        if (record) Object.assign(record, { failed: true, errorText: String(params.errorText) });
      }),
    ];
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
      client.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
      }, sessionId),
    ]);
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("page load timeout")), 10_000);
      const remove = client.on("Page.loadEventFired", (_params, eventSession) => {
        if (eventSession !== sessionId) return;
        clearTimeout(timer);
        remove();
        resolve();
      });
    });
    await client.send("Page.navigate", { url: `${origin}${scenario.route}` }, sessionId);
    await loaded;
    await waitForState(
      client,
      sessionId,
      (state) => state.status === "Ready. No worker is running.",
    );
    await client.send("Runtime.evaluate", {
      expression: `(() => { const select=document.querySelector('#target'); select.value=${
        JSON.stringify(scenario.target)
      }; select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
    }, sessionId);
    await click(client, sessionId, "#start");
    let finalState;
    if (
      scenario.action === "cancel" || scenario.action === "pagehide" ||
      scenario.action === "restart"
    ) {
      await waitForState(client, sessionId, (state) => String(state.status).startsWith("Running "));
      const attachDeadline = Date.now() + 2_000;
      while (workerAttachTasks.length === 0 && Date.now() < attachDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await Promise.all(workerAttachTasks);
      const workerAssetDeadline = Date.now() + 2_000;
      while (
        Date.now() < workerAssetDeadline &&
        ![...requests.values()].some((request) =>
          String(request.url).endsWith("/engine.js") && request.status === 200
        )
      ) await new Promise((resolve) => setTimeout(resolve, 10));
      if (scenario.action === "cancel" || scenario.action === "restart") {
        await click(client, sessionId, "#cancel");
        finalState = await waitForState(
          client,
          sessionId,
          (state) => String(state.status).startsWith("Canceled."),
        );
        if (scenario.action === "restart") {
          await client.send("Runtime.evaluate", {
            expression: "document.querySelector('#target').value='wasm-linear-controlled'",
          }, sessionId);
          await click(client, sessionId, "#start");
          await client.send("Runtime.evaluate", {
            expression: "globalThis.__gridDemoTest.injectWrongToken()",
          }, sessionId);
          const afterInjection = await pageState(client, sessionId);
          if (!String(afterInjection.status).startsWith("Running ")) {
            throw new Error("wrong-token injection changed the active run");
          }
          finalState = await waitForState(
            client,
            sessionId,
            (state) => String(state.status).includes(" completed;"),
          );
        }
      } else {
        await client.send("Runtime.evaluate", {
          expression: "dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))",
        }, sessionId);
        finalState = await waitForState(
          client,
          sessionId,
          (state) => state.workerActive === "false",
        );
      }
    } else {
      finalState = await waitForState(
        client,
        sessionId,
        (state) => String(state.status).includes(" completed;"),
      );
    }
    await Promise.all(workerAttachTasks);
    const networkDeadline = Date.now() + 2_000;
    while (
      Date.now() < networkDeadline &&
      [...requests.values()].some((request) => request.status === null && !request.failed)
    ) await new Promise((resolve) => setTimeout(resolve, 25));
    const assertions = scenario.action === "cancel"
      ? [
        "visible Start control entered running state",
        "visible Cancel control terminated the worker",
        "result remained hidden",
      ]
      : scenario.action === "pagehide"
      ? [
        "visible Start control entered running state",
        "an actual pagehide event terminated the active worker",
        "worker-active lifecycle state became false",
      ]
      : scenario.action === "restart"
      ? [
        "run A was canceled while deliberately held",
        "run B started with a fresh worker and token",
        "a wrong-token message was injected through the live message handler and ignored",
        "run B completed after the stale-message window",
      ]
      : [
        "visible Start control completed",
        "oracle and exact work counters matched",
        "typed commands physically mutated at most 28 actual row nodes",
        "actual DOM role and 100,000-row accessibility metadata matched",
        "focus and selection state were retained from the executed trace",
        "canonical browser DOM SHA-256 was retained",
      ];
    if (exceptions.length > 0) throw new Error(`${scenario.id} raised browser exceptions`);
    if ([...requests.values()].some((request) => request.failed || request.status !== 200)) {
      throw new Error(
        `${scenario.id} had a failed/non-200 network request: ${
          JSON.stringify([...requests.values()])
        }`,
      );
    }
    if (scenario.action === "complete" || scenario.action === "restart") {
      if (!String(finalState.result).includes("Browser DOM SHA-256")) {
        throw new Error(`${scenario.id} omitted the browser DOM oracle`);
      }
      if (Number(finalState.mountedRows) < 1 || Number(finalState.mountedRows) > 28) {
        throw new Error(`${scenario.id} violated the mounted-row bound`);
      }
      if (finalState.role !== "grid" || finalState.rowCount !== "100000") {
        throw new Error(`${scenario.id} accessibility grid metadata mismatch`);
      }
      if (
        !/^\d+$/.test(String(finalState.focusedRow)) ||
        !/^\d+$/.test(String(finalState.selectedRow))
      ) {
        throw new Error(`${scenario.id} omitted focus/selection model state`);
      }
      const parsed = JSON.parse(String(finalState.result));
      if (
        parsed.commandCount !== 4252 || parsed.modelCounters.events !== 300 ||
        parsed.modelCounters.layoutReads !== 300
      ) {
        throw new Error(`${scenario.id} exact counters mismatch`);
      }
      if (
        JSON.stringify(parsed.actualPhysicalCounters) !== JSON.stringify({
          physicalCreates: 28,
          physicalReuses: 3764,
          physicalUpdates: 2,
          physicalPlacements: 92,
          physicalHides: 64,
          focusOperations: 2,
          layoutReads: 300,
        })
      ) throw new Error(`${scenario.id} physical mutation counters mismatch`);
    }
    const screenshot = await client.send(
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
      atob(String(screenshot.data)),
      (char) => char.charCodeAt(0),
    );
    const screenshotPath =
      `evidence/browser/dom-virtualized-grid-v1/screenshots/${scenario.id}.png`;
    await Deno.writeFile(new URL(screenshotPath, root), screenshotBytes);
    records.push({
      ...scenario,
      finalStatus: String(finalState.status),
      resultTextSha256: await sha256Hex(new TextEncoder().encode(String(finalState.result))),
      assertions,
      console: consoleMessages,
      exceptions,
      network: [...requests.values()],
      screenshot: {
        path: screenshotPath,
        bytes: screenshotBytes.byteLength,
        sha256: await sha256Hex(screenshotBytes),
      },
    });
    for (const remove of removers) remove();
    await client.send("Target.closeTarget", { targetId });
  }

  const observedProcesses = await ownedProcesses(browserProcess.pid);
  const launcherIdentity = observedProcesses.find((identity) =>
    identity.pid === browserProcess.pid
  );
  if (!launcherIdentity) {
    throw new Error("owned Chrome launcher identity disappeared before cleanup");
  }
  await client.send("Browser.close");
  client.close();
  const signals: Array<{ pid: number; signal: string }> = [];
  if (!(await waitForOwnedExit(observedProcesses, 10_000))) {
    for (const identity of [...observedProcesses].reverse()) {
      if (await identityStillRunning(identity)) {
        Deno.kill(identity.pid, "SIGTERM");
        signals.push({ pid: identity.pid, signal: "SIGTERM" });
      }
    }
  }
  if (!(await waitForOwnedExit(observedProcesses, 5_000))) {
    for (const identity of [...observedProcesses].reverse()) {
      if (await identityStillRunning(identity)) {
        Deno.kill(identity.pid, "SIGKILL");
        signals.push({ pid: identity.pid, signal: "SIGKILL" });
      }
    }
  }
  const processesAbsent = await waitForOwnedExit(observedProcesses, 5_000);
  const browserExit = await browserStatusPromise;
  if (!processesAbsent) throw new Error("owned Chrome processes survived exact cleanup");
  await Deno.remove(profilePath, { recursive: true });
  let profileAbsent = false;
  try {
    await Deno.lstat(profilePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) profileAbsent = true;
    else throw error;
  }
  if (!profileAbsent) throw new Error("owned Chrome profile survived cleanup");

  const serverIdentity = await processIdentity(server.pid);
  if (serverIdentity) Deno.kill(server.pid, "SIGTERM");
  const serverExit = await serverStatusPromise;
  const serverAbsent = serverIdentity ? !(await identityStillRunning(serverIdentity)) : true;
  if (!serverAbsent) throw new Error("owned evidence server survived cleanup");

  const evidence = {
    schemaVersion: 1,
    evidenceId: "dom-virtualized-grid-v1-chrome-150",
    collectedAt: new Date().toISOString(),
    source: { commit: sourceCommit, tree: sourceTree },
    collectionCommand:
      `deno run -A scripts/validate-dom-virtualized-grid-browser.ts --source-commit=${sourceCommit} --chrome=${chromeExecutable}`,
    browser: {
      product: String(browserVersion.product),
      revision: String(browserVersion.revision),
      userAgent: String(browserVersion.userAgent),
      jsVersion: String(browserVersion.jsVersion),
      executable,
      launchArguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
    },
    server: { origin, mode: "public", launcherPid: server.pid },
    scenarios: records,
    cleanup: {
      browser: {
        launcher: launcherIdentity,
        observedProcesses,
        requested: "Browser.close",
        signals,
        exit: browserExit,
        processesAbsent,
      },
      profile: { path: profilePath, removed: true, absent: profileAbsent },
      server: {
        launcher: serverIdentity,
        signal: serverIdentity ? "SIGTERM" : null,
        exit: serverExit,
        processAbsent: serverAbsent,
      },
    },
  };
  await Deno.writeTextFile(
    new URL("evidence/browser/dom-virtualized-grid-v1/evidence.v1.json", root),
    `${canonicalize(evidence)}\n`,
  );
  collectionComplete = true;
  console.log(
    `dom-virtualized-grid-browser-evidence: ${records.length} scenarios; owned cleanup exact`,
  );
} finally {
  if (!collectionComplete) {
    try {
      await emergencyClient?.send("Browser.close");
    } catch {
      // Continue with exact identity-bound cleanup.
    }
    emergencyClient?.close();
    const failedRunProcesses = await ownedProcesses(browserProcess.pid);
    if (!(await waitForOwnedExit(failedRunProcesses, 2_000))) {
      for (const identity of [...failedRunProcesses].reverse()) {
        if (await identityStillRunning(identity)) Deno.kill(identity.pid, "SIGTERM");
      }
    }
    if (!(await waitForOwnedExit(failedRunProcesses, 2_000))) {
      for (const identity of [...failedRunProcesses].reverse()) {
        if (await identityStillRunning(identity)) Deno.kill(identity.pid, "SIGKILL");
      }
    }
    await browserStatusPromise.catch(() => {});
    const failedServer = await processIdentity(server.pid);
    if (failedServer && await identityStillRunning(failedServer)) Deno.kill(server.pid, "SIGTERM");
    await serverStatusPromise.catch(() => {});
    await Deno.remove(profilePath, { recursive: true }).catch(() => {});
  }
}

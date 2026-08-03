import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";
import {
  CHECKPOINT_STEPS,
  COUNTERS,
  TIMESTEPS,
  VARIANTS,
} from "../benchmarks/base/simulation-nbody/contract.js";

const root = new URL("../", import.meta.url);
const workloadRoute = "/demos/simulation-nbody-cloth/";
const expectedProduct = /^Chrome\/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/;
const expectedDigests = {
  completeOutputDigest: "00136c5b760c3794",
  quantizedStateDigest: "5c5c1eca3fffb709",
};

export const COLLECTOR_SOURCE_PATHS = [
  "scripts/collect-base-simulation-nbody-evidence.ts",
  "lib/canonical.ts",
  "lib/cdp-client.ts",
  "deploy.ts",
  "server.ts",
  "benchmarks/base/simulation-nbody/contract.js",
  "benchmarks/base/simulation-nbody/fixture.js",
  "benchmarks/base/simulation-nbody/engine.js",
  "public/demos/simulation-nbody-cloth/index.html",
  "public/demos/simulation-nbody-cloth/demo.js",
  "public/demos/simulation-nbody-cloth/worker.js",
  "public/styles.css",
  "public/artifacts/base-simulation-nbody/nbody.wasm",
  "public/artifacts/base-simulation-nbody/build-manifest.json",
  "schemas/base-simulation-nbody-browser-evidence.schema.json",
] as const;

export const EXECUTED_ROUTE_PATHS: Readonly<Record<string, string>> = Object.freeze({
  "/demos/simulation-nbody-cloth/": "public/demos/simulation-nbody-cloth/index.html",
  "/demos/simulation-nbody-cloth/demo.js": "public/demos/simulation-nbody-cloth/demo.js",
  "/demos/simulation-nbody-cloth/worker.js": "public/demos/simulation-nbody-cloth/worker.js",
  "/benchmarks/base/simulation-nbody/contract.js": "benchmarks/base/simulation-nbody/contract.js",
  "/benchmarks/base/simulation-nbody/fixture.js": "benchmarks/base/simulation-nbody/fixture.js",
  "/benchmarks/base/simulation-nbody/engine.js": "benchmarks/base/simulation-nbody/engine.js",
  "/artifacts/base-simulation-nbody/nbody.wasm":
    "public/artifacts/base-simulation-nbody/nbody.wasm",
  "/styles.css": "public/styles.css",
});

export const SCENARIOS = Object.freeze(
  [
    { id: "js-controlled-complete", target: "js-controlled", action: "complete" },
    { id: "wasm-linear-controlled-complete", target: "wasm-linear-controlled", action: "complete" },
    { id: "cancel-lifecycle", target: "js-controlled", action: "cancel" },
    { id: "timeout-lifecycle", target: "js-controlled", action: "timeout" },
    { id: "pagehide-lifecycle", target: "js-controlled", action: "pagehide" },
  ] as const,
);

type Scenario = (typeof SCENARIOS)[number];
type ProcessIdentity = {
  pid: number;
  parentPid: number;
  startTimeTicks: string;
  executable: string;
};
type NetworkRecord = {
  requestId: string;
  sessionId: string;
  url: string;
  method: string;
  type: string;
  status: number | null;
  mimeType: string | null;
  fromDiskCache: boolean;
  fromServiceWorker: boolean;
  failed: boolean;
  errorText: string | null;
};

async function commandText(command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) {
    throw new Error(`${command} failed: ${new TextDecoder().decode(output.stderr).trim()}`);
  }
  return new TextDecoder().decode(output.stdout).trim();
}

export function assertCleanStatus(status: string): void {
  const dirty = status.split("\0").filter(Boolean);
  if (dirty.length) {
    const path = dirty[0].length > 3 ? dirty[0].slice(3) : dirty[0];
    throw new Error(`collection requires a clean checkout: ${path}`);
  }
}

async function fileRecord(path: string) {
  const bytes = await Deno.readFile(new URL(path, root));
  return { path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) };
}

async function assertCleanHead(sourceCommit: string) {
  const head = await commandText("git", ["rev-parse", "HEAD"]);
  if (sourceCommit !== head) throw new Error("--source-commit does not match HEAD");
  const status = await new Deno.Command("git", {
    cwd: root,
    args: ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!status.success) throw new Error("git status failed");
  assertCleanStatus(new TextDecoder().decode(status.stdout));
  const files = [];
  for (const path of COLLECTOR_SOURCE_PATHS) {
    const disk = await Deno.readFile(new URL(path, root));
    const committed = await new Deno.Command("git", {
      cwd: root,
      args: ["show", `${sourceCommit}:${path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!committed.success || await sha256Hex(committed.stdout) !== await sha256Hex(disk)) {
      throw new Error(`committed source bytes differ from checkout: ${path}`);
    }
    files.push(await fileRecord(path));
  }
  return {
    commit: sourceCommit,
    tree: await commandText("git", ["rev-parse", `${sourceCommit}^{tree}`]),
    files,
  };
}

export function parseTextOracle(text: string, variant: string) {
  const target = text.match(/^Target: (.+)$/m)?.[1];
  const completeOutputDigest = text.match(/^Complete output digest: ([a-f0-9]{16})$/m)?.[1];
  const quantizedStateDigest = text.match(/^Quantized state digest: ([a-f0-9]{16})$/m)?.[1];
  const checkpointsText = text.match(/^Checkpoints: ([0-9, ]+)$/m)?.[1];
  const energy = text.match(/^Energy relative drift: ([0-9.eE+-]+) \(limit ([0-9.eE+-]+)\)$/m);
  const countersText = text.slice(text.indexOf("Counters:\n") + "Counters:\n".length);
  if (
    target !== variant || completeOutputDigest !== expectedDigests.completeOutputDigest ||
    quantizedStateDigest !== expectedDigests.quantizedStateDigest || !checkpointsText || !energy ||
    !text.includes("Counters:\n")
  ) throw new Error("text result omitted or changed the exact oracle");
  const checkpoints = checkpointsText.split(",").map((value) => Number(value.trim()));
  if (JSON.stringify(checkpoints) !== JSON.stringify(CHECKPOINT_STEPS)) {
    throw new Error("text result checkpoints differ from the accepted contract");
  }
  const counters = JSON.parse(countersText) as Record<string, number>;
  const expectedCounters = {
    ...COUNTERS,
    allocations: variant === "js-controlled" ? 5 : 0,
    boundaryCrossings: variant === "js-controlled" ? 0 : 2,
  };
  if (
    Object.keys(counters).sort().join("\0") !== Object.keys(expectedCounters).sort().join("\0") ||
    Object.entries(expectedCounters).some(([name, value]) => counters[name] !== value)
  ) throw new Error("text result counters differ from the 14-counter accepted contract");
  const relativeDrift = Number(energy[1]), tolerance = Number(energy[2]);
  if (!Number.isFinite(relativeDrift) || relativeDrift < 0 || tolerance !== 0.0000012) {
    throw new Error("text result energy oracle differs from the accepted contract");
  }
  return {
    rendering: "text-only",
    variantId: variant,
    completeOutputDigest,
    quantizedStateDigest,
    checkpoints,
    energy: { relativeDrift, tolerance },
    counters,
    counterCount: Object.keys(counters).length,
    text,
    textSha256: "",
  };
}

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
  const point = (evaluated.result as { value: { x: number; y: number; disabled: boolean } }).value;
  if (point.disabled) throw new Error(`${selector} is disabled`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await client.send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1,
    }, sessionId);
  }
}

async function pageState(client: CdpClient, sessionId: string) {
  const evaluated = await client.send("Runtime.evaluate", {
    expression:
      `(() => ({status:document.querySelector('#status').textContent.trim(),result:document.querySelector('#result').textContent,startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled}))()`,
    returnByValue: true,
  }, sessionId);
  return (evaluated.result as { value: Record<string, unknown> }).value;
}

async function waitForState(
  client: CdpClient,
  sessionId: string,
  predicate: (state: Record<string, unknown>) => boolean,
  timeoutMs = 35_000,
) {
  const deadline = Date.now() + timeoutMs;
  let state: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    state = await pageState(client, sessionId);
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`browser state timeout: ${JSON.stringify(state)}`);
}

async function accessibilityEvidence(client: CdpClient, sessionId: string) {
  const factsResult = await client.send("Runtime.evaluate", {
    expression:
      `(() => ({language:document.documentElement.lang,main:Boolean(document.querySelector('main#content')),heading:document.querySelector('h1')?.textContent.trim(),targetLabel:document.querySelector('label[for=target]')?.textContent.trim(),startName:document.querySelector('#start')?.textContent.trim(),cancelName:document.querySelector('#cancel')?.textContent.trim(),statusRole:document.querySelector('#status')?.getAttribute('role'),statusLive:document.querySelector('#status')?.getAttribute('aria-live'),resultTabIndex:document.querySelector('#result')?.tabIndex}))()`,
    returnByValue: true,
  }, sessionId);
  const facts = (factsResult.result as { value: Record<string, unknown> }).value;
  const tree = await client.send("Accessibility.getFullAXTree", {}, sessionId);
  const nodes = (tree.nodes as Array<Record<string, unknown>>) ?? [];
  const axValues = nodes.map((node) => ({
    role: String((node.role as { value?: unknown })?.value ?? ""),
    name: String((node.name as { value?: unknown })?.value ?? ""),
  }));
  const assertions = {
    languageEnglish: facts.language === "en",
    mainLandmark: facts.main === true && axValues.some((node) => node.role === "main"),
    namedHeading: facts.heading === "Direct N-body leapfrog validation" &&
      axValues.some((node) => node.role === "heading" && node.name === facts.heading),
    labelledTarget: facts.targetLabel === "Engine" &&
      axValues.some((node) => node.role === "combobox" && node.name === "Engine"),
    namedControls: facts.startName === "Start" && facts.cancelName === "Cancel" &&
      axValues.some((node) => node.role === "button" && node.name === "Start") &&
      axValues.some((node) => node.role === "button" && node.name === "Cancel"),
    liveStatus: facts.statusRole === "status" && facts.statusLive === "polite",
    keyboardResult: facts.resultTabIndex === 0,
  };
  if (Object.values(assertions).some((value) => !value)) {
    throw new Error(`accessibility assertion failed: ${JSON.stringify(assertions)}`);
  }
  return { inspectedAxNodes: nodes.length, assertions };
}

function outputPaths(output: string, scenarioId: string) {
  const separator = output.lastIndexOf("/");
  const directory = separator < 0 ? "." : output.slice(0, separator);
  const basename = output.slice(separator + 1).replace(/\.json$/u, "");
  return {
    directory,
    screenshotDirectory: `${directory}/${basename}.screenshots`,
    screenshot: `${directory}/${basename}.screenshots/${scenarioId}.png`,
  };
}

async function collectScenario(
  client: CdpClient,
  origin: string,
  scenario: Scenario,
  output: string,
) {
  const created = await client.send("Target.createTarget", { url: "about:blank" });
  const targetId = String(created.targetId);
  const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = String(attached.sessionId);
  const observedSessions = new Set([sessionId]);
  const attachTasks: Promise<void>[] = [];
  const responseTasks: Promise<void>[] = [];
  const requests = new Map<string, NetworkRecord>();
  const executedAssets = new Map<string, Record<string, unknown>>();
  const consoleMessages: Array<Record<string, unknown>> = [];
  const exceptions: Array<Record<string, unknown>> = [];
  const key = (eventSession: string | undefined, requestId: unknown) =>
    `${eventSession ?? ""}:${String(requestId)}`;
  const removers = [
    client.on("Target.attachedToTarget", (params, eventSession) => {
      if (eventSession !== sessionId) return;
      const targetInfo = params.targetInfo as Record<string, unknown>;
      if (targetInfo.type !== "worker") return;
      const workerSession = String(params.sessionId);
      observedSessions.add(workerSession);
      attachTasks.push((async () => {
        await Promise.all([
          client.send("Network.enable", {}, workerSession),
          client.send("Network.setCacheDisabled", { cacheDisabled: true }, workerSession),
          client.send("Runtime.enable", {}, workerSession),
        ]);
        await client.send("Runtime.runIfWaitingForDebugger", {}, workerSession);
      })());
    }),
    client.on("Runtime.consoleAPICalled", (params, eventSession) => {
      if (!eventSession || !observedSessions.has(eventSession)) return;
      consoleMessages.push({
        session: eventSession === sessionId ? "page" : "worker",
        type: String(params.type),
        arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((arg) =>
          String(arg.value ?? arg.description ?? arg.type)
        ),
      });
    }),
    client.on("Runtime.exceptionThrown", (params, eventSession) => {
      if (!eventSession || !observedSessions.has(eventSession)) return;
      const details = params.exceptionDetails as Record<string, unknown>;
      exceptions.push({
        session: eventSession === sessionId ? "page" : "worker",
        text: String(details.text),
        lineNumber: Number(details.lineNumber),
      });
    }),
    client.on("Network.requestWillBeSent", (params, eventSession) => {
      if (!eventSession || !observedSessions.has(eventSession)) return;
      const request = params.request as Record<string, unknown>;
      requests.set(key(eventSession, params.requestId), {
        requestId: String(params.requestId),
        sessionId: eventSession,
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
      const record = requests.get(key(eventSession, params.requestId));
      if (!record) return;
      const response = params.response as Record<string, unknown>;
      Object.assign(record, {
        status: Number(response.status),
        mimeType: String(response.mimeType),
        fromDiskCache: Boolean(response.fromDiskCache),
        fromServiceWorker: Boolean(response.fromServiceWorker),
      });
    }),
    client.on("Network.loadingFailed", (params, eventSession) => {
      const record = requests.get(key(eventSession, params.requestId));
      if (record) Object.assign(record, { failed: true, errorText: String(params.errorText) });
    }),
    client.on("Network.loadingFinished", (params, eventSession) => {
      const record = requests.get(key(eventSession, params.requestId));
      if (!record || !eventSession) return;
      let route: string;
      try {
        route = new URL(record.url).pathname;
      } catch {
        return;
      }
      const sourcePath = EXECUTED_ROUTE_PATHS[route];
      if (!sourcePath) return;
      responseTasks.push((async () => {
        const response = await client.send(
          "Network.getResponseBody",
          { requestId: String(params.requestId) },
          eventSession,
        );
        const body = String(response.body);
        const bytes = response.base64Encoded
          ? Uint8Array.from(atob(body), (character) => character.charCodeAt(0))
          : new TextEncoder().encode(body);
        const disk = await Deno.readFile(new URL(sourcePath, root));
        const digest = await sha256Hex(bytes);
        if (bytes.byteLength !== disk.byteLength || digest !== await sha256Hex(disk)) {
          throw new Error(`served response bytes differ from clean HEAD: ${route}`);
        }
        executedAssets.set(route, {
          route,
          sourcePath,
          bytes: bytes.byteLength,
          sha256: digest,
          cdpBodyEncoding: response.base64Encoded ? "base64" : "utf8",
        });
      })());
    }),
  ];
  try {
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
      client.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId),
      client.send("Accessibility.enable", {}, sessionId),
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
    await client.send("Page.navigate", { url: `${origin}${workloadRoute}` }, sessionId);
    await loaded;
    await waitForState(
      client,
      sessionId,
      (state) => String(state.status) === "Ready. The worker stops after 30 seconds.",
    );
    await client.send("Runtime.evaluate", {
      expression: `(() => { const select=document.querySelector('#target'); select.value=${
        JSON.stringify(scenario.target)
      }; select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
    }, sessionId);

    const lifecycleInjection = scenario.action === "complete"
      ? { kind: "none", expression: null }
      : scenario.action === "timeout"
      ? {
        kind: "timeout-shortening",
        expression:
          `(() => { const native=globalThis.setTimeout; globalThis.setTimeout=(callback,delay,...args)=>native(callback,delay===30000?1:delay,...args); })()`,
      }
      : scenario.action === "pagehide"
      ? {
        kind: "pagehide-dispatch",
        expression: `dispatchEvent(new PageTransitionEvent('pagehide'))`,
      }
      : { kind: "visible-cancel-control", expression: null };
    if (scenario.action === "timeout") {
      await client.send(
        "Runtime.evaluate",
        { expression: lifecycleInjection.expression! },
        sessionId,
      );
    }
    await click(client, sessionId, "#start");
    let finalState: Record<string, unknown>;
    if (scenario.action === "complete") {
      finalState = await waitForState(
        client,
        sessionId,
        (state) => state.status === "Complete. Correctness output only; no duration was collected.",
      );
    } else if (scenario.action === "cancel") {
      await waitForState(client, sessionId, (state) => String(state.status).startsWith("Running "));
      await click(client, sessionId, "#cancel");
      finalState = await waitForState(
        client,
        sessionId,
        (state) => state.status === "Cancelled. The worker was terminated.",
      );
    } else if (scenario.action === "timeout") {
      finalState = await waitForState(
        client,
        sessionId,
        (state) => state.status === "Stopped after the 30-second correctness timeout.",
      );
    } else {
      await waitForState(client, sessionId, (state) => String(state.status).startsWith("Running "));
      await client.send(
        "Runtime.evaluate",
        { expression: lifecycleInjection.expression! },
        sessionId,
      );
      finalState = await waitForState(
        client,
        sessionId,
        (state) => state.startDisabled === false && state.cancelDisabled === true,
      );
    }
    await Promise.all(attachTasks);
    const requiredAssets = scenario.action === "complete"
      ? [
        workloadRoute,
        "/styles.css",
        "/demos/simulation-nbody-cloth/demo.js",
        "/demos/simulation-nbody-cloth/worker.js",
        "/benchmarks/base/simulation-nbody/contract.js",
        "/benchmarks/base/simulation-nbody/fixture.js",
        "/benchmarks/base/simulation-nbody/engine.js",
        ...(scenario.target === "wasm-linear-controlled"
          ? ["/artifacts/base-simulation-nbody/nbody.wasm"]
          : []),
      ]
      : [workloadRoute, "/styles.css", "/demos/simulation-nbody-cloth/demo.js"];
    const networkDeadline = Date.now() + 2_000;
    while (
      Date.now() < networkDeadline &&
      ([...requests.values()].some((request) => request.status === null && !request.failed) ||
        requiredAssets.some((route) => !executedAssets.has(route)))
    ) await new Promise((resolve) => setTimeout(resolve, 25));
    await Promise.all(responseTasks);

    if (exceptions.length || consoleMessages.some((message) => message.type === "error")) {
      throw new Error(`${scenario.id} produced console errors or exceptions`);
    }
    const network = [...requests.values()].map((
      { requestId: _requestId, sessionId: _sessionId, ...r },
    ) => r);
    if (
      network.some((request) =>
        request.failed || request.status !== 200 || request.fromServiceWorker ||
        new URL(request.url).origin !== origin
      )
    ) throw new Error(`${scenario.id} had foreign, failed, non-200, or Service Worker traffic`);

    let oracle = null;
    if (scenario.action === "complete") {
      oracle = parseTextOracle(String(finalState.result), scenario.target);
      oracle.textSha256 = await sha256Hex(new TextEncoder().encode(oracle.text));
      for (const route of requiredAssets) {
        if (!executedAssets.has(route)) throw new Error(`executed response body absent: ${route}`);
      }
    } else if (String(finalState.result) !== "No completed result.") {
      throw new Error(`${scenario.id} exposed a result after lifecycle termination`);
    }

    const accessibility = await accessibilityEvidence(client, sessionId);
    const screenshotResult = await client.send(
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
      atob(String(screenshotResult.data)),
      (character) => character.charCodeAt(0),
    );
    const paths = outputPaths(output, scenario.id);
    await Deno.mkdir(paths.screenshotDirectory, { recursive: true });
    await Deno.writeFile(paths.screenshot, screenshotBytes, { createNew: true });
    return {
      ...scenario,
      route: workloadRoute,
      lifecycleInjection,
      finalState,
      oracle,
      console: consoleMessages,
      exceptions,
      network,
      executedAssets: [...executedAssets.values()].sort((a, b) =>
        String(a.route).localeCompare(String(b.route))
      ),
      accessibility,
      screenshot: {
        path: paths.screenshot,
        bytes: screenshotBytes.byteLength,
        sha256: await sha256Hex(screenshotBytes),
      },
    };
  } finally {
    for (const remove of removers) remove();
    await client.send("Target.closeTarget", { targetId }).catch(() => ({}));
  }
}

async function runCollector() {
  const options = Object.fromEntries(
    Deno.args.map((argument) => {
      const match = argument.match(/^--([a-z-]+)=(.+)$/u);
      if (!match) throw new Error(`invalid argument: ${argument}`);
      return [match[1], match[2]];
    }),
  );
  if (
    Deno.args.length !== 3 || !/^[a-f0-9]{40}$/.test(options["source-commit"] ?? "") ||
    !options.chrome || !options.output || !options.output.endsWith(".json")
  ) {
    throw new Error(
      "usage: collect-base-simulation-nbody-evidence.ts --source-commit=<clean HEAD> --chrome=<path> --output=<new .json path>",
    );
  }
  const output = options.output;
  const generatedPaths = outputPaths(output, "unused");
  for (const path of [output, generatedPaths.screenshotDirectory]) {
    try {
      await Deno.lstat(path);
      throw new Error("output already exists; browser evidence is immutable");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  const source = await assertCleanHead(options["source-commit"]);
  const buildManifest = JSON.parse(
    await Deno.readTextFile(
      new URL("public/artifacts/base-simulation-nbody/build-manifest.json", root),
    ),
  );
  if (!/^[a-f0-9]{40}$/.test(buildManifest.source.commit)) {
    throw new Error("accepted static build manifest source commit is invalid");
  }
  const chromeExecutable = await Deno.realPath(options.chrome);
  const chromeIdentity = await fileRecord(chromeExecutable);
  const executableInfo = await Deno.stat(chromeExecutable);
  if (!executableInfo.isFile) throw new Error("Chrome executable is not a regular file");

  const serverPort = unusedPort(), debuggerPort = unusedPort();
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
  const serverStatus = server.status;
  await waitFor(`${origin}/healthz`);

  const profilePath = await Deno.makeTempDir({ prefix: "wasm-nbody-chrome-" });
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
    "--enable-automation",
    "--disable-cache",
    "--window-size=1440,1200",
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${debuggerPort}`,
    `--user-data-dir=${profilePath}`,
    "about:blank",
  ];
  const browserProcess = new Deno.Command(chromeExecutable, {
    args: launchArguments,
    stdout: "null",
    stderr: "null",
  }).spawn();
  const browserStatus = browserProcess.status;
  let client: CdpClient | null = null;
  let completed = false;
  try {
    const discovery = await (await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
    const websocket = new URL(String(discovery.webSocketDebuggerUrl));
    if (
      websocket.protocol !== "ws:" || websocket.hostname !== "127.0.0.1" ||
      Number(websocket.port) !== debuggerPort ||
      !/^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(websocket.pathname)
    ) throw new Error("Chrome CDP endpoint escaped the exact owned loopback endpoint");
    client = new CdpClient(websocket.href);
    await client.ready();
    const version = await client.send("Browser.getVersion");
    if (!expectedProduct.test(String(version.product))) {
      throw new Error(`expected released Chrome product, found ${String(version.product)}`);
    }
    const commandLine = await client.send("Browser.getBrowserCommandLine");
    if (!Array.isArray(commandLine.arguments)) throw new Error("Chrome effective argv unavailable");
    for (const argument of launchArguments.filter((value) => value.startsWith("--"))) {
      if (!(commandLine.arguments as unknown[]).includes(argument)) {
        throw new Error(`Chrome effective argv omitted ${argument}`);
      }
    }

    const records = [];
    for (const scenario of SCENARIOS) {
      records.push(await collectScenario(client, origin, scenario, output));
    }
    const observedProcesses = await ownedProcesses(browserProcess.pid);
    const launcher = observedProcesses.find((identity) => identity.pid === browserProcess.pid);
    if (!launcher || launcher.executable !== chromeExecutable) {
      throw new Error("owned Chrome launcher identity changed before cleanup");
    }
    await client.send("Browser.close");
    client.close();
    client = null;
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
    const browserExit = await browserStatus;
    if (!processesAbsent) throw new Error("owned Chrome processes survived exact cleanup");
    const chromeAfter = await fileRecord(chromeExecutable);
    if (
      chromeAfter.bytes !== chromeIdentity.bytes || chromeAfter.sha256 !== chromeIdentity.sha256
    ) throw new Error("Chrome executable bytes changed across collection");
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
    if (serverIdentity && await identityStillRunning(serverIdentity)) {
      Deno.kill(server.pid, "SIGTERM");
    }
    const serverExit = await serverStatus;
    const serverAbsent = serverIdentity ? !(await identityStillRunning(serverIdentity)) : true;
    if (!serverAbsent) throw new Error("owned evidence server survived exact cleanup");

    const evidence = {
      schemaVersion: 1,
      evidenceId: "simulation-nbody-browser-correctness-v1",
      collectedAt: new Date().toISOString(),
      workloadId: "simulation.nbody-cloth.v1",
      performanceClaims: [],
      source: {
        ...source,
        acceptedStaticSourceCommit: buildManifest.source.commit,
      },
      collectionCommand:
        `deno run -A scripts/collect-base-simulation-nbody-evidence.ts --source-commit=${source.commit} --chrome=${options.chrome} --output=${output}`,
      browser: {
        product: String(version.product),
        revision: String(version.revision),
        userAgent: String(version.userAgent),
        jsVersion: String(version.jsVersion),
        executable: {
          path: chromeExecutable,
          bytes: chromeIdentity.bytes,
          sha256: chromeIdentity.sha256,
          dev: Number(executableInfo.dev),
          ino: Number(executableInfo.ino),
        },
        requestedLaunchArguments: launchArguments,
        effectiveCommandLine: commandLine.arguments,
        headless: true,
        protocol: "Chrome DevTools Protocol",
      },
      server: { origin, mode: "public", launcherPid: server.pid },
      contract: {
        targets: [...VARIANTS],
        timesteps: TIMESTEPS,
        checkpoints: [...CHECKPOINT_STEPS],
        counterCount: 14,
        output: "text-only",
        excluded: {
          cloth: {
            status: "unavailable",
            reason: "The independently accepted implementation contract explicitly excludes cloth.",
          },
          rendering: {
            status: "unavailable",
            reason:
              "The route exposes a textual correctness oracle only; its acceptance screenshot is not benchmark rendering evidence.",
          },
        },
      },
      scenarios: records,
      cleanup: {
        browser: {
          launcher,
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
    const outputDirectory = output.slice(0, output.lastIndexOf("/")) || ".";
    await Deno.mkdir(outputDirectory, { recursive: true });
    await Deno.writeTextFile(output, `${canonicalize(evidence)}\n`, { createNew: true });
    completed = true;
    console.log(`simulation N-body browser evidence: ${records.length} scenarios; exact cleanup`);
  } finally {
    if (!completed) {
      try {
        await client?.send("Browser.close");
      } catch {
        // Continue with exact identity-bound cleanup below.
      }
      client?.close();
      const failedProcesses = await ownedProcesses(browserProcess.pid);
      if (!(await waitForOwnedExit(failedProcesses, 2_000))) {
        for (const identity of [...failedProcesses].reverse()) {
          if (await identityStillRunning(identity)) Deno.kill(identity.pid, "SIGTERM");
        }
      }
      if (!(await waitForOwnedExit(failedProcesses, 2_000))) {
        for (const identity of [...failedProcesses].reverse()) {
          if (await identityStillRunning(identity)) Deno.kill(identity.pid, "SIGKILL");
        }
      }
      await browserStatus.catch(() => {});
      const failedServer = await processIdentity(server.pid);
      if (failedServer && await identityStillRunning(failedServer)) {
        Deno.kill(server.pid, "SIGTERM");
      }
      await serverStatus.catch(() => {});
      await Deno.remove(profilePath, { recursive: true }).catch(() => {});
      await Deno.remove(generatedPaths.screenshotDirectory, { recursive: true }).catch(() => {});
    }
  }
}

if (import.meta.main) await runCollector();

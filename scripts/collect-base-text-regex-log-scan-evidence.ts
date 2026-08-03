import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

export const WORKLOAD_ROUTE = "/demos/base/text.regex-log-scan.v1/";
export const INPUT_SHA256 = "3d5810310d15b7bebf227bdc384035bd961684d4e1240b2ee93b4cb37350d388";
export const OUTPUT_SHA256 = "6078822d35d3daea452751e74229c762e43eb4b973ca40bd1a0ac7c9c9e899de";
export const EXPECTED_COUNTERS = {
  inputBytes: 104_857_600,
  patternsExecuted: 20,
  logicalPatternBytes: 2_097_152_000,
  matchesFound: 40_960,
  capturesExtracted: 40_960,
  canonicalOutputBytes: 1_798_498,
  candidateStarts: 6_732_995,
  prefixByteComparisons: 15_570_166,
  tailByteComparisons: 861_922,
  perPattern: new Array(20).fill(2_048),
} as const;

interface ExpectedAsset {
  route: string;
  sourcePath: string;
  role: "document" | "style" | "script" | "manifest" | "wasm" | "oracle";
  executed: boolean;
}

export const EXPECTED_ASSETS: readonly ExpectedAsset[] = [
  {
    route: WORKLOAD_ROUTE,
    sourcePath: "public/demos/base/text.regex-log-scan.v1/index.html",
    role: "document",
    executed: false,
  },
  { route: "/styles.css", sourcePath: "public/styles.css", role: "style", executed: false },
  {
    route: "/demos/base/text.regex-log-scan.v1/demo.js",
    sourcePath: "public/demos/base/text.regex-log-scan.v1/demo.js",
    role: "script",
    executed: true,
  },
  {
    route: "/demos/base/text.regex-log-scan.v1/worker.js",
    sourcePath: "public/demos/base/text.regex-log-scan.v1/worker.js",
    role: "script",
    executed: true,
  },
  {
    route: "/demos/base/text.regex-log-scan.v1/identity.js",
    sourcePath: "public/demos/base/text.regex-log-scan.v1/identity.js",
    role: "script",
    executed: true,
  },
  {
    route: "/benchmarks/text-regex-log-scan/input.js",
    sourcePath: "benchmarks/text-regex-log-scan/input.js",
    role: "script",
    executed: true,
  },
  {
    route: "/benchmarks/text-regex-log-scan/workload.js",
    sourcePath: "benchmarks/text-regex-log-scan/workload.js",
    role: "script",
    executed: true,
  },
  {
    route: "/data/base-implementations/text.regex-log-scan.v1.json",
    sourcePath: "public/data/base-implementations/text.regex-log-scan.v1.json",
    role: "manifest",
    executed: false,
  },
  {
    route: "/artifacts/text-regex-log-scan/build-manifest.json",
    sourcePath: "public/artifacts/text-regex-log-scan/build-manifest.json",
    role: "manifest",
    executed: false,
  },
  {
    route: "/artifacts/text-regex-log-scan/input-manifest.json",
    sourcePath: "public/artifacts/text-regex-log-scan/input-manifest.json",
    role: "manifest",
    executed: false,
  },
  {
    route: "/artifacts/text-regex-log-scan/output-manifest.json",
    sourcePath: "public/artifacts/text-regex-log-scan/output-manifest.json",
    role: "manifest",
    executed: false,
  },
  {
    route: "/artifacts/text-regex-log-scan/text-regex-log-scan.wasm",
    sourcePath: "public/artifacts/text-regex-log-scan/text-regex-log-scan.wasm",
    role: "wasm",
    executed: false,
  },
  {
    route: "/artifacts/text-regex-log-scan/ordered-captures.bin",
    sourcePath: "public/artifacts/text-regex-log-scan/ordered-captures.bin",
    role: "oracle",
    executed: false,
  },
] as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const SCRIPT_PATH = "scripts/collect-base-text-regex-log-scan-evidence.ts";
const OUTPUT_PATH = "artifacts/base/text-regex-log-scan/browser-evidence/evidence.v1.json";
const SCREENSHOT_ROOT = "artifacts/base/text-regex-log-scan/browser-evidence/screenshots";

export function validateFullResult(mode: string, result: Record<string, unknown>): void {
  if (result.workloadId !== "text.regex-log-scan.v1" || result.variant !== mode) {
    throw new Error(`${mode}: workload or variant identity mismatch`);
  }
  if (result.inputSha256 !== INPUT_SHA256 || result.outputSha256 !== OUTPUT_SHA256) {
    throw new Error(`${mode}: exact input/output hash mismatch`);
  }
  const counters = result.counters as Record<string, unknown> | undefined;
  if (!counters) throw new Error(`${mode}: counters missing`);
  const expected = {
    ...EXPECTED_COUNTERS,
    boundaryCrossings: mode === "js-controlled" ? 0 : 1,
  };
  for (const [name, value] of Object.entries(expected)) {
    if (JSON.stringify(counters[name]) !== JSON.stringify(value)) {
      throw new Error(`${mode}: counter ${name} mismatch`);
    }
  }
}

interface ProcessIdentity {
  pid: number;
  parentPid: number;
  startTimeTicks: string;
  executable: string;
}

interface FileIdentity {
  path: string;
  bytes: number;
  sha256: string;
  dev: number;
  ino: number;
}

async function commandText(cwd: string, command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, {
    cwd,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(textDecoder.decode(output.stderr).trim());
  return textDecoder.decode(output.stdout).trim();
}

async function fileIdentity(path: string): Promise<FileIdentity> {
  const realPath = await Deno.realPath(path);
  const info = await Deno.lstat(realPath);
  if (!info.isFile || info.isSymlink) throw new Error(`not a regular executable: ${path}`);
  const bytes = await Deno.readFile(realPath);
  return {
    path: realPath,
    bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    dev: Number(info.dev),
    ino: Number(info.ino),
  };
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.path === right.path && left.bytes === right.bytes && left.sha256 === right.sha256 &&
    left.dev === right.dev && left.ino === right.ino;
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

function decodeBody(body: string, base64Encoded: boolean): Uint8Array {
  if (!base64Encoded) return textEncoder.encode(body);
  const decoded = atob(body);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

async function click(client: CdpClient, sessionId: string, selector: string): Promise<void> {
  const evaluated = await client.send("Runtime.evaluate", {
    expression: `(() => { const node=document.querySelector(${
      JSON.stringify(selector)
    }); const r=node.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:node.disabled}; })()`,
    returnByValue: true,
  }, sessionId);
  const value = (evaluated.result as { value: { x: number; y: number; disabled: boolean } }).value;
  if (value.disabled) throw new Error(`${selector} is disabled`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await client.send("Input.dispatchMouseEvent", {
      type,
      x: value.x,
      y: value.y,
      button: "left",
      clickCount: 1,
    }, sessionId);
  }
}

async function evaluateValue(
  client: CdpClient,
  sessionId: string,
  expression: string,
): Promise<unknown> {
  const evaluated = await client.send(
    "Runtime.evaluate",
    {
      expression,
      returnByValue: true,
      awaitPromise: true,
    },
    sessionId,
    10_000,
  );
  if (evaluated.exceptionDetails) throw new Error(`browser evaluation failed: ${expression}`);
  return (evaluated.result as { value: unknown }).value;
}

async function pageState(client: CdpClient, sessionId: string): Promise<Record<string, unknown>> {
  return await evaluateValue(
    client,
    sessionId,
    `(() => ({status:document.querySelector('#status').textContent.trim(),result:document.querySelector('#result').textContent.trim(),progress:document.querySelector('#progress').value,startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled}))()`,
  ) as Record<string, unknown>;
}

async function waitForState(
  client: CdpClient,
  sessionId: string,
  predicate: (state: Record<string, unknown>) => boolean,
  timeoutMs: number,
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

const probeSource = (shortTimeout: boolean) =>
  `(() => {
  const NativeWorker=globalThis.Worker;
  const nativeSetTimeout=globalThis.setTimeout.bind(globalThis);
  const probe={workers:[],messages:[]};
  globalThis.__baseRegexCollector=probe;
  function WrappedWorker(...args){
    const worker=new NativeWorker(...args);
    const entry={worker,terminated:false,url:String(args[0])};
    probe.workers.push(entry);
    const terminate=worker.terminate.bind(worker);
    worker.terminate=()=>{ entry.terminated=true; return terminate(); };
    worker.addEventListener('message',(event)=>{
      try { probe.messages.push(structuredClone(event.data)); }
      catch { probe.messages.push({type:'uncloneable'}); }
    });
    return worker;
  }
  WrappedWorker.prototype=NativeWorker.prototype;
  Object.defineProperty(globalThis,'Worker',{value:WrappedWorker,configurable:true,writable:true});
  ${
    shortTimeout
      ? "globalThis.setTimeout=(fn,delay,...args)=>nativeSetTimeout(fn,delay===120000?100:delay,...args);"
      : ""
  }
})()`;

interface SessionCapture {
  sessionId: string;
  context: "page" | "worker";
}

async function createInstrumentedTarget(
  client: CdpClient,
  origin: string,
  shortTimeout = false,
) {
  const created = await client.send("Target.createTarget", { url: "about:blank" });
  const targetId = String(created.targetId);
  const attached = await client.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const sessionId = String(attached.sessionId);
  const sessions = new Map<string, SessionCapture>([
    [sessionId, { sessionId, context: "page" }],
  ]);
  const consoleMessages: Array<Record<string, unknown>> = [];
  const exceptions: Array<Record<string, unknown>> = [];
  const requests = new Map<string, Record<string, unknown>>();
  const scripts = new Map<
    string,
    { route: string; context: "page" | "worker"; bytes: Uint8Array }
  >();
  const tasks: Promise<void>[] = [];

  const enableSession = async (workerSession: string, context: "page" | "worker") => {
    sessions.set(workerSession, { sessionId: workerSession, context });
    await Promise.all([
      client.send("Network.enable", { maxTotalBufferSize: 25_000_000 }, workerSession),
      client.send("Runtime.enable", {}, workerSession),
      client.send("Debugger.enable", {}, workerSession),
    ]);
  };

  const removers = [
    client.on("Target.attachedToTarget", (params, eventSession) => {
      if (eventSession !== sessionId) return;
      const targetInfo = params.targetInfo as Record<string, unknown>;
      if (targetInfo.type !== "worker") return;
      const workerSession = String(params.sessionId);
      tasks.push((async () => {
        await enableSession(workerSession, "worker");
        await client.send("Runtime.runIfWaitingForDebugger", {}, workerSession);
      })());
    }),
    client.on("Runtime.consoleAPICalled", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      consoleMessages.push({
        type: String(params.type),
        arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((arg) =>
          String(arg.value ?? arg.description ?? arg.type)
        ),
      });
    }),
    client.on("Runtime.exceptionThrown", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      const details = params.exceptionDetails as Record<string, unknown>;
      exceptions.push({
        text: String(details.text),
        lineNumber: Number(details.lineNumber),
      });
    }),
    client.on("Network.requestWillBeSent", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      const request = params.request as Record<string, unknown>;
      requests.set(`${eventSession}:${params.requestId}`, {
        sessionId: eventSession,
        requestId: String(params.requestId),
        url: String(request.url),
        method: String(request.method),
        status: null,
        mimeType: null,
        fromDiskCache: false,
        fromServiceWorker: false,
        failed: false,
        errorText: null,
        body: null,
      });
    }),
    client.on("Network.responseReceived", (params, eventSession) => {
      if (!eventSession) return;
      const record = requests.get(`${eventSession}:${params.requestId}`);
      if (!record) return;
      const response = params.response as Record<string, unknown>;
      Object.assign(record, {
        status: Number(response.status),
        mimeType: String(response.mimeType),
        fromDiskCache: Boolean(response.fromDiskCache),
        fromServiceWorker: Boolean(response.fromServiceWorker),
      });
    }),
    client.on("Network.loadingFinished", (params, eventSession) => {
      if (!eventSession) return;
      const record = requests.get(`${eventSession}:${params.requestId}`);
      if (!record) return;
      tasks.push((async () => {
        const body = await client.send(
          "Network.getResponseBody",
          {
            requestId: String(params.requestId),
          },
          eventSession,
          10_000,
        );
        record.body = decodeBody(String(body.body), Boolean(body.base64Encoded));
      })());
    }),
    client.on("Network.loadingFailed", (params, eventSession) => {
      if (!eventSession) return;
      const record = requests.get(`${eventSession}:${params.requestId}`);
      if (record) Object.assign(record, { failed: true, errorText: String(params.errorText) });
    }),
    client.on("Debugger.scriptParsed", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      let parsed: URL;
      try {
        parsed = new URL(String(params.url));
      } catch {
        return;
      }
      if (parsed.origin !== origin) return;
      const expected = EXPECTED_ASSETS.find((asset) =>
        asset.executed && asset.route === parsed.pathname
      );
      if (!expected) return;
      const context = sessions.get(eventSession)?.context ?? "page";
      tasks.push((async () => {
        const source = await client.send(
          "Debugger.getScriptSource",
          {
            scriptId: String(params.scriptId),
          },
          eventSession,
          10_000,
        );
        const bytes = textEncoder.encode(String(source.scriptSource));
        scripts.set(`${context}:${parsed.pathname}`, { route: parsed.pathname, context, bytes });
      })());
    }),
  ];

  await enableSession(sessionId, "page");
  await Promise.all([
    client.send("Page.enable", {}, sessionId),
    client.send("Accessibility.enable", {}, sessionId),
    client.send("Target.setAutoAttach", {
      autoAttach: true,
      waitForDebuggerOnStart: true,
      flatten: true,
    }, sessionId),
  ]);
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: probeSource(shortTimeout),
  }, sessionId);
  const loaded = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("page load timeout")), 10_000);
    const remove = client.on("Page.loadEventFired", (_params, eventSession) => {
      if (eventSession !== sessionId) return;
      clearTimeout(timer);
      remove();
      resolve();
    });
  });
  await client.send("Page.navigate", { url: `${origin}${WORKLOAD_ROUTE}` }, sessionId);
  await loaded;
  await waitForState(client, sessionId, (state) => state.status === "Ready.", 10_000);

  return {
    targetId,
    sessionId,
    consoleMessages,
    exceptions,
    requests,
    scripts,
    tasks,
    removers,
  };
}

async function settleCapture(capture: Awaited<ReturnType<typeof createInstrumentedTarget>>) {
  for (let cursor = 0; cursor < capture.tasks.length; cursor++) await capture.tasks[cursor];
  await new Promise((resolve) => setTimeout(resolve, 100));
  for (let cursor = 0; cursor < capture.tasks.length; cursor++) await capture.tasks[cursor];
}

async function closeCapture(
  client: CdpClient,
  capture: Awaited<ReturnType<typeof createInstrumentedTarget>>,
) {
  for (const remove of capture.removers) remove();
  await client.send("Target.closeTarget", { targetId: capture.targetId });
}

async function expectedFileRecords(rootPath: string) {
  const values = new Map<string, { bytes: Uint8Array; sha256: string }>();
  for (const asset of EXPECTED_ASSETS) {
    const bytes = await Deno.readFile(`${rootPath}/${asset.sourcePath}`);
    values.set(asset.route, { bytes, sha256: await sha256Hex(bytes) });
  }
  return values;
}

async function collectAssets(
  origin: string,
  capture: Awaited<ReturnType<typeof createInstrumentedTarget>>,
  expectedFiles: Awaited<ReturnType<typeof expectedFileRecords>>,
) {
  await settleCapture(capture);
  for (const request of capture.requests.values()) {
    const url = new URL(String(request.url));
    if (url.origin !== origin) throw new Error(`network escaped owned origin: ${url.href}`);
    if (request.failed || request.status !== 200) {
      throw new Error(`failed/non-200 request: ${JSON.stringify(request)}`);
    }
  }
  const fetchedAssets = [];
  for (const asset of EXPECTED_ASSETS) {
    const matches = [...capture.requests.values()].filter((request) =>
      new URL(String(request.url)).pathname === asset.route
    );
    if (matches.length === 0) throw new Error(`required asset was not fetched: ${asset.route}`);
    const expected = expectedFiles.get(asset.route)!;
    for (const match of matches) {
      const body = match.body as Uint8Array | null;
      if (
        !body || body.byteLength !== expected.bytes.byteLength ||
        await sha256Hex(body) !== expected.sha256
      ) {
        throw new Error(`raw fetched bytes differ from clean HEAD: ${asset.route}`);
      }
      if (match.fromDiskCache || match.fromServiceWorker) {
        throw new Error(`asset did not use an uncached owned-origin response: ${asset.route}`);
      }
    }
    fetchedAssets.push({
      route: asset.route,
      sourcePath: asset.sourcePath,
      role: asset.role,
      requestCount: matches.length,
      status: 200,
      mimeType: String(matches[0].mimeType),
      fromDiskCache: false,
      fromServiceWorker: false,
      bytes: expected.bytes.byteLength,
      sha256: expected.sha256,
    });
  }

  const executedScripts = [];
  for (const asset of EXPECTED_ASSETS.filter((candidate) => candidate.executed)) {
    const observations = [...capture.scripts.values()].filter((script) =>
      script.route === asset.route
    );
    if (observations.length === 0) {
      throw new Error(`required script was not executed: ${asset.route}`);
    }
    const expected = expectedFiles.get(asset.route)!;
    for (const observation of observations) {
      if (
        observation.bytes.byteLength !== expected.bytes.byteLength ||
        await sha256Hex(observation.bytes) !== expected.sha256
      ) {
        throw new Error(`executed source differs from raw clean-HEAD bytes: ${asset.route}`);
      }
    }
    executedScripts.push({
      route: asset.route,
      sourcePath: asset.sourcePath,
      contexts: [...new Set(observations.map((observation) => observation.context))].sort(),
      bytes: expected.bytes.byteLength,
      sha256: expected.sha256,
    });
  }
  return { fetchedAssets, executedScripts };
}

async function collectAccessibility(client: CdpClient, sessionId: string) {
  const response = await client.send("Accessibility.getFullAXTree", {}, sessionId, 10_000);
  const nodes = (response.nodes as Array<Record<string, unknown>>) ?? [];
  const projection = nodes.map((node) => ({
    role: (node.role as Record<string, unknown> | undefined)?.value ?? null,
    name: (node.name as Record<string, unknown> | undefined)?.value ?? null,
    properties: ((node.properties as Array<Record<string, unknown>>) ?? []).map((property) => ({
      name: property.name,
      value: (property.value as Record<string, unknown> | undefined)?.value ?? null,
    })),
  }));
  const domChecks = await evaluateValue(
    client,
    sessionId,
    `(() => ({statusLive:document.querySelector('#status').role==='status'&&document.querySelector('#status').getAttribute('aria-live')==='polite',resultFocusable:document.querySelector('#result').tabIndex===0}))()`,
  ) as Record<string, boolean>;
  const has = (role: string, name?: string) =>
    projection.some((node) => node.role === role && (name === undefined || node.name === name));
  const record = {
    nodeCount: nodes.length,
    treeSha256: await sha256Hex(textEncoder.encode(canonicalize(projection))),
    mainPresent: has("main"),
    h1Named: has("heading", "Scan 100 MiB with 20 safe patterns"),
    engineLabelled: has("combobox", "Engine"),
    startNamed: has("button", "Start"),
    cancelNamed: has("button", "Cancel"),
    statusLive: domChecks.statusLive,
    resultFocusable: domChecks.resultFocusable,
  };
  if (
    Object.entries(record).some(([name, value]) =>
      name.endsWith("Present") ||
        name.endsWith("Named") || name.endsWith("Labelled") || name.endsWith("Live") ||
        name.endsWith("Focusable")
        ? value !== true
        : false
    )
  ) {
    throw new Error(`accessibility contract failed: ${JSON.stringify(record)}`);
  }
  return record;
}

async function collectModeRun(
  client: CdpClient,
  origin: string,
  rootPath: string,
  mode: "js-controlled" | "wasm-linear-controlled",
  expectedFiles: Awaited<ReturnType<typeof expectedFileRecords>>,
) {
  const capture = await createInstrumentedTarget(client, origin);
  try {
    await evaluateValue(
      client,
      capture.sessionId,
      `(() => { const select=document.querySelector('#engine'); select.value=${
        JSON.stringify(mode)
      }; select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
    );
    await click(client, capture.sessionId, "#start");
    const visible = await waitForState(
      client,
      capture.sessionId,
      (state) => state.status === "Complete. Exact registration and oracle passed.",
      130_000,
    );
    const messages = await evaluateValue(
      client,
      capture.sessionId,
      `globalThis.__baseRegexCollector.messages`,
    ) as Array<Record<string, unknown>>;
    const complete = [...messages].reverse().find((message) => message.type === "complete");
    const result = complete?.result as Record<string, unknown> | undefined;
    if (!result) throw new Error(`${mode}: complete worker result was not observed`);
    validateFullResult(mode, result);
    if (
      !String(visible.result).includes(`Variant: ${mode}`) ||
      !String(visible.result).includes(
        `Per-pattern captures: ${new Array(20).fill(2048).join(", ")}`,
      )
    ) {
      throw new Error(`${mode}: visible full-contract result is incomplete`);
    }
    const assets = await collectAssets(origin, capture, expectedFiles);
    if (
      capture.exceptions.length > 0 ||
      capture.consoleMessages.some((entry) => entry.type === "error")
    ) {
      throw new Error(`${mode}: console or exception failure`);
    }
    const accessibility = await collectAccessibility(client, capture.sessionId);
    const screenshot = await client.send(
      "Page.captureScreenshot",
      {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
      },
      capture.sessionId,
      10_000,
    );
    const screenshotBytes = decodeBody(String(screenshot.data), true);
    if (
      JSON.stringify([...screenshotBytes.slice(0, 8)]) !==
        JSON.stringify([137, 80, 78, 71, 13, 10, 26, 10])
    ) {
      throw new Error(`${mode}: screenshot is not PNG`);
    }
    const screenshotPath = `${SCREENSHOT_ROOT}/${mode}.png`;
    await Deno.mkdir(`${rootPath}/${SCREENSHOT_ROOT}`, { recursive: true });
    await Deno.writeFile(`${rootPath}/${screenshotPath}`, screenshotBytes);
    return {
      mode,
      action: "visible-control-complete",
      inputSha256: String(result.inputSha256),
      outputSha256: String(result.outputSha256),
      counters: result.counters,
      visible,
      ...assets,
      console: capture.consoleMessages,
      exceptions: capture.exceptions,
      accessibility,
      screenshot: {
        path: screenshotPath,
        format: "png",
        bytes: screenshotBytes.byteLength,
        sha256: await sha256Hex(screenshotBytes),
      },
    };
  } finally {
    await closeCapture(client, capture);
  }
}

async function waitForWorkerCount(client: CdpClient, sessionId: string, count: number) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const actual = Number(
      await evaluateValue(
        client,
        sessionId,
        `globalThis.__baseRegexCollector.workers.length`,
      ),
    );
    if (actual >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`worker ${count} was not created`);
}

async function collectLifecycle(
  client: CdpClient,
  origin: string,
  id: "wrong-token" | "stale-error" | "restart" | "cancel" | "timeout" | "pagehide",
) {
  const capture = await createInstrumentedTarget(client, origin, id === "timeout");
  let wrongTokenIgnored = false;
  let staleErrorIgnored = false;
  let restartReplacedWorker = false;
  let cancelTerminatedWorker = false;
  let timeoutTerminatedWorker = false;
  let pagehideTerminatedWorker = false;
  try {
    await click(client, capture.sessionId, "#start");
    await waitForWorkerCount(client, capture.sessionId, 1);
    if (id === "wrong-token") {
      await evaluateValue(
        client,
        capture.sessionId,
        `(() => { const p=globalThis.__baseRegexCollector; p.workers[0].worker.dispatchEvent(new MessageEvent('message',{data:{type:'complete',token:999999,result:{}}})); })()`,
      );
      const after = await pageState(client, capture.sessionId);
      wrongTokenIgnored = !String(after.status).startsWith("Complete") &&
        !String(after.status).startsWith("Failed");
      await click(client, capture.sessionId, "#cancel");
    } else if (id === "stale-error") {
      await click(client, capture.sessionId, "#cancel");
      const before = await pageState(client, capture.sessionId);
      await evaluateValue(
        client,
        capture.sessionId,
        `(() => { const event=new Event('error'); Object.defineProperty(event,'message',{value:'stale collector error'}); globalThis.__baseRegexCollector.workers[0].worker.dispatchEvent(event); })()`,
      );
      const after = await pageState(client, capture.sessionId);
      staleErrorIgnored = before.status === after.status &&
        String(after.status).startsWith("Cancelled.");
    } else if (id === "restart") {
      await evaluateValue(
        client,
        capture.sessionId,
        `document.querySelector('#run-form').dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}))`,
      );
      await waitForWorkerCount(client, capture.sessionId, 2);
      restartReplacedWorker = Boolean(
        await evaluateValue(
          client,
          capture.sessionId,
          `globalThis.__baseRegexCollector.workers[0].terminated && !globalThis.__baseRegexCollector.workers[1].terminated`,
        ),
      );
      await click(client, capture.sessionId, "#cancel");
    } else if (id === "cancel") {
      await click(client, capture.sessionId, "#cancel");
      cancelTerminatedWorker = Boolean(
        await evaluateValue(
          client,
          capture.sessionId,
          `globalThis.__baseRegexCollector.workers[0].terminated`,
        ),
      );
    } else if (id === "timeout") {
      await waitForState(
        client,
        capture.sessionId,
        (state) => state.status === "Failed: 120 second worker timeout",
        3_000,
      );
      timeoutTerminatedWorker = Boolean(
        await evaluateValue(
          client,
          capture.sessionId,
          `globalThis.__baseRegexCollector.workers[0].terminated`,
        ),
      );
    } else {
      await evaluateValue(
        client,
        capture.sessionId,
        `globalThis.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))`,
      );
      pagehideTerminatedWorker = Boolean(
        await evaluateValue(
          client,
          capture.sessionId,
          `globalThis.__baseRegexCollector.workers[0].terminated`,
        ),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    const state = await pageState(client, capture.sessionId);
    const workerState = await evaluateValue(
      client,
      capture.sessionId,
      `(() => { const workers=globalThis.__baseRegexCollector.workers; return {count:workers.length,terminated:workers.filter((entry)=>entry.terminated).length}; })()`,
    ) as { count: number; terminated: number };
    if (
      capture.exceptions.length > 0 ||
      capture.consoleMessages.some((entry) => entry.type === "error")
    ) {
      throw new Error(`${id}: lifecycle probe raised a browser error`);
    }
    const booleans = {
      wrongTokenIgnored,
      staleErrorIgnored,
      restartReplacedWorker,
      cancelTerminatedWorker,
      timeoutTerminatedWorker,
      pagehideTerminatedWorker,
    };
    const required = id === "wrong-token"
      ? wrongTokenIgnored
      : id === "stale-error"
      ? staleErrorIgnored
      : id === "restart"
      ? restartReplacedWorker
      : id === "cancel"
      ? cancelTerminatedWorker
      : id === "timeout"
      ? timeoutTerminatedWorker
      : pagehideTerminatedWorker;
    if (!required || workerState.terminated < 1) {
      throw new Error(`${id}: lifecycle assertion failed`);
    }
    return {
      id,
      action: "visible-controller-lifecycle-probe",
      finalStatus: String(state.status),
      workerCount: workerState.count,
      terminatedWorkers: workerState.terminated,
      ...booleans,
      console: capture.consoleMessages,
      exceptions: capture.exceptions,
    };
  } finally {
    await closeCapture(client, capture);
  }
}

async function main() {
  const chromeArg = Deno.args.find((value) => value.startsWith("--chrome="));
  if (!chromeArg || Deno.args.length !== 1) {
    throw new Error(
      "usage: deno run -A scripts/collect-base-text-regex-log-scan-evidence.ts --chrome=<path>",
    );
  }
  if (Deno.build.os !== "linux") throw new Error("exact /proc-owned cleanup requires Linux");
  const rootPath = await Deno.realPath(new URL("../", import.meta.url));
  const gitRoot = await Deno.realPath(
    await commandText(rootPath, "git", ["rev-parse", "--show-toplevel"]),
  );
  if (gitRoot !== rootPath.replace(/\/$/, "")) {
    throw new Error("collector source root is not the Git root");
  }
  const dirty = await commandText(rootPath, "git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (dirty !== "") throw new Error(`collector requires an exact clean HEAD:\n${dirty}`);
  const head = await commandText(rootPath, "git", ["rev-parse", "HEAD"]);
  const tree = await commandText(rootPath, "git", ["rev-parse", "HEAD^{tree}"]);
  const scriptBytes = await Deno.readFile(`${rootPath}/${SCRIPT_PATH}`);
  const executableAtLaunch = await fileIdentity(chromeArg.slice("--chrome=".length));
  const expectedFiles = await expectedFileRecords(rootPath);
  const registration = JSON.parse(
    await Deno.readTextFile(
      `${rootPath}/public/data/base-implementations/text.regex-log-scan.v1.json`,
    ),
  );

  const serverPort = unusedPort();
  const debuggerPort = unusedPort();
  const origin = `http://127.0.0.1:${serverPort}`;
  const server = new Deno.Command(Deno.execPath(), {
    cwd: rootPath,
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
  const serverIdentity = await processIdentity(server.pid);
  if (!serverIdentity) throw new Error("evidence server identity disappeared");

  const profilePath = await Deno.makeTempDir({ prefix: "wasm-base-regex-chrome-" });
  const profileInfo = await Deno.lstat(profilePath);
  if ([...Deno.readDirSync(profilePath)].length !== 0) {
    throw new Error("new Chrome profile is not empty");
  }
  const profileIdentity = { dev: Number(profileInfo.dev), ino: Number(profileInfo.ino) };
  const launchArguments = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--metrics-recording-only",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--window-size=1440,1200",
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${debuggerPort}`,
    `--user-data-dir=${profilePath}`,
    "about:blank",
  ];
  const browserProcess = new Deno.Command(executableAtLaunch.path, {
    args: launchArguments,
    stdout: "null",
    stderr: "null",
  }).spawn();
  const browserStatusPromise = browserProcess.status;
  let client: CdpClient | null = null;
  let completed = false;
  try {
    const versionResponse = await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`);
    const discovery = await versionResponse.json();
    const socketUrl = new URL(discovery.webSocketDebuggerUrl);
    if (
      socketUrl.protocol !== "ws:" || socketUrl.hostname !== "127.0.0.1" ||
      Number(socketUrl.port) !== debuggerPort
    ) {
      throw new Error("Chrome CDP endpoint escaped the exact owned loopback port");
    }
    client = new CdpClient(socketUrl.href);
    await client.ready();
    const browserVersion = await client.send("Browser.getVersion");
    if (!/^Chrome\/\d+\.\d+\.\d+\.\d+$/.test(String(browserVersion.product))) {
      throw new Error(
        `collector requires exact Google Chrome provenance, got ${browserVersion.product}`,
      );
    }
    const launcherAtRuntime = await processIdentity(browserProcess.pid);
    if (!launcherAtRuntime || launcherAtRuntime.executable !== executableAtLaunch.path) {
      throw new Error("running Chrome executable differs from inspected executable");
    }

    const modeRuns = [];
    for (const mode of ["js-controlled", "wasm-linear-controlled"] as const) {
      modeRuns.push(await collectModeRun(client, origin, rootPath, mode, expectedFiles));
    }
    const lifecycle = [];
    for (
      const id of [
        "wrong-token",
        "stale-error",
        "restart",
        "cancel",
        "timeout",
        "pagehide",
      ] as const
    ) lifecycle.push(await collectLifecycle(client, origin, id));

    const observedProcesses = await ownedProcesses(browserProcess.pid);
    const launcherIdentity = observedProcesses.find((identity) =>
      identity.pid === browserProcess.pid
    );
    if (!launcherIdentity) throw new Error("owned Chrome launcher disappeared before cleanup");
    const executableBeforeCleanup = await fileIdentity(executableAtLaunch.path);
    if (!sameFileIdentity(executableAtLaunch, executableBeforeCleanup)) {
      throw new Error("Chrome executable identity changed during collection");
    }
    await client.send("Browser.close");
    client.close();
    client = null;
    const signals: Array<{ pid: number; signal: "SIGTERM" | "SIGKILL" }> = [];
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

    const currentProfileInfo = await Deno.lstat(profilePath);
    const profileMatched = Number(currentProfileInfo.dev) === profileIdentity.dev &&
      Number(currentProfileInfo.ino) === profileIdentity.ino && !currentProfileInfo.isSymlink;
    if (!profileMatched) throw new Error("Chrome profile identity changed before removal");
    await Deno.remove(profilePath, { recursive: true });
    let profileAbsent = false;
    try {
      await Deno.lstat(profilePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) profileAbsent = true;
    }
    if (!profileAbsent) throw new Error("owned Chrome profile survived cleanup");

    if (await identityStillRunning(serverIdentity)) Deno.kill(server.pid, "SIGTERM");
    const serverExit = await serverStatusPromise;
    const serverAbsent = !(await identityStillRunning(serverIdentity));
    if (!serverAbsent) throw new Error("owned evidence server survived cleanup");

    const regressionReason =
      "The accepted UI exposes only the exact registered 100 MiB fixture; static target-equivalence tests retain this regression.";
    const evidence = {
      schemaVersion: 1,
      evidenceId: "base-text-regex-log-scan-chrome-v1",
      collectedAt: new Date().toISOString(),
      source: { head, tree, root: rootPath, clean: true },
      collection: {
        script: SCRIPT_PATH,
        scriptBytes: scriptBytes.byteLength,
        scriptSha256: await sha256Hex(scriptBytes),
        command: `deno run -A ${SCRIPT_PATH} --chrome=${executableAtLaunch.path}`,
      },
      workload: {
        id: "text.regex-log-scan.v1",
        registrationId: "text.regex-log-scan.v1-controlled-registration-v1",
        route: WORKLOAD_ROUTE,
        implementationSourceCommit: registration.implementation.sourceCommit,
        inputBytes: 104_857_600,
        patterns: 20,
        inputSha256: INPUT_SHA256,
        outputSha256: OUTPUT_SHA256,
        modes: ["js-controlled", "wasm-linear-controlled"],
        performanceClaim: false,
      },
      browser: {
        product: String(browserVersion.product),
        revision: String(browserVersion.revision),
        userAgent: String(browserVersion.userAgent),
        jsVersion: String(browserVersion.jsVersion),
        protocol: "Chrome DevTools Protocol",
        executable: executableAtLaunch,
        launchArguments,
        headless: true,
        profile: { path: profilePath, ...profileIdentity, createdEmpty: true },
      },
      server: { origin, mode: "public", launcher: serverIdentity },
      modeRuns,
      uiRegressions: ["malformed-utf8", "url-tail-96", "url-tail-97"].map((id) => ({
        id,
        uiStatus: "not-exposed-by-demo-ui",
        reason: regressionReason,
      })),
      lifecycle,
      cleanup: {
        browser: {
          launcher: launcherIdentity,
          observedProcesses,
          requested: "Browser.close",
          signals,
          exit: browserExit,
          processesAbsent,
          executableUnchanged: true,
        },
        profile: {
          path: profilePath,
          identityMatched: profileMatched,
          removed: true,
          absent: profileAbsent,
        },
        server: {
          launcher: serverIdentity,
          signal: "SIGTERM",
          exit: serverExit,
          processAbsent: serverAbsent,
        },
      },
    };
    await Deno.mkdir(`${rootPath}/artifacts/base/text-regex-log-scan/browser-evidence`, {
      recursive: true,
    });
    await Deno.writeTextFile(`${rootPath}/${OUTPUT_PATH}`, `${canonicalize(evidence)}\n`);
    completed = true;
    console.log(
      "base-text-regex-log-scan evidence: 2 full modes + 6 lifecycle probes; cleanup exact",
    );
  } finally {
    if (!completed) {
      try {
        await client?.send("Browser.close");
      } catch {
        // Continue with PID/start-time/executable-bound fallback cleanup.
      }
      client?.close();
      const processes = await ownedProcesses(browserProcess.pid);
      if (!(await waitForOwnedExit(processes, 2_000))) {
        for (const identity of [...processes].reverse()) {
          if (await identityStillRunning(identity)) Deno.kill(identity.pid, "SIGTERM");
        }
      }
      if (!(await waitForOwnedExit(processes, 2_000))) {
        for (const identity of [...processes].reverse()) {
          if (await identityStillRunning(identity)) Deno.kill(identity.pid, "SIGKILL");
        }
      }
      await browserStatusPromise.catch(() => {});
      if (await identityStillRunning(serverIdentity)) Deno.kill(server.pid, "SIGTERM");
      await serverStatusPromise.catch(() => {});
      const current = await Deno.lstat(profilePath).catch(() => null);
      if (
        current && Number(current.dev) === profileIdentity.dev &&
        Number(current.ino) === profileIdentity.ino && !current.isSymlink
      ) {
        await Deno.remove(profilePath, { recursive: true }).catch(() => {});
      }
      await Deno.remove(`${rootPath}/artifacts/base/text-regex-log-scan/browser-evidence`, {
        recursive: true,
      }).catch(() => {});
    }
  }
}

if (import.meta.main) await main();

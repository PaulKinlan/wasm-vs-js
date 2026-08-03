import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

export const WORKLOAD_ROUTE = "/demos/base/text.regex-log-scan.v1/";
export const CFT_PRODUCT = "Chrome/150.0.7871.24";
export const CFT_EXECUTABLE_SHA256 =
  "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
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
  requestCount: number;
  executedIn: readonly ("page" | "worker")[];
}

export const EXPECTED_ASSETS: readonly ExpectedAsset[] = [
  {
    route: WORKLOAD_ROUTE,
    sourcePath: "public/demos/base/text.regex-log-scan.v1/index.html",
    role: "document",
    requestCount: 1,
    executedIn: [],
  },
  {
    route: "/styles.css",
    sourcePath: "public/styles.css",
    role: "style",
    requestCount: 1,
    executedIn: [],
  },
  {
    route: "/demos/base/text.regex-log-scan.v1/demo.js",
    sourcePath: "public/demos/base/text.regex-log-scan.v1/demo.js",
    role: "script",
    requestCount: 1,
    executedIn: ["page"],
  },
  {
    route: "/demos/base/text.regex-log-scan.v1/worker.js",
    sourcePath: "public/demos/base/text.regex-log-scan.v1/worker.js",
    role: "script",
    requestCount: 2,
    executedIn: ["worker"],
  },
  {
    route: "/demos/base/text.regex-log-scan.v1/identity.js",
    sourcePath: "public/demos/base/text.regex-log-scan.v1/identity.js",
    role: "script",
    requestCount: 1,
    executedIn: ["worker"],
  },
  {
    route: "/benchmarks/text-regex-log-scan/input.js",
    sourcePath: "benchmarks/text-regex-log-scan/input.js",
    role: "script",
    requestCount: 2,
    executedIn: ["worker"],
  },
  {
    route: "/benchmarks/text-regex-log-scan/workload.js",
    sourcePath: "benchmarks/text-regex-log-scan/workload.js",
    role: "script",
    requestCount: 2,
    executedIn: ["worker"],
  },
  {
    route: "/data/base-implementations/text.regex-log-scan.v1.json",
    sourcePath: "public/data/base-implementations/text.regex-log-scan.v1.json",
    role: "manifest",
    requestCount: 1,
    executedIn: [],
  },
  {
    route: "/artifacts/text-regex-log-scan/build-manifest.json",
    sourcePath: "public/artifacts/text-regex-log-scan/build-manifest.json",
    role: "manifest",
    requestCount: 1,
    executedIn: [],
  },
  {
    route: "/artifacts/text-regex-log-scan/input-manifest.json",
    sourcePath: "public/artifacts/text-regex-log-scan/input-manifest.json",
    role: "manifest",
    requestCount: 1,
    executedIn: [],
  },
  {
    route: "/artifacts/text-regex-log-scan/output-manifest.json",
    sourcePath: "public/artifacts/text-regex-log-scan/output-manifest.json",
    role: "manifest",
    requestCount: 1,
    executedIn: [],
  },
  {
    route: "/artifacts/text-regex-log-scan/text-regex-log-scan.wasm",
    sourcePath: "public/artifacts/text-regex-log-scan/text-regex-log-scan.wasm",
    role: "wasm",
    requestCount: 1,
    executedIn: [],
  },
  {
    route: "/artifacts/text-regex-log-scan/ordered-captures.bin",
    sourcePath: "public/artifacts/text-regex-log-scan/ordered-captures.bin",
    role: "oracle",
    requestCount: 1,
    executedIn: [],
  },
] as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const SCRIPT_PATH = "scripts/collect-base-text-regex-log-scan-evidence.ts";
const OUTPUT_PATH = "artifacts/base/text-regex-log-scan/browser-evidence/evidence.v1.json";
const SCREENSHOT_ROOT = "artifacts/base/text-regex-log-scan/browser-evidence/screenshots";
const COLLECTOR_PROBE_URL = "collector://base-regex/probe.js";
const COLLECTOR_EVALUATE_URL = "collector://base-regex/evaluate.js";
const expectedCollectorSources = new Map<string, number>();

function collectorSource(source: string, url: string): string {
  const instrumented = `${source}\n//# sourceURL=${url}`;
  expectedCollectorSources.set(
    instrumented,
    (expectedCollectorSources.get(instrumented) ?? 0) + 1,
  );
  return instrumented;
}

export const STATIC_LAUNCH_ARGUMENTS = [
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
  "--enable-automation",
  "--remote-debugging-address=127.0.0.1",
] as const;

export const EXPECTED_LIFECYCLE = {
  "wrong-token": {
    finalStatus: "Cancelled. The worker was terminated.",
    workers: 1,
    terminated: 1,
  },
  "stale-error": {
    finalStatus: "Cancelled. The worker was terminated.",
    workers: 1,
    terminated: 1,
  },
  restart: { finalStatus: "Cancelled. The worker was terminated.", workers: 2, terminated: 2 },
  cancel: { finalStatus: "Cancelled. The worker was terminated.", workers: 1, terminated: 1 },
  timeout: { finalStatus: "Failed: 120 second worker timeout", workers: 1, terminated: 1 },
  pagehide: { finalStatus: "Starting fresh worker…", workers: 1, terminated: 1 },
} as const;

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

interface CgroupIdentity {
  path: string;
  dev: number;
  ino: number;
}

async function processCgroupPath(pid: number): Promise<string | null> {
  try {
    const unified = (await Deno.readTextFile(`/proc/${pid}/cgroup`)).split("\n").find((line) =>
      line.startsWith("0::")
    );
    return unified?.slice(3) ?? null;
  } catch {
    return null;
  }
}

async function cgroupIdentity(path: string): Promise<CgroupIdentity> {
  if (!path.startsWith("/user.slice/")) throw new Error(`unexpected browser cgroup: ${path}`);
  const info = await Deno.lstat(`/sys/fs/cgroup${path}`);
  if (!info.isDirectory || info.isSymlink) throw new Error(`invalid browser cgroup: ${path}`);
  return { path, dev: Number(info.dev), ino: Number(info.ino) };
}

async function cgroupProcesses(path: string): Promise<ProcessIdentity[]> {
  const text = await Deno.readTextFile(`/sys/fs/cgroup${path}/cgroup.procs`).catch(() => "");
  const identities = await Promise.all(
    text.trim().split("\n").filter(Boolean).map((pid) => processIdentity(Number(pid))),
  );
  return identities.filter((identity): identity is ProcessIdentity => identity !== null).sort((
    a,
    b,
  ) => a.pid - b.pid);
}

async function waitForScopeCgroup(pid: number, unit: string): Promise<CgroupIdentity> {
  const suffix = `/${unit}.scope`;
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const path = await processCgroupPath(pid);
    if (path?.endsWith(suffix)) return await cgroupIdentity(path);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`owned browser scope ${unit}.scope was not established`);
}

async function waitForOwnedExecutable(
  rootPid: number,
  executable: string,
  timeoutMs = 5_000,
): Promise<ProcessIdentity> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const identity = (await ownedProcesses(rootPid)).find((candidate) =>
      candidate.executable === executable
    );
    if (identity) return identity;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("launched Chrome identity was not retained before cgroup acquisition");
}

function startOwnedProcessTracker(rootPid: number) {
  const retained = new Map<string, ProcessIdentity>();
  let stopped = false;
  const running = (async () => {
    while (!stopped) {
      for (const identity of await ownedProcesses(rootPid)) {
        retained.set(`${identity.pid}:${identity.startTimeTicks}:${identity.executable}`, identity);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    for (const identity of await ownedProcesses(rootPid)) {
      retained.set(`${identity.pid}:${identity.startTimeTicks}:${identity.executable}`, identity);
    }
  })();
  return {
    async stop() {
      stopped = true;
      await running;
      return [...retained.values()].sort((a, b) => a.pid - b.pid);
    },
  };
}

function startCgroupTracker(path: string) {
  const retained = new Map<string, ProcessIdentity>();
  let stopped = false;
  const running = (async () => {
    while (!stopped) {
      for (const identity of await cgroupProcesses(path)) {
        retained.set(`${identity.pid}:${identity.startTimeTicks}:${identity.executable}`, identity);
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    for (const identity of await cgroupProcesses(path)) {
      retained.set(`${identity.pid}:${identity.startTimeTicks}:${identity.executable}`, identity);
    }
  })();
  return {
    async stop() {
      stopped = true;
      await running;
      return [...retained.values()].sort((a, b) => a.pid - b.pid);
    },
  };
}

async function listenerOwnership(port: number, cgroupPath: string) {
  const local = `0100007F:${port.toString(16).toUpperCase().padStart(4, "0")}`;
  const rows = (await Deno.readTextFile("/proc/net/tcp")).trim().split("\n").slice(1).map((line) =>
    line.trim().split(/\s+/)
  );
  const listeners = rows.filter((fields) => fields[1] === local && fields[3] === "0A");
  if (listeners.length !== 1) {
    throw new Error(`CDP listener was not unique on owned loopback port ${port}`);
  }
  const inode = listeners[0][9];
  const owners = new Map<string, ProcessIdentity>();
  for (const identity of await cgroupProcesses(cgroupPath)) {
    try {
      for await (const entry of Deno.readDir(`/proc/${identity.pid}/fd`)) {
        const target = await Deno.readLink(`/proc/${identity.pid}/fd/${entry.name}`).catch(() =>
          ""
        );
        if (target === `socket:[${inode}]`) {
          owners.set(`${identity.pid}:${identity.startTimeTicks}:${identity.executable}`, identity);
        }
      }
    } catch {
      // A short-lived scoped process is retained by the tracker but cannot own the live listener.
    }
  }
  if (owners.size !== 1) {
    throw new Error(`CDP listener inode ${inode} is not owned by exactly one scoped process`);
  }
  return { address: "127.0.0.1", port, inode, owner: [...owners.values()][0] };
}

async function revalidateListener(
  expected: Awaited<ReturnType<typeof listenerOwnership>>,
  port: number,
  cgroupPath: string,
  phase: "after-connect" | "before-use" | "after-use",
) {
  const current = await listenerOwnership(port, cgroupPath);
  if (
    current.inode !== expected.inode || current.port !== expected.port ||
    current.address !== expected.address || current.owner.pid !== expected.owner.pid ||
    current.owner.startTimeTicks !== expected.owner.startTimeTicks ||
    current.owner.executable !== expected.owner.executable
  ) {
    throw new Error(`CDP listener identity changed at ${phase}`);
  }
  return { phase, ...current };
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

async function waitForCgroupEmpty(path: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await cgroupProcesses(path)).length === 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function signalCgroup(
  path: string,
  signal: "SIGTERM" | "SIGKILL",
  signals: Array<{ pid: number; signal: "SIGTERM" | "SIGKILL" }>,
) {
  const identities = (await cgroupProcesses(path)).reverse();
  if (signal === "SIGKILL") {
    for (const identity of identities) signals.push({ pid: identity.pid, signal });
    await Deno.writeTextFile(`/sys/fs/cgroup${path}/cgroup.kill`, "1");
    return;
  }
  for (const identity of identities) {
    if (await identityStillRunning(identity) && await processCgroupPath(identity.pid) === path) {
      Deno.kill(identity.pid, signal);
      signals.push({ pid: identity.pid, signal });
    }
  }
}

async function waitForPathAbsent(path: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await Deno.lstat(path);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return true;
    }
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
    expression: collectorSource(
      `(() => { const node=document.querySelector(${
        JSON.stringify(selector)
      }); const r=node.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:node.disabled}; })()`,
      COLLECTOR_EVALUATE_URL,
    ),
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
      expression: collectorSource(expression, COLLECTOR_EVALUATE_URL),
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

const probeSource = (shortTimeout: boolean, blockWorkerMessages: boolean) =>
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
    ${blockWorkerMessages ? "worker.postMessage=()=>{};" : ""}
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

export function classifyExecutedScriptUrl(
  rawUrl: string,
  origin: string,
): { kind: "collector"; url: string } | { kind: "asset"; route: string } {
  if (rawUrl === "") throw new Error("unexpected URL-less/eval executed script");
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`executed script URL was not parseable: ${rawUrl}`);
  }
  if (parsed.protocol === "collector:") {
    if (rawUrl !== COLLECTOR_PROBE_URL && rawUrl !== COLLECTOR_EVALUATE_URL) {
      throw new Error(`unexpected collector instrumentation URL: ${rawUrl}`);
    }
    return { kind: "collector", url: rawUrl };
  }
  if (parsed.protocol !== "http:") {
    throw new Error(`unexpected executed script scheme: ${parsed.protocol}`);
  }
  if (parsed.origin !== origin) {
    throw new Error(`executed script escaped owned origin: ${parsed.href}`);
  }
  const expected = EXPECTED_ASSETS.find((asset) =>
    asset.executedIn.length > 0 && asset.route === parsed.pathname
  );
  if (!expected) throw new Error(`unexpected same-origin executed script: ${parsed.pathname}`);
  return { kind: "asset", route: parsed.pathname };
}

export function retainRequestHop(
  requests: Map<string, Record<string, unknown>>,
  activeRequestKeys: Map<string, string>,
  captureViolations: string[],
  origin: string,
  eventSession: string,
  params: Record<string, unknown>,
): string {
  const baseKey = `${eventSession}:${params.requestId}`;
  const previousKey = activeRequestKeys.get(baseKey);
  const previous = previousKey ? requests.get(previousKey) : undefined;
  const redirectResponse = params.redirectResponse as Record<string, unknown> | undefined;
  if (previous) {
    if (redirectResponse) {
      Object.assign(previous, {
        status: Number(redirectResponse.status),
        mimeType: String(redirectResponse.mimeType),
        fromDiskCache: Boolean(redirectResponse.fromDiskCache),
        fromServiceWorker: Boolean(redirectResponse.fromServiceWorker),
        redirected: true,
      });
      captureViolations.push(`unexpected redirect hop retained: ${previousKey}`);
    } else {
      captureViolations.push(`request ID reused without redirect response: ${baseKey}`);
    }
  } else if (redirectResponse) {
    captureViolations.push(`redirect response had no retained prior hop: ${baseKey}`);
  }
  const hop = previous ? Number(previous.hop) + 1 : 0;
  const request = params.request as Record<string, unknown>;
  const requestUrl = String(request.url);
  try {
    const parsedRequest = new URL(requestUrl);
    const expectedRoute = EXPECTED_ASSETS.some((asset) => asset.route === parsedRequest.pathname);
    if (
      parsedRequest.protocol !== "http:" || parsedRequest.origin !== origin || !expectedRoute ||
      parsedRequest.search !== "" || parsedRequest.hash !== "" || request.method !== "GET"
    ) {
      captureViolations.push(`unexpected request URL/method: ${request.method} ${requestUrl}`);
    }
  } catch {
    captureViolations.push(`request URL was not parseable: ${requestUrl}`);
  }
  const requestKey = `${baseKey}:${hop}`;
  requests.set(requestKey, {
    sessionId: eventSession,
    requestId: String(params.requestId),
    hop,
    url: requestUrl,
    method: String(request.method),
    status: null,
    mimeType: null,
    fromDiskCache: false,
    fromServiceWorker: false,
    redirected: false,
    failed: false,
    errorText: null,
    body: null,
  });
  activeRequestKeys.set(baseKey, requestKey);
  return requestKey;
}

async function createInstrumentedTarget(
  client: CdpClient,
  origin: string,
  options: { shortTimeout?: boolean; blockWorkerMessages?: boolean } = {},
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
  const activeRequestKeys = new Map<string, string>();
  const scripts: Array<{ route: string; context: "page" | "worker"; bytes: Uint8Array }> = [];
  const captureViolations: string[] = [];
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
      retainRequestHop(
        requests,
        activeRequestKeys,
        captureViolations,
        origin,
        eventSession,
        params,
      );
    }),
    client.on("Network.responseReceived", (params, eventSession) => {
      if (!eventSession) return;
      const record = requests.get(
        activeRequestKeys.get(`${eventSession}:${params.requestId}`) ?? "",
      );
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
      const baseKey = `${eventSession}:${params.requestId}`;
      const record = requests.get(activeRequestKeys.get(baseKey) ?? "");
      if (!record) return;
      activeRequestKeys.delete(baseKey);
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
      const baseKey = `${eventSession}:${params.requestId}`;
      const record = requests.get(activeRequestKeys.get(baseKey) ?? "");
      activeRequestKeys.delete(baseKey);
      if (record) Object.assign(record, { failed: true, errorText: String(params.errorText) });
    }),
    client.on("Debugger.scriptParsed", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      let disposition: ReturnType<typeof classifyExecutedScriptUrl>;
      try {
        disposition = classifyExecutedScriptUrl(String(params.url ?? ""), origin);
      } catch (error) {
        captureViolations.push(error instanceof Error ? error.message : String(error));
        return;
      }
      if (disposition.kind === "collector") {
        tasks.push((async () => {
          const source = await client.send(
            "Debugger.getScriptSource",
            { scriptId: String(params.scriptId) },
            eventSession,
            10_000,
          );
          const scriptSource = String(source.scriptSource);
          const remaining = expectedCollectorSources.get(scriptSource) ?? 0;
          if (remaining < 1) {
            captureViolations.push(
              `unregistered collector instrumentation source: ${disposition.url}`,
            );
          } else if (remaining === 1) {
            expectedCollectorSources.delete(scriptSource);
          } else {
            expectedCollectorSources.set(scriptSource, remaining - 1);
          }
        })());
        return;
      }
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
        scripts.push({ route: disposition.route, context, bytes });
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
    source: collectorSource(
      probeSource(Boolean(options.shortTimeout), Boolean(options.blockWorkerMessages)),
      COLLECTOR_PROBE_URL,
    ),
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
    activeRequestKeys,
    scripts,
    captureViolations,
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
  if (capture.activeRequestKeys.size > 0) {
    throw new Error("network capture retained incomplete active requests");
  }
  if (expectedCollectorSources.size > 0) {
    throw new Error("collector instrumentation executions were not exhaustively captured");
  }
  if (capture.captureViolations.length > 0) {
    throw new Error(capture.captureViolations.join("\n"));
  }
  const expectedRoutes = new Set(EXPECTED_ASSETS.map((asset) => asset.route));
  for (const request of capture.requests.values()) {
    const url = new URL(String(request.url));
    if (url.origin !== origin) throw new Error(`network escaped owned origin: ${url.href}`);
    if (!expectedRoutes.has(url.pathname) || url.search !== "" || url.hash !== "") {
      throw new Error(`unexpected owned-origin request: ${url.href}`);
    }
    if (request.method !== "GET") {
      throw new Error(`unexpected request method: ${request.method} ${url.href}`);
    }
    if (request.hop !== 0 || request.redirected) {
      throw new Error(`unexpected redirect request record: ${JSON.stringify(request)}`);
    }
    if (request.failed || request.status !== 200 || !(request.body instanceof Uint8Array)) {
      throw new Error(`failed, incomplete, or non-200 request: ${JSON.stringify(request)}`);
    }
  }
  const fetchedAssets = [];
  for (const asset of EXPECTED_ASSETS) {
    const matches = [...capture.requests.values()].filter((request) =>
      new URL(String(request.url)).pathname === asset.route
    );
    if (matches.length !== asset.requestCount) {
      throw new Error(
        `asset request count mismatch for ${asset.route}: ${matches.length} != ${asset.requestCount}`,
      );
    }
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
      requestCount: asset.requestCount,
      status: 200,
      mimeType: String(matches[0].mimeType),
      fromDiskCache: false,
      fromServiceWorker: false,
      bytes: expected.bytes.byteLength,
      sha256: expected.sha256,
    });
  }

  const executedScripts = [];
  for (const asset of EXPECTED_ASSETS.filter((candidate) => candidate.executedIn.length > 0)) {
    const observations = capture.scripts.filter((script) => script.route === asset.route);
    if (observations.length !== asset.executedIn.length) {
      throw new Error(
        `executed script count mismatch for ${asset.route}: ${observations.length} != ${asset.executedIn.length}`,
      );
    }
    const contexts = observations.map((observation) => observation.context).sort();
    if (JSON.stringify(contexts) !== JSON.stringify([...asset.executedIn].sort())) {
      throw new Error(`executed script context mismatch for ${asset.route}`);
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
      contexts,
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
    if (capture.exceptions.length > 0 || capture.consoleMessages.length > 0) {
      throw new Error(`${mode}: console and exceptions must both be empty`);
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
      screenshotBytes,
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
  id: keyof typeof EXPECTED_LIFECYCLE,
) {
  const capture = await createInstrumentedTarget(client, origin, {
    shortTimeout: id === "timeout",
    blockWorkerMessages: true,
  });
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
      wrongTokenIgnored = Boolean(
        await evaluateValue(
          client,
          capture.sessionId,
          `(() => { const state=()=>({status:document.querySelector('#status').textContent.trim(),result:document.querySelector('#result').textContent.trim(),progress:document.querySelector('#progress').value,startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled}); const before=state(); const p=globalThis.__baseRegexCollector; p.workers[0].worker.dispatchEvent(new MessageEvent('message',{data:{type:'complete',token:999999,result:{}}})); return JSON.stringify(before)===JSON.stringify(state()); })()`,
        ),
      );
      await click(client, capture.sessionId, "#cancel");
    } else if (id === "stale-error") {
      await click(client, capture.sessionId, "#cancel");
      staleErrorIgnored = Boolean(
        await evaluateValue(
          client,
          capture.sessionId,
          `(() => { const state=()=>({status:document.querySelector('#status').textContent.trim(),result:document.querySelector('#result').textContent.trim(),progress:document.querySelector('#progress').value,startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled}); const before=state(); const event=new Event('error'); Object.defineProperty(event,'message',{value:'stale collector error'}); globalThis.__baseRegexCollector.workers[0].worker.dispatchEvent(event); return JSON.stringify(before)===JSON.stringify(state()); })()`,
        ),
      );
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
    const state = await pageState(client, capture.sessionId);
    const workerState = await evaluateValue(
      client,
      capture.sessionId,
      `(() => { const workers=globalThis.__baseRegexCollector.workers; return {count:workers.length,terminated:workers.filter((entry)=>entry.terminated).length}; })()`,
    ) as { count: number; terminated: number };
    await settleCapture(capture);
    if (capture.activeRequestKeys.size > 0) {
      throw new Error(`${id}: network capture retained incomplete active requests`);
    }
    if (expectedCollectorSources.size > 0) {
      throw new Error(`${id}: collector instrumentation was not exhaustively captured`);
    }
    if (capture.captureViolations.length > 0) {
      throw new Error(`${id}: ${capture.captureViolations.join("; ")}`);
    }
    for (const request of capture.requests.values()) {
      if (
        request.hop !== 0 || request.redirected || request.failed || request.status !== 200 ||
        !(request.body instanceof Uint8Array)
      ) {
        throw new Error(`${id}: incomplete, redirected, or failed request evidence`);
      }
    }
    if (capture.exceptions.length > 0 || capture.consoleMessages.length > 0) {
      throw new Error(`${id}: lifecycle console and exceptions must both be empty`);
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
    const expected = EXPECTED_LIFECYCLE[id];
    if (
      !required || state.status !== expected.finalStatus ||
      workerState.count !== expected.workers ||
      workerState.terminated !== expected.terminated
    ) {
      throw new Error(`${id}: exact lifecycle assertion failed`);
    }
    return {
      id,
      action: "visible-controller-lifecycle-probe",
      finalStatus: expected.finalStatus,
      workerCount: expected.workers,
      terminatedWorkers: expected.terminated,
      ...booleans,
      console: capture.consoleMessages,
      exceptions: capture.exceptions,
    };
  } finally {
    await closeCapture(client, capture);
  }
}

function exactIdentity(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return left.pid === right.pid && left.parentPid === right.parentPid &&
    left.startTimeTicks === right.startTimeTicks && left.executable === right.executable;
}

export function validateEvidenceRelationships(evidence: Record<string, unknown>): void {
  const browser = evidence.browser as Record<string, unknown>;
  const executable = browser.executable as Record<string, unknown>;
  const profile = browser.profile as Record<string, unknown>;
  const ownership = browser.ownership as Record<string, unknown>;
  const cgroup = ownership.cgroup as Record<string, unknown>;
  const cdpListener = ownership.cdpListener as Record<string, unknown>;
  const scopeLauncher = ownership.scopeLauncherAtLaunch as Record<string, unknown>;
  const browserAtLaunch = ownership.browserAtLaunch as Record<string, unknown>;
  const preCgroup = ownership.preCgroupProcesses as Array<Record<string, unknown>>;
  const listenerChecks = ownership.listenerChecks as Array<Record<string, unknown>>;
  const launchArguments = browser.launchArguments as string[];
  const cleanup = evidence.cleanup as Record<string, Record<string, unknown>>;
  const browserCleanup = cleanup.browser;
  const profileCleanup = cleanup.profile;
  const server = evidence.server as Record<string, unknown>;
  const serverCleanup = cleanup.server;
  if (
    browser.channel !== "chrome-for-testing" || browser.product !== CFT_PRODUCT ||
    executable.sha256 !== CFT_EXECUTABLE_SHA256
  ) {
    throw new Error("browser product and executable must match the approved CfT identity");
  }
  const portArguments = launchArguments.filter((argument) =>
    argument.startsWith("--remote-debugging-port=")
  );
  const profileArguments = launchArguments.filter((argument) =>
    argument.startsWith("--user-data-dir=")
  );
  if (
    portArguments.length !== 1 ||
    Number(portArguments[0].slice("--remote-debugging-port=".length)) !== cdpListener.port
  ) {
    throw new Error("CDP listener port does not match the unique launch argument");
  }
  if (
    profileArguments.length !== 1 ||
    profileArguments[0].slice("--user-data-dir=".length) !== profile.path ||
    profileCleanup.path !== profile.path
  ) {
    throw new Error("profile identity does not match launch and cleanup paths");
  }
  const unit = String(ownership.unit);
  if (
    !String(cgroup.path).endsWith(`/${unit}`) || browserCleanup.unit !== unit ||
    JSON.stringify(browserCleanup.cgroup) !== JSON.stringify(cgroup)
  ) {
    throw new Error("systemd unit and cgroup identities do not reconcile across cleanup");
  }
  const initialOwner = cdpListener.owner as Record<string, unknown>;
  const cleanupLauncher = browserCleanup.launcher as Record<string, unknown>;
  if (
    initialOwner.executable !== executable.path || cleanupLauncher.executable !== executable.path ||
    !exactIdentity(browserAtLaunch, initialOwner) || !exactIdentity(initialOwner, cleanupLauncher)
  ) {
    throw new Error("CDP owner and cleanup launcher do not match the approved executable identity");
  }
  const expectedPhases = ["before-connect", "after-connect", "before-use", "after-use"];
  if (
    listenerChecks.length !== expectedPhases.length ||
    listenerChecks.some((check, index) =>
      check.phase !== expectedPhases[index] || check.address !== cdpListener.address ||
      check.port !== cdpListener.port || check.inode !== cdpListener.inode ||
      !exactIdentity(check.owner as Record<string, unknown>, initialOwner)
    )
  ) {
    throw new Error("CDP listener checks do not retain one inode/owner through use");
  }
  if (
    browserAtLaunch.executable !== executable.path ||
    !preCgroup.some((identity) => exactIdentity(identity, scopeLauncher)) ||
    !preCgroup.some((identity) => exactIdentity(identity, browserAtLaunch))
  ) {
    throw new Error("immediate scope/browser identities are absent from pre-cgroup retention");
  }
  const observed = browserCleanup.observedProcesses as Array<Record<string, unknown>>;
  if (
    !observed.some((identity) => exactIdentity(identity, scopeLauncher)) ||
    !observed.some((identity) => exactIdentity(identity, browserAtLaunch)) ||
    !observed.some((identity) => exactIdentity(identity, initialOwner))
  ) {
    throw new Error("cleanup process ledger omits retained launch or CDP identities");
  }
  if (
    !exactIdentity(
      server.launcher as Record<string, unknown>,
      serverCleanup.launcher as Record<string, unknown>,
    )
  ) {
    throw new Error("server launch and cleanup identities do not match");
  }
}

async function main() {
  const chromeArg = Deno.args.find((value) => value.startsWith("--chrome="));
  if (!chromeArg || Deno.args.length !== 1) {
    throw new Error(
      "usage: deno run -A scripts/collect-base-text-regex-log-scan-evidence.ts --chrome=<path>",
    );
  }
  if (Deno.build.os !== "linux") throw new Error("exact cgroup-owned cleanup requires Linux");
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
  const scriptSha256 = await sha256Hex(scriptBytes);
  const executableAtLaunch = await fileIdentity(chromeArg.slice("--chrome=".length));
  if (executableAtLaunch.sha256 !== CFT_EXECUTABLE_SHA256) {
    throw new Error("collector requires the approved Chrome for Testing executable SHA-256");
  }
  const expectedFiles = await expectedFileRecords(rootPath);
  const registration = JSON.parse(
    await Deno.readTextFile(
      `${rootPath}/public/data/base-implementations/text.regex-log-scan.v1.json`,
    ),
  );

  let server: Deno.ChildProcess | null = null;
  let serverStatusPromise: Promise<Deno.CommandStatus> | null = null;
  let serverIdentity: ProcessIdentity | null = null;
  let profilePath: string | null = null;
  let profileIdentity: { dev: number; ino: number } | null = null;
  let browserProcess: Deno.ChildProcess | null = null;
  let browserStatusPromise: Promise<Deno.CommandStatus> | null = null;
  let browserCgroup: CgroupIdentity | null = null;
  let launchTracker: ReturnType<typeof startOwnedProcessTracker> | null = null;
  let tracker: ReturnType<typeof startCgroupTracker> | null = null;
  let client: CdpClient | null = null;
  let completed = false;
  let collectionError: unknown = null;
  let failureCleanupError: Error | null = null;
  try {
    const serverPort = unusedPort();
    const debuggerPort = unusedPort();
    const origin = `http://127.0.0.1:${serverPort}`;
    server = new Deno.Command(Deno.execPath(), {
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
    serverStatusPromise = server.status;
    serverIdentity = await processIdentity(server.pid);
    if (!serverIdentity) throw new Error("evidence server identity disappeared at launch");
    await waitFor(`${origin}/healthz`);
    if (!(await identityStillRunning(serverIdentity))) {
      throw new Error("evidence server identity changed during startup");
    }

    profilePath = await Deno.makeTempDir({ prefix: "wasm-base-regex-chrome-" });
    const profileInfo = await Deno.lstat(profilePath);
    if ([...Deno.readDirSync(profilePath)].length !== 0) {
      throw new Error("new Chrome profile is not empty");
    }
    profileIdentity = { dev: Number(profileInfo.dev), ino: Number(profileInfo.ino) };
    const launchArguments = [
      ...STATIC_LAUNCH_ARGUMENTS,
      `--remote-debugging-port=${debuggerPort}`,
      `--user-data-dir=${profilePath}`,
      "about:blank",
    ];
    const scopeUnit = `wasm-base-regex-${crypto.randomUUID().replaceAll("-", "")}`;
    browserProcess = new Deno.Command("systemd-run", {
      args: [
        "--user",
        "--scope",
        `--unit=${scopeUnit}`,
        "--quiet",
        executableAtLaunch.path,
        ...launchArguments,
      ],
      stdout: "null",
      stderr: "null",
    }).spawn();
    browserStatusPromise = browserProcess.status;
    launchTracker = startOwnedProcessTracker(browserProcess.pid);
    const scopeLauncherAtLaunch = await processIdentity(browserProcess.pid);
    if (!scopeLauncherAtLaunch) {
      throw new Error("systemd scope launcher identity disappeared immediately after launch");
    }
    const browserAtLaunch = await waitForOwnedExecutable(
      scopeLauncherAtLaunch.pid,
      executableAtLaunch.path,
    );
    browserCgroup = await waitForScopeCgroup(scopeLauncherAtLaunch.pid, scopeUnit);
    const trackedBeforeCgroup = await launchTracker.stop();
    const preCgroupProcesses = [...new Map(
      [scopeLauncherAtLaunch, browserAtLaunch, ...trackedBeforeCgroup].map((identity) => [
        `${identity.pid}:${identity.startTimeTicks}:${identity.executable}`,
        identity,
      ]),
    ).values()].sort((a, b) => a.pid - b.pid);
    launchTracker = null;
    if (
      !preCgroupProcesses.some((identity) =>
        identity.pid === scopeLauncherAtLaunch.pid &&
        identity.startTimeTicks === scopeLauncherAtLaunch.startTimeTicks &&
        identity.executable === scopeLauncherAtLaunch.executable
      )
    ) {
      throw new Error("immediate systemd scope launcher identity was not retained");
    }
    tracker = startCgroupTracker(browserCgroup.path);

    let cdpListener: Awaited<ReturnType<typeof listenerOwnership>> | null = null;
    const listenerDeadline = Date.now() + 10_000;
    while (!cdpListener && Date.now() < listenerDeadline) {
      try {
        cdpListener = await listenerOwnership(debuggerPort, browserCgroup.path);
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    if (!cdpListener) throw new Error("owned Chrome CDP listener did not appear");
    if (cdpListener.owner.executable !== executableAtLaunch.path) {
      throw new Error("CDP listener owner is not the inspected Chrome executable");
    }

    const versionResponse = await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`);
    const discovery = await versionResponse.json();
    const socketUrl = new URL(discovery.webSocketDebuggerUrl);
    if (
      socketUrl.protocol !== "ws:" || socketUrl.hostname !== "127.0.0.1" ||
      Number(socketUrl.port) !== debuggerPort
    ) {
      throw new Error("Chrome CDP endpoint escaped the exact owned loopback listener");
    }
    client = new CdpClient(socketUrl.href);
    await client.ready();
    const listenerChecks = [
      { phase: "before-connect" as const, ...cdpListener },
      await revalidateListener(cdpListener, debuggerPort, browserCgroup.path, "after-connect"),
    ];
    const browserVersion = await client.send("Browser.getVersion");
    if (browserVersion.product !== CFT_PRODUCT) {
      throw new Error(
        `collector requires exact Chrome for Testing ${CFT_PRODUCT}, got ${browserVersion.product}`,
      );
    }
    const commandLine = await client.send("Browser.getBrowserCommandLine");
    const actualLaunchArguments = (commandLine.arguments as string[]).slice(1);
    if (JSON.stringify(actualLaunchArguments) !== JSON.stringify(launchArguments)) {
      throw new Error("running Chrome command line differs from pinned launch arguments");
    }
    if (
      !(await identityStillRunning(cdpListener.owner)) ||
      await processCgroupPath(cdpListener.owner.pid) !== browserCgroup.path
    ) {
      throw new Error("connected CDP listener left its retained process/cgroup identity");
    }

    listenerChecks.push(
      await revalidateListener(cdpListener, debuggerPort, browserCgroup.path, "before-use"),
    );
    const capturedModeRuns = [];
    for (const mode of ["js-controlled", "wasm-linear-controlled"] as const) {
      capturedModeRuns.push(await collectModeRun(client, origin, mode, expectedFiles));
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
    listenerChecks.push(
      await revalidateListener(cdpListener, debuggerPort, browserCgroup.path, "after-use"),
    );

    const executableBeforeCleanup = await fileIdentity(executableAtLaunch.path);
    if (!sameFileIdentity(executableAtLaunch, executableBeforeCleanup)) {
      throw new Error("Chrome executable identity changed during collection");
    }
    const cgroupBeforeCleanup = await cgroupIdentity(browserCgroup.path);
    const cgroupIdentityMatched = cgroupBeforeCleanup.dev === browserCgroup.dev &&
      cgroupBeforeCleanup.ino === browserCgroup.ino;
    if (!cgroupIdentityMatched) throw new Error("owned Chrome cgroup identity changed");

    const signals: Array<{ pid: number; signal: "SIGTERM" | "SIGKILL" }> = [];
    await client.send("Browser.close");
    client.close();
    client = null;
    if (!(await waitForCgroupEmpty(browserCgroup.path, 10_000))) {
      await signalCgroup(browserCgroup.path, "SIGTERM", signals);
    }
    if (!(await waitForCgroupEmpty(browserCgroup.path, 5_000))) {
      await signalCgroup(browserCgroup.path, "SIGKILL", signals);
    }
    const processesAbsent = await waitForCgroupEmpty(browserCgroup.path, 5_000);
    if (!processesAbsent) throw new Error("owned Chrome cgroup retained live processes");
    const cgroupObservedProcesses = await tracker.stop();
    tracker = null;
    const observedProcesses = [...new Map(
      [...preCgroupProcesses, ...cgroupObservedProcesses].map((identity) => [
        `${identity.pid}:${identity.startTimeTicks}:${identity.executable}`,
        identity,
      ]),
    ).values()].sort((a, b) => a.pid - b.pid);
    const launcherIdentity = observedProcesses.find((identity) =>
      identity.pid === cdpListener.owner.pid &&
      identity.startTimeTicks === cdpListener.owner.startTimeTicks
    );
    if (!launcherIdentity) throw new Error("CDP listener owner was not retained by cgroup tracker");
    const browserExit = await browserStatusPromise;
    const cgroupRemoved = await waitForPathAbsent(
      `/sys/fs/cgroup${browserCgroup.path}`,
      5_000,
    );
    if (!cgroupRemoved) throw new Error("owned Chrome cgroup survived cleanup");

    const currentProfileInfo = await Deno.lstat(profilePath);
    const profileMatched = Number(currentProfileInfo.dev) === profileIdentity.dev &&
      Number(currentProfileInfo.ino) === profileIdentity.ino && !currentProfileInfo.isSymlink;
    if (!profileMatched) throw new Error("Chrome profile identity changed before removal");
    await Deno.remove(profilePath, { recursive: true });
    const profileAbsent = await waitForPathAbsent(profilePath, 2_000);
    if (!profileAbsent) throw new Error("owned Chrome profile survived cleanup");

    if (await identityStillRunning(serverIdentity)) Deno.kill(server.pid, "SIGTERM");
    const serverExit = await serverStatusPromise;
    const serverAbsent = !(await identityStillRunning(serverIdentity));
    if (!serverAbsent) throw new Error("owned evidence server survived cleanup");

    const endDirty = await commandText(rootPath, "git", [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]);
    const endHead = await commandText(rootPath, "git", ["rev-parse", "HEAD"]);
    const endTree = await commandText(rootPath, "git", ["rev-parse", "HEAD^{tree}"]);
    const endScriptBytes = await Deno.readFile(`${rootPath}/${SCRIPT_PATH}`);
    if (
      endDirty !== "" || endHead !== head || endTree !== tree ||
      endScriptBytes.byteLength !== scriptBytes.byteLength ||
      await sha256Hex(endScriptBytes) !== scriptSha256
    ) {
      throw new Error("collector source identity changed before evidence write");
    }
    for (const asset of EXPECTED_ASSETS) {
      const endBytes = await Deno.readFile(`${rootPath}/${asset.sourcePath}`);
      const expected = expectedFiles.get(asset.route)!;
      if (
        endBytes.byteLength !== expected.bytes.byteLength ||
        await sha256Hex(endBytes) !== expected.sha256
      ) {
        throw new Error(`end source check changed: ${asset.sourcePath}`);
      }
    }
    if (!sameFileIdentity(executableAtLaunch, await fileIdentity(executableAtLaunch.path))) {
      throw new Error("Chrome executable identity changed at end source check");
    }

    const screenshotOutputs = capturedModeRuns.map((run) => ({
      path: run.screenshot.path,
      bytes: run.screenshotBytes,
    }));
    const modeRuns = capturedModeRuns.map(({ screenshotBytes: _screenshotBytes, ...run }) => run);
    const regressionReason =
      "The accepted UI exposes only the exact registered 100 MiB fixture; static target-equivalence tests retain this regression.";
    const evidence = {
      schemaVersion: 1,
      evidenceId: "base-text-regex-log-scan-chrome-v1",
      collectedAt: new Date().toISOString(),
      source: { head, tree, root: rootPath, clean: true, endCheck: true },
      collection: {
        script: SCRIPT_PATH,
        scriptBytes: scriptBytes.byteLength,
        scriptSha256,
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
        channel: "chrome-for-testing",
        product: String(browserVersion.product),
        revision: String(browserVersion.revision),
        userAgent: String(browserVersion.userAgent),
        jsVersion: String(browserVersion.jsVersion),
        protocol: "Chrome DevTools Protocol",
        executable: executableAtLaunch,
        launchArguments: actualLaunchArguments,
        headless: true,
        profile: { path: profilePath, ...profileIdentity, createdEmpty: true },
        ownership: {
          unit: `${scopeUnit}.scope`,
          cgroup: browserCgroup,
          scopeLauncherAtLaunch,
          browserAtLaunch,
          preCgroupProcesses,
          cdpListener,
          listenerChecks,
        },
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
          unit: `${scopeUnit}.scope`,
          cgroup: browserCgroup,
          launcher: launcherIdentity,
          observedProcesses,
          requested: "Browser.close",
          signals,
          exit: browserExit,
          processesAbsent,
          executableUnchanged: true,
          cgroupIdentityMatched,
          cgroupEmpty: true,
          cgroupRemoved,
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
    validateEvidenceRelationships(evidence as unknown as Record<string, unknown>);
    await Deno.mkdir(`${rootPath}/${SCREENSHOT_ROOT}`, { recursive: true });
    for (const screenshot of screenshotOutputs) {
      await Deno.writeFile(`${rootPath}/${screenshot.path}`, screenshot.bytes);
    }
    await Deno.writeTextFile(`${rootPath}/${OUTPUT_PATH}`, `${canonicalize(evidence)}\n`);
    completed = true;
    console.log(
      "base-text-regex-log-scan evidence: 2 full modes + 6 exact lifecycle probes; cgroup cleanup exact",
    );
  } catch (error) {
    collectionError = error;
  } finally {
    if (!completed) {
      const cleanupFailures: string[] = [];
      const launchRetained = await launchTracker?.stop().catch(() => []) ?? [];
      launchTracker = null;
      const lateFallback = browserCgroup
        ? await cgroupProcesses(browserCgroup.path)
        : browserProcess
        ? await ownedProcesses(browserProcess.pid)
        : [];
      const fallbackProcesses = [...new Map(
        [...launchRetained, ...lateFallback].map((identity) => [
          `${identity.pid}:${identity.startTimeTicks}:${identity.executable}`,
          identity,
        ]),
      ).values()];
      try {
        await client?.send("Browser.close");
      } catch {
        // Continue with the identities retained before requesting browser close.
      }
      client?.close();
      let browserAbsent = true;
      if (browserCgroup) {
        const ignoredSignals: Array<{ pid: number; signal: "SIGTERM" | "SIGKILL" }> = [];
        if (!(await waitForCgroupEmpty(browserCgroup.path, 2_000))) {
          await signalCgroup(browserCgroup.path, "SIGTERM", ignoredSignals).catch(() => {});
        }
        if (!(await waitForCgroupEmpty(browserCgroup.path, 2_000))) {
          await signalCgroup(browserCgroup.path, "SIGKILL", ignoredSignals).catch(() => {});
        }
        browserAbsent = await waitForCgroupEmpty(browserCgroup.path, 2_000);
      } else if (!(await waitForOwnedExit(fallbackProcesses, 2_000))) {
        for (const identity of [...fallbackProcesses].reverse()) {
          if (await identityStillRunning(identity)) Deno.kill(identity.pid, "SIGTERM");
        }
        if (!(await waitForOwnedExit(fallbackProcesses, 2_000))) {
          for (const identity of [...fallbackProcesses].reverse()) {
            if (await identityStillRunning(identity)) Deno.kill(identity.pid, "SIGKILL");
          }
        }
        browserAbsent = await waitForOwnedExit(fallbackProcesses, 2_000);
      }
      if (!browserAbsent) cleanupFailures.push("owned browser processes survived failure cleanup");
      if (browserAbsent) await browserStatusPromise?.catch(() => {});
      await tracker?.stop().catch(() => []);

      if (server && serverIdentity && await identityStillRunning(serverIdentity)) {
        Deno.kill(server.pid, "SIGTERM");
      }
      await serverStatusPromise?.catch(() => {});
      if (serverIdentity && await identityStillRunning(serverIdentity)) {
        cleanupFailures.push("owned evidence server survived failure cleanup");
      }

      if (profilePath && profileIdentity) {
        const current = await Deno.lstat(profilePath).catch(() => null);
        if (
          current && Number(current.dev) === profileIdentity.dev &&
          Number(current.ino) === profileIdentity.ino && !current.isSymlink
        ) {
          await Deno.remove(profilePath, { recursive: true }).catch(() => {});
        } else if (current) {
          cleanupFailures.push("profile identity changed during failure cleanup");
        }
        if (!(await waitForPathAbsent(profilePath, 2_000))) {
          cleanupFailures.push("owned profile survived failure cleanup");
        }
      }
      const outputRoot = `${rootPath}/artifacts/base/text-regex-log-scan/browser-evidence`;
      await Deno.remove(outputRoot, { recursive: true }).catch(() => {});
      if (!(await waitForPathAbsent(outputRoot, 2_000))) {
        cleanupFailures.push("partial evidence output survived failure cleanup");
      }
      if (cleanupFailures.length > 0) {
        failureCleanupError = new Error(
          `collector failure cleanup was not exact: ${cleanupFailures.join("; ")}`,
        );
      }
    }
  }
  if (failureCleanupError) {
    throw new AggregateError(
      collectionError ? [collectionError, failureCleanupError] : [failureCleanupError],
      "collector failed and failure cleanup was not exact",
    );
  }
  if (collectionError) throw collectionError;
}

if (import.meta.main) await main();

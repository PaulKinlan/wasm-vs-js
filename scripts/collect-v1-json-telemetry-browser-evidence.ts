import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

const SCRIPT = "scripts/collect-v1-json-telemetry-browser-evidence.ts";
const WORKLOAD = "serialization.json-telemetry.v1";
const DEMO_ROUTE = "/demos/serialization.json-telemetry.v1/";
const root = await Deno.realPath(new URL("../", import.meta.url));
const chromeArgument = Deno.args.find((value) => value.startsWith("--chrome="))?.slice(9) ?? "";
const outputArgument = Deno.args.find((value) => value.startsWith("--output="))?.slice(9) ?? "";
if (Deno.args.length !== 2 || !chromeArgument || !outputArgument) {
  throw new Error(
    `usage: deno run -A ${SCRIPT} --chrome=<absolute-path> --output=<absolute-json-path>`,
  );
}
const executable = await Deno.realPath(chromeArgument);
if (!outputArgument.startsWith("/") || !outputArgument.endsWith(".json")) {
  throw new Error("--output must be an absolute JSON path outside the source root");
}
const outputPath = outputArgument;
const outputParent = outputPath.slice(0, outputPath.lastIndexOf("/")) || "/";
await Deno.mkdir(outputParent, { recursive: true });
const resolvedOutputParent = await Deno.realPath(outputParent);
if (resolvedOutputParent === root || resolvedOutputParent.startsWith(`${root}/`)) {
  throw new Error("browser evidence must be written outside the clean source root");
}

async function commandText(command: string, args: string[]): Promise<string> {
  const result = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr).trim());
  return new TextDecoder().decode(result.stdout).trim();
}
async function systemdShow(unit: string): Promise<Record<string, string>> {
  const text = await commandText("/usr/bin/systemctl", [
    "--user",
    "show",
    unit,
    "--property=MainPID,ControlGroup,ActiveState,LoadState,InvocationID",
  ]);
  return Object.fromEntries(
    text.split("\n").filter(Boolean).map((line) => {
      const equals = line.indexOf("=");
      return [line.slice(0, equals), line.slice(equals + 1)];
    }),
  );
}
async function waitSystemd(unit: string): Promise<Record<string, string>> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const state = await systemdShow(unit);
    if (
      state.ActiveState === "active" && Number(state.MainPID) > 1 &&
      /^\/.+/.test(state.ControlGroup ?? "") && /^[a-f0-9]{32}$/.test(state.InvocationID ?? "")
    ) return state;
    await delay(25);
  }
  throw new Error("owned Chrome systemd service did not become active");
}
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function numeric(value: number | bigint | null | undefined, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`${label} unavailable`);
  return result;
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
async function identityRunning(identity: ProcessIdentity): Promise<boolean> {
  const current = await processIdentity(identity.pid);
  return current?.startTimeTicks === identity.startTimeTicks &&
    current.executable === identity.executable;
}
async function readCgroupMembers(path: string): Promise<number[]> {
  return (await Deno.readTextFile(`${path}/cgroup.procs`)).split(/\s+/).filter(Boolean).map(Number)
    .filter((pid) => Number.isSafeInteger(pid) && pid > 1).sort((a, b) => a - b);
}
async function waitCgroupEmpty(path: string, timeoutMs: number): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  let remaining: number[] = [];
  while (Date.now() < deadline) {
    remaining = await readCgroupMembers(path).catch(() => []);
    if (!remaining.length) return [];
    await delay(25);
  }
  return remaining;
}
type CleanupCheck =
  | { outcome: "success"; checkedAt: string; remaining: never[] }
  | { outcome: "failure"; checkedAt: string; remaining: string[]; error: string };
function successCheck(): CleanupCheck {
  return { outcome: "success", checkedAt: new Date().toISOString(), remaining: [] };
}
function failureCheck(error: unknown, remaining: string[] = []): CleanupCheck {
  return {
    outcome: "failure",
    checkedAt: new Date().toISOString(),
    remaining,
    error: error instanceof Error ? error.message : String(error),
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
  let reason = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "error" });
      if (response.ok) return response;
      reason = `HTTP ${response.status}`;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
    await delay(50);
  }
  throw new Error(`${url} unavailable: ${reason}`);
}
function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    output += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(output);
}
function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

const clean = await commandText("git", ["status", "--porcelain=v1", "--untracked-files=all"]);
if (clean !== "") throw new Error("collector requires an exact clean HEAD before any launch");
const sourceCommit = await commandText("git", ["rev-parse", "HEAD"]);
const sourceTree = await commandText("git", ["rev-parse", "HEAD^{tree}"]);
if (!/^[a-f0-9]{40}$/.test(sourceCommit) || !/^[a-f0-9]{40}$/.test(sourceTree)) {
  throw new Error("clean HEAD identity unavailable");
}
const scriptBytes = await Deno.readFile(`${root}/${SCRIPT}`);
const executableInfo = await Deno.lstat(executable);
if (!executableInfo.isFile || executableInfo.isSymlink) {
  throw new Error("Chrome must be a regular file");
}
const executableSha256 = await sha256Hex(await Deno.readFile(executable));
const executableBytes = numeric(executableInfo.size, "Chrome executable size");

const serverPort = unusedPort();
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
const serverLauncher = await processIdentity(server.pid);
if (!serverLauncher) throw new Error("owned loopback server identity unavailable");
const ownedServerLauncher: ProcessIdentity = serverLauncher;
await waitFor(`${origin}/healthz`);

const profilePath = await Deno.makeTempDir({ prefix: "wasm-json-telemetry-chrome-" });
const unit = `wasm-json-telemetry-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}.service`;
const launchArguments = [
  `--user-data-dir=${profilePath}`,
  "--remote-debugging-port=0",
  "--remote-debugging-address=127.0.0.1",
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
  "about:blank",
];
await commandText("/usr/bin/systemd-run", [
  "--user",
  `--unit=${unit}`,
  "--collect",
  "--quiet",
  "--property=Type=exec",
  "--property=KillMode=control-group",
  "--property=CollectMode=inactive-or-failed",
  "--",
  executable,
  ...launchArguments,
]);
const systemd = await waitSystemd(unit);
const controlGroup = systemd.ControlGroup;
const cgroupPath = `/sys/fs/cgroup${controlGroup}`;
const cgroupInfo = await Deno.lstat(cgroupPath);
if (
  !cgroupInfo.isDirectory || cgroupInfo.isSymlink || await Deno.realPath(cgroupPath) !== cgroupPath
) {
  throw new Error("unsafe owned Chrome cgroup identity");
}
const cgroupDevice = numeric(cgroupInfo.dev, "cgroup device");
const cgroupInode = numeric(cgroupInfo.ino, "cgroup inode");
const mainPid = Number(systemd.MainPID);
const mainIdentity = await processIdentity(mainPid);
if (!mainIdentity || mainIdentity.executable !== executable) {
  throw new Error("systemd MainPID is not the reviewed Chrome executable");
}
const memberSnapshots: Array<{ at: string; pids: number[] }> = [];
const observedBrowserProcesses = new Map<number, ProcessIdentity>();
async function snapshotMembers(): Promise<number[]> {
  const pids = await readCgroupMembers(cgroupPath);
  memberSnapshots.push({ at: new Date().toISOString(), pids });
  for (const pid of pids) {
    const identity = await processIdentity(pid);
    if (identity) observedBrowserProcesses.set(pid, identity);
  }
  return pids;
}
if (!(await snapshotMembers()).includes(mainPid)) {
  throw new Error("Chrome MainPID absent from cgroup");
}
const cgroupKill = await Deno.open(`${cgroupPath}/cgroup.kill`, { write: true });

const activePortPath = `${profilePath}/DevToolsActivePort`;
let debuggerPort = 0;
let browserPath = "";
const endpointDeadline = Date.now() + 10_000;
while (Date.now() < endpointDeadline) {
  try {
    const lines = (await Deno.readTextFile(activePortPath)).trim().split(/\r?\n/);
    debuggerPort = Number(lines[0]);
    browserPath = lines[1] ?? "";
    if (debuggerPort > 0 && /^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(browserPath)) break;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  await delay(25);
}
if (!debuggerPort || !browserPath) throw new Error("owned Chrome DevToolsActivePort unavailable");
const discovery = await (await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
const webSocketUrl = new URL(discovery.webSocketDebuggerUrl);
if (
  webSocketUrl.protocol !== "ws:" || webSocketUrl.hostname !== "127.0.0.1" ||
  Number(webSocketUrl.port) !== debuggerPort || webSocketUrl.pathname !== browserPath
) throw new Error("Chrome CDP endpoint escaped the owned loopback listener");
const client = new CdpClient(webSocketUrl.href);
await client.ready();
const version = await client.send("Browser.getVersion");
const effectiveArguments = (await client.send("Browser.getBrowserCommandLine")).arguments;
if (!Array.isArray(effectiveArguments)) throw new Error("effective Chrome arguments unavailable");
for (const argument of launchArguments.filter((value) => value.startsWith("--"))) {
  if (!effectiveArguments.includes(argument)) {
    throw new Error(`effective Chrome argument missing: ${argument}`);
  }
}

const sourcePathFor = (urlValue: string): string | null => {
  const path = new URL(urlValue).pathname;
  if (path === DEMO_ROUTE) return "public/demos/serialization.json-telemetry.v1/index.html";
  if (path === "/styles.css") return "public/styles.css";
  if (path === "/favicon.ico" || path === "/favicon.svg") return "public/favicon.svg";
  if (path === "/telemetry-demo.js") return "public/telemetry-demo.js";
  if (path === "/telemetry-worker.js") return "public/telemetry-worker.js";
  if (path === "/telemetry-module-loader.js") return "public/telemetry-module-loader.js";
  if (
    /^\/benchmarks\/v1\/serialization-json-telemetry\/workload(?:\.[a-f0-9]{64})?\.js$/.test(path)
  ) {
    return "benchmarks/v1/serialization-json-telemetry/workload.js";
  }
  if (path.startsWith("/artifacts/serialization-json-telemetry/")) return `public${path}`;
  return null;
};

const workerAuditSource = `(() => {
  const records = [];
  const NativeBlob = globalThis.Blob;
  globalThis.Blob = class CollectorBlob extends NativeBlob {
    constructor(parts, options) {
      super(parts, options);
      const bytes = [];
      for (const part of parts) {
        if (part instanceof Uint8Array) bytes.push(...part);
        else if (part instanceof ArrayBuffer) bytes.push(...new Uint8Array(part));
        else if (typeof part === "string") bytes.push(...new TextEncoder().encode(part));
        else throw new Error("collector cannot bind unknown Blob part type");
      }
      this.__collectorRawBytes = new Uint8Array(bytes);
    }
  };
  const nativeObjectUrl = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => {
    const objectUrl = nativeObjectUrl(blob);
    const raw = blob.__collectorRawBytes;
    let binary = "";
    for (let i = 0; i < raw.length; i += 32768) binary += String.fromCharCode(...raw.subarray(i, i + 32768));
    records.push({ objectUrl, mimeType: blob.type, bytes: raw.length, base64: btoa(binary) });
    return objectUrl;
  };
  const nativePost = globalThis.postMessage.bind(globalThis);
  globalThis.postMessage = (data, transfer) => {
    if (data?.type === "complete") data.__collectorBlobAudit = records;
    return transfer === undefined ? nativePost(data) : nativePost(data, transfer);
  };
})();`;

interface ScenarioDefinition {
  id: string;
  action: "complete" | "wrong-token" | "stale-error-restart" | "cancel" | "timeout" | "pagehide";
  variant: "js-controlled" | "wasm-linear-controlled";
  mode: "bounded" | "exact-contract";
  records: 1000 | 100000 | 1000000;
}
const definitions: ScenarioDefinition[] = [
  {
    id: "js-bounded",
    action: "complete",
    variant: "js-controlled",
    mode: "bounded",
    records: 1000,
  },
  {
    id: "js-exact",
    action: "complete",
    variant: "js-controlled",
    mode: "exact-contract",
    records: 1000,
  },
  {
    id: "wasm-bounded",
    action: "complete",
    variant: "wasm-linear-controlled",
    mode: "bounded",
    records: 1000,
  },
  {
    id: "wasm-exact",
    action: "complete",
    variant: "wasm-linear-controlled",
    mode: "exact-contract",
    records: 1000,
  },
  {
    id: "wrong-token",
    action: "wrong-token",
    variant: "js-controlled",
    mode: "bounded",
    records: 1000000,
  },
  {
    id: "stale-error-restart",
    action: "stale-error-restart",
    variant: "js-controlled",
    mode: "exact-contract",
    records: 1000,
  },
  {
    id: "cancel",
    action: "cancel",
    variant: "wasm-linear-controlled",
    mode: "bounded",
    records: 1000000,
  },
  {
    id: "timeout",
    action: "timeout",
    variant: "wasm-linear-controlled",
    mode: "exact-contract",
    records: 1000000,
  },
  {
    id: "pagehide",
    action: "pagehide",
    variant: "js-controlled",
    mode: "bounded",
    records: 1000000,
  },
];

function pageAuditSource(shortTimeout: boolean): string {
  return `(() => {
    globalThis.__collector = { statuses: [], workerMessages: [], workers: [] };
    const NativeWorker = globalThis.Worker;
    globalThis.Worker = class CollectorWorker extends NativeWorker {
      constructor(...args) {
        super(...args);
        globalThis.__collector.workers.push(this);
        this.addEventListener("message", (event) => globalThis.__collector.workerMessages.push(event.data));
      }
    };
    ${
    shortTimeout
      ? `const nativeSetTimeout = globalThis.setTimeout; globalThis.setTimeout = (fn, delay, ...args) => nativeSetTimeout(fn, delay === 180000 ? 25 : delay, ...args);`
      : ""
  }
    addEventListener("DOMContentLoaded", () => {
      const status = document.querySelector("#status");
      const record = () => {
        const value = status?.textContent?.trim();
        if (value && globalThis.__collector.statuses.at(-1) !== value) globalThis.__collector.statuses.push(value);
      };
      record();
      new MutationObserver(record).observe(status, { childList: true, characterData: true, subtree: true });
    });
  })();`;
}
async function evaluate(sessionId: string, expression: string): Promise<unknown> {
  const response = await client.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
    10_000,
  );
  const details = response.exceptionDetails as Record<string, unknown> | undefined;
  if (details) throw new Error(`browser evaluation failed: ${details.text}`);
  return (response.result as { value?: unknown }).value;
}
async function click(sessionId: string, selector: string): Promise<void> {
  const point = await evaluate(
    sessionId,
    `(() => { const node=document.querySelector(${
      JSON.stringify(selector)
    }); const r=node.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:node.disabled}; })()`,
  ) as { x: number; y: number; disabled: boolean };
  if (point.disabled) throw new Error(`${selector} unexpectedly disabled`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  }, sessionId);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  }, sessionId);
}
async function state(sessionId: string) {
  return await evaluate(
    sessionId,
    `(() => ({
    status: document.querySelector("#status").textContent.trim(),
    output: document.querySelector("#output").textContent,
    startDisabled: document.querySelector("#start").disabled,
    cancelDisabled: document.querySelector("#cancel").disabled,
    statuses: [...globalThis.__collector.statuses],
    workerMessages: globalThis.__collector.workerMessages,
    workerCount: globalThis.__collector.workers.length
  }))()`,
  ) as Record<string, unknown>;
}
async function waitState(
  sessionId: string,
  predicate: (value: Record<string, unknown>) => boolean,
  timeoutMs = 190_000,
) {
  const deadline = Date.now() + timeoutMs;
  let current: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    current = await state(sessionId);
    if (predicate(current)) return current;
    await delay(50);
  }
  throw new Error(`scenario browser state timeout: ${JSON.stringify(current)}`);
}
async function configure(sessionId: string, definition: ScenarioDefinition): Promise<void> {
  await evaluate(
    sessionId,
    `(() => {
    const set = (id, value) => { const node=document.querySelector(id); node.value=value; node.dispatchEvent(new Event("change", {bubbles:true})); };
    set("#variant", ${JSON.stringify(definition.variant)});
    set("#mode", ${JSON.stringify(definition.mode)});
    set("#records", ${JSON.stringify(String(definition.records))});
  })()`,
  );
}
function parseResult(text: string) {
  const target = text.match(/^Target: (.+)$/m)?.[1];
  const mode = text.match(/^Mode: (.+)$/m)?.[1];
  const records = Number(text.match(/^Records: ([0-9]+)$/m)?.[1]);
  const inputSha256 = text.match(/^Input SHA-256: ([a-f0-9]{64})$/m)?.[1];
  const outputSha256 = text.match(/^Output SHA-256: ([a-f0-9]{64})$/m)?.[1];
  const counterStart = text.indexOf("Counters: ") + "Counters: ".length;
  const counterEnd = text.indexOf("\nServed-byte checks:", counterStart) >= 0
    ? text.indexOf("\nServed-byte checks:", counterStart)
    : text.indexOf("\n\nCanonical summary:", counterStart);
  const counters = JSON.parse(text.slice(counterStart, counterEnd));
  const servedStart = text.indexOf("Served-byte checks: ");
  let servedByteChecks: Record<string, unknown> = { status: "not-requested" };
  if (servedStart >= 0) {
    const valueStart = servedStart + "Served-byte checks: ".length;
    const valueEnd = text.indexOf("\n\nCanonical summary:", valueStart);
    servedByteChecks = { status: "verified", ...JSON.parse(text.slice(valueStart, valueEnd)) };
  }
  const canonicalSummary = text.slice(text.indexOf("\nCanonical summary:\n") + 20).trim();
  if (!target || !mode || !inputSha256 || !outputSha256 || !canonicalSummary) {
    throw new Error("complete textual result could not be parsed without omission");
  }
  return {
    rawText: text,
    target,
    mode,
    records,
    inputSha256,
    outputSha256,
    counters,
    canonicalSummary,
    servedByteChecks,
  };
}

const scenarios: Array<Record<string, unknown>> = [];
let collectionError: unknown;
const cleanup: Record<"browserProcesses" | "cgroup" | "profile" | "server", CleanupCheck> = {
  browserProcesses: failureCheck("cleanup not attempted"),
  cgroup: failureCheck("cleanup not attempted"),
  profile: failureCheck("cleanup not attempted"),
  server: failureCheck("cleanup not attempted"),
};
async function finalizeCleanup(): Promise<void> {
  await snapshotMembers().catch(() => []);
  const resolvedBrowserIdentities = [...observedBrowserProcesses.values()];
  let cgroupRemaining: number[] = [];
  try {
    const current = await Deno.lstat(cgroupPath);
    if (
      numeric(current.dev, "cleanup cgroup device") !== cgroupDevice ||
      numeric(current.ino, "cleanup cgroup inode") !== cgroupInode
    ) {
      throw new Error("owned cgroup identity changed before cleanup");
    }
    await cgroupKill.write(new TextEncoder().encode("1"));
    cgroupRemaining = await waitCgroupEmpty(cgroupPath, 5_000);
    if (cgroupRemaining.length) throw new Error("owned cgroup retained member PIDs");
    cleanup.cgroup = successCheck();
  } catch (error) {
    cleanup.cgroup = failureCheck(error, cgroupRemaining.map(String));
  }
  try {
    cgroupKill.close();
  } catch { /* cleanup outcome already retained */ }
  try {
    await commandText("/usr/bin/systemctl", ["--user", "stop", unit]).catch(() => "");
    const remaining = [];
    for (const identity of resolvedBrowserIdentities) {
      if (await identityRunning(identity)) remaining.push(String(identity.pid));
    }
    if (remaining.length) throw new Error("identity-bound Chrome PIDs survived cgroup cleanup");
    cleanup.browserProcesses = successCheck();
  } catch (error) {
    cleanup.browserProcesses = failureCheck(
      error,
      resolvedBrowserIdentities.map((value) => String(value.pid)),
    );
  }
  try {
    if (cleanup.cgroup.outcome !== "success" || cleanup.browserProcesses.outcome !== "success") {
      throw new Error("profile retained because process containment cleanup did not succeed");
    }
    await Deno.remove(profilePath, { recursive: true });
    try {
      await Deno.lstat(profilePath);
      throw new Error("owned profile survived removal");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    cleanup.profile = successCheck();
  } catch (error) {
    cleanup.profile = failureCheck(error, [profilePath]);
  }
  try {
    if (await identityRunning(ownedServerLauncher)) {
      Deno.kill(ownedServerLauncher.pid, "SIGTERM");
    }
    await serverStatus;
    if (await identityRunning(ownedServerLauncher)) {
      throw new Error("owned loopback server survived SIGTERM");
    }
    cleanup.server = successCheck();
  } catch (error) {
    cleanup.server = failureCheck(error, [String(ownedServerLauncher.pid)]);
  }
}
try {
  for (const definition of definitions) {
    const created = await client.send("Target.createTarget", { url: "about:blank" });
    const targetId = String(created.targetId);
    const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = String(attached.sessionId);
    const sessions = new Set([sessionId]);
    const consoleEntries: Array<Record<string, unknown>> = [];
    const exceptions: Array<Record<string, unknown>> = [];
    const requests = new Map<string, Record<string, unknown>>();
    const bodyTasks: Promise<void>[] = [];
    const workerSetupTasks: Promise<void>[] = [];
    const removers = [
      client.on("Target.attachedToTarget", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        const info = params.targetInfo as Record<string, unknown>;
        if (info.type !== "worker") return;
        const workerSession = String(params.sessionId);
        sessions.add(workerSession);
        workerSetupTasks.push((async () => {
          await client.send("Network.enable", {}, workerSession);
          await client.send("Runtime.evaluate", { expression: workerAuditSource }, workerSession);
          await client.send("Runtime.runIfWaitingForDebugger", {}, workerSession);
        })());
      }),
      client.on("Runtime.consoleAPICalled", (params, eventSession) => {
        if (!eventSession || !sessions.has(eventSession)) return;
        consoleEntries.push({
          type: String(params.type),
          arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((arg) =>
            String(arg.value ?? arg.description ?? arg.type)
          ),
          timestamp: Number(params.timestamp),
        });
      }),
      client.on("Runtime.exceptionThrown", (params, eventSession) => {
        if (!eventSession || !sessions.has(eventSession)) return;
        const details = params.exceptionDetails as Record<string, unknown>;
        exceptions.push({
          text: String(details.text),
          lineNumber: Number(details.lineNumber),
          columnNumber: Number(details.columnNumber),
        });
      }),
      client.on("Network.requestWillBeSent", (params, eventSession) => {
        if (!eventSession || !sessions.has(eventSession)) return;
        const request = params.request as Record<string, unknown>;
        requests.set(`${eventSession}:${params.requestId}`, {
          url: String(request.url),
          method: String(request.method),
          resourceType: String(params.type),
          status: 0,
          mimeType: "",
          fromDiskCache: false,
          fromServiceWorker: false,
          failed: false,
          responseBody: { status: "unavailable", reason: "response body has not completed" },
        });
      }),
      client.on("Network.responseReceived", (params, eventSession) => {
        if (!eventSession || !sessions.has(eventSession)) return;
        const entry = requests.get(`${eventSession}:${params.requestId}`);
        const response = params.response as Record<string, unknown>;
        if (entry) {
          Object.assign(entry, {
            status: Number(response.status),
            mimeType: String(response.mimeType),
            fromDiskCache: Boolean(response.fromDiskCache),
            fromServiceWorker: Boolean(response.fromServiceWorker),
          });
        }
      }),
      client.on("Network.loadingFailed", (params, eventSession) => {
        if (!eventSession || !sessions.has(eventSession)) return;
        const entry = requests.get(`${eventSession}:${params.requestId}`);
        if (entry) {
          Object.assign(entry, {
            failed: true,
            responseBody: { status: "unavailable", reason: String(params.errorText) },
          });
        }
      }),
      client.on("Network.loadingFinished", (params, eventSession) => {
        if (!eventSession || !sessions.has(eventSession)) return;
        const entry = requests.get(`${eventSession}:${params.requestId}`);
        if (!entry) return;
        bodyTasks.push((async () => {
          const url = String(entry.url);
          if (url.startsWith("blob:")) {
            entry.responseBody = {
              status: "unavailable",
              reason: "Blob module bytes are retained by worker constructor audit",
            };
            return;
          }
          const sourcePath = sourcePathFor(url);
          if (!sourcePath) throw new Error(`unmapped loopback response denied: ${url}`);
          const response = await client.send(
            "Network.getResponseBody",
            { requestId: params.requestId },
            eventSession,
            10_000,
          );
          const bytes = response.base64Encoded
            ? base64ToBytes(String(response.body))
            : new TextEncoder().encode(String(response.body));
          const expected = await Deno.readFile(`${root}/${sourcePath}`);
          if (
            bytes.length !== expected.length || await sha256Hex(bytes) !== await sha256Hex(expected)
          ) {
            throw new Error(`fetched raw response differs from clean HEAD source: ${sourcePath}`);
          }
          entry.responseBody = {
            status: "supported",
            bytes: bytes.length,
            sha256: await sha256Hex(bytes),
            base64: bytesToBase64(bytes),
            sourcePath,
            gitBlob: await commandText("git", ["rev-parse", `HEAD:${sourcePath}`]),
          };
        })());
      }),
    ];
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
      client.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId),
      client.send("Network.setBypassServiceWorker", { bypass: true }, sessionId),
      client.send("Accessibility.enable", {}, sessionId),
      client.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
      }, sessionId),
    ]);
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: pageAuditSource(definition.action === "timeout"),
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
    await client.send("Page.navigate", { url: `${origin}${DEMO_ROUTE}` }, sessionId);
    await loaded;
    await waitState(sessionId, (value) => value.status === "Ready.", 10_000);
    await configure(sessionId, definition);
    await click(sessionId, "#start");
    const checks: string[] = [];
    let final: Record<string, unknown>;
    if (definition.action === "complete") {
      final = await waitState(sessionId, (value) => value.status === "Complete.");
    } else if (definition.action === "wrong-token") {
      await waitState(sessionId, (value) => String(value.status).startsWith("Generating "));
      const before = await state(sessionId);
      await evaluate(
        sessionId,
        `globalThis.__collector.workers.at(-1).dispatchEvent(new MessageEvent("message", {data:{token:"wrong-token",type:"complete",text:"fabricated"}}))`,
      );
      await delay(50);
      const after = await state(sessionId);
      if (before.status !== after.status || before.output !== after.output) {
        throw new Error("wrong-token message mutated visible state");
      }
      checks.push("wrong-token completion was ignored without visible mutation");
      await click(sessionId, "#cancel");
      final = await waitState(
        sessionId,
        (value) => value.status === "Cancelled. No result was retained.",
      );
    } else if (definition.action === "stale-error-restart") {
      await waitState(sessionId, (value) => String(value.status).startsWith("Generating "));
      await evaluate(
        sessionId,
        "globalThis.__collector.staleWorker = globalThis.__collector.workers.at(-1)",
      );
      await click(sessionId, "#cancel");
      await click(sessionId, "#start");
      await evaluate(
        sessionId,
        `globalThis.__collector.staleWorker.dispatchEvent(new ErrorEvent("error", {message:"stale injected error"}))`,
      );
      final = await waitState(sessionId, (value) => value.status === "Complete.");
      checks.push(
        "fresh worker restarted after cancellation",
        "stale prior-worker error was ignored by generation token",
      );
    } else if (definition.action === "cancel") {
      await waitState(sessionId, (value) => String(value.status).startsWith("Generating "));
      await click(sessionId, "#cancel");
      final = await waitState(
        sessionId,
        (value) => value.status === "Cancelled. No result was retained.",
      );
      checks.push(
        "visible Cancel terminated the active worker",
        "cancel retained no textual result",
      );
    } else if (definition.action === "timeout") {
      final = await waitState(
        sessionId,
        (value) => value.status === "Stopped: the 180 second limit expired.",
        10_000,
      );
      checks.push(
        "registered 180-second timer path terminated the worker under collector-shortened clock",
      );
    } else {
      await waitState(sessionId, (value) => String(value.status).startsWith("Generating "));
      await evaluate(
        sessionId,
        `dispatchEvent(new PageTransitionEvent("pagehide", {persisted:false}))`,
      );
      final = await waitState(
        sessionId,
        (value) => value.status === "Stopped because the page was hidden.",
      );
      checks.push("pagehide terminated the active worker and reset controls");
    }
    await Promise.all(workerSetupTasks);
    await delay(100);
    await Promise.all(bodyTasks);
    const badNetwork = [...requests.values()].filter((entry) =>
      entry.failed || entry.status !== 200 || entry.fromServiceWorker ||
      (!String(entry.url).startsWith("blob:") &&
        (entry.responseBody as { status: string }).status !== "supported")
    );
    if (badNetwork.length) {
      throw new Error(`incomplete network evidence: ${JSON.stringify(badNetwork)}`);
    }
    if (exceptions.length) {
      throw new Error(`browser exceptions observed: ${JSON.stringify(exceptions)}`);
    }
    const screenshotResponse = await client.send(
      "Page.captureScreenshot",
      { format: "png", fromSurface: true, captureBeyondViewport: true },
      sessionId,
      10_000,
    );
    const screenshotBytes = base64ToBytes(String(screenshotResponse.data));
    const screenshotFile = `screenshots/${definition.id}.png`;
    await Deno.mkdir(`${resolvedOutputParent}/screenshots`, { recursive: true });
    await Deno.writeFile(`${resolvedOutputParent}/${screenshotFile}`, screenshotBytes);
    const ax = await client.send("Accessibility.getFullAXTree", {}, sessionId);
    const axText = ((ax.nodes as Array<Record<string, unknown>>) ?? []).flatMap((node) => {
      const role = String((node.role as { value?: unknown } | undefined)?.value ?? "");
      const name = String((node.name as { value?: unknown } | undefined)?.value ?? "");
      return role && name ? [{ role, name }] : [];
    });
    const common: Record<string, unknown> = {
      id: definition.id,
      action: definition.action,
      variant: definition.variant,
      mode: definition.mode,
      records: definition.records,
      statusHistory: final.statuses,
      finalStatus: String(final.status),
      console: consoleEntries,
      exceptions,
      network: [...requests.values()],
      accessibility: { statusText: String(final.status), resultText: String(final.output), axText },
      screenshot: {
        file: screenshotFile,
        bytes: screenshotBytes.length,
        sha256: await sha256Hex(screenshotBytes),
      },
    };
    if (definition.action === "complete" || definition.action === "stale-error-restart") {
      const result = parseResult(String(final.output));
      const messages = final.workerMessages as Array<Record<string, unknown>>;
      const completion = [...messages].reverse().find((message) => message.type === "complete");
      const audit = (completion?.__collectorBlobAudit as Array<Record<string, unknown>> | undefined)
        ?.[0];
      if (!audit) throw new Error("completed worker omitted exact Blob module audit");
      const blobBytes = base64ToBytes(String(audit.base64));
      common.result = result;
      common.blobExecution = {
        objectUrl: String(audit.objectUrl),
        mimeType: String(audit.mimeType),
        bytes: blobBytes.length,
        sha256: await sha256Hex(blobBytes),
        base64: String(audit.base64),
        completionImportedModule: true,
      };
      if (definition.action === "stale-error-restart") common.lifecycle = { checks };
    } else common.lifecycle = { checks };
    scenarios.push(common);
    for (const remove of removers) remove();
    await client.send("Target.closeTarget", { targetId });
    await snapshotMembers();
  }
} catch (error) {
  collectionError = error;
} finally {
  client.close();
  await finalizeCleanup();

  if (!collectionError && scenarios.length === definitions.length) {
    const evidence = {
      schemaVersion: 1,
      workload: WORKLOAD,
      evidenceId: `serialization-json-telemetry-browser-${sourceCommit.slice(0, 12)}`,
      collectedAt: new Date().toISOString(),
      source: { commit: sourceCommit, tree: sourceTree, root, cleanStatus: "clean" },
      collector: {
        script: SCRIPT,
        scriptBytes: scriptBytes.length,
        scriptSha256: await sha256Hex(scriptBytes),
        command: [
          Deno.execPath(),
          "run",
          "-A",
          SCRIPT,
          `--chrome=${chromeArgument}`,
          `--output=${outputPath}`,
        ],
        denoVersion: Deno.version.deno,
      },
      browser: {
        product: String(version.product),
        revision: String(version.revision),
        userAgent: String(version.userAgent),
        jsVersion: String(version.jsVersion),
        executable,
        executableBytes,
        executableSha256,
        launchArguments,
        effectiveArguments,
        headless: true,
        protocol: "Chrome DevTools Protocol",
        profile: profilePath,
        cgroup: {
          unit,
          controlGroup,
          path: cgroupPath,
          device: cgroupDevice,
          inode: cgroupInode,
          invocationId: systemd.InvocationID,
          mainPid,
          memberSnapshots,
        },
        processes: [...observedBrowserProcesses.values()].sort((a, b) => a.pid - b.pid),
      },
      server: { origin, mode: "public", launcher: ownedServerLauncher },
      scenarios,
      cleanup,
    };
    await Deno.writeTextFile(outputPath, `${canonicalize(evidence)}\n`);
  }
}
if (collectionError) throw collectionError;
for (const [name, check] of Object.entries(cleanup)) {
  if (check.outcome !== "success") {
    throw new Error(`${name} cleanup failed; failure retained in ${outputPath}`);
  }
}
console.log(`json-telemetry browser evidence: ${scenarios.length} scenarios; exact owned cleanup`);

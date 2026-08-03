import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";
import { assertJsonTelemetryEvidenceRelationships } from "../lib/json-telemetry-evidence-validation.ts";

const SCRIPT = "scripts/collect-v1-json-telemetry-browser-evidence.ts";
const WORKLOAD = "serialization.json-telemetry.v1";
const DEMO_ROUTE = "/demos/serialization.json-telemetry.v1/";
const CFT_PRODUCT = "Chrome/150.0.7871.24";
const CFT_SHA256 = "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
const DENO_VERSION = "2.9.0";
const WORKLOAD_PATH = "benchmarks/v1/serialization-json-telemetry/workload.js";
const WORKLOAD_SHA256 = "54e2ee54b225d8454664dc6a24f5fa178ee0652ccf0e7e01eea93b17f29530f8";
const SOURCE_PATHS = [
  "public/demos/serialization.json-telemetry.v1/index.html",
  "public/styles.css",
  "public/favicon.svg",
  "public/telemetry-demo.js",
  "public/telemetry-worker.js",
  "public/telemetry-module-loader.js",
  WORKLOAD_PATH,
  "public/artifacts/serialization-json-telemetry/build-manifest.json",
  "public/artifacts/serialization-json-telemetry/fixture-manifest.json",
  "public/artifacts/serialization-json-telemetry/input-manifest.json",
  "public/artifacts/serialization-json-telemetry/output-manifest.json",
  "public/artifacts/serialization-json-telemetry/telemetry.wasm",
  "lib/canonical.ts",
  "lib/cdp-client.ts",
  "lib/json-telemetry-evidence-validation.ts",
  SCRIPT,
] as const;

const root = await Deno.realPath(new URL("../", import.meta.url));
const chromeArgument = Deno.args.find((value) => value.startsWith("--chrome="))?.slice(9) ?? "";
const outputArgument = Deno.args.find((value) => value.startsWith("--output="))?.slice(9) ?? "";
if (Deno.args.length !== 2 || !chromeArgument || !outputArgument) {
  throw new Error(
    `usage: deno run -A ${SCRIPT} --chrome=<absolute-path> --output=<absolute-json-path>`,
  );
}
if (Deno.version.deno !== DENO_VERSION) throw new Error(`collector requires Deno ${DENO_VERSION}`);
const requestedExecutable = await Deno.realPath(chromeArgument);
if (!outputArgument.startsWith("/") || !outputArgument.endsWith(".json")) {
  throw new Error("--output must be an absolute JSON path outside the source root");
}
const outputParentArgument = outputArgument.slice(0, outputArgument.lastIndexOf("/")) || "/";
const outputName = outputArgument.slice(outputArgument.lastIndexOf("/") + 1);
if (!outputName || outputName === "." || outputName === "..") {
  throw new Error("--output must name a JSON file");
}
await Deno.mkdir(outputParentArgument, { recursive: true });
const resolvedOutputParent = await Deno.realPath(outputParentArgument);
if (resolvedOutputParent === root || resolvedOutputParent.startsWith(`${root}/`)) {
  throw new Error("browser evidence must be written outside the clean source root");
}
const outputPath = `${resolvedOutputParent}/${outputName}`;
async function rejectSymlink(path: string, label: string): Promise<void> {
  try {
    const info = await Deno.lstat(path);
    if (info.isSymlink) throw new Error(`${label} must not be a symlink`);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}
await rejectSymlink(outputPath, "output path");
await rejectSymlink(`${resolvedOutputParent}/screenshots`, "screenshot directory");

async function commandBytes(command: string, args: string[]): Promise<Uint8Array> {
  const result = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr).trim());
  return result.stdout;
}
async function commandText(command: string, args: string[]): Promise<string> {
  return new TextDecoder().decode(await commandBytes(command, args)).trim();
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
function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
async function atomicWrite(path: string, bytes: Uint8Array): Promise<void> {
  await rejectSymlink(path, "atomic output target");
  const parent = path.slice(0, path.lastIndexOf("/")) || "/";
  const temporary = `${parent}/.json-telemetry-${crypto.randomUUID()}.tmp`;
  const file = await Deno.open(temporary, { createNew: true, write: true, mode: 0o600 });
  try {
    let offset = 0;
    while (offset < bytes.length) offset += await file.write(bytes.subarray(offset));
    await file.sync();
  } finally {
    file.close();
  }
  try {
    await rejectSymlink(path, "atomic output target");
    await Deno.rename(temporary, path);
  } catch (error) {
    await Deno.remove(temporary).catch(() => {});
    throw error;
  }
}
async function atomicWriteText(path: string, value: string): Promise<void> {
  await atomicWrite(path, new TextEncoder().encode(value));
}

const clean = await commandText("git", ["status", "--porcelain=v1", "--untracked-files=all"]);
if (clean !== "") throw new Error("collector requires an exact clean HEAD before any launch");
const sourceCommit = await commandText("git", ["rev-parse", "HEAD"]);
const sourceTree = await commandText("git", ["rev-parse", "HEAD^{tree}"]);
if (!/^[a-f0-9]{40}$/.test(sourceCommit) || !/^[a-f0-9]{40}$/.test(sourceTree)) {
  throw new Error("clean HEAD identity unavailable");
}
interface FrozenSource {
  path: string;
  bytes: Uint8Array;
  sha256: string;
  gitBlob: string;
}
const frozenSources = new Map<string, FrozenSource>();
for (const path of SOURCE_PATHS) {
  const bytes = await commandBytes("git", ["show", `${sourceCommit}:${path}`]);
  frozenSources.set(path, {
    path,
    bytes,
    sha256: await sha256Hex(bytes),
    gitBlob: await commandText("git", ["rev-parse", `${sourceCommit}:${path}`]),
  });
}
const scriptSource = frozenSources.get(SCRIPT)!;
if (!equalBytes(scriptSource.bytes, await Deno.readFile(`${root}/${SCRIPT}`))) {
  throw new Error("collector bytes differ from frozen clean HEAD");
}
const requestedExecutableInfo = await Deno.lstat(requestedExecutable);
if (!requestedExecutableInfo.isFile || requestedExecutableInfo.isSymlink) {
  throw new Error("Chrome must be a regular file");
}
const requestedExecutableFile = await Deno.open(requestedExecutable, { read: true });
let requestedExecutableBytes: Uint8Array;
let requestedExecutableIdentity: { device: number; inode: number };
try {
  const before = await requestedExecutableFile.stat();
  requestedExecutableBytes = new Uint8Array(numeric(before.size, "Chrome executable size"));
  let offset = 0;
  while (offset < requestedExecutableBytes.length) {
    const count = await requestedExecutableFile.read(requestedExecutableBytes.subarray(offset));
    if (count === null) break;
    offset += count;
  }
  const after = await requestedExecutableFile.stat();
  if (
    offset !== requestedExecutableBytes.length || before.dev !== after.dev ||
    before.ino !== after.ino || before.size !== after.size ||
    before.mtime?.getTime() !== after.mtime?.getTime()
  ) throw new Error("Chrome executable changed while it was read");
  requestedExecutableIdentity = {
    device: numeric(after.dev, "Chrome executable device"),
    inode: numeric(after.ino, "Chrome executable inode"),
  };
} finally {
  requestedExecutableFile.close();
}
const executableSha256 = await sha256Hex(requestedExecutableBytes);
if (executableSha256 !== CFT_SHA256) {
  throw new Error("Chrome for Testing executable SHA-256 mismatch");
}
const executableBytes = requestedExecutableBytes.length;

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
  ) return WORKLOAD_PATH;
  if (path.startsWith("/artifacts/serialization-json-telemetry/")) return `public${path}`;
  return null;
};

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
const inputManifest = JSON.parse(new TextDecoder().decode(
  frozenSources.get("public/artifacts/serialization-json-telemetry/input-manifest.json")!.bytes,
));
const outputManifest = JSON.parse(new TextDecoder().decode(
  frozenSources.get("public/artifacts/serialization-json-telemetry/output-manifest.json")!.bytes,
));
const buildManifest = JSON.parse(new TextDecoder().decode(
  frozenSources.get("public/artifacts/serialization-json-telemetry/build-manifest.json")!.bytes,
));
const exactServedChecks = {
  executedModuleRoute: `/benchmarks/v1/serialization-json-telemetry/workload.${WORKLOAD_SHA256}.js`,
  executedModuleSha256: WORKLOAD_SHA256,
  buildManifestSha256:
    frozenSources.get("public/artifacts/serialization-json-telemetry/build-manifest.json")!.sha256,
  fixtureManifestSha256:
    frozenSources.get("public/artifacts/serialization-json-telemetry/fixture-manifest.json")!
      .sha256,
  inputManifestSha256:
    frozenSources.get("public/artifacts/serialization-json-telemetry/input-manifest.json")!.sha256,
  outputManifestSha256:
    frozenSources.get("public/artifacts/serialization-json-telemetry/output-manifest.json")!.sha256,
  wasmSha256:
    frozenSources.get("public/artifacts/serialization-json-telemetry/telemetry.wasm")!.sha256,
};
if (exactServedChecks.wasmSha256 !== buildManifest.artifact.sha256) {
  throw new Error("frozen build oracle mismatch");
}

const workerAuditSource = `(() => {
  const records = [];
  globalThis.__collectorBlobAudits = records;
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
function pageAuditSource(action: ScenarioDefinition["action"]): string {
  return `(() => {
    const action = ${JSON.stringify(action)};
    globalThis.__collector = { statuses: [], workerMessages: [], workers: [], workerRecords: [], nextWorkerId: 1 };
    const NativeWorker = globalThis.Worker;
    globalThis.Worker = class CollectorWorker extends NativeWorker {
      constructor(...args) {
        super(...args);
        const id = globalThis.__collector.nextWorkerId++;
        const record = { id, createdAt: performance.now(), terminateCalls: [], postedTokens: [], deliveredTokens: [], receivedTokens: [] };
        globalThis.__collector.workers.push(this);
        globalThis.__collector.workerRecords.push(record);
        const nativePostMessage = this.postMessage.bind(this);
        this.postMessage = (data, transfer) => {
          record.postedTokens.push({ token: data?.token, at: performance.now() });
          const held = ["wrong-token", "cancel", "timeout", "pagehide"].includes(action) ||
            (action === "stale-error-restart" && id === 1);
          if (held) return;
          record.deliveredTokens.push({ token: data?.token, at: performance.now() });
          return transfer === undefined ? nativePostMessage(data) : nativePostMessage(data, transfer);
        };
        const nativeTerminate = this.terminate.bind(this);
        this.terminate = () => { record.terminateCalls.push(performance.now()); return nativeTerminate(); };
        this.addEventListener("message", (event) => {
          record.receivedTokens.push({ token: event.data?.token, at: performance.now() });
          globalThis.__collector.workerMessages.push({ workerId: id, data: event.data });
        });
      }
    };
    ${
    action === "timeout"
      ? `const nativeSetTimeout = globalThis.setTimeout; globalThis.setTimeout = (fn, delay, ...args) => nativeSetTimeout(fn, delay === 180000 ? 5000 : delay, ...args);`
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
function parseResult(text: string) {
  const target = text.match(/^Target: (.+)$/m)?.[1];
  const mode = text.match(/^Mode: (.+)$/m)?.[1];
  const records = Number(text.match(/^Records: ([0-9]+)$/m)?.[1]);
  const inputSha256 = text.match(/^Input SHA-256: ([a-f0-9]{64})$/m)?.[1];
  const outputSha256 = text.match(/^Output SHA-256: ([a-f0-9]{64})$/m)?.[1];
  const counterStart = text.indexOf("Counters: ") + "Counters: ".length;
  const servedIndex = text.indexOf("\nServed-byte checks:", counterStart);
  const counterEnd = servedIndex >= 0
    ? servedIndex
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
function assertExactResult(
  definition: ScenarioDefinition,
  result: ReturnType<typeof parseResult>,
): void {
  const inputTier = inputManifest.tiers.find((tier: { records: number }) =>
    tier.records === definition.records
  );
  const outputTier = outputManifest.tiers.find((tier: { records: number }) =>
    tier.records === definition.records
  );
  const expectedCounters = outputTier?.variants?.[definition.variant]?.counters;
  if (
    result.target !== definition.variant || result.mode !== definition.mode ||
    result.records !== definition.records ||
    result.inputSha256 !== inputTier?.sha256 || result.outputSha256 !== outputTier?.sha256 ||
    result.canonicalSummary !== outputTier?.canonicalSummary ||
    canonicalize(result.counters) !== canonicalize(expectedCounters)
  ) throw new Error(`${definition.id} result differs from frozen scenario oracle`);
  const expectedServed = definition.mode === "exact-contract"
    ? { status: "verified", ...exactServedChecks }
    : { status: "not-requested" };
  if (canonicalize(result.servedByteChecks) !== canonicalize(expectedServed)) {
    throw new Error(`${definition.id} served-byte result differs from frozen oracle`);
  }
}

let server: Deno.ChildProcess | undefined;
let serverStatus: Promise<Deno.CommandStatus> | undefined;
let ownedServerLauncher: ProcessIdentity | undefined;
let binaryStagePath: string | undefined;
let stagedExecutable: string | undefined;
let stagedExecutableIdentity: { device: number; inode: number } | undefined;
let stagedExecutableMode: number | undefined;
let runningExecutableIdentity: { device: number; inode: number } | undefined;
let profilePath: string | undefined;
let unit: string | undefined;
let systemd: Record<string, string> | undefined;
let cgroupPath: string | undefined;
let cgroupDevice: number | undefined;
let cgroupInode: number | undefined;
let cgroupKill: Deno.FsFile | undefined;
let mainPid: number | undefined;
let client: CdpClient | undefined;
let version: Record<string, unknown> | undefined;
let effectiveArguments: string[] | undefined;
const memberSnapshots: Array<{ at: string; pids: number[] }> = [];
const observedBrowserProcesses = new Map<number, ProcessIdentity>();
const scenarios: Array<Record<string, unknown>> = [];
let collectionError: unknown;
let sourceEndCheck: Record<string, unknown> = {
  outcome: "failure",
  checkedAt: new Date().toISOString(),
  error: "end recheck not attempted",
};
const cleanup: Record<
  "browserProcesses" | "cgroup" | "profile" | "binaryStage" | "server",
  CleanupCheck
> = {
  browserProcesses: failureCheck("cleanup not attempted"),
  cgroup: failureCheck("cleanup not attempted"),
  profile: failureCheck("cleanup not attempted"),
  binaryStage: failureCheck("cleanup not attempted"),
  server: failureCheck("cleanup not attempted"),
};
const serverPort = unusedPort();
const origin = `http://127.0.0.1:${serverPort}`;
const unitName = `wasm-json-telemetry-${
  crypto.randomUUID().replaceAll("-", "").slice(0, 16)
}.service`;
const launchArgumentsFor = (profile: string) => [
  `--user-data-dir=${profile}`,
  "--remote-debugging-port=0",
  "--remote-debugging-address=127.0.0.1",
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--enable-automation",
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
let launchArguments: string[] | undefined;
async function snapshotMembers(): Promise<number[]> {
  if (!cgroupPath) return [];
  const pids = await readCgroupMembers(cgroupPath);
  memberSnapshots.push({ at: new Date().toISOString(), pids });
  for (const pid of pids) {
    const identity = await processIdentity(pid);
    if (identity) observedBrowserProcesses.set(pid, identity);
  }
  return pids;
}
async function evaluate(sessionId: string, expression: string): Promise<unknown> {
  if (!client) throw new Error("CDP client unavailable");
  const response = await client.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
    10_000,
  );
  const details = response.exceptionDetails as Record<string, unknown> | undefined;
  if (details) throw new Error(`browser evaluation failed: ${details.text}`);
  return (response.result as { value?: unknown }).value;
}
async function click(sessionId: string, selector: string): Promise<void> {
  if (!client) throw new Error("CDP client unavailable");
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
    status: document.querySelector("#status").textContent.trim(), output: document.querySelector("#output").textContent,
    startDisabled: document.querySelector("#start").disabled, cancelDisabled: document.querySelector("#cancel").disabled,
    progressHasValue: document.querySelector("#progress").hasAttribute("value"), statuses: [...globalThis.__collector.statuses],
    workerMessages: globalThis.__collector.workerMessages, workerRecords: globalThis.__collector.workerRecords
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
function networkRosterKey(urlValue: string): string {
  if (urlValue.startsWith("blob:")) return "blob-executed-workload";
  return new URL(urlValue).pathname;
}
function expectedNetworkRoster(definition: ScenarioDefinition): Map<string, number> {
  const expected = new Map<string, number>([
    [DEMO_ROUTE, 1],
    ["/styles.css", 1],
    ["/telemetry-demo.js", 1],
    ["/telemetry-worker.js", definition.action === "stale-error-restart" ? 2 : 1],
    ["/telemetry-module-loader.js", definition.action === "stale-error-restart" ? 2 : 1],
  ]);
  const completes = definition.action === "complete" || definition.action === "stale-error-restart";
  if (!completes) return expected;
  expected.set(
    `/benchmarks/v1/serialization-json-telemetry/workload.${WORKLOAD_SHA256}.js`,
    1,
  );
  expected.set("blob-executed-workload", 1);
  if (definition.variant === "wasm-linear-controlled" || definition.mode === "exact-contract") {
    expected.set("/artifacts/serialization-json-telemetry/telemetry.wasm", 1);
  }
  if (definition.mode === "exact-contract") {
    for (
      const name of [
        "build-manifest.json",
        "fixture-manifest.json",
        "input-manifest.json",
        "output-manifest.json",
      ]
    ) expected.set(`/artifacts/serialization-json-telemetry/${name}`, 1);
  }
  return expected;
}
function assertExactNetworkRoster(
  definition: ScenarioDefinition,
  requests: Map<string, Record<string, unknown>>,
): void {
  const actual = new Map<string, number>();
  for (const request of requests.values()) {
    const key = networkRosterKey(String(request.url));
    actual.set(key, (actual.get(key) ?? 0) + 1);
  }
  if (
    canonicalize([...actual.entries()].sort()) !==
      canonicalize([...expectedNetworkRoster(definition).entries()].sort())
  ) {
    throw new Error(
      `${definition.id} network roster differs from the exact scenario contract: ${
        canonicalize([...actual.entries()].sort())
      }`,
    );
  }
}
async function waitForNetworkPath(
  requests: Map<string, Record<string, unknown>>,
  path: string,
  count = 1,
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (
      [...requests.values()].filter((entry) =>
        networkRosterKey(String(entry.url)) === path &&
        (entry.responseBody as { status?: string }).status === "supported"
      ).length >= count
    ) return;
    await delay(25);
  }
  throw new Error(`required network request was not observed: ${path}`);
}
async function configure(sessionId: string, definition: ScenarioDefinition): Promise<void> {
  await evaluate(
    sessionId,
    `(() => {
    const set = (id, value) => { const node=document.querySelector(id); node.value=value; node.dispatchEvent(new Event("change", {bubbles:true})); };
    set("#variant", ${JSON.stringify(definition.variant)}); set("#mode", ${
      JSON.stringify(definition.mode)
    }); set("#records", ${JSON.stringify(String(definition.records))});
  })()`,
  );
}
function assertFinalControls(definition: ScenarioDefinition, final: Record<string, unknown>): void {
  if (
    final.startDisabled !== false || final.cancelDisabled !== true ||
    final.progressHasValue !== false
  ) {
    throw new Error(`${definition.id} did not reset visible controls`);
  }
  const workers = final.workerRecords as Array<{ id: number; terminateCalls: number[] }>;
  if (!workers.length || workers.some((worker) => worker.terminateCalls.length !== 1)) {
    throw new Error(`${definition.id} did not causally terminate each created worker exactly once`);
  }
}
async function recheckFrozenSource(): Promise<Record<string, unknown>> {
  const endClean = await commandText("git", ["status", "--porcelain=v1", "--untracked-files=all"]);
  const endCommit = await commandText("git", ["rev-parse", "HEAD"]);
  const endTree = await commandText("git", ["rev-parse", "HEAD^{tree}"]);
  for (const frozen of frozenSources.values()) {
    const current = await Deno.readFile(`${root}/${frozen.path}`);
    if (!equalBytes(current, frozen.bytes)) {
      throw new Error(`source bytes changed during collection: ${frozen.path}`);
    }
  }
  if (endClean !== "" || endCommit !== sourceCommit || endTree !== sourceTree) {
    throw new Error("clean HEAD identity changed during collection");
  }
  return {
    outcome: "success",
    checkedAt: new Date().toISOString(),
    commit: endCommit,
    tree: endTree,
    cleanStatus: "clean",
  };
}
async function finalizeCleanup(): Promise<void> {
  await snapshotMembers().catch(() => []);
  const identities = [...observedBrowserProcesses.values()];
  let cgroupRemaining: number[] = [];
  if (!unit) {
    cleanup.cgroup = successCheck();
    cleanup.browserProcesses = successCheck();
  } else {
    try {
      if (!cgroupPath) {
        const discovered = await systemdShow(unit);
        if (/^\/.+/.test(discovered.ControlGroup ?? "")) {
          const candidate = `/sys/fs/cgroup${discovered.ControlGroup}`;
          const info = await Deno.lstat(candidate);
          if (
            !info.isDirectory || info.isSymlink ||
            await Deno.realPath(candidate) !== candidate
          ) throw new Error("unsafe cleanup-discovered Chrome cgroup identity");
          cgroupPath = candidate;
          cgroupDevice = numeric(info.dev, "cleanup-discovered cgroup device");
          cgroupInode = numeric(info.ino, "cleanup-discovered cgroup inode");
        } else if (discovered.ActiveState === "active") {
          throw new Error("active owned Chrome service had no cleanup cgroup identity");
        }
      }
      if (cgroupPath) {
        const current = await Deno.lstat(cgroupPath);
        if (
          numeric(current.dev, "cleanup cgroup device") !== cgroupDevice ||
          numeric(current.ino, "cleanup cgroup inode") !== cgroupInode
        ) {
          throw new Error("owned cgroup identity changed before cleanup");
        }
        if (!cgroupKill) cgroupKill = await Deno.open(`${cgroupPath}/cgroup.kill`, { write: true });
        await cgroupKill.write(new TextEncoder().encode("1"));
        cgroupRemaining = await waitCgroupEmpty(cgroupPath, 5_000);
        if (cgroupRemaining.length) throw new Error("owned cgroup retained member PIDs");
      }
      cleanup.cgroup = successCheck();
    } catch (error) {
      cleanup.cgroup = failureCheck(error, cgroupRemaining.map(String));
    }
    try {
      cgroupKill?.close();
    } catch { /* retained above */ }
    try {
      await commandText("/usr/bin/systemctl", ["--user", "stop", unit]);
      const remaining: string[] = [];
      for (const identity of identities) {
        if (await identityRunning(identity)) remaining.push(String(identity.pid));
      }
      const post = await systemdShow(unit).catch(() => ({ ActiveState: "inactive" }));
      if (post.ActiveState === "active" || remaining.length) {
        throw new Error("identity-bound Chrome processes survived owned service cleanup");
      }
      cleanup.browserProcesses = successCheck();
    } catch (error) {
      cleanup.browserProcesses = failureCheck(error, identities.map((value) => String(value.pid)));
    }
  }
  if (!profilePath) cleanup.profile = successCheck();
  else {
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
  }
  if (!binaryStagePath) cleanup.binaryStage = successCheck();
  else {
    try {
      if (cleanup.cgroup.outcome !== "success" || cleanup.browserProcesses.outcome !== "success") {
        throw new Error("verified browser binary retained because process cleanup did not succeed");
      }
      const stagedCurrent = await Deno.lstat(binaryStagePath);
      if (
        !stagedExecutableIdentity || stagedCurrent.isSymlink || !stagedCurrent.isFile ||
        numeric(stagedCurrent.dev, "cleanup staged Chrome device") !==
          stagedExecutableIdentity.device ||
        numeric(stagedCurrent.ino, "cleanup staged Chrome inode") !== stagedExecutableIdentity.inode
      ) throw new Error("verified browser binary stage identity changed before removal");
      await Deno.remove(binaryStagePath);
      try {
        await Deno.lstat(binaryStagePath);
        throw new Error("verified browser binary stage survived removal");
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      }
      cleanup.binaryStage = successCheck();
    } catch (error) {
      cleanup.binaryStage = failureCheck(error, [binaryStagePath]);
    }
  }
  if (!server || !serverStatus) cleanup.server = successCheck();
  else {
    try {
      if (ownedServerLauncher) {
        if (await identityRunning(ownedServerLauncher)) {
          Deno.kill(ownedServerLauncher.pid, "SIGTERM");
        }
      } else {
        server.kill("SIGTERM");
      }
      await serverStatus;
      if (ownedServerLauncher && await identityRunning(ownedServerLauncher)) {
        throw new Error("owned loopback server survived SIGTERM");
      }
      cleanup.server = successCheck();
    } catch (error) {
      cleanup.server = failureCheck(error, [String(server.pid)]);
    }
  }
}

try {
  server = new Deno.Command(Deno.execPath(), {
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
  serverStatus = server.status;
  const serverIdentity = await processIdentity(server.pid);
  if (!serverIdentity) throw new Error("owned loopback server identity unavailable");
  ownedServerLauncher = serverIdentity;
  await waitFor(`${origin}/healthz`);

  const executableParent = requestedExecutable.slice(0, requestedExecutable.lastIndexOf("/")) ||
    "/";
  stagedExecutable = `${executableParent}/.wasm-json-telemetry-browser-bin-${crypto.randomUUID()}`;
  const stagedFile = await Deno.open(stagedExecutable, {
    createNew: true,
    write: true,
    mode: 0o500,
  });
  binaryStagePath = stagedExecutable;
  const createdStageInfo = await stagedFile.stat();
  stagedExecutableIdentity = {
    device: numeric(createdStageInfo.dev, "created staged Chrome device"),
    inode: numeric(createdStageInfo.ino, "created staged Chrome inode"),
  };
  try {
    let offset = 0;
    while (offset < requestedExecutableBytes.length) {
      offset += await stagedFile.write(requestedExecutableBytes.subarray(offset));
    }
    await stagedFile.sync();
  } finally {
    stagedFile.close();
  }
  await Deno.chmod(stagedExecutable, 0o500);
  const stagedInfo = await Deno.lstat(stagedExecutable);
  stagedExecutableMode = numeric(stagedInfo.mode, "staged Chrome mode") & 0o7777;
  if (
    !stagedInfo.isFile || stagedInfo.isSymlink || stagedInfo.size !== executableBytes ||
    numeric(stagedInfo.dev, "staged Chrome device") !== stagedExecutableIdentity.device ||
    numeric(stagedInfo.ino, "staged Chrome inode") !== stagedExecutableIdentity.inode ||
    stagedExecutableMode !== 0o500 ||
    await sha256Hex(await Deno.readFile(stagedExecutable)) !== executableSha256
  ) throw new Error("immutable staged Chrome does not match verified source bytes");

  profilePath = await Deno.makeTempDir({ prefix: "wasm-json-telemetry-chrome-" });
  launchArguments = launchArgumentsFor(profilePath);
  unit = unitName;
  await commandText("/usr/bin/systemd-run", [
    "--user",
    `--unit=${unit}`,
    "--collect",
    "--quiet",
    "--property=Type=exec",
    "--property=KillMode=control-group",
    "--property=CollectMode=inactive-or-failed",
    "--",
    stagedExecutable,
    ...launchArguments,
  ]);
  systemd = await waitSystemd(unit);
  cgroupPath = `/sys/fs/cgroup${systemd.ControlGroup}`;
  const cgroupInfo = await Deno.lstat(cgroupPath);
  if (
    !cgroupInfo.isDirectory || cgroupInfo.isSymlink ||
    await Deno.realPath(cgroupPath) !== cgroupPath
  ) throw new Error("unsafe owned Chrome cgroup identity");
  cgroupDevice = numeric(cgroupInfo.dev, "cgroup device");
  cgroupInode = numeric(cgroupInfo.ino, "cgroup inode");
  mainPid = Number(systemd.MainPID);
  const mainIdentity = await processIdentity(mainPid);
  const runningInfo = await Deno.stat(`/proc/${mainPid}/exe`);
  runningExecutableIdentity = {
    device: numeric(runningInfo.dev, "running Chrome device"),
    inode: numeric(runningInfo.ino, "running Chrome inode"),
  };
  const runningBytes = await Deno.readFile(`/proc/${mainPid}/exe`);
  if (
    !mainIdentity || mainIdentity.executable !== stagedExecutable ||
    runningExecutableIdentity.device !== stagedExecutableIdentity.device ||
    runningExecutableIdentity.inode !== stagedExecutableIdentity.inode ||
    runningBytes.length !== executableBytes || await sha256Hex(runningBytes) !== executableSha256
  ) {
    throw new Error("systemd MainPID is not the staged, hashed Chrome inode");
  }
  if (!(await snapshotMembers()).includes(mainPid)) {
    throw new Error("Chrome MainPID absent from cgroup");
  }
  cgroupKill = await Deno.open(`${cgroupPath}/cgroup.kill`, { write: true });

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
  client = new CdpClient(webSocketUrl.href);
  await client.ready();
  version = await client.send("Browser.getVersion");
  if (version.product !== CFT_PRODUCT) throw new Error(`unexpected browser ${version.product}`);
  effectiveArguments = (await client.send("Browser.getBrowserCommandLine")).arguments as string[];
  if (
    !Array.isArray(effectiveArguments) ||
    canonicalize(effectiveArguments) !== canonicalize([stagedExecutable, ...launchArguments])
  ) {
    throw new Error("effective Chrome arguments differ from the exact reviewed argv");
  }

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
        if (
          eventSession !== sessionId ||
          (params.targetInfo as Record<string, unknown>).type !== "worker"
        ) return;
        const workerSession = String(params.sessionId);
        sessions.add(workerSession);
        workerSetupTasks.push((async () => {
          await client!.send("Network.enable", {}, workerSession);
          await client!.send("Runtime.evaluate", { expression: workerAuditSource }, workerSession);
          await client!.send("Runtime.runIfWaitingForDebugger", {}, workerSession);
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
          requestServedFromCache: false,
          fromDiskCache: false,
          fromPrefetchCache: false,
          fromServiceWorker: false,
          failed: false,
          responseBody: { status: "unavailable", reason: "response body has not completed" },
        });
      }),
      client.on("Network.requestServedFromCache", (params, eventSession) => {
        if (!eventSession || !sessions.has(eventSession)) return;
        const entry = requests.get(`${eventSession}:${params.requestId}`);
        if (entry) entry.requestServedFromCache = true;
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
            fromPrefetchCache: Boolean(response.fromPrefetchCache),
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
          if (!sourcePath || new URL(url).origin !== origin) {
            throw new Error(`unmapped loopback response denied: ${url}`);
          }
          const response = await client!.send(
            "Network.getResponseBody",
            { requestId: params.requestId },
            eventSession,
            10_000,
          );
          const bytes = response.base64Encoded
            ? base64ToBytes(String(response.body))
            : new TextEncoder().encode(String(response.body));
          const expected = frozenSources.get(sourcePath);
          if (!expected || !equalBytes(bytes, expected.bytes)) {
            throw new Error(
              `fetched raw response differs from frozen clean HEAD source: ${sourcePath}`,
            );
          }
          entry.responseBody = {
            status: "supported",
            bytes: bytes.length,
            sha256: expected.sha256,
            base64: bytesToBase64(bytes),
            sourcePath,
            gitBlob: expected.gitBlob,
          };
        })());
      }),
    ];
    try {
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
        source: pageAuditSource(definition.action),
      }, sessionId);
      const loaded = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("page load timeout")), 10_000);
        const remove = client!.on("Page.loadEventFired", (_params, eventSession) => {
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
      const causalChecks: string[] = [];
      const injections: Array<Record<string, unknown>> = [];
      let final: Record<string, unknown>;
      if (definition.action !== "complete" && definition.action !== "timeout") {
        await waitForNetworkPath(
          requests,
          "/telemetry-module-loader.js",
          definition.action === "stale-error-restart" ? 1 : 1,
        );
      }
      if (definition.action === "complete") {
        final = await waitState(sessionId, (value) => value.status === "Complete.");
        causalChecks.push("completion cleanup terminated the active worker");
      } else if (definition.action === "wrong-token") {
        await waitState(sessionId, (value) => String(value.status).startsWith("Generating "));
        const before = await state(sessionId);
        const injectedAt = await evaluate(
          sessionId,
          `(() => { const at=performance.now(); globalThis.__collector.workers.at(-1).dispatchEvent(new MessageEvent("message", {data:{token:"wrong-token",type:"complete",text:"fabricated"}})); return at; })()`,
        );
        injections.push({
          kind: "wrong-token-message",
          workerId: 1,
          token: "wrong-token",
          at: Number(injectedAt),
        });
        await delay(50);
        const after = await state(sessionId);
        if (before.status !== after.status || before.output !== after.output) {
          throw new Error("wrong-token message mutated visible state");
        }
        causalChecks.push("wrong-token message left status and output unchanged");
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
        const cancelled = await waitState(
          sessionId,
          (value) => value.status === "Cancelled. No result was retained.",
        );
        const firstRecord = (cancelled.workerRecords as Array<{ terminateCalls: number[] }>)[0];
        if (firstRecord?.terminateCalls.length !== 1) {
          throw new Error("cancel did not terminate the stale worker");
        }
        await click(sessionId, "#start");
        const beforeStale = await waitState(
          sessionId,
          (value) => String(value.status).startsWith("Generating "),
        );
        const injectedAt = await evaluate(
          sessionId,
          `(() => { const at=performance.now(); globalThis.__collector.staleWorker.dispatchEvent(new ErrorEvent("error", {message:"stale injected error"})); return at; })()`,
        );
        const currentRecords = beforeStale.workerRecords as Array<{
          id: number;
          postedTokens: Array<{ token: number }>;
        }>;
        injections.push({
          kind: "stale-worker-error",
          workerId: 1,
          staleToken: currentRecords[0].postedTokens[0].token,
          activeWorkerId: 2,
          activeToken: currentRecords[1].postedTokens[0].token,
          at: Number(injectedAt),
        });
        await delay(50);
        const afterStale = await state(sessionId);
        if (beforeStale.status !== afterStale.status || beforeStale.output !== afterStale.output) {
          throw new Error("stale prior-worker error mutated the fresh generation");
        }
        causalChecks.push(
          "prior worker terminated before restart",
          "stale prior-worker error left fresh status and output unchanged",
        );
        final = await waitState(sessionId, (value) => value.status === "Complete.");
      } else if (definition.action === "cancel") {
        await waitState(sessionId, (value) => String(value.status).startsWith("Generating "));
        await click(sessionId, "#cancel");
        final = await waitState(
          sessionId,
          (value) => value.status === "Cancelled. No result was retained.",
        );
        causalChecks.push("cancel cleanup terminated the active worker and retained no output");
      } else if (definition.action === "timeout") {
        final = await waitState(
          sessionId,
          (value) => value.status === "Stopped: the 180 second limit expired.",
          10_000,
        );
        causalChecks.push("registered timeout callback terminated the active worker");
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
        causalChecks.push("pagehide cleanup terminated the active worker");
      }
      assertFinalControls(definition, final);
      if (
        definition.action !== "complete" && definition.action !== "stale-error-restart" &&
        final.output !== ""
      ) throw new Error(`${definition.id} unexpectedly retained output`);
      await Promise.all(workerSetupTasks);
      await delay(100);
      await Promise.all(bodyTasks);
      const badNetwork = [...requests.values()].filter((entry) => {
        const url = String(entry.url);
        const allowedUrl = url.startsWith(`blob:${origin}/`) ||
          (url.startsWith(`${origin}/`) && sourcePathFor(url) !== null);
        return !allowedUrl || entry.method !== "GET" || entry.failed || entry.status !== 200 ||
          entry.requestServedFromCache || entry.fromDiskCache || entry.fromPrefetchCache ||
          entry.fromServiceWorker ||
          (!url.startsWith("blob:") &&
            (entry.responseBody as { status: string }).status !== "supported");
      });
      if (badNetwork.length) {
        throw new Error(
          `cache, unexpected network, or incomplete response evidence: ${
            JSON.stringify(badNetwork)
          }`,
        );
      }
      assertExactNetworkRoster(definition, requests);
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
      const screenshotDirectory = `${resolvedOutputParent}/screenshots`;
      await rejectSymlink(screenshotDirectory, "screenshot directory");
      await Deno.mkdir(screenshotDirectory, { recursive: true });
      if (await Deno.realPath(screenshotDirectory) !== screenshotDirectory) {
        throw new Error("screenshot directory identity changed");
      }
      await atomicWrite(`${resolvedOutputParent}/${screenshotFile}`, screenshotBytes);
      const ax = await client.send("Accessibility.getFullAXTree", {}, sessionId);
      const axText = ((ax.nodes as Array<Record<string, unknown>>) ?? []).flatMap((node) => {
        const role = String((node.role as { value?: unknown } | undefined)?.value ?? "");
        const name = String((node.name as { value?: unknown } | undefined)?.value ?? "");
        return role && name ? [{ role, name }] : [];
      });
      const axNames = axText.map(({ name }) => name);
      if (
        !axNames.includes(String(final.status)) ||
        (final.output !== "" && !axNames.includes(String(final.output)))
      ) {
        throw new Error(`${definition.id} AX tree omitted visible status or result output`);
      }
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
        accessibility: {
          statusText: String(final.status),
          resultText: String(final.output),
          axText,
        },
        screenshot: {
          file: screenshotFile,
          bytes: screenshotBytes.length,
          sha256: await sha256Hex(screenshotBytes),
        },
        lifecycle: {
          causalChecks,
          workers: final.workerRecords,
          injections,
          controls: {
            startDisabled: final.startDisabled,
            cancelDisabled: final.cancelDisabled,
            progressHasValue: final.progressHasValue,
          },
        },
      };
      if (definition.action === "complete" || definition.action === "stale-error-restart") {
        const result = parseResult(String(final.output));
        assertExactResult(definition, result);
        const messages = final.workerMessages as Array<
          { workerId: number; data: Record<string, unknown> }
        >;
        const completion = [...messages].reverse().find((message) =>
          message.data.type === "complete"
        )?.data;
        const audit =
          (completion?.__collectorBlobAudit as Array<Record<string, unknown>> | undefined)?.[0];
        if (!audit) throw new Error("completed worker omitted exact Blob module audit");
        const blobBytes = base64ToBytes(String(audit.base64));
        const frozenWorkload = frozenSources.get(WORKLOAD_PATH)!;
        const workloadResponse = [...requests.values()].find((entry) =>
          (entry.responseBody as { sourcePath?: string }).sourcePath === WORKLOAD_PATH
        );
        const responseBody = workloadResponse?.responseBody as
          | { sha256?: string; bytes?: number }
          | undefined;
        if (
          !equalBytes(blobBytes, frozenWorkload.bytes) || String(audit.objectUrl) === "" ||
          responseBody?.sha256 !== WORKLOAD_SHA256 || responseBody.bytes !== blobBytes.length ||
          (result.servedByteChecks as { executedModuleSha256?: string }).executedModuleSha256 !==
            WORKLOAD_SHA256
        ) {
          throw new Error(
            "executed Blob bytes differ from fetched workload and frozen executed-module identity",
          );
        }
        common.result = result;
        common.blobExecution = {
          objectUrl: String(audit.objectUrl),
          mimeType: String(audit.mimeType),
          bytes: blobBytes.length,
          sha256: await sha256Hex(blobBytes),
          base64: String(audit.base64),
          completionImportedModule: true,
        };
      }
      scenarios.push(common);
    } finally {
      for (const remove of removers) remove();
      await client.send("Target.closeTarget", { targetId }).catch(() => ({}));
      await snapshotMembers();
    }
  }
} catch (error) {
  collectionError = error;
} finally {
  client?.close();
  await finalizeCleanup();
  try {
    sourceEndCheck = await recheckFrozenSource();
  } catch (error) {
    sourceEndCheck = {
      outcome: "failure",
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
    if (!collectionError) collectionError = error;
  }
  const cleanupFailures = Object.entries(cleanup).filter(([, check]) =>
    check.outcome !== "success"
  );
  let finalError: unknown = collectionError ??
    (cleanupFailures.length
      ? new Error(cleanupFailures.map(([name]) => `${name} cleanup failed`).join("; "))
      : undefined);
  const evidence: Record<string, unknown> = {
    schemaVersion: 1,
    workload: WORKLOAD,
    evidenceId: `serialization-json-telemetry-browser-${sourceCommit.slice(0, 12)}`,
    collectedAt: new Date().toISOString(),
    collection: finalError
      ? {
        outcome: "failure",
        error: finalError instanceof Error ? finalError.message : String(finalError),
        completedScenarios: scenarios.length,
      }
      : { outcome: "success", completedScenarios: scenarios.length },
    source: {
      commit: sourceCommit,
      tree: sourceTree,
      root,
      cleanStatus: "clean",
      endCheck: sourceEndCheck,
      frozenFiles: [...frozenSources.values()].map(({ path, bytes, sha256, gitBlob }) => ({
        path,
        bytes: bytes.length,
        sha256,
        gitBlob,
      })),
    },
    collector: {
      script: SCRIPT,
      scriptBytes: scriptSource.bytes.length,
      scriptSha256: scriptSource.sha256,
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
    scenarios,
    cleanup,
  };
  if (ownedServerLauncher) {
    evidence.server = { origin, mode: "public", launcher: ownedServerLauncher };
  }
  if (
    version && launchArguments && effectiveArguments && profilePath && systemd && cgroupPath &&
    mainPid && stagedExecutable && stagedExecutableIdentity && runningExecutableIdentity &&
    stagedExecutableMode !== undefined && cgroupDevice !== undefined && cgroupInode !== undefined
  ) {
    evidence.browser = {
      product: String(version.product),
      revision: String(version.revision),
      userAgent: String(version.userAgent),
      jsVersion: String(version.jsVersion),
      executable: stagedExecutable,
      requestedExecutable,
      requestedExecutableIdentity,
      executableBytes,
      executableSha256,
      stagedExecutableIdentity,
      stagedExecutableMode,
      runningExecutableIdentity,
      launchArguments,
      effectiveArguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
      profile: profilePath,
      cgroup: {
        unit,
        controlGroup: systemd.ControlGroup,
        path: cgroupPath,
        device: cgroupDevice,
        inode: cgroupInode,
        invocationId: systemd.InvocationID,
        mainPid,
        memberSnapshots,
      },
      processes: [...observedBrowserProcesses.values()].sort((a, b) => a.pid - b.pid),
    };
  }
  if (!finalError) {
    try {
      await assertJsonTelemetryEvidenceRelationships(evidence);
    } catch (error) {
      collectionError = error;
      finalError = error;
      evidence.collection = {
        outcome: "failure",
        error: error instanceof Error ? error.message : String(error),
        completedScenarios: scenarios.length,
      };
    }
  }
  await atomicWriteText(outputPath, `${canonicalize(evidence)}\n`);
  try {
    await recheckFrozenSource();
  } catch (error) {
    collectionError ??= error;
    evidence.source = {
      ...(evidence.source as Record<string, unknown>),
      endCheck: {
        outcome: "failure",
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
    };
    evidence.collection = {
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
      completedScenarios: scenarios.length,
    };
    await atomicWriteText(outputPath, `${canonicalize(evidence)}\n`);
  }
}
if (collectionError) throw collectionError;
for (const [name, check] of Object.entries(cleanup)) {
  if (check.outcome !== "success") {
    throw new Error(`${name} cleanup failed; failure retained in ${outputPath}`);
  }
}
console.log(`json-telemetry browser evidence: ${scenarios.length} scenarios; exact owned cleanup`);

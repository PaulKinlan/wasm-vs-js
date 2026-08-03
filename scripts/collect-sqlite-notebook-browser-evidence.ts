// deno-lint-ignore-file no-unsafe-finally -- cleanup assertions throw only inside nested try/catch blocks so every cleanup phase still runs and retains its outcome.
import Ajv2020Module from "ajv2020";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

export const EXPECTED_PRODUCT = "Chrome/150.0.7871.24";
export const EXPECTED_EXECUTABLE_SHA256 =
  "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
export const ACCEPTED_PARENT_COMMIT = "3a49f34aa7bd226ade54001fd503c346b4e4883c";
export const COMPLETE_OUTPUT_SHA256 =
  "fae41d80865456365118c98ee8dd74a502fb359ace69878190edca22e4f6572d";
const WORKLOAD = "database.sqlite-notebook.v1";
const ROUTE = "/benchmarks/database-sqlite-notebook-v1/";
const SCRIPT = "scripts/collect-sqlite-notebook-browser-evidence.ts";
const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

export interface CliOptions {
  chrome: string;
  outputDir: string;
}

export function parseOptions(args: string[]): CliOptions {
  const values = new Map<string, string>();
  for (const argument of args) {
    const match = argument.match(/^--(chrome|output-dir)=(.+)$/u);
    if (!match || values.has(match[1])) throw new Error("invalid or duplicate collector argument");
    values.set(match[1], match[2]);
  }
  if (values.size !== 2 || !values.has("chrome") || !values.has("output-dir")) {
    throw new Error(
      `usage: deno run -A ${SCRIPT} --chrome=<CfT-150-path> --output-dir=<absolute-new-directory>`,
    );
  }
  return { chrome: values.get("chrome")!, outputDir: values.get("output-dir")! };
}

export const STATIC_LAUNCH_ARGUMENTS = Object.freeze(
  [
    "--enable-automation",
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
  ] as const,
);

export function assertBrowserContract(
  product: unknown,
  executableSha256: string,
  launchArguments: string[],
  effectiveArguments: unknown,
): void {
  if (product !== EXPECTED_PRODUCT) {
    throw new Error(`unexpected browser product: ${String(product)}`);
  }
  if (executableSha256 !== EXPECTED_EXECUTABLE_SHA256) {
    throw new Error(`Chrome executable hash mismatch: ${executableSha256}`);
  }
  const expectedStatic = [...STATIC_LAUNCH_ARGUMENTS];
  if (
    launchArguments.length !== expectedStatic.length + 3 ||
    !expectedStatic.every((argument, index) => launchArguments[index] === argument) ||
    !/^--remote-debugging-port=[1-9][0-9]*$/u.test(launchArguments.at(-3) ?? "") ||
    !/^--user-data-dir=\/tmp\/wasm-sqlite-notebook-chrome-/u.test(
      launchArguments.at(-2) ?? "",
    ) || launchArguments.at(-1) !== "about:blank"
  ) throw new Error("Chrome launch arguments differ from the reviewed exact argument vector");
  if (!Array.isArray(effectiveArguments)) throw new Error("effective Chrome arguments unavailable");
  for (const argument of launchArguments.filter((value) => value.startsWith("--"))) {
    if (!effectiveArguments.includes(argument)) {
      throw new Error(`effective Chrome argument missing: ${argument}`);
    }
  }
}

export interface NotebookResult {
  rawText: string;
  variant: "javascript-controlled" | "linear-wasm-controlled";
  engine: string;
  queryCount: number;
  resultRowCount: number;
  completeOutputSha256: string;
  counters: Record<string, number>;
  exactChecks: Array<{ id: string; sha256: string }>;
  results: Array<{ id: string; rows: Array<Record<string, unknown>> }>;
}

function expectedCounters(variant: NotebookResult["variant"]): Record<string, number> {
  return {
    imports: 3,
    "imported-rows": 4192,
    queries: 8,
    scans: 14,
    joins: 6,
    groups: 6,
    windows: 2,
    sorts: 8,
    allocations: 11,
    "boundary-crossings": variant === "linear-wasm-controlled" ? 2 : 0,
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function assertCompleteResult(
  actual: NotebookResult,
  expectedResults: NotebookResult["results"],
  runtimeHashes: Map<string, string>,
): void {
  const expectedVariant = actual.variant;
  const expectedRows = expectedResults.reduce((sum, query) => sum + query.rows.length, 0);
  if (
    actual.queryCount !== 8 || actual.resultRowCount !== 744 || expectedResults.length !== 8 ||
    expectedRows !== 744 || actual.completeOutputSha256 !== COMPLETE_OUTPUT_SHA256 ||
    !sameJson(actual.results, expectedResults) ||
    !sameJson(actual.counters, expectedCounters(expectedVariant))
  ) throw new Error(`${expectedVariant} full eight-query result differs from the parent oracle`);
  const checks = new Map(actual.exactChecks.map((entry) => [entry.id, entry.sha256]));
  if (checks.size !== runtimeHashes.size) {
    throw new Error("executed-byte check denominator mismatch");
  }
  for (const [id, sha256] of runtimeHashes) {
    if (checks.get(id) !== sha256) throw new Error(`executed-byte check mismatch: ${id}`);
  }
}

function parseDisplayedResult(text: string): NotebookResult {
  const field = (name: string) => text.match(new RegExp(`^${name}: (.+)$`, "m"))?.[1] ?? "";
  const variant = field("Variant") as NotebookResult["variant"];
  if (!(["javascript-controlled", "linear-wasm-controlled"] as string[]).includes(variant)) {
    throw new Error("displayed target is not a controlled SQLite notebook variant");
  }
  const counterMarker = "Counters: ";
  const checksMarker = "\nExecuted-byte checks: ";
  const countersStart = text.indexOf(counterMarker);
  const checksStart = text.indexOf(checksMarker, countersStart);
  const jsonStart = text.indexOf("\n\n[", checksStart);
  if (countersStart < 0 || checksStart < 0 || jsonStart < 0) {
    throw new Error("complete visible result is not parseable without omission");
  }
  const counters = JSON.parse(text.slice(countersStart + counterMarker.length, checksStart));
  const checksText = text.slice(checksStart + checksMarker.length, jsonStart);
  const exactChecks = checksText.split("; ").map((entry) => {
    const colon = entry.indexOf(":");
    if (colon < 1) throw new Error("malformed executed-byte check");
    return { id: entry.slice(0, colon), sha256: entry.slice(colon + 1) };
  });
  const results = JSON.parse(text.slice(jsonStart + 2));
  return {
    rawText: text,
    variant,
    engine: field("Engine"),
    queryCount: Number(field("Queries")),
    resultRowCount: results.reduce(
      (sum: number, query: { rows: unknown[] }) => sum + query.rows.length,
      0,
    ),
    completeOutputSha256: field("Canonical output SHA-256"),
    counters,
    exactChecks,
    results,
  };
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

function numeric(value: number | bigint | null | undefined, label: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`${label} unavailable`);
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function commandText(root: string, command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(decoder.decode(output.stderr).trim());
  return decoder.decode(output.stdout).trim();
}

async function gitBytes(root: string, revision: string, path: string): Promise<Uint8Array> {
  const output = await new Deno.Command("git", {
    cwd: root,
    args: ["show", `${revision}:${path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(`git source missing: ${revision}:${path}`);
  return output.stdout;
}

async function systemdShow(root: string, unit: string): Promise<Record<string, string>> {
  const text = await commandText(root, "/usr/bin/systemctl", [
    "--user",
    "show",
    unit,
    "--property=MainPID,ControlGroup,ActiveState,LoadState,InvocationID",
  ]);
  return Object.fromEntries(
    text.split("\n").filter(Boolean).map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    }),
  );
}

async function waitSystemd(root: string, unit: string): Promise<Record<string, string>> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const state = await systemdShow(root, unit);
    if (
      state.ActiveState === "active" && Number(state.MainPID) > 1 &&
      /^\/.+/u.test(state.ControlGroup ?? "") && /^[a-f0-9]{32}$/u.test(state.InvocationID ?? "")
    ) return state;
    await delay(25);
  }
  throw new Error("owned Chrome systemd service did not become active");
}

async function cgroupMembers(path: string): Promise<number[]> {
  return (await Deno.readTextFile(`${path}/cgroup.procs`)).split(/\s+/u).filter(Boolean).map(Number)
    .filter((pid) => Number.isSafeInteger(pid) && pid > 1).sort((a, b) => a - b);
}

async function waitCgroupEmpty(path: string, timeoutMs: number): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  let remaining: number[] = [];
  while (Date.now() < deadline) {
    remaining = await cgroupMembers(path).catch(() => []);
    if (!remaining.length) return [];
    await delay(25);
  }
  return remaining;
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function headerEntries(value: Record<string, unknown>): Array<{ name: string; value: string }> {
  return Object.entries(value).map(([name, entry]) => ({
    name: name.toLowerCase(),
    value: String(entry),
  })).sort((left, right) => left.name.localeCompare(right.name));
}

interface PageState {
  status: string;
  result: string;
  bodyText: string;
  startDisabled: boolean;
  cancelDisabled: boolean;
  progress: number;
  statuses: string[];
}

async function evaluate(
  client: CdpClient,
  sessionId: string,
  expression: string,
): Promise<unknown> {
  const response = await client.send(
    "Runtime.evaluate",
    {
      expression,
      returnByValue: true,
      awaitPromise: true,
    },
    sessionId,
    10_000,
  );
  if (response.exceptionDetails) {
    throw new Error(`browser evaluation failed: ${JSON.stringify(response.exceptionDetails)}`);
  }
  return (response.result as { value?: unknown }).value;
}

async function pageState(client: CdpClient, sessionId: string): Promise<PageState> {
  return await evaluate(
    client,
    sessionId,
    `(() => ({
    status:document.querySelector("#status").textContent.trim(),
    result:document.querySelector("#result").textContent,
    bodyText:document.body.innerText,
    startDisabled:document.querySelector("#start").disabled,
    cancelDisabled:document.querySelector("#cancel").disabled,
    progress:Number(document.querySelector("#progress").value),
    statuses:[...globalThis.__sqliteEvidence.statuses]
  }))()`,
  ) as PageState;
}

async function waitState(
  client: CdpClient,
  sessionId: string,
  predicate: (state: PageState) => boolean,
  timeoutMs = 130_000,
): Promise<PageState> {
  const deadline = Date.now() + timeoutMs;
  let current = await pageState(client, sessionId);
  while (Date.now() < deadline) {
    if (predicate(current)) return current;
    await delay(50);
    current = await pageState(client, sessionId);
  }
  throw new Error(`browser state timeout: ${JSON.stringify(current)}`);
}

async function click(client: CdpClient, sessionId: string, selector: string): Promise<void> {
  const point = await evaluate(
    client,
    sessionId,
    `(() => {
    const node=document.querySelector(${JSON.stringify(selector)});
    const rect=node.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,disabled:node.disabled};
  })()`,
  ) as { x: number; y: number; disabled: boolean };
  if (point.disabled) throw new Error(`${selector} unexpectedly disabled`);
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

async function selectTarget(client: CdpClient, sessionId: string, target: string): Promise<void> {
  await evaluate(
    client,
    sessionId,
    `(() => {
    const node=document.querySelector("#target");
    node.value=${JSON.stringify(target)};
    node.dispatchEvent(new Event("change", {bubbles:true}));
    document.querySelector("#query").value="all";
    document.querySelector("#exact").checked=true;
  })()`,
  );
}

const PAGE_INSTRUMENTATION = String.raw`(() => {
  const mode = new URL(location.href).searchParams.get("evidence-mode") || "normal";
  const NativeWorker = globalThis.Worker;
  const NativeBlob = globalThis.Blob;
  const nativeCreate = URL.createObjectURL.bind(URL);
  const nativeTimeout = globalThis.setTimeout.bind(globalThis);
  const workers = [];
  const statuses = [];
  const emit = (kind, detail={}) => globalThis.__sqliteEvidenceEvent(JSON.stringify({kind,detail}));
  globalThis.Blob = class EvidenceBlob extends NativeBlob {
    constructor(parts, options) {
      super(parts, options);
      const arrays = parts.map((part) => {
        if (part instanceof Uint8Array) return part;
        if (part instanceof ArrayBuffer) return new Uint8Array(part);
        if (typeof part === "string") return new TextEncoder().encode(part);
        throw new Error("unknown Blob part escaped execution-byte audit");
      });
      const length = arrays.reduce((sum, value) => sum + value.length, 0);
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const value of arrays) { bytes.set(value, offset); offset += value.length; }
      Object.defineProperty(this, "__evidenceBytes", {value:bytes});
    }
  };
  URL.createObjectURL = (blob) => {
    const url = nativeCreate(blob);
    const bytes = blob.__evidenceBytes;
    let binary = "";
    for (let i=0; i<bytes.length; i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768));
    emit("blob-created", {url,mimeType:blob.type,base64:btoa(binary)});
    return url;
  };
  globalThis.Worker = function EvidenceWorker(url, options) {
    const native = new NativeWorker(url, options);
    const index = workers.length;
    const originalPost = native.postMessage.bind(native);
    const originalTerminate = native.terminate.bind(native);
    const record = {native,index,url:String(url),pending:null,terminated:false};
    workers.push(record);
    native.postMessage = (data, transfer) => {
      emit("worker-posted", {index,token:data?.token,target:data?.target});
      if (["wrong-token","stale","cancel","timeout","pagehide"].includes(mode)) {
        record.pending={data,transfer:transfer||[]};
        emit("worker-held", {index,token:data?.token});
      } else originalPost(data, transfer || []);
    };
    native.terminate = () => {
      record.terminated=true;
      emit("worker-terminated", {index});
      originalTerminate();
    };
    emit("worker-created", {index,url:String(url)});
    return native;
  };
  globalThis.Worker.prototype = NativeWorker.prototype;
  if (mode === "timeout") {
    globalThis.setTimeout = (callback, delay, ...args) =>
      nativeTimeout(callback, delay === 120000 ? 25 : delay, ...args);
  }
  Object.defineProperty(globalThis, "__sqliteEvidence", {value:{mode,workers,statuses}});
  Object.defineProperty(globalThis, "__sqliteEvidenceControl", {value:Object.freeze({
    count: () => workers.length,
    release: (index) => {
      const pending=workers[index].pending;
      if (!pending) throw new Error("worker has no held message");
      workers[index].pending=null;
      workers[index].native.postMessage(pending.data,pending.transfer);
      emit("worker-released", {index});
    },
    message: (index,data) => {
      workers[index].native.dispatchEvent(new MessageEvent("message",{data}));
      emit("synthetic-message", {index,data});
    },
    error: (index,message) => {
      workers[index].native.dispatchEvent(new ErrorEvent("error",{message}));
      emit("synthetic-error", {index,message});
    }
  })});
  addEventListener("DOMContentLoaded", () => {
    const status=document.querySelector("#status");
    const record=() => {
      const value=status?.textContent?.trim();
      if (value && statuses.at(-1)!==value) statuses.push(value);
    };
    record();
    new MutationObserver(record).observe(status,{childList:true,characterData:true,subtree:true});
  });
  emit("instrumentation-ready", {mode});
})();`;

const WORKER_INSTRUMENTATION = String.raw`(() => {
  const NativeBlob = globalThis.Blob;
  const nativeCreate = URL.createObjectURL.bind(URL);
  const nativeImportScripts = globalThis.importScripts.bind(globalThis);
  const nativeInstantiate = WebAssembly.instantiate.bind(WebAssembly);
  const emit = (kind,detail={}) => globalThis.__sqliteExecutionAudit(JSON.stringify({kind,detail}));
  const encode = (bytes) => {
    let binary="";
    for (let i=0;i<bytes.length;i+=32768) binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return btoa(binary);
  };
  globalThis.Blob = class EvidenceBlob extends NativeBlob {
    constructor(parts, options) {
      super(parts,options);
      const arrays=parts.map((part) => {
        if (part instanceof Uint8Array) return part;
        if (part instanceof ArrayBuffer) return new Uint8Array(part);
        if (typeof part === "string") return new TextEncoder().encode(part);
        throw new Error("unknown worker Blob part escaped execution-byte audit");
      });
      const length=arrays.reduce((sum,value)=>sum+value.length,0);
      const bytes=new Uint8Array(length);
      let offset=0;
      for (const value of arrays) { bytes.set(value,offset); offset+=value.length; }
      Object.defineProperty(this,"__evidenceBytes",{value:bytes});
    }
  };
  URL.createObjectURL=(blob) => {
    const url=nativeCreate(blob);
    emit("blob-created",{url,mimeType:blob.type,base64:encode(blob.__evidenceBytes)});
    return url;
  };
  globalThis.importScripts=(...urls) => {
    emit("import-scripts",{urls:urls.map(String)});
    return nativeImportScripts(...urls);
  };
  WebAssembly.instantiate=async (source, imports) => {
    if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
      const bytes=source instanceof ArrayBuffer ? new Uint8Array(source) :
        new Uint8Array(source.buffer,source.byteOffset,source.byteLength);
      emit("wasm-instantiated",{base64:encode(bytes)});
    } else emit("wasm-module-instantiated",{});
    return await nativeInstantiate(source,imports);
  };
  emit("worker-instrumentation-ready",{});
})();`;

async function runCollector(options: CliOptions): Promise<void> {
  if (Deno.build.os !== "linux") throw new Error("owned cgroup cleanup requires Linux");
  const root = await Deno.realPath(new URL("../", import.meta.url));
  if (Deno.cwd() !== root) throw new Error("collector must run from its exact source root");
  if (!options.outputDir.startsWith("/")) throw new Error("output directory must be absolute");
  const outputParent = await Deno.realPath(
    options.outputDir.slice(0, options.outputDir.lastIndexOf("/")) || "/",
  );
  if (outputParent === root || outputParent.startsWith(`${root}/`)) {
    throw new Error("browser evidence output must be outside the source root");
  }
  try {
    await Deno.lstat(options.outputDir);
    throw new Error("browser evidence output directory already exists");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }

  const initialStatus = await commandText(root, "git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (initialStatus !== "") throw new Error("collector requires an exact clean HEAD");
  const head = await commandText(root, "git", ["rev-parse", "HEAD"]);
  const tree = await commandText(root, "git", ["rev-parse", "HEAD^{tree}"]);
  if (!/^[a-f0-9]{40}$/u.test(head) || !/^[a-f0-9]{40}$/u.test(tree)) {
    throw new Error("clean source identities unavailable");
  }
  const acceptedParent = await commandText(root, "git", [
    "merge-base",
    "--is-ancestor",
    ACCEPTED_PARENT_COMMIT,
    head,
  ]).then(() => true).catch(() => false);
  if (!acceptedParent) {
    throw new Error("collector source does not descend from accepted SQLite notebook");
  }

  const runtimeManifestPath = "public/artifacts/sqlite-notebook/runtime-manifest.json";
  const runtimeManifestBytes = await Deno.readFile(`${root}/${runtimeManifestPath}`);
  const runtimeManifest = JSON.parse(decoder.decode(runtimeManifestBytes));
  if (runtimeManifest.files.length !== 14) throw new Error("runtime manifest denominator changed");
  const runtimeHashes = new Map<string, string>([
    ["runtime-manifest", await sha256Hex(runtimeManifestBytes)],
    ...runtimeManifest.files.map((
      entry: { id: string; sha256: string },
    ) => [entry.id, entry.sha256]),
  ]);
  const reference = JSON.parse(
    await Deno.readTextFile(`${root}/public/artifacts/sqlite-notebook/reference.json`),
  );
  if (
    reference.queryCount !== 8 ||
    Object.values(reference.rowCounts).reduce((sum: number, value) => sum + Number(value), 0) !==
      744 ||
    reference.canonicalOutputSha256 !== COMPLETE_OUTPUT_SHA256
  ) throw new Error("parent oracle is not the accepted eight-query/744-row denominator");

  const sourceFiles: Array<Record<string, unknown>> = [];
  const routeSources = new Map<
    string,
    { path: string; bytes: Uint8Array; sha256: string; gitBlob: string }
  >();
  const addSource = async (route: string, path: string) => {
    const disk = await Deno.readFile(`${root}/${path}`);
    const committed = await gitBytes(root, head, path);
    const hash = await sha256Hex(disk);
    if (disk.length !== committed.length || hash !== await sha256Hex(committed)) {
      throw new Error(`${path} differs from frozen clean-HEAD bytes`);
    }
    const record = {
      route,
      path,
      bytes: disk.length,
      sha256: hash,
      gitBlob: await commandText(root, "git", ["rev-parse", `HEAD:${path}`]),
      headBytesMatch: true,
    };
    sourceFiles.push(record);
    routeSources.set(route, { path, bytes: disk, sha256: hash, gitBlob: record.gitBlob });
  };
  await addSource("/styles.css", "public/styles.css");
  for (const entry of runtimeManifest.files as Array<{ path: string; source: string }>) {
    await addSource(entry.path, entry.source);
  }
  await addSource("/favicon.ico", "public/favicon.svg");
  const collectorBytes = await Deno.readFile(`${root}/${SCRIPT}`);
  if (await sha256Hex(collectorBytes) !== await sha256Hex(await gitBytes(root, head, SCRIPT))) {
    throw new Error("executed collector bytes differ from frozen clean HEAD");
  }

  const executable = await Deno.realPath(options.chrome);
  const executableInfo = await Deno.lstat(executable);
  if (!executableInfo.isFile || executableInfo.isSymlink) {
    throw new Error("CfT executable must be a regular non-symlink file");
  }
  const executableSha256 = await sha256Hex(await Deno.readFile(executable));
  if (executableSha256 !== EXPECTED_EXECUTABLE_SHA256) {
    throw new Error(`Chrome executable hash mismatch: ${executableSha256}`);
  }

  let outputCreated = false;
  let profilePath: string | null = null;
  let profileIdentity: { dev: number; ino: number; mode: number; initiallyEmpty: boolean } | null =
    null;
  let server: Deno.ChildProcess | null = null;
  let serverStatus: Promise<Deno.CommandStatus> | null = null;
  let serverIdentity: ProcessIdentity | null = null;
  let unit: string | null = null;
  let cgroupPath: string | null = null;
  let cgroupIdentity: {
    dev: number;
    ino: number;
    controlGroup: string;
    invocationId: string;
    mainPid: number;
  } | null = null;
  let cgroupKill: Deno.FsFile | null = null;
  let client: CdpClient | null = null;
  let browserContextId: string | null = null;
  let collectionError: unknown = null;
  const cleanup: Record<string, unknown> = {};
  const scenarios: Array<Record<string, unknown>> = [];
  const browserProcesses = new Map<number, ProcessIdentity>();
  const cgroupSnapshots: Array<{ at: string; pids: number[] }> = [];
  let browserVersion: Record<string, unknown> = {};
  let effectiveArguments: string[] = [];
  let launchArguments: string[] = [];
  let debuggerPort = 0;
  let serverPort = 0;
  let origin = "";

  const snapshotCgroup = async () => {
    if (!cgroupPath) return [];
    const pids = await cgroupMembers(cgroupPath);
    cgroupSnapshots.push({ at: new Date().toISOString(), pids });
    for (const pid of pids) {
      const identity = await processIdentity(pid);
      if (!identity) throw new Error(`cgroup PID ${pid} identity unavailable`);
      const prior = browserProcesses.get(pid);
      if (
        prior &&
        (prior.startTimeTicks !== identity.startTimeTicks ||
          prior.executable !== identity.executable)
      ) {
        throw new Error(`owned cgroup PID ${pid} changed identity`);
      }
      browserProcesses.set(pid, identity);
    }
    return pids;
  };

  try {
    await Deno.mkdir(options.outputDir, { recursive: false });
    outputCreated = true;
    await Deno.mkdir(`${options.outputDir}/screenshots`);

    serverPort = unusedPort();
    debuggerPort = unusedPort();
    if (serverPort === debuggerPort) throw new Error("server and debugger ports collided");
    origin = `http://127.0.0.1:${serverPort}`;
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
    serverIdentity = await processIdentity(server.pid);
    if (!serverIdentity) throw new Error("owned loopback server identity unavailable");
    await waitFor(`${origin}/healthz`);

    const trustResponse = await fetch(`${origin}/assets/sqlite-notebook/runtime-trust-root.json`, {
      cache: "no-store",
      redirect: "error",
    });
    const trustBytes = new Uint8Array(await trustResponse.arrayBuffer());
    const trust = JSON.parse(decoder.decode(trustBytes));
    if (
      trustResponse.status !== 200 ||
      trust.runtimeManifestSha256 !== runtimeHashes.get("runtime-manifest") ||
      trust.pageSha256 !== runtimeHashes.get("page") ||
      trust.runnerSha256 !== runtimeHashes.get("runner")
    ) throw new Error("server-held runtime trust root differs from frozen source");
    routeSources.set("/assets/sqlite-notebook/runtime-trust-root.json", {
      path: "server.ts#sqliteNotebookTrustRoot",
      bytes: trustBytes,
      sha256: await sha256Hex(trustBytes),
      gitBlob: await commandText(root, "git", ["rev-parse", "HEAD:server.ts"]),
    });
    sourceFiles.push({
      route: "/assets/sqlite-notebook/runtime-trust-root.json",
      path: "server.ts#sqliteNotebookTrustRoot",
      bytes: trustBytes.length,
      sha256: await sha256Hex(trustBytes),
      gitBlob: await commandText(root, "git", ["rev-parse", "HEAD:server.ts"]),
      headBytesMatch: true,
    });
    for (const [route, source] of routeSources) {
      const response = await fetch(`${origin}${route}`, { cache: "no-store", redirect: "error" });
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (
        response.status !== 200 || bytes.length !== source.bytes.length ||
        await sha256Hex(bytes) !== source.sha256
      ) {
        throw new Error(`loopback preflight raw response mismatch: ${route}`);
      }
    }

    profilePath = await Deno.makeTempDir({ prefix: "wasm-sqlite-notebook-chrome-" });
    const profileInfo = await Deno.lstat(profilePath);
    profileIdentity = {
      dev: numeric(profileInfo.dev, "profile device"),
      ino: numeric(profileInfo.ino, "profile inode"),
      mode: numeric(profileInfo.mode, "profile mode") & 0o777,
      initiallyEmpty: (await Array.fromAsync(Deno.readDir(profilePath))).length === 0,
    };
    if (!profileIdentity.initiallyEmpty || profileIdentity.mode !== 0o700) {
      throw new Error("fresh owned Chrome profile contract failed");
    }
    launchArguments = [
      ...STATIC_LAUNCH_ARGUMENTS,
      `--remote-debugging-port=${debuggerPort}`,
      `--user-data-dir=${profilePath}`,
      "about:blank",
    ];
    unit = `wasm-sqlite-notebook-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}.service`;
    await commandText(root, "/usr/bin/systemd-run", [
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
    const systemd = await waitSystemd(root, unit);
    cgroupPath = `/sys/fs/cgroup${systemd.ControlGroup}`;
    const cgroupInfo = await Deno.lstat(cgroupPath);
    if (
      !cgroupInfo.isDirectory || cgroupInfo.isSymlink ||
      await Deno.realPath(cgroupPath) !== cgroupPath
    ) {
      throw new Error("unsafe owned Chrome cgroup identity");
    }
    cgroupIdentity = {
      dev: numeric(cgroupInfo.dev, "cgroup device"),
      ino: numeric(cgroupInfo.ino, "cgroup inode"),
      controlGroup: systemd.ControlGroup,
      invocationId: systemd.InvocationID,
      mainPid: Number(systemd.MainPID),
    };
    const main = await processIdentity(cgroupIdentity.mainPid);
    if (!main || main.executable !== executable) {
      throw new Error("systemd MainPID is not the reviewed CfT executable");
    }
    if (!(await snapshotCgroup()).includes(cgroupIdentity.mainPid)) {
      throw new Error("CfT MainPID absent from owned cgroup");
    }
    cgroupKill = await Deno.open(`${cgroupPath}/cgroup.kill`, { write: true });

    const discovery = await (await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
    const webSocketUrl = new URL(discovery.webSocketDebuggerUrl);
    if (
      webSocketUrl.protocol !== "ws:" || webSocketUrl.hostname !== "127.0.0.1" ||
      Number(webSocketUrl.port) !== debuggerPort || webSocketUrl.search || webSocketUrl.hash ||
      !/^\/devtools\/browser\/[A-Za-z0-9-]+$/u.test(webSocketUrl.pathname)
    ) throw new Error("CfT CDP endpoint escaped the owned loopback listener");
    client = new CdpClient(webSocketUrl.href);
    await client.ready();
    browserVersion = await client.send("Browser.getVersion");
    effectiveArguments = (await client.send("Browser.getBrowserCommandLine")).arguments as string[];
    assertBrowserContract(
      browserVersion.product,
      executableSha256,
      launchArguments,
      effectiveArguments,
    );
    await client.send("Target.setDiscoverTargets", { discover: true });
    browserContextId = String(
      (await client.send("Target.createBrowserContext", {
        disposeOnDetach: true,
      })).browserContextId,
    );
    if (!browserContextId) throw new Error("owned browser context unavailable");

    const definitions = [
      {
        id: "complete-javascript",
        mode: "normal",
        targets: ["javascript-controlled"],
        resultTarget: "javascript-controlled",
      },
      {
        id: "complete-wasm",
        mode: "normal",
        targets: ["linear-wasm-controlled"],
        resultTarget: "linear-wasm-controlled",
      },
      {
        id: "wrong-token",
        mode: "wrong-token",
        targets: ["javascript-controlled"],
        resultTarget: "javascript-controlled",
      },
      {
        id: "stale-after-restart",
        mode: "stale",
        targets: ["javascript-controlled", "linear-wasm-controlled"],
        resultTarget: "linear-wasm-controlled",
      },
      {
        id: "restart",
        mode: "normal",
        targets: ["javascript-controlled", "linear-wasm-controlled"],
        resultTarget: "linear-wasm-controlled",
      },
      { id: "timeout", mode: "timeout", targets: ["linear-wasm-controlled"], resultTarget: null },
      { id: "cancel", mode: "cancel", targets: ["javascript-controlled"], resultTarget: null },
      { id: "pagehide", mode: "pagehide", targets: ["linear-wasm-controlled"], resultTarget: null },
    ] as const;

    for (const definition of definitions) {
      const created = await client.send("Target.createTarget", {
        url: "about:blank",
        browserContextId,
      });
      const pageTargetId = String(created.targetId);
      const attached = await client.send("Target.attachToTarget", {
        targetId: pageTargetId,
        flatten: true,
      });
      const pageSessionId = String(attached.sessionId);
      const ownedSessions = new Map<
        string,
        { targetId: string; type: string; parentSessionId: string | null }
      >([
        [pageSessionId, { targetId: pageTargetId, type: "page", parentSessionId: null }],
      ]);
      const lifecycleEvents: Array<Record<string, unknown>> = [];
      const executionEvents: Array<Record<string, unknown>> = [];
      const consoleEntries: Array<Record<string, unknown>> = [];
      const exceptions: Array<Record<string, unknown>> = [];
      const requests = new Map<string, Record<string, unknown>>();
      const setupTasks: Promise<void>[] = [];
      const bodyTasks: Promise<void>[] = [];
      const asyncErrors: Error[] = [];
      const removers = [
        client.on("Target.attachedToTarget", (params, eventSession) => {
          if (eventSession !== pageSessionId) return;
          const info = params.targetInfo as Record<string, unknown>;
          if (info.type !== "worker") {
            asyncErrors.push(new Error(`unexpected child target type: ${String(info.type)}`));
            return;
          }
          const workerSessionId = String(params.sessionId);
          const workerTargetId = String(info.targetId);
          ownedSessions.set(workerSessionId, {
            targetId: workerTargetId,
            type: "worker",
            parentSessionId: pageSessionId,
          });
          setupTasks.push(
            (async () => {
              await client!.send("Runtime.enable", {}, workerSessionId);
              await client!.send("Network.enable", {}, workerSessionId);
              await client!.send(
                "Network.setCacheDisabled",
                { cacheDisabled: true },
                workerSessionId,
              );
              await client!.send(
                "Network.setBypassServiceWorker",
                { bypass: true },
                workerSessionId,
              );
              await client!.send(
                "Runtime.addBinding",
                { name: "__sqliteExecutionAudit" },
                workerSessionId,
              );
              await client!.send(
                "Runtime.evaluate",
                { expression: WORKER_INSTRUMENTATION },
                workerSessionId,
              );
              await client!.send("Runtime.runIfWaitingForDebugger", {}, workerSessionId);
            })().catch((error) => {
              asyncErrors.push(error instanceof Error ? error : new Error(String(error)));
            }),
          );
        }),
        client.on("Runtime.bindingCalled", (params, eventSession) => {
          const ownership = eventSession ? ownedSessions.get(eventSession) : undefined;
          if (!ownership) return;
          const event = JSON.parse(String(params.payload));
          const retained = { ...event, sessionId: eventSession, targetId: ownership.targetId };
          if (params.name === "__sqliteEvidenceEvent" && eventSession === pageSessionId) {
            lifecycleEvents.push(retained);
          } else if (params.name === "__sqliteExecutionAudit" && ownership.type === "worker") {
            executionEvents.push(retained);
          }
        }),
        client.on("Runtime.consoleAPICalled", (params, eventSession) => {
          const ownership = eventSession ? ownedSessions.get(eventSession) : undefined;
          if (!ownership) return;
          consoleEntries.push({
            sessionId: eventSession,
            targetId: ownership.targetId,
            targetType: ownership.type,
            type: String(params.type),
            arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((argument) =>
              String(argument.value ?? argument.description ?? argument.type)
            ),
          });
        }),
        client.on("Runtime.exceptionThrown", (params, eventSession) => {
          const ownership = eventSession ? ownedSessions.get(eventSession) : undefined;
          if (!ownership) return;
          const details = params.exceptionDetails as Record<string, unknown>;
          exceptions.push({
            sessionId: eventSession,
            targetId: ownership.targetId,
            targetType: ownership.type,
            text: String(details.text),
            lineNumber: Number(details.lineNumber),
            columnNumber: Number(details.columnNumber),
          });
        }),
        client.on("Network.requestWillBeSent", (params, eventSession) => {
          const ownership = eventSession ? ownedSessions.get(eventSession) : undefined;
          if (!ownership) return;
          const request = params.request as Record<string, unknown>;
          requests.set(`${eventSession}:${params.requestId}`, {
            requestId: String(params.requestId),
            sessionId: eventSession,
            targetId: ownership.targetId,
            targetType: ownership.type,
            url: String(request.url),
            method: String(request.method),
            resourceType: String(params.type),
            status: null,
            statusText: null,
            protocol: null,
            mimeType: null,
            headers: [],
            fromDiskCache: false,
            fromServiceWorker: false,
            failed: false,
            errorText: null,
            body: { status: "pending" },
          });
        }),
        client.on("Network.responseReceived", (params, eventSession) => {
          if (!eventSession || !ownedSessions.has(eventSession)) return;
          const record = requests.get(`${eventSession}:${params.requestId}`);
          const response = params.response as Record<string, unknown>;
          if (record) {
            Object.assign(record, {
              status: Number(response.status),
              statusText: String(response.statusText),
              protocol: String(response.protocol),
              mimeType: String(response.mimeType),
              headers: headerEntries(response.headers as Record<string, unknown>),
              fromDiskCache: Boolean(response.fromDiskCache),
              fromServiceWorker: Boolean(response.fromServiceWorker),
            });
          }
        }),
        client.on("Network.loadingFailed", (params, eventSession) => {
          if (!eventSession || !ownedSessions.has(eventSession)) return;
          const record = requests.get(`${eventSession}:${params.requestId}`);
          if (record) {
            Object.assign(record, {
              failed: true,
              errorText: String(params.errorText),
              body: { status: "unavailable", reason: String(params.errorText) },
            });
          }
        }),
        client.on("Network.loadingFinished", (params, eventSession) => {
          if (!eventSession || !ownedSessions.has(eventSession)) return;
          const record = requests.get(`${eventSession}:${params.requestId}`);
          if (!record) return;
          bodyTasks.push(
            (async () => {
              const url = new URL(String(record.url));
              if (url.protocol === "blob:") {
                record.body = {
                  status: "executed-blob-audit",
                  reason: "exact Blob bytes retained by constructor and execution audit",
                };
                return;
              }
              if (url.origin !== origin) {
                throw new Error(`network request escaped owned origin: ${url.href}`);
              }
              const source = routeSources.get(url.pathname);
              if (!source) throw new Error(`unmapped loopback response denied: ${url.pathname}`);
              const response = await client!.send(
                "Network.getResponseBody",
                {
                  requestId: String(params.requestId),
                },
                eventSession,
                10_000,
              );
              const bytes = response.base64Encoded
                ? base64ToBytes(String(response.body))
                : encoder.encode(String(response.body));
              if (
                bytes.length !== source.bytes.length || await sha256Hex(bytes) !== source.sha256
              ) {
                throw new Error(`raw response differs from frozen clean HEAD: ${url.pathname}`);
              }
              record.body = {
                status: "supported",
                bytes: bytes.length,
                sha256: source.sha256,
                sourcePath: source.path,
                gitBlob: source.gitBlob,
              };
            })().catch((error) => {
              asyncErrors.push(error instanceof Error ? error : new Error(String(error)));
            }),
          );
        }),
      ];
      try {
        await Promise.all([
          client.send("Page.enable", {}, pageSessionId),
          client.send("Runtime.enable", {}, pageSessionId),
          client.send("Network.enable", {}, pageSessionId),
          client.send("Network.setCacheDisabled", { cacheDisabled: true }, pageSessionId),
          client.send("Network.setBypassServiceWorker", { bypass: true }, pageSessionId),
          client.send("Accessibility.enable", {}, pageSessionId),
          client.send("Runtime.addBinding", { name: "__sqliteEvidenceEvent" }, pageSessionId),
          client.send(
            "Page.addScriptToEvaluateOnNewDocument",
            { source: PAGE_INSTRUMENTATION },
            pageSessionId,
          ),
          client.send("Target.setAutoAttach", {
            autoAttach: true,
            waitForDebuggerOnStart: true,
            flatten: true,
          }, pageSessionId),
        ]);
        const loaded = new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("page load timeout")), 15_000);
          const remove = client!.on("Page.loadEventFired", (_params, eventSession) => {
            if (eventSession !== pageSessionId) return;
            clearTimeout(timer);
            remove();
            resolve();
          });
        });
        await client.send("Page.navigate", {
          url: `${origin}${ROUTE}?evidence-mode=${definition.mode}`,
        }, pageSessionId);
        await loaded;
        let state = await waitState(
          client,
          pageSessionId,
          (value) => value.status === "Ready.",
          10_000,
        );
        const assertions: string[] = [];
        let parsedResult: NotebookResult | null = null;

        const startRun = async (target: string) => {
          await selectTarget(client!, pageSessionId, target);
          await click(client!, pageSessionId, "#start");
        };
        if (definition.id === "restart") {
          for (const target of definition.targets) {
            await startRun(target);
            state = await waitState(
              client,
              pageSessionId,
              (value) => value.status.startsWith("Complete."),
            );
            const result = parseDisplayedResult(state.result);
            assertCompleteResult(result, reference.results, runtimeHashes);
            parsedResult = result;
          }
          assertions.push("two visible starts completed through two fresh owned workers");
        } else if (definition.id === "stale-after-restart") {
          await startRun(definition.targets[0]);
          await waitState(client, pageSessionId, (value) => value.status.startsWith("Binding "));
          await click(client, pageSessionId, "#cancel");
          await waitState(client, pageSessionId, (value) => value.status.startsWith("Cancelled."));
          await startRun(definition.targets[1]);
          await waitState(client, pageSessionId, (value) => value.status.startsWith("Binding "));
          const before = await pageState(client, pageSessionId);
          await evaluate(
            client,
            pageSessionId,
            `__sqliteEvidenceControl.message(0,${
              JSON.stringify({ type: "result", token: 1, result: { fabricated: true } })
            })`,
          );
          await evaluate(
            client,
            pageSessionId,
            `__sqliteEvidenceControl.error(0,"stale injected error")`,
          );
          const after = await pageState(client, pageSessionId);
          if (before.status !== after.status || before.result !== after.result) {
            throw new Error("stale prior-worker result/error mutated restarted state");
          }
          await evaluate(client, pageSessionId, "__sqliteEvidenceControl.release(1)");
          state = await waitState(
            client,
            pageSessionId,
            (value) => value.status.startsWith("Complete."),
          );
          parsedResult = parseDisplayedResult(state.result);
          assertCompleteResult(parsedResult, reference.results, runtimeHashes);
          assertions.push(
            "stale prior-worker result and error were causally ignored after restart",
          );
        } else {
          await startRun(definition.targets[0]);
          if (definition.id === "wrong-token") {
            await waitState(client, pageSessionId, (value) => value.status.startsWith("Binding "));
            const before = await pageState(client, pageSessionId);
            await evaluate(
              client,
              pageSessionId,
              `__sqliteEvidenceControl.message(0,${
                JSON.stringify({ type: "result", token: 999999, result: { fabricated: true } })
              })`,
            );
            const after = await pageState(client, pageSessionId);
            if (before.status !== after.status || before.result !== after.result) {
              throw new Error("wrong-token completion mutated visible state");
            }
            await evaluate(client, pageSessionId, "__sqliteEvidenceControl.release(0)");
            state = await waitState(
              client,
              pageSessionId,
              (value) => value.status.startsWith("Complete."),
            );
            parsedResult = parseDisplayedResult(state.result);
            assertCompleteResult(parsedResult, reference.results, runtimeHashes);
            assertions.push(
              "wrong-token completion was ignored before the exact held run completed",
            );
          } else if (definition.id === "timeout") {
            state = await waitState(
              client,
              pageSessionId,
              (value) => value.status === "Failed: Stopped after 120 seconds",
              10_000,
            );
            if (state.result !== "Stopped after 120 seconds") {
              throw new Error("timeout retained unexpected output");
            }
            assertions.push("registered 120-second timeout causally terminated the held worker");
          } else if (definition.id === "cancel") {
            await waitState(client, pageSessionId, (value) => value.status.startsWith("Binding "));
            await click(client, pageSessionId, "#cancel");
            state = await waitState(
              client,
              pageSessionId,
              (value) => value.status.startsWith("Cancelled."),
            );
            if (state.result !== "No result retained.") {
              throw new Error("cancel retained unexpected output");
            }
            assertions.push("visible Cancel causally terminated the held worker");
          } else if (definition.id === "pagehide") {
            await waitState(client, pageSessionId, (value) => value.status.startsWith("Binding "));
            await evaluate(
              client,
              pageSessionId,
              "dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))",
            );
            await delay(50);
            state = await pageState(client, pageSessionId);
            if (state.startDisabled || !state.cancelDisabled) {
              throw new Error("pagehide did not reset visible controls");
            }
            assertions.push("pagehide causally terminated the held worker and reset controls");
          } else {
            state = await waitState(
              client,
              pageSessionId,
              (value) => value.status.startsWith("Complete."),
            );
            parsedResult = parseDisplayedResult(state.result);
            assertCompleteResult(parsedResult, reference.results, runtimeHashes);
            assertions.push("visible exact all-query run matched the full parent oracle");
          }
        }

        await Promise.all(setupTasks);
        const networkDeadline = Date.now() + 5_000;
        let stableNetworkPasses = 0;
        let priorRequestCount = -1;
        while (Date.now() < networkDeadline && stableNetworkPasses < 3) {
          await Promise.all([...bodyTasks]);
          const pending = [...requests.values()].filter((request) =>
            (request.body as { status: string }).status === "pending"
          ).length;
          if (pending === 0 && requests.size === priorRequestCount) {
            stableNetworkPasses++;
          } else stableNetworkPasses = 0;
          priorRequestCount = requests.size;
          await delay(50);
        }
        if (
          stableNetworkPasses < 3 ||
          [...requests.values()].some((request) =>
            (request.body as { status: string }).status === "pending"
          )
        ) throw new Error(`${definition.id} network evidence did not settle exhaustively`);
        if (asyncErrors.length) throw asyncErrors[0];
        for (const request of requests.values()) {
          if (
            request.failed || request.status !== 200 || request.fromDiskCache ||
            request.fromServiceWorker
          ) {
            throw new Error(
              `${definition.id} non-authoritative network record: ${JSON.stringify(request)}`,
            );
          }
          const body = request.body as { status: string };
          if (!(["supported", "executed-blob-audit"] as string[]).includes(body.status)) {
            throw new Error(
              `${definition.id} omitted raw response evidence: ${String(request.url)}`,
            );
          }
        }
        if (exceptions.length || consoleEntries.some((entry) => entry.type === "error")) {
          throw new Error(`${definition.id} observed page/worker console error or exception`);
        }

        const executionAudits: Array<Record<string, unknown>> = [];
        for (const event of [...lifecycleEvents, ...executionEvents]) {
          const detail = event.detail as Record<string, unknown>;
          if (
            (event.kind === "blob-created" || event.kind === "wasm-instantiated") && detail.base64
          ) {
            const bytes = base64ToBytes(String(detail.base64));
            executionAudits.push({
              kind: event.kind,
              sessionId: event.sessionId,
              targetId: event.targetId,
              url: detail.url ? String(detail.url) : null,
              mimeType: detail.mimeType ? String(detail.mimeType) : null,
              bytes: bytes.length,
              sha256: await sha256Hex(bytes),
              base64: String(detail.base64),
            });
          } else if (event.kind === "import-scripts") {
            executionAudits.push({
              kind: event.kind,
              sessionId: event.sessionId,
              targetId: event.targetId,
              url: (detail.urls as string[])[0],
              mimeType: null,
              bytes: null,
              sha256: null,
              base64: null,
            });
          }
        }
        if (parsedResult) {
          const auditHashes = new Set(
            executionAudits.flatMap((audit) => audit.sha256 ? [audit.sha256] : []),
          );
          for (const id of ["worker", "contract", "engine"]) {
            const expectedHash = runtimeHashes.get(id);
            if (!expectedHash || !auditHashes.has(expectedHash)) {
              throw new Error(`executed Blob bytes omitted ${id}`);
            }
          }
          const javascriptEngineHash = runtimeHashes.get("javascript-engine");
          if (
            parsedResult.variant === "javascript-controlled" &&
            (!javascriptEngineHash || !auditHashes.has(javascriptEngineHash))
          ) {
            throw new Error("executed Blob bytes omitted AlaSQL");
          }
          if (parsedResult.variant === "linear-wasm-controlled") {
            for (const id of ["sqlite-glue", "sqlite-wasm"]) {
              const expectedHash = runtimeHashes.get(id);
              if (!expectedHash || !auditHashes.has(expectedHash)) {
                throw new Error(`executed module bytes omitted ${id}`);
              }
            }
          }
        }

        const axTree = await client.send("Accessibility.getFullAXTree", {}, pageSessionId, 10_000);
        const axNodes = ((axTree.nodes as Array<Record<string, unknown>>) ?? []).map((node) => ({
          role: String((node.role as { value?: unknown } | undefined)?.value ?? ""),
          name: String((node.name as { value?: unknown } | undefined)?.value ?? ""),
          ignored: Boolean(node.ignored),
        })).filter((node) => !node.ignored && node.role && node.name);
        if (
          !axNodes.some((node) =>
            node.role === "heading" && node.name === "SQLite analytical notebook"
          )
        ) {
          throw new Error(`${definition.id} AX tree omitted the visible heading`);
        }
        if (!axNodes.some((node) => node.name.includes(state.status))) {
          throw new Error(`${definition.id} AX tree omitted the visible status`);
        }
        if (parsedResult && !axNodes.some((node) => node.name.includes(COMPLETE_OUTPUT_SHA256))) {
          throw new Error(`${definition.id} AX tree omitted the visible full-result digest`);
        }
        const screenshot = await client.send(
          "Page.captureScreenshot",
          {
            format: "png",
            fromSurface: true,
            captureBeyondViewport: true,
          },
          pageSessionId,
          10_000,
        );
        const screenshotBytes = base64ToBytes(String(screenshot.data));
        if (
          ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) =>
            screenshotBytes[index] === value
          )
        ) {
          throw new Error(`${definition.id} screenshot is not PNG evidence`);
        }
        const screenshotPath = `screenshots/${definition.id}.png`;
        await Deno.writeFile(`${options.outputDir}/${screenshotPath}`, screenshotBytes, {
          createNew: true,
        });

        const terminationCount = lifecycleEvents.filter((event) =>
          event.kind === "worker-terminated"
        ).length;
        if (terminationCount !== definition.targets.length) {
          throw new Error(
            `${definition.id} terminated ${terminationCount}/${definition.targets.length} owned workers`,
          );
        }
        const targetInfo = (await client.send("Target.getTargetInfo", { targetId: pageTargetId }))
          .targetInfo as Record<string, unknown>;
        if (targetInfo.browserContextId !== browserContextId || targetInfo.type !== "page") {
          throw new Error("scenario page escaped the owned browser context");
        }
        scenarios.push({
          id: definition.id,
          mode: definition.mode,
          targetSequence: [...definition.targets],
          ownership: {
            browserContextId,
            pageTargetId,
            pageSessionId,
            sessions: [...ownedSessions.entries()].map(([sessionId, value]) => ({
              sessionId,
              ...value,
            })),
          },
          statusHistory: state.statuses,
          finalState: {
            status: state.status,
            resultTextSha256: await sha256Hex(encoder.encode(state.result)),
            bodyTextSha256: await sha256Hex(encoder.encode(state.bodyText)),
            startDisabled: state.startDisabled,
            cancelDisabled: state.cancelDisabled,
            progress: state.progress,
          },
          ...(parsedResult ? { result: parsedResult } : {}),
          lifecycle: {
            events: lifecycleEvents.map((event) => ({
              kind: event.kind,
              detailJson: canonicalize(event.detail),
              sessionId: event.sessionId,
              targetId: event.targetId,
            })),
            assertions,
          },
          executionAudits,
          console: consoleEntries,
          exceptions,
          network: [...requests.values()],
          accessibility: {
            inspectedBy: "Accessibility.getFullAXTree",
            visibleStatus: state.status,
            visibleResultTextSha256: await sha256Hex(encoder.encode(state.result)),
            resultDigestExposed: parsedResult !== null,
            matchingNodes: await Promise.all(
              axNodes.filter((node) =>
                node.name.includes(state.status) || node.name.includes(COMPLETE_OUTPUT_SHA256)
              ).map(async (node) => ({
                role: node.role,
                nameSha256: await sha256Hex(encoder.encode(node.name)),
              })),
            ),
            assertions: parsedResult
              ? ["visible status is exposed", "full-result digest is exposed"]
              : ["visible status is exposed"],
          },
          screenshot: {
            path: screenshotPath,
            bytes: screenshotBytes.length,
            sha256: await sha256Hex(screenshotBytes),
          },
        });
      } finally {
        for (const remove of removers) remove();
        await client.send("Target.closeTarget", { targetId: pageTargetId }).catch(() => ({}));
      }
      await snapshotCgroup();
    }
  } catch (error) {
    collectionError = error;
  } finally {
    try {
      if (browserContextId && client) {
        const targetsBefore =
          ((await client.send("Target.getTargets")).targetInfos as Array<Record<string, unknown>>)
            .filter((info) => info.browserContextId === browserContextId).map((info) =>
              String(info.targetId)
            );
        await client.send("Target.disposeBrowserContext", { browserContextId });
        await delay(100);
        const targetsAfter =
          ((await client.send("Target.getTargets")).targetInfos as Array<Record<string, unknown>>)
            .filter((info) => info.browserContextId === browserContextId).map((info) =>
              String(info.targetId)
            );
        if (targetsAfter.length) throw new Error("owned browser-context targets survived disposal");
        cleanup.sessionTargets = {
          outcome: "success",
          browserContextId,
          targetsBefore,
          targetsAfter,
        };
      } else {cleanup.sessionTargets = {
          outcome: "success",
          browserContextId: null,
          targetsBefore: [],
          targetsAfter: [],
        };}
    } catch (error) {
      cleanup.sessionTargets = {
        outcome: "failure",
        error: error instanceof Error ? error.message : String(error),
      };
    }
    try {
      client?.close();
      await snapshotCgroup().catch(() => []);
      if (cgroupPath && cgroupIdentity && cgroupKill) {
        const current = await Deno.lstat(cgroupPath);
        if (
          numeric(current.dev, "cleanup cgroup device") !== cgroupIdentity.dev ||
          numeric(current.ino, "cleanup cgroup inode") !== cgroupIdentity.ino
        ) {
          throw new Error("owned cgroup identity changed before cleanup");
        }
        await cgroupKill.write(encoder.encode("1"));
        const remaining = await waitCgroupEmpty(cgroupPath, 5_000);
        if (remaining.length) throw new Error(`owned cgroup retained PIDs: ${remaining.join(",")}`);
      }
      cleanup.cgroup = { outcome: "success", killed: Boolean(cgroupKill), remainingPids: [] };
    } catch (error) {
      cleanup.cgroup = {
        outcome: "failure",
        error: error instanceof Error ? error.message : String(error),
        remainingPids: cgroupPath ? await cgroupMembers(cgroupPath).catch(() => []) : [],
      };
    }
    try {
      cgroupKill?.close();
    } catch { /* retained above */ }
    try {
      if (unit) {
        await commandText(root, "/usr/bin/systemctl", ["--user", "stop", unit]).catch(() => "");
      }
      const remaining = [];
      for (const identity of browserProcesses.values()) {
        if (await identityRunning(identity)) remaining.push(identity.pid);
      }
      if (remaining.length) {
        throw new Error(`identity-bound CfT processes survived: ${remaining.join(",")}`);
      }
      cleanup.browserProcesses = { outcome: "success", remainingPids: [] };
    } catch (error) {
      cleanup.browserProcesses = {
        outcome: "failure",
        error: error instanceof Error ? error.message : String(error),
        remainingPids: [],
      };
    }
    try {
      if (profilePath && profileIdentity) {
        if (
          (cleanup.cgroup as { outcome: string }).outcome !== "success" ||
          (cleanup.browserProcesses as { outcome: string }).outcome !== "success"
        ) {
          throw new Error("profile retained because process containment cleanup failed");
        }
        const current = await Deno.lstat(profilePath);
        if (
          numeric(current.dev, "cleanup profile device") !== profileIdentity.dev ||
          numeric(current.ino, "cleanup profile inode") !== profileIdentity.ino
        ) {
          throw new Error("owned profile identity changed before removal");
        }
        await Deno.remove(profilePath, { recursive: true });
        try {
          await Deno.lstat(profilePath);
          throw new Error("owned profile survived removal");
        } catch (error) {
          if (!(error instanceof Deno.errors.NotFound)) throw error;
        }
      }
      cleanup.profile = { outcome: "success", path: profilePath, absent: true };
    } catch (error) {
      cleanup.profile = {
        outcome: "failure",
        path: profilePath,
        absent: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    try {
      if (serverIdentity && await identityRunning(serverIdentity)) {
        Deno.kill(serverIdentity.pid, "SIGTERM");
      }
      if (serverStatus) {
        let exited = await Promise.race([serverStatus, delay(5_000).then(() => null)]);
        if (exited === null && serverIdentity && await identityRunning(serverIdentity)) {
          Deno.kill(serverIdentity.pid, "SIGKILL");
          exited = await serverStatus;
        }
      }
      if (serverIdentity && await identityRunning(serverIdentity)) {
        throw new Error("owned loopback server survived cleanup");
      }
      cleanup.server = { outcome: "success", processAbsent: true };
    } catch (error) {
      cleanup.server = {
        outcome: "failure",
        processAbsent: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const endStatus = await commandText(root, "git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  const endHead = await commandText(root, "git", ["rev-parse", "HEAD"]);
  const endTree = await commandText(root, "git", ["rev-parse", "HEAD^{tree}"]);
  let endFilesMatch = true;
  for (const source of sourceFiles) {
    const path = String(source.path).split("#")[0];
    if (path === "server.ts" && String(source.path).includes("#")) continue;
    const bytes = await Deno.readFile(`${root}/${path}`);
    if (bytes.length !== source.bytes || await sha256Hex(bytes) !== source.sha256) {
      endFilesMatch = false;
    }
  }
  const endRecheck = {
    status: endStatus === "" ? "clean" : "dirty",
    head: endHead,
    tree: endTree,
    filesMatch: endFilesMatch,
    collectorMatches:
      await sha256Hex(await Deno.readFile(`${root}/${SCRIPT}`)) === await sha256Hex(collectorBytes),
    checkedAt: new Date().toISOString(),
  };
  if (
    endStatus !== "" || endHead !== head || endTree !== tree || !endFilesMatch ||
    !endRecheck.collectorMatches
  ) {
    collectionError ??= new Error("source HEAD/tree/bytes changed during browser collection");
  }
  for (const [name, value] of Object.entries(cleanup)) {
    if ((value as { outcome?: string }).outcome === "failure") {
      collectionError ??= new Error(`${name} cleanup failed`);
    }
  }

  if (collectionError) {
    if (outputCreated) {
      const failure = {
        schemaVersion: 1,
        evidenceType: "sqlite-notebook-browser-collection-failure",
        failedAt: new Date().toISOString(),
        error: collectionError instanceof Error ? collectionError.message : String(collectionError),
        source: { head, tree, endRecheck },
        browser: { unit, cgroupPath, browserContextId, processes: [...browserProcesses.values()] },
        cleanup,
      };
      await Deno.writeTextFile(
        `${options.outputDir}/failure.v1.json`,
        `${canonicalize(failure)}\n`,
        { createNew: true },
      ).catch(() => {});
    }
    throw collectionError;
  }
  if (scenarios.length !== 8) throw new Error(`collector retained ${scenarios.length}/8 scenarios`);

  const evidence = {
    schemaVersion: 1,
    workload: WORKLOAD,
    evidenceId: `database-sqlite-notebook-browser-${head.slice(0, 12)}`,
    collectedAt: new Date().toISOString(),
    source: {
      head,
      tree,
      acceptedParentCommit: ACCEPTED_PARENT_COMMIT,
      root,
      initialClean: true,
      collector: {
        path: SCRIPT,
        bytes: collectorBytes.length,
        sha256: await sha256Hex(collectorBytes),
        headBytesMatch: true,
      },
      files: sourceFiles,
      endRecheck,
    },
    browser: {
      product: String(browserVersion.product),
      revision: String(browserVersion.revision),
      userAgent: String(browserVersion.userAgent),
      jsVersion: String(browserVersion.jsVersion),
      executable: {
        path: executable,
        bytes: numeric(executableInfo.size, "CfT executable bytes"),
        sha256: executableSha256,
      },
      launchArguments,
      effectiveArguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
      debuggerOrigin: `http://127.0.0.1:${debuggerPort}`,
      profile: { path: profilePath, ...profileIdentity },
      cgroup: { unit, path: cgroupPath, ...cgroupIdentity, snapshots: cgroupSnapshots },
      processes: [...browserProcesses.values()].sort((left, right) => left.pid - right.pid),
    },
    server: { origin, host: "127.0.0.1", mode: "public", launcher: serverIdentity },
    scenarios,
    cleanup: {
      ...cleanup,
      output: { outcome: "success", path: options.outputDir, retained: true },
    },
  };
  const schema = JSON.parse(
    await Deno.readTextFile(`${root}/schemas/sqlite-notebook-browser-evidence.schema.json`),
  );
  type Validator = ((value: unknown) => boolean) & { errors?: unknown };
  type AjvConstructor = new (
    options?: Record<string, unknown>,
  ) => { compile: (schema: unknown) => Validator };
  const Ajv2020 = Ajv2020Module as unknown as AjvConstructor;
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  if (!validate(evidence)) {
    throw new Error(`browser evidence schema failed: ${JSON.stringify(validate.errors)}`);
  }
  await Deno.writeTextFile(`${options.outputDir}/evidence.v1.json`, `${canonicalize(evidence)}\n`, {
    createNew: true,
  });
  console.log(
    "SQLite notebook browser evidence: 8 authoritative scenarios; exact cleanup retained",
  );
}

if (import.meta.main) await runCollector(parseOptions(Deno.args));

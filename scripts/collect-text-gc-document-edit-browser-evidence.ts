import Ajv2020Module from "ajv2020";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

const ROOT = new URL("../", import.meta.url);
const ACCEPTED_COMMIT = "204261da84798f17555896fa8e158b7b051def48";
const ACCEPTED_TREE = "9bd380330fe704f88a5c8c47ee133f66bec8a5dd";
const EXPECTED_PRODUCT = "Chrome/150.0.7871.24";
const EXPECTED_CHROME_SHA256 = "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
const ROUTE = "/demos/text.gc-document-edit.v1/";
const EVIDENCE_ID = "text-gc-document-edit-chrome-150-browser-evidence-v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export const TARGETS = ["js-controlled", "wasmgc-controlled"] as const;
export const SCENARIOS = [
  { id: "complete-js", mode: "normal", targets: ["js-controlled"] },
  { id: "complete-wasmgc", mode: "normal", targets: ["wasmgc-controlled"] },
  { id: "wrong-token", mode: "wrong-token", targets: ["js-controlled"] },
  {
    id: "stale-error-after-restart",
    mode: "stale-error",
    targets: ["js-controlled", "wasmgc-controlled"],
  },
  { id: "restart", mode: "normal", targets: ["js-controlled", "wasmgc-controlled"] },
  { id: "timeout", mode: "timeout", targets: ["js-controlled"] },
  { id: "cancel", mode: "cancel", targets: ["js-controlled"] },
  { id: "pagehide", mode: "pagehide", targets: ["js-controlled"] },
] as const;

export const SERVED_ASSETS = [
  [ROUTE, "public/demos/text.gc-document-edit.v1/index.html", "text/html"],
  ["/styles.css", "public/styles.css", "text/css"],
  [
    "/text-gc-document-edit-runner.js",
    "public/text-gc-document-edit-runner.js",
    "text/javascript",
  ],
  [
    "/text-gc-document-edit-worker.js",
    "public/text-gc-document-edit-worker.js",
    "text/javascript",
  ],
  [
    "/benchmarks/v1/text-gc-document-edit/workload.js",
    "benchmarks/v1/text-gc-document-edit/workload.js",
    "text/javascript",
  ],
  [
    "/artifacts/text-gc-document-edit/fixture.v1.txt",
    "public/artifacts/text-gc-document-edit/fixture.v1.txt",
    "text/plain",
  ],
  [
    "/artifacts/text-gc-document-edit/fixture-manifest.json",
    "public/artifacts/text-gc-document-edit/fixture-manifest.json",
    "application/json",
  ],
  [
    "/artifacts/text-gc-document-edit/reference.json",
    "public/artifacts/text-gc-document-edit/reference.json",
    "application/json",
  ],
  [
    "/artifacts/text-gc-document-edit/build-manifest.json",
    "public/artifacts/text-gc-document-edit/build-manifest.json",
    "application/json",
  ],
  [
    "/artifacts/text-gc-document-edit/text-gc-document-edit.mjs",
    "public/artifacts/text-gc-document-edit/text-gc-document-edit.mjs",
    "text/javascript",
  ],
  [
    "/artifacts/text-gc-document-edit/text-gc-document-edit.import-object.mjs",
    "public/artifacts/text-gc-document-edit/text-gc-document-edit.import-object.mjs",
    "text/javascript",
  ],
  [
    "/artifacts/text-gc-document-edit/text-gc-document-edit.js-builtins.mjs",
    "public/artifacts/text-gc-document-edit/text-gc-document-edit.js-builtins.mjs",
    "text/javascript",
  ],
  [
    "/artifacts/text-gc-document-edit/text-gc-document-edit.wasm",
    "public/artifacts/text-gc-document-edit/text-gc-document-edit.wasm",
    "application/wasm",
  ],
  [
    "/evidence/v1-base/text-gc-document-edit/js-controlled.json",
    "public/evidence/v1-base/text-gc-document-edit/js-controlled.json",
    "application/json",
  ],
  [
    "/evidence/v1-base/text-gc-document-edit/wasmgc-controlled.json",
    "public/evidence/v1-base/text-gc-document-edit/wasmgc-controlled.json",
    "application/json",
  ],
  ["/favicon.ico", "public/favicon.svg", "image/svg+xml"],
] as const;

const COLLECTOR_SUPPORT_PATHS = [
  "lib/canonical.ts",
  "lib/cdp-client.ts",
  "deploy.ts",
  "server.ts",
  "schemas/text-gc-document-edit-browser-evidence.schema.json",
  "scripts/collect-text-gc-document-edit-browser-evidence.ts",
] as const;

const EXPECTED_CANONICAL_SHA256 =
  "40e55287bfd9486ef258602766e7c839e2ad77ba7f52b843117607132a6fd0c4";
const EXPECTED_COUNTERS = Object.freeze({
  "initial-nodes": 256,
  operations: 10_000,
  inserts: 3_334,
  deletes: 3_333,
  reparents: 3_333,
  "final-nodes": 257,
  "child-insertions": 6_922,
  "child-removals": 6_666,
  "parent-writes": 10_255,
  "node-object-allocations": 3_590,
  "child-list-allocations": 3_590,
  "label-values": 3_590,
  "traversal-nodes": 257,
});
const EXPECTED_IDENTITY = Object.freeze({
  rootId: 0,
  reachableNodes: 257,
  uniqueNodeIds: 257,
  parentChildLinksValid: true,
  orderedChildrenRetained: true,
});

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

interface SourceFile {
  route: string;
  path: string;
  contentType: string;
  bytes: number;
  sha256: string;
  acceptedCommitBytesMatch: true;
}

interface PageState {
  heading: string;
  status: string;
  output: string;
  progressValue: number | null;
  startDisabled: boolean;
  cancelDisabled: boolean;
  target: string;
}

function usage(): never {
  throw new Error(
    `usage: collect-text-gc-document-edit-browser-evidence.ts --source-commit=${ACCEPTED_COMMIT} --chrome=<path> --output-dir=<absolute-new-directory>`,
  );
}

function parseOptions(args: string[]) {
  const options = new Map<string, string>();
  for (const argument of args) {
    const match = argument.match(/^--(source-commit|chrome|output-dir)=(.+)$/u);
    if (!match || options.has(match[1])) usage();
    options.set(match[1], match[2]);
  }
  if (options.size !== 3 || options.get("source-commit") !== ACCEPTED_COMMIT) usage();
  return {
    sourceCommit: options.get("source-commit")!,
    chrome: options.get("chrome")!,
    outputDir: options.get("output-dir")!,
  };
}

async function commandText(command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, {
    cwd: ROOT,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(decoder.decode(output.stderr));
  return decoder.decode(output.stdout).trim();
}

async function gitBytes(revision: string, path: string): Promise<Uint8Array> {
  const output = await new Deno.Command("git", {
    cwd: ROOT,
    args: ["show", `${revision}:${path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(`Git source missing: ${revision}:${path}`);
  return output.stdout;
}

async function assertCleanCheckout(): Promise<{ head: string; tree: string }> {
  const dirty = await commandText("git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (dirty) throw new Error(`collector requires an exact clean checkout; found:\n${dirty}`);
  return {
    head: await commandText("git", ["rev-parse", "HEAD"]),
    tree: await commandText("git", ["rev-parse", "HEAD^{tree}"]),
  };
}

async function fileIdentity(path: string): Promise<FileIdentity> {
  const realPath = await Deno.realPath(path);
  const stat = await Deno.stat(realPath);
  if (!stat.isFile) throw new Error(`${path} is not a regular file`);
  const bytes = await Deno.readFile(realPath);
  return {
    path: realPath,
    bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    dev: Number(stat.dev),
    ino: Number(stat.ino),
  };
}

function sameFileIdentity(a: FileIdentity, b: FileIdentity): boolean {
  return a.path === b.path && a.bytes === b.bytes && a.sha256 === b.sha256 && a.dev === b.dev &&
    a.ino === b.ino;
}

async function sourceGraph(sourceCommit: string): Promise<{
  files: SourceFile[];
  supportFiles: Array<{ path: string; bytes: number; sha256: string; headBytesMatch: true }>;
  sourceGraphSha256: string;
}> {
  if (await commandText("git", ["rev-parse", `${sourceCommit}^{tree}`]) !== ACCEPTED_TREE) {
    throw new Error("accepted source tree hash mismatch");
  }
  const files: SourceFile[] = [];
  for (const [route, path, contentType] of SERVED_ASSETS) {
    const disk = await Deno.readFile(new URL(path, ROOT));
    const committed = await gitBytes(sourceCommit, path);
    const sha256 = await sha256Hex(disk);
    if (disk.byteLength !== committed.byteLength || sha256 !== await sha256Hex(committed)) {
      throw new Error(`served source differs from accepted candidate bytes: ${path}`);
    }
    files.push({
      route,
      path,
      contentType,
      bytes: disk.byteLength,
      sha256,
      acceptedCommitBytesMatch: true,
    });
  }
  const supportFiles = [];
  const head = await commandText("git", ["rev-parse", "HEAD"]);
  for (const path of COLLECTOR_SUPPORT_PATHS) {
    const disk = await Deno.readFile(new URL(path, ROOT));
    const committed = await gitBytes(head, path);
    const sha256 = await sha256Hex(disk);
    if (disk.byteLength !== committed.byteLength || sha256 !== await sha256Hex(committed)) {
      throw new Error(`collector support differs from clean HEAD bytes: ${path}`);
    }
    supportFiles.push({ path, bytes: disk.byteLength, sha256, headBytesMatch: true as const });
  }
  return {
    files,
    supportFiles,
    sourceGraphSha256: await sha256Hex(encoder.encode(canonicalize({ files, supportFiles }))),
  };
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
    if (!entry.isDirectory || !/^\d+$/u.test(entry.name)) continue;
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
  return !(await Promise.all(identities.map(identityStillRunning))).some(Boolean);
}

async function terminateOwned(
  identities: ProcessIdentity[],
): Promise<Array<{ pid: number; signal: "SIGTERM" | "SIGKILL" }>> {
  const signals: Array<{ pid: number; signal: "SIGTERM" | "SIGKILL" }> = [];
  for (const [timeout, signal] of [[10_000, "SIGTERM"], [5_000, "SIGKILL"]] as const) {
    if (await waitForOwnedExit(identities, timeout)) break;
    for (const identity of [...identities].reverse()) {
      if (await identityStillRunning(identity)) {
        Deno.kill(identity.pid, signal);
        signals.push({ pid: identity.pid, signal });
      }
    }
  }
  return signals;
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

async function removeOwnedProfileOnFailure(
  path: string,
  identity: { dev: number; ino: number },
): Promise<void> {
  try {
    const current = await Deno.stat(path);
    if (Number(current.dev) !== identity.dev || Number(current.ino) !== identity.ino) {
      throw new Error("owned Chrome profile identity changed on failure path");
    }
    await Deno.remove(path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

function instrumentation(mode: string): string {
  return String.raw`(() => {
    const NativeWorker = globalThis.Worker;
    const mode = ${JSON.stringify(mode)};
    const workers = [];
    const emit = (kind, detail = {}) => globalThis.__documentEditEvidenceEvent(JSON.stringify({kind, detail}));
    if (mode === "timeout") {
      const nativeTimeout = globalThis.setTimeout;
      globalThis.setTimeout = (callback, delay, ...args) => nativeTimeout(callback, delay === 120000 ? 50 : delay, ...args);
    }
    class EvidenceWorker extends EventTarget {
      constructor(url, options) {
        super();
        this.native = new NativeWorker(url, options);
        this.index = workers.length;
        this.pending = null;
        this.terminated = false;
        workers.push(this);
        this.native.addEventListener("message", (event) => this.dispatchEvent(new MessageEvent("message", {data:event.data})));
        this.native.addEventListener("error", (event) => this.dispatchEvent(event));
        emit("worker-created", {index:this.index, url:String(url)});
      }
      postMessage(data, transfer) {
        emit("worker-posted", {index:this.index, target:data.target, tokenType:typeof data.token});
        if (mode === "wrong-token") {
          this.dispatchEvent(new MessageEvent("message", {data:{type:"complete", token:"wrong-token-sentinel", text:"WRONG_TOKEN_SENTINEL"}}));
          emit("wrong-token-dispatched", {index:this.index});
          setTimeout(() => this.native.postMessage(data, transfer || []), 250);
        } else if (["stale-error", "timeout", "cancel", "pagehide"].includes(mode)) {
          this.pending = {data, transfer:transfer || []};
          emit("worker-held", {index:this.index});
        } else {
          this.native.postMessage(data, transfer || []);
        }
      }
      terminate() {
        this.terminated = true;
        emit("worker-terminated", {index:this.index});
        this.native.terminate();
      }
    }
    Object.defineProperty(globalThis, "Worker", {value:EvidenceWorker, configurable:false});
    Object.defineProperty(globalThis, "__documentEditEvidenceControl", {
      value:Object.freeze({
        count:() => workers.length,
        terminated:(index) => workers[index].terminated,
        release(index) {
          const pending = workers[index].pending;
          if (!pending) throw new Error("worker has no held message");
          workers[index].pending = null;
          workers[index].native.postMessage(pending.data, pending.transfer);
          emit("worker-released", {index});
        },
        staleError(index) {
          const event = new Event("error");
          Object.defineProperty(event, "message", {value:"STALE_ERROR_SENTINEL"});
          workers[index].dispatchEvent(event);
          emit("stale-error-dispatched", {index});
        },
      }), configurable:false,
    });
    emit("instrumentation-ready", {mode});
  })();`;
}

async function evaluate(
  client: CdpClient,
  sessionId: string,
  expression: string,
): Promise<unknown> {
  const response = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId);
  if (response.exceptionDetails) throw new Error(`browser evaluation failed: ${expression}`);
  return (response.result as Record<string, unknown>).value;
}

async function click(client: CdpClient, sessionId: string, selector: string): Promise<void> {
  const point = await evaluate(
    client,
    sessionId,
    `(() => { const node=document.querySelector(${
      JSON.stringify(selector)
    }); const r=node.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:node.disabled}; })()`,
  ) as { x: number; y: number; disabled: boolean };
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

async function selectTarget(client: CdpClient, sessionId: string, target: string): Promise<void> {
  await evaluate(
    client,
    sessionId,
    `(() => { const node=document.querySelector("#target"); node.value=${
      JSON.stringify(target)
    }; node.dispatchEvent(new Event("change", {bubbles:true})); })()`,
  );
}

async function pageState(client: CdpClient, sessionId: string): Promise<PageState> {
  return await evaluate(
    client,
    sessionId,
    `(() => ({heading:document.querySelector("h1").textContent.trim(),status:document.querySelector("#status").textContent.trim(),output:document.querySelector("#output").textContent,progressValue:document.querySelector("#progress").getAttribute("value") === null ? null : document.querySelector("#progress").value,startDisabled:document.querySelector("#start").disabled,cancelDisabled:document.querySelector("#cancel").disabled,target:document.querySelector("#target").value}))()`,
  ) as PageState;
}

async function waitForState(
  client: CdpClient,
  sessionId: string,
  predicate: (state: PageState) => boolean,
  timeoutMs = 35_000,
): Promise<PageState> {
  const deadline = Date.now() + timeoutMs;
  let state = await pageState(client, sessionId);
  while (Date.now() < deadline) {
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 50));
    state = await pageState(client, sessionId);
  }
  throw new Error(`browser state timeout: ${JSON.stringify(state)}`);
}

export function validateSummary(target: string, value: unknown): Record<string, unknown> {
  if (
    !TARGETS.includes(target as (typeof TARGETS)[number]) || !value || typeof value !== "object"
  ) {
    throw new Error("completed target summary is not an exact controlled result");
  }
  const summary = value as Record<string, unknown>;
  const expectedKeys = [
    "canonicalBytes",
    "canonicalSha256",
    "counters",
    "gcDiagnostics",
    "identity",
    "packageByteHashesVerified",
    "passed",
    "performanceClaim",
    "persistence",
    "target",
  ];
  if (Object.keys(summary).sort().join("\0") !== expectedKeys.sort().join("\0")) {
    throw new Error("completed target summary has an open or incomplete shape");
  }
  if (
    summary.target !== target || summary.passed !== true || summary.canonicalBytes !== 7_775 ||
    summary.canonicalSha256 !== EXPECTED_CANONICAL_SHA256 ||
    summary.packageByteHashesVerified !== true || summary.performanceClaim !== null ||
    summary.persistence !== false
  ) throw new Error("completed target summary identity/oracle mismatch");
  const counters = summary.counters as Record<string, unknown>;
  const expectedCounters = {
    ...EXPECTED_COUNTERS,
    "boundary-crossings": target === "wasmgc-controlled" ? 2 : 0,
  };
  if (canonicalize(counters) !== canonicalize(expectedCounters)) {
    throw new Error("completed target summary structural counters mismatch");
  }
  if (canonicalize(summary.identity) !== canonicalize(EXPECTED_IDENTITY)) {
    throw new Error("completed target summary tree identity mismatch");
  }
  const diagnostics = summary.gcDiagnostics as Record<string, unknown>;
  if (
    diagnostics?.status !== "unavailable" ||
    diagnostics?.reason !==
      "Portable GC events and runtime-internal allocation counts are not exposed by the Web platform."
  ) throw new Error("completed target summary GC availability mismatch");
  return summary;
}

async function accessibility(client: CdpClient, sessionId: string) {
  const response = await client.send("Accessibility.getFullAXTree", {}, sessionId, 10_000);
  const nodes = ((response.nodes as Array<Record<string, unknown>>) ?? []).map((node) => ({
    role: String((node.role as Record<string, unknown> | undefined)?.value ?? ""),
    name: String((node.name as Record<string, unknown> | undefined)?.value ?? ""),
    ignored: Boolean(node.ignored),
  }));
  const exposed = nodes.filter((node) => !node.ignored);
  const assertions = {
    mainPresent: exposed.some((node) => node.role === "main"),
    headingNamed: exposed.some((node) =>
      node.role === "heading" && node.name === "GC-rich document model edit"
    ),
    targetNamed: exposed.some((node) => node.role === "combobox" && node.name === "Engine"),
    startNamed: exposed.some((node) => node.role === "button" && node.name === "Start"),
    cancelNamed: exposed.some((node) => node.role === "button" && node.name === "Cancel"),
    statusPresent: exposed.some((node) => node.role === "status"),
  };
  if (Object.values(assertions).some((value) => !value)) {
    throw new Error(`accessible output assertion failed: ${JSON.stringify(assertions)}`);
  }
  return {
    inspectedBy: "Accessibility.getFullAXTree",
    nodes,
    treeSha256: await sha256Hex(encoder.encode(canonicalize(nodes))),
    assertions,
  };
}

async function runCollector(): Promise<void> {
  const options = parseOptions(Deno.args);
  if (Deno.build.os !== "linux") throw new Error("exact /proc cleanup requires Linux");
  if (!options.outputDir.startsWith("/")) throw new Error("output directory must be absolute");
  const repositoryPath = await Deno.realPath(ROOT);
  const outputSeparator = options.outputDir.lastIndexOf("/");
  const outputParentPath = outputSeparator === 0
    ? "/"
    : options.outputDir.slice(0, outputSeparator);
  const outputParent = await Deno.realPath(outputParentPath);
  if (outputParent === repositoryPath || outputParent.startsWith(`${repositoryPath}/`)) {
    throw new Error("evidence output must be outside the source repository");
  }
  try {
    await Deno.lstat(options.outputDir);
    throw new Error("evidence output directory already exists");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }

  const initialCheckout = await assertCleanCheckout();
  const graph = await sourceGraph(options.sourceCommit);
  const sourceByRoute = new Map(graph.files.map((file) => [file.route, file]));
  const chromeAtLaunch = await fileIdentity(options.chrome);
  if (chromeAtLaunch.sha256 !== EXPECTED_CHROME_SHA256) {
    throw new Error(`Chrome executable hash mismatch: ${chromeAtLaunch.sha256}`);
  }

  const serverPort = unusedPort();
  const debuggerPort = unusedPort();
  if (serverPort === debuggerPort) throw new Error("owned ports collided");
  const origin = `http://127.0.0.1:${serverPort}`;
  const serverArguments = [
    "run",
    "--allow-env=PORT,HOST,SERVER_MODE",
    "--allow-net=127.0.0.1",
    "--allow-read=.",
    "deploy.ts",
  ];
  const server = new Deno.Command(Deno.execPath(), {
    cwd: ROOT,
    args: serverArguments,
    env: { PORT: String(serverPort), HOST: "127.0.0.1", SERVER_MODE: "public" },
    stdout: "null",
    stderr: "null",
  }).spawn();
  const serverStatusPromise = server.status;
  const serverLauncher = await processIdentity(server.pid);
  if (!serverLauncher) {
    Deno.kill(server.pid, "SIGTERM");
    await serverStatusPromise.catch(() => {});
    throw new Error("owned evidence server identity unavailable");
  }

  let profilePath: string | null = null;
  let profileIdentity: { dev: number; ino: number } | null = null;
  let browserProcess: Deno.ChildProcess | null = null;
  let browserStatusPromise: Promise<Deno.CommandStatus> | null = null;
  let client: CdpClient | null = null;
  let complete = false;
  const observedProcessMap = new Map<number, ProcessIdentity>();
  try {
    await waitFor(`${origin}/healthz`);
    for (const source of graph.files) {
      const response = await fetch(`${origin}${source.route}`, {
        cache: "no-store",
        redirect: "error",
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (
        response.status !== 200 ||
        !response.headers.get("content-type")?.startsWith(source.contentType) ||
        bytes.byteLength !== source.bytes || await sha256Hex(bytes) !== source.sha256
      ) throw new Error(`loopback preflight response bytes mismatch: ${source.route}`);
    }

    await Deno.mkdir(options.outputDir, { recursive: false });
    await Deno.mkdir(`${options.outputDir}/screenshots`);
    profilePath = await Deno.makeTempDir({ prefix: "wasm-text-gc-document-edit-chrome-" });
    const profileStat = await Deno.stat(profilePath);
    profileIdentity = { dev: Number(profileStat.dev), ino: Number(profileStat.ino) };
    if ((await Array.fromAsync(Deno.readDir(profilePath))).length !== 0) {
      throw new Error("fresh owned Chrome profile was not empty");
    }
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
    browserProcess = new Deno.Command(chromeAtLaunch.path, {
      args: launchArguments,
      stdout: "null",
      stderr: "null",
    }).spawn();
    browserStatusPromise = browserProcess.status;
    const browserPid = browserProcess.pid;
    const observeProcesses = async () => {
      for (const identity of await ownedProcesses(browserPid)) {
        const prior = observedProcessMap.get(identity.pid);
        if (
          prior && (prior.startTimeTicks !== identity.startTimeTicks ||
            prior.executable !== identity.executable)
        ) throw new Error(`owned Chrome PID ${identity.pid} changed identity`);
        observedProcessMap.set(identity.pid, identity);
      }
    };

    const discovery = await (await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
    const webSocketUrl = new URL(String(discovery.webSocketDebuggerUrl));
    if (
      webSocketUrl.protocol !== "ws:" || webSocketUrl.hostname !== "127.0.0.1" ||
      Number(webSocketUrl.port) !== debuggerPort || webSocketUrl.search || webSocketUrl.hash ||
      !/^\/devtools\/browser\/[A-Za-z0-9-]+$/u.test(webSocketUrl.pathname)
    ) throw new Error("Chrome CDP endpoint escaped the exact owned loopback endpoint");
    const browserSessionId = webSocketUrl.pathname.split("/").at(-1)!;
    client = new CdpClient(webSocketUrl.href);
    await client.ready();
    const browserVersion = await client.send("Browser.getVersion");
    if (browserVersion.product !== EXPECTED_PRODUCT) {
      throw new Error(`unexpected browser ${browserVersion.product}`);
    }
    const commandLine = await client.send("Browser.getBrowserCommandLine");
    if (!Array.isArray(commandLine.arguments)) throw new Error("effective Chrome argv unavailable");
    for (const argument of launchArguments.filter((value) => value.startsWith("--"))) {
      if (!(commandLine.arguments as unknown[]).includes(argument)) {
        throw new Error(`effective Chrome argv omitted ${argument}`);
      }
    }
    const runtimeLauncher = await processIdentity(browserPid);
    if (!runtimeLauncher || runtimeLauncher.executable !== chromeAtLaunch.path) {
      throw new Error("running Chrome executable differs from inspected executable");
    }
    await observeProcesses();

    const scenarios: Array<Record<string, unknown>> = [];
    for (const definition of SCENARIOS) {
      const created = await client.send("Target.createTarget", { url: "about:blank" });
      const targetId = String(created.targetId);
      const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
      const sessionId = String(attached.sessionId);
      const observedSessions = new Map([[sessionId, "page"]]);
      const workerSessionIds: string[] = [];
      const attachTasks: Promise<void>[] = [];
      const responseTasks: Promise<void>[] = [];
      const responseErrors: Error[] = [];
      const requests = new Map<string, Record<string, unknown>>();
      const consoleMessages: Array<Record<string, unknown>> = [];
      const exceptions: Array<Record<string, unknown>> = [];
      const lifecycleEvents: Array<Record<string, unknown>> = [];
      const runtimeScripts = new Map<string, Record<string, unknown>>();
      const removers = [
        client.on("Target.attachedToTarget", (params, eventSession) => {
          if (eventSession !== sessionId) return;
          const targetInfo = params.targetInfo as Record<string, unknown>;
          if (targetInfo.type !== "worker") return;
          const workerSession = String(params.sessionId);
          workerSessionIds.push(workerSession);
          observedSessions.set(workerSession, "worker");
          attachTasks.push((async () => {
            await Promise.all([
              client!.send("Network.enable", {}, workerSession),
              client!.send("Network.setCacheDisabled", { cacheDisabled: true }, workerSession),
              client!.send("Runtime.enable", {}, workerSession),
              client!.send("Debugger.enable", {}, workerSession),
            ]);
            await client!.send("Runtime.runIfWaitingForDebugger", {}, workerSession);
          })());
        }),
        client.on("Runtime.bindingCalled", (params, eventSession) => {
          if (eventSession === sessionId && params.name === "__documentEditEvidenceEvent") {
            lifecycleEvents.push(JSON.parse(String(params.payload)));
          }
        }),
        client.on("Runtime.consoleAPICalled", (params, eventSession) => {
          if (!eventSession || !observedSessions.has(eventSession)) return;
          consoleMessages.push({
            context: observedSessions.get(eventSession),
            type: String(params.type),
            arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((argument) =>
              String(argument.value ?? argument.description ?? argument.type)
            ),
          });
        }),
        client.on("Runtime.exceptionThrown", (params, eventSession) => {
          if (!eventSession || !observedSessions.has(eventSession)) return;
          const details = params.exceptionDetails as Record<string, unknown>;
          exceptions.push({
            context: observedSessions.get(eventSession),
            text: String(details.text),
            lineNumber: Number(details.lineNumber),
          });
        }),
        client.on("Network.requestWillBeSent", (params, eventSession) => {
          if (!eventSession || !observedSessions.has(eventSession)) return;
          const request = params.request as Record<string, unknown>;
          requests.set(`${eventSession}:${params.requestId}`, {
            context: observedSessions.get(eventSession),
            url: String(request.url),
            method: String(request.method),
            resourceType: String(params.type),
            status: null,
            mimeType: null,
            fromDiskCache: false,
            fromServiceWorker: false,
            failed: false,
            errorText: null,
            sourcePath: null,
            responseBytes: null,
            responseSha256: null,
            cdpBodyEncoding: null,
          });
        }),
        client.on("Network.responseReceived", (params, eventSession) => {
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
        client.on("Network.loadingFailed", (params, eventSession) => {
          const record = requests.get(`${eventSession}:${params.requestId}`);
          if (record) Object.assign(record, { failed: true, errorText: String(params.errorText) });
        }),
        client.on("Network.loadingFinished", (params, eventSession) => {
          if (!eventSession) return;
          const record = requests.get(`${eventSession}:${params.requestId}`);
          if (!record) return;
          responseTasks.push(
            (async () => {
              const route = new URL(String(record.url)).pathname;
              const expected = sourceByRoute.get(route);
              if (!expected) throw new Error(`${definition.id} requested unbound route ${route}`);
              const response = await client!.send(
                "Network.getResponseBody",
                { requestId: String(params.requestId) },
                eventSession,
                10_000,
              );
              const bytes = response.base64Encoded
                ? Uint8Array.from(atob(String(response.body)), (value) => value.charCodeAt(0))
                : encoder.encode(String(response.body));
              if (
                bytes.byteLength !== expected.bytes || await sha256Hex(bytes) !== expected.sha256
              ) {
                throw new Error(`${definition.id} raw response bytes differ from accepted source`);
              }
              Object.assign(record, {
                sourcePath: expected.path,
                responseBytes: bytes.byteLength,
                responseSha256: expected.sha256,
                cdpBodyEncoding: response.base64Encoded ? "base64" : "utf8",
              });
            })().catch((error) => {
              responseErrors.push(error instanceof Error ? error : new Error(String(error)));
            }),
          );
        }),
        client.on("Debugger.scriptParsed", (params, eventSession) => {
          if (!eventSession || !observedSessions.has(eventSession) || !params.url) return;
          const scriptId = String(params.scriptId);
          const key = `${eventSession}:${scriptId}`;
          responseTasks.push(
            (async () => {
              const response = await client!.send(
                "Debugger.getScriptSource",
                { scriptId },
                eventSession,
                10_000,
              );
              const bytes = encoder.encode(String(response.scriptSource));
              runtimeScripts.set(key, {
                context: observedSessions.get(eventSession),
                url: String(params.url),
                bytes: bytes.byteLength,
                sha256: await sha256Hex(bytes),
              });
            })().catch((error) => {
              responseErrors.push(error instanceof Error ? error : new Error(String(error)));
            }),
          );
        }),
      ];

      let finalState: PageState = {
        heading: "",
        status: "",
        output: "",
        progressValue: null,
        startDisabled: false,
        cancelDisabled: true,
        target: "js-controlled",
      };
      const completedTargets: Array<Record<string, unknown>> = [];
      const assertions: string[] = [];
      const causal = {
        wrongTokenIgnored: false,
        staleErrorIgnored: false,
        freshWorkers: false,
        timeoutTerminated: false,
        cancelTerminated: false,
        pagehideTerminated: false,
      };
      try {
        const injection = instrumentation(definition.mode);
        await Promise.all([
          client.send("Page.enable", {}, sessionId),
          client.send("Runtime.enable", {}, sessionId),
          client.send("Network.enable", {}, sessionId),
          client.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId),
          client.send("Debugger.enable", {}, sessionId),
          client.send("Accessibility.enable", {}, sessionId),
          client.send("Runtime.addBinding", { name: "__documentEditEvidenceEvent" }, sessionId),
          client.send("Page.addScriptToEvaluateOnNewDocument", { source: injection }, sessionId),
          client.send("Target.setAutoAttach", {
            autoAttach: true,
            waitForDebuggerOnStart: true,
            flatten: true,
          }, sessionId),
        ]);
        const loaded = new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("page load timeout")), 10_000);
          const remove = client!.on("Page.loadEventFired", (_params, eventSession) => {
            if (eventSession !== sessionId) return;
            clearTimeout(timer);
            remove();
            resolve();
          });
        });
        await client.send("Page.navigate", { url: `${origin}${ROUTE}` }, sessionId);
        await loaded;
        finalState = await waitForState(client, sessionId, (state) => state.status === "Ready.");
        if (finalState.heading !== "GC-rich document model edit") {
          throw new Error(`${definition.id} loaded the wrong candidate route`);
        }

        const runTarget = async (target: string) => {
          await selectTarget(client!, sessionId, target);
          await click(client!, sessionId, "#start");
          const state = await waitForState(
            client!,
            sessionId,
            (value) => value.status === "Complete. Exact output and structural checks passed.",
            125_000,
          );
          let parsed: unknown;
          try {
            parsed = JSON.parse(state.output);
          } catch {
            throw new Error(`${definition.id}/${target} visible output was not exact JSON`);
          }
          const summary = validateSummary(target, parsed);
          completedTargets.push({
            target,
            summary,
            displayedText: state.output,
            displayedTextSha256: await sha256Hex(encoder.encode(state.output)),
          });
          return state;
        };

        if (definition.id === "stale-error-after-restart") {
          await selectTarget(client, sessionId, definition.targets[0]);
          await click(client, sessionId, "#start");
          await waitForState(client, sessionId, (state) => state.status.startsWith("Loading "));
          await click(client, sessionId, "#cancel");
          await waitForState(client, sessionId, (state) => state.status.startsWith("Cancelled."));
          await selectTarget(client, sessionId, definition.targets[1]);
          await click(client, sessionId, "#start");
          await waitForState(client, sessionId, (state) => state.status.startsWith("Loading "));
          await evaluate(client, sessionId, "__documentEditEvidenceControl.staleError(0)");
          const afterStale = await pageState(client, sessionId);
          causal.staleErrorIgnored = afterStale.status.startsWith("Loading ") &&
            !afterStale.status.includes("STALE_ERROR_SENTINEL");
          if (!causal.staleErrorIgnored) {
            throw new Error("stale first-worker error changed restart");
          }
          await evaluate(client, sessionId, "__documentEditEvidenceControl.release(1)");
          finalState = await waitForState(
            client,
            sessionId,
            (state) => state.status === "Complete. Exact output and structural checks passed.",
            125_000,
          );
          const summary = validateSummary(definition.targets[1], JSON.parse(finalState.output));
          completedTargets.push({
            target: definition.targets[1],
            summary,
            displayedText: finalState.output,
            displayedTextSha256: await sha256Hex(encoder.encode(finalState.output)),
          });
          assertions.push("stale terminated-worker error was ignored after a fresh-worker restart");
        } else if (definition.id === "restart") {
          for (const target of definition.targets) finalState = await runTarget(target);
          causal.freshWorkers = Number(
            await evaluate(client, sessionId, "__documentEditEvidenceControl.count()"),
          ) === 2;
          if (!causal.freshWorkers) throw new Error("restart did not create two fresh workers");
          assertions.push("two sequential exact runs used two fresh terminated workers");
        } else {
          const target = definition.targets[0];
          await selectTarget(client, sessionId, target);
          await click(client, sessionId, "#start");
          if (definition.id === "wrong-token") {
            await waitForState(client, sessionId, (state) => state.status.startsWith("Loading "));
            const deadline = Date.now() + 2_000;
            while (
              !lifecycleEvents.some((event) => event.kind === "wrong-token-dispatched") &&
              Date.now() < deadline
            ) await new Promise((resolve) => setTimeout(resolve, 10));
            const afterWrong = await pageState(client, sessionId);
            causal.wrongTokenIgnored = afterWrong.status.startsWith("Loading ") &&
              !afterWrong.output.includes("WRONG_TOKEN_SENTINEL");
            if (!causal.wrongTokenIgnored) throw new Error("wrong-token completion changed state");
            finalState = await waitForState(
              client,
              sessionId,
              (state) => state.status === "Complete. Exact output and structural checks passed.",
              125_000,
            );
            const summary = validateSummary(target, JSON.parse(finalState.output));
            completedTargets.push({
              target,
              summary,
              displayedText: finalState.output,
              displayedTextSha256: await sha256Hex(encoder.encode(finalState.output)),
            });
            assertions.push("wrong-token completion was ignored before the exact run completed");
          } else if (definition.id === "timeout") {
            finalState = await waitForState(
              client,
              sessionId,
              (state) => state.status === "Stopped: the 120 second timeout expired.",
              3_000,
            );
            causal.timeoutTerminated = Boolean(
              await evaluate(client, sessionId, "__documentEditEvidenceControl.terminated(0)"),
            );
            assertions.push("shortened causal probe reached the exact 120-second timeout branch");
          } else if (definition.id === "cancel") {
            await waitForState(client, sessionId, (state) => state.status.startsWith("Loading "));
            await click(client, sessionId, "#cancel");
            finalState = await waitForState(
              client,
              sessionId,
              (state) =>
                state.status === "Cancelled. The worker was terminated and no result was retained.",
            );
            causal.cancelTerminated = Boolean(
              await evaluate(client, sessionId, "__documentEditEvidenceControl.terminated(0)"),
            );
            assertions.push("visible Cancel terminated the exact held worker");
          } else if (definition.id === "pagehide") {
            finalState = await waitForState(
              client,
              sessionId,
              (state) => state.status.startsWith("Loading "),
            );
            assertions.push("real navigation pagehide terminated the exact held worker");
          } else {
            finalState = await runTarget(target);
            assertions.push("visible Start completed exact output and structural validation");
          }
        }

        const accessibleOutput = await accessibility(client, sessionId);
        const screenshotResponse = await client.send(
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
          atob(String(screenshotResponse.data)),
          (value) => value.charCodeAt(0),
        );
        if (
          screenshotBytes.byteLength < 8 ||
          ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) =>
            screenshotBytes[index] === value
          )
        ) throw new Error(`${definition.id} screenshot is not PNG bytes`);
        const screenshotPath = `screenshots/${definition.id}.png`;
        await Deno.writeFile(`${options.outputDir}/${screenshotPath}`, screenshotBytes, {
          createNew: true,
        });

        if (definition.id === "pagehide") {
          await client.send("Page.navigate", { url: "about:blank" }, sessionId);
          const deadline = Date.now() + 2_000;
          while (
            !lifecycleEvents.some((event) => event.kind === "worker-terminated") &&
            Date.now() < deadline
          ) await new Promise((resolve) => setTimeout(resolve, 10));
          causal.pagehideTerminated = lifecycleEvents.some((event) =>
            event.kind === "worker-terminated"
          );
        }

        await Promise.all(attachTasks);
        await new Promise((resolve) => setTimeout(resolve, 100));
        await Promise.all(responseTasks);
        if (responseErrors.length) throw responseErrors[0];
        const network = [...requests.values()];
        for (const request of network) {
          if (
            request.failed || request.status !== 200 || request.fromServiceWorker ||
            request.fromDiskCache || new URL(String(request.url)).origin !== origin ||
            request.responseBytes === null || request.responseSha256 === null ||
            request.sourcePath === null
          ) throw new Error(`${definition.id} network evidence is incomplete or non-authoritative`);
        }
        if (exceptions.length || consoleMessages.some((entry) => entry.type === "error")) {
          throw new Error(`${definition.id} produced console errors or exceptions`);
        }
        const terminations = lifecycleEvents.filter((event) => event.kind === "worker-terminated");
        if (terminations.length !== definition.targets.length) {
          throw new Error(
            `${definition.id} terminated ${terminations.length}/${definition.targets.length} workers`,
          );
        }
        if (
          (definition.id === "timeout" && !causal.timeoutTerminated) ||
          (definition.id === "cancel" && !causal.cancelTerminated) ||
          (definition.id === "pagehide" && !causal.pagehideTerminated)
        ) throw new Error(`${definition.id} causal termination assertion failed`);

        const executedSources = [...runtimeScripts.values()].sort((a, b) =>
          `${a.context}:${a.url}`.localeCompare(`${b.context}:${b.url}`)
        );
        const sourceExecutionSha256 = await sha256Hex(
          encoder.encode(canonicalize(executedSources)),
        );
        const sessionNetworkSha256 = await sha256Hex(encoder.encode(canonicalize(network)));
        const targetStateSha256 = await sha256Hex(
          encoder.encode(canonicalize({ finalState, completedTargets, causal })),
        );
        scenarios.push({
          id: definition.id,
          mode: definition.mode,
          targetSequence: [...definition.targets],
          completedTargets,
          finalState,
          causal,
          assertions,
          lifecycleEvents,
          console: consoleMessages,
          exceptions,
          network,
          executedSources,
          accessibility: accessibleOutput,
          screenshot: {
            path: screenshotPath,
            bytes: screenshotBytes.byteLength,
            sha256: await sha256Hex(screenshotBytes),
          },
          cdpIdentity: {
            browserSessionSha256: await sha256Hex(encoder.encode(browserSessionId)),
            targetIdSha256: await sha256Hex(encoder.encode(targetId)),
            pageSessionIdSha256: await sha256Hex(encoder.encode(sessionId)),
            workerSessionIdSha256: await Promise.all(
              workerSessionIds.map((value) => sha256Hex(encoder.encode(value))),
            ),
            sourceExecutionSha256,
            sessionNetworkSha256,
            targetStateSha256,
          },
        });
      } finally {
        for (const remove of removers) remove();
        await client.send("Target.closeTarget", { targetId }).catch(() => ({}));
      }
      await observeProcesses();
    }

    await observeProcesses();
    const observedProcesses = [...observedProcessMap.values()].sort((a, b) => a.pid - b.pid);
    const browserLauncher = observedProcesses.find((identity) => identity.pid === browserPid);
    if (!browserLauncher || browserLauncher.executable !== chromeAtLaunch.path) {
      throw new Error("owned Chrome launcher identity changed before cleanup");
    }
    await client.send("Browser.close");
    client.close();
    client = null;
    const browserSignals = await terminateOwned(observedProcesses);
    const processesAbsent = await waitForOwnedExit(observedProcesses, 5_000);
    const browserExit = await browserStatusPromise;
    if (!processesAbsent) throw new Error("owned Chrome processes survived exact cleanup");
    const chromeAfter = await fileIdentity(chromeAtLaunch.path);
    if (!sameFileIdentity(chromeAtLaunch, chromeAfter)) {
      throw new Error("Chrome executable identity changed during collection");
    }

    const profileBeforeRemoval = await Deno.stat(profilePath);
    if (
      Number(profileBeforeRemoval.dev) !== profileIdentity.dev ||
      Number(profileBeforeRemoval.ino) !== profileIdentity.ino
    ) throw new Error("owned Chrome profile identity changed before removal");
    await Deno.remove(profilePath, { recursive: true });
    let profileAbsent = false;
    try {
      await Deno.lstat(profilePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) profileAbsent = true;
      else throw error;
    }
    if (!profileAbsent) throw new Error("owned Chrome profile survived exact cleanup");

    if (await identityStillRunning(serverLauncher)) Deno.kill(server.pid, "SIGTERM");
    let serverExit = await Promise.race([
      serverStatusPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
    ]);
    let serverSignal: "SIGTERM" | "SIGKILL" = "SIGTERM";
    if (serverExit === null && await identityStillRunning(serverLauncher)) {
      Deno.kill(server.pid, "SIGKILL");
      serverSignal = "SIGKILL";
      serverExit = await serverStatusPromise;
    }
    const serverAbsent = !(await identityStillRunning(serverLauncher));
    if (!serverAbsent || serverExit === null) {
      throw new Error("owned evidence server survived cleanup");
    }

    // End-of-run TOCTOU recheck: commit, tree, status, every accepted served byte, and collector bytes.
    const endCheckout = await assertCleanCheckout();
    if (endCheckout.head !== initialCheckout.head || endCheckout.tree !== initialCheckout.tree) {
      throw new Error("checkout HEAD/tree changed during browser collection");
    }
    const endGraph = await sourceGraph(options.sourceCommit);
    if (canonicalize(endGraph) !== canonicalize(graph)) {
      throw new Error("source graph changed during browser collection");
    }

    const evidence = {
      schemaVersion: 1,
      evidenceId: EVIDENCE_ID,
      collectedAt: new Date().toISOString(),
      authority: {
        kind: "authoritative-parent-run-browser-collection",
        browserWasLaunchedByCollector: true,
        importedOrChildGeneratedEvidenceAccepted: false,
      },
      source: {
        acceptedCommit: ACCEPTED_COMMIT,
        acceptedTree: ACCEPTED_TREE,
        collectorHead: initialCheckout.head,
        collectorTree: initialCheckout.tree,
        cleanAtStart: true,
        cleanAtEnd: true,
        endHead: endCheckout.head,
        endTree: endCheckout.tree,
        sourceGraphSha256: graph.sourceGraphSha256,
        files: graph.files,
        supportFiles: graph.supportFiles,
      },
      collection: {
        script: "scripts/collect-text-gc-document-edit-browser-evidence.ts",
        command:
          `deno run -A scripts/collect-text-gc-document-edit-browser-evidence.ts --source-commit=${options.sourceCommit} --chrome=${options.chrome} --output-dir=${options.outputDir}`,
        outputDirectory: options.outputDir,
      },
      workload: {
        id: "text.gc-document-edit.v1",
        registrationId: "text.gc-document-edit.v1-supplemental-registration-v1",
        route: ROUTE,
        initialNodes: 256,
        operations: 10_000,
        inserts: 3_334,
        deletes: 3_333,
        reparents: 3_333,
        canonicalBytes: 7_775,
        canonicalSha256: EXPECTED_CANONICAL_SHA256,
        targets: [...TARGETS],
        performanceClaim: false,
      },
      browser: {
        product: String(browserVersion.product),
        revision: String(browserVersion.revision),
        userAgent: String(browserVersion.userAgent),
        jsVersion: String(browserVersion.jsVersion),
        executable: chromeAtLaunch,
        requestedLaunchArguments: launchArguments,
        effectiveCommandLine: commandLine.arguments,
        headless: true,
        protocol: "Chrome DevTools Protocol",
        debuggerOrigin: `http://127.0.0.1:${debuggerPort}`,
      },
      server: {
        origin,
        host: "127.0.0.1",
        mode: "public",
        executable: Deno.execPath(),
        arguments: serverArguments,
        launcher: serverLauncher,
        preflight: graph.files.map(({ route, bytes, sha256 }) => ({ route, bytes, sha256 })),
      },
      scenarios,
      cleanup: {
        browser: {
          launcher: browserLauncher,
          observedProcesses,
          requested: "Browser.close",
          signals: browserSignals,
          exit: browserExit,
          processesAbsent,
          executableUnchanged: true,
        },
        profile: {
          path: profilePath,
          dev: profileIdentity.dev,
          ino: profileIdentity.ino,
          initiallyEmpty: true,
          identityMatched: true,
          removed: true,
          absent: profileAbsent,
        },
        server: {
          launcher: serverLauncher,
          signal: serverSignal,
          exit: serverExit,
          processAbsent: serverAbsent,
        },
      },
    };

    const schema = JSON.parse(
      await Deno.readTextFile(
        new URL("schemas/text-gc-document-edit-browser-evidence.schema.json", ROOT),
      ),
    );
    type Validator = ((value: unknown) => boolean) & { errors?: unknown };
    type AjvConstructor = new (options?: Record<string, unknown>) => {
      compile: (schema: unknown) => Validator;
    };
    const Ajv2020 = Ajv2020Module as unknown as AjvConstructor;
    const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
    if (!validate(evidence)) {
      throw new Error(`browser evidence schema failure: ${JSON.stringify(validate.errors)}`);
    }
    await Deno.writeTextFile(
      `${options.outputDir}/evidence.v1.json`,
      `${canonicalize(evidence)}\n`,
      { createNew: true },
    );
    complete = true;
    console.log(`text GC document edit: ${scenarios.length} scenarios; exact owned cleanup`);
  } finally {
    if (!complete) {
      try {
        await client?.send("Browser.close");
      } catch {
        // Identity-bound cleanup continues below.
      }
      client?.close();
      if (browserProcess) {
        const current = await ownedProcesses(browserProcess.pid);
        for (const identity of current) observedProcessMap.set(identity.pid, identity);
        await terminateOwned([...observedProcessMap.values()]);
        await browserStatusPromise?.catch(() => {});
      }
      if (await identityStillRunning(serverLauncher)) Deno.kill(server.pid, "SIGTERM");
      await Promise.race([
        serverStatusPromise.catch(() => null),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
      if (await identityStillRunning(serverLauncher)) Deno.kill(server.pid, "SIGKILL");
      await serverStatusPromise.catch(() => {});
      if (profilePath && profileIdentity) {
        await removeOwnedProfileOnFailure(profilePath, profileIdentity);
      }
      await Deno.remove(options.outputDir, { recursive: true }).catch(() => {});
    }
  }
}

if (import.meta.main) await runCollector();

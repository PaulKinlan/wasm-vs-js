import Ajv2020Module from "ajv2020";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";
import {
  generateFixture,
  instantiateSsrWasm,
  parseOutput,
  RECORDS,
  renderJavaScript,
  renderWasm,
} from "../benchmarks/v1/server-ssr-template/workload.js";

const EXPECTED_PRODUCT = "Chrome/150.0.7871.24";
const EXPECTED_EXECUTABLE_SHA256 =
  "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
const EVIDENCE_ID = "server-ssr-template-chrome-150-browser-evidence-v1";
const ROUTE = "/demos/server.ssr-template.v1/";
const root = new URL("../", import.meta.url);
const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

interface CliOptions {
  chrome: string;
  outputDir: string;
}

function parseOptions(args: string[]): CliOptions {
  const entries = new Map<string, string>();
  for (const argument of args) {
    const match = argument.match(/^--(chrome|output-dir)=(.+)$/u);
    if (!match || entries.has(match[1])) {
      throw new Error(
        "usage: collect-base-server-ssr-evidence.ts --chrome=<path> --output-dir=<absolute-new-directory>",
      );
    }
    entries.set(match[1], match[2]);
  }
  if (entries.size !== 2 || !entries.has("chrome") || !entries.has("output-dir")) {
    throw new Error(
      "usage: collect-base-server-ssr-evidence.ts --chrome=<path> --output-dir=<absolute-new-directory>",
    );
  }
  return { chrome: entries.get("chrome")!, outputDir: entries.get("output-dir")! };
}

const options = parseOptions(Deno.args);
if (Deno.build.os !== "linux") throw new Error("exact /proc cleanup requires Linux");
if (!options.outputDir.startsWith("/")) throw new Error("output directory must be absolute");
const repositoryPath = await Deno.realPath(root);
const outputParent = await Deno.realPath(new URL(".", new URL(`file://${options.outputDir}`)));
if (outputParent === repositoryPath || outputParent.startsWith(`${repositoryPath}/`)) {
  throw new Error("evidence output must be outside the source repository");
}
try {
  await Deno.lstat(options.outputDir);
  throw new Error("evidence output directory already exists");
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
}

async function commandText(command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(decoder.decode(output.stderr));
  return decoder.decode(output.stdout).trim();
}

async function gitBytes(revision: string, path: string): Promise<Uint8Array> {
  const output = await new Deno.Command("git", {
    cwd: root,
    args: ["show", `${revision}:${path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(`git source missing: ${revision}:${path}`);
  return output.stdout;
}

const dirty = await commandText("git", ["status", "--porcelain=v1", "--untracked-files=all"]);
if (dirty) throw new Error(`collector requires an exact clean HEAD; found:\n${dirty}`);
const head = await commandText("git", ["rev-parse", "HEAD"]);
const headTree = await commandText("git", ["rev-parse", "HEAD^{tree}"]);
if (!/^[a-f0-9]{40}$/u.test(head) || !/^[a-f0-9]{40}$/u.test(headTree)) {
  throw new Error("Git HEAD or tree is not a SHA-1 identity");
}

const executable = await Deno.realPath(options.chrome);
const executableBytes = await Deno.readFile(executable);
const executableSha256 = await sha256Hex(executableBytes);
if (executableSha256 !== EXPECTED_EXECUTABLE_SHA256) {
  throw new Error(`Chrome executable hash mismatch: ${executableSha256}`);
}

const registrationPath = "catalog/v1-implementation-registrations/server.ssr-template.v1.json";
const registrationBytes = await Deno.readFile(new URL(registrationPath, root));
const registration = JSON.parse(decoder.decode(registrationBytes));
if (
  registration.workloadId !== "server.ssr-template.v1" ||
  registration.fixedWork.responses !== RECORDS ||
  RECORDS !== 1_000
) {
  throw new Error("accepted route, registration, and collector must all require 1,000 responses");
}
const packageCommit = String(registration.sourceCommit);
if (!/^[a-f0-9]{40}$/u.test(packageCommit)) throw new Error("package source commit is invalid");

const ASSETS = [
  [ROUTE, "public/demos/server.ssr-template.v1/index.html", "text/html"],
  ["/styles.css", "public/styles.css", "text/css"],
  ["/base-server-ssr-demo.js", "public/base-server-ssr-demo.js", "text/javascript"],
  ["/base-server-ssr-worker.js", "public/base-server-ssr-worker.js", "text/javascript"],
  [
    "/benchmarks/v1/server-ssr-template/workload.js",
    "benchmarks/v1/server-ssr-template/workload.js",
    "text/javascript",
  ],
  [
    "/data/v1-implementation-registrations/server.ssr-template.v1.json",
    registrationPath,
    "application/json",
  ],
  [
    "/artifacts/base-server-ssr-template/build-manifest.json",
    "public/artifacts/base-server-ssr-template/build-manifest.json",
    "application/json",
  ],
  [
    "/artifacts/base-server-ssr-template/fixture-manifest.json",
    "public/artifacts/base-server-ssr-template/fixture-manifest.json",
    "application/json",
  ],
  [
    "/artifacts/base-server-ssr-template/output-manifest.json",
    "public/artifacts/base-server-ssr-template/output-manifest.json",
    "application/json",
  ],
  [
    "/artifacts/base-server-ssr-template/fixture.bin",
    "public/artifacts/base-server-ssr-template/fixture.bin",
    "application/octet-stream",
  ],
  [
    "/artifacts/base-server-ssr-template/server-ssr-template.wasm",
    "public/artifacts/base-server-ssr-template/server-ssr-template.wasm",
    "application/wasm",
  ],
  ["/favicon.ico", "public/favicon.svg", "image/svg+xml"],
] as const;

interface SourceFile {
  route: string;
  path: string;
  contentType: string;
  bytes: number;
  sha256: string;
  headBytesMatch: true;
}

const sourceFiles: SourceFile[] = [];
for (const [route, path, contentType] of ASSETS) {
  const diskBytes = await Deno.readFile(new URL(path, root));
  const committedBytes = await gitBytes(head, path);
  if (await sha256Hex(diskBytes) !== await sha256Hex(committedBytes)) {
    throw new Error(`${path} differs from clean HEAD bytes`);
  }
  sourceFiles.push({
    route,
    path,
    contentType,
    bytes: diskBytes.byteLength,
    sha256: await sha256Hex(diskBytes),
    headBytesMatch: true,
  });
}
const sourceByRoute = new Map(sourceFiles.map((record) => [record.route, record]));
const collectorPath = "scripts/collect-base-server-ssr-evidence.ts";
const collectorBytes = await Deno.readFile(new URL(collectorPath, root));
if (await sha256Hex(collectorBytes) !== await sha256Hex(await gitBytes(head, collectorPath))) {
  throw new Error("executed collector bytes differ from clean HEAD");
}

const fixture = generateFixture();
const fixtureAsset = await Deno.readFile(
  new URL("public/artifacts/base-server-ssr-template/fixture.bin", root),
);
if (await sha256Hex(fixture) !== await sha256Hex(fixtureAsset)) {
  throw new Error("generated fixture differs from the exact served fixture");
}
const outputManifest = JSON.parse(
  await Deno.readTextFile(
    new URL("public/artifacts/base-server-ssr-template/output-manifest.json", root),
  ),
);
const buildManifest = JSON.parse(
  await Deno.readTextFile(
    new URL("public/artifacts/base-server-ssr-template/build-manifest.json", root),
  ),
);
const packageSources: Array<{
  path: string;
  bytes: number;
  sha256: string;
  packageCommitBytesMatch: true;
}> = [];
for (
  const source of buildManifest.sources as Array<{ path: string; bytes: number; sha256: string }>
) {
  const diskBytes = await Deno.readFile(new URL(source.path, root));
  const packageBytes = await gitBytes(packageCommit, source.path);
  if (
    diskBytes.byteLength !== source.bytes || packageBytes.byteLength !== source.bytes ||
    await sha256Hex(diskBytes) !== source.sha256 || await sha256Hex(packageBytes) !== source.sha256
  ) throw new Error(`${source.path} differs from the accepted package source commit`);
  packageSources.push({ ...source, packageCommitBytesMatch: true });
}
if (
  buildManifest.sourceCommit !== packageCommit || outputManifest.responses !== RECORDS ||
  outputManifest.reference.sha256 !== registration.oracle.completeOutputSha256
) throw new Error("package manifest relationship mismatch");

const expectedByTarget = new Map<string, {
  text: string;
  counters: Record<string, number>;
  first: Uint8Array;
  last: Uint8Array;
}>();
for (const target of ["js-controlled", "wasm-linear-controlled"]) {
  const result = target === "js-controlled" ? renderJavaScript(fixture) : renderWasm(
    await instantiateSsrWasm(
      await Deno.readFile(
        new URL("public/artifacts/base-server-ssr-template/server-ssr-template.wasm", root),
      ),
    ),
    fixture,
  );
  const digest = await sha256Hex(result.output);
  const responses = parseOutput(result.output);
  if (responses.length !== RECORDS || digest !== registration.oracle.completeOutputSha256) {
    throw new Error(`${target} parent oracle mismatch`);
  }
  const text = [
    `Target: ${target}`,
    `Responses: ${responses.length}`,
    `Complete output SHA-256: ${digest}`,
    `Registration SHA-256: ${await sha256Hex(registrationBytes)}`,
    `Source commit: ${buildManifest.sourceCommit}`,
    `Counters: ${JSON.stringify(result.counters, null, 2)}`,
    "",
    `First canonical response (${responses[0].length} bytes):`,
    decoder.decode(responses[0]),
    "",
    `Last canonical response (${responses.at(-1).length} bytes):`,
    decoder.decode(responses.at(-1)),
  ].join("\n");
  expectedByTarget.set(target, {
    text,
    counters: result.counters as Record<string, number>,
    first: responses[0],
    last: responses.at(-1),
  });
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
): Promise<Array<{ pid: number; signal: string }>> {
  const signals: Array<{ pid: number; signal: string }> = [];
  if (!(await waitForOwnedExit(identities, 10_000))) {
    for (const identity of [...identities].reverse()) {
      if (await identityStillRunning(identity)) {
        Deno.kill(identity.pid, "SIGTERM");
        signals.push({ pid: identity.pid, signal: "SIGTERM" });
      }
    }
  }
  if (!(await waitForOwnedExit(identities, 5_000))) {
    for (const identity of [...identities].reverse()) {
      if (await identityStillRunning(identity)) {
        Deno.kill(identity.pid, "SIGKILL");
        signals.push({ pid: identity.pid, signal: "SIGKILL" });
      }
    }
  }
  return signals;
}

const INSTRUMENTATION = String.raw`(() => {
  const NativeWorker = globalThis.Worker;
  const mode = new URL(location.href).searchParams.get("evidence-mode") || "normal";
  const workers = [];
  const emit = (kind, detail = {}) => globalThis.__ssrEvidenceEvent(JSON.stringify({kind, detail}));
  class EvidenceWorker extends EventTarget {
    constructor(url, options) {
      super();
      this.native = new NativeWorker(url, options);
      this.index = workers.length;
      this.pending = null;
      workers.push(this);
      this.native.addEventListener("message", (event) => {
        this.dispatchEvent(new MessageEvent("message", {data: event.data}));
      });
      this.native.addEventListener("error", (event) => this.dispatchEvent(event));
      emit("worker-created", {index: this.index, url: String(url), mode});
    }
    postMessage(data, transfer) {
      emit("worker-posted", {index: this.index, data});
      if (mode === "wrong-token") {
        this.dispatchEvent(new MessageEvent("message", {
          data: {type: "complete", token: data.token + 1, text: "WRONG_TOKEN_SENTINEL"},
        }));
        emit("wrong-token-dispatched", {index: this.index, token: data.token + 1});
        setTimeout(() => this.native.postMessage(data, transfer || []), 500);
      } else if (["stale", "cancel", "timeout", "pagehide"].includes(mode)) {
        this.pending = {data, transfer: transfer || []};
        emit("worker-held", {index: this.index});
      } else {
        this.native.postMessage(data, transfer || []);
      }
    }
    terminate() {
      emit("worker-terminated", {index: this.index});
      this.native.terminate();
    }
  }
  Object.defineProperty(globalThis, "Worker", {value: EvidenceWorker, configurable: false});
  Object.defineProperty(globalThis, "__ssrEvidenceControl", {
    value: Object.freeze({
      dispatch(index, data) {
        workers[index].dispatchEvent(new MessageEvent("message", {data}));
        emit("synthetic-message-dispatched", {index, data});
      },
      release(index) {
        const pending = workers[index].pending;
        if (!pending) throw new Error("worker has no held message");
        workers[index].pending = null;
        workers[index].native.postMessage(pending.data, pending.transfer);
        emit("worker-released", {index});
      },
      count() { return workers.length; },
    }),
    configurable: false,
  });
  emit("instrumentation-ready", {mode});
})();`;
const instrumentationBytes = encoder.encode(INSTRUMENTATION);

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

interface PageState {
  heading: string;
  status: string;
  output: string;
  bodyText: string;
  startDisabled: boolean;
  cancelDisabled: boolean;
  target: string;
}

async function pageState(client: CdpClient, sessionId: string): Promise<PageState> {
  const evaluated = await client.send("Runtime.evaluate", {
    expression:
      `(() => ({heading:document.querySelector("h1").textContent.trim(),status:document.querySelector("#status").textContent.trim(),output:document.querySelector("#output").textContent,bodyText:document.body.innerText,startDisabled:document.querySelector("#start").disabled,cancelDisabled:document.querySelector("#cancel").disabled,target:document.querySelector("#target").value}))()`,
    returnByValue: true,
  }, sessionId);
  return (evaluated.result as { value: PageState }).value;
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

async function selectTarget(
  client: CdpClient,
  sessionId: string,
  target: string,
): Promise<void> {
  await client.send("Runtime.evaluate", {
    expression: `(() => { const node=document.querySelector("#target"); node.value=${
      JSON.stringify(target)
    }; node.dispatchEvent(new Event("change", {bubbles:true})); })()`,
  }, sessionId);
}

async function evaluate(
  client: CdpClient,
  sessionId: string,
  expression: string,
): Promise<unknown> {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId);
  return (result.result as { value: unknown }).value;
}

function headerEntries(value: Record<string, unknown>): Array<{ name: string; value: string }> {
  return Object.entries(value).map(([name, headerValue]) => ({
    name: name.toLowerCase(),
    value: String(headerValue),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

const serverPort = unusedPort();
const debuggerPort = unusedPort();
if (serverPort === debuggerPort) throw new Error("server and debugger ports collided");
const origin = `http://127.0.0.1:${serverPort}`;
const serverArguments = [
  "run",
  "--allow-env=PORT,HOST,SERVER_MODE",
  "--allow-net=127.0.0.1",
  "--allow-read=.",
  "deploy.ts",
];
const server = new Deno.Command(Deno.execPath(), {
  cwd: root,
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
let browserProcess: Deno.ChildProcess | null = null;
let browserStatusPromise: Promise<Deno.CommandStatus> | null = null;
let emergencyClient: CdpClient | null = null;
let collectionComplete = false;

try {
  await waitFor(`${origin}/healthz`);

  for (const source of sourceFiles) {
    const response = await fetch(`${origin}${source.route}`, {
      cache: "no-store",
      redirect: "error",
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (
      response.status !== 200 ||
      !response.headers.get("content-type")?.startsWith(source.contentType) ||
      bytes.byteLength !== source.bytes || await sha256Hex(bytes) !== source.sha256
    ) throw new Error(`loopback preflight bytes mismatch: ${source.route}`);
  }

  await Deno.mkdir(options.outputDir, { recursive: false });
  const screenshotDir = `${options.outputDir}/screenshots`;
  await Deno.mkdir(screenshotDir);
  profilePath = await Deno.makeTempDir({ prefix: "wasm-base-server-ssr-chrome-" });
  const profileInitiallyEmpty = (await Array.fromAsync(Deno.readDir(profilePath))).length === 0;
  if (!profileInitiallyEmpty) throw new Error("fresh Chrome profile was not initially empty");
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
  browserProcess = new Deno.Command(executable, {
    args: launchArguments,
    stdout: "null",
    stderr: "null",
  }).spawn();
  browserStatusPromise = browserProcess.status;
  const browserPid = browserProcess.pid;

  const scenarioDefinitions = [
    { id: "complete-js", mode: "normal", targets: ["js-controlled"] },
    { id: "complete-wasm", mode: "normal", targets: ["wasm-linear-controlled"] },
    {
      id: "restart-js-to-wasm",
      mode: "normal",
      targets: ["js-controlled", "wasm-linear-controlled"],
    },
    { id: "wrong-token", mode: "wrong-token", targets: ["js-controlled"] },
    {
      id: "stale-after-restart",
      mode: "stale",
      targets: ["js-controlled", "wasm-linear-controlled"],
    },
    { id: "cancel", mode: "cancel", targets: ["js-controlled"] },
    { id: "timeout", mode: "timeout", targets: ["js-controlled"] },
    { id: "pagehide", mode: "pagehide", targets: ["js-controlled"] },
  ] as const;

  const versionResponse = await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`);
  const discovery = await versionResponse.json();
  const webSocketUrl = new URL(discovery.webSocketDebuggerUrl);
  if (
    webSocketUrl.protocol !== "ws:" || webSocketUrl.hostname !== "127.0.0.1" ||
    Number(webSocketUrl.port) !== debuggerPort || webSocketUrl.search || webSocketUrl.hash
  ) throw new Error("Chrome CDP endpoint escaped the owned loopback port");
  const client = new CdpClient(webSocketUrl.href);
  emergencyClient = client;
  await client.ready();
  const browserVersion = await client.send("Browser.getVersion");
  if (browserVersion.product !== EXPECTED_PRODUCT) {
    throw new Error(`unexpected browser ${browserVersion.product}`);
  }
  const observedProcessMap = new Map<number, ProcessIdentity>();
  const observeBrowserProcesses = async (): Promise<void> => {
    for (const identity of await ownedProcesses(browserPid)) {
      const prior = observedProcessMap.get(identity.pid);
      if (
        prior && (prior.startTimeTicks !== identity.startTimeTicks ||
          prior.executable !== identity.executable)
      ) throw new Error(`owned Chrome PID ${identity.pid} changed identity during collection`);
      observedProcessMap.set(identity.pid, identity);
    }
  };
  await observeBrowserProcesses();

  const scenarios: Array<Record<string, unknown>> = [];
  for (const definition of scenarioDefinitions) {
    const created = await client.send("Target.createTarget", { url: "about:blank" });
    const targetId = String(created.targetId);
    const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = String(attached.sessionId);
    const observedSessions = new Set([sessionId]);
    const attachTasks: Promise<void>[] = [];
    const consoleMessages: Array<Record<string, unknown>> = [];
    const exceptions: Array<Record<string, unknown>> = [];
    const lifecycleEvents: Array<Record<string, unknown>> = [];
    const requests = new Map<string, Record<string, unknown>>();
    const responseBodyTasks: Promise<void>[] = [];
    const responseBodyErrors: Error[] = [];
    const removers = [
      client.on("Target.attachedToTarget", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        const targetInfo = params.targetInfo as Record<string, unknown>;
        if (targetInfo.type !== "worker") return;
        const workerSession = String(params.sessionId);
        observedSessions.add(workerSession);
        attachTasks.push((async () => {
          await client.send("Network.enable", {}, workerSession);
          await client.send("Network.setCacheDisabled", { cacheDisabled: true }, workerSession);
          await client.send("Runtime.runIfWaitingForDebugger", {}, workerSession);
        })());
      }),
      client.on("Runtime.bindingCalled", (params, eventSession) => {
        if (eventSession !== sessionId || params.name !== "__ssrEvidenceEvent") return;
        lifecycleEvents.push(JSON.parse(String(params.payload)));
      }),
      client.on("Runtime.consoleAPICalled", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        consoleMessages.push({
          type: String(params.type),
          arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((argument) =>
            String(argument.value ?? argument.description ?? argument.type)
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
        const key = `${eventSession}:${params.requestId}`;
        requests.set(key, {
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
          bodyBytes: null,
          bodySha256: null,
          sourcePath: null,
        });
      }),
      client.on("Network.responseReceived", (params, eventSession) => {
        if (!eventSession || !observedSessions.has(eventSession)) return;
        const key = `${eventSession}:${params.requestId}`;
        const record = requests.get(key);
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
        if (!eventSession || !observedSessions.has(eventSession)) return;
        const record = requests.get(`${eventSession}:${params.requestId}`);
        if (record) Object.assign(record, { failed: true, errorText: String(params.errorText) });
      }),
      client.on("Network.loadingFinished", (params, eventSession) => {
        if (!eventSession || !observedSessions.has(eventSession)) return;
        const record = requests.get(`${eventSession}:${params.requestId}`);
        if (!record) return;
        responseBodyTasks.push(
          (async () => {
            const path = new URL(String(record.url)).pathname;
            const expected = sourceByRoute.get(path);
            if (!expected) throw new Error(`${definition.id} requested unbound route ${path}`);
            const body = await client.send(
              "Network.getResponseBody",
              { requestId: String(params.requestId) },
              eventSession,
              10_000,
            );
            const bytes = body.base64Encoded
              ? Uint8Array.from(atob(String(body.body)), (character) => character.charCodeAt(0))
              : encoder.encode(String(body.body));
            if (bytes.byteLength !== expected.bytes || await sha256Hex(bytes) !== expected.sha256) {
              throw new Error(`${definition.id} raw response differs from clean HEAD: ${path}`);
            }
            Object.assign(record, {
              bodyBytes: bytes.byteLength,
              bodySha256: expected.sha256,
              sourcePath: expected.path,
            });
          })().catch((error) => {
            responseBodyErrors.push(error instanceof Error ? error : new Error(String(error)));
          }),
        );
      }),
    ];
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
      client.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId),
      client.send("Accessibility.enable", {}, sessionId),
      client.send("Runtime.addBinding", { name: "__ssrEvidenceEvent" }, sessionId),
      client.send("Page.addScriptToEvaluateOnNewDocument", { source: INSTRUMENTATION }, sessionId),
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
    await client.send("Page.navigate", {
      url: `${origin}${ROUTE}?evidence-mode=${definition.mode}`,
    }, sessionId);
    await loaded;
    let state = await waitForState(client, sessionId, (value) => value.status === "Ready.");
    if (state.heading !== "Render 1,000 catalog responses") {
      throw new Error(`${definition.id} heading disagrees with the accepted 1,000-response route`);
    }

    const lifecycleAssertions: string[] = [];
    let renderedTarget: string | null = null;
    if (definition.id === "restart-js-to-wasm") {
      for (const target of definition.targets) {
        await selectTarget(client, sessionId, target);
        await click(client, sessionId, "#start");
        state = await waitForState(client, sessionId, (value) => value.status === "Complete.");
        if (state.output !== expectedByTarget.get(target)!.text) {
          throw new Error(`${definition.id}/${target} exact result text mismatch`);
        }
      }
      renderedTarget = definition.targets.at(-1)!;
      lifecycleAssertions.push("two sequential starts created two fresh workers");
    } else if (definition.id === "stale-after-restart") {
      await selectTarget(client, sessionId, definition.targets[0]);
      await click(client, sessionId, "#start");
      await waitForState(client, sessionId, (value) => value.status.startsWith("Running "));
      await click(client, sessionId, "#cancel");
      await waitForState(client, sessionId, (value) => value.status.startsWith("Cancelled."));
      await selectTarget(client, sessionId, definition.targets[1]);
      await click(client, sessionId, "#start");
      await waitForState(client, sessionId, (value) => value.status.startsWith("Running "));
      await evaluate(
        client,
        sessionId,
        `__ssrEvidenceControl.dispatch(0, ${
          JSON.stringify({ type: "complete", token: 1, text: "STALE_RESULT_SENTINEL" })
        })`,
      );
      state = await pageState(client, sessionId);
      if (!state.status.startsWith("Running ") || state.output.includes("STALE_RESULT_SENTINEL")) {
        throw new Error("stale first-worker message mutated the restarted run");
      }
      await evaluate(client, sessionId, "__ssrEvidenceControl.release(1)");
      state = await waitForState(client, sessionId, (value) => value.status === "Complete.");
      renderedTarget = definition.targets[1];
      if (state.output !== expectedByTarget.get(renderedTarget)!.text) {
        throw new Error("restarted Wasm exact result text mismatch");
      }
      lifecycleAssertions.push("terminated first-worker message was ignored after restart");
    } else {
      const target = definition.targets[0];
      await selectTarget(client, sessionId, target);
      await click(client, sessionId, "#start");
      if (definition.mode !== "normal") {
        await waitForState(client, sessionId, (value) => value.status.startsWith("Running "));
      }
      if (definition.id === "wrong-token") {
        const deadline = Date.now() + 2_000;
        while (
          !lifecycleEvents.some((event) => event.kind === "wrong-token-dispatched") &&
          Date.now() < deadline
        ) await new Promise((resolve) => setTimeout(resolve, 10));
        const afterWrongToken = await pageState(client, sessionId);
        if (
          !afterWrongToken.status.startsWith("Running ") ||
          afterWrongToken.output.includes("WRONG_TOKEN_SENTINEL")
        ) throw new Error("wrong-token worker message mutated visible state");
        lifecycleAssertions.push("wrong-token completion was ignored");
      } else if (definition.id === "cancel") {
        await click(client, sessionId, "#cancel");
        state = await waitForState(
          client,
          sessionId,
          (value) => value.status === "Cancelled. No result was retained.",
        );
        if (state.output !== "Cancelled.") throw new Error("cancel retained an unexpected result");
        lifecycleAssertions.push("Cancel terminated the exact held worker");
      } else if (definition.id === "timeout") {
        state = await waitForState(
          client,
          sessionId,
          (value) => value.status === "Stopped: the 30 second exact-run timeout expired.",
          32_000,
        );
        if (state.output !== "") throw new Error("timeout retained a result");
        lifecycleAssertions.push("30 second timeout terminated the exact held worker");
      } else if (definition.id === "pagehide") {
        lifecycleAssertions.push("pagehide terminated the exact held worker");
      }
      if (["complete-js", "complete-wasm", "wrong-token"].includes(definition.id)) {
        state = await waitForState(client, sessionId, (value) => value.status === "Complete.");
        renderedTarget = target;
        if (state.output !== expectedByTarget.get(target)!.text) {
          throw new Error(`${definition.id} exact result text mismatch`);
        }
      }
    }

    const axTree = await client.send("Accessibility.getFullAXTree", {}, sessionId, 10_000);
    const axNodes = ((axTree.nodes as Array<Record<string, unknown>>) ?? []).map((node) => ({
      role: String((node.role as Record<string, unknown> | undefined)?.value ?? ""),
      name: String((node.name as Record<string, unknown> | undefined)?.value ?? ""),
      ignored: Boolean(node.ignored),
    })).filter((node) => !node.ignored && node.role && node.name);
    for (
      const required of [
        ["heading", "Render 1,000 catalog responses"],
        ["combobox", "Controlled target"],
        ["button", "Start exact 1,000-response run"],
        ["button", "Cancel"],
        ["status", ""],
      ]
    ) {
      if (!axNodes.some((node) => node.role === required[0] && node.name.includes(required[1]))) {
        throw new Error(`${definition.id} accessibility node missing: ${required.join("/")}`);
      }
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
      (character) => character.charCodeAt(0),
    );
    if (
      screenshotBytes.byteLength < 8 ||
      ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => screenshotBytes[index] === value)
    ) throw new Error(`${definition.id} screenshot is not a PNG`);
    const screenshotRelativePath = `screenshots/${definition.id}.png`;
    await Deno.writeFile(`${options.outputDir}/${screenshotRelativePath}`, screenshotBytes);

    if (definition.id === "pagehide") {
      await client.send("Page.navigate", { url: "about:blank" }, sessionId);
      const deadline = Date.now() + 2_000;
      while (
        !lifecycleEvents.some((event) =>
          event.kind === "worker-terminated" &&
          (event.detail as Record<string, unknown>).index === 0
        ) && Date.now() < deadline
      ) await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await Promise.all(attachTasks);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await Promise.all(responseBodyTasks);
    if (responseBodyErrors.length) throw responseBodyErrors[0];

    for (const request of requests.values()) {
      if (request.failed || request.status !== 200) {
        throw new Error(`${definition.id} failed network request: ${JSON.stringify(request)}`);
      }
      if (
        request.bodyBytes === null || request.bodySha256 === null || request.sourcePath === null
      ) {
        throw new Error(`${definition.id} omitted exact raw response bytes: ${request.url}`);
      }
    }
    if (exceptions.length || consoleMessages.some((entry) => entry.type === "error")) {
      throw new Error(`${definition.id} produced a console error or exception`);
    }
    const workerTerminations = lifecycleEvents.filter((event) =>
      event.kind === "worker-terminated"
    );
    const expectedTerminations = definition.targets.length;
    if (workerTerminations.length !== expectedTerminations) {
      throw new Error(
        `${definition.id} terminated ${workerTerminations.length}/${expectedTerminations} workers`,
      );
    }

    const expected = renderedTarget ? expectedByTarget.get(renderedTarget)! : null;
    scenarios.push({
      id: definition.id,
      mode: definition.mode,
      targetSequence: [...definition.targets],
      finalState: state,
      routeRender: expected && renderedTarget
        ? {
          target: renderedTarget,
          responses: RECORDS,
          completeOutputSha256: registration.oracle.completeOutputSha256,
          completeOutputBytes: registration.oracle.bytes,
          counters: expected.counters,
          firstResponse: {
            bytes: expected.first.byteLength,
            sha256: await sha256Hex(expected.first),
          },
          lastResponse: {
            bytes: expected.last.byteLength,
            sha256: await sha256Hex(expected.last),
          },
          displayedResultText: state.output,
          displayedResultTextSha256: await sha256Hex(encoder.encode(state.output)),
          documentBodyTextSha256: await sha256Hex(encoder.encode(state.bodyText)),
        }
        : null,
      lifecycle: { events: lifecycleEvents, assertions: lifecycleAssertions },
      console: consoleMessages,
      exceptions,
      network: [...requests.values()],
      accessibility: {
        inspectedBy: "Accessibility.getFullAXTree",
        nodes: axNodes,
        assertions: [
          "named level-one heading present",
          "named target combobox present",
          "named Start and Cancel buttons present",
          "live status role present",
        ],
      },
      screenshot: {
        path: screenshotRelativePath,
        bytes: screenshotBytes.byteLength,
        sha256: await sha256Hex(screenshotBytes),
      },
    });
    for (const remove of removers) remove();
    await client.send("Target.closeTarget", { targetId });
    await observeBrowserProcesses();
  }

  await observeBrowserProcesses();
  const observedProcesses = [...observedProcessMap.values()].sort((a, b) => a.pid - b.pid);
  const browserLauncher = observedProcesses.find((identity) => identity.pid === browserPid);
  if (!browserLauncher) throw new Error("owned Chrome launcher disappeared before cleanup");
  await client.send("Browser.close");
  client.close();
  const browserSignals = await terminateOwned(observedProcesses);
  const browserProcessesAbsent = await waitForOwnedExit(observedProcesses, 5_000);
  const browserExit = await browserStatusPromise;
  if (!browserProcessesAbsent) throw new Error("owned Chrome processes survived exact cleanup");
  await Deno.remove(profilePath, { recursive: true });
  let profileAbsent = false;
  try {
    await Deno.lstat(profilePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) profileAbsent = true;
    else throw error;
  }
  if (!profileAbsent) throw new Error("owned Chrome profile survived cleanup");

  if (await identityStillRunning(serverLauncher)) Deno.kill(server.pid, "SIGTERM");
  let serverExit = await Promise.race([
    serverStatusPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
  ]);
  let serverSignal = "SIGTERM";
  if (serverExit === null && await identityStillRunning(serverLauncher)) {
    Deno.kill(server.pid, "SIGKILL");
    serverSignal = "SIGKILL";
    serverExit = await serverStatusPromise;
  }
  const serverAbsent = !(await identityStillRunning(serverLauncher));
  if (!serverAbsent || serverExit === null) {
    throw new Error("owned evidence server survived cleanup");
  }

  const evidence = {
    schemaVersion: 1,
    evidenceId: EVIDENCE_ID,
    collectedAt: new Date().toISOString(),
    source: {
      head,
      headTree,
      clean: true,
      packageCommit,
      collector: {
        path: collectorPath,
        bytes: collectorBytes.byteLength,
        sha256: await sha256Hex(collectorBytes),
        headBytesMatch: true,
      },
      packageSources,
      files: sourceFiles,
    },
    collectionCommand:
      `deno run -A scripts/collect-base-server-ssr-evidence.ts --chrome=${options.chrome} --output-dir=${options.outputDir}`,
    browser: {
      product: String(browserVersion.product),
      revision: String(browserVersion.revision),
      userAgent: String(browserVersion.userAgent),
      jsVersion: String(browserVersion.jsVersion),
      executable: {
        path: executable,
        bytes: executableBytes.byteLength,
        sha256: executableSha256,
      },
      launchArguments,
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
      launcherPid: server.pid,
      preflight: sourceFiles.map(({ route, bytes, sha256 }) => ({ route, bytes, sha256 })),
    },
    instrumentation: {
      injectionMethod: "Page.addScriptToEvaluateOnNewDocument",
      sourceBytes: instrumentationBytes.byteLength,
      sourceSha256: await sha256Hex(instrumentationBytes),
      purpose: "observe and deterministically exercise token and owned-worker lifecycle guards",
    },
    scenarios,
    cleanup: {
      browser: {
        launcher: browserLauncher,
        observedProcesses,
        requested: "Browser.close",
        signals: browserSignals,
        exit: browserExit,
        processesAbsent: browserProcessesAbsent,
      },
      profile: {
        path: profilePath,
        initiallyEmpty: profileInitiallyEmpty,
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
    await Deno.readTextFile(new URL("schemas/base-server-ssr-browser-evidence.schema.json", root)),
  );
  type Validator = ((value: unknown) => boolean) & { errors?: unknown };
  type AjvConstructor = new (options?: Record<string, unknown>) => {
    compile: (schema: unknown) => Validator;
  };
  const Ajv2020 = Ajv2020Module as unknown as AjvConstructor;
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  if (!validate(evidence)) {
    throw new Error(`evidence schema failure: ${JSON.stringify(validate.errors)}`);
  }
  await Deno.writeTextFile(
    `${options.outputDir}/evidence.v1.json`,
    `${canonicalize(evidence)}\n`,
    { createNew: true },
  );
  collectionComplete = true;
  console.log(`server SSR browser evidence: ${scenarios.length} scenarios; owned cleanup exact`);
} finally {
  if (!collectionComplete) {
    try {
      await emergencyClient?.send("Browser.close");
    } catch {
      // Continue with exact identity-bound cleanup.
    }
    emergencyClient?.close();
    if (browserProcess) {
      const failedBrowserProcesses = await ownedProcesses(browserProcess.pid);
      await terminateOwned(failedBrowserProcesses);
      await browserStatusPromise?.catch(() => {});
    }
    if (await identityStillRunning(serverLauncher)) Deno.kill(server.pid, "SIGTERM");
    await Promise.race([
      serverStatusPromise.catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    if (await identityStillRunning(serverLauncher)) Deno.kill(server.pid, "SIGKILL");
    await serverStatusPromise.catch(() => {});
    if (profilePath) await Deno.remove(profilePath, { recursive: true }).catch(() => {});
    await Deno.remove(options.outputDir, { recursive: true }).catch(() => {});
  }
}

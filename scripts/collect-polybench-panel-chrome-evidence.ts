import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

export const EXPECTED_CHROME_PRODUCT = "Chrome/150.0.7871.24";
export const KERNELS = ["gemm", "cholesky", "stencil", "jacobi2d"] as const;
export const TARGETS = ["javascript-controlled", "linear-wasm-controlled"] as const;
export const EXPECTED_RAW_RESULT_SHA256 = {
  "javascript-controlled": "67aab29943fb3ae6c82b1f225f946f8f0139697fbb45dba68574cc212972fde0",
  "linear-wasm-controlled": "8e08504106e7b9b5957a955baea3757fd1e666732a821d0a1480004678f337b9",
} as const;
export const SCENARIO_IDS = [
  "execute-javascript-all",
  "execute-wasm-all",
  "lifecycle-wrong-token",
  "lifecycle-stale-message",
  "lifecycle-restart",
  "lifecycle-cancel",
  "lifecycle-timeout",
  "lifecycle-pagehide",
] as const;

const root = new URL("../", import.meta.url);
const route = "/benchmarks/numeric.polybench-panel.v1/";
const outputRoot = new URL(
  "../evidence/base/numeric-polybench-panel/chrome-acceptance/",
  import.meta.url,
);
const executionPaths = [
  "public/benchmarks/numeric.polybench-panel.v1/index.html",
  "public/polybench-panel-demo.js",
  "public/polybench-panel-worker.js",
  "benchmarks/base/numeric-polybench-panel/workload.js",
  "public/artifacts/numeric-polybench-panel/polybench-panel.wasm",
  "public/artifacts/numeric-polybench-panel/build-manifest.json",
  "public/artifacts/numeric-polybench-panel/outputs/gemm.reference.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/gemm.javascript-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/gemm.linear-wasm-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/cholesky.reference.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/cholesky.javascript-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/cholesky.linear-wasm-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/stencil.reference.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/stencil.javascript-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/stencil.linear-wasm-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/jacobi2d.reference.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/jacobi2d.javascript-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/jacobi2d.linear-wasm-controlled.f64le",
  "evidence/base/numeric-polybench-panel/correctness-record.json",
  "scripts/collect-polybench-panel-chrome-evidence.ts",
  "schemas/polybench-panel-chrome-evidence.schema.json",
  "tests/base/polybench-panel-chrome-collector.test.ts",
] as const;

type Json = Record<string, unknown>;
type ProcessIdentity = {
  pid: number;
  parentPid: number;
  startTimeTicks: string;
  executable: string;
  cgroup: string;
};

async function commandBytes(command: string, args: string[]): Promise<Uint8Array> {
  const result = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!result.success) throw new Error(new TextDecoder().decode(result.stderr));
  return result.stdout;
}

async function commandText(command: string, args: string[]): Promise<string> {
  return new TextDecoder().decode(await commandBytes(command, args)).trim();
}

function assertExact(actual: unknown, expected: unknown, label: string): void {
  if (canonicalize(actual) !== canonicalize(expected)) throw new Error(`${label} mismatch`);
}

export function expectedRawResultText(
  target: (typeof TARGETS)[number],
  manifest: Json,
): string {
  const outputs = manifest.outputs as Json;
  return JSON.stringify(
    KERNELS.map((kernel) => {
      const record = ((outputs[kernel] as Json).targets as Json)[target] as Json;
      return {
        kernel,
        target,
        outputSha256: (record.artifact as Json).sha256,
        comparison: record.comparison,
        structuralOracle: record.structuralOracle,
        checkpoints: record.checkpoints,
        counters: record.counters,
      };
    }),
    null,
    2,
  );
}

export function verifyExecutionResults(
  value: unknown,
  target: (typeof TARGETS)[number],
  manifest: Json,
): Json[] {
  if (!Array.isArray(value) || value.length !== KERNELS.length) {
    throw new Error(`${target} did not return all four kernels`);
  }
  const outputs = manifest.outputs as Json;
  return KERNELS.map((kernel, index) => {
    const result = value[index] as Json;
    if (!result || Object.getPrototypeOf(result) !== Object.prototype) {
      throw new Error(`${target}/${kernel} result framing invalid`);
    }
    const keys = Object.keys(result).sort();
    assertExact(
      keys,
      [
        "checkpoints",
        "comparison",
        "counters",
        "kernel",
        "outputSha256",
        "structuralOracle",
        "target",
      ].sort(),
      `${target}/${kernel} result keys`,
    );
    if (result.kernel !== kernel || result.target !== target) {
      throw new Error(`${target}/${kernel} identity mismatch`);
    }
    const targetRecord = ((outputs[kernel] as Json).targets as Json)[target] as Json;
    const artifact = targetRecord.artifact as Json;
    if (result.outputSha256 !== artifact.sha256) {
      throw new Error(`${target}/${kernel} complete f64 output hash mismatch`);
    }
    for (const field of ["comparison", "structuralOracle", "checkpoints", "counters"]) {
      assertExact(result[field], targetRecord[field], `${target}/${kernel} ${field}`);
    }
    return { ...result, completeOutputArtifact: artifact };
  });
}

export function lifecycleInitScript(): string {
  return `(() => {
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    globalThis.__acceptanceWorkers = [];
    class AcceptanceWorker {
      constructor(url, options) {
        this.url = String(url); this.options = options; this.terminated = false;
        this.onmessage = null; this.onerror = null; this.posted = null;
        globalThis.__acceptanceWorkers.push(this);
      }
      postMessage(value) { this.posted = structuredClone(value); }
      terminate() { this.terminated = true; }
      emit(value) { this.onmessage?.({data: structuredClone(value)}); }
      fail(message) { this.onerror?.({message}); }
    }
    globalThis.Worker = AcceptanceWorker;
    globalThis.setTimeout = (callback, delay, ...args) =>
      nativeSetTimeout(callback, delay === 30000 ? 80 : delay, ...args);
  })()`;
}

export function lifecycleExpression(id: string): string {
  const start =
    `document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`;
  const state =
    `({status:document.querySelector('#status').textContent.trim(),output:document.querySelector('#output').textContent.trim(),startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled,progressValue:document.querySelector('#progress').getAttribute('value'),workers:__acceptanceWorkers.map(w=>({terminated:w.terminated,posted:w.posted}))})`;
  if (id === "lifecycle-wrong-token") {
    return `(async()=>{${start};const w=__acceptanceWorkers[0];w.emit({token:w.posted.token+1,type:'complete',results:[]});await new Promise(r=>setTimeout(r,10));const ignored=${state};document.querySelector('#cancel').click();return {assertion:'wrong token ignored',ignored,final:${state}}})()`;
  }
  if (id === "lifecycle-stale-message") {
    return `(async()=>{${start};const stale=__acceptanceWorkers[0];${start};const active=__acceptanceWorkers[1];stale.emit({token:stale.posted.token,type:'complete',results:[]});await new Promise(r=>setTimeout(r,10));const ignored=${state};active.emit({token:active.posted.token,type:'complete',results:[]});await new Promise(r=>setTimeout(r,10));return {assertion:'stale worker message ignored',ignored,final:${state}}})()`;
  }
  if (id === "lifecycle-restart") {
    return `(async()=>{${start};${start};await new Promise(r=>setTimeout(r,10));const restarted=${state};document.querySelector('#cancel').click();return {assertion:'restart terminates prior worker',restarted,final:${state}}})()`;
  }
  if (id === "lifecycle-cancel") {
    return `(async()=>{${start};document.querySelector('#cancel').click();await new Promise(r=>setTimeout(r,10));return {assertion:'cancel terminates active worker',final:${state}}})()`;
  }
  if (id === "lifecycle-timeout") {
    return `(async()=>{${start};await new Promise(r=>setTimeout(r,120));return {assertion:'30-second bound fired under accelerated acceptance clock',final:${state}}})()`;
  }
  if (id === "lifecycle-pagehide") {
    return `(async()=>{${start};dispatchEvent(new Event('pagehide'));await new Promise(r=>setTimeout(r,10));return {assertion:'pagehide terminates active worker',final:${state}}})()`;
  }
  throw new Error(`unknown lifecycle scenario ${id}`);
}

export function verifyLifecycle(id: string, value: Json): void {
  const final = value.final as Json;
  const workers = (final.workers as Json[]) ?? [];
  if (!workers.length || workers.some((worker) => worker.terminated !== true)) {
    throw new Error(`${id} did not terminate every created worker`);
  }
  const expectedTokens = id === "lifecycle-stale-message" || id === "lifecycle-restart"
    ? [2, 4]
    : [2];
  const workerTokens = workers.map((worker) => (worker.posted as Json)?.token);
  if (canonicalize(workerTokens) !== canonicalize(expectedTokens)) {
    throw new Error(`${id} worker generation transition mismatch`);
  }
  if (
    workers.some((worker) => {
      const posted = worker.posted as Json;
      return posted?.target !== "javascript" || posted?.kernel !== "all";
    })
  ) throw new Error(`${id} worker request identity mismatch`);
  if (final.startDisabled !== false || final.cancelDisabled !== true) {
    throw new Error(`${id} did not restore controls`);
  }
  const status = String(final.status);
  if (id === "lifecycle-cancel" && status !== "Cancelled. The worker was terminated.") {
    throw new Error(`${id} status mismatch`);
  }
  if (id === "lifecycle-timeout" && status !== "Stopped after the 30-second bound.") {
    throw new Error(`${id} status mismatch`);
  }
  if (id === "lifecycle-pagehide" && status !== "Running exact registered work…") {
    throw new Error(`${id} unexpectedly rewrote status`);
  }
  if (id === "lifecycle-wrong-token") {
    const ignored = value.ignored as Json;
    const ignoredWorkers = ignored.workers as Json[];
    if (
      ignored.status !== "Running exact registered work…" || ignored.output !== "No result yet." ||
      (ignoredWorkers[0].posted as Json).token !== 2
    ) {
      throw new Error(`${id} mutated UI or worker identity for a wrong token`);
    }
  }
  if (id === "lifecycle-stale-message") {
    const ignored = value.ignored as Json;
    const ignoredWorkers = ignored.workers as Json[];
    if (
      ignored.status !== "Running exact registered work…" || ignored.output !== "No result yet." ||
      (ignoredWorkers[0].posted as Json).token !== 2 ||
      (ignoredWorkers[1].posted as Json).token !== 4
    ) {
      throw new Error(`${id} mutated UI or reused a stale worker token`);
    }
    if (status !== "Complete. Every reported element passed the registered oracle.") {
      throw new Error(`${id} active replacement did not complete`);
    }
  }
  if (id === "lifecycle-restart") {
    const restarted = value.restarted as Json;
    const restartWorkers = restarted.workers as Json[];
    if (
      restartWorkers.length !== 2 || restartWorkers[0].terminated !== true ||
      restartWorkers[1].terminated || (restartWorkers[0].posted as Json).token !== 2 ||
      (restartWorkers[1].posted as Json).token !== 4
    ) {
      throw new Error(`${id} replacement identity mismatch`);
    }
  }
}

function unusedPort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

async function waitFor(url: string, timeoutMs = 10_000): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let detail = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "error" });
      if (response.ok) return response;
      detail = `HTTP ${response.status}`;
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${url} unavailable: ${detail}`);
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
      cgroup: (await Deno.readTextFile(`/proc/${pid}/cgroup`)).trim(),
    };
  } catch {
    return null;
  }
}

async function ownedProcesses(
  rootIdentity: ProcessIdentity,
): Promise<ProcessIdentity[]> {
  if (!(await identityStillRunning(rootIdentity))) return [];
  const identities: ProcessIdentity[] = [];
  for await (const entry of Deno.readDir("/proc")) {
    if (!entry.isDirectory || !/^\d+$/.test(entry.name)) continue;
    const identity = await processIdentity(Number(entry.name));
    if (identity) identities.push(identity);
  }
  const owned = new Set([rootIdentity.pid]);
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
    current.executable === identity.executable && current.cgroup === identity.cgroup;
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
    expression: `(()=>{const n=document.querySelector(${
      JSON.stringify(selector)
    });const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:n.disabled}})()`,
    returnByValue: true,
  }, sessionId);
  const value = (evaluated.result as { value: { x: number; y: number; disabled: boolean } }).value;
  if (value.disabled) throw new Error(`${selector} disabled`);
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

async function pageState(client: CdpClient, sessionId: string): Promise<Json> {
  const response = await client.send("Runtime.evaluate", {
    expression:
      `(()=>({status:document.querySelector('#status').textContent.trim(),output:document.querySelector('#output').textContent.trim(),startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled,progressValue:document.querySelector('#progress').value,progressMax:document.querySelector('#progress').max}))()`,
    returnByValue: true,
  }, sessionId);
  return (response.result as { value: Json }).value;
}

async function waitForState(
  client: CdpClient,
  sessionId: string,
  predicate: (state: Json) => boolean,
  timeoutMs = 35_000,
): Promise<Json> {
  const deadline = Date.now() + timeoutMs;
  let value: Json = {};
  while (Date.now() < deadline) {
    value = await pageState(client, sessionId);
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`page state timeout: ${JSON.stringify(value)}`);
}

async function writeArtifact(path: string, bytes: Uint8Array): Promise<Json> {
  const url = new URL(path, outputRoot);
  await Deno.mkdir(new URL("./", url), { recursive: true });
  await Deno.writeFile(url, bytes);
  return {
    path: `evidence/base/numeric-polybench-panel/chrome-acceptance/${path}`,
    bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
  };
}

function normalizedConsole(params: Json): Json {
  return {
    type: String(params.type),
    arguments: ((params.args as Json[]) ?? []).map((arg) =>
      String(arg.value ?? arg.description ?? arg.type)
    ),
  };
}

async function sourceDescriptor(commit: string, path: string): Promise<Json> {
  const committed = await commandBytes("git", ["show", `${commit}:${path}`]);
  const working = await Deno.readFile(new URL(path, root));
  if (await sha256Hex(committed) !== await sha256Hex(working)) {
    throw new Error(`${path} differs from ${commit}`);
  }
  return { path, bytes: working.byteLength, sha256: await sha256Hex(working) };
}

async function collect(): Promise<void> {
  const sourceCommit = Deno.args.find((arg) => arg.startsWith("--source-commit="))?.slice(16) ?? "";
  const chromeArgument = Deno.args.find((arg) => arg.startsWith("--chrome="))?.slice(9) ?? "";
  if (!/^[a-f0-9]{40}$/.test(sourceCommit) || !chromeArgument || Deno.args.length !== 2) {
    throw new Error(
      "usage: collect-polybench-panel-chrome-evidence.ts --source-commit=<40 hex> --chrome=<path>",
    );
  }
  const head = await commandText("git", ["rev-parse", "HEAD"]);
  if (head !== sourceCommit) throw new Error("source commit must equal HEAD");
  const status = await commandText("git", ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status !== "") {
    throw new Error(`source worktree must be exactly clean before collection: ${status}`);
  }
  const tree = await commandText("git", ["rev-parse", `${sourceCommit}^{tree}`]);
  const sourceFiles = await Promise.all(executionPaths.map((path) => sourceDescriptor(head, path)));
  const manifestBytes = await Deno.readFile(
    new URL("public/artifacts/numeric-polybench-panel/build-manifest.json", root),
  );
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as Json;
  const executablePath = await Deno.realPath(chromeArgument);
  const executableStat = await Deno.stat(executablePath);
  const executableHash = (await commandText("sha256sum", [executablePath])).split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/.test(executableHash)) throw new Error("Chrome executable hash failed");

  let outputCreated = false;
  let server: Deno.ChildProcess | null = null;
  let serverStatusPromise: Promise<Deno.CommandStatus> | null = null;
  let serverIdentity: ProcessIdentity | null = null;
  let profilePath: string | null = null;
  let browserProcess: Deno.ChildProcess | null = null;
  let browserStatusPromise: Promise<Deno.CommandStatus> | null = null;
  let browserLauncherIdentity: ProcessIdentity | null = null;
  let observedBrowserProcesses: ProcessIdentity[] = [];
  let complete = false;
  let emergencyClient: CdpClient | null = null;
  const serverPort = unusedPort();
  const debuggerPort = unusedPort();
  const origin = `http://127.0.0.1:${serverPort}`;
  let launchArguments: string[] = [];
  try {
    await Deno.remove(outputRoot, { recursive: true }).catch(() => {});
    await Deno.mkdir(outputRoot, { recursive: true });
    outputCreated = true;
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
    serverStatusPromise = server.status;
    serverIdentity = await processIdentity(server.pid);
    if (!serverIdentity) throw new Error("evidence server identity unavailable after spawn");
    await waitFor(`${origin}/healthz`);
    profilePath = await Deno.makeTempDir({ prefix: "wasm-polybench-panel-chrome-" });
    launchArguments = [
      "--headless=new",
      "--enable-automation",
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
      "--force-device-scale-factor=1",
      "--remote-debugging-address=127.0.0.1",
      `--remote-debugging-port=${debuggerPort}`,
      `--user-data-dir=${profilePath}`,
      "about:blank",
    ];
    browserProcess = new Deno.Command(executablePath, {
      args: launchArguments,
      stdout: "null",
      stderr: "null",
    }).spawn();
    browserStatusPromise = browserProcess.status;
    browserLauncherIdentity = await processIdentity(browserProcess.pid);
    if (!browserLauncherIdentity) {
      throw new Error("Chrome launcher identity unavailable after spawn");
    }
    observedBrowserProcesses = [browserLauncherIdentity];
    const discovery = await (await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
    const socket = new URL(discovery.webSocketDebuggerUrl);
    if (
      socket.protocol !== "ws:" || socket.hostname !== "127.0.0.1" ||
      Number(socket.port) !== debuggerPort
    ) {
      throw new Error("Chrome CDP endpoint escaped owned loopback port");
    }
    const client = new CdpClient(socket.href);
    emergencyClient = client;
    await client.ready();
    const browserVersion = await client.send("Browser.getVersion");
    if (browserVersion.product !== EXPECTED_CHROME_PRODUCT) {
      throw new Error(`unexpected browser ${browserVersion.product}`);
    }
    const effectiveCommandLine = await client.send("Browser.getBrowserCommandLine");
    const effectiveArguments = effectiveCommandLine.arguments;
    if (
      !Array.isArray(effectiveArguments) ||
      launchArguments.some((argument) => !effectiveArguments.includes(argument))
    ) throw new Error("Chrome effective command line omitted a pinned launch argument");
    const host = {
      operatingSystem: await commandText("uname", ["-a"]),
      denoOs: Deno.build.os,
      denoArch: Deno.build.arch,
    };
    const records: Json[] = [];
    for (const id of SCENARIO_IDS) {
      const lifecycle = id.startsWith("lifecycle-");
      const created = await client.send("Target.createTarget", { url: "about:blank" });
      const targetId = String(created.targetId);
      const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
      const sessionId = String(attached.sessionId);
      const sessions = new Set([sessionId]);
      const workerTasks: Promise<void>[] = [];
      const consoleMessages: Json[] = [];
      const exceptions: Json[] = [];
      const requests = new Map<string, Json>();
      const removers = [
        client.on("Target.attachedToTarget", (params, owner) => {
          if (owner !== sessionId || (params.targetInfo as Json).type !== "worker") return;
          const workerSession = String(params.sessionId);
          sessions.add(workerSession);
          workerTasks.push(
            Promise.all([
              client.send("Network.enable", {}, workerSession),
              client.send("Runtime.enable", {}, workerSession),
              client.send("Runtime.runIfWaitingForDebugger", {}, workerSession),
            ]).then(() => {}),
          );
        }),
        client.on("Runtime.consoleAPICalled", (params, eventSession) => {
          if (eventSession && sessions.has(eventSession)) {
            consoleMessages.push(normalizedConsole(params));
          }
        }),
        client.on("Runtime.exceptionThrown", (params, eventSession) => {
          if (!eventSession || !sessions.has(eventSession)) return;
          const details = params.exceptionDetails as Json;
          exceptions.push({ text: String(details.text), lineNumber: Number(details.lineNumber) });
        }),
        client.on("Network.requestWillBeSent", (params, eventSession) => {
          if (!eventSession || !sessions.has(eventSession)) return;
          const request = params.request as Json;
          requests.set(`${eventSession}:${params.requestId}`, {
            url: String(request.url),
            method: String(request.method),
            type: String(params.type),
            status: null,
            mimeType: null,
            fromDiskCache: false,
            fromServiceWorker: false,
            failed: false,
            errorText: null,
            encodedDataLength: null,
          });
        }),
        client.on("Network.responseReceived", (params, eventSession) => {
          const record = requests.get(`${eventSession}:${params.requestId}`);
          if (!record) return;
          const response = params.response as Json;
          Object.assign(record, {
            status: Number(response.status),
            mimeType: String(response.mimeType),
            fromDiskCache: Boolean(response.fromDiskCache),
            fromServiceWorker: Boolean(response.fromServiceWorker),
          });
        }),
        client.on("Network.loadingFinished", (params, eventSession) => {
          const record = requests.get(`${eventSession}:${params.requestId}`);
          if (record) record.encodedDataLength = Number(params.encodedDataLength);
        }),
        client.on("Network.loadingFailed", (params, eventSession) => {
          const record = requests.get(`${eventSession}:${params.requestId}`);
          if (record) Object.assign(record, { failed: true, errorText: String(params.errorText) });
        }),
      ];
      await Promise.all([
        client.send("Page.enable", {}, sessionId),
        client.send("Runtime.enable", {}, sessionId),
        client.send("Network.enable", {}, sessionId),
        client.send("Accessibility.enable", {}, sessionId),
        client.send("Target.setAutoAttach", {
          autoAttach: true,
          waitForDebuggerOnStart: true,
          flatten: true,
        }, sessionId),
      ]);
      if (lifecycle) {
        await client.send("Page.addScriptToEvaluateOnNewDocument", {
          source: lifecycleInitScript(),
        }, sessionId);
      }
      const loaded = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${id} load timeout`)), 10_000);
        const remove = client.on("Page.loadEventFired", (_params, eventSession) => {
          if (eventSession !== sessionId) return;
          clearTimeout(timer);
          remove();
          resolve();
        });
      });
      await client.send("Page.navigate", { url: `${origin}${route}` }, sessionId);
      await loaded;
      await waitForState(client, sessionId, (state) => state.status === "Ready.");
      let rawResultText: string | null = null;
      let rawResultTextSha256: string | null = null;
      let results: Json[] | null = null;
      let lifecycleResult: Json | null = null;
      if (!lifecycle) {
        const target = id === "execute-javascript-all"
          ? "javascript-controlled"
          : "linear-wasm-controlled";
        await client.send("Runtime.evaluate", {
          expression: `document.querySelector('#target').value=${
            JSON.stringify(target === "javascript-controlled" ? "javascript" : "wasm")
          }`,
        }, sessionId);
        await click(client, sessionId, "#start");
        const state = await waitForState(
          client,
          sessionId,
          (candidate) =>
            candidate.status ===
              "Complete. Every reported element passed the registered oracle.",
        );
        rawResultText = String(state.output);
        const expectedRawText = expectedRawResultText(target, manifest);
        if (rawResultText !== expectedRawText) {
          throw new Error(`${target} raw result text did not match exact expected bytes`);
        }
        rawResultTextSha256 = await sha256Hex(new TextEncoder().encode(rawResultText));
        if (rawResultTextSha256 !== EXPECTED_RAW_RESULT_SHA256[target]) {
          throw new Error(`${target} raw result text SHA-256 mismatch`);
        }
        results = verifyExecutionResults(JSON.parse(rawResultText), target, manifest);
      } else {
        const evaluated = await client.send("Runtime.evaluate", {
          expression: lifecycleExpression(id),
          awaitPromise: true,
          returnByValue: true,
        }, sessionId);
        lifecycleResult = (evaluated.result as { value: Json }).value;
        verifyLifecycle(id, lifecycleResult);
      }
      await Promise.all(workerTasks);
      const networkDeadline = Date.now() + 2_000;
      while (
        Date.now() < networkDeadline &&
        [...requests.values()].some((record) =>
          record.status === null || (!record.failed && record.encodedDataLength === null)
        )
      ) await new Promise((resolve) => setTimeout(resolve, 20));
      if (exceptions.length || consoleMessages.some((entry) => entry.type === "error")) {
        throw new Error(`${id} emitted console/exception errors`);
      }
      if (
        [...requests.values()].some((record) =>
          record.failed || record.status !== 200 || record.fromServiceWorker ||
          record.encodedDataLength === null
        )
      ) throw new Error(`${id} had incomplete network evidence`);
      const accessibility = await client.send("Accessibility.getFullAXTree", {}, sessionId, 10_000);
      const axNodes = accessibility.nodes as Json[];
      const requiredAccessibility = [
        ["button", "Start"],
        ["button", "Cancel"],
        ["combobox", "Controlled target"],
        ["combobox", "Kernel"],
        ["progressbar", "Completed kernels"],
        ["status", ""],
      ].map(([role, name]) => {
        const found = axNodes.some((node) =>
          !node.ignored && (node.role as Json)?.value === role &&
          (name === "" || (node.name as Json)?.value === name)
        );
        if (!found) throw new Error(`${id} missing accessible ${role}/${name}`);
        return { role, name, found: true };
      });
      const axBytes = new TextEncoder().encode(`${canonicalize(accessibility)}\n`);
      const axArtifact = await writeArtifact(`accessibility/${id}.json`, axBytes);
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
      const screenshotArtifact = await writeArtifact(`screenshots/${id}.png`, screenshotBytes);
      records.push({
        id,
        kind: lifecycle ? "lifecycle" : "execution",
        route,
        target: lifecycle
          ? null
          : id === "execute-javascript-all"
          ? "javascript-controlled"
          : "linear-wasm-controlled",
        finalState: await pageState(client, sessionId),
        rawResultText,
        rawResultTextSha256,
        results,
        lifecycle: lifecycleResult,
        console: consoleMessages,
        exceptions,
        network: [...requests.values()],
        accessibility: {
          fullTree: axArtifact,
          nodeCount: axNodes.length,
          required: requiredAccessibility,
          violations: [],
        },
        screenshot: screenshotArtifact,
      });
      removers.forEach((remove) => remove());
      await client.send("Target.closeTarget", { targetId });
    }

    if (!browserLauncherIdentity) throw new Error("Chrome launcher identity was not retained");
    const retainedBrowserLauncher = browserLauncherIdentity;
    const currentBrowserProcesses = await ownedProcesses(retainedBrowserLauncher);
    observedBrowserProcesses = [...new Map(
      [...observedBrowserProcesses, ...currentBrowserProcesses].map((identity) => [
        `${identity.pid}:${identity.startTimeTicks}`,
        identity,
      ]),
    ).values()].sort((a, b) => a.pid - b.pid);
    const launcher = observedBrowserProcesses.find((identity) =>
      identity.pid === retainedBrowserLauncher.pid &&
      identity.startTimeTicks === retainedBrowserLauncher.startTimeTicks
    );
    if (!launcher || !currentBrowserProcesses.length) {
      throw new Error("owned Chrome launcher disappeared before cleanup");
    }
    await client.send("Browser.close");
    client.close();
    const signals: Array<{ pid: number; signal: string }> = [];
    if (!(await waitForOwnedExit(observedBrowserProcesses, 10_000))) {
      for (const identity of [...observedBrowserProcesses].reverse()) {
        if (await identityStillRunning(identity)) {
          Deno.kill(identity.pid, "SIGTERM");
          signals.push({ pid: identity.pid, signal: "SIGTERM" });
        }
      }
    }
    if (!(await waitForOwnedExit(observedBrowserProcesses, 5_000))) {
      for (const identity of [...observedBrowserProcesses].reverse()) {
        if (await identityStillRunning(identity)) {
          Deno.kill(identity.pid, "SIGKILL");
          signals.push({ pid: identity.pid, signal: "SIGKILL" });
        }
      }
    }
    const processesAbsent = await waitForOwnedExit(observedBrowserProcesses, 5_000);
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
    if (!profileAbsent) throw new Error("owned Chrome profile survived exact cleanup");
    if (await identityStillRunning(serverIdentity)) Deno.kill(serverIdentity.pid, "SIGTERM");
    const serverExit = await serverStatusPromise;
    const serverAbsent = !(await identityStillRunning(serverIdentity));
    if (!serverAbsent) throw new Error("owned evidence server survived exact cleanup");

    const [endHead, endTree, endStatus, endSourceFiles, endExecutablePath] = await Promise.all([
      commandText("git", ["rev-parse", "HEAD"]),
      commandText("git", ["rev-parse", `${sourceCommit}^{tree}`]),
      commandText("git", [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--",
        ".",
        ":(exclude)evidence/base/numeric-polybench-panel/chrome-acceptance/**",
      ]),
      Promise.all(executionPaths.map((path) => sourceDescriptor(sourceCommit, path))),
      Deno.realPath(chromeArgument),
    ]);
    const endExecutableStat = await Deno.stat(endExecutablePath);
    const endExecutableHash = (await commandText("sha256sum", [endExecutablePath])).split(/\s+/)[0];
    if (
      endHead !== sourceCommit || endTree !== tree || endStatus !== "" ||
      canonicalize(endSourceFiles) !== canonicalize(sourceFiles)
    ) throw new Error("source identity changed during collection");
    if (
      endExecutablePath !== executablePath || endExecutableStat.size !== executableStat.size ||
      endExecutableStat.dev !== executableStat.dev ||
      endExecutableStat.ino !== executableStat.ino ||
      endExecutableHash !== executableHash
    ) throw new Error("Chrome executable identity changed during collection");

    const evidence = {
      schemaVersion: 1,
      evidenceId: "numeric-polybench-panel-chrome-150-acceptance-v1",
      collectedAt: new Date().toISOString(),
      source: {
        commit: sourceCommit,
        tree,
        cleanAtStart: true,
        statusPorcelain: "",
        cleanAtEnd: true,
        statusPorcelainAtEnd: "",
        files: sourceFiles,
        buildManifest: {
          sha256: await sha256Hex(manifestBytes),
          implementationCommit: manifest.implementationCommit,
          sourceTreeSha256: manifest.sourceTreeSha256,
        },
      },
      collectionCommand:
        `deno run -A scripts/collect-polybench-panel-chrome-evidence.ts --source-commit=${sourceCommit} --chrome=${chromeArgument}`,
      browser: {
        product: browserVersion.product,
        revision: browserVersion.revision,
        userAgent: browserVersion.userAgent,
        jsVersion: browserVersion.jsVersion,
        protocolVersion: browserVersion.protocolVersion,
        executable: {
          requestedPath: chromeArgument,
          realPath: executablePath,
          bytes: executableStat.size,
          sha256: executableHash,
        },
        launchArguments,
        headless: true,
        protocol: "Chrome DevTools Protocol",
        host,
      },
      server: { origin, mode: "public", launcherPid: server.pid },
      scenarios: records,
      cleanup: {
        browser: {
          launcher,
          observedProcesses: observedBrowserProcesses,
          requested: "Browser.close",
          signals,
          exit: browserExit,
          processesAbsent,
        },
        profile: { path: profilePath, removed: true, absent: profileAbsent },
        server: {
          launcher: serverIdentity,
          signal: "SIGTERM",
          exit: serverExit,
          processAbsent: serverAbsent,
        },
      },
    };
    const evidenceSchema = JSON.parse(
      await Deno.readTextFile(
        new URL("schemas/polybench-panel-chrome-evidence.schema.json", root),
      ),
    );
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    addFormats(ajv);
    const validateEvidence = ajv.compile(evidenceSchema);
    if (!validateEvidence(evidence)) {
      throw new Error(
        `collected evidence failed closed schema: ${JSON.stringify(validateEvidence.errors)}`,
      );
    }
    await Deno.writeTextFile(
      new URL("evidence.v1.json", outputRoot),
      `${canonicalize(evidence)}\n`,
    );
    complete = true;
    console.log("polybench-panel Chrome evidence: 8 scenarios; exact owned cleanup");
  } finally {
    if (!complete) {
      try {
        await emergencyClient?.send("Browser.close");
      } catch {
        // Identity-bound cleanup continues below.
      }
      emergencyClient?.close();
      if (browserLauncherIdentity) {
        const current = await ownedProcesses(browserLauncherIdentity);
        const processes = [...new Map(
          [...observedBrowserProcesses, ...current].map((identity) => [
            `${identity.pid}:${identity.startTimeTicks}`,
            identity,
          ]),
        ).values()].sort((a, b) => a.pid - b.pid);
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
      }
      await browserStatusPromise?.catch(() => {});
      if (serverIdentity && await identityStillRunning(serverIdentity)) {
        Deno.kill(serverIdentity.pid, "SIGTERM");
      }
      await serverStatusPromise?.catch(() => {});
      if (profilePath) await Deno.remove(profilePath, { recursive: true }).catch(() => {});
      if (outputCreated) await Deno.remove(outputRoot, { recursive: true }).catch(() => {});
    }
  }
}

if (import.meta.main) await collect();

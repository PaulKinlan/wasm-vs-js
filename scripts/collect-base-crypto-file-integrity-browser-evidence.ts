import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const addFormats = ((addFormatsModule as unknown as {
  default?: (instance: unknown) => void;
}).default ?? addFormatsModule) as unknown as (instance: unknown) => void;

const WORKLOAD_ID = "crypto.file-integrity.v1";
const OUTPUT_ROOT = "artifacts/base/crypto.file-integrity.v1/browser-evidence";
const DEMO_ROUTE = "/demos/crypto.file-integrity.v1/";
const KINDS = ["seeded-pseudorandom", "all-zero"] as const;
const SIZES = [1_048_576, 16_777_216, 268_435_456] as const;
const SCHEDULES = [1024, 65_536, "whole-buffer"] as const;
const TARGETS = ["js-controlled", "wasm-linear-controlled"] as const;
const LIFECYCLE_IDS = [
  "wrong-token",
  "stale-error",
  "restart",
  "cancel",
  "timeout",
  "pagehide",
] as const;

export const FETCHED_ASSETS = Object.freeze({
  [DEMO_ROUTE]: "public/demos/crypto.file-integrity.v1/index.html",
  "/styles.css": "public/styles.css",
  "/crypto-file-integrity-demo.js": "public/crypto-file-integrity-demo.js",
  "/crypto-file-integrity-worker.js": "public/crypto-file-integrity-worker.js",
  "/data/base-implementation-status.v1.json": "public/data/base-implementation-status.v1.json",
  "/registrations/base/crypto.file-integrity.v1.json":
    "registrations/base/crypto.file-integrity.v1.json",
  "/artifacts/crypto-file-integrity/build-manifest.json":
    "public/artifacts/crypto-file-integrity/build-manifest.json",
  "/artifacts/crypto-file-integrity/crypto-file-integrity.wasm":
    "public/artifacts/crypto-file-integrity/crypto-file-integrity.wasm",
  "/benchmarks/base/crypto-file-integrity/sha256.js":
    "benchmarks/base/crypto-file-integrity/sha256.js",
  "/benchmarks/base/crypto-file-integrity/workload.js":
    "benchmarks/base/crypto-file-integrity/workload.js",
});

export type Target = (typeof TARGETS)[number];
export type Kind = (typeof KINDS)[number];
export type Schedule = (typeof SCHEDULES)[number];
export type BrowserCase = {
  id: string;
  target: Target;
  kind: Kind;
  byteLength: number;
  schedule: Schedule;
  output: { digestSha256: string; counters: Record<string, number> };
  expectedDigestSha256: string;
  wasmMemoryPages: number | null;
  passed: true;
};

type Registration = {
  workloadId: string;
  fixtures: Array<{
    kind: Kind;
    byteLength: number;
    expectedDigestSha256: string;
  }>;
};

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
  resourceType: string;
  status: number | null;
  mimeType: string | null;
  fromDiskCache: boolean;
  fromServiceWorker: boolean;
  failed: boolean;
  errorText: string | null;
  bodyBytes: number | null;
  bodySha256: string | null;
};

function caseId(target: Target, kind: Kind, byteLength: number, schedule: Schedule): string {
  return `${target}:${kind}:${byteLength}:${schedule}`;
}

export function expectedCounters(
  byteLength: number,
  schedule: Schedule,
  target: Target,
): Record<string, number> {
  const chunkSize = schedule === "whole-buffer" ? byteLength : schedule;
  const chunks = Math.ceil(byteLength / chunkSize);
  return {
    "input-bytes": byteLength,
    "scheduled-chunks": chunks,
    "sha256-compression-blocks": Math.ceil((byteLength + 9) / 64),
    "copied-bytes": target === "wasm-linear-controlled" ? byteLength : 0,
    "boundary-crossings": target === "wasm-linear-controlled" ? chunks + 2 : 0,
    "engine-buffer-allocations": target === "wasm-linear-controlled" ? 0 : 4,
  };
}

export function expectedMemoryPages(
  byteLength: number,
  schedule: Schedule,
  target: Target,
): number | null {
  if (target === "js-controlled") return null;
  const chunkSize = schedule === "whole-buffer" ? byteLength : schedule;
  return Math.max(3, Math.ceil((131_072 + chunkSize) / 65_536));
}

export function expectedCaseContracts(registration: Registration): BrowserCase[] {
  if (registration.workloadId !== WORKLOAD_ID || registration.fixtures.length !== 6) {
    throw new Error("registration identity is not the frozen crypto contract");
  }
  const digests = new Map(
    registration.fixtures.map((fixture) => [
      `${fixture.kind}:${fixture.byteLength}`,
      fixture.expectedDigestSha256,
    ]),
  );
  const cases: BrowserCase[] = [];
  for (const kind of KINDS) {
    for (const byteLength of SIZES) {
      const expectedDigestSha256 = digests.get(`${kind}:${byteLength}`);
      if (!expectedDigestSha256 || !/^[a-f0-9]{64}$/.test(expectedDigestSha256)) {
        throw new Error(`registration fixture missing: ${kind}:${byteLength}`);
      }
      for (const schedule of SCHEDULES) {
        for (const target of TARGETS) {
          cases.push({
            id: caseId(target, kind, byteLength, schedule),
            target,
            kind,
            byteLength,
            schedule,
            output: {
              digestSha256: expectedDigestSha256,
              counters: expectedCounters(byteLength, schedule, target),
            },
            expectedDigestSha256,
            wasmMemoryPages: expectedMemoryPages(byteLength, schedule, target),
            passed: true,
          });
        }
      }
    }
  }
  return cases;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function assertBrowserCase(actual: BrowserCase, expected: BrowserCase): void {
  if (!sameJson(actual, expected)) {
    throw new Error(`browser case mismatch: ${expected.id}`);
  }
}

export function assertCleanStatus(status: string): void {
  if (status !== "") throw new Error("browser collection requires an exact clean HEAD");
}

function commandText(cwd: string, command: string, args: string[]): Promise<string> {
  return new Deno.Command(command, {
    cwd,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output().then((output) => {
    if (!output.success) {
      throw new Error(`${command} failed: ${new TextDecoder().decode(output.stderr).trim()}`);
    }
    return new TextDecoder().decode(output.stdout).trim();
  });
}

async function assertExactSourceRoot(sourceRootArg: string, sourceCommit: string) {
  const sourceRoot = await Deno.realPath(sourceRootArg);
  const scriptRoot = await Deno.realPath(new URL("../", import.meta.url));
  if (sourceRoot !== scriptRoot || Deno.cwd() !== sourceRoot) {
    throw new Error("collector must run from its exact source root");
  }
  const topLevel = await commandText(sourceRoot, "git", ["rev-parse", "--show-toplevel"]);
  const head = await commandText(sourceRoot, "git", ["rev-parse", "HEAD"]);
  if (topLevel !== sourceRoot || head !== sourceCommit || !/^[a-f0-9]{40}$/.test(sourceCommit)) {
    throw new Error("source root, clean HEAD, and requested source commit must be identical");
  }
  const status = await new Deno.Command("git", {
    cwd: sourceRoot,
    args: ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!status.success) throw new Error("git status failed");
  assertCleanStatus(new TextDecoder().decode(status.stdout));
  return {
    root: sourceRoot,
    commit: sourceCommit,
    tree: await commandText(sourceRoot, "git", ["rev-parse", "HEAD^{tree}"]),
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

async function exactProcessCleanup(
  identities: ProcessIdentity[],
): Promise<{ signals: Array<{ pid: number; signal: string }>; processesAbsent: boolean }> {
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
  return { signals, processesAbsent: await waitForOwnedExit(identities, 5_000) };
}

function nestedValue(result: Record<string, unknown>): unknown {
  return (result.result as Record<string, unknown>)?.value;
}

async function evaluate(
  client: CdpClient,
  sessionId: string,
  expression: string,
  timeoutMs = 10_000,
): Promise<unknown> {
  const result = await client.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
    timeoutMs,
  );
  const exception = result.exceptionDetails as Record<string, unknown> | undefined;
  if (exception) throw new Error(`browser evaluation failed: ${String(exception.text)}`);
  return nestedValue(result);
}

async function click(client: CdpClient, sessionId: string, selector: string): Promise<void> {
  const point = await evaluate(
    client,
    sessionId,
    `(() => { const n=document.querySelector(${
      JSON.stringify(selector)
    }); const r=n.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:n.disabled}; })()`,
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

async function pageState(client: CdpClient, sessionId: string) {
  return await evaluate(
    client,
    sessionId,
    `(() => ({status:document.querySelector('#status').textContent.trim(),output:document.querySelector('#output').textContent.trim(),startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled}))()`,
  ) as Record<string, unknown>;
}

async function waitForState(
  client: CdpClient,
  sessionId: string,
  predicate: (state: Record<string, unknown>) => boolean,
  timeoutMs = 300_000,
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

function fakeWorkerHarness(): string {
  return `(() => {
    const scenario = new URL(location.href).searchParams.get('collectorLifecycle');
    if (!scenario) return;
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const instances = [];
    class CollectorWorker {
      constructor(url, options) { this.url=String(url); this.options=options; this.terminated=false; this.message=null; instances.push(this); }
      postMessage(message) {
        this.message=structuredClone(message);
        if (scenario === 'wrong-token') nativeSetTimeout(() => this.emit('complete', message.token + 1), 0);
      }
      terminate() { this.terminated=true; }
      emit(type, token=this.message?.token) {
        this.onmessage?.({data:{type,token,message:'injected stale error',result:{forbidden:'not evidence'}}});
      }
    }
    Object.defineProperty(globalThis, '__cryptoLifecycleHarness', {value:{scenario,instances}, configurable:false});
    globalThis.Worker = CollectorWorker;
    if (scenario === 'timeout') {
      globalThis.setTimeout = (callback, delay, ...args) => delay === 180000
        ? nativeSetTimeout(callback, 0, ...args)
        : nativeSetTimeout(callback, delay, ...args);
    }
  })();`;
}

async function attachPage(
  client: CdpClient,
  url: string,
  injectLifecycle = false,
): Promise<{ targetId: string; sessionId: string }> {
  const created = await client.send("Target.createTarget", { url: "about:blank" });
  const targetId = String(created.targetId);
  const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = String(attached.sessionId);
  await Promise.all([
    client.send("Page.enable", {}, sessionId),
    client.send("Runtime.enable", {}, sessionId),
    client.send("Network.enable", {}, sessionId),
    client.send("Accessibility.enable", {}, sessionId),
    client.send("Target.setAutoAttach", {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
    }, sessionId),
  ]);
  if (injectLifecycle) {
    await client.send(
      "Page.addScriptToEvaluateOnNewDocument",
      { source: fakeWorkerHarness() },
      sessionId,
    );
  }
  const loaded = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("page load timeout")), 15_000);
    const remove = client.on("Page.loadEventFired", (_params, eventSession) => {
      if (eventSession !== sessionId) return;
      clearTimeout(timer);
      remove();
      resolve();
    });
  });
  await client.send("Page.navigate", { url }, sessionId);
  await loaded;
  return { targetId, sessionId };
}

async function collectLifecycle(
  client: CdpClient,
  origin: string,
): Promise<Array<Record<string, unknown>>> {
  const records: Array<Record<string, unknown>> = [];
  for (const id of LIFECYCLE_IDS) {
    const page = await attachPage(
      client,
      `${origin}${DEMO_ROUTE}?collectorLifecycle=${id}`,
      true,
    );
    await waitForState(client, page.sessionId, (state) => state.status === "Ready.");
    await click(client, page.sessionId, "#start");
    if (id === "restart" || id === "stale-error") {
      await evaluate(
        client,
        page.sessionId,
        `document.querySelector('form').dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}))`,
      );
      if (id === "stale-error") {
        await evaluate(
          client,
          page.sessionId,
          `__cryptoLifecycleHarness.instances[0].emit('error')`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    } else if (id === "cancel") {
      await click(client, page.sessionId, "#cancel");
    } else if (id === "pagehide") {
      await evaluate(client, page.sessionId, `dispatchEvent(new PageTransitionEvent('pagehide'))`);
    }
    if (id === "wrong-token") await new Promise((resolve) => setTimeout(resolve, 50));
    if (id === "timeout") {
      await waitForState(
        client,
        page.sessionId,
        (state) => state.status === "Stopped after the 180 second limit.",
      );
    }
    const snapshot = async () =>
      await evaluate(
        client,
        page.sessionId,
        `(() => ({state:{status:document.querySelector('#status').textContent.trim(),output:document.querySelector('#output').textContent.trim(),startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled},workers:__cryptoLifecycleHarness.instances.map((worker)=>({url:worker.url,type:worker.options?.type??null,token:worker.message?.token??null,terminated:worker.terminated}))}))()`,
      ) as { state: Record<string, unknown>; workers: Array<Record<string, unknown>> };
    const beforeCleanup = await snapshot();
    const expectedWorkers = id === "restart" || id === "stale-error" ? 2 : 1;
    if (beforeCleanup.workers.length !== expectedWorkers) {
      throw new Error(`${id} worker count mismatch`);
    }
    if (id === "wrong-token" || id === "restart" || id === "stale-error") {
      if (beforeCleanup.state.status !== "Starting fresh worker.") {
        throw new Error(`${id} did not ignore stale/wrong-token completion state`);
      }
      await click(client, page.sessionId, "#cancel");
    }
    const afterCleanup = await snapshot();
    if (
      id === "cancel" && beforeCleanup.state.status !== "Cancelled. The worker was terminated."
    ) {
      throw new Error("cancel lifecycle failed");
    }
    if (
      id === "timeout" &&
      beforeCleanup.state.status !== "Stopped after the 180 second limit."
    ) {
      throw new Error("timeout lifecycle failed");
    }
    if (
      id === "pagehide" &&
      (!beforeCleanup.workers[0].terminated || beforeCleanup.state.cancelDisabled !== true)
    ) {
      throw new Error("pagehide lifecycle failed");
    }
    if (
      (id === "restart" || id === "stale-error") &&
      beforeCleanup.workers[0].terminated !== true
    ) {
      throw new Error(`${id} did not terminate the replaced worker`);
    }
    if (afterCleanup.workers.some((worker) => worker.terminated !== true)) {
      throw new Error(`${id} left an owned worker running`);
    }
    records.push({
      id,
      instrumentation: "collector-controlled Worker test double; not correctness evidence",
      assertions: id === "wrong-token"
        ? ["wrong token ignored", "owned worker terminated"]
        : id === "stale-error"
        ? ["stale error ignored", "replaced worker terminated", "owned worker terminated"]
        : id === "restart"
        ? ["restart terminated prior worker", "fresh worker created", "owned worker terminated"]
        : id === "cancel"
        ? ["Cancel control terminated worker", "cancel status exposed"]
        : id === "timeout"
        ? ["180 second callback exercised", "timeout terminated worker"]
        : ["pagehide cleanup exercised", "pagehide terminated worker"],
      stateBeforeCleanup: beforeCleanup.state,
      stateAfterCleanup: afterCleanup.state,
      workers: afterCleanup.workers,
      passed: true,
    });
    await client.send("Target.closeTarget", { targetId: page.targetId });
  }
  return records;
}

function lifecycleSemantics(records: Array<Record<string, unknown>>): void {
  if (!sameJson(records.map((record) => record.id), LIFECYCLE_IDS)) {
    throw new Error("lifecycle corpus is not exact");
  }
  if (records.some((record) => record.passed !== true)) throw new Error("lifecycle case failed");
}

export function assertFetchedAssets(
  observations: Array<
    { route: string; sha256: string; bytes: number; observedResponses: unknown[] }
  >,
  expected: Array<{ route: string; sha256: string; bytes: number }>,
): void {
  if (observations.length !== expected.length) {
    throw new Error("fetched asset denominator mismatch");
  }
  for (const wanted of expected) {
    const actual = observations.find((entry) => entry.route === wanted.route);
    if (
      !actual || actual.sha256 !== wanted.sha256 || actual.bytes !== wanted.bytes ||
      actual.observedResponses.length < 1
    ) throw new Error(`fetched asset mismatch: ${wanted.route}`);
  }
}

async function assertClosedEvidenceSchema(evidence: unknown, sourceRoot: string): Promise<void> {
  const schema = JSON.parse(
    await Deno.readTextFile(
      `${sourceRoot}/schemas/base-crypto-file-integrity-browser-evidence.schema.json`,
    ),
  );
  const ajv = new (Ajv2020 as unknown as new (
    options: Record<string, unknown>,
  ) => { compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown } })({
    allErrors: true,
    strict: true,
  });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(evidence)) {
    throw new Error(
      `closed browser evidence schema rejected collection: ${JSON.stringify(validate.errors)}`,
    );
  }
}

async function runCollector(options: {
  sourceRoot: string;
  sourceCommit: string;
  chrome: string;
  chromeSha256: string;
  chromeProduct: string;
}): Promise<void> {
  if (
    !/^[a-f0-9]{64}$/.test(options.chromeSha256) || !/^Chrome\/[0-9.]+$/.test(options.chromeProduct)
  ) {
    throw new Error("exact Chrome SHA-256 and product version are required");
  }
  const source = await assertExactSourceRoot(options.sourceRoot, options.sourceCommit);
  try {
    await Deno.lstat(`${source.root}/${OUTPUT_ROOT}`);
    throw new Error("browser evidence output already exists");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  const registration = JSON.parse(
    await Deno.readTextFile(`${source.root}/registrations/base/crypto.file-integrity.v1.json`),
  ) as Registration;
  const expectedCases = expectedCaseContracts(registration);
  const localAssets = await Promise.all(
    Object.entries(FETCHED_ASSETS).map(async ([route, path]) => {
      const bytes = await Deno.readFile(`${source.root}/${path}`);
      return { route, sourcePath: path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) };
    }),
  );
  const collectorSha256 = await sha256Hex(await Deno.readFile(new URL(import.meta.url)));
  const chromePath = await Deno.realPath(options.chrome);
  const chromeInfoBefore = await Deno.stat(chromePath);
  if (!chromeInfoBefore.isFile) throw new Error("Chrome executable is not a file");
  const observedChromeSha256 = await sha256Hex(await Deno.readFile(chromePath));
  if (observedChromeSha256 !== options.chromeSha256) throw new Error("Chrome hash mismatch");

  const outputParent = `${source.root}/artifacts/base/crypto.file-integrity.v1`;
  const partialRoot = `${outputParent}/.browser-evidence-${crypto.randomUUID()}`;
  await Deno.mkdir(`${partialRoot}/screenshots`, { recursive: true });
  const serverPort = unusedPort();
  const debuggerPort = unusedPort();
  const origin = `http://127.0.0.1:${serverPort}`;
  const server = new Deno.Command(Deno.execPath(), {
    cwd: source.root,
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
  const setup = await (async () => {
    let profilePath: string | null = null;
    let chrome: Deno.ChildProcess | null = null;
    try {
      await waitFor(`${origin}/healthz`);
      const serverIdentity = await processIdentity(server.pid);
      if (!serverIdentity) throw new Error("owned loopback server identity unavailable");
      profilePath = await Deno.makeTempDir({
        prefix: "wasm-crypto-file-integrity-chrome-",
      });
      await Deno.chmod(profilePath, 0o700);
      const profileInfo = await Deno.lstat(profilePath);
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
        "--window-size=1440,1200",
        "--remote-debugging-address=127.0.0.1",
        `--remote-debugging-port=${debuggerPort}`,
        `--user-data-dir=${profilePath}`,
        "about:blank",
      ];
      chrome = new Deno.Command(chromePath, {
        args: launchArguments,
        stdout: "null",
        stderr: "null",
      }).spawn();
      return {
        serverIdentity,
        profilePath,
        profileInfo,
        launchArguments,
        chrome,
        chromeStatus: chrome.status,
      };
    } catch (error) {
      if (chrome) {
        await exactProcessCleanup(await ownedProcesses(chrome.pid));
        await chrome.status.catch(() => {});
      }
      if (profilePath) await Deno.remove(profilePath, { recursive: true }).catch(() => {});
      const currentServer = await processIdentity(server.pid);
      if (currentServer && await identityStillRunning(currentServer)) {
        Deno.kill(currentServer.pid, "SIGTERM");
        await exactProcessCleanup([currentServer]);
      }
      await serverStatus.catch(() => {});
      await Deno.remove(partialRoot, { recursive: true }).catch(() => {});
      throw error;
    }
  })();
  const {
    serverIdentity,
    profilePath,
    profileInfo,
    launchArguments,
    chrome,
    chromeStatus,
  } = setup;
  let client: CdpClient | null = null;
  let success = false;
  try {
    const discoveryResponse = await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`);
    const discovery = await discoveryResponse.json();
    const webSocketUrl = new URL(String(discovery.webSocketDebuggerUrl));
    if (
      webSocketUrl.protocol !== "ws:" || webSocketUrl.hostname !== "127.0.0.1" ||
      Number(webSocketUrl.port) !== debuggerPort ||
      !webSocketUrl.pathname.startsWith("/devtools/browser/")
    ) throw new Error("Chrome DevTools endpoint escaped exact loopback ownership");
    client = new CdpClient(webSocketUrl.href);
    await client.ready();
    const version = await client.send("Browser.getVersion");
    if (version.product !== options.chromeProduct) {
      throw new Error(`Chrome product mismatch: ${String(version.product)}`);
    }
    const effective = await client.send("Browser.getBrowserCommandLine");
    const effectiveArguments = effective.arguments as string[];
    if (
      !Array.isArray(effectiveArguments) ||
      !launchArguments.every((arg) => effectiveArguments.includes(arg))
    ) {
      throw new Error("Chrome effective arguments omitted an exact requested argument");
    }

    const network = new Map<string, NetworkRecord>();
    const bodyTasks: Promise<void>[] = [];
    const consoleMessages: Array<Record<string, unknown>> = [];
    const exceptions: Array<Record<string, unknown>> = [];
    const observedSessions = new Set<string>();
    client.on("Target.attachedToTarget", (params) => {
      const sessionId = String(params.sessionId);
      observedSessions.add(sessionId);
      bodyTasks.push(
        Promise.all([
          client!.send("Network.enable", {}, sessionId),
          client!.send("Runtime.enable", {}, sessionId),
        ]).then(() => {}),
      );
    });
    client.on("Runtime.consoleAPICalled", (params, sessionId) => {
      if (!sessionId || !observedSessions.has(sessionId)) return;
      consoleMessages.push({
        type: String(params.type),
        arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((arg) =>
          String(arg.value ?? arg.description ?? arg.type)
        ),
      });
    });
    client.on("Runtime.exceptionThrown", (params, sessionId) => {
      if (!sessionId || !observedSessions.has(sessionId)) return;
      const details = params.exceptionDetails as Record<string, unknown>;
      exceptions.push({ text: String(details.text), lineNumber: Number(details.lineNumber) });
    });
    client.on("Network.requestWillBeSent", (params, sessionId) => {
      if (!sessionId) return;
      observedSessions.add(sessionId);
      const request = params.request as Record<string, unknown>;
      const key = `${sessionId}:${String(params.requestId)}`;
      network.set(key, {
        requestId: String(params.requestId),
        sessionId,
        url: String(request.url),
        method: String(request.method),
        resourceType: String(params.type),
        status: null,
        mimeType: null,
        fromDiskCache: false,
        fromServiceWorker: false,
        failed: false,
        errorText: null,
        bodyBytes: null,
        bodySha256: null,
      });
    });
    client.on("Network.responseReceived", (params, sessionId) => {
      if (!sessionId) return;
      const record = network.get(`${sessionId}:${String(params.requestId)}`);
      const response = params.response as Record<string, unknown>;
      if (record) {
        record.status = Number(response.status);
        record.mimeType = String(response.mimeType);
        record.fromDiskCache = Boolean(response.fromDiskCache);
        record.fromServiceWorker = Boolean(response.fromServiceWorker);
      }
    });
    client.on("Network.loadingFailed", (params, sessionId) => {
      if (!sessionId) return;
      const record = network.get(`${sessionId}:${String(params.requestId)}`);
      if (record) {
        record.failed = true;
        record.errorText = String(params.errorText);
      }
    });
    client.on("Network.loadingFinished", (params, sessionId) => {
      if (!sessionId) return;
      const record = network.get(`${sessionId}:${String(params.requestId)}`);
      if (!record) return;
      bodyTasks.push((async () => {
        try {
          const body = await client!.send(
            "Network.getResponseBody",
            { requestId: params.requestId },
            sessionId,
            30_000,
          );
          const bytes = body.base64Encoded
            ? Uint8Array.from(atob(String(body.body)), (character) => character.charCodeAt(0))
            : new TextEncoder().encode(String(body.body));
          record.bodyBytes = bytes.byteLength;
          record.bodySha256 = await sha256Hex(bytes);
        } catch {
          // The final semantic gate requires bodies for every contract asset; unrelated bodies may expire.
        }
      })());
    });

    const page = await attachPage(client, `${origin}${DEMO_ROUTE}`);
    observedSessions.add(page.sessionId);
    await waitForState(client, page.sessionId, (state) => state.status === "Ready.");
    await click(client, page.sessionId, "#start");
    const visibleState = await waitForState(
      client,
      page.sessionId,
      (state) => state.status === "Complete. Exact digest and work counters passed.",
    );
    const visibleOutput = JSON.parse(String(visibleState.output));
    const visibleExpected = expectedCases[0];
    const visibleCase: BrowserCase = {
      ...visibleExpected,
      output: {
        digestSha256: String(visibleOutput.digestSha256),
        counters: visibleOutput.counters,
      },
    };
    assertBrowserCase(visibleCase, visibleExpected);

    const requiredText = [
      "No performance claim.",
      "The page uploads and stores nothing.",
      "2 fixture kinds × 3 sizes × 3 schedules × 2 targets.",
      "256 MiB whole-buffer Wasm case may grow linear memory to 4,098 pages.",
      "Every run stops after 180 seconds.",
    ];
    const accessibility = await evaluate(
      client,
      page.sessionId,
      `(() => ({lang:document.documentElement.lang,title:document.title,bodyText:document.body.innerText,live:document.querySelector('#status').getAttribute('aria-live'),outputTabIndex:document.querySelector('#output').tabIndex,controls:[...document.querySelectorAll('select,button')].map((node)=>({id:node.id,text:(node.labels?.[0]?.textContent||node.textContent).trim(),disabled:node.disabled}))}))()`,
    ) as Record<string, unknown>;
    const bodyText = String(accessibility.bodyText);
    for (const text of requiredText) {
      if (!bodyText.includes(text)) throw new Error(`accessibility text missing: ${text}`);
    }
    const ax = await client.send("Accessibility.getFullAXTree", {}, page.sessionId);
    const axNodes = (ax.nodes as Array<Record<string, unknown>>).map((node) => ({
      role: String((node.role as Record<string, unknown> | undefined)?.value ?? ""),
      name: String((node.name as Record<string, unknown> | undefined)?.value ?? ""),
    })).filter((node) => node.name);
    for (
      const name of [
        "Engine",
        "Generated fixture",
        "Exact size",
        "Chunk schedule",
        "Start",
        "Cancel",
      ]
    ) {
      if (!axNodes.some((node) => node.name.includes(name))) {
        throw new Error(`AX control missing: ${name}`);
      }
    }

    const screenshot = await client.send(
      "Page.captureScreenshot",
      {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
      },
      page.sessionId,
      15_000,
    );
    const screenshotBytes = Uint8Array.from(
      atob(String(screenshot.data)),
      (character) => character.charCodeAt(0),
    );
    await Deno.writeFile(`${partialRoot}/screenshots/visible-complete.png`, screenshotBytes);

    const assetSetup = await evaluate(
      client,
      page.sessionId,
      `(async () => {
        const expected=${
        JSON.stringify(Object.fromEntries(localAssets.map((asset) => [asset.route, asset.sha256])))
      };
        const hex=(bytes)=>[...new Uint8Array(bytes)].map((value)=>value.toString(16).padStart(2,'0')).join('');
        for (const route of ${JSON.stringify(Object.keys(FETCHED_ASSETS))}) {
          const response=await fetch(route,{cache:'no-store'});
          if (!response.ok) throw new Error(route+' '+response.status);
          const bytes=await response.arrayBuffer();
          if (hex(await crypto.subtle.digest('SHA-256',bytes))!==expected[route]) throw new Error(route+' hash mismatch');
        }
        const workload=await import('/benchmarks/base/crypto-file-integrity/workload.js');
        const registration=await (await fetch('/registrations/base/crypto.file-integrity.v1.json',{cache:'no-store'})).json();
        const artifact=new Uint8Array(await (await fetch('/artifacts/crypto-file-integrity/crypto-file-integrity.wasm',{cache:'no-store'})).arrayBuffer());
        globalThis.__cryptoCorpus={workload,registration,artifact};
        return {assetsVerified:Object.keys(expected).length};
      })()`,
      60_000,
    ) as { assetsVerified: number };
    if (assetSetup.assetsVerified !== localAssets.length) {
      throw new Error("browser asset gate incomplete");
    }

    const cases: BrowserCase[] = [];
    for (const expected of expectedCases) {
      const value = await evaluate(
        client,
        page.sessionId,
        `(async () => {
          const c=__cryptoCorpus,w=c.workload;
          const bytes=w.generateFixture(${JSON.stringify(expected.kind)},${expected.byteLength});
          let result,memoryPages=null;
          if (${JSON.stringify(expected.target)}==='js-controlled') result=w.runJavaScript(bytes,${
          JSON.stringify(expected.schedule)
        });
          else { const exports=await w.instantiateWasm(c.artifact); result=w.runWasm(exports,bytes,${
          JSON.stringify(expected.schedule)
        }); memoryPages=exports.memory.buffer.byteLength/65536; }
          return {id:${JSON.stringify(expected.id)},target:${
          JSON.stringify(expected.target)
        },kind:${JSON.stringify(expected.kind)},byteLength:${expected.byteLength},schedule:${
          JSON.stringify(expected.schedule)
        },output:{digestSha256:result.digest,counters:result.counters},expectedDigestSha256:${
          JSON.stringify(expected.expectedDigestSha256)
        },wasmMemoryPages:memoryPages,passed:result.digest===${
          JSON.stringify(expected.expectedDigestSha256)
        }};
        })()`,
        360_000,
      ) as BrowserCase;
      assertBrowserCase(value, expected);
      cases.push(value);
    }
    if (cases.length !== 36) throw new Error("browser case denominator incomplete");
    const fullWasmCases = cases.filter((entry) =>
      entry.target === "wasm-linear-controlled" && entry.byteLength === 268_435_456 &&
      entry.schedule === "whole-buffer"
    );
    if (
      fullWasmCases.length !== 2 || fullWasmCases.some((entry) => entry.wasmMemoryPages !== 4098)
    ) {
      throw new Error("full 256 MiB Wasm memory evidence did not observe 4,098 pages");
    }

    const lifecycle = await collectLifecycle(client, origin);
    lifecycleSemantics(lifecycle);
    await Promise.all(bodyTasks);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await Promise.all(bodyTasks);
    if (exceptions.length || consoleMessages.some((entry) => entry.type === "error")) {
      throw new Error("browser console or exception gate failed");
    }
    const networkRecords = [...network.values()].filter((record) =>
      new URL(record.url).origin === origin
    );
    const allowedNetworkPaths = new Set([...Object.keys(FETCHED_ASSETS), "/favicon.ico"]);
    if (
      networkRecords.some((record) =>
        record.method !== "GET" || record.status !== 200 || record.failed ||
        record.fromServiceWorker || !allowedNetworkPaths.has(new URL(record.url).pathname)
      )
    ) throw new Error("browser network gate failed or unexpected browser network route denied");
    const fetchedAssets = localAssets.map((asset) => ({
      ...asset,
      observedResponses: networkRecords.filter((record) => {
        const url = new URL(record.url);
        return url.pathname === asset.route && record.bodyBytes === asset.bytes &&
          record.bodySha256 === asset.sha256;
      }).map((record) => ({
        requestId: record.requestId,
        sessionId: record.sessionId,
        url: record.url,
        status: record.status,
        bodyBytes: record.bodyBytes,
        bodySha256: record.bodySha256,
      })),
    }));
    assertFetchedAssets(fetchedAssets, localAssets);

    const observedProcesses = await ownedProcesses(chrome.pid);
    const launcher = observedProcesses.find((identity) => identity.pid === chrome.pid);
    if (!launcher) throw new Error("owned Chrome launcher disappeared before cleanup");
    await client.send("Browser.close");
    client.close();
    client = null;
    const browserCleanup = await exactProcessCleanup(observedProcesses);
    const browserExit = await chromeStatus;
    if (!browserCleanup.processesAbsent) throw new Error("owned Chrome processes survived cleanup");
    const chromeInfoAfter = await Deno.stat(chromePath);
    if (
      chromeInfoBefore.dev !== chromeInfoAfter.dev ||
      chromeInfoBefore.ino !== chromeInfoAfter.ino ||
      await sha256Hex(await Deno.readFile(chromePath)) !== observedChromeSha256
    ) throw new Error("Chrome executable identity changed across collection");
    await Deno.remove(profilePath, { recursive: true });
    let profileAbsent = false;
    try {
      await Deno.lstat(profilePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) profileAbsent = true;
      else throw error;
    }
    if (!profileAbsent) throw new Error("owned Chrome profile survived cleanup");

    if (await identityStillRunning(serverIdentity)) Deno.kill(serverIdentity.pid, "SIGTERM");
    const serverCleanup = await exactProcessCleanup([serverIdentity]);
    const serverExit = await serverStatus;
    if (!serverCleanup.processesAbsent) throw new Error("owned loopback server survived cleanup");

    const evidence = {
      schemaVersion: 1,
      evidenceId: "crypto.file-integrity.v1-chrome-browser-validation-v1",
      collectedAt: new Date().toISOString(),
      source: { ...source, collectorSha256 },
      browser: {
        product: String(version.product),
        revision: String(version.revision),
        userAgent: String(version.userAgent),
        jsVersion: String(version.jsVersion),
        executable: chromePath,
        executableSha256: observedChromeSha256,
        launchArguments,
        effectiveArguments,
        headless: true,
        protocol: "Chrome DevTools Protocol",
        devtools: {
          address: "127.0.0.1",
          port: debuggerPort,
          browserPath: webSocketUrl.pathname,
          webSocketOrigin: webSocketUrl.origin,
        },
        profile: {
          path: profilePath,
          dev: Number(profileInfo.dev),
          ino: Number(profileInfo.ino),
          mode: Number(profileInfo.mode) & 0o777,
        },
      },
      server: { origin, address: "127.0.0.1", port: serverPort, mode: "public" },
      fetchedAssets,
      cases,
      visibleControlRun: {
        caseId: visibleExpected.id,
        finalStatus: String(visibleState.status),
        output: visibleOutput,
        passed: true,
      },
      lifecycle,
      console: { messages: consoleMessages, exceptions },
      network: networkRecords,
      accessibility: {
        lang: accessibility.lang,
        title: accessibility.title,
        live: accessibility.live,
        outputTabIndex: accessibility.outputTabIndex,
        bodyTextSha256: await sha256Hex(new TextEncoder().encode(bodyText)),
        requiredText,
        controls: accessibility.controls,
        axNodes,
        passed: true,
      },
      screenshot: {
        path: `${OUTPUT_ROOT}/screenshots/visible-complete.png`,
        bytes: screenshotBytes.byteLength,
        sha256: await sha256Hex(screenshotBytes),
      },
      cleanup: {
        browser: {
          launcher,
          observedProcesses,
          requested: "Browser.close",
          signals: browserCleanup.signals,
          exit: browserExit,
          processesAbsent: true,
          executableUnchanged: true,
        },
        profile: { path: profilePath, removed: true, absent: true },
        server: {
          launcher: serverIdentity,
          signal: "SIGTERM",
          signals: serverCleanup.signals,
          exit: serverExit,
          processAbsent: true,
        },
      },
    };
    await assertClosedEvidenceSchema(evidence, source.root);
    await Deno.writeTextFile(`${partialRoot}/evidence.v1.json`, `${canonicalize(evidence)}\n`);
    await Deno.rename(partialRoot, `${source.root}/${OUTPUT_ROOT}`);
    success = true;
    console.log("crypto browser evidence: 36/36 cases and 6/6 lifecycle controls; cleanup exact");
  } finally {
    if (!success) {
      try {
        await client?.send("Browser.close");
      } catch {
        // Continue only with identities descended from the owned parent process.
      }
      client?.close();
      const remainingChrome = await ownedProcesses(chrome.pid);
      await exactProcessCleanup(remainingChrome);
      await chromeStatus.catch(() => {});
      const currentServer = await processIdentity(server.pid);
      if (currentServer && await identityStillRunning(currentServer)) {
        Deno.kill(currentServer.pid, "SIGTERM");
      }
      await serverStatus.catch(() => {});
      await Deno.remove(profilePath, { recursive: true }).catch(() => {});
      await Deno.remove(partialRoot, { recursive: true }).catch(() => {});
    }
  }
}

function argument(name: string): string {
  const prefix = `--${name}=`;
  const values = Deno.args.filter((value) => value.startsWith(prefix));
  if (values.length !== 1 || values[0].length === prefix.length) {
    throw new Error(`exactly one ${prefix}<value> argument is required`);
  }
  return values[0].slice(prefix.length);
}

if (import.meta.main) {
  const allowed = new Set([
    "source-root",
    "source-commit",
    "chrome",
    "chrome-sha256",
    "chrome-product",
  ]);
  for (const value of Deno.args) {
    const match = /^--([^=]+)=/.exec(value);
    if (!match || !allowed.has(match[1])) throw new Error(`unknown collector argument: ${value}`);
  }
  await runCollector({
    sourceRoot: argument("source-root"),
    sourceCommit: argument("source-commit"),
    chrome: argument("chrome"),
    chromeSha256: argument("chrome-sha256"),
    chromeProduct: argument("chrome-product"),
  });
}

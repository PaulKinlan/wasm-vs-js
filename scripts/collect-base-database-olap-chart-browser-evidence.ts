import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";
import { prepareProfile, ProfileIdentity, removeOwnedProfile } from "../lib/process-ledger.ts";

const Ajv2020 = ((Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module) as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  };
const addFormats =
  ((addFormatsModule as unknown as { default?: (value: unknown) => void }).default ??
    addFormatsModule) as unknown as (value: unknown) => void;

export const EXPECTED_CHROME_PRODUCT = "Chrome/150.0.7871.24";
export const WORKLOAD_ID = "database.olap-chart.v1";
export const WORKLOAD_ROUTE = "/benchmarks/database-olap-chart/";
export const TARGETS = ["js-controlled", "wasm-linear-controlled"] as const;
export const LIFECYCLE_IDS = [
  "wrong-token",
  "stale",
  "restart",
  "timeout",
  "cancel",
  "pagehide",
] as const;
const SCRIPT_PATH = "scripts/collect-base-database-olap-chart-browser-evidence.ts";
const SCHEMA_PATH = "schemas/base-database-olap-chart-browser-evidence.schema.json";
const TEST_PATH = "tests/base/database-olap-chart-browser-collector.test.ts";
const EXPECTED_DIGEST = "e26a152f";
const EXPECTED_WORDS = 560;
const EXPECTED_BYTES = 2_240;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type Json = Record<string, unknown>;
type Target = (typeof TARGETS)[number];
type LifecycleId = (typeof LIFECYCLE_IDS)[number];
type ProcessIdentity = {
  pid: number;
  parentPid: number;
  startTimeTicks: string;
  executable: string;
};
type FileIdentity = {
  path: string;
  bytes: number;
  sha256: string;
  dev: number;
  ino: number;
};
type SessionIdentity = { targetId: string; context: "page" | "worker" };
type RequestCapture = {
  targetId: string;
  sessionId: string;
  requestId: string;
  url: string;
  method: string;
  resourceType: string;
  status: number | null;
  mimeType: string | null;
  fromDiskCache: boolean;
  fromServiceWorker: boolean;
  failed: boolean;
  errorText: string | null;
  rawBytes: Uint8Array | null;
};

export const SOURCE_PATHS = [
  SCRIPT_PATH,
  SCHEMA_PATH,
  TEST_PATH,
  "lib/canonical.ts",
  "lib/cdp-client.ts",
  "lib/process-ledger.ts",
  "scripts/remove-owned-tree.py",
  "deploy.ts",
  "server.ts",
  "public/benchmarks/database-olap-chart/index.html",
  "public/benchmarks/database-olap-chart/runner.js",
  "public/benchmarks/database-olap-chart/worker.js",
  "benchmarks/base/database-olap-chart/browser-validation.js",
  "benchmarks/base/database-olap-chart/engine.js",
  "benchmarks/base/database-olap-chart/fixture.js",
  "public/styles.css",
  "public/artifacts/database-olap-chart/build-manifest.json",
  "public/artifacts/database-olap-chart/fixture-manifest.json",
  "public/artifacts/database-olap-chart/output-manifest.json",
  "public/artifacts/database-olap-chart/fixture.bin",
  "public/artifacts/database-olap-chart/database-olap-chart.wasm",
] as const;

export const ROUTE_SOURCES: Readonly<Record<string, string>> = Object.freeze({
  [WORKLOAD_ROUTE]: "public/benchmarks/database-olap-chart/index.html",
  "/styles.css": "public/styles.css",
  "/benchmarks/database-olap-chart/runner.js": "public/benchmarks/database-olap-chart/runner.js",
  "/benchmarks/database-olap-chart/worker.js": "public/benchmarks/database-olap-chart/worker.js",
  "/benchmarks/base/database-olap-chart/browser-validation.js":
    "benchmarks/base/database-olap-chart/browser-validation.js",
  "/benchmarks/base/database-olap-chart/engine.js": "benchmarks/base/database-olap-chart/engine.js",
  "/benchmarks/base/database-olap-chart/fixture.js":
    "benchmarks/base/database-olap-chart/fixture.js",
  "/artifacts/database-olap-chart/build-manifest.json":
    "public/artifacts/database-olap-chart/build-manifest.json",
  "/artifacts/database-olap-chart/fixture-manifest.json":
    "public/artifacts/database-olap-chart/fixture-manifest.json",
  "/artifacts/database-olap-chart/output-manifest.json":
    "public/artifacts/database-olap-chart/output-manifest.json",
  "/artifacts/database-olap-chart/fixture.bin": "public/artifacts/database-olap-chart/fixture.bin",
  "/artifacts/database-olap-chart/database-olap-chart.wasm":
    "public/artifacts/database-olap-chart/database-olap-chart.wasm",
  "/favicon.ico": "public/favicon.svg",
  "/favicon.svg": "public/favicon.svg",
});

const COMPLETE_ROUTES = Object.keys(ROUTE_SOURCES).filter((route) =>
  route !== "/favicon.ico" && route !== "/favicon.svg"
);
const LIFECYCLE_ROUTES = [
  WORKLOAD_ROUTE,
  "/styles.css",
  "/benchmarks/database-olap-chart/runner.js",
];

function exactJson(actual: unknown, expected: unknown, label: string): void {
  if (canonicalize(actual) !== canonicalize(expected)) throw new Error(`${label} mismatch`);
}

export function validateCompleteResult(actual: unknown, target: Target, oracle: Json): Json {
  if (!actual || Object.getPrototypeOf(actual) !== Object.prototype) {
    throw new Error(`${target} browser result framing invalid`);
  }
  const result = actual as Json;
  const expectedKeys = [
    "chartModels",
    "counters",
    "digest",
    "outputBytes",
    "validation",
    "variantId",
    "workloadId",
  ];
  exactJson(Object.keys(result).sort(), expectedKeys.sort(), `${target} browser result keys`);
  if (
    result.workloadId !== WORKLOAD_ID || result.variantId !== target ||
    result.digest !== EXPECTED_DIGEST || result.outputBytes !== EXPECTED_BYTES
  ) throw new Error(`${target} browser result identity or complete-output digest mismatch`);
  const completeOutput = oracle.completeOutput as Json;
  if (
    oracle.schemaVersion !== 1 || oracle.workloadId !== WORKLOAD_ID ||
    completeOutput.digest !== EXPECTED_DIGEST || completeOutput.words !== EXPECTED_WORDS ||
    completeOutput.bytes !== EXPECTED_BYTES ||
    !Array.isArray(completeOutput.values) || completeOutput.values.length !== EXPECTED_WORDS
  ) throw new Error("frozen 560-word oracle identity mismatch");
  const models = result.chartModels as Json[];
  if (
    !Array.isArray(models) || models.length !== 5 ||
    models.some((model, index) =>
      model.query !== index || model.controlRevision !== index + 1 ||
      !Array.isArray(model.bins) || model.bins.length !== 16 ||
      !Array.isArray(model.topRows) || model.topRows.length !== 8
    )
  ) throw new Error(`${target} five chart models are incomplete`);
  exactJson(models, completeOutput.chartModels, `${target} five chart models`);
  const variant = (oracle.variants as Json)[target] as Json;
  exactJson(result.counters, variant.counters, `${target} counters`);
  exactJson(result.validation, {
    expectedDigest: EXPECTED_DIGEST,
    exactArtifactHashes: true,
    fullOutputValidated: true,
    countersValidated: true,
    crossTargetValidated: true,
    oracleValidated: true,
    allFiveModelsValidated: true,
  }, `${target} complete correctness validation`);
  return result;
}

export function validateAccessibleResults(
  values: unknown,
  result: Json,
  oracle: Json,
): void {
  if (!Array.isArray(values) || values.length !== 5) {
    throw new Error("accessible textual result did not expose all five chart models");
  }
  const expectedModels = (oracle.completeOutput as Json).chartModels as Json[];
  values.forEach((entry, index) => {
    const value = entry as Json;
    if (value.query !== index || typeof value.rawText !== "string" || !value.rawText) {
      throw new Error(`accessible query ${index + 1} framing mismatch`);
    }
    const parsed = JSON.parse(value.rawText as string) as Json;
    exactJson(parsed.displayedChartModel, expectedModels[index], `accessible query ${index + 1}`);
    exactJson(parsed.counters, result.counters, `accessible query ${index + 1} counters`);
    exactJson(parsed.validation, result.validation, `accessible query ${index + 1} validation`);
    if (
      parsed.workloadId !== WORKLOAD_ID || parsed.variantId !== result.variantId ||
      parsed.digest !== EXPECTED_DIGEST
    ) throw new Error(`accessible query ${index + 1} identity mismatch`);
  });
}

export function validateLifecycleRecord(value: Json, id: LifecycleId): void {
  if (
    value.id !== id || value.action !== "controller-lifecycle-probe" ||
    value.assertionPassed !== true || Number(value.workerCount) < 1 ||
    Number(value.terminatedWorkers) < 1
  ) throw new Error(`${id} lifecycle evidence incomplete`);
  const assertions = value.assertions as Json;
  const expected = {
    wrongTokenIgnored: id === "wrong-token",
    staleWorkerIgnored: id === "stale",
    restartReplacedWorker: id === "restart",
    timeoutTerminatedWorker: id === "timeout",
    cancelTerminatedWorker: id === "cancel",
    pagehideTerminatedWorker: id === "pagehide",
  };
  exactJson(assertions, expected, `${id} lifecycle semantics`);
}

async function commandText(root: string, command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, {
    cwd: root,
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
  if (!info.isFile || info.isSymlink) throw new Error(`not a regular file: ${path}`);
  const bytes = await Deno.readFile(realPath);
  return {
    path: realPath,
    bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    dev: Number(info.dev),
    ino: Number(info.ino),
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

async function identityRunning(identity: ProcessIdentity): Promise<boolean> {
  const current = await processIdentity(identity.pid);
  return current?.startTimeTicks === identity.startTimeTicks &&
    current.executable === identity.executable;
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

function decodeBody(body: string, base64Encoded: boolean): Uint8Array {
  return base64Encoded
    ? Uint8Array.from(atob(body), (character) => character.charCodeAt(0))
    : textEncoder.encode(body);
}

async function readCgroupMembers(path: string): Promise<number[]> {
  return (await Deno.readTextFile(`${path}/cgroup.procs`)).split(/\s+/).filter(Boolean).map(Number)
    .filter((pid) => Number.isSafeInteger(pid) && pid > 1).sort((a, b) => a - b);
}

async function systemdShow(root: string, unit: string): Promise<Record<string, string>> {
  const text = await commandText(root, "/usr/bin/systemctl", [
    "--user",
    "show",
    unit,
    "--property=MainPID,ControlGroup,ActiveState,InvocationID",
  ]);
  return Object.fromEntries(
    text.split("\n").filter(Boolean).map((line) => {
      const equals = line.indexOf("=");
      return [line.slice(0, equals), line.slice(equals + 1)];
    }),
  );
}

async function waitSystemd(root: string, unit: string): Promise<Record<string, string>> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const state = await systemdShow(root, unit);
    if (
      state.ActiveState === "active" && Number(state.MainPID) > 1 &&
      state.ControlGroup?.startsWith("/") && /^[a-f0-9]{32}$/.test(state.InvocationID ?? "")
    ) return state;
    await delay(25);
  }
  throw new Error("owned Chrome systemd service did not become active");
}

async function evaluate(
  client: CdpClient,
  sessionId: string,
  expression: string,
  timeoutMs = 10_000,
): Promise<unknown> {
  const response = await client.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
    timeoutMs,
  );
  if (response.exceptionDetails) throw new Error("browser evaluation failed");
  return (response.result as { value?: unknown }).value;
}

async function click(client: CdpClient, sessionId: string, selector: string): Promise<void> {
  const point = await evaluate(
    client,
    sessionId,
    `(() => { const node=document.querySelector(${
      JSON.stringify(selector)
    }); const r=node.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:node.disabled}; })()`,
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

async function pageState(client: CdpClient, sessionId: string): Promise<Json> {
  return await evaluate(
    client,
    sessionId,
    `(() => ({status:document.querySelector('#status').textContent.trim(),result:document.querySelector('#result').textContent.trim(),chartLabel:document.querySelector('#chart').getAttribute('aria-label'),startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled,statusHistory:[...__olapCollector.statuses],workerCount:__olapCollector.workers.length,terminatedWorkers:__olapCollector.workers.filter((entry)=>entry.terminated).length}))()`,
  ) as Json;
}

async function waitState(
  client: CdpClient,
  sessionId: string,
  predicate: (state: Json) => boolean,
  timeoutMs = 20_000,
): Promise<Json> {
  const deadline = Date.now() + timeoutMs;
  let state: Json = {};
  while (Date.now() < deadline) {
    state = await pageState(client, sessionId);
    if (predicate(state)) return state;
    await delay(25);
  }
  throw new Error(`browser state timeout: ${JSON.stringify(state)}`);
}

function pageProbeSource(fakeWorker: boolean, shortenTimeout: boolean): string {
  return `(() => {
    const probe={workers:[],messages:[],statuses:[]}; globalThis.__olapCollector=probe;
    const track=(worker,url)=>{const entry={worker,url:String(url),terminated:false,posted:null};probe.workers.push(entry);const terminate=worker.terminate?.bind(worker);worker.terminate=()=>{entry.terminated=true;return terminate?.()};worker.addEventListener?.('message',(event)=>{try{probe.messages.push(structuredClone(event.data))}catch{probe.messages.push({type:'uncloneable'})}});return worker};
    ${
    fakeWorker
      ? `class FakeWorker extends EventTarget{constructor(url){super();this.onmessage=null;this.onerror=null;this.url=String(url);track(this,url)}postMessage(value){const entry=probe.workers.find((item)=>item.worker===this);entry.posted=structuredClone(value)}terminate(){}emit(value){probe.messages.push(structuredClone(value));this.onmessage?.({data:structuredClone(value)})}fail(message){this.onerror?.({message})}};globalThis.Worker=FakeWorker;`
      : `const NativeWorker=globalThis.Worker;function WrappedWorker(...args){return track(new NativeWorker(...args),args[0])}WrappedWorker.prototype=NativeWorker.prototype;globalThis.Worker=WrappedWorker;`
  }
    ${
    shortenTimeout
      ? `const nativeSetTimeout=globalThis.setTimeout.bind(globalThis);globalThis.setTimeout=(fn,delay,...args)=>nativeSetTimeout(fn,delay===15000?50:delay,...args);`
      : ""
  }
    addEventListener('DOMContentLoaded',()=>{const status=document.querySelector('#status');const record=()=>{const value=status?.textContent?.trim();if(value&&probe.statuses.at(-1)!==value)probe.statuses.push(value)};record();new MutationObserver(record).observe(status,{childList:true,characterData:true,subtree:true})});
  })()`;
}

async function accessibilityEvidence(client: CdpClient, sessionId: string, expectedStatus: string) {
  const facts = await evaluate(
    client,
    sessionId,
    `(() => ({lang:document.documentElement.lang,heading:document.querySelector('h1').textContent.trim(),bodyText:document.body.innerText,status:document.querySelector('#status').textContent.trim(),statusRole:document.querySelector('#status').getAttribute('role'),statusLive:document.querySelector('#status').getAttribute('aria-live'),resultText:document.querySelector('#result').textContent.trim(),resultTabIndex:document.querySelector('#result').tabIndex}))()`,
  ) as Json;
  const tree = await client.send("Accessibility.getFullAXTree", {}, sessionId, 10_000);
  const nodes = ((tree.nodes as Json[]) ?? []).map((node) => ({
    role: String((node.role as Json | undefined)?.value ?? ""),
    name: String((node.name as Json | undefined)?.value ?? ""),
  })).filter((node) => node.role || node.name);
  const has = (role: string, name: string) =>
    nodes.some((node) => node.role === role && node.name === name);
  const assertions = {
    languageEnglish: facts.lang === "en",
    mainLandmark: nodes.some((node) => node.role === "main"),
    namedHeading: has("heading", "Five-query OLAP chart trace"),
    labelledTarget: has("combobox", "Engine"),
    labelledQuery: has("combobox", "Chart model to display"),
    namedControls: has("button", "Start complete five-query trace") && has("button", "Cancel"),
    liveStatus: facts.status === expectedStatus && facts.statusRole === "status" &&
      facts.statusLive === "polite",
    keyboardTextResult: facts.resultTabIndex === 0 && typeof facts.resultText === "string",
  };
  if (Object.values(assertions).some((value) => !value)) {
    throw new Error(`accessibility assertions failed: ${JSON.stringify(assertions)}`);
  }
  return {
    bodyTextSha256: await sha256Hex(textEncoder.encode(String(facts.bodyText))),
    statusText: String(facts.status),
    resultText: String(facts.resultText),
    resultTextSha256: await sha256Hex(textEncoder.encode(String(facts.resultText))),
    inspectedAxNodes: nodes.length,
    axTreeSha256: await sha256Hex(textEncoder.encode(canonicalize(nodes))),
    assertions,
  };
}

async function screenshotEvidence(
  client: CdpClient,
  sessionId: string,
  path: string,
  recordedPath: string,
) {
  const result = await client.send(
    "Page.captureScreenshot",
    {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
    },
    sessionId,
    10_000,
  );
  const bytes = decodeBody(String(result.data), true);
  if (canonicalize([...bytes.slice(0, 8)]) !== canonicalize([137, 80, 78, 71, 13, 10, 26, 10])) {
    throw new Error("captured screenshot is not PNG");
  }
  await Deno.writeFile(path, bytes, { createNew: true });
  return {
    path: recordedPath,
    format: "png",
    bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
  };
}

async function sourceRecord(root: string, commit: string, path: string) {
  const bytes = await Deno.readFile(`${root}/${path}`);
  const committed = await new Deno.Command("git", {
    cwd: root,
    args: ["show", `${commit}:${path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!committed.success || await sha256Hex(committed.stdout) !== await sha256Hex(bytes)) {
    throw new Error(`clean-HEAD source bytes differ: ${path}`);
  }
  return {
    path,
    bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    gitBlob: await commandText(root, "git", ["rev-parse", `${commit}:${path}`]),
  };
}

async function assertSource(root: string, commit: string) {
  const top = await Deno.realPath(await commandText(root, "git", ["rev-parse", "--show-toplevel"]));
  if (top !== root) throw new Error("collector must run from the exact Git source root");
  const head = await commandText(root, "git", ["rev-parse", "HEAD"]);
  const tree = await commandText(root, "git", ["rev-parse", "HEAD^{tree}"]);
  const status = await commandText(root, "git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (head !== commit || status !== "" || !/^[a-f0-9]{40}$/.test(tree)) {
    throw new Error("collector requires the requested exact clean HEAD");
  }
  const files = [];
  for (const path of SOURCE_PATHS) files.push(await sourceRecord(root, commit, path));
  return { commit, tree, root, clean: true, files };
}

async function assertSourceUnchanged(root: string, source: Json) {
  const end = {
    commit: await commandText(root, "git", ["rev-parse", "HEAD"]),
    tree: await commandText(root, "git", ["rev-parse", "HEAD^{tree}"]),
    status: await commandText(root, "git", [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]),
  };
  if (end.commit !== source.commit || end.tree !== source.tree || end.status !== "") {
    throw new Error("end-of-collection source tree TOCTOU check failed");
  }
  return { commit: end.commit, tree: end.tree, clean: true, checkedAfterCleanup: true };
}

async function collectScenario(
  client: CdpClient,
  root: string,
  origin: string,
  oracle: Json,
  definition: {
    id: string;
    kind: "complete" | "lifecycle";
    target: Target;
    lifecycle?: LifecycleId;
  },
  screenshotPath: string,
  screenshotRecordPath: string,
) {
  const created = await client.send("Target.createTarget", { url: "about:blank" });
  const targetId = String(created.targetId);
  const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = String(attached.sessionId);
  const sessions = new Map<string, SessionIdentity>([[sessionId, { targetId, context: "page" }]]);
  const requests = new Map<string, RequestCapture>();
  const responseTasks: Promise<void>[] = [];
  const setupTasks: Promise<void>[] = [];
  const consoleMessages: Json[] = [];
  const exceptions: Json[] = [];
  const requestKey = (eventSession: string | undefined, requestId: unknown) =>
    `${eventSession ?? ""}:${String(requestId)}`;
  const removers = [
    client.on("Target.attachedToTarget", (params, eventSession) => {
      if (eventSession !== sessionId || (params.targetInfo as Json).type !== "worker") return;
      const workerSession = String(params.sessionId);
      sessions.set(workerSession, {
        targetId: String((params.targetInfo as Json).targetId),
        context: "worker",
      });
      setupTasks.push((async () => {
        await Promise.all([
          client.send("Network.enable", { maxTotalBufferSize: 50_000_000 }, workerSession),
          client.send("Network.setCacheDisabled", { cacheDisabled: true }, workerSession),
          client.send("Network.setBypassServiceWorker", { bypass: true }, workerSession),
          client.send("Runtime.enable", {}, workerSession),
        ]);
        await client.send("Runtime.runIfWaitingForDebugger", {}, workerSession);
      })());
    }),
    client.on("Runtime.consoleAPICalled", (params, eventSession) => {
      const identity = eventSession ? sessions.get(eventSession) : undefined;
      if (!identity) return;
      consoleMessages.push({
        context: identity.context,
        type: String(params.type),
        arguments: ((params.args as Json[]) ?? []).map((arg) =>
          String(arg.value ?? arg.description ?? arg.type)
        ),
      });
    }),
    client.on("Runtime.exceptionThrown", (params, eventSession) => {
      const identity = eventSession ? sessions.get(eventSession) : undefined;
      if (!identity) return;
      const details = params.exceptionDetails as Json;
      exceptions.push({
        context: identity.context,
        text: String(details.text),
        lineNumber: Number(details.lineNumber),
        columnNumber: Number(details.columnNumber),
      });
    }),
    client.on("Network.requestWillBeSent", (params, eventSession) => {
      const identity = eventSession ? sessions.get(eventSession) : undefined;
      if (!eventSession || !identity) return;
      const request = params.request as Json;
      requests.set(requestKey(eventSession, params.requestId), {
        targetId: identity.targetId,
        sessionId: eventSession,
        requestId: String(params.requestId),
        url: String(request.url),
        method: String(request.method),
        resourceType: String(params.type),
        status: null,
        mimeType: null,
        fromDiskCache: false,
        fromServiceWorker: false,
        failed: false,
        errorText: null,
        rawBytes: null,
      });
    }),
    client.on("Network.responseReceived", (params, eventSession) => {
      const request = requests.get(requestKey(eventSession, params.requestId));
      if (!request) return;
      const response = params.response as Json;
      request.status = Number(response.status);
      request.mimeType = String(response.mimeType);
      request.fromDiskCache = Boolean(response.fromDiskCache);
      request.fromServiceWorker = Boolean(response.fromServiceWorker);
    }),
    client.on("Network.loadingFailed", (params, eventSession) => {
      const request = requests.get(requestKey(eventSession, params.requestId));
      if (!request) return;
      request.failed = true;
      request.errorText = String(params.errorText);
    }),
    client.on("Network.loadingFinished", (params, eventSession) => {
      const request = requests.get(requestKey(eventSession, params.requestId));
      if (!request || !eventSession) return;
      responseTasks.push((async () => {
        const response = await client.send(
          "Network.getResponseBody",
          { requestId: String(params.requestId) },
          eventSession,
          10_000,
        );
        request.rawBytes = decodeBody(String(response.body), Boolean(response.base64Encoded));
      })());
    }),
  ];
  try {
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", { maxTotalBufferSize: 50_000_000 }, sessionId),
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
      source: pageProbeSource(definition.kind === "lifecycle", definition.lifecycle === "timeout"),
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
    await waitState(
      client,
      sessionId,
      (state) => state.status === "Ready. The worker stops after 15 seconds.",
      10_000,
    );
    await evaluate(
      client,
      sessionId,
      `(() => { const select=document.querySelector('#target');select.value=${
        JSON.stringify(definition.target)
      };select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
    );
    await click(client, sessionId, "#start");
    let semantic: Json;
    let finalState: Json;
    if (definition.kind === "complete") {
      finalState = await waitState(
        client,
        sessionId,
        (state) =>
          state.status === "Complete. Artifact hashes, both targets, and all five models passed.",
      );
      const messages = await evaluate(client, sessionId, "__olapCollector.messages") as Json[];
      const completion = [...messages].reverse().find((message) => message.type === "result");
      const result = validateCompleteResult(completion?.result, definition.target, oracle);
      const accessibleResults = [];
      for (let query = 0; query < 5; query += 1) {
        const value = await evaluate(
          client,
          sessionId,
          `(() => { const select=document.querySelector('#query');select.value=${
            JSON.stringify(String(query))
          };select.dispatchEvent(new Event('change',{bubbles:true}));return {query:${query},rawText:document.querySelector('#result').textContent.trim(),chartLabel:document.querySelector('#chart').getAttribute('aria-label')}; })()`,
        ) as Json;
        value.rawTextSha256 = await sha256Hex(textEncoder.encode(String(value.rawText)));
        accessibleResults.push(value);
      }
      validateAccessibleResults(accessibleResults, result, oracle);
      semantic = { result, accessibleResults, assertionPassed: true };
      finalState = await pageState(client, sessionId);
    } else {
      const id = definition.lifecycle!;
      const falseAssertions = {
        wrongTokenIgnored: false,
        staleWorkerIgnored: false,
        restartReplacedWorker: false,
        timeoutTerminatedWorker: false,
        cancelTerminatedWorker: false,
        pagehideTerminatedWorker: false,
      };
      if (id === "wrong-token") {
        const before = await pageState(client, sessionId);
        await evaluate(
          client,
          sessionId,
          `(() => {const w=__olapCollector.workers[0].worker;const token=__olapCollector.workers[0].posted.token;w.emit({type:'result',token:token+1,result:{}})})()`,
        );
        const after = await pageState(client, sessionId);
        falseAssertions.wrongTokenIgnored = before.status === after.status &&
          before.result === after.result;
        await click(client, sessionId, "#cancel");
      } else if (id === "stale") {
        await click(client, sessionId, "#cancel");
        await click(client, sessionId, "#start");
        const before = await pageState(client, sessionId);
        await evaluate(
          client,
          sessionId,
          `(() => {const stale=__olapCollector.workers[0].worker;const token=__olapCollector.workers[0].posted.token;stale.emit({type:'result',token,result:{}});stale.fail('stale injected error')})()`,
        );
        const after = await pageState(client, sessionId);
        falseAssertions.staleWorkerIgnored = before.status === after.status &&
          before.result === after.result;
        await click(client, sessionId, "#cancel");
      } else if (id === "restart") {
        await evaluate(
          client,
          sessionId,
          `document.querySelector('#controls').dispatchEvent(new SubmitEvent('submit',{bubbles:true,cancelable:true}))`,
        );
        falseAssertions.restartReplacedWorker = Boolean(
          await evaluate(
            client,
            sessionId,
            `__olapCollector.workers.length===2&&__olapCollector.workers[0].terminated&&!__olapCollector.workers[1].terminated`,
          ),
        );
        await click(client, sessionId, "#cancel");
      } else if (id === "timeout") {
        await waitState(
          client,
          sessionId,
          (state) =>
            state.status === "Timed out after 15 seconds; the owned worker was terminated.",
          2_000,
        );
        falseAssertions.timeoutTerminatedWorker = true;
      } else if (id === "cancel") {
        await click(client, sessionId, "#cancel");
        falseAssertions.cancelTerminatedWorker = true;
      } else {
        await evaluate(
          client,
          sessionId,
          `dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))`,
        );
        const before = await pageState(client, sessionId);
        await evaluate(
          client,
          sessionId,
          `(() => {const w=__olapCollector.workers[0].worker;const token=__olapCollector.workers[0].posted.token;w.emit({type:'result',token,result:{}})})()`,
        );
        const after = await pageState(client, sessionId);
        falseAssertions.pagehideTerminatedWorker = before.status === after.status &&
          before.result === after.result;
      }
      finalState = await pageState(client, sessionId);
      const record: Json = {
        id,
        action: "controller-lifecycle-probe",
        finalState,
        workerCount: finalState.workerCount,
        terminatedWorkers: finalState.terminatedWorkers,
        assertions: falseAssertions,
        assertionPassed: Object.values(falseAssertions).filter(Boolean).length === 1,
      };
      validateLifecycleRecord(record, id);
      semantic = record;
    }

    for (let cursor = 0; cursor < setupTasks.length; cursor++) await setupTasks[cursor];
    await delay(100);
    for (let cursor = 0; cursor < responseTasks.length; cursor++) await responseTasks[cursor];
    if (exceptions.length || consoleMessages.some((entry) => entry.type === "error")) {
      throw new Error(`${definition.id} observed console errors or exceptions`);
    }
    const requiredRoutes = definition.kind === "complete" ? COMPLETE_ROUTES : LIFECYCLE_ROUTES;
    const network = [];
    for (const request of requests.values()) {
      const parsed = new URL(request.url);
      const sourcePath = ROUTE_SOURCES[parsed.pathname];
      if (
        parsed.origin !== origin || !sourcePath || request.method !== "GET" ||
        request.status !== 200 || request.failed || request.fromDiskCache ||
        request.fromServiceWorker || !request.rawBytes
      ) {
        throw new Error(
          `${definition.id} network response was not exact owned-origin raw evidence`,
        );
      }
      const sourceBytes = await Deno.readFile(`${root}/${sourcePath}`);
      const sourceSha256 = await sha256Hex(sourceBytes);
      const rawResponseSha256 = await sha256Hex(request.rawBytes);
      if (
        request.rawBytes.byteLength !== sourceBytes.byteLength ||
        rawResponseSha256 !== sourceSha256
      ) throw new Error(`${definition.id} raw response differs from exact clean-HEAD source`);
      network.push({
        targetId: request.targetId,
        targetIdSha256: await sha256Hex(textEncoder.encode(request.targetId)),
        sessionId: request.sessionId,
        sessionIdSha256: await sha256Hex(textEncoder.encode(request.sessionId)),
        requestId: request.requestId,
        requestIdSha256: await sha256Hex(textEncoder.encode(request.requestId)),
        url: request.url,
        route: parsed.pathname,
        method: request.method,
        resourceType: request.resourceType,
        status: request.status,
        mimeType: request.mimeType,
        fromDiskCache: false,
        fromServiceWorker: false,
        failed: false,
        sourcePath,
        sourceBytes: sourceBytes.byteLength,
        sourceSha256,
        sourceGitBlob: await commandText(root, "git", ["rev-parse", `HEAD:${sourcePath}`]),
        rawResponseBytes: request.rawBytes.byteLength,
        rawResponseSha256,
        exactSourceMatch: true,
      });
    }
    for (const route of requiredRoutes) {
      if (!network.some((entry) => entry.route === route)) {
        throw new Error(`${definition.id} omitted required raw response: ${route}`);
      }
    }
    const accessibility = await accessibilityEvidence(
      client,
      sessionId,
      String(finalState.status),
    );
    const screenshot = await screenshotEvidence(
      client,
      sessionId,
      screenshotPath,
      screenshotRecordPath,
    );
    return {
      id: definition.id,
      kind: definition.kind,
      target: definition.target,
      route: WORKLOAD_ROUTE,
      targetId,
      targetIdSha256: await sha256Hex(textEncoder.encode(targetId)),
      sessionId,
      sessionIdSha256: await sha256Hex(textEncoder.encode(sessionId)),
      finalState,
      semantic,
      console: consoleMessages,
      exceptions,
      network,
      accessibility,
      screenshot,
    };
  } finally {
    for (const remove of removers) remove();
    await client.send("Target.closeTarget", { targetId }).catch(() => ({}));
  }
}

async function validateSchema(root: string, evidence: unknown): Promise<void> {
  const schema = JSON.parse(await Deno.readTextFile(`${root}/${SCHEMA_PATH}`));
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(evidence)) {
    throw new Error(`browser evidence schema failed: ${JSON.stringify(validate.errors)}`);
  }
}

async function runCollector(): Promise<void> {
  const options = Object.fromEntries(Deno.args.map((argument) => {
    const match = /^--([a-z-]+)=(.+)$/.exec(argument);
    if (!match) throw new Error(`invalid argument: ${argument}`);
    return [match[1], match[2]];
  }));
  if (
    Deno.args.length !== 4 || !/^[a-f0-9]{40}$/.test(options["source-commit"] ?? "") ||
    !options["source-root"] || !options.chrome || !options.output
  ) {
    throw new Error(
      `usage: deno run -A ${SCRIPT_PATH} --source-root=<exact-root> --source-commit=<clean-HEAD> --chrome=<path> --output=<absolute-new-json>`,
    );
  }
  if (Deno.build.os !== "linux") throw new Error("exact cgroup-owned cleanup requires Linux");
  const root = await Deno.realPath(options["source-root"]);
  if (Deno.cwd() !== root) {
    throw new Error("collector must be parent-run from the exact source root");
  }
  if (!options.output.startsWith("/") || !options.output.endsWith(".json")) {
    throw new Error("output must be an absolute JSON path");
  }
  const outputParent = options.output.slice(0, options.output.lastIndexOf("/")) || "/";
  const resolvedOutputParent = await Deno.realPath(outputParent);
  if (resolvedOutputParent === root || resolvedOutputParent.startsWith(`${root}/`)) {
    throw new Error("evidence output must remain outside the exact clean source root");
  }
  const outputName = options.output.slice(options.output.lastIndexOf("/") + 1, -5);
  const finalScreenshotDirectory = `${outputParent}/${outputName}.screenshots`;
  for (const path of [options.output, finalScreenshotDirectory]) {
    try {
      await Deno.lstat(path);
      throw new Error(`immutable browser evidence path already exists: ${path}`);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  const partialRoot = `${outputParent}/.${outputName}-${crypto.randomUUID()}`;
  const partialScreenshots = `${partialRoot}/screenshots`;
  const source = await assertSource(root, options["source-commit"]);
  const oracle = JSON.parse(
    await Deno.readTextFile(`${root}/public/artifacts/database-olap-chart/output-manifest.json`),
  ) as Json;
  const completeOutput = oracle.completeOutput as Json;
  if (!Array.isArray(completeOutput.values) || completeOutput.values.length !== EXPECTED_WORDS) {
    throw new Error("frozen complete output does not contain exactly 560 words");
  }
  const chromeBefore = await fileIdentity(options.chrome);
  await Deno.mkdir(partialScreenshots, { recursive: true });

  const serverPort = unusedPort();
  const origin = `http://127.0.0.1:${serverPort}`;
  let server: Deno.ChildProcess;
  try {
    server = new Deno.Command(Deno.execPath(), {
      cwd: root,
      args: [
        "run",
        "--allow-env=PORT,HOST,SERVER_MODE,WASM_VS_JS_REPORTER_TOKEN",
        "--allow-net=127.0.0.1",
        "--allow-read=.",
        "deploy.ts",
      ],
      env: { PORT: String(serverPort), HOST: "127.0.0.1", SERVER_MODE: "public" },
      stdout: "null",
      stderr: "null",
    }).spawn();
  } catch (error) {
    await Deno.remove(partialRoot, { recursive: true }).catch(() => {});
    throw error;
  }
  const serverStatus = server.status;
  const serverIdentity = await processIdentity(server.pid);
  if (!serverIdentity) {
    try {
      Deno.kill(server.pid, "SIGTERM");
    } catch {
      // The child already exited before its identity could be retained.
    }
    await serverStatus.catch(() => {});
    await Deno.remove(partialRoot, { recursive: true }).catch(() => {});
    throw new Error("owned loopback server identity unavailable");
  }

  let profilePath: string | null = null;
  let profileIdentity: ProfileIdentity | null = null;
  let profileMode: number | null = null;
  let unit: string | null = null;
  let cgroupPath: string | null = null;
  let cgroupIdentity: { dev: number; ino: number } | null = null;
  let cgroupKill: Deno.FsFile | null = null;
  let mainIdentity: ProcessIdentity | null = null;
  let client: CdpClient | null = null;
  const memberSnapshots: Array<{ at: string; pids: number[] }> = [];
  const browserProcesses = new Map<number, ProcessIdentity>();
  const cleanup = {
    browser: { requested: "cgroup.kill", processesAbsent: false, remainingPids: [] as number[] },
    profile: { removed: false, absent: false },
    server: { signal: "SIGTERM", processAbsent: false },
  };
  let completed = false;
  let collectionError: unknown;
  let browserEvidence: Json | null = null;
  const scenarios: Json[] = [];
  let launchArguments: string[] = [];
  try {
    await waitFor(`${origin}/healthz`);
    const profileOwner = `olap-${crypto.randomUUID().replaceAll("-", "")}`;
    profilePath = `/tmp/wasm-vs-js-owned-profiles/${profileOwner}/profile`;
    profileIdentity = await prepareProfile(profilePath);
    const profileInfo = await Deno.lstat(profilePath);
    profileMode = Number(profileInfo.mode) & 0o777;
    if (
      profileInfo.isSymlink || !profileInfo.isDirectory || profileMode !== 0o700 ||
      [...Deno.readDirSync(profilePath)].length
    ) {
      throw new Error("owned Chrome profile is not a new empty private directory");
    }
    launchArguments = [
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
      "--enable-automation",
      "--hide-scrollbars",
      "--window-size=1440,1200",
      "about:blank",
    ];
    unit = `wasm-olap-chart-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}.service`;
    await commandText(root, "/usr/bin/systemd-run", [
      "--user",
      `--unit=${unit}`,
      "--collect",
      "--quiet",
      "--property=Type=exec",
      "--property=KillMode=control-group",
      "--property=CollectMode=inactive-or-failed",
      "--",
      chromeBefore.path,
      ...launchArguments,
    ]);
    const systemd = await waitSystemd(root, unit);
    cgroupPath = `/sys/fs/cgroup${systemd.ControlGroup}`;
    const cgroupInfo = await Deno.lstat(cgroupPath);
    if (
      cgroupInfo.isSymlink || !cgroupInfo.isDirectory ||
      await Deno.realPath(cgroupPath) !== cgroupPath
    ) throw new Error("unsafe owned Chrome cgroup identity");
    cgroupIdentity = { dev: Number(cgroupInfo.dev), ino: Number(cgroupInfo.ino) };
    cgroupKill = await Deno.open(`${cgroupPath}/cgroup.kill`, { write: true });
    mainIdentity = await processIdentity(Number(systemd.MainPID));
    if (!mainIdentity || mainIdentity.executable !== chromeBefore.path) {
      throw new Error("owned Chrome MainPID does not match inspected executable");
    }
    const snapshot = async () => {
      const pids = await readCgroupMembers(cgroupPath!);
      memberSnapshots.push({ at: new Date().toISOString(), pids });
      for (const pid of pids) {
        const identity = await processIdentity(pid);
        if (identity) browserProcesses.set(pid, identity);
      }
      return pids;
    };
    if (!(await snapshot()).includes(mainIdentity.pid)) {
      throw new Error("Chrome MainPID absent from owned cgroup");
    }

    const activePortPath = `${profilePath}/DevToolsActivePort`;
    let debuggerPort = 0, browserPath = "";
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
    if (!debuggerPort || !browserPath) {
      throw new Error("owned Chrome DevTools endpoint unavailable");
    }
    const discovery = await (await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
    const websocket = new URL(String(discovery.webSocketDebuggerUrl));
    if (
      websocket.protocol !== "ws:" || websocket.hostname !== "127.0.0.1" ||
      Number(websocket.port) !== debuggerPort || websocket.pathname !== browserPath
    ) throw new Error("Chrome CDP endpoint escaped exact owned loopback identity");
    client = new CdpClient(websocket.href);
    await client.ready();
    const version = await client.send("Browser.getVersion");
    if (version.product !== EXPECTED_CHROME_PRODUCT) {
      throw new Error(`exact Chrome product required: ${EXPECTED_CHROME_PRODUCT}`);
    }
    const commandLine = await client.send("Browser.getBrowserCommandLine");
    if (
      !Array.isArray(commandLine.arguments) ||
      !launchArguments.every((argument) => (commandLine.arguments as unknown[]).includes(argument))
    ) throw new Error("effective Chrome argv omitted an exact requested argument");

    const definitions = [
      { id: "complete-js-controlled", kind: "complete", target: "js-controlled" },
      {
        id: "complete-wasm-linear-controlled",
        kind: "complete",
        target: "wasm-linear-controlled",
      },
      ...LIFECYCLE_IDS.map((lifecycle) => ({
        id: `lifecycle-${lifecycle}`,
        kind: "lifecycle",
        target: "js-controlled",
        lifecycle,
      })),
    ] as Array<{
      id: string;
      kind: "complete" | "lifecycle";
      target: Target;
      lifecycle?: LifecycleId;
    }>;
    for (const definition of definitions) {
      scenarios.push(
        await collectScenario(
          client,
          root,
          origin,
          oracle,
          definition,
          `${partialScreenshots}/${definition.id}.png`,
          `${outputName}.screenshots/${definition.id}.png`,
        ),
      );
      await snapshot();
    }
    const complete = scenarios.filter((scenario) => scenario.kind === "complete");
    const jsResult = (complete[0].semantic as Json).result as Json;
    const wasmResult = (complete[1].semantic as Json).result as Json;
    exactJson(jsResult.chartModels, wasmResult.chartModels, "cross-target browser chart models");
    const coreCounters = [
      "queries",
      "rowsVisited",
      "predicateChecks",
      "matchedRows",
      "sortComparisons",
      "aggregateRows",
      "chartBins",
      "outputRows",
      "outputWords",
    ];
    for (const name of coreCounters) {
      if ((jsResult.counters as Json)[name] !== (wasmResult.counters as Json)[name]) {
        throw new Error(`cross-target browser counter mismatch: ${name}`);
      }
    }
    browserEvidence = {
      product: String(version.product),
      revision: String(version.revision),
      userAgent: String(version.userAgent),
      jsVersion: String(version.jsVersion),
      executable: chromeBefore,
      requestedLaunchArguments: launchArguments,
      effectiveCommandLine: commandLine.arguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
      devtools: {
        address: "127.0.0.1",
        port: debuggerPort,
        browserPath,
        webSocketOrigin: websocket.origin,
      },
      profile: { path: profilePath, mode: profileMode, ...profileIdentity },
      cgroup: {
        unit,
        controlGroup: systemd.ControlGroup,
        path: cgroupPath,
        ...cgroupIdentity,
        invocationId: systemd.InvocationID,
        mainPid: mainIdentity.pid,
        memberSnapshots,
      },
    };
  } catch (error) {
    collectionError = error;
  } finally {
    try {
      await client?.send("Browser.close");
    } catch {
      // Exact cgroup identity remains the authoritative fallback.
    }
    client?.close();
    if (cgroupPath && cgroupIdentity && cgroupKill) {
      try {
        const info = await Deno.lstat(cgroupPath);
        const identityMatches = Number(info.dev) === cgroupIdentity.dev &&
          Number(info.ino) === cgroupIdentity.ino;
        if (!identityMatches) {
          collectionError ??= new Error("owned Chrome cgroup identity changed before cleanup");
        } else {
          await cgroupKill.write(textEncoder.encode("1"));
          const deadline = Date.now() + 5_000;
          while (Date.now() < deadline && (await readCgroupMembers(cgroupPath)).length) {
            await delay(25);
          }
          cleanup.browser.remainingPids = await readCgroupMembers(cgroupPath);
          cleanup.browser.processesAbsent = cleanup.browser.remainingPids.length === 0;
        }
      } catch (error) {
        cleanup.browser.remainingPids = await readCgroupMembers(cgroupPath).catch(() => []);
        collectionError ??= error;
      }
      cgroupKill.close();
    }
    let unitStoppedOrAbsent = unit === null;
    if (unit) {
      try {
        await commandText(root, "/usr/bin/systemctl", ["--user", "stop", unit]);
        const stoppedState = await systemdShow(root, unit).catch(() => null);
        unitStoppedOrAbsent = stoppedState === null ||
          (stoppedState.ActiveState !== "active" && Number(stoppedState.MainPID || 0) === 0);
        if (!unitStoppedOrAbsent) {
          collectionError ??= new Error("owned Chrome systemd unit remained active after cleanup");
        }
      } catch (error) {
        const stoppedState = await systemdShow(root, unit).catch(() => null);
        unitStoppedOrAbsent = stoppedState === null;
        if (!unitStoppedOrAbsent) collectionError ??= error;
      }
    }
    for (const identity of browserProcesses.values()) {
      if (await identityRunning(identity)) cleanup.browser.remainingPids.push(identity.pid);
    }
    if (mainIdentity && await identityRunning(mainIdentity)) {
      cleanup.browser.remainingPids.push(mainIdentity.pid);
    }
    cleanup.browser.remainingPids = [...new Set(cleanup.browser.remainingPids)].sort((a, b) =>
      a - b
    );
    cleanup.browser.processesAbsent = cleanup.browser.remainingPids.length === 0 &&
      unitStoppedOrAbsent && (cgroupPath === null || cleanup.browser.processesAbsent);
    if (!cleanup.browser.processesAbsent) {
      collectionError ??= new Error("owned Chrome processes survived exact cgroup cleanup");
    }
    if (profilePath && profileIdentity) {
      try {
        if (!cleanup.browser.processesAbsent) {
          collectionError ??= new Error(
            "owned Chrome profile retained until process cleanup succeeds",
          );
        } else {
          await removeOwnedProfile(profileIdentity);
          cleanup.profile.removed = true;
          cleanup.profile.absent = true;
        }
      } catch (error) {
        collectionError ??= error;
      }
    }
    try {
      if (await identityRunning(serverIdentity)) Deno.kill(serverIdentity.pid, "SIGTERM");
      await serverStatus;
      cleanup.server.processAbsent = !(await identityRunning(serverIdentity));
      if (!cleanup.server.processAbsent) {
        collectionError ??= new Error("owned loopback server survived cleanup");
      }
    } catch (error) {
      collectionError ??= error;
    }
  }

  try {
    const chromeAfter = await fileIdentity(chromeBefore.path);
    if (canonicalize(chromeAfter) !== canonicalize(chromeBefore)) {
      throw new Error("Chrome executable identity changed across collection");
    }
    const endCheck = await assertSourceUnchanged(root, source);
    if (collectionError) throw collectionError;
    if (!browserEvidence || scenarios.length !== 8) {
      throw new Error("scenario denominator incomplete");
    }
    const evidence = {
      schemaVersion: 1,
      evidenceId: `database-olap-chart-browser-${source.commit.slice(0, 12)}`,
      collectedAt: new Date().toISOString(),
      workloadId: WORKLOAD_ID,
      performanceClaims: [],
      source: { ...source, endCheck },
      collector: {
        script: SCRIPT_PATH,
        scriptBytes: (source.files as Json[]).find((file) => file.path === SCRIPT_PATH)!.bytes,
        scriptSha256: (source.files as Json[]).find((file) => file.path === SCRIPT_PATH)!.sha256,
        command: [
          Deno.execPath(),
          "run",
          "-A",
          SCRIPT_PATH,
          `--source-root=${root}`,
          `--source-commit=${source.commit}`,
          `--chrome=${chromeBefore.path}`,
          `--output=${options.output}`,
        ],
        denoVersion: Deno.version.deno,
        parentPid: Deno.ppid,
      },
      browser: browserEvidence,
      server: { origin, mode: "public", launcher: serverIdentity },
      contract: {
        digest: EXPECTED_DIGEST,
        completeOutput: completeOutput,
        targets: [...TARGETS],
        queries: 5,
        binsPerModel: 16,
        topRowsPerModel: 8,
        crossTargetValidated: true,
      },
      scenarios,
      cleanup: {
        browser: {
          ...cleanup.browser,
          mainProcess: mainIdentity,
          observedProcesses: [...browserProcesses.values()].sort((a, b) => a.pid - b.pid),
        },
        profile: { ...cleanup.profile, path: profilePath },
        server: { ...cleanup.server, launcher: serverIdentity },
      },
    };
    await validateSchema(root, evidence);
    await Deno.writeTextFile(`${partialRoot}/evidence.json`, `${canonicalize(evidence)}\n`, {
      createNew: true,
    });
    await Deno.rename(partialScreenshots, finalScreenshotDirectory);
    await Deno.rename(`${partialRoot}/evidence.json`, options.output);
    await Deno.remove(partialRoot);
    completed = true;
    console.log(
      "database OLAP browser evidence: 2 exact targets + 6 lifecycle probes; cleanup exact",
    );
  } finally {
    if (!completed) {
      await Deno.remove(partialRoot, { recursive: true }).catch(() => {});
      await Deno.remove(finalScreenshotDirectory, { recursive: true }).catch(() => {});
      await Deno.remove(options.output).catch(() => {});
    }
  }
}

if (import.meta.main) await runCollector();

import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

export const ACCEPTED_COMMIT = "7fca505568b593e374185a0926ffd890196e5e18";
export const ACCEPTED_TREE = "d585a3590b35d9552acb7b9a0a68fddb5eafad09";
export const EXPECTED_CHROME_PRODUCT = "Chrome/150.0.7871.24";
export const EXPECTED_CHROME_SHA256 =
  "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
export const WORKLOAD_ROUTE = "/benchmarks/simulation-rigid-body-2d-v1/";
const SCRIPT = "scripts/collect-simulation-rigid-body-2d-browser-evidence.ts";
const SCHEMA = "schemas/simulation-rigid-body-2d-browser-evidence.schema.json";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export const EXPECTED_ASSETS = Object.freeze({
  [WORKLOAD_ROUTE]: "public/benchmarks/simulation-rigid-body-2d-v1/index.html",
  "/styles.css": "public/styles.css",
  "/benchmarks/simulation-rigid-body-2d-v1/runner.js":
    "public/benchmarks/simulation-rigid-body-2d-v1/runner.js",
  "/benchmarks/simulation-rigid-body-2d-v1/worker.js":
    "public/benchmarks/simulation-rigid-body-2d-v1/worker.js",
  "/benchmarks/v1/simulation-rigid-body-2d/engine.js":
    "benchmarks/v1/simulation-rigid-body-2d/engine.js",
  "/benchmarks/v1/simulation-rigid-body-2d/fixture.js":
    "benchmarks/v1/simulation-rigid-body-2d/fixture.js",
  "/artifacts/simulation-rigid-body-2d-v1/fixture.bin":
    "public/artifacts/simulation-rigid-body-2d-v1/fixture.bin",
  "/artifacts/simulation-rigid-body-2d-v1/rigid-body-2d.wasm":
    "public/artifacts/simulation-rigid-body-2d-v1/rigid-body-2d.wasm",
  "/artifacts/simulation-rigid-body-2d-v1/reference-checkpoints.f32le":
    "public/artifacts/simulation-rigid-body-2d-v1/reference-checkpoints.f32le",
  "/artifacts/simulation-rigid-body-2d-v1/fixture-manifest.json":
    "public/artifacts/simulation-rigid-body-2d-v1/fixture-manifest.json",
  "/artifacts/simulation-rigid-body-2d-v1/output-manifest.json":
    "public/artifacts/simulation-rigid-body-2d-v1/output-manifest.json",
  "/artifacts/simulation-rigid-body-2d-v1/build-manifest.json":
    "public/artifacts/simulation-rigid-body-2d-v1/build-manifest.json",
  "/evidence/v1-base/simulation-rigid-body-2d-v1/js-controlled.json":
    "public/evidence/v1-base/simulation-rigid-body-2d-v1/js-controlled.json",
  "/evidence/v1-base/simulation-rigid-body-2d-v1/wasm-linear-controlled.json":
    "public/evidence/v1-base/simulation-rigid-body-2d-v1/wasm-linear-controlled.json",
  "/favicon.ico": "public/favicon.svg",
});

const SUPPORT_PATHS = [
  SCRIPT,
  SCHEMA,
  "lib/canonical.ts",
  "lib/cdp-client.ts",
  "deploy.ts",
  "server.ts",
] as const;

export const EXPECTED_METRICS = Object.freeze({
  kinetic: 0.027244684786372392,
  potential: 75814.43372561425,
  totalEnergy: 75814.46097029903,
  maxSpeed: 0.008999999612569809,
  maxAngularSpeed: 0.013000000268220901,
  groundPenetration: 0.0014774799346923828,
  jointAnchorError: 0.0038332734256982803,
  contactPenetration: 0.024493813514709473,
});

export function expectedCounters(target: "javascript" | "wasm-linear") {
  return {
    timesteps: 1_800,
    broadphasePairs: 998_471_252,
    rotatedManifoldTests: 36_036_054,
    manifolds: 26_380_076,
    contactPoints: 26_380_076,
    normalImpulses: 323_993,
    frictionImpulses: 323_993,
    angularContactImpulses: 431_986,
    jointImpulses: 2_394_000,
    torqueApplications: 60_000,
    velocityIterations: 10_800,
    positionIterations: 115_200,
    stateValues: 18_000,
    typedArrayAllocations: target === "javascript" ? 28 : 5,
    exportedCallBoundaries: target === "javascript" ? 0 : 3,
  };
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string) {
  if (Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) {
    throw new Error(`${label} has an open or incomplete shape`);
  }
}

export function validateCompleteResult(
  selectedTarget: "javascript" | "wasm-linear" | "both",
  value: unknown,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("visible result is not an exact object");
  }
  const result = value as Record<string, unknown>;
  exactKeys(
    result,
    [
      "target",
      "checkpointDigest",
      "completeStateValues",
      "counters",
      "metrics",
      "checks",
      "performanceClaims",
    ],
    "visible result",
  );
  const executionTarget = selectedTarget === "javascript" ? "javascript" : "wasm-linear";
  if (
    result.target !== selectedTarget || result.checkpointDigest !== "b54a6129" ||
    result.completeStateValues !== 18_000 || canonicalize(result.counters) !==
      canonicalize(expectedCounters(executionTarget)) ||
    canonicalize(result.metrics) !== canonicalize(EXPECTED_METRICS) ||
    !Array.isArray(result.performanceClaims) || result.performanceClaims.length !== 0
  ) throw new Error("visible result identity, digest, metrics, or counters differ from acceptance");
  const checks = result.checks as Record<string, unknown>;
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) {
    throw new Error("visible result checks are missing");
  }
  if (selectedTarget === "javascript") {
    if (canonicalize(checks) !== canonicalize({ javascriptMaximumError: 0 })) {
      throw new Error("JavaScript did not validate all 18,000 checkpoint values");
    }
  } else if (selectedTarget === "wasm-linear") {
    if (canonicalize(checks) !== canonicalize({ wasmMaximumError: 0 })) {
      throw new Error("Wasm did not validate all 18,000 checkpoint values");
    }
  } else {
    const expected = {
      javascriptMaximumError: 0,
      wasmMaximumError: 0,
      crossTarget: {
        passed: true,
        maximumAbsoluteError: 0,
        maximumRelativeError: 0,
        violations: 0,
      },
    };
    if (canonicalize(checks) !== canonicalize(expected)) {
      throw new Error("both targets did not validate every checkpoint and cross-target value");
    }
  }
  return {
    selectedTarget,
    executionTarget,
    bodies: 500,
    joints: 19,
    timesteps: 1_800,
    checkpoints: 6,
    checkpointStateValues: 18_000,
    checkpointDigest: "b54a6129",
    metrics: EXPECTED_METRICS,
    counters: expectedCounters(executionTarget),
    checks,
    angularWork: {
      rotatedManifoldTests: 36_036_054,
      angularContactImpulses: 431_986,
      jointImpulses: 2_394_000,
      torqueApplications: 60_000,
    },
    performanceClaim: false,
    passed: true,
  };
}

interface Scenario {
  id: string;
  action:
    | "complete"
    | "wrong-token"
    | "stale-restart"
    | "restart"
    | "timeout"
    | "cancel"
    | "pagehide";
  target: "javascript" | "wasm-linear" | "both";
}

export const SCENARIOS: readonly Scenario[] = [
  { id: "javascript-complete", action: "complete", target: "javascript" },
  { id: "wasm-linear-complete", action: "complete", target: "wasm-linear" },
  { id: "both-complete", action: "complete", target: "both" },
  { id: "wrong-token", action: "wrong-token", target: "javascript" },
  { id: "stale-restart", action: "stale-restart", target: "javascript" },
  { id: "restart", action: "restart", target: "wasm-linear" },
  { id: "timeout", action: "timeout", target: "wasm-linear" },
  { id: "cancel", action: "cancel", target: "javascript" },
  { id: "pagehide", action: "pagehide", target: "javascript" },
] as const;

interface ProcessIdentity {
  pid: number;
  parentPid: number;
  startTimeTicks: string;
  executable: string;
}
interface FileRecord {
  route: string;
  sourcePath: string;
  bytes: number;
  sha256: string;
  gitBlob: string;
  acceptedCommitBytesMatch: true;
}
interface CleanupCheck {
  outcome: "success" | "failure";
  checkedAt: string;
  remaining: string[];
  error?: string;
}

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
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function numeric(value: number | bigint | null | undefined, label: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} unavailable`);
  return number;
}
function bytesToBase64(bytes: Uint8Array): string {
  let value = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    value += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(value);
}
function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
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
async function commandText(root: string, command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) {
    throw new Error(`${command} failed: ${decoder.decode(output.stderr).trim()}`);
  }
  return decoder.decode(output.stdout).trim();
}
async function gitBytes(root: string, revision: string, path: string): Promise<Uint8Array> {
  const output = await new Deno.Command("git", {
    cwd: root,
    args: ["show", `${revision}:${path}`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) throw new Error(`Git source missing: ${revision}:${path}`);
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
      /^\/.+/u.test(state.ControlGroup ?? "") && /^[a-f0-9]{32}$/u.test(state.InvocationID ?? "")
    ) return state;
    await delay(25);
  }
  throw new Error("owned Chrome systemd service did not become active");
}
async function readCgroupMembers(path: string): Promise<number[]> {
  return (await Deno.readTextFile(`${path}/cgroup.procs`)).split(/\s+/u).filter(Boolean).map(Number)
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
async function evaluate(client: CdpClient, sessionId: string, expression: string) {
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
  if (response.exceptionDetails) throw new Error(`browser evaluation failed: ${expression}`);
  return (response.result as { value?: unknown }).value;
}
async function click(client: CdpClient, sessionId: string, selector: string) {
  const point = await evaluate(
    client,
    sessionId,
    `(() => { const node=document.querySelector(${
      JSON.stringify(selector)
    }); const rect=node.getBoundingClientRect(); return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,disabled:node.disabled}; })()`,
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

const pageAuditSource = (shortTimeout: boolean) =>
  `(() => {
  const NativeWorker=globalThis.Worker;
  const nativeSetTimeout=globalThis.setTimeout.bind(globalThis);
  const audit={workers:[],messages:[],statusHistory:[]};
  globalThis.__rigidCollector=audit;
  class CollectorWorker extends NativeWorker {
    constructor(...args){
      super(...args);
      const entry={worker:this,url:String(args[0]),terminated:false,request:null};
      audit.workers.push(entry);
      this.addEventListener('message',(event)=>{try{audit.messages.push(structuredClone(event.data));}catch{audit.messages.push({type:'uncloneable'});}});
      const nativePost=this.postMessage.bind(this);
      this.postMessage=(data,transfer)=>{entry.request=structuredClone(data);return transfer===undefined?nativePost(data):nativePost(data,transfer);};
      const nativeTerminate=this.terminate.bind(this);
      this.terminate=()=>{entry.terminated=true;try{globalThis.__rigidEvidenceEvent(JSON.stringify({kind:'worker-terminated',index:audit.workers.indexOf(entry)}));}catch{}nativeSetTimeout(()=>nativeTerminate(),750);};
      globalThis.__rigidEvidenceEvent(JSON.stringify({kind:'worker-created',index:audit.workers.length-1,url:entry.url}));
    }
  }
  Object.defineProperty(globalThis,'Worker',{value:CollectorWorker,configurable:false});
  ${
    shortTimeout
      ? "globalThis.setTimeout=(fn,delay,...args)=>nativeSetTimeout(fn,delay===30000?50:delay,...args);"
      : ""
  }
  addEventListener('DOMContentLoaded',()=>{
    const node=document.querySelector('#status');
    const record=()=>{const value=node?.textContent?.trim();if(value&&audit.statusHistory.at(-1)!==value)audit.statusHistory.push(value);};
    record();new MutationObserver(record).observe(node,{childList:true,characterData:true,subtree:true});
  });
})()`;

async function pageState(client: CdpClient, sessionId: string) {
  return await evaluate(
    client,
    sessionId,
    `(() => ({
    status:document.querySelector('#status').textContent.trim(),
    result:document.querySelector('#result').textContent,
    progress:Number(document.querySelector('#progress').value),
    startDisabled:document.querySelector('#start').disabled,
    cancelDisabled:document.querySelector('#cancel').disabled,
    target:document.querySelector('#target').value,
    statusHistory:[...__rigidCollector.statusHistory],
    messages:structuredClone(__rigidCollector.messages),
    workers:__rigidCollector.workers.map((entry)=>({url:entry.url,terminated:entry.terminated,request:entry.request}))
  }))()`,
  ) as Record<string, unknown>;
}
async function waitState(
  client: CdpClient,
  sessionId: string,
  predicate: (value: Record<string, unknown>) => boolean,
  timeoutMs = 45_000,
) {
  const deadline = Date.now() + timeoutMs;
  let current: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    current = await pageState(client, sessionId);
    if (predicate(current)) return current;
    await delay(50);
  }
  throw new Error(`browser state timeout: ${JSON.stringify(current)}`);
}
function sourcePathFor(url: string): string | null {
  const parsed = new URL(url);
  return EXPECTED_ASSETS[parsed.pathname as keyof typeof EXPECTED_ASSETS] ?? null;
}
async function settle(tasks: Promise<void>[]) {
  for (let cursor = 0; cursor < tasks.length; cursor++) await tasks[cursor];
  await delay(100);
  for (let cursor = 0; cursor < tasks.length; cursor++) await tasks[cursor];
}

async function collectScenario(
  client: CdpClient,
  origin: string,
  browserSessionId: string,
  scenario: Scenario,
  staging: string,
  expectedFiles: Map<string, FileRecord>,
) {
  const created = await client.send("Target.createTarget", { url: "about:blank" });
  const targetId = String(created.targetId);
  const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const pageSessionId = String(attached.sessionId);
  const sessions = new Map<string, { context: "page" | "worker"; targetId: string }>([
    [pageSessionId, { context: "page", targetId }],
  ]);
  const consoleEntries: Array<Record<string, unknown>> = [];
  const exceptions: Array<Record<string, unknown>> = [];
  const lifecycleEvents: Array<Record<string, unknown>> = [];
  const requests = new Map<string, Record<string, unknown>>();
  const executedScripts = new Map<string, Record<string, unknown>>();
  const tasks: Promise<void>[] = [];
  const taskErrors: Error[] = [];
  const queue = (task: Promise<void>) =>
    tasks.push(task.catch((error) => {
      taskErrors.push(error instanceof Error ? error : new Error(String(error)));
    }));
  const enableWorker = async (sessionId: string) => {
    await Promise.all([
      client.send("Network.enable", { maxTotalBufferSize: 30_000_000 }, sessionId),
      client.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId),
      client.send("Network.setBypassServiceWorker", { bypass: true }, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Debugger.enable", {}, sessionId),
    ]);
    await client.send("Runtime.runIfWaitingForDebugger", {}, sessionId);
  };
  const removers = [
    client.on("Target.attachedToTarget", (params, eventSession) => {
      if (eventSession !== pageSessionId) return;
      const info = params.targetInfo as Record<string, unknown>;
      if (info.type !== "worker") {
        taskErrors.push(new Error(`unexpected attached target type: ${info.type}`));
        return;
      }
      const sessionId = String(params.sessionId);
      sessions.set(sessionId, { context: "worker", targetId: String(info.targetId) });
      queue(enableWorker(sessionId));
    }),
    client.on("Target.detachedFromTarget", (params, eventSession) => {
      if (eventSession !== pageSessionId) return;
      const workerSessions = [...sessions.entries()].filter(([, v]) => v.context === "worker");
      const index = workerSessions.findIndex(([id]) => id === String(params.sessionId));
      if (index === -1) return;
      if (
        lifecycleEvents.some((event) =>
          event.kind === "worker-terminated" &&
          Number((event as Record<string, unknown>).index) === index
        )
      ) return;
      // Binding calls during pagehide race page teardown; the target detach
      // is the authoritative browser-level termination signal.
      lifecycleEvents.push({ kind: "worker-terminated", index });
    }),
    client.on("Runtime.bindingCalled", (params, eventSession) => {
      if (eventSession === pageSessionId && params.name === "__rigidEvidenceEvent") {
        lifecycleEvents.push(JSON.parse(String(params.payload)));
      }
    }),
    client.on("Runtime.consoleAPICalled", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      consoleEntries.push({
        context: sessions.get(sessionId)!.context,
        sessionId,
        type: String(params.type),
        arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((arg) =>
          String(arg.value ?? arg.description ?? arg.type)
        ),
        timestamp: Number(params.timestamp),
      });
    }),
    client.on("Runtime.exceptionThrown", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      const details = params.exceptionDetails as Record<string, unknown>;
      exceptions.push({
        context: sessions.get(sessionId)!.context,
        sessionId,
        text: String(details.text),
        lineNumber: Number(details.lineNumber),
        columnNumber: Number(details.columnNumber),
      });
    }),
    client.on("Network.requestWillBeSent", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      const request = params.request as Record<string, unknown>;
      requests.set(String(params.requestId), {
        context: sessions.get(sessionId)!.context,
        sessionId,
        requestId: String(params.requestId),
        url: String(request.url),
        method: String(request.method),
        resourceType: String(params.type),
        status: 0,
        mimeType: "",
        fromDiskCache: false,
        fromServiceWorker: false,
        failed: false,
        errorText: null,
        responseBody: { status: "unavailable", reason: "response not completed" },
      });
    }),
    client.on("Network.responseReceived", (params, sessionId) => {
      if (!sessionId) return;
      const entry = requests.get(String(params.requestId));
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
    client.on("Network.loadingFailed", (params, sessionId) => {
      if (!sessionId) return;
      const entry = requests.get(String(params.requestId));
      if (entry) {
        Object.assign(entry, {
          failed: true,
          errorText: String(params.errorText),
          responseBody: { status: "unavailable", reason: String(params.errorText) },
        });
      }
    }),
    client.on("Network.loadingFinished", (params, sessionId) => {
      if (!sessionId) return;
      const entry = requests.get(String(params.requestId));
      if (!entry) return;
      queue((async () => {
        const sourcePath = sourcePathFor(String(entry.url));
        if (!sourcePath) throw new Error(`unmapped network response denied: ${entry.url}`);
        const response = await client.send(
          "Network.getResponseBody",
          { requestId: params.requestId },
          sessionId,
          10_000,
        );
        const bytes = response.base64Encoded
          ? base64ToBytes(String(response.body))
          : encoder.encode(String(response.body));
        const expected = expectedFiles.get(new URL(String(entry.url)).pathname);
        if (
          !expected || bytes.length !== expected.bytes || await sha256Hex(bytes) !== expected.sha256
        ) {
          throw new Error(`raw response differs from accepted source: ${sourcePath}`);
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
    client.on("Debugger.scriptParsed", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId) || !params.url) return;
      let parsed: URL;
      try {
        parsed = new URL(String(params.url));
      } catch {
        return;
      }
      if (parsed.origin !== origin || !parsed.pathname.endsWith(".js")) return;
      const sourcePath = sourcePathFor(parsed.href);
      if (!sourcePath) {
        taskErrors.push(new Error(`executed script was not source-bound: ${parsed.href}`));
        return;
      }
      queue((async () => {
        const response = await client.send(
          "Debugger.getScriptSource",
          { scriptId: String(params.scriptId) },
          sessionId,
          10_000,
        );
        const bytes = encoder.encode(String(response.scriptSource));
        const expected = expectedFiles.get(parsed.pathname);
        if (
          !expected || bytes.length !== expected.bytes || await sha256Hex(bytes) !== expected.sha256
        ) {
          throw new Error(`executed script differs from accepted source: ${sourcePath}`);
        }
        executedScripts.set(`${sessionId}:${params.scriptId}`, {
          context: sessions.get(sessionId)!.context,
          sessionId,
          targetId: sessions.get(sessionId)!.targetId,
          route: parsed.pathname,
          sourcePath,
          bytes: bytes.length,
          sha256: expected.sha256,
          base64: bytesToBase64(bytes),
          gitBlob: expected.gitBlob,
        });
      })());
    }),
  ];
  try {
    await Promise.all([
      client.send("Page.enable", {}, pageSessionId),
      client.send("Runtime.enable", {}, pageSessionId),
      client.send("Network.enable", { maxTotalBufferSize: 30_000_000 }, pageSessionId),
      client.send("Network.setCacheDisabled", { cacheDisabled: true }, pageSessionId),
      client.send("Network.setBypassServiceWorker", { bypass: true }, pageSessionId),
      client.send("Debugger.enable", {}, pageSessionId),
      client.send("Accessibility.enable", {}, pageSessionId),
      client.send("Runtime.addBinding", { name: "__rigidEvidenceEvent" }, pageSessionId),
      client.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
      }, pageSessionId),
    ]);
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: pageAuditSource(scenario.action === "timeout"),
    }, pageSessionId);
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("page load timeout")), 10_000);
      const remove = client.on("Page.loadEventFired", (_params, sessionId) => {
        if (sessionId !== pageSessionId) return;
        clearTimeout(timer);
        remove();
        resolve();
      });
    });
    await client.send("Page.navigate", { url: `${origin}${WORKLOAD_ROUTE}` }, pageSessionId);
    await loaded;
    await waitState(client, pageSessionId, (state) => state.status === "Ready.", 10_000);
    await evaluate(
      client,
      pageSessionId,
      `(() => { const node=document.querySelector('#target');node.value=${
        JSON.stringify(scenario.target)
      };node.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await click(client, pageSessionId, "#start");
    const lifecycleChecks: string[] = [];
    let final: Record<string, unknown>;
    let result: ReturnType<typeof validateCompleteResult> | null = null;
    if (scenario.action === "complete") {
      final = await waitState(
        client,
        pageSessionId,
        (state) => state.status === "Complete. Correctness checks passed.",
        120_000,
      );
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(final.result));
      } catch {
        throw new Error(`${scenario.id}: visible result was not JSON`);
      }
      result = validateCompleteResult(scenario.target, parsed);
    } else {
      final = await waitState(
        client,
        pageSessionId,
        (state) => (state.workers as unknown[]).length >= 1,
        5_000,
      );
      if (scenario.action === "wrong-token") {
        const before = await pageState(client, pageSessionId);
        await evaluate(
          client,
          pageSessionId,
          `__rigidCollector.workers[0].worker.dispatchEvent(new MessageEvent('message',{data:{token:999999,type:'complete',result:{fabricated:true}}}))`,
        );
        await delay(50);
        const after = await pageState(client, pageSessionId);
        // Progress updates legitimately mutate status during the live run;
        // only a handler effect of the forged message (finish() writing the
        // result or a completion/failure status) proves visible mutation.
        const newStatuses = (after.statusHistory as string[]).slice(
          (before.statusHistory as string[]).length,
        );
        if (
          before.result !== after.result ||
          newStatuses.some((value) =>
            value.startsWith("Complete.") || value.startsWith("Run failed.")
          )
        ) {
          throw new Error("wrong-token completion mutated visible state");
        }
        lifecycleChecks.push("wrong-token completion was ignored without visible mutation");
        await click(client, pageSessionId, "#cancel");
      } else if (scenario.action === "stale-restart") {
        await evaluate(client, pageSessionId, "__rigidCollector.stale=__rigidCollector.workers[0]");
        await click(client, pageSessionId, "#cancel");
        await click(client, pageSessionId, "#start");
        await waitState(
          client,
          pageSessionId,
          (state) => (state.workers as unknown[]).length === 2,
          5_000,
        );
        const before = await pageState(client, pageSessionId);
        await evaluate(
          client,
          pageSessionId,
          `__rigidCollector.stale.worker.dispatchEvent(new ErrorEvent('error',{message:'stale injected error'}))`,
        );
        await delay(50);
        const after = await pageState(client, pageSessionId);
        // Only a handler effect of the stale error (finish("Worker failed."))
        // proves mutation; live progress updates legitimately change status.
        const newStatuses = (after.statusHistory as string[]).slice(
          (before.statusHistory as string[]).length,
        );
        if (newStatuses.some((value) => value.startsWith("Worker failed."))) {
          throw new Error("stale prior-worker error mutated restarted generation");
        }
        lifecycleChecks.push("stale prior-worker error was ignored after a fresh restart");
        await click(client, pageSessionId, "#cancel");
      } else if (scenario.action === "restart") {
        const first = (final.workers as Array<Record<string, unknown>>)[0];
        await click(client, pageSessionId, "#cancel");
        await click(client, pageSessionId, "#start");
        const restarted = await waitState(
          client,
          pageSessionId,
          (state) => (state.workers as unknown[]).length === 2,
          5_000,
        );
        const workers = restarted.workers as Array<Record<string, unknown>>;
        const firstRequest = first.request as Record<string, unknown>;
        const secondRequest = workers[1].request as Record<string, unknown>;
        if (
          !firstRequest || !secondRequest || firstRequest.token === secondRequest.token ||
          !workers[0].terminated || workers[1].terminated
        ) throw new Error("restart did not replace the exact worker and generation token");
        lifecycleChecks.push(
          "cancel then restart replaced the terminated worker and generation token",
        );
        await click(client, pageSessionId, "#cancel");
      } else if (scenario.action === "timeout") {
        await waitState(
          client,
          pageSessionId,
          (state) => state.status === "Run stopped after the 30 second limit.",
          5_000,
        );
        lifecycleChecks.push(
          "shortened probe causally reached the registered 30-second timeout branch",
        );
      } else if (scenario.action === "cancel") {
        await click(client, pageSessionId, "#cancel");
        lifecycleChecks.push("visible Cancel terminated the active worker and retained no result");
      } else {
        lifecycleChecks.push("real navigation pagehide terminated the active worker");
      }
      final = await pageState(client, pageSessionId);
    }

    const ax = await client.send("Accessibility.getFullAXTree", {}, pageSessionId, 10_000);
    const axNodes = ((ax.nodes as Array<Record<string, unknown>>) ?? []).map((node) => ({
      role: String((node.role as { value?: unknown } | undefined)?.value ?? ""),
      name: String((node.name as { value?: unknown } | undefined)?.value ?? ""),
      ignored: Boolean(node.ignored),
    }));
    const exposed = axNodes.filter((node) => !node.ignored);
    const axAssertions = {
      mainPresent: exposed.some((node) => node.role === "main"),
      headingNamed: exposed.some((node) =>
        node.role === "heading" && node.name === "500-box rigid-body settlement"
      ),
      targetNamed: exposed.some((node) =>
        node.role === "combobox" && node.name === "Controlled target"
      ),
      startNamed: exposed.some((node) => node.role === "button" && node.name === "Start"),
      cancelNamed: exposed.some((node) => node.role === "button" && node.name === "Cancel"),
      statusPresent: exposed.some((node) => node.role === "status"),
      resultFocusable:
        await evaluate(client, pageSessionId, "document.querySelector('#result').tabIndex===0") ===
          true,
    };
    if (Object.values(axAssertions).some((value) => !value)) {
      throw new Error(`${scenario.id}: accessibility gate failed: ${JSON.stringify(axAssertions)}`);
    }
    const screenshotResponse = await client.send(
      "Page.captureScreenshot",
      {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
      },
      pageSessionId,
      10_000,
    );
    const screenshotBytes = base64ToBytes(String(screenshotResponse.data));
    if (screenshotBytes.slice(0, 8).join(",") !== "137,80,78,71,13,10,26,10") {
      throw new Error(`${scenario.id}: screenshot is not PNG`);
    }
    const screenshotFile = `screenshots/${scenario.id}.png`;
    await Deno.mkdir(`${staging}/screenshots`, { recursive: true });
    await Deno.writeFile(`${staging}/${screenshotFile}`, screenshotBytes, { createNew: true });

    if (scenario.action === "pagehide") {
      await client.send("Page.navigate", { url: "about:blank" }, pageSessionId);
      const deadline = Date.now() + 2_000;
      while (
        !lifecycleEvents.some((event) => event.kind === "worker-terminated") &&
        Date.now() < deadline
      ) await delay(10);
    }
    await settle(tasks);
    if (taskErrors.length) throw taskErrors[0];
    const network = [...requests.values()];
    const invalid = network.filter((entry) =>
      !String(entry.url).startsWith(origin) || entry.method !== "GET" || entry.failed ||
      entry.status !== 200 || entry.fromDiskCache || entry.fromServiceWorker ||
      (entry.responseBody as Record<string, unknown>).status !== "supported"
    );
    if (invalid.length) throw new Error(`network evidence incomplete: ${JSON.stringify(invalid)}`);
    if (exceptions.length || consoleEntries.some((entry) => entry.type === "error")) {
      throw new Error(`${scenario.id}: page/worker console or exception gate failed`);
    }
    const executed = [...executedScripts.values()];
    if (
      !executed.some((entry) =>
        entry.context === "page" &&
        entry.route === "/benchmarks/simulation-rigid-body-2d-v1/runner.js"
      ) || !executed.some((entry) =>
        entry.context === "worker" &&
        entry.route === "/benchmarks/simulation-rigid-body-2d-v1/worker.js"
      )
    ) throw new Error(`${scenario.id}: page and worker executed-source denominator incomplete`);
    const workerTargets = [...sessions.entries()].filter(([, value]) => value.context === "worker")
      .map(([sessionId, value]) => ({ targetId: value.targetId, sessionId }));
    const workers = final.workers as Array<Record<string, unknown>>;
    if (!workerTargets.length || workerTargets.length !== workers.length) {
      throw new Error(`${scenario.id}: worker target/session ownership was incomplete`);
    }
    if (
      scenario.action !== "complete" && scenario.action !== "pagehide" &&
      !workers.some((worker) => worker.terminated)
    ) {
      throw new Error(`${scenario.id}: no exact worker termination was observed`);
    }
    if (
      scenario.action === "pagehide" &&
      !lifecycleEvents.some((event) => event.kind === "worker-terminated")
    ) throw new Error("pagehide did not causally terminate the worker");
    if (scenario.action === "complete") {
      for (
        const route of Object.keys(EXPECTED_ASSETS).filter((route) => route !== "/favicon.ico")
      ) {
        if (!network.some((entry) => new URL(String(entry.url)).pathname === route)) {
          throw new Error(`${scenario.id}: required accepted response absent: ${route}`);
        }
      }
    }
    return {
      id: scenario.id,
      action: scenario.action,
      target: scenario.target,
      sessionOwnership: {
        browserSessionId,
        page: { targetId, sessionId: pageSessionId },
        workers: workerTargets,
      },
      statusHistory: final.statusHistory,
      finalState: {
        status: String(final.status),
        result: String(final.result),
        progress: Number(final.progress),
        startDisabled: Boolean(final.startDisabled),
        cancelDisabled: Boolean(final.cancelDisabled),
      },
      lifecycleEvents,
      network,
      executedScripts: executed,
      console: consoleEntries,
      exceptions,
      accessibility: {
        inspectedBy: "Accessibility.getFullAXTree",
        nodes: axNodes,
        treeSha256: await sha256Hex(encoder.encode(canonicalize(axNodes))),
        assertions: axAssertions,
      },
      screenshot: {
        file: screenshotFile,
        bytes: screenshotBytes.length,
        sha256: await sha256Hex(screenshotBytes),
      },
      ...(result ? { result } : { lifecycle: { checks: lifecycleChecks } }),
    };
  } finally {
    for (const remove of removers) remove();
    await client.send("Target.closeTarget", { targetId }).catch(() => ({}));
  }
}

async function assertClosedSchema(root: string, evidence: unknown) {
  const schema = JSON.parse(await Deno.readTextFile(`${root}/${SCHEMA}`));
  const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
    Ajv2020Module;
  const addFormats =
    ((addFormatsModule as unknown as { default?: (ajv: unknown) => void }).default ??
      addFormatsModule) as unknown as (ajv: unknown) => void;
  const ajv = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(evidence)) {
    throw new Error(`browser evidence schema failed: ${JSON.stringify(validate.errors)}`);
  }
}

function parseArguments() {
  const values = new Map<string, string>();
  for (const argument of Deno.args) {
    const match = /^--(source-commit|chrome|output)=(.+)$/u.exec(argument);
    if (!match || values.has(match[1])) {
      throw new Error(`unknown or duplicate argument: ${argument}`);
    }
    values.set(match[1], match[2]);
  }
  if (
    values.size !== 3 || values.get("source-commit") !== ACCEPTED_COMMIT ||
    !values.get("chrome") || !values.get("output")
  ) {
    throw new Error(
      `usage: deno run -A ${SCRIPT} --source-commit=${ACCEPTED_COMMIT} --chrome=<exact-CfT-path> --output=<new-dir>/evidence.v1.json`,
    );
  }
  return { chrome: values.get("chrome")!, output: values.get("output")! };
}

async function main() {
  if (Deno.build.os !== "linux") throw new Error("owned cgroup cleanup requires Linux");
  const options = parseArguments();
  const root = (await Deno.realPath(new URL("../", import.meta.url))).replace(/\/$/u, "");
  if (
    Deno.cwd() !== root || await commandText(root, "git", ["rev-parse", "--show-toplevel"]) !== root
  ) {
    throw new Error("collector must be parent-run from the exact Git source root");
  }
  if (!options.output.startsWith("/") || !options.output.endsWith("/evidence.v1.json")) {
    throw new Error("--output must name evidence.v1.json in a new absolute directory");
  }
  const outputDirectory = options.output.slice(0, -"/evidence.v1.json".length);
  if (outputDirectory === root || outputDirectory.startsWith(`${root}/`)) {
    throw new Error("browser evidence output must be outside the source repository");
  }
  try {
    await Deno.lstat(outputDirectory);
    throw new Error("immutable browser evidence output directory already exists");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  const startStatus = await commandText(root, "git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (startStatus !== "") throw new Error("collector requires an exact clean HEAD before setup");
  const startCommit = await commandText(root, "git", ["rev-parse", "HEAD"]);
  const startTree = await commandText(root, "git", ["rev-parse", "HEAD^{tree}"]);
  if (
    await commandText(root, "git", ["rev-parse", `${ACCEPTED_COMMIT}^{tree}`]) !== ACCEPTED_TREE
  ) {
    throw new Error("accepted rigid-body commit/tree identity mismatch");
  }
  const ancestor = await new Deno.Command("git", {
    cwd: root,
    args: ["merge-base", "--is-ancestor", ACCEPTED_COMMIT, startCommit],
    stdout: "null",
    stderr: "null",
  }).output();
  if (!ancestor.success) throw new Error("accepted rigid-body commit is not an ancestor of HEAD");

  const chrome = await Deno.realPath(options.chrome);
  if (!chrome.includes("/chrome/linux-150.0.7871.24/chrome-linux64/chrome")) {
    throw new Error("collector requires the exact pinned Chrome for Testing package path");
  }
  const chromeInfo = await Deno.lstat(chrome);
  if (!chromeInfo.isFile || chromeInfo.isSymlink) throw new Error("Chrome must be a regular file");
  const chromeBytes = await Deno.readFile(chrome);
  const chromeDevice = numeric(chromeInfo.dev, "Chrome executable device");
  const chromeInode = numeric(chromeInfo.ino, "Chrome executable inode");
  if (await sha256Hex(chromeBytes) !== EXPECTED_CHROME_SHA256) {
    throw new Error("exact Chrome for Testing executable hash mismatch");
  }

  const expectedFiles = new Map<string, FileRecord>();
  for (const [route, sourcePath] of Object.entries(EXPECTED_ASSETS)) {
    const disk = await Deno.readFile(`${root}/${sourcePath}`);
    const accepted = await gitBytes(root, ACCEPTED_COMMIT, sourcePath);
    const sha256 = await sha256Hex(disk);
    if (disk.length !== accepted.length || sha256 !== await sha256Hex(accepted)) {
      throw new Error(`served source differs from accepted commit: ${sourcePath}`);
    }
    expectedFiles.set(route, {
      route,
      sourcePath,
      bytes: disk.length,
      sha256,
      gitBlob: await commandText(root, "git", ["rev-parse", `${ACCEPTED_COMMIT}:${sourcePath}`]),
      acceptedCommitBytesMatch: true,
    });
  }
  const supportFiles = [];
  for (const path of SUPPORT_PATHS) {
    const disk = await Deno.readFile(`${root}/${path}`);
    const head = await gitBytes(root, startCommit, path);
    const sha256 = await sha256Hex(disk);
    if (disk.length !== head.length || sha256 !== await sha256Hex(head)) {
      throw new Error(`collector support differs from clean HEAD: ${path}`);
    }
    supportFiles.push({ path, bytes: disk.length, sha256, headBytesMatch: true });
  }

  const staging = `${outputDirectory}.partial-${crypto.randomUUID()}`;
  const cleanup: Record<"browserProcesses" | "cgroup" | "profile" | "server", CleanupCheck> = {
    browserProcesses: failureCheck("cleanup not attempted"),
    cgroup: failureCheck("cleanup not attempted"),
    profile: failureCheck("cleanup not attempted"),
    server: failureCheck("cleanup not attempted"),
  };
  let server: Deno.ChildProcess | null = null;
  let serverStatus: Promise<Deno.CommandStatus> | null = null;
  let serverIdentity: ProcessIdentity | null = null;
  let serverOrigin = "";
  let profilePath: string | null = null;
  let profileIdentity: Record<string, unknown> | null = null;
  let unit: string | null = null;
  let cgroupPath: string | null = null;
  let cgroupIdentity: Record<string, unknown> | null = null;
  let cgroupKill: Deno.FsFile | null = null;
  let client: CdpClient | null = null;
  const observedProcesses = new Map<number, ProcessIdentity>();
  const memberSnapshots: Array<{ at: string; pids: number[] }> = [];
  const scenarios: Array<Record<string, unknown>> = [];
  let version: Record<string, unknown> = {};
  let launchArguments: string[] = [];
  let effectiveArguments: string[] = [];
  let browserSessionId = "";
  let collectionError: unknown;

  const finalizeCleanup = async () => {
    try {
      await client?.send("Browser.close", {}, undefined, 5_000);
    } catch { /* The cgroup remains authoritative. */ }
    client?.close();
    let remaining: number[] = [];
    try {
      if (!unit || !cgroupPath || !cgroupIdentity) throw new Error("cgroup setup did not complete");
      const current = await Deno.lstat(cgroupPath);
      if (
        current.isSymlink ||
        numeric(current.dev, "cleanup cgroup device") !== cgroupIdentity.device ||
        numeric(current.ino, "cleanup cgroup inode") !== cgroupIdentity.inode
      ) throw new Error("owned cgroup identity changed before cleanup");
      remaining = await readCgroupMembers(cgroupPath).catch(() => []);
      memberSnapshots.push({ at: new Date().toISOString(), pids: remaining });
      for (const pid of remaining) {
        const identity = await processIdentity(pid);
        if (identity) observedProcesses.set(pid, identity);
      }
      if (cgroupKill) await cgroupKill.write(encoder.encode("1"));
      else {
        await commandText(root, "/usr/bin/systemctl", [
          "--user",
          "kill",
          "--kill-whom=all",
          "--signal=SIGKILL",
          unit,
        ]);
      }
      remaining = await waitCgroupEmpty(cgroupPath, 5_000);
      if (remaining.length) throw new Error("owned cgroup retained member PIDs");
      cleanup.cgroup = successCheck();
    } catch (error) {
      cleanup.cgroup = failureCheck(error, remaining.map(String));
    }
    try {
      cgroupKill?.close();
    } catch { /* already represented above */ }
    if (unit) {
      await commandText(root, "/usr/bin/systemctl", ["--user", "stop", unit]).catch(() => "");
    }
    try {
      const survivors = [];
      for (const identity of observedProcesses.values()) {
        if (await identityRunning(identity)) survivors.push(String(identity.pid));
      }
      if (survivors.length) throw new Error("identity-bound Chrome processes survived cleanup");
      if (!observedProcesses.size) throw new Error("no owned Chrome process identity was retained");
      cleanup.browserProcesses = successCheck();
    } catch (error) {
      cleanup.browserProcesses = failureCheck(error);
    }
    try {
      if (!profilePath || !profileIdentity) throw new Error("profile setup did not complete");
      if (cleanup.cgroup.outcome !== "success" || cleanup.browserProcesses.outcome !== "success") {
        throw new Error("profile retained because process containment cleanup did not succeed");
      }
      const current = await Deno.lstat(profilePath);
      if (
        current.isSymlink ||
        numeric(current.dev, "cleanup profile device") !== profileIdentity.device ||
        numeric(current.ino, "cleanup profile inode") !== profileIdentity.inode
      ) throw new Error("owned profile identity changed before removal");
      await Deno.remove(profilePath, { recursive: true });
      try {
        await Deno.lstat(profilePath);
        throw new Error("owned profile survived removal");
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      }
      cleanup.profile = successCheck();
    } catch (error) {
      cleanup.profile = failureCheck(error, profilePath ? [profilePath] : []);
    }
    try {
      if (!server || !serverStatus || !serverIdentity) {
        throw new Error("server setup did not complete");
      }
      if (await identityRunning(serverIdentity)) Deno.kill(serverIdentity.pid, "SIGTERM");
      let exit = await Promise.race([
        serverStatus,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
      ]);
      if (exit === null && await identityRunning(serverIdentity)) {
        Deno.kill(serverIdentity.pid, "SIGKILL");
        exit = await serverStatus;
      }
      if (exit === null || await identityRunning(serverIdentity)) {
        throw new Error("owned loopback server survived cleanup");
      }
      cleanup.server = successCheck();
    } catch (error) {
      cleanup.server = failureCheck(error, serverIdentity ? [String(serverIdentity.pid)] : []);
    }
  };

  await Deno.mkdir(staging, { recursive: false });
  try {
    const serverPort = unusedPort();
    serverOrigin = `http://127.0.0.1:${serverPort}`;
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
    await waitFor(`${serverOrigin}/healthz`);
    for (const expected of expectedFiles.values()) {
      const response = await fetch(`${serverOrigin}${expected.route}`, {
        redirect: "error",
        cache: "no-store",
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (
        response.status !== 200 || bytes.length !== expected.bytes ||
        await sha256Hex(bytes) !== expected.sha256
      ) {
        throw new Error(`preflight raw bytes differ from accepted source: ${expected.route}`);
      }
    }

    profilePath = await Deno.makeTempDir({ prefix: "wasm-rigid-body-cft-" });
    await Deno.chmod(profilePath, 0o700);
    const profileInfo = await Deno.lstat(profilePath);
    if (
      !profileInfo.isDirectory || profileInfo.isSymlink || [...Deno.readDirSync(profilePath)].length
    ) {
      throw new Error("owned Chrome profile was not created as an empty real directory");
    }
    profileIdentity = {
      path: profilePath,
      device: numeric(profileInfo.dev, "profile device"),
      inode: numeric(profileInfo.ino, "profile inode"),
      mode: numeric(profileInfo.mode, "profile mode") & 0o777,
      createdEmpty: true,
    };
    unit = `wasm-rigid-body-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}.service`;
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
      "--hide-scrollbars",
      "--enable-automation",
      "--disable-cache",
      "--window-size=1440,1200",
      "about:blank",
    ];
    await commandText(root, "/usr/bin/systemd-run", [
      "--user",
      `--unit=${unit}`,
      "--collect",
      "--quiet",
      "--property=Type=exec",
      "--property=KillMode=control-group",
      "--property=CollectMode=inactive-or-failed",
      "--",
      chrome,
      ...launchArguments,
    ]);
    const systemd = await waitSystemd(root, unit);
    cgroupPath = `/sys/fs/cgroup${systemd.ControlGroup}`;
    const groupInfo = await Deno.lstat(cgroupPath);
    if (
      !groupInfo.isDirectory || groupInfo.isSymlink ||
      await Deno.realPath(cgroupPath) !== cgroupPath
    ) {
      throw new Error("unsafe owned Chrome cgroup identity");
    }
    const mainPid = Number(systemd.MainPID);
    const mainIdentity = await processIdentity(mainPid);
    if (!mainIdentity || mainIdentity.executable !== chrome) {
      throw new Error("systemd MainPID is not the reviewed Chrome executable");
    }
    const snapshotMembers = async () => {
      const pids = await readCgroupMembers(cgroupPath!);
      memberSnapshots.push({ at: new Date().toISOString(), pids });
      for (const pid of pids) {
        const identity = await processIdentity(pid);
        if (identity) observedProcesses.set(pid, identity);
      }
      return pids;
    };
    if (!(await snapshotMembers()).includes(mainPid)) {
      throw new Error("Chrome MainPID absent from cgroup");
    }
    cgroupIdentity = {
      unit,
      controlGroup: systemd.ControlGroup,
      path: cgroupPath,
      device: numeric(groupInfo.dev, "cgroup device"),
      inode: numeric(groupInfo.ino, "cgroup inode"),
      invocationId: systemd.InvocationID,
      mainPid,
      memberSnapshots,
    };
    cgroupKill = await Deno.open(`${cgroupPath}/cgroup.kill`, { write: true });

    const activePortPath = `${profilePath}/DevToolsActivePort`;
    let debuggerPort = 0;
    let browserPath = "";
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        const lines = (await Deno.readTextFile(activePortPath)).trim().split(/\r?\n/u);
        debuggerPort = Number(lines[0]);
        browserPath = lines[1] ?? "";
        if (debuggerPort > 0 && /^\/devtools\/browser\/[A-Za-z0-9-]+$/u.test(browserPath)) break;
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      }
      await delay(25);
    }
    if (!debuggerPort || !browserPath) {
      throw new Error("owned Chrome DevToolsActivePort unavailable");
    }
    const discovery = await (await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
    const websocket = new URL(String(discovery.webSocketDebuggerUrl));
    if (
      websocket.protocol !== "ws:" || websocket.hostname !== "127.0.0.1" ||
      Number(websocket.port) !== debuggerPort || websocket.pathname !== browserPath ||
      websocket.search || websocket.hash
    ) throw new Error("Chrome CDP endpoint escaped the owned loopback listener");
    browserSessionId = browserPath.split("/").at(-1)!;
    client = new CdpClient(websocket.href);
    await client.ready();
    version = await client.send("Browser.getVersion");
    if (version.product !== EXPECTED_CHROME_PRODUCT) {
      throw new Error(`exact Chrome product mismatch: ${version.product}`);
    }
    effectiveArguments = (await client.send("Browser.getBrowserCommandLine")).arguments as string[];
    if (
      !Array.isArray(effectiveArguments) ||
      !launchArguments.filter((argument) => argument.startsWith("--")).every((argument) =>
        effectiveArguments.filter((effective) => effective === argument).length === 1
      )
    ) throw new Error("effective Chrome command line omitted or duplicated a requested argument");
    for (const scenario of SCENARIOS) {
      scenarios.push(
        await collectScenario(
          client,
          serverOrigin,
          browserSessionId,
          scenario,
          staging,
          expectedFiles,
        ) as Record<string, unknown>,
      );
      await snapshotMembers();
    }
  } catch (error) {
    collectionError = error;
  } finally {
    await finalizeCleanup();
  }

  const cleanupFailures = Object.values(cleanup).filter((check) => check.outcome !== "success");
  if (collectionError || cleanupFailures.length) {
    await Deno.remove(staging, { recursive: true }).catch(() => {});
    throw new AggregateError(
      [collectionError, ...cleanupFailures.map((check) => check.error)].filter(Boolean),
      "browser collection or protected cleanup failed",
    );
  }
  const chromeAfter = await Deno.lstat(chrome);
  if (
    !chromeAfter.isFile || chromeAfter.isSymlink ||
    numeric(chromeAfter.dev, "ending Chrome device") !== chromeDevice ||
    numeric(chromeAfter.ino, "ending Chrome inode") !== chromeInode ||
    await sha256Hex(await Deno.readFile(chrome)) !== EXPECTED_CHROME_SHA256
  ) throw new Error("Chrome executable identity changed during collection");
  const endStatus = await commandText(root, "git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  const endCommit = await commandText(root, "git", ["rev-parse", "HEAD"]);
  const endTree = await commandText(root, "git", ["rev-parse", "HEAD^{tree}"]);
  if (endStatus !== "" || endCommit !== startCommit || endTree !== startTree) {
    await Deno.remove(staging, { recursive: true }).catch(() => {});
    throw new Error("source commit/tree/status changed during browser collection");
  }
  for (const expected of expectedFiles.values()) {
    const disk = await Deno.readFile(`${root}/${expected.sourcePath}`);
    const accepted = await gitBytes(root, ACCEPTED_COMMIT, expected.sourcePath);
    if (
      disk.length !== expected.bytes || disk.length !== accepted.length ||
      await sha256Hex(disk) !== expected.sha256 || await sha256Hex(accepted) !== expected.sha256
    ) throw new Error(`accepted source changed by collection end: ${expected.sourcePath}`);
  }
  for (const support of supportFiles) {
    const disk = await Deno.readFile(`${root}/${support.path}`);
    const head = await gitBytes(root, startCommit, support.path);
    if (
      disk.length !== support.bytes || head.length !== support.bytes ||
      await sha256Hex(disk) !== support.sha256 || await sha256Hex(head) !== support.sha256
    ) throw new Error(`collector support changed by collection end: ${support.path}`);
  }
  if (!serverIdentity || !profileIdentity || !cgroupIdentity) {
    throw new Error("successful collection omitted an owned setup identity");
  }

  const sourceFiles = [...expectedFiles.values()];
  const evidence = {
    schemaVersion: 1,
    evidenceId: "simulation-rigid-body-2d-chrome-150-browser-evidence-v1",
    collectedAt: new Date().toISOString(),
    authority: {
      kind: "authoritative-parent-run-browser-collection",
      browserWasLaunchedByCollector: true,
      importedOrChildGeneratedEvidenceAccepted: false,
    },
    source: {
      acceptedCommit: ACCEPTED_COMMIT,
      acceptedTree: ACCEPTED_TREE,
      start: { commit: startCommit, tree: startTree, cleanStatus: "clean" },
      end: { commit: endCommit, tree: endTree, cleanStatus: "clean" },
      unchanged: true,
      root,
      sourceGraphSha256: await sha256Hex(encoder.encode(canonicalize(sourceFiles))),
      files: sourceFiles,
      supportFiles,
    },
    collector: {
      script: SCRIPT,
      command: [
        Deno.execPath(),
        "run",
        "-A",
        SCRIPT,
        `--source-commit=${ACCEPTED_COMMIT}`,
        `--chrome=${options.chrome}`,
        `--output=${options.output}`,
      ],
      output: options.output,
      denoVersion: Deno.version.deno,
    },
    workload: {
      id: "simulation.rigid-body-2d.v1",
      registrationId: "simulation-rigid-body-2d-v1-controlled",
      route: WORKLOAD_ROUTE,
      targets: ["javascript", "wasm-linear"],
      bodies: 500,
      joints: 19,
      timesteps: 1_800,
      checkpoints: 6,
      checkpointStateValues: 18_000,
      checkpointDigest: "b54a6129",
      metrics: EXPECTED_METRICS,
      counters: {
        javascript: expectedCounters("javascript"),
        wasmLinear: expectedCounters("wasm-linear"),
      },
      angularWork: {
        rotatedManifoldTests: 36_036_054,
        angularContactImpulses: 431_986,
        jointImpulses: 2_394_000,
        torqueApplications: 60_000,
      },
      performanceClaim: false,
    },
    browser: {
      product: String(version.product),
      revision: String(version.revision),
      userAgent: String(version.userAgent),
      jsVersion: String(version.jsVersion),
      executable: {
        path: chrome,
        bytes: chromeBytes.length,
        sha256: EXPECTED_CHROME_SHA256,
        device: chromeDevice,
        inode: chromeInode,
      },
      launchArguments,
      effectiveArguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
      browserSessionId,
      profile: profileIdentity,
      cgroup: cgroupIdentity,
      processes: [...observedProcesses.values()].sort((a, b) => a.pid - b.pid),
    },
    server: { origin: serverOrigin, mode: "public", launcher: serverIdentity },
    scenarios,
    cleanup,
  };
  await assertClosedSchema(root, evidence);
  await Deno.writeTextFile(`${staging}/evidence.v1.json`, `${canonicalize(evidence)}\n`, {
    createNew: true,
  });
  await Deno.rename(staging, outputDirectory);
  console.log(
    "rigid-body 2D: 3 exact completions + 6 causal lifecycle probes; protected cleanup exact",
  );
}

if (import.meta.main) await main();

import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";
import { prepareProfile, ProfileIdentity, removeOwnedProfile } from "../lib/process-ledger.ts";

export const ACCEPTED_STATIC_COMMIT = "1f48dc3adf1f42f698bbe50c5787a193905af72a";
export const EXPECTED_CHROME_PRODUCT = "Chrome/150.0.7871.24";
export const EXPECTED_CHROME_SHA256 =
  "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
export const WORKLOAD_ROUTE = "/benchmarks/base/audio-webaudio-effects-v1/";
export const OUTPUT_SHA256 = "fba0623a3af7679b1e95b79c7f454c38e1ac2123de5ebf3a7a86bc43bff16550";
const SCRIPT = "scripts/collect-base-audio-webaudio-effects-browser-evidence.ts";
const SCHEMA = "schemas/base-audio-webaudio-effects-browser-evidence.schema.json";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const EXPECTED_ASSETS = Object.freeze({
  [WORKLOAD_ROUTE]: "public/benchmarks/base/audio-webaudio-effects-v1/index.html",
  "/styles.css": "public/styles.css",
  "/base-audio-effects-demo.js": "public/base-audio-effects-demo.js",
  "/base-audio-effects-worker.js": "public/base-audio-effects-worker.js",
  "/benchmarks/base/audio-webaudio-effects/workload.js":
    "benchmarks/base/audio-webaudio-effects/workload.js",
  "/artifacts/base-audio-webaudio-effects-v1/build-manifest.json":
    "public/artifacts/base-audio-webaudio-effects-v1/build-manifest.json",
  "/artifacts/base-audio-webaudio-effects-v1/output-manifest.json":
    "public/artifacts/base-audio-webaudio-effects-v1/output-manifest.json",
  "/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm":
    "public/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm",
});

export const ORACLE = Object.freeze({
  kind: "full-output-f64-tolerance",
  absoluteTolerance: 0.00002,
  relativeTolerance: 0.0002,
  maxAbsolute: 0.0000018638636976597844,
  maxRelative: 0.24027635719300827,
  violations: 0,
  nonFinite: 0,
});

export function expectedCounters(target: "javascript" | "wasm-linear") {
  return {
    channels: 2,
    "input-frames": 2_880_000,
    "input-samples": 5_760_000,
    "blocks-per-channel": 22_500,
    "block-invocations": 45_000,
    "output-frames": 2_880_015,
    "output-samples": 5_760_030,
    "biquad-samples": 5_760_000,
    "compressor-detector-updates": 5_760_000,
    "convolution-macs": 92_160_480,
    "state-carry-boundaries-per-channel": 22_499,
    "state-carry-boundaries": 44_998,
    "tail-flush-invocations": 2,
    "tail-flush-frames-per-channel": 15,
    "tail-flush-frames": 30,
    "fixture-allocations": 2,
    allocations: target === "javascript" ? 4 : 0,
    "validation-output-copies": target === "wasm-linear" ? 2 : 0,
    "boundary-crossings": target === "wasm-linear" ? 45_002 : 0,
  };
}

interface Observations {
  blocksPerChannel: number[];
  blockInvocations: number;
  stateCarryBoundaries: number;
  tailFlushInvocations: number;
  tailFlushFrames: number;
  processingBoundaryCrossings: number;
}

export function validateCompleteResult(
  target: "javascript" | "wasm-linear",
  text: string,
  observations: Observations,
) {
  const fields = {
    target: text.match(/^Target: (.+)$/m)?.[1],
    digest: text.match(/^Complete output SHA-256: ([a-f0-9]{64})$/m)?.[1],
    frames: Number(text.match(/^Frames: ([0-9]+)$/m)?.[1]),
    blocks: Number(text.match(/^Blocks per channel: ([0-9]+)$/m)?.[1]),
    invocations: Number(text.match(/^Block invocations: ([0-9]+)$/m)?.[1]),
    outputSamples: Number(text.match(/^Output samples: ([0-9]+)$/m)?.[1]),
    convolutionMacs: Number(text.match(/^Convolution MACs: ([0-9]+)$/m)?.[1]),
    boundaryCrossings: Number(text.match(/^Boundary crossings: ([0-9]+)$/m)?.[1]),
  };
  const expected = expectedCounters(target);
  if (
    fields.target !== target || fields.digest !== OUTPUT_SHA256 || fields.frames !== 2_880_000 ||
    fields.blocks !== 22_500 || fields.invocations !== 45_000 ||
    fields.outputSamples !== 5_760_030 || fields.convolutionMacs !== 92_160_480 ||
    fields.boundaryCrossings !== expected["boundary-crossings"]
  ) throw new Error(`${target}: visible complete-output contract mismatch`);
  const expectedObservations: Observations = {
    blocksPerChannel: [22_500, 22_500],
    blockInvocations: 45_000,
    stateCarryBoundaries: 44_998,
    tailFlushInvocations: 2,
    tailFlushFrames: 30,
    processingBoundaryCrossings: expected["boundary-crossings"],
  };
  if (JSON.stringify(observations) !== JSON.stringify(expectedObservations)) {
    throw new Error(`${target}: observed block/state/tail execution mismatch`);
  }
  return {
    target,
    completeOutputSha256: fields.digest,
    completeOutputBytes: 23_040_120,
    observations,
    counters: expected,
    oracle: ORACLE,
    passed: true,
  };
}

interface ProcessIdentity {
  pid: number;
  parentPid: number;
  startTimeTicks: string;
  executable: string;
}
interface CleanupCheck {
  outcome: "success" | "failure";
  checkedAt: string;
  remaining: string[];
  error?: string;
}
interface FileRecord {
  route: string;
  sourcePath: string;
  bytes: number;
  sha256: string;
  gitBlob: string;
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
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`${label} unavailable`);
  return result;
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
    throw new Error(`${command} failed: ${textDecoder.decode(output.stderr).trim()}`);
  }
  return textDecoder.decode(output.stdout).trim();
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
      /^\/.+/.test(state.ControlGroup ?? "") && /^[a-f0-9]{32}$/.test(state.InvocationID ?? "")
    ) return state;
    await delay(25);
  }
  throw new Error("owned Chrome systemd service did not become active");
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

export interface DevToolsEndpoint {
  port: number;
  browserPath: string;
}
export interface ListenerOwnershipProof {
  at: string;
  port: number;
  socketInode: string;
  ownerPid: number;
  ownerFd: string;
  cgroupPids: number[];
}

export async function waitDevToolsActivePort(
  profileRoot: string,
  timeoutMs = 10_000,
): Promise<DevToolsEndpoint> {
  const path = `${profileRoot}/DevToolsActivePort`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const info = await Deno.lstat(path);
      if (info.isSymlink || !info.isFile) throw new Error("unsafe DevToolsActivePort");
      const lines = (await Deno.readTextFile(path)).trim().split(/\r?\n/);
      const port = Number(lines[0]);
      const browserPath = lines[1] ?? "";
      if (
        lines.length === 2 && Number.isSafeInteger(port) && port > 0 && port <= 65_535 &&
        /^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(browserPath)
      ) return { port, browserPath };
      throw new Error("invalid DevToolsActivePort");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    await delay(25);
  }
  throw new Error("owned Chrome DevToolsActivePort unavailable");
}

async function listenerSocketInode(port: number, procRoot: string): Promise<string> {
  const wantedPort = port.toString(16).toUpperCase().padStart(4, "0");
  for (const table of [`${procRoot}/net/tcp`, `${procRoot}/net/tcp6`]) {
    try {
      const lines = (await Deno.readTextFile(table)).trim().split("\n").slice(1);
      for (const line of lines) {
        const fields = line.trim().split(/\s+/);
        const [address, candidatePort] = (fields[1] ?? "").split(":");
        const loopback = address === "0100007F" ||
          address === "00000000000000000000000001000000";
        if (
          loopback && candidatePort === wantedPort && fields[3] === "0A" &&
          /^\d+$/.test(fields[9] ?? "")
        ) return fields[9];
      }
    } catch { /* the other kernel table may contain the listener */ }
  }
  throw new Error("DevTools listener socket not found on loopback");
}

export async function proveDevToolsListenerOwned(
  port: number,
  cgroup: { path: string; device: number; inode: number },
  procRoot = "/proc",
): Promise<ListenerOwnershipProof> {
  const assertCgroupIdentity = async () => {
    const info = await Deno.lstat(cgroup.path);
    if (
      info.isSymlink || !info.isDirectory ||
      numeric(info.dev, "listener cgroup device") !== cgroup.device ||
      numeric(info.ino, "listener cgroup inode") !== cgroup.inode
    ) throw new Error("owned cgroup identity changed during listener proof");
  };
  await assertCgroupIdentity();
  const cgroupPids = await readCgroupMembers(cgroup.path);
  const socketInode = await listenerSocketInode(port, procRoot);
  const wanted = `socket:[${socketInode}]`;
  for (const ownerPid of cgroupPids) {
    try {
      for await (const fd of Deno.readDir(`${procRoot}/${ownerPid}/fd`)) {
        try {
          if (await Deno.readLink(`${procRoot}/${ownerPid}/fd/${fd.name}`) !== wanted) continue;
          await assertCgroupIdentity();
          const afterPids = await readCgroupMembers(cgroup.path);
          if (!afterPids.includes(ownerPid)) {
            throw new Error("DevTools listener owner left exact Chrome cgroup");
          }
          return {
            at: new Date().toISOString(),
            port,
            socketInode,
            ownerPid,
            ownerFd: fd.name,
            cgroupPids: afterPids,
          };
        } catch (error) {
          if (!(error instanceof Deno.errors.NotFound)) throw error;
        }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  throw new Error("DevTools listener inode has no owner in exact Chrome cgroup");
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
  if (response.exceptionDetails) throw new Error(`browser evaluation failed: ${expression}`);
  return (response.result as { value?: unknown }).value;
}
async function click(client: CdpClient, sessionId: string, selector: string) {
  const point = await evaluate(
    client,
    sessionId,
    `(() => { const n=document.querySelector(${
      JSON.stringify(selector)
    }); const r=n.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:n.disabled}; })()`,
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
async function state(client: CdpClient, sessionId: string) {
  return await evaluate(
    client,
    sessionId,
    `(() => ({status:document.querySelector('#status').textContent.trim(),output:document.querySelector('#output').textContent,progress:document.querySelector('#progress').value,startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled,statusHistory:[...__audioCollector.statusHistory],workerMessages:__audioCollector.workerMessages,workers:__audioCollector.workers.map((entry)=>({url:entry.url,terminated:entry.terminated,request:entry.request}))}))()`,
  ) as Record<string, unknown>;
}
async function waitState(
  client: CdpClient,
  sessionId: string,
  predicate: (value: Record<string, unknown>) => boolean,
  timeoutMs = 130_000,
) {
  const deadline = Date.now() + timeoutMs;
  let current: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    current = await state(client, sessionId);
    if (predicate(current)) return current;
    await delay(50);
  }
  throw new Error(`browser state timeout: ${JSON.stringify(current)}`);
}

const pageAuditSource = (shortTimeout: boolean) =>
  `(() => {
  const NativeWorker=globalThis.Worker;
  const nativeSetTimeout=globalThis.setTimeout.bind(globalThis);
  const audit={workers:[],workerMessages:[],statusHistory:[]};
  globalThis.__audioCollector=audit;
  class CollectorWorker extends NativeWorker {
    constructor(...args){
      super(...args);
      const entry={worker:this,url:String(args[0]),terminated:false,request:null};
      audit.workers.push(entry);
      this.addEventListener('message',(event)=>{ try{ audit.workerMessages.push(structuredClone(event.data)); }catch{ audit.workerMessages.push({type:'uncloneable'}); } });
      const nativePost=this.postMessage.bind(this);
      this.postMessage=(data,transfer)=>{ entry.request=structuredClone(data); return transfer===undefined?nativePost(data):nativePost(data,transfer); };
      const nativeTerminate=this.terminate.bind(this);
      this.terminate=()=>{ entry.terminated=true; return nativeTerminate(); };
    }
  }
  Object.defineProperty(globalThis,'Worker',{value:CollectorWorker,configurable:true,writable:true});
  ${
    shortTimeout
      ? "globalThis.setTimeout=(fn,delay,...args)=>nativeSetTimeout(fn,delay===120000?50:delay,...args);"
      : ""
  }
  addEventListener('DOMContentLoaded',()=>{
    const node=document.querySelector('#status');
    const record=()=>{ const value=node?.textContent?.trim(); if(value&&audit.statusHistory.at(-1)!==value)audit.statusHistory.push(value); };
    record(); new MutationObserver(record).observe(node,{childList:true,characterData:true,subtree:true});
  });
})()`;

const workerAuditSource = `(() => {
  const audit={blobs:[],wasmModules:[],observations:[]};
  globalThis.__audioWorkerAudit=audit;
  const NativeBlob=globalThis.Blob;
  globalThis.Blob=class CollectorBlob extends NativeBlob {
    constructor(parts,options){
      super(parts,options);
      const chunks=[];
      for(const part of parts){
        if(part instanceof Uint8Array)chunks.push(part);
        else if(part instanceof ArrayBuffer)chunks.push(new Uint8Array(part));
        else if(typeof part==='string')chunks.push(new TextEncoder().encode(part));
        else throw new Error('collector denied unknown Blob part');
      }
      const length=chunks.reduce((sum,chunk)=>sum+chunk.length,0),bytes=new Uint8Array(length);
      let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      this.__collectorBytes=bytes;
    }
  };
  const nativeCreate=URL.createObjectURL.bind(URL);
  URL.createObjectURL=(blob)=>{
    const objectUrl=nativeCreate(blob),raw=blob.__collectorBytes;
    let binary=''; for(let i=0;i<raw.length;i+=32768)binary+=String.fromCharCode(...raw.subarray(i,i+32768));
    audit.blobs.push({objectUrl,mimeType:blob.type,bytes:raw.length,base64:btoa(binary)});
    return objectUrl;
  };
  const nativeInstantiate=WebAssembly.instantiate.bind(WebAssembly);
  WebAssembly.instantiate=async(source,...args)=>{
    const raw=source instanceof ArrayBuffer?new Uint8Array(source):ArrayBuffer.isView(source)?new Uint8Array(source.buffer,source.byteOffset,source.byteLength):null;
    if(!raw)throw new Error('collector denied opaque Wasm source');
    let binary=''; for(let i=0;i<raw.length;i+=32768)binary+=String.fromCharCode(...raw.subarray(i,i+32768));
    audit.wasmModules.push({bytes:raw.length,base64:btoa(binary)});
    return await nativeInstantiate(source,...args);
  };
  const nativeFreeze=Object.freeze.bind(Object);
  Object.freeze=(value)=>{
    if(value&&typeof value==='object'&&Array.isArray(value.blocksPerChannel)&&Number.isInteger(value.blockInvocations)){
      audit.observations.push(structuredClone(value));
    }
    return nativeFreeze(value);
  };
  const nativePost=globalThis.postMessage.bind(globalThis);
  globalThis.postMessage=(data,transfer)=>{
    if(data?.type==='complete')data.__collectorExecutionAudit=structuredClone(audit);
    return transfer===undefined?nativePost(data):nativePost(data,transfer);
  };
})()`;

interface Scenario {
  id: string;
  action:
    | "complete"
    | "wrong-token"
    | "stale-restart"
    | "restart"
    | "cancel"
    | "timeout"
    | "pagehide";
  target: "javascript" | "wasm-linear";
}
export const SCENARIOS: readonly Scenario[] = [
  { id: "javascript-complete", action: "complete", target: "javascript" },
  { id: "wasm-linear-complete", action: "complete", target: "wasm-linear" },
  { id: "wrong-token", action: "wrong-token", target: "javascript" },
  { id: "stale-restart", action: "stale-restart", target: "javascript" },
  { id: "restart", action: "restart", target: "wasm-linear" },
  { id: "cancel", action: "cancel", target: "javascript" },
  { id: "timeout", action: "timeout", target: "wasm-linear" },
  { id: "pagehide", action: "pagehide", target: "javascript" },
] as const;

function sourcePathFor(url: string): string | null {
  const parsed = new URL(url);
  if (parsed.pathname === "/favicon.ico" || parsed.pathname === "/favicon.svg") {
    return "public/favicon.svg";
  }
  return EXPECTED_ASSETS[parsed.pathname as keyof typeof EXPECTED_ASSETS] ?? null;
}

async function settle(tasks: Promise<void>[]) {
  for (let cursor = 0; cursor < tasks.length; cursor++) await tasks[cursor];
  await delay(100);
  for (let cursor = 0; cursor < tasks.length; cursor++) await tasks[cursor];
}

async function collectScenario(
  client: CdpClient,
  root: string,
  origin: string,
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
  const requests = new Map<string, Record<string, unknown>>();
  const executed = new Map<string, Record<string, unknown>>();
  const tasks: Promise<void>[] = [];
  const enableWorker = async (sessionId: string) => {
    await Promise.all([
      client.send("Network.enable", { maxTotalBufferSize: 30_000_000 }, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Debugger.enable", {}, sessionId),
    ]);
    await client.send("Runtime.evaluate", { expression: workerAuditSource }, sessionId);
    await client.send("Runtime.runIfWaitingForDebugger", {}, sessionId);
  };
  const removers = [
    client.on("Target.attachedToTarget", (params, eventSession) => {
      if (eventSession !== pageSessionId) return;
      const info = params.targetInfo as Record<string, unknown>;
      if (info.type !== "worker") {
        tasks.push(Promise.reject(new Error(`unexpected attached target type: ${info.type}`)));
        return;
      }
      const sessionId = String(params.sessionId);
      sessions.set(sessionId, { context: "worker", targetId: String(info.targetId) });
      tasks.push(enableWorker(sessionId));
    }),
    client.on("Runtime.consoleAPICalled", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      consoleEntries.push({
        context: sessions.get(sessionId)!.context,
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
        text: String(details.text),
        lineNumber: Number(details.lineNumber),
        columnNumber: Number(details.columnNumber),
      });
    }),
    client.on("Network.requestWillBeSent", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      const request = params.request as Record<string, unknown>;
      requests.set(`${sessionId}:${params.requestId}`, {
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
        responseBody: { status: "unavailable", reason: "response not completed" },
      });
    }),
    client.on("Network.responseReceived", (params, sessionId) => {
      if (!sessionId) return;
      const entry = requests.get(`${sessionId}:${params.requestId}`);
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
      const entry = requests.get(`${sessionId}:${params.requestId}`);
      if (entry) {
        Object.assign(entry, {
          failed: true,
          responseBody: { status: "unavailable", reason: String(params.errorText) },
        });
      }
    }),
    client.on("Network.loadingFinished", (params, sessionId) => {
      if (!sessionId) return;
      const entry = requests.get(`${sessionId}:${params.requestId}`);
      if (!entry) return;
      tasks.push((async () => {
        if (String(entry.url).startsWith("blob:")) {
          entry.responseBody = {
            status: "unavailable",
            reason: "executed Blob bytes are retained by the worker constructor audit",
          };
          return;
        }
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
          : textEncoder.encode(String(response.body));
        const expected = await Deno.readFile(`${root}/${sourcePath}`);
        if (
          bytes.length !== expected.length || await sha256Hex(bytes) !== await sha256Hex(expected)
        ) throw new Error(`raw response differs from frozen source: ${sourcePath}`);
        entry.responseBody = {
          status: "supported",
          bytes: bytes.length,
          sha256: await sha256Hex(bytes),
          base64: bytesToBase64(bytes),
          sourcePath,
          gitBlob: await commandText(root, "git", ["rev-parse", `HEAD:${sourcePath}`]),
        };
      })());
    }),
    client.on("Debugger.scriptParsed", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      let parsed: URL;
      try {
        parsed = new URL(String(params.url));
      } catch {
        return;
      }
      if (parsed.origin !== origin || parsed.protocol === "blob:") return;
      const sourcePath = sourcePathFor(parsed.href);
      if (!sourcePath || !parsed.pathname.endsWith(".js")) return;
      tasks.push((async () => {
        const response = await client.send(
          "Debugger.getScriptSource",
          { scriptId: String(params.scriptId) },
          sessionId,
          10_000,
        );
        const bytes = textEncoder.encode(String(response.scriptSource));
        const expected = await Deno.readFile(`${root}/${sourcePath}`);
        if (
          bytes.length !== expected.length || await sha256Hex(bytes) !== await sha256Hex(expected)
        ) throw new Error(`executed script differs from frozen source: ${sourcePath}`);
        executed.set(`${sessionId}:${parsed.pathname}`, {
          context: sessions.get(sessionId)!.context,
          sessionId,
          route: parsed.pathname,
          sourcePath,
          bytes: bytes.length,
          sha256: await sha256Hex(bytes),
          base64: bytesToBase64(bytes),
          gitBlob: await commandText(root, "git", ["rev-parse", `HEAD:${sourcePath}`]),
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
    await waitState(client, pageSessionId, (value) => value.status === "Ready.", 10_000);
    await evaluate(
      client,
      pageSessionId,
      `(() => { const n=document.querySelector('#target'); n.value=${
        JSON.stringify(scenario.target)
      }; n.dispatchEvent(new Event('change',{bubbles:true})); })()`,
    );
    await click(client, pageSessionId, "#start");
    const lifecycleChecks: string[] = [];
    let final: Record<string, unknown>;
    if (scenario.action === "complete") {
      final = await waitState(
        client,
        pageSessionId,
        (value) => value.status === "Complete. The full output matched the committed oracle.",
      );
    } else {
      await waitState(
        client,
        pageSessionId,
        (value) => (value.workers as unknown[]).length >= 1,
        5_000,
      );
      if (scenario.action === "wrong-token") {
        const before = await state(client, pageSessionId);
        await evaluate(
          client,
          pageSessionId,
          `__audioCollector.workers[0].worker.dispatchEvent(new MessageEvent('message',{data:{token:999999,type:'complete',text:'fabricated'}}))`,
        );
        await delay(50);
        const after = await state(client, pageSessionId);
        if (before.status !== after.status || before.output !== after.output) {
          throw new Error("wrong-token completion mutated visible state");
        }
        lifecycleChecks.push("wrong-token completion was ignored without visible mutation");
        await click(client, pageSessionId, "#cancel");
      } else if (scenario.action === "stale-restart") {
        await evaluate(client, pageSessionId, "__audioCollector.stale=__audioCollector.workers[0]");
        await click(client, pageSessionId, "#cancel");
        await click(client, pageSessionId, "#start");
        await waitState(
          client,
          pageSessionId,
          (value) => (value.workers as unknown[]).length === 2,
          5_000,
        );
        const before = await state(client, pageSessionId);
        await evaluate(
          client,
          pageSessionId,
          `__audioCollector.stale.worker.dispatchEvent(new ErrorEvent('error',{message:'stale injected error'}))`,
        );
        await delay(50);
        const after = await state(client, pageSessionId);
        if (before.status !== after.status || String(after.status).startsWith("Stopped:")) {
          throw new Error("stale prior-worker error mutated restarted generation");
        }
        lifecycleChecks.push("stale prior-worker error was ignored after a fresh restart");
        await click(client, pageSessionId, "#cancel");
      } else if (scenario.action === "restart") {
        const first = (await state(client, pageSessionId)).workers as Array<
          Record<string, unknown>
        >;
        await click(client, pageSessionId, "#cancel");
        await click(client, pageSessionId, "#start");
        const restarted = await waitState(
          client,
          pageSessionId,
          (value) => (value.workers as unknown[]).length === 2,
          5_000,
        );
        const workers = restarted.workers as Array<Record<string, unknown>>;
        if (!first[0].request || !workers[0].terminated || workers[1].terminated) {
          throw new Error("restart did not replace the terminated worker causally");
        }
        lifecycleChecks.push("cancel then restart replaced the exact prior worker and token");
        await click(client, pageSessionId, "#cancel");
      } else if (scenario.action === "cancel") {
        await click(client, pageSessionId, "#cancel");
        lifecycleChecks.push("visible Cancel terminated the active worker and retained no result");
      } else if (scenario.action === "timeout") {
        await waitState(
          client,
          pageSessionId,
          (value) => value.status === "Stopped: the 120-second validation timeout expired.",
          5_000,
        );
        lifecycleChecks.push("the registered 120-second timeout path terminated the active worker");
      } else {
        await evaluate(
          client,
          pageSessionId,
          `dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}))`,
        );
        lifecycleChecks.push("pagehide terminated the active worker and reset visible controls");
      }
      final = await state(client, pageSessionId);
      const workers = final.workers as Array<Record<string, unknown>>;
      const expectedWorkerCount = ["stale-restart", "restart"].includes(scenario.action) ? 2 : 1;
      const expectedStatus: Record<string, string> = {
        "wrong-token": "Cancelled. No result was retained.",
        "stale-restart": "Cancelled. No result was retained.",
        restart: "Cancelled. No result was retained.",
        cancel: "Cancelled. No result was retained.",
        timeout: "Stopped: the 120-second validation timeout expired.",
        pagehide: "Page hidden; active work was terminated.",
      };
      if (
        workers.length !== expectedWorkerCount || workers.some((worker) => !worker.terminated) ||
        final.status !== expectedStatus[scenario.action] || final.output !== "" ||
        final.startDisabled !== false || final.cancelDisabled !== true
      ) throw new Error(`${scenario.id}: causal worker termination/final-state contract mismatch`);
    }
    await settle(tasks);
    const network = [...requests.values()];
    const invalidNetwork = network.filter((entry) => {
      const url = String(entry.url);
      return !url.startsWith(origin) && !url.startsWith(`blob:${origin}`) ||
        entry.method !== "GET" || entry.failed || entry.status !== 200 ||
        entry.fromDiskCache || entry.fromServiceWorker ||
        (!url.startsWith("blob:") &&
          (entry.responseBody as Record<string, unknown>).status !== "supported");
    });
    if (invalidNetwork.length) {
      throw new Error(`network evidence incomplete: ${JSON.stringify(invalidNetwork)}`);
    }
    if (exceptions.length || consoleEntries.some((entry) => entry.type === "error")) {
      throw new Error(`${scenario.id}: page/worker console or exception gate failed`);
    }
    const executedScripts = [...executed.values()];
    if (
      !executedScripts.some((entry) =>
        entry.context === "page" && entry.route === "/base-audio-effects-demo.js"
      ) ||
      !executedScripts.some((entry) =>
        entry.context === "worker" && entry.route === "/base-audio-effects-worker.js"
      )
    ) throw new Error(`${scenario.id}: page and worker executed-source denominator incomplete`);
    let result: ReturnType<typeof validateCompleteResult> | undefined;
    let execution: Record<string, unknown> | undefined;
    if (scenario.action === "complete") {
      const messages = final.workerMessages as Array<Record<string, unknown>>;
      const completion = [...messages].reverse().find((message) => message.type === "complete");
      const audit = completion?.__collectorExecutionAudit as Record<string, unknown> | undefined;
      const observations = (audit?.observations as Observations[] | undefined)?.at(-1);
      if (!completion || !audit || !observations) {
        throw new Error(`${scenario.id}: exact worker execution audit missing`);
      }
      result = validateCompleteResult(scenario.target, String(completion.text), observations);
      const blobs = (audit.blobs as Array<Record<string, unknown>>) ?? [];
      if (blobs.length !== 1) throw new Error(`${scenario.id}: workload Blob denominator mismatch`);
      const workload = expectedFiles.get("/benchmarks/base/audio-webaudio-effects/workload.js")!;
      const blobBytes = base64ToBytes(String(blobs[0].base64));
      if (
        blobBytes.length !== workload.bytes || await sha256Hex(blobBytes) !== workload.sha256
      ) throw new Error(`${scenario.id}: executed Blob bytes differ from frozen workload source`);
      const wasmModules = ((audit.wasmModules as Array<Record<string, unknown>>) ?? []).map(
        async (module) => {
          const bytes = base64ToBytes(String(module.base64));
          return {
            bytes: bytes.length,
            sha256: await sha256Hex(bytes),
            base64: String(module.base64),
          };
        },
      );
      const resolvedModules = await Promise.all(wasmModules);
      const expectedWasm = expectedFiles.get(
        "/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm",
      )!;
      if (
        scenario.target === "wasm-linear" &&
        (resolvedModules.length !== 1 || resolvedModules[0].bytes !== expectedWasm.bytes ||
          resolvedModules[0].sha256 !== expectedWasm.sha256)
      ) throw new Error("executed Wasm module bytes differ from the frozen artifact");
      if (scenario.target === "javascript" && resolvedModules.length !== 0) {
        throw new Error("JavaScript target unexpectedly instantiated Wasm");
      }
      execution = {
        workloadBlob: {
          objectUrl: String(blobs[0].objectUrl),
          mimeType: String(blobs[0].mimeType),
          bytes: blobBytes.length,
          sha256: await sha256Hex(blobBytes),
          base64: String(blobs[0].base64),
        },
        wasmModules: resolvedModules,
        completedWorkerImportedBlob: true,
      };
      for (
        const route of [
          WORKLOAD_ROUTE,
          "/styles.css",
          "/base-audio-effects-demo.js",
          "/base-audio-effects-worker.js",
          "/benchmarks/base/audio-webaudio-effects/workload.js",
          "/artifacts/base-audio-webaudio-effects-v1/build-manifest.json",
          "/artifacts/base-audio-webaudio-effects-v1/output-manifest.json",
          ...(scenario.target === "wasm-linear"
            ? ["/artifacts/base-audio-webaudio-effects-v1/audio-webaudio-effects.wasm"]
            : []),
        ]
      ) {
        if (!network.some((entry) => new URL(String(entry.url)).pathname === route)) {
          throw new Error(`${scenario.id}: required response absent: ${route}`);
        }
      }
    }
    const axResponse = await client.send(
      "Accessibility.getFullAXTree",
      {},
      pageSessionId,
      10_000,
    );
    const axNodes = (axResponse.nodes as Array<Record<string, unknown>>) ?? [];
    const relatedNodes = (value: unknown) =>
      ((value as { relatedNodes?: Array<Record<string, unknown>> } | undefined)?.relatedNodes ?? [])
        .map((target) => ({
          backendDOMNodeId: Number(target.backendDOMNodeId),
          text: String(target.text ?? ""),
        })).filter((target) => Number.isSafeInteger(target.backendDOMNodeId));
    const relationships = (node: Record<string, unknown>) => {
      const found: Array<{ type: string; targets: Array<Record<string, unknown>> }> = [];
      for (const source of ((node.name as { sources?: unknown[] } | undefined)?.sources ?? [])) {
        const record = source as Record<string, unknown>;
        const targets = relatedNodes(record.attributeValue ?? record.value);
        if (targets.length) found.push({ type: String(record.attribute ?? record.type), targets });
      }
      for (
        const property of (node.properties as Array<Record<string, unknown>> | undefined) ?? []
      ) {
        const targets = relatedNodes(property.value);
        if (targets.length) found.push({ type: String(property.name), targets });
      }
      return found;
    };
    const requiredAx = [
      { role: "heading", name: "Complete 60-second stereo effects rack" },
      { role: "combobox", name: "Engine", relationship: true },
      { role: "button", name: "Start full validation" },
      { role: "button", name: "Cancel" },
      { role: "progressbar", name: "Validation phase" },
    ];
    const axControls = requiredAx.map((required) => {
      const node = axNodes.find((candidate) =>
        String((candidate.role as { value?: unknown } | undefined)?.value ?? "") ===
          required.role &&
        String((candidate.name as { value?: unknown } | undefined)?.value ?? "") === required.name
      );
      if (!node) {
        throw new Error(`${scenario.id}: AX role/name missing: ${required.role} ${required.name}`);
      }
      const controlRelationships = relationships(node);
      if (required.relationship && !controlRelationships.some((entry) => entry.targets.length)) {
        throw new Error(`${scenario.id}: AX Engine combobox omitted its label relationship`);
      }
      return { role: required.role, name: required.name, relationships: controlRelationships };
    });
    const bodyText = String(await evaluate(client, pageSessionId, "document.body.innerText"));
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
    if (screenshotBytes.slice(0, 8).join(",") !== "137,80,78,71,13,10,26,10") {
      throw new Error(`${scenario.id}: screenshot is not PNG`);
    }
    const screenshotFile = `screenshots/${scenario.id}.png`;
    await Deno.mkdir(`${staging}/screenshots`, { recursive: true });
    await Deno.writeFile(`${staging}/${screenshotFile}`, screenshotBytes, { createNew: true });
    return {
      id: scenario.id,
      action: scenario.action,
      target: scenario.target,
      pageTarget: { targetId, sessionId: pageSessionId },
      workerTargets: [...sessions.entries()].filter(([, value]) => value.context === "worker").map(
        ([sessionId, value]) => ({ targetId: value.targetId, sessionId }),
      ),
      statusHistory: final.statusHistory,
      finalState: {
        status: String(final.status),
        output: String(final.output),
        progress: Number(final.progress),
        startDisabled: Boolean(final.startDisabled),
        cancelDisabled: Boolean(final.cancelDisabled),
      },
      network,
      executedScripts,
      console: consoleEntries,
      exceptions,
      accessibility: {
        bodyText,
        statusText: String(final.status),
        resultText: String(final.output),
        axControls,
      },
      screenshot: {
        file: screenshotFile,
        bytes: screenshotBytes.length,
        sha256: await sha256Hex(screenshotBytes),
      },
      ...(result ? { result, execution } : { lifecycle: { checks: lifecycleChecks } }),
    };
  } finally {
    for (const remove of removers) remove();
    await client.send("Target.closeTarget", { targetId }).catch(() => ({}));
  }
}

export async function assertEvidenceSemantics(evidence: unknown): Promise<void> {
  const record = evidence as Record<string, unknown>;
  const source = record.source as Record<string, unknown>;
  const start = source.start as Record<string, unknown>;
  const end = source.end as Record<string, unknown>;
  if (
    source.unchanged !== true || start.commit !== end.commit || start.tree !== end.tree ||
    record.evidenceId !== `audio-webaudio-effects-browser-${String(start.commit).slice(0, 12)}`
  ) throw new Error("source start/end commit and tree are not semantically unchanged");

  const assertEncoded = async (value: unknown, label: string) => {
    const payload = value as Record<string, unknown>;
    const bytes = base64ToBytes(String(payload.base64));
    if (
      bytesToBase64(bytes) !== payload.base64 || bytes.length !== payload.bytes ||
      await sha256Hex(bytes) !== payload.sha256
    ) throw new Error(`${label} base64 bytes/hash mismatch`);
  };
  const browser = record.browser as Record<string, unknown>;
  const cgroup = browser.cgroup as Record<string, unknown>;
  const listenerAssertions = cgroup.listenerAssertions as Array<Record<string, unknown>>;
  if (
    listenerAssertions.length !== 2 ||
    listenerAssertions[0].port !== listenerAssertions[1].port ||
    listenerAssertions[0].socketInode !== listenerAssertions[1].socketInode ||
    listenerAssertions.some((proof) => !(proof.cgroupPids as unknown[]).includes(proof.ownerPid))
  ) throw new Error("DevTools listener before/after ownership proof mismatch");

  const lifecycleChecks: Record<string, string> = {
    "wrong-token": "wrong-token completion was ignored without visible mutation",
    "stale-restart": "stale prior-worker error was ignored after a fresh restart",
    restart: "cancel then restart replaced the exact prior worker and token",
    cancel: "visible Cancel terminated the active worker and retained no result",
    timeout: "the registered 120-second timeout path terminated the active worker",
    pagehide: "pagehide terminated the active worker and reset visible controls",
  };
  for (const scenarioValue of record.scenarios as Array<Record<string, unknown>>) {
    for (const executed of scenarioValue.executedScripts as unknown[]) {
      await assertEncoded(executed, `${scenarioValue.id} executed script`);
    }
    for (const network of scenarioValue.network as Array<Record<string, unknown>>) {
      const body = network.responseBody as Record<string, unknown>;
      if (body.status === "supported") await assertEncoded(body, `${scenarioValue.id} response`);
    }
    const execution = scenarioValue.execution as Record<string, unknown> | undefined;
    if (execution) {
      await assertEncoded(execution.workloadBlob, `${scenarioValue.id} workload Blob`);
      for (const wasm of execution.wasmModules as unknown[]) {
        await assertEncoded(wasm, `${scenarioValue.id} Wasm module`);
      }
    }
    const expectedLifecycle = lifecycleChecks[String(scenarioValue.id)];
    if (expectedLifecycle) {
      const checks = (scenarioValue.lifecycle as { checks?: unknown[] } | undefined)?.checks;
      if (checks?.length !== 1 || checks[0] !== expectedLifecycle) {
        throw new Error(`${scenarioValue.id} lifecycle assertion is not causal`);
      }
    }
    const controls =
      (scenarioValue.accessibility as { axControls?: Array<Record<string, unknown>> })
        .axControls ?? [];
    for (
      const expected of [
        ["heading", "Complete 60-second stereo effects rack"],
        ["combobox", "Engine"],
        ["button", "Start full validation"],
        ["button", "Cancel"],
        ["progressbar", "Validation phase"],
      ]
    ) {
      if (
        !controls.some((control) => control.role === expected[0] && control.name === expected[1])
      ) {
        throw new Error(`${scenarioValue.id} required AX control role/name missing`);
      }
    }
    const engine = controls.find((control) =>
      control.role === "combobox" && control.name === "Engine"
    );
    const relations = engine?.relationships as Array<{ targets?: unknown[] }> | undefined;
    if (!relations?.some((relation) => relation.targets?.length)) {
      throw new Error(`${scenarioValue.id} AX Engine label relationship missing`);
    }
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
  })({ strict: false, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(evidence)) {
    throw new Error(`browser evidence schema failed: ${JSON.stringify(validate.errors)}`);
  }
  await assertEvidenceSemantics(evidence);
}

function parseArguments() {
  const values = new Map<string, string>();
  for (const argument of Deno.args) {
    const match = /^--([a-z-]+)=(.+)$/.exec(argument);
    if (!match || !["chrome", "output"].includes(match[1]) || values.has(match[1])) {
      throw new Error(`unknown or duplicate collector argument: ${argument}`);
    }
    values.set(match[1], match[2]);
  }
  if (values.size !== 2 || !values.get("chrome") || !values.get("output")) {
    throw new Error(
      `usage: deno run -A ${SCRIPT} --chrome=<exact-CfT-path> --output=<new-dir>/evidence.v1.json`,
    );
  }
  return { chrome: values.get("chrome")!, output: values.get("output")! };
}

async function main() {
  if (Deno.build.os !== "linux") throw new Error("owned cgroup cleanup requires Linux");
  const options = parseArguments();
  const root = (await Deno.realPath(new URL("../", import.meta.url))).replace(/\/$/, "");
  if (
    Deno.cwd() !== root || await commandText(root, "git", ["rev-parse", "--show-toplevel"]) !== root
  ) {
    throw new Error("collector must be parent-run from the exact Git source root");
  }
  if (!options.output.startsWith("/") || !options.output.endsWith("/evidence.v1.json")) {
    throw new Error("--output must name evidence.v1.json in a new absolute directory");
  }
  const outputDirectory = options.output.slice(0, -"/evidence.v1.json".length);
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
  const ancestor = await new Deno.Command("git", {
    cwd: root,
    args: ["merge-base", "--is-ancestor", ACCEPTED_STATIC_COMMIT, startCommit],
    stdout: "null",
    stderr: "null",
  }).output();
  if (!ancestor.success) throw new Error("accepted static WebAudio commit is not an ancestor");
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
    const bytes = await Deno.readFile(`${root}/${sourcePath}`);
    expectedFiles.set(route, {
      route,
      sourcePath,
      bytes: bytes.length,
      sha256: await sha256Hex(bytes),
      gitBlob: await commandText(root, "git", ["rev-parse", `HEAD:${sourcePath}`]),
    });
  }
  const outputParent = options.output.slice(0, options.output.lastIndexOf("/"));
  const staging = `${outputParent}.partial-${crypto.randomUUID()}`;
  const cleanup: Record<
    "browserProcesses" | "cgroup" | "profile" | "server" | "staging",
    CleanupCheck
  > = {
    browserProcesses: failureCheck("cleanup not attempted"),
    cgroup: failureCheck("cleanup not attempted"),
    profile: failureCheck("cleanup not attempted"),
    server: failureCheck("cleanup not attempted"),
    staging: successCheck(),
  };
  let server: Deno.ChildProcess | null = null;
  let serverStatus: Promise<Deno.CommandStatus> | null = null;
  let serverIdentity: ProcessIdentity | null = null;
  let serverOrigin = "";
  let profilePath: string | null = null;
  let ownedProfile: ProfileIdentity | null = null;
  let profileIdentity: {
    path: string;
    device: number;
    inode: number;
    mode: number;
    createdEmpty: true;
  } | null = null;
  let unit: string | null = null;
  let cgroupPath: string | null = null;
  let cgroupIdentity: {
    unit: string;
    controlGroup: string;
    path: string;
    device: number;
    inode: number;
    invocationId: string;
    mainPid: number;
    memberSnapshots: Array<{ at: string; pids: number[] }>;
    listenerAssertions: ListenerOwnershipProof[];
  } | null = null;
  let cgroupKill: Deno.FsFile | null = null;
  let client: CdpClient | null = null;
  const observedProcesses = new Map<number, ProcessIdentity>();
  const memberSnapshots: Array<{ at: string; pids: number[] }> = [];
  const listenerAssertions: ListenerOwnershipProof[] = [];
  const scenarios: Array<Record<string, unknown>> = [];
  let version: Record<string, unknown> = {};
  let effectiveArguments: string[] = [];
  let launchArguments: string[] = [];
  let collectionError: unknown;
  const finalizeCleanup = async () => {
    try {
      await client?.send("Browser.close", {}, undefined, 5_000);
    } catch { /* containment cleanup remains authoritative */ }
    client?.close();
    if (cgroupPath && cgroupIdentity && cgroupKill) {
      let remaining: number[] = [];
      try {
        const current = await Deno.lstat(cgroupPath);
        if (
          numeric(current.dev, "cleanup cgroup device") !== cgroupIdentity.device ||
          numeric(current.ino, "cleanup cgroup inode") !== cgroupIdentity.inode
        ) throw new Error("owned cgroup identity changed before cleanup");
        remaining = await readCgroupMembers(cgroupPath).catch(() => []);
        memberSnapshots.push({ at: new Date().toISOString(), pids: remaining });
        for (const pid of remaining) {
          const identity = await processIdentity(pid);
          if (identity) observedProcesses.set(pid, identity);
        }
        await cgroupKill.write(textEncoder.encode("1"));
        remaining = await waitCgroupEmpty(cgroupPath, 5_000);
        if (remaining.length) throw new Error("owned cgroup retained member PIDs");
        cleanup.cgroup = successCheck();
      } catch (error) {
        cleanup.cgroup = failureCheck(error, remaining.map(String));
      }
      try {
        cgroupKill.close();
      } catch { /* already represented by cgroup cleanup */ }
    }
    if (unit) {
      await commandText(root, "/usr/bin/systemctl", ["--user", "stop", unit]).catch(() => "");
    }
    try {
      const remaining: string[] = [];
      for (const identity of observedProcesses.values()) {
        if (await identityRunning(identity)) remaining.push(String(identity.pid));
      }
      if (remaining.length) {
        throw new Error("identity-bound Chrome processes survived cgroup cleanup");
      }
      if (!observedProcesses.size) throw new Error("no owned Chrome process identity was retained");
      cleanup.browserProcesses = successCheck();
    } catch (error) {
      cleanup.browserProcesses = failureCheck(error);
    }
    try {
      if (!profilePath) throw new Error("profile setup did not complete");
      if (cleanup.cgroup.outcome !== "success" || cleanup.browserProcesses.outcome !== "success") {
        throw new Error("profile retained because process containment cleanup did not succeed");
      }
      if (!profileIdentity || !ownedProfile) throw new Error("profile identity was not retained");
      // removeOwnedProfile delegates to remove-owned-tree.py. The helper authenticates the parent
      // and child descriptors, opens both with O_DIRECTORY|O_NOFOLLOW, renames relative to the
      // retained parent fd, then removes every entry with descriptor-relative unlinkat/rmdirat.
      await removeOwnedProfile(ownedProfile);
      cleanup.profile = successCheck();
    } catch (error) {
      cleanup.profile = failureCheck(error, profilePath ? [profilePath] : []);
    }
    try {
      if (!server || !serverStatus || !serverIdentity) {
        throw new Error("server setup did not complete");
      }
      if (await identityRunning(serverIdentity)) Deno.kill(serverIdentity.pid, "SIGTERM");
      await serverStatus;
      if (await identityRunning(serverIdentity)) {
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
    const origin = `http://127.0.0.1:${serverPort}`;
    serverOrigin = origin;
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
    profilePath = `/tmp/wasm-vs-js-owned-profiles/audio-effects-${crypto.randomUUID()}/launch`;
    ownedProfile = await prepareProfile(profilePath);
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
    unit = `wasm-audio-effects-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}.service`;
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
    ) throw new Error("unsafe owned Chrome cgroup identity");
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
      listenerAssertions,
    };
    cgroupKill = await Deno.open(`${cgroupPath}/cgroup.kill`, { write: true });
    const endpoint = await waitDevToolsActivePort(profilePath);
    const debuggerPort = endpoint.port;
    const browserPath = endpoint.browserPath;
    listenerAssertions.push(await proveDevToolsListenerOwned(debuggerPort, cgroupIdentity));
    const discovery = await (await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
    const webSocketUrl = new URL(discovery.webSocketDebuggerUrl);
    if (
      webSocketUrl.protocol !== "ws:" || webSocketUrl.hostname !== "127.0.0.1" ||
      Number(webSocketUrl.port) !== debuggerPort || webSocketUrl.pathname !== browserPath
    ) throw new Error("Chrome CDP endpoint escaped the owned loopback listener");
    listenerAssertions.push(await proveDevToolsListenerOwned(debuggerPort, cgroupIdentity));
    client = new CdpClient(webSocketUrl.href);
    await client.ready();
    version = await client.send("Browser.getVersion");
    if (version.product !== EXPECTED_CHROME_PRODUCT) {
      throw new Error(`exact Chrome product mismatch: ${version.product}`);
    }
    effectiveArguments = (await client.send("Browser.getBrowserCommandLine")).arguments as string[];
    if (
      !Array.isArray(effectiveArguments) ||
      !launchArguments.filter((argument) => argument.startsWith("--")).every((argument) =>
        effectiveArguments.includes(argument)
      )
    ) throw new Error("effective Chrome command line omitted a requested exact argument");
    for (const scenario of SCENARIOS) {
      scenarios.push(
        await collectScenario(client, root, origin, scenario, staging, expectedFiles) as Record<
          string,
          unknown
        >,
      );
      await snapshotMembers();
    }
  } catch (error) {
    collectionError = error;
  } finally {
    await finalizeCleanup();
  }
  const cleanupFailures = Object.entries(cleanup).filter(([name, check]) =>
    name !== "staging" && check.outcome !== "success"
  );
  if (collectionError || cleanupFailures.length) {
    await Deno.remove(staging, { recursive: true }).catch(() => {});
    cleanup.staging = successCheck();
    throw new AggregateError(
      [collectionError, ...cleanupFailures.map(([, check]) => check.error)].filter(Boolean),
      "browser collection or protected cleanup failed",
    );
  }
  const chromeInfoAfter = await Deno.lstat(chrome);
  if (
    !chromeInfoAfter.isFile || chromeInfoAfter.isSymlink ||
    numeric(chromeInfoAfter.dev, "ending Chrome executable device") !== chromeDevice ||
    numeric(chromeInfoAfter.ino, "ending Chrome executable inode") !== chromeInode ||
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
    const bytes = await Deno.readFile(`${root}/${expected.sourcePath}`);
    if (bytes.length !== expected.bytes || await sha256Hex(bytes) !== expected.sha256) {
      await Deno.remove(staging, { recursive: true }).catch(() => {});
      throw new Error(`frozen source changed by collection end: ${expected.sourcePath}`);
    }
  }
  if (!serverIdentity || !profileIdentity || !cgroupIdentity) {
    await Deno.remove(staging, { recursive: true }).catch(() => {});
    throw new Error("successful collection omitted an owned setup identity");
  }
  const evidence = {
    schemaVersion: 1,
    workload: "audio.webaudio-effects.v1",
    evidenceId: `audio-webaudio-effects-browser-${startCommit.slice(0, 12)}`,
    collectedAt: new Date().toISOString(),
    acceptedStaticCommit: ACCEPTED_STATIC_COMMIT,
    source: {
      start: { commit: startCommit, tree: startTree, cleanStatus: "clean" },
      end: { commit: endCommit, tree: endTree, cleanStatus: "clean" },
      unchanged: true,
      root,
      assets: [...expectedFiles.values()],
    },
    collector: {
      script: SCRIPT,
      bytes: (await Deno.readFile(`${root}/${SCRIPT}`)).length,
      sha256: await sha256Hex(await Deno.readFile(`${root}/${SCRIPT}`)),
      command: [
        Deno.execPath(),
        "run",
        "-A",
        SCRIPT,
        `--chrome=${options.chrome}`,
        `--output=${options.output}`,
      ],
      denoVersion: Deno.version.deno,
    },
    browser: {
      product: String(version.product),
      revision: String(version.revision),
      userAgent: String(version.userAgent),
      jsVersion: String(version.jsVersion),
      executable: chrome,
      executableBytes: chromeBytes.length,
      executableSha256: EXPECTED_CHROME_SHA256,
      executableDevice: chromeDevice,
      executableInode: chromeInode,
      launchArguments,
      effectiveArguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
      profile: profileIdentity,
      cgroup: cgroupIdentity,
      processes: [...observedProcesses.values()].sort((a, b) => a.pid - b.pid),
    },
    server: { origin: serverOrigin, mode: "public", launcher: serverIdentity },
    contract: {
      seconds: 60,
      channels: 2,
      frames: 2_880_000,
      outputFrames: 2_880_015,
      outputBytes: 23_040_120,
      outputSha256: OUTPUT_SHA256,
      targets: ["javascript", "wasm-linear"],
      blocksPerChannel: 22_500,
      blockInvocations: 45_000,
      stateCarryBoundaries: 44_998,
      oracle: ORACLE,
      performanceClaim: false,
    },
    scenarios,
    cleanup: {
      browserProcesses: cleanup.browserProcesses,
      cgroup: cleanup.cgroup,
      profile: cleanup.profile,
      server: cleanup.server,
    },
  };
  await assertClosedSchema(root, evidence);
  await Deno.writeTextFile(`${staging}/evidence.v1.json`, `${canonicalize(evidence)}\n`, {
    createNew: true,
  });
  await Deno.rename(staging, outputDirectory);
  console.log(
    "WebAudio effects browser evidence: 2 complete targets + 6 causal lifecycle probes; cleanup exact",
  );
}

if (import.meta.main) await main();

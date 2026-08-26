// deno-lint-ignore-file no-unsafe-finally no-explicit-any -- cleanup assertions throw only inside nested try/catch blocks so every cleanup phase still runs and retained semantic validation traverses a closed schema value.
import Ajv2020Module from "ajv2020";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";

export const EXPECTED_PRODUCT = "Chrome/150.0.7871.24";
export const EXPECTED_EXECUTABLE_SHA256 =
  "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
export const ACCEPTED_PARENT_COMMIT = "59dd60cdfc30edb89ad6f8fb8826892a6d20eef1";
export const ACCEPTED_PARENT_TREE = "680b38440ba48b3e4b00c913302f16d1c32fa2a8";
const WORKLOAD = "document.pdf-viewer.v1";
const ROUTE = "/benchmarks/document-pdf-viewer-v1/";
const SCRIPT = "scripts/collect-document-pdf-viewer-browser-evidence.ts";
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
    !/^--user-data-dir=\/tmp\/wasm-document-pdf-viewer-chrome-/u.test(
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

export interface PdfResult {
  rawText: string;
  target: "javascript" | "wasm-linear";
  pageCount: number;
  hits: number[];
  textSha256: string;
  selectedPage: number;
  selectedRgbaSha256: string;
  pageHashes: Array<{ page: number; sha256: string }>;
  counters: Record<string, number>;
}

export const EXPECTED_HITS = Object.freeze([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
export const EXPECTED_RASTER_PAGES = Object.freeze([1, 25, 50, 75, 100]);
export const EXPECTED_TEXT_SHA256 =
  "039fb76d6eb3bf1764ee5c839c4f21133a8a33b282967497378e6d7c5ca76fdb";
export const EXPECTED_RASTER_HASHES = Object.freeze([
  "6d336d36d9dd580358b180372ca5a3de3851f06ab8fd1f8dfca6f85fb41112de",
  "55e76b5c22ef167b001cdbe797499ffe9e2159fdfeb7dd094ff57fb68e549152",
  "47950d913b1e0c50ce0773cde897e54c5d3759824511f7164949e31b88634cb9",
  "5eace04651bde7dbeb0ed1711c04719e353b009db2254217167e44b52a8670ec",
  "f017e036817ce5e82e5cf7c79af4395e9c2d03e4b033530affcaa8e3406b7557",
]);

export function expectedCounters(target: PdfResult["target"]): Record<string, number> {
  return {
    objects: 233,
    pages: 100,
    glyphs: 3470,
    searchComparisons: 2970,
    rasterizedPages: 5,
    pixels: 9694080,
    allocations: 1,
    boundaryCrossings: target === "wasm-linear" ? 225 : 0,
    copiedBytes: target === "wasm-linear" ? 38819062 : 0,
    peakBytes: 7755264,
    memoryBytes: target === "wasm-linear" ? 16777216 : 7755264,
  };
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function assertCompleteResult(actual: PdfResult): void {
  const expectedHashes = EXPECTED_RASTER_PAGES.map((page, index) => ({
    page,
    sha256: EXPECTED_RASTER_HASHES[index],
  }));
  const selected = expectedHashes.find((entry) => entry.page === actual.selectedPage);
  if (
    !["javascript", "wasm-linear"].includes(actual.target) || actual.pageCount !== 100 ||
    !sameJson(actual.hits, EXPECTED_HITS) || actual.textSha256 !== EXPECTED_TEXT_SHA256 ||
    !sameJson(actual.pageHashes, expectedHashes) || !selected ||
    actual.selectedRgbaSha256 !== selected.sha256 ||
    !sameJson(actual.counters, expectedCounters(actual.target))
  ) throw new Error(`${actual.target} complete PDF result differs from the accepted parent oracle`);
}

export function parseDisplayedResult(text: string): PdfResult {
  const field = (name: string) => text.match(new RegExp(`^${name}: (.+)$`, "m"))?.[1] ?? "";
  const target = field("Target") as PdfResult["target"];
  const rasterMarker = "All five raster hashes: ";
  const countersMarker = "\nCounters: ";
  const rasterAt = text.indexOf(rasterMarker);
  const countersAt = text.indexOf(countersMarker, rasterAt);
  const selected = /^Selected page (\d+) RGBA SHA-256: ([a-f0-9]{64})$/mu.exec(text);
  if (
    !["javascript", "wasm-linear"].includes(target) || rasterAt < 0 || countersAt < 0 ||
    !selected
  ) throw new Error("complete visible PDF result is not parseable without omission");
  const result: PdfResult = {
    rawText: text,
    target,
    pageCount: Number(field("Pages parsed")),
    hits: field("Search hit pages").split(", ").map(Number),
    textSha256: field("Complete extracted-text SHA-256"),
    selectedPage: Number(selected[1]),
    selectedRgbaSha256: selected[2],
    pageHashes: JSON.parse(text.slice(rasterAt + rasterMarker.length, countersAt)),
    counters: JSON.parse(text.slice(countersAt + countersMarker.length)),
  };
  assertCompleteResult(result);
  return result;
}

export const SCENARIO_CONTRACT = [
  { id: "complete-javascript", mode: "normal", targets: ["javascript"] },
  { id: "complete-wasm", mode: "normal", targets: ["wasm-linear"] },
  { id: "resource-key-javascript", mode: "resource-key", targets: ["javascript"] },
  { id: "resource-key-wasm", mode: "resource-key", targets: ["wasm-linear"] },
  { id: "font-key-javascript", mode: "font-key", targets: ["javascript"] },
  { id: "font-key-wasm", mode: "font-key", targets: ["wasm-linear"] },
  { id: "font-nesting-javascript", mode: "font-nesting", targets: ["javascript"] },
  { id: "font-nesting-wasm", mode: "font-nesting", targets: ["wasm-linear"] },
  { id: "wrong-token", mode: "wrong-token", targets: ["javascript"] },
  { id: "stale-after-restart", mode: "stale", targets: ["javascript", "wasm-linear"] },
  { id: "restart", mode: "normal", targets: ["javascript", "wasm-linear"] },
  { id: "timeout", mode: "timeout", targets: ["wasm-linear"] },
  { id: "cancel", mode: "cancel", targets: ["javascript"] },
  { id: "pagehide", mode: "pagehide", targets: ["wasm-linear"] },
] as const;

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

async function debuggerListenerOwner(
  port: number,
  cgroupPath: string,
): Promise<{ socketInode: string; ownedPid: number; cgroupOwned: true }> {
  const wantedPort = port.toString(16).toUpperCase().padStart(4, "0");
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    let socketInode = "";
    for (const table of ["/proc/net/tcp", "/proc/net/tcp6"]) {
      const text = await Deno.readTextFile(table).catch(() => "");
      for (const line of text.trim().split("\n").slice(1)) {
        const fields = line.trim().split(/\s+/u);
        const [address, tablePort] = (fields[1] ?? "").split(":");
        const loopback = address === "0100007F" ||
          address === "00000000000000000000000001000000";
        if (
          loopback && tablePort === wantedPort && fields[3] === "0A" && /^\d+$/u.test(fields[9])
        ) {
          socketInode = fields[9];
        }
      }
    }
    if (socketInode) {
      const wanted = `socket:[${socketInode}]`;
      for (const pid of await cgroupMembers(cgroupPath)) {
        try {
          for await (const entry of Deno.readDir(`/proc/${pid}/fd`)) {
            if (await Deno.readLink(`/proc/${pid}/fd/${entry.name}`).catch(() => "") === wanted) {
              return { socketInode, ownedPid: pid, cgroupOwned: true };
            }
          }
        } catch {
          // Process/fd races are retried while the exact cgroup remains active.
        }
      }
    }
    await delay(25);
  }
  throw new Error("DevTools listener is not owned by the exact Chrome cgroup");
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
  heading: string;
  status: string;
  result: string;
  bodyText: string;
  startDisabled: boolean;
  cancelDisabled: boolean;
  target: "javascript" | "wasm-linear";
  page: number;
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
    heading:document.querySelector("h1").textContent.trim(),
    status:document.querySelector("#status").textContent.trim(),
    result:document.querySelector("#result").textContent,
    bodyText:document.body.innerText,
    startDisabled:document.querySelector("#start").disabled,
    cancelDisabled:document.querySelector("#cancel").disabled,
    target:document.querySelector("#target").value,
    page:Number(document.querySelector("#page").value),
    statuses:[...globalThis.__pdfEvidence.statuses]
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
    document.querySelector("#page").value="1";
  })()`,
  );
}

function pageInstrumentation(mode: string): string {
  return String.raw`(() => {
  const mode=${JSON.stringify(mode)};
  const NativeWorker=globalThis.Worker;
  const nativeTimeout=globalThis.setTimeout.bind(globalThis);
  const workers=[];
  const statuses=[];
  const emit=(kind,detail={}) => globalThis.__pdfEvidenceEvent(JSON.stringify({kind,detail}));
  class EvidenceWorker extends EventTarget {
    constructor(url,options) {
      super();
      this.native=new NativeWorker(url,options);
      this.index=workers.length;
      this.pending=null;
      this.terminated=false;
      workers.push(this);
      this.native.addEventListener("message",(event)=>this.dispatchEvent(new MessageEvent("message",{data:event.data})));
      this.native.addEventListener("error",(event)=>this.dispatchEvent(event));
      emit("worker-created",{index:this.index,url:String(url)});
    }
    postMessage(data,transfer) {
      emit("worker-posted",{index:this.index,token:data?.token,target:data?.target});
      if (mode === "wrong-token") {
        this.dispatchEvent(new MessageEvent("message",{data:{token:999999,ok:true,result:{fabricated:true}}}));
        emit("wrong-token-dispatched",{index:this.index});
        nativeTimeout(()=>this.native.postMessage(data,transfer||[]),100);
      } else if (["stale","timeout","cancel","pagehide"].includes(mode)) {
        this.pending={data,transfer:transfer||[]};
        emit("worker-held",{index:this.index});
      } else this.native.postMessage(data,transfer||[]);
    }
    terminate() {
      if (!this.terminated) emit("worker-terminated",{index:this.index});
      this.terminated=true;
      this.native.terminate();
    }
  }
  if (mode === "timeout") {
    globalThis.setTimeout=(callback,delay,...args)=>nativeTimeout(callback,delay===60000?25:delay,...args);
  }
  Object.defineProperty(globalThis,"Worker",{value:EvidenceWorker,configurable:false});
  Object.defineProperty(globalThis,"__pdfEvidence",{value:{mode,workers,statuses},configurable:false});
  Object.defineProperty(globalThis,"__pdfEvidenceControl",{value:Object.freeze({
    count:()=>workers.length,
    terminated:(index)=>workers[index].terminated,
    release:(index)=>{
      const pending=workers[index].pending;
      if (!pending) throw new Error("worker has no held message");
      workers[index].pending=null;
      workers[index].native.postMessage(pending.data,pending.transfer);
      emit("worker-released",{index});
    },
    stale:(index)=>{
      workers[index].dispatchEvent(new MessageEvent("message",{data:{token:0,ok:true,result:{fabricated:true}}}));
      const error=new Event("error");
      Object.defineProperty(error,"message",{value:"STALE_ERROR_SENTINEL"});
      workers[index].dispatchEvent(error);
      emit("stale-result-error-dispatched",{index});
    }
  }),configurable:false});
  addEventListener("DOMContentLoaded",()=>{
    const node=document.querySelector("#status");
    const record=()=>{
      const value=node?.textContent?.trim();
      if (value && statuses.at(-1)!==value) statuses.push(value);
    };
    record();
    new MutationObserver(record).observe(node,{childList:true,characterData:true,subtree:true});
  });
  emit("instrumentation-ready",{mode});
})();`;
}

function workerInstrumentation(mode: string): string {
  return String.raw`(() => {
  const mode=${JSON.stringify(mode)};
  const nativeFetch=globalThis.fetch.bind(globalThis);
  const nativeDigest=crypto.subtle.digest.bind(crypto.subtle);
  const nativeInstantiate=WebAssembly.instantiate.bind(WebAssembly);
  const emit=(kind,detail={})=>globalThis.__pdfExecutionAudit(JSON.stringify({kind,detail}));
  const encode=(bytes)=>{
    let binary="";
    for(let at=0;at<bytes.length;at+=32768) binary+=String.fromCharCode(...bytes.subarray(at,at+32768));
    return btoa(binary);
  };
  const hex=(bytes)=>[...bytes].map((value)=>value.toString(16).padStart(2,"0")).join("");
  const hash=async(bytes)=>hex(new Uint8Array(await nativeDigest("SHA-256",bytes)));
  const replace=(bytes,before,after)=>{
    const a=new TextEncoder().encode(before), b=new TextEncoder().encode(after);
    if(a.length!==b.length) throw new Error("evidence mutation length mismatch");
    outer: for(let at=0;at<=bytes.length-a.length;at++) {
      for(let i=0;i<a.length;i++) if(bytes[at+i]!==a[i]) continue outer;
      bytes.set(b,at);
      return at;
    }
    throw new Error("evidence mutation source missing");
  };
  const mutations={
    "resource-key":["/Resources << /Font << /F1 3 0 R >> >>","/Xesources << /Font << /F1 3 0 R >> >>"],
    "font-key":["/Resources << /Font << /F1 3 0 R >> >>","/Resources << /Xont << /F1 3 0 R >> >>"],
    "font-nesting":["/Resources << /Font << /F1 3 0 R >> >>","/Resources << /Font << >> /F1 3 0 R >>"]
  };
  globalThis.fetch=async(input,init)=>{
    const response=await nativeFetch(input,init);
    const url=new URL(typeof input==="string"?input:input.url,location.href);
    const original=new Uint8Array(await response.clone().arrayBuffer());
    const originalSha256=await hash(original);
    emit("fetched-body",{url:url.href,bytes:original.length,sha256:originalSha256});
    const mutation=mutations[mode];
    if(url.pathname.endsWith("/report-100-pages.pdf") && mutation) {
      const changed=original.slice();
      const changedOffset=replace(changed,mutation[0],mutation[1]);
      const mutatedSha256=await hash(changed);
      emit("resource-mutation",{id:mode,url:url.href,bytes:changed.length,originalSha256,mutatedSha256,changedOffset});
      return new Response(changed,{status:response.status,statusText:response.statusText,headers:response.headers});
    }
    return response;
  };
  crypto.subtle.digest=async(algorithm,data)=>{
    const bytes=data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
    const result=await nativeDigest(algorithm,data);
    emit("digest-input",{algorithm:typeof algorithm==="string"?algorithm:algorithm.name,bytes:bytes.length,sha256:hex(new Uint8Array(result))});
    return result;
  };
  WebAssembly.instantiate=async(source,imports)=>{
    if(source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
      const bytes=source instanceof ArrayBuffer?new Uint8Array(source):new Uint8Array(source.buffer,source.byteOffset,source.byteLength);
      emit("wasm-instantiated",{bytes:bytes.length,sha256:await hash(bytes),base64:encode(bytes)});
    } else emit("wasm-module-instantiated",{});
    return await nativeInstantiate(source,imports);
  };
  emit("worker-instrumentation-ready",{mode});
})();`;
}

export function validateEvidenceSemantics(value: unknown): void {
  if (!value || typeof value !== "object") throw new Error("evidence object required");
  const evidence = value as Record<string, any>;
  if (
    evidence.workload !== WORKLOAD ||
    evidence.source?.acceptedParentCommit !== ACCEPTED_PARENT_COMMIT ||
    evidence.source?.acceptedParentTree !== ACCEPTED_PARENT_TREE ||
    evidence.source?.initialClean !== true ||
    evidence.source?.endRecheck?.status !== "clean" ||
    evidence.source.head !== evidence.source.endRecheck.head ||
    evidence.source.tree !== evidence.source.endRecheck.tree ||
    evidence.source.endRecheck.filesMatch !== true ||
    evidence.source.endRecheck.collectorMatches !== true
  ) {
    throw new Error("source start/end identity is not closed over the accepted parent");
  }
  assertBrowserContract(
    evidence.browser?.product,
    evidence.browser?.executable?.sha256,
    evidence.browser?.launchArguments,
    evidence.browser?.effectiveArguments,
  );
  const listenerPid = evidence.browser?.debuggerListener?.ownedPid;
  if (
    evidence.browser?.debuggerListener?.cgroupOwned !== true ||
    !evidence.browser?.processes?.some((process: Record<string, unknown>) =>
      process.pid === listenerPid
    ) ||
    !evidence.browser?.cgroup?.snapshots?.some((snapshot: Record<string, any>) =>
      snapshot.pids?.includes(listenerPid)
    )
  ) throw new Error("DevTools listener is not bound to an identity-retained cgroup process");
  const files = evidence.source.files as Array<Record<string, unknown>>;
  if (
    !Array.isArray(files) || files.length !== 8 ||
    new Set(files.map((entry) => entry.route)).size !== files.length ||
    new Set(files.map((entry) => entry.path)).size !== files.length ||
    files.some((entry) => entry.acceptedCommitBytesMatch !== true)
  ) {
    throw new Error("accepted served-source graph is not an exact eight-file bijection");
  }
  const sourceByRoute = new Map(files.map((entry) => [String(entry.route), entry]));
  const scenarios = evidence.scenarios as Array<Record<string, any>>;
  if (
    !Array.isArray(scenarios) || !sameJson(
      scenarios.map((scenario) => ({
        id: scenario.id,
        mode: scenario.mode,
        targets: scenario.targetSequence,
      })),
      SCENARIO_CONTRACT.map((scenario) => ({
        id: scenario.id,
        mode: scenario.mode,
        targets: [...scenario.targets],
      })),
    )
  ) throw new Error("scenario denominator/order differs from the closed contract");
  for (const scenario of scenarios) {
    const sessions = new Map(
      (scenario.ownership?.sessions ?? []).map((
        session: Record<string, unknown>,
      ) => [String(session.sessionId), session]),
    );
    if (!sessions.has(scenario.ownership?.pageSessionId) || sessions.size < 2) {
      throw new Error(`${scenario.id} session ownership is incomplete`);
    }
    for (
      const collection of [
        scenario.lifecycleEvents,
        scenario.executionEvents,
        scenario.console,
        scenario.exceptions,
        scenario.network,
        scenario.executedSources,
      ]
    ) {
      if (
        !Array.isArray(collection) || collection.some((entry) => !sessions.has(entry.sessionId))
      ) {
        throw new Error(`${scenario.id} retained evidence outside owned page/worker sessions`);
      }
    }
    if (
      scenario.exceptions.length ||
      scenario.console.some((entry: Record<string, unknown>) => entry.type === "error")
    ) {
      throw new Error(`${scenario.id} is not console/exception clean`);
    }
    for (const request of scenario.network) {
      const route = new URL(request.url).pathname;
      const source = sourceByRoute.get(route);
      if (
        !source || request.status !== 200 || request.failed || request.fromDiskCache ||
        request.fromServiceWorker || request.body?.status !== "supported" ||
        request.body.bytes !== source.bytes || request.body.sha256 !== source.sha256 ||
        request.body.sourcePath !== source.path || request.body.gitBlob !== source.gitBlob
      ) {
        throw new Error(`${scenario.id} network body is not bound to accepted source: ${route}`);
      }
    }
    for (const executed of scenario.executedSources) {
      const source = sourceByRoute.get(new URL(executed.url).pathname);
      if (
        !source || executed.bytes !== source.bytes || executed.sha256 !== source.sha256 ||
        executed.sourcePath !== source.path || executed.gitBlob !== source.gitBlob
      ) {
        throw new Error(`${scenario.id} imported/executed bytes are not accepted source bytes`);
      }
    }
    for (const completed of scenario.completedTargets) assertCompleteResult(completed);
    for (
      const fetched of scenario.executionEvents.filter((event: Record<string, any>) =>
        event.kind === "fetched-body"
      )
    ) {
      const source = sourceByRoute.get(new URL(fetched.detail.url).pathname);
      if (
        !source || fetched.detail.bytes !== source.bytes ||
        fetched.detail.sha256 !== source.sha256
      ) throw new Error(`${scenario.id} fetched bytes are not accepted source bytes`);
    }
    const digestDetails = scenario.executionEvents
      .filter((event: Record<string, any>) => event.kind === "digest-input")
      .map((event: Record<string, any>) => event.detail);
    const rgbaHashes = digestDetails.filter((detail: Record<string, unknown>) =>
      detail.bytes === 1224 * 1584 * 4
    ).map((detail: Record<string, unknown>) => detail.sha256);
    if (
      !sameJson(rgbaHashes, scenario.completedTargets.flatMap(() => EXPECTED_RASTER_HASHES)) ||
      digestDetails.filter((detail: Record<string, unknown>) =>
          detail.sha256 === EXPECTED_TEXT_SHA256
        ).length !== scenario.completedTargets.length
    ) throw new Error(`${scenario.id} digest inputs do not cover exact text and RGBA output`);
    const wasmSource = sourceByRoute.get("/artifacts/document-pdf-viewer/pdf-engine.wasm")!;
    const wasmAudits = scenario.executionEvents.filter((event: Record<string, any>) =>
      event.kind === "wasm-instantiated"
    );
    const resourceNegative = ["resource-key", "font-key", "font-nesting"].includes(scenario.mode);
    const expectedWasmAudits = scenario.completedTargets.filter((result: Record<string, unknown>) =>
      result.target === "wasm-linear"
    ).length + (resourceNegative && scenario.targetSequence.includes("wasm-linear") ? 1 : 0);
    if (
      wasmAudits.length !== expectedWasmAudits ||
      wasmAudits.some((event: Record<string, any>) =>
        event.detail.sha256 !== wasmSource.sha256 ||
        base64ToBytes(String(event.detail.base64)).length !== wasmSource.bytes
      )
    ) {
      throw new Error(`${scenario.id} instantiated Wasm bytes are not accepted fetched bytes`);
    }
    const mutations = scenario.executionEvents.filter((event: Record<string, any>) =>
      event.kind === "resource-mutation"
    );
    if (resourceNegative) {
      if (
        scenario.completedTargets.length !== 0 || scenario.rejection?.rejected !== true ||
        scenario.rejection?.mutation !== scenario.mode || mutations.length !== 1 ||
        mutations[0].detail?.originalSha256 !== sourceByRoute.get(
            "/artifacts/document-pdf-viewer/report-100-pages.pdf",
          )?.sha256 ||
        mutations[0].detail?.mutatedSha256 === mutations[0].detail?.originalSha256 ||
        scenario.causal?.resourceMutationRejected !== true
      ) {
        throw new Error(`${scenario.id} resource-binding negative is not causal and closed`);
      }
    } else if (
      mutations.length || scenario.rejection !== null ||
      scenario.causal?.resourceMutationRejected !== false
    ) {
      throw new Error(`${scenario.id} has contradictory resource-mutation evidence`);
    }
    const expectedCompleted = scenario.id === "restart"
      ? 2
      : ["complete-javascript", "complete-wasm", "wrong-token", "stale-after-restart"].includes(
          scenario.id,
        )
      ? 1
      : 0;
    if (!resourceNegative && scenario.completedTargets.length !== expectedCompleted) {
      throw new Error(`${scenario.id} completed-target cardinality mismatch`);
    }
    const expectedCausal = {
      wrongTokenIgnored: scenario.id === "wrong-token",
      staleResultAndErrorIgnored: scenario.id === "stale-after-restart",
      freshWorkers: scenario.id === "restart",
      timeoutTerminated: scenario.id === "timeout",
      cancelTerminated: scenario.id === "cancel",
      pagehideTerminated: scenario.id === "pagehide",
      resourceMutationRejected: resourceNegative,
    };
    if (!sameJson(scenario.causal, expectedCausal)) {
      throw new Error(`${scenario.id} causal lifecycle flags contradict its scenario`);
    }
    if (
      scenario.accessibility?.inspectedBy !== "Accessibility.getFullAXTree" ||
      Object.values(scenario.accessibility?.assertions ?? {}).some((entry) =>
        entry !== true
      ) ||
      typeof scenario.finalState?.bodyText !== "string" ||
      typeof scenario.finalState?.result !== "string" ||
      scenario.screenshot?.bytes < 8
    ) {
      throw new Error(`${scenario.id} omitted AX, textual output, or screenshot evidence`);
    }
  }
  for (
    const key of ["sessionTargets", "cgroup", "browserProcesses", "profile", "server", "output"]
  ) {
    if (evidence.cleanup?.[key]?.outcome !== "success") throw new Error(`${key} cleanup failed`);
  }
  if (
    evidence.cleanup.cgroup.remainingPids.length ||
    evidence.cleanup.browserProcesses.remainingPids.length ||
    evidence.cleanup.profile.absent !== true || evidence.cleanup.server.processAbsent !== true ||
    evidence.cleanup.output.retained !== true
  ) throw new Error("owned cleanup is incomplete");
}

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
    throw new Error("collector source does not descend from accepted PDF viewer");
  }

  if (
    await commandText(root, "git", ["rev-parse", `${ACCEPTED_PARENT_COMMIT}^{tree}`]) !==
      ACCEPTED_PARENT_TREE
  ) throw new Error("accepted PDF parent tree identity changed");
  const outputManifestPath = "public/artifacts/document-pdf-viewer/output-manifest.json";
  const outputManifestBytes = await Deno.readFile(`${root}/${outputManifestPath}`);
  const acceptedOutputBytes = await gitBytes(root, ACCEPTED_PARENT_COMMIT, outputManifestPath);
  if (
    outputManifestBytes.length !== acceptedOutputBytes.length ||
    await sha256Hex(outputManifestBytes) !== await sha256Hex(acceptedOutputBytes)
  ) throw new Error("accepted PDF oracle bytes differ from parent commit");
  const outputManifest = JSON.parse(decoder.decode(outputManifestBytes));
  if (
    outputManifest.oracle.pageCount !== 100 || outputManifest.oracle.searchTerm !== "NEEDLE" ||
    !sameJson(outputManifest.oracle.hits, EXPECTED_HITS) ||
    outputManifest.oracle.textSha256 !== EXPECTED_TEXT_SHA256 ||
    !sameJson(
      outputManifest.oracle.rasterPages.map((entry: { page: number; sha256: string }) => entry),
      EXPECTED_RASTER_PAGES.map((page, index) => ({ page, sha256: EXPECTED_RASTER_HASHES[index] })),
    )
  ) throw new Error("accepted parent oracle denominator changed");

  const sourceFiles: Array<Record<string, unknown>> = [];
  const routeSources = new Map<
    string,
    { path: string; bytes: Uint8Array; sha256: string; gitBlob: string }
  >();
  const addSource = async (route: string, path: string) => {
    const disk = await Deno.readFile(`${root}/${path}`);
    const committed = await gitBytes(root, ACCEPTED_PARENT_COMMIT, path);
    const hash = await sha256Hex(disk);
    if (disk.length !== committed.length || hash !== await sha256Hex(committed)) {
      throw new Error(`${path} differs from accepted parent bytes`);
    }
    const record = {
      route,
      path,
      bytes: disk.length,
      sha256: hash,
      gitBlob: await commandText(root, "git", [
        "rev-parse",
        `${ACCEPTED_PARENT_COMMIT}:${path}`,
      ]),
      acceptedCommitBytesMatch: true,
    };
    sourceFiles.push(record);
    routeSources.set(route, { path, bytes: disk, sha256: hash, gitBlob: record.gitBlob });
  };
  for (
    const [route, path] of [
      [ROUTE, "public/benchmarks/document-pdf-viewer-v1/index.html"],
      ["/styles.css", "public/styles.css"],
      [
        "/benchmarks/document-pdf-viewer-v1/runner.js",
        "public/benchmarks/document-pdf-viewer-v1/runner.js",
      ],
      [
        "/benchmarks/document-pdf-viewer-v1/worker.js",
        "public/benchmarks/document-pdf-viewer-v1/worker.js",
      ],
      [
        "/benchmarks/base/document-pdf-viewer/engine.js",
        "benchmarks/base/document-pdf-viewer/engine.js",
      ],
      [
        "/artifacts/document-pdf-viewer/report-100-pages.pdf",
        "public/artifacts/document-pdf-viewer/report-100-pages.pdf",
      ],
      [
        "/artifacts/document-pdf-viewer/pdf-engine.wasm",
        "public/artifacts/document-pdf-viewer/pdf-engine.wasm",
      ],
      ["/favicon.ico", "public/favicon.svg"],
    ] as const
  ) await addSource(route, path);
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
  let debuggerListener: { socketInode: string; ownedPid: number; cgroupOwned: true } | null = null;
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
        "--allow-env=PORT,HOST,SERVER_MODE,WASM_VS_JS_REPORTER_TOKEN",
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

    for (const [route, source] of routeSources) {
      const response = await fetch(`${origin}${route}`, { cache: "no-store", redirect: "error" });
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (
        response.status !== 200 || bytes.length !== source.bytes.length ||
        await sha256Hex(bytes) !== source.sha256
      ) throw new Error(`loopback preflight raw response mismatch: ${route}`);
    }

    profilePath = await Deno.makeTempDir({ prefix: "wasm-document-pdf-viewer-chrome-" });
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
    unit = `wasm-document-pdf-viewer-${
      crypto.randomUUID().replaceAll("-", "").slice(0, 16)
    }.service`;
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
    debuggerListener = await debuggerListenerOwner(debuggerPort, cgroupPath);
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

    const definitions = SCENARIO_CONTRACT;

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
      const ownedSessions = new Map<string, {
        targetId: string;
        type: "page" | "worker";
        parentSessionId: string | null;
      }>([[pageSessionId, { targetId: pageTargetId, type: "page", parentSessionId: null }]]);
      const lifecycleEvents: Array<Record<string, unknown>> = [];
      const executionEvents: Array<Record<string, unknown>> = [];
      const consoleEntries: Array<Record<string, unknown>> = [];
      const exceptions: Array<Record<string, unknown>> = [];
      const requests = new Map<string, Record<string, unknown>>();
      const executedSources = new Map<string, Record<string, unknown>>();
      const setupTasks: Promise<void>[] = [];
      const responseTasks: Promise<void>[] = [];
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
              await Promise.all([
                client!.send("Runtime.enable", {}, workerSessionId),
                client!.send("Debugger.enable", {}, workerSessionId),
                client!.send("Network.enable", {}, workerSessionId),
                client!.send("Network.setCacheDisabled", { cacheDisabled: true }, workerSessionId),
                client!.send("Network.setBypassServiceWorker", { bypass: true }, workerSessionId),
                client!.send(
                  "Runtime.addBinding",
                  { name: "__pdfExecutionAudit" },
                  workerSessionId,
                ),
              ]);
              await client!.send("Runtime.evaluate", {
                expression: workerInstrumentation(definition.mode),
              }, workerSessionId);
              await client!.send("Runtime.runIfWaitingForDebugger", {}, workerSessionId);
            })().catch((error) => {
              asyncErrors.push(error instanceof Error ? error : new Error(String(error)));
            }),
          );
        }),
        client.on("Runtime.bindingCalled", (params, eventSession) => {
          if (!eventSession) return;
          const owner = ownedSessions.get(eventSession);
          if (!owner) return;
          const event = JSON.parse(String(params.payload));
          const retained = { ...event, sessionId: eventSession, targetId: owner.targetId };
          if (params.name === "__pdfEvidenceEvent" && owner.type === "page") {
            lifecycleEvents.push(retained);
          } else if (params.name === "__pdfExecutionAudit" && owner.type === "worker") {
            executionEvents.push(retained);
          }
        }),
        client.on("Runtime.consoleAPICalled", (params, eventSession) => {
          if (!eventSession) return;
          const owner = ownedSessions.get(eventSession);
          if (!owner) return;
          consoleEntries.push({
            sessionId: eventSession,
            targetId: owner.targetId,
            targetType: owner.type,
            type: String(params.type),
            arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((argument) =>
              String(argument.value ?? argument.description ?? argument.type)
            ),
          });
        }),
        client.on("Runtime.exceptionThrown", (params, eventSession) => {
          if (!eventSession) return;
          const owner = ownedSessions.get(eventSession);
          if (!owner) return;
          const details = params.exceptionDetails as Record<string, unknown>;
          exceptions.push({
            sessionId: eventSession,
            targetId: owner.targetId,
            targetType: owner.type,
            text: String(details.text),
            lineNumber: Number(details.lineNumber),
            columnNumber: Number(details.columnNumber),
          });
        }),
        client.on("Network.requestWillBeSent", (params, eventSession) => {
          if (!eventSession) return;
          const owner = ownedSessions.get(eventSession);
          if (!owner) return;
          const request = params.request as Record<string, unknown>;
          requests.set(`${eventSession}:${params.requestId}`, {
            requestId: String(params.requestId),
            sessionId: eventSession,
            targetId: owner.targetId,
            targetType: owner.type,
            url: String(request.url),
            method: String(request.method),
            resourceType: String(params.type),
            status: null,
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
              mimeType: String(response.mimeType),
              headers: headerEntries(response.headers as Record<string, unknown>),
              fromDiskCache: Boolean(response.fromDiskCache),
              fromServiceWorker: Boolean(response.fromServiceWorker),
            });
          }
        }),
        client.on("Network.loadingFailed", (params, eventSession) => {
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
          responseTasks.push(
            (async () => {
              const url = new URL(String(record.url));
              if (url.origin !== origin) {
                throw new Error(`request escaped owned origin: ${url.href}`);
              }
              const source = routeSources.get(url.pathname);
              if (!source) throw new Error(`unbound raw response route: ${url.pathname}`);
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
                throw new Error(`raw response differs from accepted parent bytes: ${url.pathname}`);
              }
              record.body = {
                status: "supported",
                bytes: bytes.length,
                sha256: source.sha256,
                sourcePath: source.path,
                gitBlob: source.gitBlob,
                cdpEncoding: response.base64Encoded ? "base64" : "utf8",
              };
            })().catch((error) => {
              asyncErrors.push(error instanceof Error ? error : new Error(String(error)));
            }),
          );
        }),
        client.on("Debugger.scriptParsed", (params, eventSession) => {
          if (!eventSession || !ownedSessions.has(eventSession) || !params.url) return;
          const owner = ownedSessions.get(eventSession)!;
          const key = `${eventSession}:${params.scriptId}`;
          responseTasks.push(
            (async () => {
              const response = await client!.send(
                "Debugger.getScriptSource",
                {
                  scriptId: String(params.scriptId),
                },
                eventSession,
                10_000,
              );
              const bytes = encoder.encode(String(response.scriptSource));
              const url = String(params.url);
              const parsed = new URL(url);
              const expected = routeSources.get(parsed.pathname);
              if (!expected || !expected.path.endsWith(".js")) return;
              if (
                bytes.length !== expected.bytes.length ||
                await sha256Hex(bytes) !== expected.sha256
              ) {
                throw new Error(`imported/executed script differs from parent source: ${url}`);
              }
              executedSources.set(key, {
                sessionId: eventSession,
                targetId: owner.targetId,
                targetType: owner.type,
                url,
                sourcePath: expected.path,
                bytes: bytes.length,
                sha256: expected.sha256,
                gitBlob: expected.gitBlob,
              });
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
          client.send("Debugger.enable", {}, pageSessionId),
          client.send("Network.enable", {}, pageSessionId),
          client.send("Network.setCacheDisabled", { cacheDisabled: true }, pageSessionId),
          client.send("Network.setBypassServiceWorker", { bypass: true }, pageSessionId),
          client.send("Accessibility.enable", {}, pageSessionId),
          client.send("Runtime.addBinding", { name: "__pdfEvidenceEvent" }, pageSessionId),
          client.send("Page.addScriptToEvaluateOnNewDocument", {
            source: pageInstrumentation(definition.mode),
          }, pageSessionId),
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
        const completedTargets: PdfResult[] = [];
        const assertions: string[] = [];
        const causal = {
          wrongTokenIgnored: false,
          staleResultAndErrorIgnored: false,
          freshWorkers: false,
          timeoutTerminated: false,
          cancelTerminated: false,
          pagehideTerminated: false,
          resourceMutationRejected: false,
        };
        const startRun = async (targetValue: string) => {
          await selectTarget(client!, pageSessionId, targetValue);
          await click(client!, pageSessionId, "#start");
        };
        const completeRun = async (targetValue: string) => {
          await startRun(targetValue);
          state = await waitState(
            client!,
            pageSessionId,
            (value) => value.status === "Complete.",
            65_000,
          );
          const parsed = parseDisplayedResult(state.result);
          if (parsed.target !== targetValue) {
            throw new Error("visible target differs from selected target");
          }
          completedTargets.push(parsed);
        };
        if (
          (["resource-key", "font-key", "font-nesting"] as readonly string[]).includes(
            definition.mode,
          )
        ) {
          await startRun(definition.targets[0]);
          state = await waitState(
            client,
            pageSessionId,
            (value) => value.status === "Failed.",
            10_000,
          );
          causal.resourceMutationRejected = state.result.length > 0 && state.result !== "Running.";
          if (!causal.resourceMutationRejected) {
            throw new Error("resource mutation was not rejected");
          }
          assertions.push("same-length page resource binding mutation failed closed before output");
        } else if (definition.id === "wrong-token") {
          await startRun(definition.targets[0]);
          await delay(25);
          const before = await pageState(client, pageSessionId);
          causal.wrongTokenIgnored = before.status !== "Complete." &&
            !before.result.includes("fabricated");
          if (!causal.wrongTokenIgnored) throw new Error("wrong-token completion changed state");
          state = await waitState(
            client,
            pageSessionId,
            (value) => value.status === "Complete.",
            65_000,
          );
          completedTargets.push(parseDisplayedResult(state.result));
          assertions.push("wrong-token fabricated completion was causally ignored");
        } else if (definition.id === "stale-after-restart") {
          await startRun(definition.targets[0]);
          await waitState(client, pageSessionId, (value) => value.status.startsWith("Parsing "));
          await click(client, pageSessionId, "#cancel");
          await waitState(client, pageSessionId, (value) => value.status === "Cancelled.");
          await startRun(definition.targets[1]);
          await waitState(client, pageSessionId, (value) => value.status.startsWith("Parsing "));
          const before = await pageState(client, pageSessionId);
          await evaluate(client, pageSessionId, "__pdfEvidenceControl.stale(0)");
          const after = await pageState(client, pageSessionId);
          causal.staleResultAndErrorIgnored = before.status === after.status &&
            before.result === after.result && !after.result.includes("fabricated") &&
            !after.result.includes("STALE_ERROR_SENTINEL");
          if (!causal.staleResultAndErrorIgnored) {
            throw new Error("stale worker event changed restart");
          }
          await evaluate(client, pageSessionId, "__pdfEvidenceControl.release(1)");
          state = await waitState(
            client,
            pageSessionId,
            (value) => value.status === "Complete.",
            65_000,
          );
          completedTargets.push(parseDisplayedResult(state.result));
          assertions.push("stale result and error from terminated worker were causally ignored");
        } else if (definition.id === "restart") {
          for (const targetValue of definition.targets) await completeRun(targetValue);
          causal.freshWorkers = Number(
            await evaluate(
              client,
              pageSessionId,
              "__pdfEvidenceControl.count()",
            ),
          ) === 2;
          if (!causal.freshWorkers) throw new Error("restart did not create two fresh workers");
          assertions.push("two complete targets used two fresh terminated workers");
        } else if (definition.id === "timeout") {
          await startRun(definition.targets[0]);
          state = await waitState(
            client,
            pageSessionId,
            (value) => value.status === "Timed out.",
            3_000,
          );
          causal.timeoutTerminated = Boolean(
            await evaluate(
              client,
              pageSessionId,
              "__pdfEvidenceControl.terminated(0)",
            ),
          );
          assertions.push("registered 60-second timeout causally terminated the held worker");
        } else if (definition.id === "cancel") {
          await startRun(definition.targets[0]);
          await waitState(client, pageSessionId, (value) => value.status.startsWith("Parsing "));
          await click(client, pageSessionId, "#cancel");
          state = await waitState(client, pageSessionId, (value) => value.status === "Cancelled.");
          causal.cancelTerminated = Boolean(
            await evaluate(
              client,
              pageSessionId,
              "__pdfEvidenceControl.terminated(0)",
            ),
          );
          assertions.push("visible Cancel causally terminated the held worker");
        } else if (definition.id === "pagehide") {
          await startRun(definition.targets[0]);
          state = await waitState(
            client,
            pageSessionId,
            (value) => value.status.startsWith("Parsing "),
          );
          assertions.push("real navigation pagehide causally terminated the held worker");
        } else {
          await completeRun(definition.targets[0]);
          assertions.push(
            "visible Start completed all 100 pages, ten hits and five RGBA checkpoints",
          );
        }

        const axResponse = await client.send(
          "Accessibility.getFullAXTree",
          {},
          pageSessionId,
          10_000,
        );
        const axNodes = ((axResponse.nodes as Array<Record<string, unknown>>) ?? []).map((
          node,
        ) => ({
          role: String((node.role as { value?: unknown } | undefined)?.value ?? ""),
          name: String((node.name as { value?: unknown } | undefined)?.value ?? ""),
          ignored: Boolean(node.ignored),
        }));
        const exposed = axNodes.filter((node) => !node.ignored);
        const axAssertions = {
          headingPresent: exposed.some((node) =>
            node.role === "heading" &&
            node.name === "Parse, search and raster a 100-page report"
          ),
          targetPresent: exposed.some((node) =>
            node.role === "combobox" &&
            node.name === "Controlled target"
          ),
          startPresent: exposed.some((node) => node.role === "button" && node.name === "Start"),
          cancelPresent: exposed.some((node) => node.role === "button" && node.name === "Cancel"),
          statusPresent: exposed.some((node) => node.name.includes(state.status)),
          textualOutputPresent: exposed.some((node) => node.name.includes(state.result)),
        };
        if (Object.values(axAssertions).some((value) => !value)) {
          throw new Error(`AX textual output incomplete: ${JSON.stringify(axAssertions)}`);
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
          throw new Error("screenshot is not exact PNG bytes");
        }
        const screenshotPath = `screenshots/${definition.id}.png`;
        await Deno.writeFile(`${options.outputDir}/${screenshotPath}`, screenshotBytes, {
          createNew: true,
        });

        if (definition.id === "pagehide") {
          await client.send("Page.navigate", { url: "about:blank" }, pageSessionId);
          const deadline = Date.now() + 2_000;
          while (
            !lifecycleEvents.some((event) => event.kind === "worker-terminated") &&
            Date.now() < deadline
          ) {
            await delay(10);
          }
          causal.pagehideTerminated = lifecycleEvents.some((event) =>
            event.kind === "worker-terminated"
          );
        }
        await Promise.all(setupTasks);
        let stable = 0;
        let priorCount = -1;
        const settleDeadline = Date.now() + 5_000;
        while (Date.now() < settleDeadline && stable < 3) {
          await Promise.all(responseTasks);
          const pending = [...requests.values()].some((record) =>
            (record.body as { status: string }).status === "pending"
          );
          if (!pending && requests.size === priorCount) stable++;
          else stable = 0;
          priorCount = requests.size;
          await delay(50);
        }
        if (stable < 3) throw new Error("network and imported-source evidence did not settle");
        if (asyncErrors.length) throw asyncErrors[0];
        const network = [...requests.values()];
        for (const request of network) {
          if (
            request.failed || request.status !== 200 || request.fromDiskCache ||
            request.fromServiceWorker || (request.body as { status: string }).status !== "supported"
          ) {
            throw new Error(`non-authoritative network record: ${JSON.stringify(request)}`);
          }
        }
        if (exceptions.length || consoleEntries.some((entry) => entry.type === "error")) {
          throw new Error("page or worker console/exception evidence is not clean");
        }
        const mutationEvents = executionEvents.filter((event) =>
          event.kind === "resource-mutation"
        );
        if (
          (["resource-key", "font-key", "font-nesting"] as readonly string[]).includes(
            definition.mode,
          ) && mutationEvents.length !== 1
        ) {
          throw new Error("resource negative did not retain one exact mutation audit");
        }
        if (
          !(["resource-key", "font-key", "font-nesting"] as readonly string[]).includes(
            definition.mode,
          ) && mutationEvents.length !== 0
        ) {
          throw new Error("normal scenario unexpectedly mutated a resource");
        }
        const digests = executionEvents.filter((event) => event.kind === "digest-input")
          .map((event) => event.detail as { bytes: number; sha256: string });
        const rgba = digests.filter((entry) => entry.bytes === 1224 * 1584 * 4);
        const expectedRgba = completedTargets.flatMap(() => EXPECTED_RASTER_HASHES);
        if (
          rgba.length !== expectedRgba.length ||
          !sameJson(rgba.map((entry) => entry.sha256), expectedRgba) ||
          digests.filter((entry) => entry.sha256 === EXPECTED_TEXT_SHA256).length !==
            completedTargets.length
        ) throw new Error("completed targets omitted exact text/RGBA digest inputs");
        const wasmAudits = executionEvents.filter((event) => event.kind === "wasm-instantiated");
        const resourceNegative = (["resource-key", "font-key", "font-nesting"] as readonly string[])
          .includes(definition.mode);
        const expectedWasmAudits = completedTargets.filter((result) =>
          result.target === "wasm-linear"
        ).length +
          (resourceNegative && (definition.targets as readonly string[]).includes("wasm-linear")
            ? 1
            : 0);
        if (wasmAudits.length !== expectedWasmAudits) {
          throw new Error("executed Wasm audit denominator differs from attempted Wasm targets");
        }
        for (const wasmAudit of wasmAudits) {
          const detail = wasmAudit.detail as Record<string, unknown>;
          const expected = routeSources.get("/artifacts/document-pdf-viewer/pdf-engine.wasm")!;
          if (
            detail.sha256 !== expected.sha256 ||
            base64ToBytes(String(detail.base64)).length !== expected.bytes.length
          ) throw new Error("executed Wasm bytes differ from accepted fetched artifact");
        }
        const terminationCount = lifecycleEvents.filter((event) =>
          event.kind === "worker-terminated"
        ).length;
        if (terminationCount !== definition.targets.length) {
          throw new Error(
            `${definition.id} terminated ${terminationCount}/${definition.targets.length} workers`,
          );
        }
        if (
          (definition.id === "timeout" && !causal.timeoutTerminated) ||
          (definition.id === "cancel" && !causal.cancelTerminated) ||
          (definition.id === "pagehide" && !causal.pagehideTerminated)
        ) {
          throw new Error(`${definition.id} causal termination assertion failed`);
        }
        const targetInfo = (await client.send("Target.getTargetInfo", { targetId: pageTargetId }))
          .targetInfo as Record<string, unknown>;
        if (targetInfo.browserContextId !== browserContextId || targetInfo.type !== "page") {
          throw new Error("scenario page escaped owned browser context");
        }
        scenarios.push({
          id: definition.id,
          mode: definition.mode,
          targetSequence: [...definition.targets],
          ownership: {
            browserContextId,
            pageTargetId,
            pageSessionId,
            sessions: [...ownedSessions.entries()].map(([sessionId, owner]) => ({
              sessionId,
              ...owner,
            })),
          },
          statusHistory: (state as PageState).statuses,
          finalState: state,
          completedTargets,
          rejection: (["resource-key", "font-key", "font-nesting"] as readonly string[]).includes(
              definition.mode,
            )
            ? {
              mutation: definition.mode,
              target: definition.targets[0],
              rejected: true,
              errorText: state.result,
            }
            : null,
          causal,
          assertions,
          lifecycleEvents,
          executionEvents,
          console: consoleEntries,
          exceptions,
          network,
          executedSources: [...executedSources.values()],
          accessibility: {
            inspectedBy: "Accessibility.getFullAXTree",
            nodes: axNodes,
            treeSha256: await sha256Hex(encoder.encode(canonicalize(axNodes))),
            assertions: axAssertions,
          },
          screenshot: {
            path: screenshotPath,
            bytes: screenshotBytes.length,
            sha256: await sha256Hex(screenshotBytes),
          },
        });
      } finally {
        await Promise.allSettled(setupTasks);
        await Promise.allSettled(responseTasks);
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
    oracleMatches: await sha256Hex(await Deno.readFile(`${root}/${outputManifestPath}`)) ===
      await sha256Hex(outputManifestBytes),
    collectorMatches:
      await sha256Hex(await Deno.readFile(`${root}/${SCRIPT}`)) === await sha256Hex(collectorBytes),
    checkedAt: new Date().toISOString(),
  };
  if (
    endStatus !== "" || endHead !== head || endTree !== tree || !endFilesMatch ||
    !endRecheck.oracleMatches || !endRecheck.collectorMatches
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
        evidenceType: "document-pdf-viewer-browser-collection-failure",
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
  if (scenarios.length !== 14) {
    throw new Error(`collector retained ${scenarios.length}/14 scenarios`);
  }

  const evidence = {
    schemaVersion: 1,
    workload: WORKLOAD,
    evidenceId: `document-pdf-viewer-browser-${head.slice(0, 12)}`,
    collectedAt: new Date().toISOString(),
    authority: {
      kind: "authoritative-parent-run-browser-collection",
      browserWasLaunchedByCollector: true,
      importedOrChildGeneratedEvidenceAccepted: false,
    },
    collection: {
      script: SCRIPT,
      command: `deno run -A ${SCRIPT} --chrome=${options.chrome} --output-dir=${options.outputDir}`,
      outputDirectory: options.outputDir,
    },
    source: {
      head,
      tree,
      acceptedParentCommit: ACCEPTED_PARENT_COMMIT,
      acceptedParentTree: ACCEPTED_PARENT_TREE,
      root,
      initialClean: true,
      collector: {
        path: SCRIPT,
        bytes: collectorBytes.length,
        sha256: await sha256Hex(collectorBytes),
        headBytesMatch: true,
      },
      files: sourceFiles,
      oracle: {
        path: outputManifestPath,
        bytes: outputManifestBytes.length,
        sha256: await sha256Hex(outputManifestBytes),
        acceptedCommitBytesMatch: true,
      },
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
      debuggerListener,
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
  validateEvidenceSemantics(evidence);
  const schema = JSON.parse(
    await Deno.readTextFile(`${root}/schemas/document-pdf-viewer-browser-evidence.schema.json`),
  );
  type Validator = ((value: unknown) => boolean) & { errors?: unknown };
  type AjvConstructor = new (
    options?: Record<string, unknown>,
  ) => { compile: (schema: unknown) => Validator };
  const Ajv2020 = Ajv2020Module as unknown as AjvConstructor;
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
  if (!validate(evidence)) {
    throw new Error(`browser evidence schema failed: ${JSON.stringify(validate.errors)}`);
  }
  await Deno.writeTextFile(`${options.outputDir}/evidence.v1.json`, `${canonicalize(evidence)}\n`, {
    createNew: true,
  });
  console.log(
    "PDF viewer browser evidence: 14 authoritative scenarios; exact cgroup cleanup retained",
  );
}

if (import.meta.main) await runCollector(parseOptions(Deno.args));

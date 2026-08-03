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

export type ProcessIdentity = {
  pid: number;
  parentPid: number;
  processGroupId: number;
  sessionId: number;
  startTimeTicks: string;
  executable: string;
};

export type OwnedSessionLedger = {
  launcher: ProcessIdentity;
  sessionId: number;
  identities: ProcessIdentity[];
  snapshots: Array<{ collectedAt: string; pids: number[] }>;
};

type TargetPairing = { targetId: string; targetType: "page" | "worker" };

export type NetworkRecord = {
  requestId: string;
  sessionId: string;
  targetId: string;
  targetType: "page" | "worker";
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

export function assertTargetPairings(cases: BrowserCase[]): void {
  if (cases.length !== 36) throw new Error("target pairing denominator mismatch");
  for (const kind of KINDS) {
    for (const byteLength of SIZES) {
      for (const schedule of SCHEDULES) {
        const pair = cases.filter((entry) =>
          entry.kind === kind && entry.byteLength === byteLength && entry.schedule === schedule
        );
        if (
          pair.length !== 2 || pair[0].target !== "js-controlled" ||
          pair[1].target !== "wasm-linear-controlled" ||
          pair[0].output.digestSha256 !== pair[1].output.digestSha256 ||
          pair[0].expectedDigestSha256 !== pair[1].expectedDigestSha256
        ) throw new Error(`target pairing mismatch: ${kind}:${byteLength}:${schedule}`);
      }
    }
  }
}

export function assertVisibleControlOutput(
  actual: Record<string, unknown>,
  expected: BrowserCase,
  exactContract: {
    registrationSha256: string;
    buildManifestSha256: string;
    artifactSha256: string;
  },
): void {
  const wanted = {
    workloadId: WORKLOAD_ID,
    target: expected.target,
    kind: expected.kind,
    byteLength: expected.byteLength,
    schedule: expected.schedule,
    digestSha256: expected.output.digestSha256,
    counters: expected.output.counters,
    exactContract: { ...exactContract, sourceHashesMatched: true },
    performanceClaim: null,
  };
  if (!sameJson(actual, wanted)) throw new Error("visible control output contract mismatch");
}

export const EXPECTED_CONTROLS = Object.freeze([
  { id: "target", text: "Engine", disabled: false },
  { id: "kind", text: "Generated fixture", disabled: false },
  { id: "size", text: "Exact size", disabled: false },
  { id: "schedule", text: "Chunk schedule", disabled: false },
  { id: "start", text: "Start", disabled: false },
  { id: "cancel", text: "Cancel", disabled: true },
]);

export function assertVisibleControls(actual: unknown): void {
  if (!sameJson(actual, EXPECTED_CONTROLS)) throw new Error("visible controls mismatch");
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

export async function processIdentity(
  pid: number,
  procRoot = "/proc",
): Promise<ProcessIdentity | null> {
  try {
    const stat = await Deno.readTextFile(`${procRoot}/${pid}/stat`);
    const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(" ");
    const identity = {
      pid,
      parentPid: Number(fields[1]),
      processGroupId: Number(fields[2]),
      sessionId: Number(fields[3]),
      startTimeTicks: fields[19],
      executable: await Deno.realPath(`${procRoot}/${pid}/exe`),
    };
    if (
      !Number.isSafeInteger(identity.parentPid) || identity.parentPid < 0 ||
      !Number.isSafeInteger(identity.processGroupId) || identity.processGroupId < 1 ||
      !Number.isSafeInteger(identity.sessionId) || identity.sessionId < 1 ||
      !/^\d+$/.test(identity.startTimeTicks)
    ) return null;
    return identity;
  } catch {
    return null;
  }
}

async function processSnapshot(procRoot = "/proc"): Promise<ProcessIdentity[]> {
  const identities: ProcessIdentity[] = [];
  for await (const entry of Deno.readDir(procRoot)) {
    if (!entry.isDirectory || !/^\d+$/.test(entry.name)) continue;
    const identity = await processIdentity(Number(entry.name), procRoot);
    if (identity) identities.push(identity);
  }
  return identities;
}

async function ownedProcesses(rootPid: number, procRoot = "/proc"): Promise<ProcessIdentity[]> {
  const identities = await processSnapshot(procRoot);
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

async function identityStillRunning(
  identity: ProcessIdentity,
  procRoot = "/proc",
): Promise<boolean> {
  const current = await processIdentity(identity.pid, procRoot);
  return current?.startTimeTicks === identity.startTimeTicks &&
    current.executable === identity.executable && current.sessionId === identity.sessionId;
}

function mergeIdentities(
  retained: ProcessIdentity[],
  observed: ProcessIdentity[],
): ProcessIdentity[] {
  const byPid = new Map(retained.map((identity) => [identity.pid, identity]));
  for (const identity of observed) {
    const prior = byPid.get(identity.pid);
    if (
      prior &&
      (prior.startTimeTicks !== identity.startTimeTicks ||
        prior.executable !== identity.executable ||
        prior.sessionId !== identity.sessionId || prior.processGroupId !== identity.processGroupId)
    ) throw new Error(`owned process identity changed for pid ${identity.pid}`);
    // Preserve the first observed parent so later reparenting cannot erase launch ancestry.
    byPid.set(identity.pid, prior ?? identity);
  }
  return [...byPid.values()].sort((a, b) => a.pid - b.pid);
}

export async function acquireOwnedSession(
  launcherPid: number,
  chromeExecutable: string,
  timeoutMs = 10_000,
  procRoot = "/proc",
): Promise<OwnedSessionLedger> {
  const deadline = Date.now() + timeoutMs;
  const expectedLauncher = await Deno.realPath("/usr/bin/setsid");
  let launcher: ProcessIdentity | null = null;
  let retained: ProcessIdentity[] = [];
  while (Date.now() < deadline) {
    const candidateLauncher = await processIdentity(launcherPid, procRoot);
    if (candidateLauncher?.executable === expectedLauncher) launcher ??= candidateLauncher;
    if (!launcher) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      continue;
    }
    const descendants = await ownedProcesses(launcherPid, procRoot);
    retained = mergeIdentities(retained, descendants);
    const chrome = descendants.find((identity) =>
      identity.executable === chromeExecutable && identity.sessionId === identity.pid
    );
    if (chrome) {
      const members = (await processSnapshot(procRoot)).filter((identity) =>
        identity.sessionId === chrome.sessionId
      );
      retained = mergeIdentities(retained, members);
      return {
        launcher,
        sessionId: chrome.sessionId,
        identities: retained,
        snapshots: [{
          collectedAt: new Date().toISOString(),
          pids: members.map((identity) => identity.pid).sort((a, b) => a - b),
        }],
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("exact owned Chrome session unavailable after launch");
}

export async function refreshOwnedSession(
  ledger: OwnedSessionLedger,
  procRoot = "/proc",
): Promise<OwnedSessionLedger> {
  const members = (await processSnapshot(procRoot)).filter((identity) =>
    identity.sessionId === ledger.sessionId
  );
  return {
    ...ledger,
    identities: mergeIdentities(ledger.identities, members),
    snapshots: [...ledger.snapshots, {
      collectedAt: new Date().toISOString(),
      pids: members.map((identity) => identity.pid).sort((a, b) => a - b),
    }],
  };
}

async function listenerInode(port: number, procRoot = "/proc"): Promise<string> {
  const wantedPort = port.toString(16).toUpperCase().padStart(4, "0");
  for (const file of [`${procRoot}/net/tcp`, `${procRoot}/net/tcp6`]) {
    try {
      for (const line of (await Deno.readTextFile(file)).trim().split("\n").slice(1)) {
        const fields = line.trim().split(/\s+/);
        const [address, observedPort] = (fields[1] ?? "").split(":");
        const loopback = address === "0100007F" ||
          address === "00000000000000000000000001000000";
        if (
          observedPort === wantedPort && fields[3] === "0A" && loopback &&
          /^\d+$/.test(fields[9] ?? "")
        ) return fields[9];
      }
    } catch {
      // Continue to the other kernel socket table.
    }
  }
  throw new Error("Chrome DevTools listener socket not found on exact loopback port");
}

export async function assertOwnedDevToolsListener(
  port: number,
  ledger: OwnedSessionLedger,
  procRoot = "/proc",
): Promise<{ ledger: OwnedSessionLedger; owner: ProcessIdentity }> {
  const refreshed = await refreshOwnedSession(ledger, procRoot);
  const wanted = `socket:[${await listenerInode(port, procRoot)}]`;
  for (const identity of refreshed.identities) {
    if (
      identity.sessionId !== refreshed.sessionId ||
      !(await identityStillRunning(identity, procRoot))
    ) {
      continue;
    }
    try {
      for await (const fd of Deno.readDir(`${procRoot}/${identity.pid}/fd`)) {
        try {
          if (await Deno.readLink(`${procRoot}/${identity.pid}/fd/${fd.name}`) === wanted) {
            return { ledger: refreshed, owner: identity };
          }
        } catch {
          // File descriptors may close while the exact session is inspected.
        }
      }
    } catch {
      // Processes may exit while the exact session is inspected.
    }
  }
  throw new Error("Chrome DevTools listener is not owned by the launched session");
}

async function waitForOwnedDevToolsListener(
  port: number,
  ledger: OwnedSessionLedger,
  timeoutMs = 10_000,
): Promise<{ ledger: OwnedSessionLedger; owner: ProcessIdentity }> {
  const deadline = Date.now() + timeoutMs;
  let current = ledger;
  let last = "listener absent";
  while (Date.now() < deadline) {
    try {
      return await assertOwnedDevToolsListener(port, current);
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      current = await refreshOwnedSession(current);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error(`owned Chrome DevTools listener unavailable: ${last}`);
}

async function waitForOwnedExit(
  identities: ProcessIdentity[],
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (
      !(await Promise.all(identities.map((identity) => identityStillRunning(identity)))).some(
        Boolean,
      )
    ) {
      return true;
    }
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
        try {
          Deno.kill(identity.pid, "SIGTERM");
          signals.push({ pid: identity.pid, signal: "SIGTERM" });
        } catch (error) {
          if (await identityStillRunning(identity)) throw error;
        }
      }
    }
  }
  if (!(await waitForOwnedExit(identities, 5_000))) {
    for (const identity of [...identities].reverse()) {
      if (await identityStillRunning(identity)) {
        try {
          Deno.kill(identity.pid, "SIGKILL");
          signals.push({ pid: identity.pid, signal: "SIGKILL" });
        } catch (error) {
          if (await identityStillRunning(identity)) throw error;
        }
      }
    }
  }
  return { signals, processesAbsent: await waitForOwnedExit(identities, 5_000) };
}

export async function exactSessionCleanup(
  ledger: OwnedSessionLedger,
): Promise<{
  ledger: OwnedSessionLedger;
  signals: Array<{ pid: number; signal: string }>;
  processesAbsent: boolean;
}> {
  let refreshed = await refreshOwnedSession(ledger);
  const signals: Array<{ pid: number; signal: string }> = [];
  for (const signal of ["SIGTERM", "SIGKILL"] as const) {
    const deadline = Date.now() + (signal === "SIGTERM" ? 5_000 : 2_000);
    while (Date.now() < deadline) {
      refreshed = await refreshOwnedSession(refreshed);
      const retainedSession = refreshed.identities.filter((identity) =>
        identity.sessionId === refreshed.sessionId
      );
      const currentLive: ProcessIdentity[] = [];
      for (const identity of retainedSession) {
        if (await identityStillRunning(identity)) currentLive.push(identity);
      }
      if (!currentLive.length) {
        const launcherCleanup = await exactProcessCleanup([refreshed.launcher]);
        return {
          ledger: refreshed,
          signals: [...signals, ...launcherCleanup.signals],
          processesAbsent: launcherCleanup.processesAbsent,
        };
      }
      for (const identity of [...currentLive].reverse()) {
        try {
          Deno.kill(identity.pid, signal);
          signals.push({ pid: identity.pid, signal });
        } catch (error) {
          if (await identityStillRunning(identity)) throw error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  refreshed = await refreshOwnedSession(refreshed);
  const currentLive: number[] = [];
  for (const identity of refreshed.identities) {
    if (identity.sessionId === refreshed.sessionId && await identityStillRunning(identity)) {
      currentLive.push(identity.pid);
    }
  }
  const processesAbsent = !currentLive.length && !(await identityStillRunning(refreshed.launcher));
  return { ledger: refreshed, signals, processesAbsent };
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
  registerSession?: (sessionId: string, pairing: TargetPairing) => void,
): Promise<{ targetId: string; sessionId: string }> {
  const created = await client.send("Target.createTarget", { url: "about:blank" });
  const targetId = String(created.targetId);
  const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = String(attached.sessionId);
  registerSession?.(sessionId, { targetId, targetType: "page" });
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
  registerSession: (sessionId: string, pairing: TargetPairing) => void,
): Promise<Array<Record<string, unknown>>> {
  const records: Array<Record<string, unknown>> = [];
  for (const id of LIFECYCLE_IDS) {
    const page = await attachPage(
      client,
      `${origin}${DEMO_ROUTE}?collectorLifecycle=${id}`,
      true,
      registerSession,
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

function lifecycleState(
  status: string,
  startDisabled: boolean,
  cancelDisabled: boolean,
): Record<string, unknown> {
  return {
    status,
    output: "No result while work is in progress.",
    startDisabled,
    cancelDisabled,
  };
}

export function expectedLifecycleRecords(): Array<Record<string, unknown>> {
  const cancelled = lifecycleState("Cancelled. The worker was terminated.", false, true);
  const starting = lifecycleState("Starting fresh worker.", true, false);
  const worker = (token: number) => ({
    url: "/crypto-file-integrity-worker.js",
    type: "module",
    token,
    terminated: true,
  });
  return [
    {
      id: "wrong-token",
      instrumentation: "collector-controlled Worker test double; not correctness evidence",
      assertions: ["wrong token ignored", "owned worker terminated"],
      stateBeforeCleanup: starting,
      stateAfterCleanup: cancelled,
      workers: [worker(1)],
      passed: true,
    },
    {
      id: "stale-error",
      instrumentation: "collector-controlled Worker test double; not correctness evidence",
      assertions: ["stale error ignored", "replaced worker terminated", "owned worker terminated"],
      stateBeforeCleanup: starting,
      stateAfterCleanup: cancelled,
      workers: [worker(1), worker(3)],
      passed: true,
    },
    {
      id: "restart",
      instrumentation: "collector-controlled Worker test double; not correctness evidence",
      assertions: [
        "restart terminated prior worker",
        "fresh worker created",
        "owned worker terminated",
      ],
      stateBeforeCleanup: starting,
      stateAfterCleanup: cancelled,
      workers: [worker(1), worker(3)],
      passed: true,
    },
    {
      id: "cancel",
      instrumentation: "collector-controlled Worker test double; not correctness evidence",
      assertions: ["Cancel control terminated worker", "cancel status exposed"],
      stateBeforeCleanup: cancelled,
      stateAfterCleanup: cancelled,
      workers: [worker(1)],
      passed: true,
    },
    {
      id: "timeout",
      instrumentation: "collector-controlled Worker test double; not correctness evidence",
      assertions: ["180 second callback exercised", "timeout terminated worker"],
      stateBeforeCleanup: lifecycleState("Stopped after the 180 second limit.", false, true),
      stateAfterCleanup: lifecycleState("Stopped after the 180 second limit.", false, true),
      workers: [worker(1)],
      passed: true,
    },
    {
      id: "pagehide",
      instrumentation: "collector-controlled Worker test double; not correctness evidence",
      assertions: ["pagehide cleanup exercised", "pagehide terminated worker"],
      stateBeforeCleanup: lifecycleState("Starting fresh worker.", false, true),
      stateAfterCleanup: lifecycleState("Starting fresh worker.", false, true),
      workers: [worker(1)],
      passed: true,
    },
  ];
}

export function lifecycleSemantics(records: Array<Record<string, unknown>>): void {
  if (!sameJson(records, expectedLifecycleRecords())) {
    throw new Error("lifecycle corpus semantics are not exact");
  }
}

export function assertExhaustiveNetwork(
  records: NetworkRecord[],
  origin: string,
  allowedPaths: ReadonlySet<string>,
): void {
  if (!records.length) throw new Error("browser network evidence is empty");
  for (const record of records) {
    let url: URL;
    try {
      url = new URL(record.url);
    } catch {
      throw new Error(`browser network URL is invalid: ${record.url}`);
    }
    if (
      url.origin !== origin || !allowedPaths.has(url.pathname) || record.method !== "GET" ||
      record.status !== 200 || record.failed || record.errorText !== null ||
      record.fromServiceWorker || !record.targetId ||
      !["page", "worker"].includes(record.targetType)
    ) throw new Error(`browser network request denied: ${record.url}`);
  }
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
  const chromeInfoAfterHash = await Deno.stat(chromePath);
  if (
    chromeInfoBefore.dev !== chromeInfoAfterHash.dev ||
    chromeInfoBefore.ino !== chromeInfoAfterHash.ino ||
    chromeInfoBefore.size !== chromeInfoAfterHash.size ||
    chromeInfoBefore.mtime?.getTime() !== chromeInfoAfterHash.mtime?.getTime() ||
    observedChromeSha256 !== options.chromeSha256
  ) throw new Error("Chrome hash mismatch or executable changed while hashing");

  const partialRoot = await Deno.makeTempDir({
    dir: `${source.root}/..`,
    prefix: ".wasm-crypto-browser-evidence-",
  });
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
    let chromeLedger: OwnedSessionLedger | null = null;
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
      launchArguments.splice(1, 0, "--enable-automation");
      chrome = new Deno.Command("/usr/bin/setsid", {
        args: ["--fork", "--wait", chromePath, ...launchArguments],
        stdout: "null",
        stderr: "null",
      }).spawn();
      chromeLedger = await acquireOwnedSession(chrome.pid, chromePath);
      return {
        serverIdentity,
        profilePath,
        profileInfo,
        launchArguments,
        chrome,
        chromeLedger,
        chromeStatus: chrome.status,
      };
    } catch (error) {
      const cleanupErrors: unknown[] = [];
      let browserAbsent = chrome === null;
      try {
        if (chromeLedger) {
          const cleaned = await exactSessionCleanup(chromeLedger);
          browserAbsent = cleaned.processesAbsent;
        } else if (chrome) {
          const cleaned = await exactProcessCleanup(await ownedProcesses(chrome.pid));
          browserAbsent = cleaned.processesAbsent;
        }
        if (!browserAbsent) throw new Error("setup Chrome cleanup was incomplete");
        if (chrome) await chrome.status;
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      if (profilePath && browserAbsent) {
        try {
          await Deno.remove(profilePath, { recursive: true });
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
      }
      try {
        const currentServer = await processIdentity(server.pid);
        if (currentServer && await identityStillRunning(currentServer)) {
          Deno.kill(currentServer.pid, "SIGTERM");
          const cleaned = await exactProcessCleanup([currentServer]);
          if (!cleaned.processesAbsent) throw new Error("setup server cleanup was incomplete");
        }
        await serverStatus;
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      try {
        await Deno.remove(partialRoot, { recursive: true });
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      if (cleanupErrors.length) {
        throw new AggregateError([error, ...cleanupErrors], "collector setup cleanup failed");
      }
      throw error;
    }
  })();
  const {
    serverIdentity,
    profilePath,
    profileInfo,
    launchArguments,
    chromeLedger: initialChromeLedger,
    chromeStatus,
  } = setup;
  let chromeLedger = initialChromeLedger;
  let devToolsOwner: ProcessIdentity | null = null;
  let client: CdpClient | null = null;
  let success = false;
  const cleanupAfterFailure = async () => {
    const cleanupErrors: unknown[] = [];
    try {
      await client?.send("Browser.close");
    } catch {
      // The retained launch session remains the cleanup authority when CDP has failed.
    }
    client?.close();
    let browserAbsent = false;
    try {
      const cleaned = await exactSessionCleanup(chromeLedger);
      browserAbsent = cleaned.processesAbsent;
      if (!browserAbsent) throw new Error("failure-path Chrome cleanup was incomplete");
      await chromeStatus;
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      const currentServer = await processIdentity(server.pid);
      if (currentServer && await identityStillRunning(currentServer)) {
        Deno.kill(currentServer.pid, "SIGTERM");
        const cleaned = await exactProcessCleanup([currentServer]);
        if (!cleaned.processesAbsent) throw new Error("failure-path server cleanup was incomplete");
      }
      await serverStatus;
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (browserAbsent) {
      try {
        await Deno.remove(profilePath, { recursive: true });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await Deno.remove(partialRoot, { recursive: true });
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length) {
      throw new AggregateError(cleanupErrors, "collector failure cleanup did not complete");
    }
  };
  try {
    ({ ledger: chromeLedger, owner: devToolsOwner } = await waitForOwnedDevToolsListener(
      debuggerPort,
      chromeLedger,
    ));
    const discoveryResponse = await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`);
    ({ ledger: chromeLedger, owner: devToolsOwner } = await assertOwnedDevToolsListener(
      debuggerPort,
      chromeLedger,
    ));
    const discovery = await discoveryResponse.json();
    const webSocketUrl = new URL(String(discovery.webSocketDebuggerUrl));
    if (
      String(discovery.Browser) !== options.chromeProduct || webSocketUrl.protocol !== "ws:" ||
      webSocketUrl.hostname !== "127.0.0.1" || Number(webSocketUrl.port) !== debuggerPort ||
      !/^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(webSocketUrl.pathname) || webSocketUrl.search ||
      webSocketUrl.hash
    ) throw new Error("Chrome DevTools endpoint escaped exact loopback ownership");
    client = new CdpClient(webSocketUrl.href);
    await client.ready();
    ({ ledger: chromeLedger, owner: devToolsOwner } = await assertOwnedDevToolsListener(
      debuggerPort,
      chromeLedger,
    ));
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
    const targetPairingErrors: string[] = [];
    const sessionPairings = new Map<string, TargetPairing>();
    const registerSession = (sessionId: string, pairing: TargetPairing) => {
      const prior = sessionPairings.get(sessionId);
      if (prior && !sameJson(prior, pairing)) {
        targetPairingErrors.push(`session ${sessionId} changed target identity`);
      } else sessionPairings.set(sessionId, pairing);
    };
    client.on("Target.attachedToTarget", (params) => {
      const sessionId = String(params.sessionId ?? "");
      const targetInfo = params.targetInfo as Record<string, unknown> | undefined;
      const type = String(targetInfo?.type ?? "");
      const targetId = String(targetInfo?.targetId ?? "");
      if (!sessionId || !targetId || !["page", "worker"].includes(type)) {
        targetPairingErrors.push(`unapproved attached target: ${type}:${targetId}`);
        return;
      }
      registerSession(sessionId, { targetId, targetType: type as "page" | "worker" });
      bodyTasks.push(
        Promise.all([
          client!.send("Network.enable", {}, sessionId),
          client!.send("Runtime.enable", {}, sessionId),
        ]).then(async () => {
          await client!.send("Runtime.runIfWaitingForDebugger", {}, sessionId);
        }),
      );
    });
    client.on("Runtime.consoleAPICalled", (params, sessionId) => {
      const pairing = sessionId ? sessionPairings.get(sessionId) : undefined;
      if (!sessionId || !pairing) {
        targetPairingErrors.push("console event lacked an exact target pairing");
        return;
      }
      consoleMessages.push({
        ...pairing,
        type: String(params.type),
        arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((arg) =>
          String(arg.value ?? arg.description ?? arg.type)
        ),
      });
    });
    client.on("Runtime.exceptionThrown", (params, sessionId) => {
      const pairing = sessionId ? sessionPairings.get(sessionId) : undefined;
      if (!sessionId || !pairing) {
        targetPairingErrors.push("exception event lacked an exact target pairing");
        return;
      }
      const details = params.exceptionDetails as Record<string, unknown>;
      exceptions.push({
        ...pairing,
        text: String(details.text),
        lineNumber: Number(details.lineNumber),
      });
    });
    client.on("Network.requestWillBeSent", (params, sessionId) => {
      const pairing = sessionId ? sessionPairings.get(sessionId) : undefined;
      if (!sessionId || !pairing) {
        targetPairingErrors.push("network request lacked an exact target pairing");
        return;
      }
      const request = params.request as Record<string, unknown>;
      const key = `${sessionId}:${String(params.requestId)}`;
      if (network.has(key)) targetPairingErrors.push(`duplicate network request identity: ${key}`);
      network.set(key, {
        requestId: String(params.requestId),
        sessionId,
        ...pairing,
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
      if (!record) {
        targetPairingErrors.push("network response lacked a retained request");
        return;
      }
      record.status = Number(response.status);
      record.mimeType = String(response.mimeType);
      record.fromDiskCache = Boolean(response.fromDiskCache);
      record.fromServiceWorker = Boolean(response.fromServiceWorker);
    });
    client.on("Network.loadingFailed", (params, sessionId) => {
      if (!sessionId) return;
      const record = network.get(`${sessionId}:${String(params.requestId)}`);
      if (!record) {
        targetPairingErrors.push("network failure lacked a retained request");
        return;
      }
      record.failed = true;
      record.errorText = String(params.errorText);
    });
    client.on("Network.loadingFinished", (params, sessionId) => {
      if (!sessionId) return;
      const record = network.get(`${sessionId}:${String(params.requestId)}`);
      if (!record) {
        targetPairingErrors.push("network completion lacked a retained request");
        return;
      }
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

    const page = await attachPage(client, `${origin}${DEMO_ROUTE}`, false, registerSession);
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
    const assetHash = (route: string) => {
      const value = localAssets.find((asset) => asset.route === route)?.sha256;
      if (!value) throw new Error(`visible contract asset missing: ${route}`);
      return value;
    };
    assertVisibleControlOutput(visibleOutput, visibleExpected, {
      registrationSha256: assetHash("/registrations/base/crypto.file-integrity.v1.json"),
      buildManifestSha256: assetHash("/artifacts/crypto-file-integrity/build-manifest.json"),
      artifactSha256: assetHash("/artifacts/crypto-file-integrity/crypto-file-integrity.wasm"),
    });

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
    assertVisibleControls(accessibility.controls);
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
    assertTargetPairings(cases);
    const fullWasmCases = cases.filter((entry) =>
      entry.target === "wasm-linear-controlled" && entry.byteLength === 268_435_456 &&
      entry.schedule === "whole-buffer"
    );
    if (
      fullWasmCases.length !== 2 || fullWasmCases.some((entry) => entry.wasmMemoryPages !== 4098)
    ) {
      throw new Error("full 256 MiB Wasm memory evidence did not observe 4,098 pages");
    }

    const lifecycle = await collectLifecycle(client, origin, registerSession);
    lifecycleSemantics(lifecycle);
    let drainedTasks = -1;
    while (drainedTasks !== bodyTasks.length) {
      drainedTasks = bodyTasks.length;
      await Promise.all(bodyTasks.slice(0, drainedTasks));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (targetPairingErrors.length) {
      throw new Error(`browser target pairing gate failed: ${targetPairingErrors.join("; ")}`);
    }
    if (exceptions.length || consoleMessages.length) {
      throw new Error("browser console or exception gate failed");
    }
    const networkRecords = [...network.values()];
    const allowedNetworkPaths = new Set([...Object.keys(FETCHED_ASSETS), "/favicon.ico"]);
    assertExhaustiveNetwork(networkRecords, origin, allowedNetworkPaths);
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

    chromeLedger = await refreshOwnedSession(chromeLedger);
    if (
      !devToolsOwner ||
      !chromeLedger.identities.some((identity) => sameJson(identity, devToolsOwner))
    ) {
      throw new Error("DevTools listener owner was not retained in the exact launch ledger");
    }
    await client.send("Browser.close");
    client.close();
    client = null;
    const browserCleanup = await exactSessionCleanup(chromeLedger);
    chromeLedger = browserCleanup.ledger;
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

    const endSource = await assertExactSourceRoot(options.sourceRoot, options.sourceCommit);
    if (!sameJson(endSource, source)) throw new Error("source identity changed across collection");

    const evidence = {
      schemaVersion: 1,
      evidenceId: "crypto.file-integrity.v1-chrome-browser-validation-v1",
      collectedAt: new Date().toISOString(),
      source: { ...source, collectorSha256, endVerified: true },
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
          owner: devToolsOwner,
          launchSessionId: chromeLedger.sessionId,
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
          launcher: chromeLedger.launcher,
          launchSessionId: chromeLedger.sessionId,
          devToolsOwner,
          observedProcesses: chromeLedger.identities,
          membershipSnapshots: chromeLedger.snapshots,
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
    if (!success) await cleanupAfterFailure();
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

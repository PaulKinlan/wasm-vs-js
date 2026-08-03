import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";
import {
  CHECKPOINT_STEPS,
  COUNTERS,
  TIMESTEPS,
  VARIANTS,
} from "../benchmarks/base/simulation-nbody/contract.js";

const root = new URL("../", import.meta.url);
const workloadRoute = "/demos/simulation-nbody-cloth/";
export const CFT_PRODUCT = "Chrome/150.0.7871.24";
export const CFT_EXECUTABLE_SHA256 =
  "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
export const FIXED_CHROME_ARGUMENTS = Object.freeze(
  [
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
  ] as const,
);
const expectedDigests = {
  completeOutputDigest: "00136c5b760c3794",
  quantizedStateDigest: "5c5c1eca3fffb709",
};

export const COLLECTOR_SOURCE_PATHS = [
  "scripts/collect-base-simulation-nbody-evidence.ts",
  "lib/canonical.ts",
  "lib/cdp-client.ts",
  "deploy.ts",
  "server.ts",
  "benchmarks/base/simulation-nbody/contract.js",
  "benchmarks/base/simulation-nbody/fixture.js",
  "benchmarks/base/simulation-nbody/engine.js",
  "public/demos/simulation-nbody-cloth/index.html",
  "public/demos/simulation-nbody-cloth/demo.js",
  "public/demos/simulation-nbody-cloth/worker.js",
  "public/styles.css",
  "public/artifacts/base-simulation-nbody/nbody.wasm",
  "public/artifacts/base-simulation-nbody/build-manifest.json",
  "schemas/base-simulation-nbody-browser-evidence.schema.json",
] as const;

export const EXECUTED_ROUTE_PATHS: Readonly<Record<string, string>> = Object.freeze({
  "/demos/simulation-nbody-cloth/": "public/demos/simulation-nbody-cloth/index.html",
  "/demos/simulation-nbody-cloth/demo.js": "public/demos/simulation-nbody-cloth/demo.js",
  "/demos/simulation-nbody-cloth/worker.js": "public/demos/simulation-nbody-cloth/worker.js",
  "/benchmarks/base/simulation-nbody/contract.js": "benchmarks/base/simulation-nbody/contract.js",
  "/benchmarks/base/simulation-nbody/fixture.js": "benchmarks/base/simulation-nbody/fixture.js",
  "/benchmarks/base/simulation-nbody/engine.js": "benchmarks/base/simulation-nbody/engine.js",
  "/artifacts/base-simulation-nbody/nbody.wasm":
    "public/artifacts/base-simulation-nbody/nbody.wasm",
  "/styles.css": "public/styles.css",
});

export const SCENARIOS = Object.freeze(
  [
    { id: "js-controlled-complete", target: "js-controlled", action: "complete" },
    { id: "wasm-linear-controlled-complete", target: "wasm-linear-controlled", action: "complete" },
    { id: "cancel-lifecycle", target: "js-controlled", action: "cancel" },
    { id: "timeout-lifecycle", target: "js-controlled", action: "timeout" },
    { id: "pagehide-lifecycle", target: "js-controlled", action: "pagehide" },
  ] as const,
);

const SHELL_ROUTE_PATHS = Object.freeze(
  [
    workloadRoute,
    "/styles.css",
    "/demos/simulation-nbody-cloth/demo.js",
  ] as const,
);
const COMPLETE_ROUTE_PATHS = Object.freeze(
  [
    ...SHELL_ROUTE_PATHS,
    "/demos/simulation-nbody-cloth/worker.js",
    "/benchmarks/base/simulation-nbody/contract.js",
    "/benchmarks/base/simulation-nbody/fixture.js",
    "/benchmarks/base/simulation-nbody/engine.js",
  ] as const,
);
export const SCENARIO_ROUTE_PATHS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "js-controlled-complete": COMPLETE_ROUTE_PATHS,
  "wasm-linear-controlled-complete": Object.freeze([
    ...COMPLETE_ROUTE_PATHS,
    "/artifacts/base-simulation-nbody/nbody.wasm",
  ]),
  "cancel-lifecycle": SHELL_ROUTE_PATHS,
  "timeout-lifecycle": SHELL_ROUTE_PATHS,
  "pagehide-lifecycle": SHELL_ROUTE_PATHS,
});

type Scenario = (typeof SCENARIOS)[number];
type ProcessIdentity = {
  pid: number;
  parentPid: number;
  startTimeTicks: string;
  executable: string;
};
type CgroupIdentity = {
  path: string;
  dev: number;
  ino: number;
};
type ListenerIdentity = {
  address: "127.0.0.1";
  inode: string;
  owner: ProcessIdentity;
};
type FrozenSource = {
  evidence: {
    commit: string;
    tree: string;
    files: Array<{ path: string; bytes: number; sha256: string }>;
    cleanHeadVerifiedBeforeAndAfter: true;
  };
  records: ReadonlyMap<string, { bytes: number; sha256: string }>;
};
type NetworkRecord = {
  requestId: string;
  sessionId: string;
  url: string;
  method: string;
  type: string;
  status: number | null;
  mimeType: string | null;
  fromDiskCache: boolean;
  fromServiceWorker: boolean;
  failed: boolean;
  errorText: string | null;
};

async function commandText(command: string, args: string[]): Promise<string> {
  const output = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) {
    throw new Error(`${command} failed: ${new TextDecoder().decode(output.stderr).trim()}`);
  }
  return new TextDecoder().decode(output.stdout).trim();
}

export function assertCleanStatus(status: string): void {
  const dirty = status.split("\0").filter(Boolean);
  if (dirty.length) {
    const path = dirty[0].length > 3 ? dirty[0].slice(3) : dirty[0];
    throw new Error(`collection requires a clean checkout: ${path}`);
  }
}

async function fileRecord(path: string) {
  const bytes = await Deno.readFile(new URL(path, root));
  return { path, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) };
}

async function cleanStatus(): Promise<void> {
  const status = await new Deno.Command("git", {
    cwd: root,
    args: ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!status.success) throw new Error("git status failed");
  assertCleanStatus(new TextDecoder().decode(status.stdout));
}

async function assertCleanHead(sourceCommit: string): Promise<FrozenSource> {
  const head = await commandText("git", ["rev-parse", "HEAD"]);
  if (sourceCommit !== head) throw new Error("--source-commit does not match HEAD");
  await cleanStatus();
  const files: Array<{ path: string; bytes: number; sha256: string }> = [];
  const records = new Map<string, { bytes: number; sha256: string }>();
  for (const path of COLLECTOR_SOURCE_PATHS) {
    const disk = await Deno.readFile(new URL(path, root));
    const committed = await new Deno.Command("git", {
      cwd: root,
      args: ["show", `${sourceCommit}:${path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const diskHash = await sha256Hex(disk);
    if (!committed.success || await sha256Hex(committed.stdout) !== diskHash) {
      throw new Error(`committed source bytes differ from checkout: ${path}`);
    }
    const record = { path, bytes: committed.stdout.byteLength, sha256: diskHash };
    files.push(record);
    records.set(path, { bytes: record.bytes, sha256: record.sha256 });
  }
  return {
    evidence: {
      commit: sourceCommit,
      tree: await commandText("git", ["rev-parse", `${sourceCommit}^{tree}`]),
      files,
      cleanHeadVerifiedBeforeAndAfter: true,
    },
    records,
  };
}

async function assertFrozenSourceUnchanged(source: FrozenSource): Promise<void> {
  const final = await assertCleanHead(source.evidence.commit);
  if (canonicalize(final.evidence) !== canonicalize(source.evidence)) {
    throw new Error("clean HEAD source identity changed during collection");
  }
}

function chromeLaunchArguments(debuggerPort: number, profilePath: string): string[] {
  return [
    ...FIXED_CHROME_ARGUMENTS,
    `--remote-debugging-port=${debuggerPort}`,
    `--user-data-dir=${profilePath}`,
    "about:blank",
  ];
}

export function parseTextOracle(text: string, variant: string) {
  const target = text.match(/^Target: (.+)$/m)?.[1];
  const completeOutputDigest = text.match(/^Complete output digest: ([a-f0-9]{16})$/m)?.[1];
  const quantizedStateDigest = text.match(/^Quantized state digest: ([a-f0-9]{16})$/m)?.[1];
  const checkpointsText = text.match(/^Checkpoints: ([0-9, ]+)$/m)?.[1];
  const energy = text.match(/^Energy relative drift: ([0-9.eE+-]+) \(limit ([0-9.eE+-]+)\)$/m);
  const countersText = text.slice(text.indexOf("Counters:\n") + "Counters:\n".length);
  if (
    target !== variant || completeOutputDigest !== expectedDigests.completeOutputDigest ||
    quantizedStateDigest !== expectedDigests.quantizedStateDigest || !checkpointsText || !energy ||
    !text.includes("Counters:\n")
  ) throw new Error("text result omitted or changed the exact oracle");
  const checkpoints = checkpointsText.split(",").map((value) => Number(value.trim()));
  if (JSON.stringify(checkpoints) !== JSON.stringify(CHECKPOINT_STEPS)) {
    throw new Error("text result checkpoints differ from the accepted contract");
  }
  const counters = JSON.parse(countersText) as Record<string, number>;
  const expectedCounters = {
    ...COUNTERS,
    allocations: variant === "js-controlled" ? 5 : 0,
    boundaryCrossings: variant === "js-controlled" ? 0 : 2,
  };
  if (
    Object.keys(counters).sort().join("\0") !== Object.keys(expectedCounters).sort().join("\0") ||
    Object.entries(expectedCounters).some(([name, value]) => counters[name] !== value)
  ) throw new Error("text result counters differ from the 14-counter accepted contract");
  const relativeDrift = Number(energy[1]), tolerance = Number(energy[2]);
  if (!Number.isFinite(relativeDrift) || relativeDrift < 0 || tolerance !== 0.0000012) {
    throw new Error("text result energy oracle differs from the accepted contract");
  }
  return {
    rendering: "text-only",
    variantId: variant,
    completeOutputDigest,
    quantizedStateDigest,
    checkpoints,
    energy: { relativeDrift, tolerance },
    counters,
    counterCount: Object.keys(counters).length,
    text,
    textSha256: "",
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

async function cgroupPath(unit: string): Promise<string> {
  const deadline = Date.now() + 5_000;
  let path = "";
  while (Date.now() < deadline) {
    try {
      path = await commandText("systemctl", [
        "--user",
        "show",
        `${unit}.scope`,
        "--property=ControlGroup",
        "--value",
      ]);
      if (path) break;
    } catch {
      // The systemd scope registration can briefly lag the spawned command.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (!/^\/user\.slice\/[^\0\r\n]+\/wasm-nbody-[a-z]+-[a-f0-9-]+\.scope$/.test(path)) {
    throw new Error(`owned cgroup path was not exact: ${path}`);
  }
  return path;
}

async function cgroupIdentity(path: string): Promise<CgroupIdentity> {
  const info = await Deno.lstat(`/sys/fs/cgroup${path}`);
  if (!info.isDirectory || info.isSymlink) {
    throw new Error(`owned cgroup is not an exact directory: ${path}`);
  }
  return { path, dev: Number(info.dev), ino: Number(info.ino) };
}

async function cgroupProcesses(path: string): Promise<ProcessIdentity[]> {
  const pids = (await Deno.readTextFile(`/sys/fs/cgroup${path}/cgroup.procs`))
    .trim().split("\n").filter(Boolean).map(Number);
  const identities = (await Promise.all(pids.map(processIdentity))).filter(
    (identity): identity is ProcessIdentity => identity !== null,
  );
  return identities.sort((a, b) => a.pid - b.pid);
}

async function processCgroupPath(pid: number): Promise<string | null> {
  const rows = (await Deno.readTextFile(`/proc/${pid}/cgroup`)).trim().split("\n");
  const unified = rows.find((row) => row.startsWith("0::"));
  return unified ? unified.slice(3) : null;
}

async function listenerOwnership(
  port: number,
  cgroup: CgroupIdentity,
): Promise<ListenerIdentity> {
  const currentCgroup = await cgroupIdentity(cgroup.path);
  if (currentCgroup.dev !== cgroup.dev || currentCgroup.ino !== cgroup.ino) {
    throw new Error("owned browser cgroup identity changed before CDP use");
  }
  const local = `0100007F:${port.toString(16).toUpperCase().padStart(4, "0")}`;
  const fields = (await Deno.readTextFile("/proc/net/tcp")).trim().split("\n").slice(1)
    .map((line) => line.trim().split(/\s+/));
  const listeners = fields.filter((row) => row[1] === local && row[3] === "0A");
  if (listeners.length !== 1) {
    throw new Error("Chrome CDP listener is not unique on owned loopback port");
  }
  const inode = listeners[0][9];
  const owners: ProcessIdentity[] = [];
  for (const identity of await cgroupProcesses(cgroup.path)) {
    try {
      for await (const entry of Deno.readDir(`/proc/${identity.pid}/fd`)) {
        const target = await Deno.readLink(`/proc/${identity.pid}/fd/${entry.name}`).catch(() =>
          ""
        );
        if (target === `socket:[${inode}]`) owners.push(identity);
      }
    } catch {
      // A process that disappeared cannot own the still-live listener.
    }
  }
  if (owners.length !== 1 || await processCgroupPath(owners[0].pid) !== cgroup.path) {
    throw new Error("Chrome CDP listener is not owned by exactly one process in its frozen cgroup");
  }
  return { address: "127.0.0.1", inode, owner: owners[0] };
}

function sameProcess(left: ProcessIdentity, right: ProcessIdentity): boolean {
  return left.pid === right.pid && left.parentPid === right.parentPid &&
    left.startTimeTicks === right.startTimeTicks && left.executable === right.executable;
}

async function revalidateListener(
  expected: ListenerIdentity,
  port: number,
  cgroup: CgroupIdentity,
): Promise<void> {
  const current = await listenerOwnership(port, cgroup);
  if (current.inode !== expected.inode || !sameProcess(current.owner, expected.owner)) {
    throw new Error("Chrome CDP listener owner changed before browser navigation");
  }
}

async function cgroupAbsent(path: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await Deno.lstat(`/sys/fs/cgroup${path}`);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return true;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function killScope(unit: string, signal: "SIGTERM" | "SIGKILL"): Promise<void> {
  const output = await new Deno.Command("systemctl", {
    args: ["--user", "kill", "--kill-whom=all", `--signal=${signal}`, `${unit}.scope`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const stderr = new TextDecoder().decode(output.stderr);
  if (!output.success && !stderr.includes("not loaded")) {
    throw new Error(`failed to kill owned cgroup ${unit}.scope: ${stderr.trim()}`);
  }
}

async function scopeInactive(unit: string): Promise<boolean> {
  const output = await new Deno.Command("systemctl", {
    args: ["--user", "is-active", `${unit}.scope`],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const state = new TextDecoder().decode(output.stdout).trim();
  return !output.success && ["inactive", "failed", "unknown"].includes(state);
}

async function waitForScopeInactive(unit: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await scopeInactive(unit)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function waitForPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} status did not resolve`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function scopedCommand(unit: string, executable: string, args: string[], options: {
  cwd?: string | URL;
  env?: Record<string, string>;
}) {
  return new Deno.Command("systemd-run", {
    cwd: options.cwd,
    env: options.env,
    args: [
      "--user",
      "--scope",
      "--quiet",
      `--unit=${unit}`,
      "--property=KillMode=control-group",
      "--",
      executable,
      ...args,
    ],
    stdout: "null",
    stderr: "null",
  }).spawn();
}

async function click(client: CdpClient, sessionId: string, selector: string): Promise<void> {
  const evaluated = await client.send("Runtime.evaluate", {
    expression: `(() => { const node = document.querySelector(${
      JSON.stringify(selector)
    }); const r = node.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:node.disabled}; })()`,
    returnByValue: true,
  }, sessionId);
  const point = (evaluated.result as { value: { x: number; y: number; disabled: boolean } }).value;
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
  const evaluated = await client.send("Runtime.evaluate", {
    expression:
      `(() => ({status:document.querySelector('#status').textContent.trim(),result:document.querySelector('#result').textContent,startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled}))()`,
    returnByValue: true,
  }, sessionId);
  return (evaluated.result as { value: Record<string, unknown> }).value;
}

async function waitForState(
  client: CdpClient,
  sessionId: string,
  predicate: (state: Record<string, unknown>) => boolean,
  timeoutMs = 35_000,
) {
  const deadline = Date.now() + timeoutMs;
  let state: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    state = await pageState(client, sessionId);
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`browser state timeout: ${JSON.stringify(state)}`);
}

async function accessibilityEvidence(client: CdpClient, sessionId: string) {
  const factsResult = await client.send("Runtime.evaluate", {
    expression:
      `(() => ({language:document.documentElement.lang,main:Boolean(document.querySelector('main#content')),heading:document.querySelector('h1')?.textContent.trim(),targetLabel:document.querySelector('label[for=target]')?.textContent.trim(),startName:document.querySelector('#start')?.textContent.trim(),cancelName:document.querySelector('#cancel')?.textContent.trim(),statusRole:document.querySelector('#status')?.getAttribute('role'),statusLive:document.querySelector('#status')?.getAttribute('aria-live'),resultTabIndex:document.querySelector('#result')?.tabIndex}))()`,
    returnByValue: true,
  }, sessionId);
  const facts = (factsResult.result as { value: Record<string, unknown> }).value;
  const tree = await client.send("Accessibility.getFullAXTree", {}, sessionId);
  const nodes = (tree.nodes as Array<Record<string, unknown>>) ?? [];
  const axValues = nodes.map((node) => ({
    role: String((node.role as { value?: unknown })?.value ?? ""),
    name: String((node.name as { value?: unknown })?.value ?? ""),
  }));
  const assertions = {
    languageEnglish: facts.language === "en",
    mainLandmark: facts.main === true && axValues.some((node) => node.role === "main"),
    namedHeading: facts.heading === "Direct N-body leapfrog validation" &&
      axValues.some((node) => node.role === "heading" && node.name === facts.heading),
    labelledTarget: facts.targetLabel === "Engine" &&
      axValues.some((node) => node.role === "combobox" && node.name === "Engine"),
    namedControls: facts.startName === "Start" && facts.cancelName === "Cancel" &&
      axValues.some((node) => node.role === "button" && node.name === "Start") &&
      axValues.some((node) => node.role === "button" && node.name === "Cancel"),
    liveStatus: facts.statusRole === "status" && facts.statusLive === "polite",
    keyboardResult: facts.resultTabIndex === 0,
  };
  if (Object.values(assertions).some((value) => !value)) {
    throw new Error(`accessibility assertion failed: ${JSON.stringify(assertions)}`);
  }
  return { inspectedAxNodes: nodes.length, assertions };
}

function outputPaths(output: string, scenarioId: string) {
  const separator = output.lastIndexOf("/");
  const directory = separator < 0 ? "." : output.slice(0, separator);
  const basename = output.slice(separator + 1).replace(/\.json$/u, "");
  return {
    directory,
    screenshotDirectory: `${directory}/${basename}.screenshots`,
    screenshot: `${directory}/${basename}.screenshots/${scenarioId}.png`,
  };
}

async function collectScenario(
  client: CdpClient,
  origin: string,
  scenario: Scenario,
  output: string,
  frozenRecords: ReadonlyMap<string, { bytes: number; sha256: string }>,
  debuggerPort: number,
  listener: ListenerIdentity,
  browserCgroup: CgroupIdentity,
) {
  const created = await client.send("Target.createTarget", { url: "about:blank" });
  const targetId = String(created.targetId);
  const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = String(attached.sessionId);
  const observedSessions = new Set([sessionId]);
  const attachTasks: Promise<void>[] = [];
  const responseTasks: Promise<void>[] = [];
  const requests = new Map<string, NetworkRecord>();
  const requestViolations: string[] = [];
  const executedAssets = new Map<string, Record<string, unknown>>();
  const consoleMessages: Array<Record<string, unknown>> = [];
  const exceptions: Array<Record<string, unknown>> = [];
  const key = (eventSession: string | undefined, requestId: unknown) =>
    `${eventSession ?? ""}:${String(requestId)}`;
  const removers = [
    client.on("Target.attachedToTarget", (params, eventSession) => {
      if (eventSession !== sessionId) return;
      const targetInfo = params.targetInfo as Record<string, unknown>;
      if (targetInfo.type !== "worker") return;
      const workerSession = String(params.sessionId);
      observedSessions.add(workerSession);
      attachTasks.push((async () => {
        await Promise.all([
          client.send("Network.enable", {}, workerSession),
          client.send("Network.setCacheDisabled", { cacheDisabled: true }, workerSession),
          client.send("Runtime.enable", {}, workerSession),
        ]);
        await client.send("Runtime.runIfWaitingForDebugger", {}, workerSession);
      })());
    }),
    client.on("Runtime.consoleAPICalled", (params, eventSession) => {
      if (!eventSession || !observedSessions.has(eventSession)) return;
      consoleMessages.push({
        session: eventSession === sessionId ? "page" : "worker",
        type: String(params.type),
        arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((arg) =>
          String(arg.value ?? arg.description ?? arg.type)
        ),
      });
    }),
    client.on("Runtime.exceptionThrown", (params, eventSession) => {
      if (!eventSession || !observedSessions.has(eventSession)) return;
      const details = params.exceptionDetails as Record<string, unknown>;
      exceptions.push({
        session: eventSession === sessionId ? "page" : "worker",
        text: String(details.text),
        lineNumber: Number(details.lineNumber),
      });
    }),
    client.on("Network.requestWillBeSent", (params, eventSession) => {
      if (!eventSession || !observedSessions.has(eventSession)) return;
      const requestKey = key(eventSession, params.requestId);
      if (requests.has(requestKey) || params.redirectResponse) {
        requestViolations.push("redirect or duplicate request identity");
      }
      const request = params.request as Record<string, unknown>;
      requests.set(requestKey, {
        requestId: String(params.requestId),
        sessionId: eventSession,
        url: String(request.url),
        method: String(request.method),
        type: String(params.type),
        status: null,
        mimeType: null,
        fromDiskCache: false,
        fromServiceWorker: false,
        failed: false,
        errorText: null,
      });
    }),
    client.on("Network.responseReceived", (params, eventSession) => {
      const record = requests.get(key(eventSession, params.requestId));
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
      const record = requests.get(key(eventSession, params.requestId));
      if (record) Object.assign(record, { failed: true, errorText: String(params.errorText) });
    }),
    client.on("Network.loadingFinished", (params, eventSession) => {
      const record = requests.get(key(eventSession, params.requestId));
      if (!record || !eventSession) return;
      let route: string;
      try {
        route = new URL(record.url).pathname;
      } catch {
        return;
      }
      const sourcePath = EXECUTED_ROUTE_PATHS[route];
      if (!sourcePath) return;
      responseTasks.push((async () => {
        const response = await client.send(
          "Network.getResponseBody",
          { requestId: String(params.requestId) },
          eventSession,
        );
        const body = String(response.body);
        const bytes = response.base64Encoded
          ? Uint8Array.from(atob(body), (character) => character.charCodeAt(0))
          : new TextEncoder().encode(body);
        const frozen = frozenRecords.get(sourcePath);
        const digest = await sha256Hex(bytes);
        if (!frozen || bytes.byteLength !== frozen.bytes || digest !== frozen.sha256) {
          throw new Error(`served response bytes differ from frozen commit: ${route}`);
        }
        executedAssets.set(route, {
          route,
          sourcePath,
          bytes: bytes.byteLength,
          sha256: digest,
          cdpBodyEncoding: response.base64Encoded ? "base64" : "utf8",
        });
      })());
    }),
  ];
  try {
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
      client.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId),
      client.send("Accessibility.enable", {}, sessionId),
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
    await revalidateListener(listener, debuggerPort, browserCgroup);
    await client.send("Page.navigate", { url: `${origin}${workloadRoute}` }, sessionId);
    await loaded;
    await waitForState(
      client,
      sessionId,
      (state) => String(state.status) === "Ready. The worker stops after 30 seconds.",
    );
    await client.send("Runtime.evaluate", {
      expression: `(() => { const select=document.querySelector('#target'); select.value=${
        JSON.stringify(scenario.target)
      }; select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
    }, sessionId);

    const lifecycleInjection = scenario.action === "complete"
      ? { kind: "none", expression: null }
      : scenario.action === "timeout"
      ? {
        kind: "timeout-shortening",
        expression:
          `(() => { const native=globalThis.setTimeout; globalThis.setTimeout=(callback,delay,...args)=>native(callback,delay===30000?1:delay,...args); })()`,
      }
      : scenario.action === "pagehide"
      ? {
        kind: "pagehide-dispatch",
        expression: `dispatchEvent(new PageTransitionEvent('pagehide'))`,
      }
      : { kind: "visible-cancel-control", expression: null };
    if (scenario.action === "timeout") {
      await client.send(
        "Runtime.evaluate",
        { expression: lifecycleInjection.expression! },
        sessionId,
      );
    }
    await click(client, sessionId, "#start");
    let finalState: Record<string, unknown>;
    if (scenario.action === "complete") {
      finalState = await waitForState(
        client,
        sessionId,
        (state) => state.status === "Complete. Correctness output only; no duration was collected.",
      );
    } else if (scenario.action === "cancel") {
      await waitForState(client, sessionId, (state) => String(state.status).startsWith("Running "));
      await click(client, sessionId, "#cancel");
      finalState = await waitForState(
        client,
        sessionId,
        (state) => state.status === "Cancelled. The worker was terminated.",
      );
    } else if (scenario.action === "timeout") {
      finalState = await waitForState(
        client,
        sessionId,
        (state) => state.status === "Stopped after the 30-second correctness timeout.",
      );
    } else {
      await waitForState(client, sessionId, (state) => String(state.status).startsWith("Running "));
      await client.send(
        "Runtime.evaluate",
        { expression: lifecycleInjection.expression! },
        sessionId,
      );
      finalState = await waitForState(
        client,
        sessionId,
        (state) => state.startDisabled === false && state.cancelDisabled === true,
      );
    }
    await Promise.all(attachTasks);
    const requiredAssets = SCENARIO_ROUTE_PATHS[scenario.id];
    const networkDeadline = Date.now() + 2_000;
    while (
      Date.now() < networkDeadline &&
      ([...requests.values()].some((request) => request.status === null && !request.failed) ||
        requiredAssets.some((route) => !executedAssets.has(route)))
    ) await new Promise((resolve) => setTimeout(resolve, 25));
    await Promise.all(responseTasks);

    if (exceptions.length || consoleMessages.some((message) => message.type === "error")) {
      throw new Error(`${scenario.id} produced console errors or exceptions`);
    }
    const network = [...requests.values()].map((
      { requestId: _requestId, sessionId: _sessionId, ...r },
    ) => r);
    if (
      requestViolations.length > 0 || network.some((request) => {
        const url = new URL(request.url);
        return request.failed || request.status !== 200 || request.fromServiceWorker ||
          request.fromDiskCache || request.method !== "GET" || url.origin !== origin ||
          request.url !== `${origin}${url.pathname}` || !(url.pathname in EXECUTED_ROUTE_PATHS);
      })
    ) {
      throw new Error(
        `${scenario.id} had foreign, unknown, cached, failed, non-GET, non-200, or Service Worker traffic`,
      );
    }
    const expectedRoster = [...requiredAssets].sort();
    const networkRoster = network.map((request) => new URL(request.url).pathname).sort();
    const executionRoster = [...executedAssets.keys()].sort();
    if (
      JSON.stringify(networkRoster) !== JSON.stringify(expectedRoster) ||
      JSON.stringify(executionRoster) !== JSON.stringify(expectedRoster)
    ) {
      throw new Error(
        `${scenario.id} network/execution roster was not the exact unique scenario roster`,
      );
    }

    let oracle = null;
    if (scenario.action === "complete") {
      oracle = parseTextOracle(String(finalState.result), scenario.target);
      oracle.textSha256 = await sha256Hex(new TextEncoder().encode(oracle.text));
      for (const route of requiredAssets) {
        if (!executedAssets.has(route)) throw new Error(`executed response body absent: ${route}`);
      }
    } else if (String(finalState.result) !== "No completed result.") {
      throw new Error(`${scenario.id} exposed a result after lifecycle termination`);
    }

    const accessibility = await accessibilityEvidence(client, sessionId);
    const screenshotResult = await client.send(
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
      atob(String(screenshotResult.data)),
      (character) => character.charCodeAt(0),
    );
    const paths = outputPaths(output, scenario.id);
    await Deno.mkdir(paths.screenshotDirectory, { recursive: true });
    await Deno.writeFile(paths.screenshot, screenshotBytes, { createNew: true });
    return {
      ...scenario,
      route: workloadRoute,
      cdpBoundBeforeNavigation: true,
      lifecycleInjection,
      finalState,
      oracle,
      console: consoleMessages,
      exceptions,
      network,
      executedAssets: [...executedAssets.values()].sort((a, b) =>
        String(a.route).localeCompare(String(b.route))
      ),
      accessibility,
      screenshot: {
        path: paths.screenshot,
        bytes: screenshotBytes.byteLength,
        sha256: await sha256Hex(screenshotBytes),
      },
    };
  } finally {
    for (const remove of removers) remove();
    await client.send("Target.closeTarget", { targetId });
  }
}

async function runCollector() {
  const options = Object.fromEntries(
    Deno.args.map((argument) => {
      const match = argument.match(/^--([a-z-]+)=(.+)$/u);
      if (!match) throw new Error(`invalid argument: ${argument}`);
      return [match[1], match[2]];
    }),
  );
  if (
    Deno.args.length !== 3 || !/^[a-f0-9]{40}$/.test(options["source-commit"] ?? "") ||
    !options.chrome || !options.output || !options.output.endsWith(".json")
  ) {
    throw new Error(
      "usage: collect-base-simulation-nbody-evidence.ts --source-commit=<clean HEAD> --chrome=<path> --output=<new .json path>",
    );
  }
  const output = options.output;
  const outputUrl = new URL(output, new URL(`file://${Deno.cwd()}/`));
  if (outputUrl.href.startsWith(root.href)) {
    throw new Error("output must be outside the frozen source checkout");
  }
  const generatedPaths = outputPaths(output, "unused");
  for (const path of [output, generatedPaths.screenshotDirectory]) {
    try {
      await Deno.lstat(path);
      throw new Error("output already exists; browser evidence is immutable");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  const source = await assertCleanHead(options["source-commit"]);
  const buildManifest = JSON.parse(
    await Deno.readTextFile(
      new URL("public/artifacts/base-simulation-nbody/build-manifest.json", root),
    ),
  );
  if (!/^[a-f0-9]{40}$/.test(buildManifest.source.commit)) {
    throw new Error("accepted static build manifest source commit is invalid");
  }
  const chromeExecutable = await Deno.realPath(options.chrome);
  const chromeIdentity = await fileRecord(chromeExecutable);
  const executableInfo = await Deno.stat(chromeExecutable);
  if (!executableInfo.isFile) throw new Error("Chrome executable is not a regular file");
  if (chromeIdentity.sha256 !== CFT_EXECUTABLE_SHA256) {
    throw new Error("collector requires the approved Chrome for Testing executable SHA-256");
  }

  const serverPort = unusedPort(), debuggerPort = unusedPort();
  const origin = `http://127.0.0.1:${serverPort}`;
  const nonce = crypto.randomUUID();
  const serverUnit = `wasm-nbody-server-${nonce}`;
  const browserUnit = `wasm-nbody-browser-${nonce}`;
  let server: Deno.ChildProcess | null = null;
  let serverStatus: Promise<Deno.CommandStatus> | null = null;
  let serverCgroup: CgroupIdentity | null = null;
  let browserProcess: Deno.ChildProcess | null = null;
  let browserStatus: Promise<Deno.CommandStatus> | null = null;
  let browserCgroup: CgroupIdentity | null = null;
  let profilePath: string | null = null;
  let profileIdentity: { dev: number; ino: number } | null = null;
  let client: CdpClient | null = null;
  let completed = false;
  let collectionError: unknown = null;
  let failureCleanupError: Error | null = null;
  try {
    server = scopedCommand(
      serverUnit,
      Deno.execPath(),
      [
        "run",
        "--allow-env=PORT,HOST,SERVER_MODE",
        "--allow-net=127.0.0.1",
        "--allow-read=.",
        "deploy.ts",
      ],
      {
        cwd: root,
        env: { PORT: String(serverPort), HOST: "127.0.0.1", SERVER_MODE: "public" },
      },
    );
    serverStatus = server.status;
    await waitFor(`${origin}/healthz`);
    serverCgroup = await cgroupIdentity(await cgroupPath(serverUnit));

    profilePath = await Deno.makeTempDir({ prefix: "wasm-nbody-chrome-" });
    const profileInfo = await Deno.lstat(profilePath);
    if ([...Deno.readDirSync(profilePath)].length !== 0 || profileInfo.isSymlink) {
      throw new Error("owned Chrome profile was not a new empty directory");
    }
    profileIdentity = { dev: Number(profileInfo.dev), ino: Number(profileInfo.ino) };
    const launchArguments = chromeLaunchArguments(debuggerPort, profilePath);
    browserProcess = scopedCommand(browserUnit, chromeExecutable, launchArguments, {});
    browserStatus = browserProcess.status;
    browserCgroup = await cgroupIdentity(await cgroupPath(browserUnit));
    let cdpListener: ListenerIdentity | null = null;
    const listenerDeadline = Date.now() + 10_000;
    while (!cdpListener && Date.now() < listenerDeadline) {
      try {
        cdpListener = await listenerOwnership(debuggerPort, browserCgroup);
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    if (!cdpListener || cdpListener.owner.executable !== chromeExecutable) {
      throw new Error("owned Chrome CDP listener was not bound to the inspected executable/cgroup");
    }
    const discovery = await (await waitFor(`http://127.0.0.1:${debuggerPort}/json/version`)).json();
    const websocket = new URL(String(discovery.webSocketDebuggerUrl));
    if (
      websocket.protocol !== "ws:" || websocket.hostname !== "127.0.0.1" ||
      Number(websocket.port) !== debuggerPort ||
      !/^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(websocket.pathname)
    ) throw new Error("Chrome CDP endpoint escaped the exact owned loopback endpoint");
    client = new CdpClient(websocket.href);
    await client.ready();
    await revalidateListener(cdpListener, debuggerPort, browserCgroup);
    const version = await client.send("Browser.getVersion");
    if (version.product !== CFT_PRODUCT) {
      throw new Error(`collector requires exact Chrome for Testing ${CFT_PRODUCT}`);
    }
    const commandLine = await client.send("Browser.getBrowserCommandLine");
    if (!Array.isArray(commandLine.arguments)) throw new Error("Chrome effective argv unavailable");
    if (
      JSON.stringify(commandLine.arguments) !==
        JSON.stringify([chromeExecutable, ...launchArguments])
    ) {
      throw new Error("Chrome effective argv differs from the exact approved launch arguments");
    }

    const records = [];
    for (const scenario of SCENARIOS) {
      records.push(
        await collectScenario(
          client,
          origin,
          scenario,
          output,
          source.records,
          debuggerPort,
          cdpListener,
          browserCgroup,
        ),
      );
    }
    await revalidateListener(cdpListener, debuggerPort, browserCgroup);
    const observedProcesses = await cgroupProcesses(browserCgroup.path);
    const launcher = observedProcesses.find((identity) => sameProcess(identity, cdpListener.owner));
    if (!launcher) {
      throw new Error("owned Chrome listener/launcher identity changed before cleanup");
    }
    await client.send("Browser.close");
    client.close();
    client = null;
    const signals: Array<{ signal: string }> = [];
    if (!(await cgroupAbsent(browserCgroup.path, 10_000))) {
      await killScope(browserUnit, "SIGTERM");
      signals.push({ signal: "SIGTERM" });
    }
    if (!(await cgroupAbsent(browserCgroup.path, 5_000))) {
      await killScope(browserUnit, "SIGKILL");
      signals.push({ signal: "SIGKILL" });
    }
    const processesAbsent = await cgroupAbsent(browserCgroup.path, 5_000);
    const browserExit = await browserStatus;
    if (!processesAbsent) throw new Error("owned Chrome cgroup survived exact cleanup");
    const chromeAfter = await fileRecord(chromeExecutable);
    if (
      chromeAfter.bytes !== chromeIdentity.bytes || chromeAfter.sha256 !== chromeIdentity.sha256
    ) throw new Error("Chrome executable bytes changed across collection");
    const currentProfile = await Deno.lstat(profilePath);
    if (
      !profileIdentity || currentProfile.isSymlink ||
      Number(currentProfile.dev) !== profileIdentity.dev ||
      Number(currentProfile.ino) !== profileIdentity.ino
    ) throw new Error("owned Chrome profile identity changed before cleanup");
    await Deno.remove(profilePath, { recursive: true });
    let profileAbsent = false;
    try {
      await Deno.lstat(profilePath);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) profileAbsent = true;
      else throw error;
    }
    if (!profileAbsent) throw new Error("owned Chrome profile survived cleanup");

    const serverProcesses = await cgroupProcesses(serverCgroup.path);
    const serverLaunchers = serverProcesses.filter((identity) =>
      identity.executable === Deno.execPath()
    );
    if (serverLaunchers.length !== 1) {
      throw new Error("owned evidence server launcher identity changed before cleanup");
    }
    const serverIdentity = serverLaunchers[0];
    await killScope(serverUnit, "SIGTERM");
    const serverExit = await serverStatus;
    const serverAbsent = await cgroupAbsent(serverCgroup.path, 5_000);
    if (!serverAbsent) throw new Error("owned evidence server cgroup survived exact cleanup");
    await assertFrozenSourceUnchanged(source);

    const evidence = {
      schemaVersion: 1,
      evidenceId: "simulation-nbody-browser-correctness-v1",
      collectedAt: new Date().toISOString(),
      workloadId: "simulation.nbody-cloth.v1",
      performanceClaims: [],
      source: {
        ...source.evidence,
        acceptedStaticSourceCommit: buildManifest.source.commit,
      },
      collectionCommand:
        `deno run -A scripts/collect-base-simulation-nbody-evidence.ts --source-commit=${source.evidence.commit} --chrome=${options.chrome} --output=${output}`,
      browser: {
        product: String(version.product),
        revision: String(version.revision),
        userAgent: String(version.userAgent),
        jsVersion: String(version.jsVersion),
        executable: {
          path: chromeExecutable,
          bytes: chromeIdentity.bytes,
          sha256: chromeIdentity.sha256,
          dev: Number(executableInfo.dev),
          ino: Number(executableInfo.ino),
        },
        channel: "chrome-for-testing",
        effectiveLaunchArguments: launchArguments,
        headless: true,
        protocol: "Chrome DevTools Protocol",
        ownership: {
          launcher: {
            pid: launcher.pid,
            parentPid: launcher.parentPid,
            startTimeTicks: launcher.startTimeTicks,
            cdpListener: {
              inode: cdpListener.inode,
              boundBeforeConnection: true,
              boundBeforeEveryNavigation: true,
            },
          },
          otherObservedProcesses: observedProcesses.filter((identity) =>
            !sameProcess(identity, launcher)
          ),
          cgroup: {
            ...browserCgroup,
            membership: "all processes in the dedicated systemd scope",
          },
        },
      },
      server: {
        origin,
        mode: "public",
        launcher: serverIdentity,
        otherObservedProcesses: serverProcesses.filter((identity) =>
          !sameProcess(identity, serverIdentity)
        ),
        cgroup: {
          ...serverCgroup,
          membership: "all processes in the dedicated systemd scope",
        },
      },
      contract: {
        targets: [...VARIANTS],
        timesteps: TIMESTEPS,
        checkpoints: [...CHECKPOINT_STEPS],
        counterCount: 14,
        output: "text-only",
        excluded: {
          cloth: {
            status: "unavailable",
            reason: "The independently accepted implementation contract explicitly excludes cloth.",
          },
          rendering: {
            status: "unavailable",
            reason:
              "The route exposes a textual correctness oracle only; its acceptance screenshot is not benchmark rendering evidence.",
          },
        },
      },
      scenarios: records,
      cleanup: {
        browser: {
          requested: "Browser.close",
          signals,
          exit: browserExit,
          processesAbsent,
          cgroupAbsent: processesAbsent,
        },
        profile: { removed: true, absent: profileAbsent },
        server: {
          signal: "SIGTERM",
          exit: serverExit,
          processAbsent: serverAbsent,
          cgroupAbsent: serverAbsent,
        },
      },
    };
    const outputDirectory = output.slice(0, output.lastIndexOf("/")) || ".";
    await Deno.mkdir(outputDirectory, { recursive: true });
    await Deno.writeTextFile(output, `${canonicalize(evidence)}\n`, { createNew: true });
    completed = true;
    console.log(`simulation N-body browser evidence: ${records.length} scenarios; exact cleanup`);
  } catch (error) {
    collectionError = error;
  } finally {
    if (!completed) {
      const cleanupFailures: string[] = [];
      const attempt = async (label: string, operation: () => Promise<void>) => {
        try {
          await operation();
        } catch (error) {
          cleanupFailures.push(
            `${label}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      };
      if (client) {
        await attempt("Browser.close", async () => {
          await client!.send("Browser.close");
        });
        try {
          client.close();
        } catch (error) {
          cleanupFailures.push(
            `CDP socket close: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        client = null;
      }

      if (browserProcess) {
        await attempt("browser SIGTERM", () => killScope(browserUnit, "SIGTERM"));
        let absent = browserCgroup
          ? await cgroupAbsent(browserCgroup.path, 2_000)
          : await waitForScopeInactive(browserUnit, 2_000);
        if (!absent) {
          await attempt("browser SIGKILL", () => killScope(browserUnit, "SIGKILL"));
          absent = browserCgroup
            ? await cgroupAbsent(browserCgroup.path, 2_000)
            : await waitForScopeInactive(browserUnit, 2_000);
        }
        if (!absent) cleanupFailures.push("owned browser scope/cgroup survived failure cleanup");
        if (browserStatus) {
          await attempt("browser status", async () => {
            await waitForPromise(browserStatus!, 2_000, "browser");
          });
        }
      }

      if (server) {
        await attempt("server SIGTERM", () => killScope(serverUnit, "SIGTERM"));
        let absent = serverCgroup
          ? await cgroupAbsent(serverCgroup.path, 2_000)
          : await waitForScopeInactive(serverUnit, 2_000);
        if (!absent) {
          await attempt("server SIGKILL", () => killScope(serverUnit, "SIGKILL"));
          absent = serverCgroup
            ? await cgroupAbsent(serverCgroup.path, 2_000)
            : await waitForScopeInactive(serverUnit, 2_000);
        }
        if (!absent) cleanupFailures.push("owned server scope/cgroup survived failure cleanup");
        if (serverStatus) {
          await attempt("server status", async () => {
            await waitForPromise(serverStatus!, 2_000, "server");
          });
        }
      }

      if (profilePath) {
        await attempt("profile removal", async () => {
          let current: Deno.FileInfo | null = null;
          try {
            current = await Deno.lstat(profilePath!);
          } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) throw error;
          }
          if (current) {
            if (
              !profileIdentity || current.isSymlink ||
              Number(current.dev) !== profileIdentity.dev ||
              Number(current.ino) !== profileIdentity.ino
            ) throw new Error("owned profile identity changed; refusing unsafe removal");
            await Deno.remove(profilePath!, { recursive: true });
          }
          try {
            await Deno.lstat(profilePath!);
            throw new Error("owned profile survived removal");
          } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) throw error;
          }
        });
      }

      for (
        const [label, path, recursive] of [
          ["partial evidence output", output, false],
          ["partial screenshot output", generatedPaths.screenshotDirectory, true],
        ] as const
      ) {
        await attempt(label, async () => {
          try {
            await Deno.remove(path, { recursive });
          } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) throw error;
          }
          try {
            await Deno.lstat(path);
            throw new Error(`${path} survived removal`);
          } catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) throw error;
          }
        });
      }
      if (cleanupFailures.length) {
        failureCleanupError = new Error(
          `collector failure cleanup was not exact: ${cleanupFailures.join("; ")}`,
        );
      }
    }
  }
  if (failureCleanupError) {
    throw new AggregateError(
      [collectionError, failureCleanupError].filter((error) => error !== null),
      "collection failed and exact cleanup could not be established",
    );
  }
  if (collectionError) throw collectionError;
}

if (import.meta.main) await runCollector();

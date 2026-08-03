// Authoritative parent-run collector. Implementation workers must not launch Chrome.
import Ajv2020Module from "ajv2020";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  BrowserClient,
  ChromeLaunchLifecycleError,
  closeOwnedChrome,
  launchOwnedChrome,
  OwnedChrome,
} from "../lib/owned-chrome.ts";
import {
  ChromePackageInspection,
  inspectChromePackage,
  recordStageCleanupLifecycle,
  removeStagedChrome,
  stageChromePackage,
  StagedChrome,
} from "../lib/chrome-stage.ts";
import { refreshLedger } from "../lib/process-ledger.ts";

export const ACCEPTED_IMPLEMENTATION_COMMIT = "05d7135ee84839fdb2a70aee7e0769468d58f74f";
export const EXACT_CHROME_PRODUCT = "Chrome/150.0.7871.24";
export const EXACT_CHROME_SHA256 =
  "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
export const EXACT_CHROME_PACKAGE_MANIFEST_SHA256 =
  "e3d5088a5244a494b206819630d4eb2d7e3ee999d1a04cab9d2d95d0daf292db";
export const WORKLOAD_ID = "tooling.c-to-wasm-compile.v1";
export const ROUTE = "/benchmarks/tooling-c-to-wasm-compile-v1/";
export const SCENARIO_IDS = [
  "compiler-corpus",
  "visible-javascript-01",
  "visible-wasm-01",
  "lifecycle-wrong-token",
  "lifecycle-stale-error",
  "lifecycle-restart",
  "lifecycle-cancel",
  "lifecycle-timeout",
  "lifecycle-pagehide",
] as const;
export const TARGETS = ["javascript-controlled", "wasm-self-hosted-controlled"] as const;
export const COUNTER_FIELDS = [
  "sourceBytes",
  "headerBytes",
  "tokens",
  "astNodes",
  "functions",
  "instructions",
  "linkSections",
  "vfsReads",
  "allocations",
  "boundaryCrossings",
  "outputBytes",
] as const;

const root = new URL("../", import.meta.url);
const rootPath = await Deno.realPath(root);
const chromePackageManifestUrl = new URL(
  "evidence/collectors/chrome-for-testing-150.0.7871.24-linux64-package-manifest.json",
  root,
);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const EXECUTED_SOURCE_PATHS = [
  "scripts/collect-base-tooling-c-to-wasm-compile-evidence.ts",
  "scripts/remove-owned-file.py",
  "scripts/remove-owned-tree.py",
  "scripts/write-stage-owner.py",
  "lib/canonical.ts",
  "lib/cdp-client.ts",
  "lib/chrome-stage.ts",
  "lib/corpus-contracts.ts",
  "lib/owned-chrome.ts",
  "lib/process-ledger.ts",
  "lib/stage-lifecycle.ts",
  "server.ts",
  "deploy.ts",
  "deno.json",
  "deno.corpus.json",
  "deno.lock",
  "schemas/base-tooling-c-to-wasm-compile-browser-evidence.schema.json",
  "public/benchmarks/tooling-c-to-wasm-compile-v1/index.html",
  "public/benchmarks/tooling-c-to-wasm-compile-v1/demo.js",
  "public/benchmarks/tooling-c-to-wasm-compile-v1/worker.js",
  "public/styles.css",
  "benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
  "benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.c",
  "benchmarks/base/tooling-c-to-wasm-compile/contract.v1.json",
  "benchmarks/base/tooling-c-to-wasm-compile/negative-fixtures.v1.json",
  "public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
  "public/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json",
  "public/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json",
  "public/evidence/base/tooling-c-to-wasm-compile/validation.json",
  ...Array.from({ length: 20 }, (_, index) => {
    const id = String(index + 1).padStart(2, "0");
    return [
      `benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`,
      `benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`,
    ];
  }).flat(),
  "evidence/collectors/chrome-for-testing-150.0.7871.24-linux64-package-manifest.json",
] as const;

export const ACCEPTED_PACKAGE_PATHS = [
  "benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
  "benchmarks/base/tooling-c-to-wasm-compile/compiler-wasm.c",
  "benchmarks/base/tooling-c-to-wasm-compile/contract.v1.json",
  "benchmarks/base/tooling-c-to-wasm-compile/negative-fixtures.v1.json",
  "public/benchmarks/tooling-c-to-wasm-compile-v1/index.html",
  "public/benchmarks/tooling-c-to-wasm-compile-v1/demo.js",
  "public/benchmarks/tooling-c-to-wasm-compile-v1/worker.js",
  "public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
  "public/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json",
  "public/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json",
  "public/evidence/base/tooling-c-to-wasm-compile/validation.json",
  ...Array.from({ length: 20 }, (_, index) => {
    const id = String(index + 1).padStart(2, "0");
    return [
      `benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`,
      `benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`,
    ];
  }).flat(),
] as const;

export const EXECUTABLE_ROUTES: Readonly<Record<string, string>> = {
  "/benchmarks/tooling-c-to-wasm-compile-v1/demo.js":
    "public/benchmarks/tooling-c-to-wasm-compile-v1/demo.js",
  "/benchmarks/tooling-c-to-wasm-compile-v1/worker.js":
    "public/benchmarks/tooling-c-to-wasm-compile-v1/worker.js",
  "/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js":
    "benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
};

export type CollectorArguments = { sourceCommit: string; chrome: string; output: string };
type Json = Record<string, unknown>;
type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
type CommandResult = { success: boolean; stdout: Uint8Array; stderr: Uint8Array };
type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;
type ProcessIdentity = {
  pid: number;
  parentPid: number;
  startTimeTicks: string;
  executable: string;
};
type ArtifactPayload = { path: string; bytes: Uint8Array };
type Sender = Pick<BrowserClient, "send" | "on">;

const runCommand: CommandRunner = async (command, args) => {
  const result = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return { success: result.success, stdout: result.stdout, stderr: result.stderr };
};

export function parseCollectorArguments(argv: readonly string[]): CollectorArguments {
  const allowed = ["source-commit", "chrome", "output"];
  const values = new Map<string, string>();
  for (const argument of argv) {
    const match = argument.match(/^--([a-z-]+)=(.+)$/);
    if (!match || !allowed.includes(match[1]) || values.has(match[1])) {
      throw new Error(`unknown or duplicate collector argument: ${argument}`);
    }
    values.set(match[1], match[2]);
  }
  if (values.size !== 3) throw new Error("all three exact collector arguments are required");
  const parsed = {
    sourceCommit: values.get("source-commit")!,
    chrome: values.get("chrome")!,
    output: values.get("output")!,
  };
  if (!/^[a-f0-9]{40}$/.test(parsed.sourceCommit)) throw new Error("invalid source commit");
  if (!parsed.chrome.startsWith("/") || !parsed.output.startsWith("/")) {
    throw new Error("Chrome and output paths must be absolute");
  }
  if (parsed.output === rootPath || parsed.output.startsWith(`${rootPath}/`)) {
    throw new Error("browser evidence output must be outside the source root");
  }
  return parsed;
}

async function gitBytes(revision: string, path: string, command = runCommand): Promise<Uint8Array> {
  const result = await command("git", ["show", `${revision}:${path}`]);
  if (!result.success) throw new Error(`git source unavailable: ${revision}:${path}`);
  return result.stdout;
}

export async function attestFrozenSource(
  sourceCommit: string,
  phase: "start" | "end",
  command: CommandRunner = runCommand,
): Promise<Json> {
  const head = await command("git", ["rev-parse", "HEAD"]);
  const tree = await command("git", ["rev-parse", `${sourceCommit}^{tree}`]);
  const status = await command("git", [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  const ancestor = await command("git", [
    "merge-base",
    "--is-ancestor",
    ACCEPTED_IMPLEMENTATION_COMMIT,
    sourceCommit,
  ]);
  if (
    !head.success || decoder.decode(head.stdout).trim() !== sourceCommit || !tree.success ||
    !status.success || status.stdout.byteLength !== 0 || !ancestor.success
  ) throw new Error(`${phase} source is not the exact clean accepted-implementation descendant`);
  const files = [];
  for (const path of EXECUTED_SOURCE_PATHS) {
    const local = await Deno.readFile(new URL(path, root));
    const committed = await gitBytes(sourceCommit, path, command);
    if (await sha256Hex(local) !== await sha256Hex(committed)) {
      throw new Error(`${phase} executed source differs from ${sourceCommit}:${path}`);
    }
    files.push({ path, bytes: local.byteLength, sha256: await sha256Hex(local) });
  }
  const acceptedFiles = [];
  for (const path of ACCEPTED_PACKAGE_PATHS) {
    const local = await Deno.readFile(new URL(path, root));
    const accepted = await gitBytes(ACCEPTED_IMPLEMENTATION_COMMIT, path, command);
    if (await sha256Hex(local) !== await sha256Hex(accepted)) {
      throw new Error(`${phase} accepted compiler package drifted at ${path}`);
    }
    acceptedFiles.push({ path, bytes: local.byteLength, sha256: await sha256Hex(local) });
  }
  return {
    phase,
    commit: sourceCommit,
    tree: decoder.decode(tree.stdout).trim(),
    clean: true,
    statusPorcelainSha256: await sha256Hex(status.stdout),
    acceptedImplementationCommit: ACCEPTED_IMPLEMENTATION_COMMIT,
    files,
    acceptedFiles,
  };
}

function same(left: unknown, right: unknown): boolean {
  return canonicalize(left) === canonicalize(right);
}
async function readPinnedChromePackageManifest(): Promise<ChromePackageInspection> {
  const manifest = JSON.parse(await Deno.readTextFile(chromePackageManifestUrl));
  if (
    manifest.schemaVersion !== 2 || manifest.binaryRelativePath !== "chrome" ||
    manifest.binarySha256 !== EXACT_CHROME_SHA256 ||
    manifest.manifestSha256 !== EXACT_CHROME_PACKAGE_MANIFEST_SHA256
  ) throw new Error("pinned Chrome for Testing package manifest identity changed");
  return manifest as ChromePackageInspection;
}
function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < value.length; offset += 0x8000) {
    binary += String.fromCharCode(...value.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
function value(response: Json): unknown {
  const details = response.exceptionDetails;
  if (details) throw new Error(`browser evaluation failed: ${JSON.stringify(details)}`);
  return (response.result as { value?: unknown }).value;
}
async function evaluate(client: Sender, sessionId: string, expression: string): Promise<unknown> {
  return value(
    await client.send(
      "Runtime.evaluate",
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId,
      30_000,
    ),
  );
}
async function click(client: Sender, sessionId: string, selector: string): Promise<void> {
  const point = await evaluate(
    client,
    sessionId,
    `(() => { const node=document.querySelector(${
      JSON.stringify(selector)
    }); const box=node.getBoundingClientRect(); return {x:box.left+box.width/2,y:box.top+box.height/2,disabled:node.disabled}; })()`,
  ) as { x: number; y: number; disabled: boolean };
  if (point.disabled) throw new Error(`visible control disabled: ${selector}`);
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
async function pageState(client: Sender, sessionId: string): Promise<Json> {
  return await evaluate(
    client,
    sessionId,
    `(() => ({
    status:document.querySelector('#status')?.textContent.trim(),
    result:document.querySelector('#result')?.textContent,
    startDisabled:document.querySelector('#start')?.disabled,
    cancelDisabled:document.querySelector('#cancel')?.disabled,
    program:document.querySelector('#program')?.value,
    target:document.querySelector('#target')?.value,
    workerAudit:globalThis.__compilerCollector?.summary?.() ?? []
  }))()`,
  ) as Json;
}
async function waitState(
  client: Sender,
  sessionId: string,
  predicate: (state: Json) => boolean,
  timeoutMs = 30_000,
): Promise<Json> {
  const deadline = Date.now() + timeoutMs;
  let state: Json = {};
  while (Date.now() < deadline) {
    state = await pageState(client, sessionId);
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`browser state timeout: ${JSON.stringify(state)}`);
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
function unusedPort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}
async function waitFor(url: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "error" });
      if (response.ok) return;
    } catch { /* bounded loopback readiness probe */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`loopback server did not become ready: ${url}`);
}

export async function assertCorpusSemantics(
  corpus: Json,
  fixtureManifest: Json,
  validation: Json,
  negativeFixtures: Json,
): Promise<void> {
  if (!same(corpus.counterFields, COUNTER_FIELDS)) throw new Error("counter field order changed");
  const fixtureEntries = fixtureManifest.entries as Json[];
  const expectedResults = validation.results as Json[];
  const programs = corpus.programs as Json[];
  if (programs.length !== 20 || fixtureEntries.length !== 20 || expectedResults.length !== 20) {
    throw new Error("all 20 frozen programs are required");
  }
  for (let index = 0; index < 20; index += 1) {
    const program = programs[index],
      fixture = fixtureEntries[index],
      expected = expectedResults[index];
    const id = String(index + 1).padStart(2, "0");
    if (program.id !== id || fixture.id !== id || expected.id !== id) {
      throw new Error(`program order/identity changed at ${id}`);
    }
    for (const target of TARGETS) {
      const actual = program[target] as Json;
      const expectedCounters = expected[
        target === "javascript-controlled" ? "jsCounters" : "wasmCounters"
      ];
      const wasm = base64ToBytes(String(actual.wasmBase64));
      if (
        actual.outputSha256 !== expected.outputSha256 ||
        actual.outputBytes !== expected.outputBytes || actual.testResult !== expected.testResult ||
        !same(actual.counters, expectedCounters) || wasm.byteLength !== expected.outputBytes ||
        await sha256Hex(wasm) !== expected.outputSha256
      ) throw new Error(`${target}/${id} exact output, oracle, counters, or raw Wasm changed`);
    }
    const js = program["javascript-controlled"] as Json;
    const wasm = program["wasm-self-hosted-controlled"] as Json;
    if (js.wasmBase64 !== wasm.wasmBase64) {
      throw new Error(`compiler generated bytes differ for ${id}`);
    }
  }
  const expectedNegatives = negativeFixtures.cases as Json[];
  const negatives = corpus.negatives as Json[];
  if (negatives.length !== expectedNegatives.length || negatives.length !== 9) {
    throw new Error("complete frozen negative corpus is required");
  }
  for (let index = 0; index < negatives.length; index += 1) {
    const actual = negatives[index], expected = expectedNegatives[index];
    if (
      actual.id !== expected.id || actual.reason !== expected.reason ||
      actual.javascriptRejected !== true || !(Number(actual.wasmReturn) < 0)
    ) throw new Error(`negative fixture did not fail closed: ${expected.id}`);
  }
  if (
    corpus.outputSetSha256 !== validation.outputSetSha256 ||
    corpus.compilerArtifactSha256 !==
      (JSON.parse(String(corpus.buildManifestText)).artifact as Json).sha256
  ) throw new Error("corpus manifest identity changed");
}

const LIFECYCLE_WORKER_URL = "/benchmarks/tooling-c-to-wasm-compile-v1/worker.js";
function expectedWorker(index: number, token: number, terminated: boolean): Json {
  return {
    index,
    url: LIFECYCLE_WORKER_URL,
    terminated,
    posted: [{ token, target: "javascript", program: "01" }],
  };
}
function expectedLifecycleState(
  status: string,
  workerAudit: Json[],
  active: boolean,
): Json {
  return {
    status,
    result: "No result yet.",
    startDisabled: active,
    cancelDisabled: !active,
    program: "01",
    target: "javascript",
    workerAudit,
  };
}
function expectedLifecycleSemantics(id: string): Json {
  const worker0Active = expectedWorker(0, 1, false);
  const worker0Stopped = expectedWorker(0, 1, true);
  const running = expectedLifecycleState("Compiling…", [worker0Active], true);
  const start = {
    sequence: 0,
    event: "visible-start",
    workerIndex: 0,
    token: 1,
    detail: "visible Start created the first instrumented worker",
  };
  const workerTerminated = "worker-terminated";
  if (id === "lifecycle-wrong-token") {
    return {
      causes: [
        start,
        {
          sequence: 1,
          event: "wrong-token",
          workerIndex: 0,
          token: 999,
          detail: "collector injected a completion with a non-current token",
        },
      ],
      snapshots: [
        { label: "running", state: running },
        { label: "wrong-token-ignored", state: running },
      ],
      finalState: expectedLifecycleState("Cancelled.", [worker0Stopped], false),
      assertions: ["wrong-token-ignored", workerTerminated],
    };
  }
  if (id === "lifecycle-stale-error" || id === "lifecycle-restart") {
    const worker1Active = expectedWorker(1, 2, false);
    const worker1Stopped = expectedWorker(1, 2, true);
    const causes: Json[] = [
      start,
      {
        sequence: 1,
        event: "restart",
        workerIndex: 1,
        token: 2,
        detail: "submit handler cleaned the prior worker and created a replacement",
      },
    ];
    if (id === "lifecycle-stale-error") {
      causes.push({
        sequence: 2,
        event: "stale-error",
        workerIndex: 0,
        token: 1,
        detail: "collector invoked the prior worker error callback",
      });
    }
    return {
      causes,
      snapshots: [
        { label: "running", state: running },
        {
          label: "replacement-active",
          state: expectedLifecycleState(
            "Compiling…",
            [worker0Stopped, worker1Active],
            true,
          ),
        },
      ],
      finalState: expectedLifecycleState(
        "Cancelled.",
        [worker0Stopped, worker1Stopped],
        false,
      ),
      assertions: id === "lifecycle-stale-error"
        ? ["prior-worker-terminated", "stale-error-ignored", workerTerminated]
        : ["prior-worker-terminated", "replacement-worker-active", workerTerminated],
    };
  }
  const finalStatus = id === "lifecycle-cancel"
    ? "Cancelled."
    : id === "lifecycle-timeout"
    ? "Stopped after the 20 second limit."
    : id === "lifecycle-pagehide"
    ? "Compiling…"
    : null;
  if (finalStatus === null) throw new Error(`unknown lifecycle scenario: ${id}`);
  const cause = id === "lifecycle-cancel"
    ? {
      sequence: 1,
      event: "cancel",
      workerIndex: 0,
      token: 1,
      detail: "visible Cancel terminated the current worker",
    }
    : id === "lifecycle-timeout"
    ? {
      sequence: 1,
      event: "timeout",
      workerIndex: 0,
      token: 1,
      detail: "exact 20000 ms callback fired under accelerated lifecycle clock",
    }
    : {
      sequence: 1,
      event: "pagehide",
      workerIndex: 0,
      token: 1,
      detail: "collector dispatched pagehide",
    };
  const late = id === "lifecycle-cancel"
    ? {
      sequence: 2,
      event: "late-completion",
      workerIndex: 0,
      token: 1,
      detail: "collector injected a completion after cancellation",
    }
    : null;
  return {
    causes: late ? [start, cause, late] : [start, cause],
    snapshots: [
      { label: "running", state: running },
      {
        label: "late-message-ignored",
        state: expectedLifecycleState(finalStatus, [worker0Stopped], false),
      },
    ],
    finalState: expectedLifecycleState(finalStatus, [worker0Stopped], false),
    assertions: id === "lifecycle-cancel"
      ? ["cancelled", "late-message-ignored", workerTerminated]
      : id === "lifecycle-timeout"
      ? ["timeout-fired", "late-message-ignored", workerTerminated]
      : ["pagehide-fired", "late-message-ignored", workerTerminated],
  };
}

export async function assertEvidenceSemantics(
  evidence: Json,
  fixtureManifest: Json,
  validation: Json,
  negativeFixtures: Json,
): Promise<void> {
  const source = evidence.source as Json;
  const start = source.start as Json, end = source.end as Json;
  const { phase: _startPhase, ...startIdentity } = start;
  const { phase: _endPhase, ...endIdentity } = end;
  if (
    source.unchanged !== true || start.phase !== "start" || end.phase !== "end" ||
    !same(startIdentity, endIdentity) ||
    start.statusPorcelainSha256 !==
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  ) throw new Error("start/end frozen source attestation is contradictory");
  const collector = evidence.collector as Json;
  const parsedCommand = parseCollectorArguments(collector.command as string[]);
  if (parsedCommand.sourceCommit !== start.commit) {
    throw new Error("collector command/source commit binding changed");
  }
  const browser = evidence.browser as Json;
  const pinnedChromePackage = await readPinnedChromePackageManifest();
  if (
    browser.product !== EXACT_CHROME_PRODUCT || browser.expectedProduct !== EXACT_CHROME_PRODUCT ||
    (browser.executable as Json).sha256 !== EXACT_CHROME_SHA256 ||
    browser.expectedSha256 !== EXACT_CHROME_SHA256 ||
    !same(browser.package, pinnedChromePackage)
  ) throw new Error("exact Chrome for Testing package input changed");
  const configured = browser.configuredArguments as string[];
  const effective = browser.effectiveArguments as string[];
  const exactStatic = [
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--headless=new",
    "--enable-automation",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--metrics-recording-only",
    "--hide-scrollbars",
    "--window-size=1440,1200",
    "--force-device-scale-factor=1",
    "about:blank",
  ];
  const ownership = browser.ownership as Json;
  const commandLine = ownership.commandLine as string[];
  if (
    configured.length !== 20 || !configured[0].startsWith("--user-data-dir=") ||
    !same(configured.slice(1), exactStatic) ||
    configured.some((argument) => effective.filter((item) => item === argument).length !== 1) ||
    commandLine[0] !== (browser.executable as Json).path ||
    !same(commandLine.slice(1), configured)
  ) throw new Error("configured/effective/owned Chrome argument contract changed");
  const scenarios = evidence.scenarios as Json[];
  if (!same(scenarios.map((scenario) => scenario.id), SCENARIO_IDS)) {
    throw new Error("scenario order or denominator changed");
  }
  await assertCorpusSemantics(
    scenarios[0].corpus as Json,
    fixtureManifest,
    validation,
    negativeFixtures,
  );
  for (const scenario of scenarios) {
    const sessions = scenario.sessions as Json[];
    const ids = new Set(sessions.map((session) => session.sessionId));
    if (
      sessions.length < 1 || sessions[0].kind !== "page" || sessions[0].ownerSessionId !== null ||
      sessions.slice(1).some((session) => session.ownerSessionId !== sessions[0].sessionId) ||
      (String(scenario.id).startsWith("visible-") &&
        !sessions.some((session) => session.kind === "worker"))
    ) throw new Error(`${scenario.id} CDP session ownership is incomplete`);
    for (
      const entry of [
        ...(scenario.network as Json[]),
        ...(scenario.console as Json[]),
        ...(scenario.exceptions as Json[]),
      ]
    ) {
      if (!ids.has(entry.sessionId)) throw new Error(`${scenario.id} event escaped owned sessions`);
    }
    for (const entry of scenario.network as Json[]) {
      const body = entry.body as Json, raw = base64ToBytes(String(body?.base64));
      if (
        entry.method !== "GET" || entry.status !== 200 || entry.failed !== false ||
        entry.fromDiskCache !== false || entry.fromServiceWorker !== false ||
        raw.byteLength !== body.bytes || await sha256Hex(raw) !== body.sha256
      ) throw new Error(`${scenario.id} network evidence is incomplete, failed, or altered`);
    }
    if ((scenario.exceptions as Json[]).length !== 0) {
      throw new Error(`${scenario.id} retained an uncaught runtime exception`);
    }
    const assets = scenario.executedAssets as Json[];
    for (const asset of assets) {
      const raw = base64ToBytes(String(asset.base64));
      const expected = await expectedFile(String(asset.route));
      if (
        !ids.has(asset.sessionId) || raw.byteLength !== asset.bytes ||
        await sha256Hex(raw) !== asset.sha256 || raw.byteLength !== expected.bytes.byteLength ||
        await sha256Hex(raw) !== await sha256Hex(expected.bytes) ||
        asset.sourcePath !== expected.path
      ) throw new Error(`${scenario.id} raw executed script bytes changed`);
    }
    const expectedAssetRoutes = scenario.id === "compiler-corpus"
      ? [
        "/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
        "/benchmarks/tooling-c-to-wasm-compile-v1/demo.js",
      ]
      : String(scenario.id).startsWith("visible-")
      ? Object.keys(EXECUTABLE_ROUTES).sort()
      : ["/benchmarks/tooling-c-to-wasm-compile-v1/demo.js"];
    if (!same(assets.map((asset) => asset.route).sort(), expectedAssetRoutes)) {
      throw new Error(`${scenario.id} executed asset denominator changed`);
    }
    if (scenario.id === "compiler-corpus") {
      const asset = scenario.executedWasm as Json, raw = base64ToBytes(String(asset.base64));
      if (
        asset.sha256 !== "ba3948eeb4a56194a458276ed8c0693f5f54bf8baf2d3179afe4df8a6ce89124" ||
        raw.byteLength !== asset.bytes || await sha256Hex(raw) !== asset.sha256
      ) throw new Error("raw executed compiler Wasm bytes changed");
      const requiredFetched: Record<string, string> = {
        "/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js":
          "benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
        "/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm":
          "public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
        "/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json":
          "public/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json",
        "/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json":
          "public/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json",
        "/evidence/base/tooling-c-to-wasm-compile/validation.json":
          "public/evidence/base/tooling-c-to-wasm-compile/validation.json",
      };
      for (let index = 1; index <= 20; index += 1) {
        const id = String(index).padStart(2, "0");
        requiredFetched[`/benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`] =
          `benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`;
        requiredFetched[`/benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`] =
          `benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`;
      }
      for (const [route, path] of Object.entries(requiredFetched)) {
        const expected = await Deno.readFile(new URL(path, root));
        const matches = (scenario.network as Json[]).filter((entry) =>
          new URL(String(entry.url)).pathname === route
        );
        if (
          matches.length !== 1 || (matches[0].body as Json).bytes !== expected.byteLength ||
          (matches[0].body as Json).sha256 !== await sha256Hex(expected)
        ) throw new Error(`compiler corpus fetched input denominator changed: ${route}`);
      }
    }
    const ax = scenario.accessibility as Json;
    if ((ax.checks as boolean[]).some((check) => check !== true)) {
      throw new Error(`${scenario.id} accessibility gate failed`);
    }
    for (const artifact of [ax.artifact as Json, scenario.screenshot as Json]) {
      if (!(Number(artifact.bytes) > 0) || !/^[a-f0-9]{64}$/.test(String(artifact.sha256))) {
        throw new Error(`${scenario.id} retained artifact identity missing`);
      }
    }
  }
  for (const index of [1, 2]) {
    const parsed = JSON.parse(String(scenarios[index].rawResultText));
    const expected = (validation.results as Json[])[0];
    const expectedTarget = index === 1 ? "javascript" : "wasm";
    const expectedCounters = expected[index === 1 ? "jsCounters" : "wasmCounters"];
    if (
      parsed.target !== expectedTarget || parsed.program !== "01" ||
      parsed.outputSha256 !== expected.outputSha256 ||
      parsed.outputBytes !== expected.outputBytes ||
      parsed.testResult !== expected.testResult || !same(parsed.counters, expectedCounters)
    ) throw new Error(`${scenarios[index].id} visible result changed`);
  }
  for (const scenario of scenarios.slice(3)) {
    const expected = expectedLifecycleSemantics(String(scenario.id));
    if (
      !same(scenario.causes, expected.causes) ||
      !same(scenario.snapshots, expected.snapshots) ||
      !same(scenario.finalState, expected.finalState) ||
      !same(scenario.assertions, expected.assertions)
    ) {
      throw new Error(
        `${scenario.id} lifecycle causes, snapshots, worker audit, tokens, or final state changed`,
      );
    }
  }
  const cleanup = evidence.cleanup as Json, cleanedBrowser = cleanup.browser as Json;
  if (
    cleanedBrowser.cgroupEmpty !== true || !same(cleanedBrowser.remainingPids, []) ||
    cleanedBrowser.unit !== ownership.unit ||
    cleanedBrowser.controlGroup !== ownership.controlGroup ||
    cleanedBrowser.cgroupPath !== ownership.cgroupPath ||
    cleanedBrowser.cgroupDev !== ownership.cgroupDev ||
    cleanedBrowser.cgroupIno !== ownership.cgroupIno ||
    cleanedBrowser.invocationId !== ownership.invocationId ||
    cleanedBrowser.mainPid !== ownership.mainPid ||
    (cleanup.profile as Json).path !== (browser.profile as Json).profileRoot ||
    (cleanup.profile as Json).absent !== true || (cleanup.server as Json).processAbsent !== true ||
    (cleanup.stage as Json).absent !== true
  ) throw new Error("exact owned cleanup is incomplete or belongs to another launch");
}

const lifecycleInstrumentation = `(() => {
  const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
  const workers = [];
  class CollectorWorker {
    constructor(url, options) { this.url=String(url); this.options=options; this.terminated=false; this.posted=[]; this.onmessage=null; this.onerror=null; workers.push(this); }
    postMessage(message) { this.posted.push(structuredClone(message)); }
    terminate() { this.terminated=true; }
    emit(message) { this.onmessage?.({data:structuredClone(message)}); }
    fail() { this.onerror?.(new Error('collector injected stale error')); }
  }
  globalThis.Worker = CollectorWorker;
  globalThis.setTimeout = (callback, delay, ...args) => nativeSetTimeout(callback, delay === 20000 ? 80 : delay, ...args);
  globalThis.__compilerCollector = {
    workers,
    emit(index, message) { workers[index].emit(message); },
    fail(index) { workers[index].fail(); },
    summary() { return workers.map((worker, index) => ({index,url:worker.url,terminated:worker.terminated,posted:structuredClone(worker.posted)})); }
  };
})()`;

const wasmInstrumentation = `(() => {
  const nativeInstantiate = WebAssembly.instantiate.bind(WebAssembly);
  const inputs = [];
  WebAssembly.instantiate = async (source, imports) => {
    if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
      const bytes = source instanceof ArrayBuffer ? new Uint8Array(source) : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
      let binary=''; for (let offset=0; offset<bytes.length; offset+=32768) binary+=String.fromCharCode(...bytes.subarray(offset, offset+32768));
      inputs.push(btoa(binary));
    }
    return await nativeInstantiate(source, imports);
  };
  globalThis.__compilerWasmInputs = inputs;
})()`;

function corpusProbeExpression(negativeFixtures: Json): string {
  return `(async () => {
    const bytes = async (path) => { const response=await fetch(path,{cache:'no-store'}); if(!response.ok) throw new Error(path+' '+response.status); return new Uint8Array(await response.arrayBuffer()); };
    const text = async (path) => new TextDecoder('utf-8',{fatal:true}).decode(await bytes(path));
    const b64 = (value) => { let binary=''; for(let offset=0;offset<value.length;offset+=32768) binary+=String.fromCharCode(...value.subarray(offset,offset+32768)); return btoa(binary); };
    const hash = async (value) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', value))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const [compilerModule, fixtureResponse, validationResponse, buildText] = await Promise.all([
      import('/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js'),
      fetch('/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json',{cache:'no-store'}),
      fetch('/evidence/base/tooling-c-to-wasm-compile/validation.json',{cache:'no-store'}),
      text('/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json')
    ]);
    const fixture=await fixtureResponse.json(), validation=await validationResponse.json(), negative=${
    JSON.stringify(negativeFixtures)
  };
    const compilerBytes=await bytes('/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm');
    const compiler=await WebAssembly.instantiate(compilerBytes,{}), exports=compiler.instance.exports, memory=exports.memory;
    const counterFields=${JSON.stringify(COUNTER_FIELDS)};
    const exportName=(field)=>'counter_'+field.replaceAll(/([A-Z])/g,'_$1').toLowerCase();
    const programs=[];
    for (const entry of fixture.entries) {
      const [sourceBytes,headerBytes]=await Promise.all([bytes('/'+entry.source.path),bytes('/'+entry.header.path)]);
      const source=new TextDecoder('utf-8',{fatal:true}).decode(sourceBytes), header=new TextDecoder('utf-8',{fatal:true}).decode(headerBytes);
      const js=compilerModule.compileC(source,header), view=new Uint8Array(memory.buffer);
      view.fill(0,131072,204800); view.set(sourceBytes,196608); view.set(headerBytes,200704);
      const length=Number(exports.compile_c(196608,sourceBytes.length,200704,headerBytes.length,131072,4096));
      if(length<=0) throw new Error('Wasm compiler rejected '+entry.id);
      const wasm=view.slice(131072,131072+length), jsInstance=await WebAssembly.instantiate(js.bytes,{}), wasmInstance=await WebAssembly.instantiate(wasm,{});
      const jsResult={outputSha256:await hash(js.bytes),outputBytes:js.bytes.length,testResult:Number(jsInstance.instance.exports.test()),counters:js.counters,wasmBase64:b64(js.bytes)};
      const wasmResult={outputSha256:await hash(wasm),outputBytes:wasm.length,testResult:Number(wasmInstance.instance.exports.test()),counters:Object.fromEntries(counterFields.map(field=>[field,Number(exports[exportName(field)]())])),wasmBase64:b64(wasm)};
      programs.push({id:entry.id,'javascript-controlled':jsResult,'wasm-self-hosted-controlled':wasmResult});
    }
    const negatives=[];
    for (const item of negative.cases) {
      let javascriptRejected=false; try { compilerModule.compileC(item.source,item.header); } catch { javascriptRejected=true; }
      const sourceBytes=new TextEncoder().encode(item.source),headerBytes=new TextEncoder().encode(item.header),view=new Uint8Array(memory.buffer);
      view.fill(0,131072,204800); view.set(sourceBytes,196608); view.set(headerBytes,200704);
      const wasmReturn=Number(exports.compile_c(196608,sourceBytes.length,200704,headerBytes.length,131072,4096));
      negatives.push({id:item.id,reason:item.reason,javascriptRejected,wasmReturn});
    }
    return {counterFields,programs,negatives,outputSetSha256:validation.outputSetSha256,compilerArtifactSha256:await hash(compilerBytes),buildManifestText:buildText,executedWasmInputs:globalThis.__compilerWasmInputs};
  })()`;
}

async function expectedFile(route: string): Promise<{ bytes: Uint8Array; path: string }> {
  const path = EXECUTABLE_ROUTES[route];
  if (!path) throw new Error(`unexpected executable route: ${route}`);
  return { bytes: await Deno.readFile(new URL(path, root)), path };
}

async function captureScenario(
  owned: OwnedChrome,
  origin: string,
  id: (typeof SCENARIO_IDS)[number],
  fixtureManifest: Json,
  validation: Json,
  negativeFixtures: Json,
): Promise<{ record: Json; artifacts: ArtifactPayload[] }> {
  const client = owned.browser;
  const created = await client.send("Target.createTarget", { url: "about:blank" });
  const targetId = String(created.targetId);
  const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const pageSession = String(attached.sessionId);
  const sessions = new Map<string, Json>([[pageSession, {
    sessionId: pageSession,
    targetId,
    kind: "page",
    ownerSessionId: null,
    url: "about:blank",
  }]]);
  const network = new Map<string, Json>();
  const consoleEntries: Json[] = [], exceptions: Json[] = [], tasks: Promise<void>[] = [];
  const fetchedBodies = new Map<string, Uint8Array>();
  const executedScripts = new Map<
    string,
    { bytes: Uint8Array; method: string; sessionId: string }
  >();
  const removers = [
    client.on("Target.attachedToTarget", (params, ownerSession) => {
      if (ownerSession !== pageSession) return;
      const info = params.targetInfo as Json;
      if (info.type !== "worker") return;
      const sessionId = String(params.sessionId);
      sessions.set(sessionId, {
        sessionId,
        targetId: String(info.targetId),
        kind: "worker",
        ownerSessionId: pageSession,
        url: String(info.url),
      });
      tasks.push(
        Promise.all([
          client.send("Runtime.enable", {}, sessionId),
          client.send("Network.enable", {}, sessionId),
          client.send("Debugger.enable", {}, sessionId),
        ]).then(() => client.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId))
          .then(() => client.send("Runtime.runIfWaitingForDebugger", {}, sessionId)).then(() => {}),
      );
    }),
    client.on("Runtime.consoleAPICalled", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      consoleEntries.push({
        sessionId,
        type: String(params.type),
        arguments: ((params.args as Json[]) ?? []).map((argument) =>
          String(argument.value ?? argument.description ?? argument.type)
        ),
      });
    }),
    client.on("Runtime.exceptionThrown", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      const details = params.exceptionDetails as Json;
      exceptions.push({
        sessionId,
        text: String(details.text),
        lineNumber: Number(details.lineNumber),
        columnNumber: Number(details.columnNumber),
      });
    }),
    client.on("Network.requestWillBeSent", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      const request = params.request as Json, requestId = String(params.requestId);
      network.set(`${sessionId}:${requestId}`, {
        sessionId,
        requestId,
        url: String(request.url),
        method: String(request.method),
        resourceType: String(params.type),
        status: null,
        mimeType: null,
        fromDiskCache: false,
        fromServiceWorker: false,
        failed: false,
        errorText: null,
        body: null,
      });
    }),
    client.on("Network.responseReceived", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      const entry = network.get(`${sessionId}:${params.requestId}`),
        response = params.response as Json;
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
      if (!sessionId || !sessions.has(sessionId)) return;
      const entry = network.get(`${sessionId}:${params.requestId}`);
      if (entry) Object.assign(entry, { failed: true, errorText: String(params.errorText) });
    }),
    client.on("Network.loadingFinished", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      const entry = network.get(`${sessionId}:${params.requestId}`);
      if (!entry) return;
      tasks.push((async () => {
        const response = await client.send(
          "Network.getResponseBody",
          { requestId: params.requestId },
          sessionId,
        );
        const bytes = response.base64Encoded
          ? base64ToBytes(String(response.body))
          : encoder.encode(String(response.body));
        entry.body = {
          bytes: bytes.byteLength,
          sha256: await sha256Hex(bytes),
          base64: bytesToBase64(bytes),
        };
        try {
          const url = new URL(String(entry.url));
          if (url.origin === origin) fetchedBodies.set(url.pathname, bytes);
        } catch { /* retained in full network record, not an expected local route */ }
      })());
    }),
    client.on("Debugger.scriptParsed", (params, sessionId) => {
      if (!sessionId || !sessions.has(sessionId)) return;
      let route: string;
      try {
        const url = new URL(String(params.url));
        if (url.origin !== origin) return;
        route = url.pathname;
      } catch {
        return;
      }
      if (!(route in EXECUTABLE_ROUTES)) return;
      tasks.push((async () => {
        const response = await client.send(
          "Debugger.getScriptSource",
          { scriptId: params.scriptId },
          sessionId,
        );
        executedScripts.set(`${sessionId}:${route}`, {
          bytes: encoder.encode(String(response.scriptSource)),
          method: "Debugger.getScriptSource",
          sessionId,
        });
      })());
    }),
  ];
  try {
    await Promise.all([
      client.send("Page.enable", {}, pageSession),
      client.send("Runtime.enable", {}, pageSession),
      client.send("Network.enable", {}, pageSession),
      client.send("Network.setCacheDisabled", { cacheDisabled: true }, pageSession),
      client.send("Network.setBypassServiceWorker", { bypass: true }, pageSession),
      client.send("Debugger.enable", {}, pageSession),
      client.send("Accessibility.enable", {}, pageSession),
      client.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
      }, pageSession),
    ]);
    const lifecycle = id.startsWith("lifecycle-");
    if (lifecycle) {
      await client.send("Page.addScriptToEvaluateOnNewDocument", {
        source: lifecycleInstrumentation,
      }, pageSession);
    } else if (id === "compiler-corpus") {
      await client.send("Page.addScriptToEvaluateOnNewDocument", {
        source: wasmInstrumentation,
      }, pageSession);
    }
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("page load timeout")), 10_000);
      const remove = client.on("Page.loadEventFired", (_params, sessionId) => {
        if (sessionId !== pageSession) return;
        clearTimeout(timer);
        remove();
        resolve();
      });
    });
    await client.send("Page.navigate", {
      url: `${origin}${ROUTE}${lifecycle ? `?collector=${id}` : ""}`,
    }, pageSession);
    await loaded;
    await waitState(client, pageSession, (state) => state.status === "Ready.", 10_000);

    const causes: Json[] = [];
    const snapshots: Json[] = [];
    const assertions: string[] = [];
    let rawResultText: string | null = null;
    let corpus: Json | null = null;
    if (id === "compiler-corpus") {
      corpus = await evaluate(
        client,
        pageSession,
        corpusProbeExpression(negativeFixtures),
      ) as Json;
      await assertCorpusSemantics(corpus, fixtureManifest, validation, negativeFixtures);
      causes.push({
        sequence: 0,
        event: "browser-corpus-probe",
        detail:
          "both compiler implementations compiled 20 frozen source/header pairs and rejected nine negatives",
      });
      assertions.push(
        "20-program-corpus",
        "byte-identical-generated-wasm",
        "exact-oracles",
        "exact-counters",
        "nine-negatives-fail-closed",
      );
    } else if (id === "visible-javascript-01" || id === "visible-wasm-01") {
      const target = id === "visible-javascript-01" ? "javascript" : "wasm";
      await evaluate(
        client,
        pageSession,
        `document.querySelector('#target').value=${
          JSON.stringify(target)
        };document.querySelector('#program').value='01'`,
      );
      await click(client, pageSession, "#start");
      causes.push({
        sequence: 0,
        event: "visible-start",
        workerIndex: 0,
        token: 1,
        detail: `visible Start invoked ${target} program 01`,
      });
      const final = await waitState(client, pageSession, (state) => state.status === "Complete.");
      rawResultText = String(final.result);
      JSON.parse(rawResultText);
      snapshots.push({ label: "complete", state: final });
      causes.push({
        sequence: 1,
        event: "complete",
        workerIndex: 0,
        token: 1,
        detail: "worker result passed its manifest hash and exported test oracle",
      });
      assertions.push(
        "visible-control",
        "complete-result-text",
        "manifest-output-hash",
        "exported-test-oracle",
        "exact-counters",
      );
    } else {
      await click(client, pageSession, "#start");
      causes.push({
        sequence: 0,
        event: "visible-start",
        workerIndex: 0,
        token: 1,
        detail: "visible Start created the first instrumented worker",
      });
      const running = await pageState(client, pageSession);
      snapshots.push({ label: "running", state: running });
      if (id === "lifecycle-wrong-token") {
        await evaluate(
          client,
          pageSession,
          `__compilerCollector.emit(0,{token:999,type:'complete',result:{fabricated:true}})`,
        );
        const after = await pageState(client, pageSession);
        if (after.status !== running.status || after.result !== running.result) {
          throw new Error("wrong token mutated visible state");
        }
        causes.push({
          sequence: 1,
          event: "wrong-token",
          workerIndex: 0,
          token: 999,
          detail: "collector injected a completion with a non-current token",
        });
        snapshots.push({ label: "wrong-token-ignored", state: after });
        assertions.push("wrong-token-ignored");
        await click(client, pageSession, "#cancel");
      } else if (id === "lifecycle-stale-error" || id === "lifecycle-restart") {
        await evaluate(
          client,
          pageSession,
          `document.querySelector('#compiler-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`,
        );
        causes.push({
          sequence: 1,
          event: "restart",
          workerIndex: 1,
          token: 2,
          detail: "submit handler cleaned the prior worker and created a replacement",
        });
        if (id === "lifecycle-stale-error") {
          await evaluate(client, pageSession, `__compilerCollector.fail(0)`);
          causes.push({
            sequence: 2,
            event: "stale-error",
            workerIndex: 0,
            token: 1,
            detail: "collector invoked the prior worker error callback",
          });
          assertions.push("prior-worker-terminated", "stale-error-ignored");
        } else assertions.push("prior-worker-terminated", "replacement-worker-active");
        const replacementActive = await pageState(client, pageSession);
        const restartAudit = replacementActive.workerAudit as Json[];
        if (
          restartAudit.length !== 2 ||
          !same(restartAudit[0], expectedWorker(0, 1, true)) ||
          !same(restartAudit[1], expectedWorker(1, 2, false))
        ) {
          throw new Error(
            `${id} did not separately prove terminated worker 0 and active replacement worker 1`,
          );
        }
        snapshots.push({ label: "replacement-active", state: replacementActive });
        await click(client, pageSession, "#cancel");
      } else if (id === "lifecycle-cancel") {
        await click(client, pageSession, "#cancel");
        const cancelled = await pageState(client, pageSession);
        await evaluate(
          client,
          pageSession,
          `__compilerCollector.emit(0,{token:1,type:'complete',result:{fabricated:true}})`,
        );
        const after = await pageState(client, pageSession);
        if (after.status !== cancelled.status || after.result !== cancelled.result) {
          throw new Error("late completion changed cancelled state");
        }
        causes.push({
          sequence: 1,
          event: "cancel",
          workerIndex: 0,
          token: 1,
          detail: "visible Cancel terminated the current worker",
        });
        causes.push({
          sequence: 2,
          event: "late-completion",
          workerIndex: 0,
          token: 1,
          detail: "collector injected a completion after cancellation",
        });
        snapshots.push({ label: "late-message-ignored", state: after });
        assertions.push("cancelled", "late-message-ignored");
      } else if (id === "lifecycle-timeout") {
        const timed = await waitState(
          client,
          pageSession,
          (state) => state.status === "Stopped after the 20 second limit.",
          2_000,
        );
        await evaluate(
          client,
          pageSession,
          `__compilerCollector.emit(0,{token:1,type:'complete',result:{fabricated:true}})`,
        );
        const after = await pageState(client, pageSession);
        if (after.status !== timed.status || after.result !== timed.result) {
          throw new Error("late completion changed timeout state");
        }
        causes.push({
          sequence: 1,
          event: "timeout",
          workerIndex: 0,
          token: 1,
          detail: "exact 20000 ms callback fired under accelerated lifecycle clock",
        });
        snapshots.push({ label: "late-message-ignored", state: after });
        assertions.push("timeout-fired", "late-message-ignored");
      } else {
        await evaluate(client, pageSession, `dispatchEvent(new PageTransitionEvent('pagehide'))`);
        const hidden = await pageState(client, pageSession);
        await evaluate(
          client,
          pageSession,
          `__compilerCollector.emit(0,{token:1,type:'complete',result:{fabricated:true}})`,
        );
        const after = await pageState(client, pageSession);
        if (after.status !== hidden.status || after.result !== hidden.result) {
          throw new Error("late completion changed pagehide state");
        }
        causes.push({
          sequence: 1,
          event: "pagehide",
          workerIndex: 0,
          token: 1,
          detail: "collector dispatched pagehide",
        });
        snapshots.push({ label: "late-message-ignored", state: after });
        assertions.push("pagehide-fired", "late-message-ignored");
      }
      const summary = await evaluate(
        client,
        pageSession,
        `__compilerCollector.summary()`,
      ) as Json[];
      if (!summary.length || summary.some((worker) => worker.terminated !== true)) {
        throw new Error(`${id} did not terminate every instrumented worker`);
      }
      assertions.push("worker-terminated");
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    await Promise.all(tasks);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await Promise.all(tasks);
    const networkRecords = [...network.values()];
    if (
      exceptions.length ||
      networkRecords.some((entry) =>
        entry.failed !== false || entry.status !== 200 || !(entry.body as Json)?.base64
      )
    ) throw new Error(`${id} browser network or runtime exception gate failed`);

    const executedAssets = [];
    for (const [key, executed] of executedScripts) {
      const route = key.slice(key.indexOf(":") + 1), expected = await expectedFile(route);
      if (
        executed.bytes.byteLength !== expected.bytes.byteLength ||
        await sha256Hex(executed.bytes) !== await sha256Hex(expected.bytes)
      ) throw new Error(`${id} executed script differs from clean HEAD: ${route}`);
      const fetched = fetchedBodies.get(route);
      if (!fetched || await sha256Hex(fetched) !== await sha256Hex(expected.bytes)) {
        throw new Error(`${id} fetched script differs from executed clean HEAD: ${route}`);
      }
      executedAssets.push({
        route,
        sourcePath: expected.path,
        sessionId: executed.sessionId,
        protocolMethod: executed.method,
        bytes: executed.bytes.byteLength,
        sha256: await sha256Hex(executed.bytes),
        base64: bytesToBase64(executed.bytes),
      });
    }
    const requiredScripts = id === "compiler-corpus"
      ? [
        "/benchmarks/tooling-c-to-wasm-compile-v1/demo.js",
        "/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
      ]
      : id.startsWith("visible-")
      ? Object.keys(EXECUTABLE_ROUTES)
      : ["/benchmarks/tooling-c-to-wasm-compile-v1/demo.js"];
    for (const route of requiredScripts) {
      if (!executedAssets.some((asset) => asset.route === route)) {
        throw new Error(`${id} required executed script absent: ${route}`);
      }
    }
    let executedWasm: Json | null = null;
    if (id === "compiler-corpus") {
      const inputs = corpus!.executedWasmInputs as string[];
      const compilerBytes = await Deno.readFile(
        new URL("public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm", root),
      );
      const match = inputs.find((input) => input === bytesToBase64(compilerBytes));
      if (!match) {
        throw new Error("raw compiler Wasm input was not observed at WebAssembly.instantiate");
      }
      executedWasm = {
        route: "/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
        sourcePath: "public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
        sessionId: pageSession,
        protocolMethod: "WebAssembly.instantiate input instrumentation",
        bytes: compilerBytes.byteLength,
        sha256: await sha256Hex(compilerBytes),
        base64: match,
      };
    }

    const ax = await client.send("Accessibility.getFullAXTree", {}, pageSession);
    const nodes = (ax.nodes as Json[]) ?? [], axBytes = encoder.encode(canonicalize(nodes));
    const roles = nodes.map((node) => (node.role as Json | undefined)?.value);
    const names = nodes.map((node) => (node.name as Json | undefined)?.value);
    const axChecks = [
      roles.includes("RootWebArea"),
      roles.includes("main"),
      names.includes("Start"),
      names.includes("Cancel"),
      roles.includes("status"),
      await evaluate(client, pageSession, `document.querySelector('#result').tabIndex===0`) ===
        true,
    ];
    if (axChecks.some((check) => !check)) throw new Error(`${id} accessibility gate failed`);
    const screenshotResult = await client.send(
      "Page.captureScreenshot",
      {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
      },
      pageSession,
      10_000,
    );
    const screenshot = base64ToBytes(String(screenshotResult.data));
    const axPath = `accessibility/${id}.json`, screenshotPath = `screenshots/${id}.png`;
    const finalState = await pageState(client, pageSession);
    return {
      artifacts: [{ path: axPath, bytes: axBytes }, { path: screenshotPath, bytes: screenshot }],
      record: {
        id,
        route: ROUTE,
        mode: id === "compiler-corpus"
          ? "native-browser-corpus"
          : id.startsWith("visible-")
          ? "native-visible-demo"
          : "instrumented-lifecycle",
        sessions: [...sessions.values()],
        causes,
        snapshots,
        finalState,
        rawResultText,
        rawResultTextSha256: rawResultText === null ? null : await sha256Hex(rawResultText),
        corpus,
        assertions,
        console: consoleEntries,
        exceptions,
        network: networkRecords,
        executedAssets,
        executedWasm,
        accessibility: {
          artifact: { path: axPath, bytes: axBytes.byteLength, sha256: await sha256Hex(axBytes) },
          nodeCount: nodes.length,
          checks: axChecks,
        },
        screenshot: {
          path: screenshotPath,
          bytes: screenshot.byteLength,
          sha256: await sha256Hex(screenshot),
        },
      },
    };
  } finally {
    for (const remove of removers) remove();
    await client.send("Target.closeTarget", { targetId }).catch(() => ({}));
  }
}

async function validateOutputPath(path: string): Promise<void> {
  const parent = path.slice(0, path.lastIndexOf("/")) || "/";
  const resolvedParent = await Deno.realPath(parent);
  if (resolvedParent === rootPath || resolvedParent.startsWith(`${rootPath}/`)) {
    throw new Error("output parent must be outside source root");
  }
  try {
    await Deno.lstat(path);
    throw new Error("output path already exists");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

async function main(args: CollectorArguments): Promise<void> {
  if (Deno.version.deno !== "2.9.0") throw new Error("collector requires exact Deno 2.9.0");
  await validateOutputPath(args.output);
  const sourceStart = await attestFrozenSource(args.sourceCommit, "start");
  const fixtureManifest = JSON.parse(
    await Deno.readTextFile(
      new URL("public/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json", root),
    ),
  );
  const validation = JSON.parse(
    await Deno.readTextFile(
      new URL("public/evidence/base/tooling-c-to-wasm-compile/validation.json", root),
    ),
  );
  const negativeFixtures = JSON.parse(
    await Deno.readTextFile(
      new URL("benchmarks/base/tooling-c-to-wasm-compile/negative-fixtures.v1.json", root),
    ),
  );

  let stage: StagedChrome | undefined;
  let serverProcess: Deno.ChildProcess | undefined;
  let serverStatus: Promise<Deno.CommandStatus> | undefined;
  let serverIdentity: ProcessIdentity | null = null;
  let owned: OwnedChrome | undefined;
  let launchFailure: ChromeLaunchLifecycleError | undefined;
  let browserCleanup: Json | undefined,
    serverCleanup: Json | undefined,
    stageCleanup: Json | undefined;
  let effectiveArguments: string[] | undefined;
  let chromePackage: ChromePackageInspection | undefined;
  let records: Json[] | undefined, artifacts: ArtifactPayload[] | undefined;
  let primaryError: unknown;
  try {
    const pinnedChromePackage = await readPinnedChromePackageManifest();
    const inspection = await inspectChromePackage(args.chrome, EXACT_CHROME_SHA256);
    if (!same(inspection, pinnedChromePackage)) {
      throw new Error("supplied Chrome package differs from independently pinned manifest");
    }
    chromePackage = inspection;
    stage = await stageChromePackage(args.chrome, EXACT_CHROME_SHA256, {
      permitId: "tooling-c-to-wasm-browser-evidence-v1",
      sourceCommit: args.sourceCommit,
      chromePackageManifestSha256: EXACT_CHROME_PACKAGE_MANIFEST_SHA256,
    });
    const port = unusedPort(), origin = `http://127.0.0.1:${port}`;
    serverProcess = new Deno.Command(Deno.execPath(), {
      cwd: root,
      args: [
        "run",
        "--allow-env=PORT,HOST,SERVER_MODE",
        "--allow-net=127.0.0.1",
        "--allow-read=.",
        "deploy.ts",
      ],
      env: { PORT: String(port), HOST: "127.0.0.1", SERVER_MODE: "public" },
      stdout: "null",
      stderr: "piped",
    }).spawn();
    serverStatus = serverProcess.status;
    serverIdentity = await processIdentity(serverProcess.pid);
    if (!serverIdentity) throw new Error("owned loopback server identity unavailable");
    await waitFor(`${origin}/healthz`);
    try {
      owned = await launchOwnedChrome({
        stagedChrome: stage,
        profileRoot:
          `/tmp/wasm-vs-js-owned-profiles/tooling-c-to-wasm-${crypto.randomUUID()}/chrome`,
        extraArguments: [
          "--headless=new",
          "--enable-automation",
          "--no-sandbox",
          "--disable-gpu",
          "--disable-background-networking",
          "--disable-component-update",
          "--disable-default-apps",
          "--disable-extensions",
          "--metrics-recording-only",
          "--hide-scrollbars",
          "--window-size=1440,1200",
          "--force-device-scale-factor=1",
        ],
        beforeSpawn: () => recordStageCleanupLifecycle(stage!, "owned-launch-active"),
      });
    } catch (error) {
      if (error instanceof ChromeLaunchLifecycleError) {
        launchFailure = error;
        if (stage.cleanupLifecycle === "owned-launch-active") {
          recordStageCleanupLifecycle(
            stage,
            error.cleanupResolved ? "cleanup-verified" : "cleanup-unresolved",
          );
        }
      }
      throw error;
    }
    if (
      owned.version.product !== EXACT_CHROME_PRODUCT || owned.binarySha256 !== EXACT_CHROME_SHA256
    ) {
      throw new Error("launched Chrome exact product/hash mismatch");
    }
    const effective = await owned.browser.send("Browser.getBrowserCommandLine");
    if (!Array.isArray(effective.arguments)) {
      throw new Error("effective Chrome command line unavailable");
    }
    effectiveArguments = effective.arguments.map(String);
    for (const argument of owned.arguments) {
      if (effectiveArguments.filter((item) => item === argument).length !== 1) {
        throw new Error(`effective Chrome command line omitted or duplicated: ${argument}`);
      }
    }
    records = [];
    artifacts = [];
    for (const id of SCENARIO_IDS) {
      const result = await captureScenario(
        owned,
        origin,
        id,
        fixtureManifest,
        validation,
        negativeFixtures,
      );
      records.push(result.record);
      artifacts.push(...result.artifacts);
    }
    owned.ledger = await refreshLedger(owned.ledger);
  } catch (error) {
    primaryError = error;
  } finally {
    let cleanupError: unknown;
    if (owned) {
      const ledger = owned.ledger;
      try {
        const closed = await closeOwnedChrome(owned);
        recordStageCleanupLifecycle(stage!, "cleanup-verified");
        browserCleanup = {
          unit: ledger.unit,
          controlGroup: ledger.controlGroup,
          cgroupPath: ledger.cgroupPath,
          cgroupDev: ledger.cgroupDev,
          cgroupIno: ledger.cgroupIno,
          invocationId: ledger.invocationId,
          mainPid: ledger.mainPid,
          observedPids: ledger.members,
          membershipSnapshots: ledger.membershipSnapshots,
          remainingPids: closed.remaining,
          cgroupEmpty: closed.cleaned && closed.remaining.length === 0,
          stoppedAt: closed.stoppedAt,
        };
      } catch (error) {
        if (stage?.cleanupLifecycle === "owned-launch-active") {
          recordStageCleanupLifecycle(stage, "cleanup-unresolved");
        }
        cleanupError ??= error;
      }
    } else if (launchFailure?.cleanupResolved) {
      browserCleanup = {
        unit: null,
        controlGroup: null,
        cgroupPath: null,
        cgroupDev: null,
        cgroupIno: null,
        invocationId: null,
        mainPid: null,
        observedPids: [],
        membershipSnapshots: [],
        remainingPids: [],
        cgroupEmpty: true,
        stoppedAt: new Date().toISOString(),
      };
    }
    if (serverProcess) {
      try {
        if (!serverIdentity || await identityRunning(serverIdentity)) serverProcess.kill("SIGTERM");
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) cleanupError ??= error;
      }
      try {
        const status = await serverStatus!;
        serverCleanup = {
          launcher: serverIdentity,
          signal: "SIGTERM",
          exit: { success: status.success, code: status.code, signal: status.signal },
          processAbsent: serverIdentity ? !(await identityRunning(serverIdentity)) : true,
        };
        if (serverCleanup.processAbsent !== true) {
          cleanupError ??= new Error("owned server cleanup failed");
        }
      } catch (error) {
        cleanupError ??= error;
      }
    }
    if (stage) {
      if (stage.cleanupLifecycle === "cleanup-unresolved") {
        cleanupError ??= new Error(
          "staged Chrome retained because owned launch cleanup is unresolved",
        );
      } else {
        let stageError: unknown;
        const rootIdentity = { path: stage.root, dev: stage.rootDev, ino: stage.rootIno };
        try {
          await removeStagedChrome(stage);
        } catch (error) {
          stageError = error;
        }
        let absent = false;
        if (!stageError) {
          try {
            await Deno.lstat(stage.root);
          } catch (error) {
            if (error instanceof Deno.errors.NotFound) absent = true;
            else stageError = error;
          }
          if (!absent) stageError = new Error("staged Chrome cleanup absence check failed");
        }
        if (stageError) cleanupError ??= stageError;
        else stageCleanup = { ...rootIdentity, removed: true, absent };
      }
    }
    if (cleanupError) {
      primaryError = primaryError
        ? new AggregateError(
          [primaryError, cleanupError],
          "collection and exact cleanup both failed",
        )
        : cleanupError;
    }
  }
  if (primaryError) throw primaryError;
  if (
    !owned || !chromePackage || !records || !artifacts || !effectiveArguments || !browserCleanup ||
    !serverCleanup || !stageCleanup
  ) {
    throw new Error("collector did not reach the exact cleanup commit gate");
  }
  const sourceEnd = await attestFrozenSource(args.sourceCommit, "end");
  const { phase: _startPhase, ...sourceStartIdentity } = sourceStart;
  const { phase: _endPhase, ...sourceEndIdentity } = sourceEnd;
  if (!same(sourceStartIdentity, sourceEndIdentity)) {
    throw new Error("source changed between frozen start and end checks");
  }
  const evidence: Json = {
    schemaVersion: 1,
    evidenceId: "tooling-c-to-wasm-compile-chrome-parent-v1",
    workloadId: WORKLOAD_ID,
    collectedAt: new Date().toISOString(),
    source: { start: sourceStart, end: sourceEnd, unchanged: true },
    collector: {
      denoVersion: Deno.version.deno,
      command: Deno.args,
      pid: Deno.pid,
      parentPid: Deno.ppid,
    },
    browser: {
      product: String(owned.version.product),
      expectedProduct: EXACT_CHROME_PRODUCT,
      revision: String(owned.version.revision),
      userAgent: String(owned.version.userAgent),
      jsVersion: String(owned.version.jsVersion),
      executable: owned.ledger.executable,
      expectedSha256: EXACT_CHROME_SHA256,
      package: chromePackage,
      configuredArguments: owned.arguments,
      effectiveArguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
      endpoint: { host: "127.0.0.1", port: owned.port, browserPath: owned.browserPath },
      profile: owned.ledger.profile,
      ownership: {
        unit: owned.ledger.unit,
        controlGroup: owned.ledger.controlGroup,
        cgroupPath: owned.ledger.cgroupPath,
        cgroupDev: owned.ledger.cgroupDev,
        cgroupIno: owned.ledger.cgroupIno,
        invocationId: owned.ledger.invocationId,
        mainPid: owned.ledger.mainPid,
        commandLine: owned.ledger.commandLine,
        members: owned.ledger.members,
        membershipSnapshots: owned.ledger.membershipSnapshots,
      },
    },
    server: {
      origin: String((records[0].network as Json[])[0]?.url ?? "").match(
        /^http:\/\/127\.0\.0\.1:[0-9]+/,
      )?.[0],
      loopbackOnly: true,
      mode: "public",
      launcher: serverIdentity,
    },
    scenarios: records,
    cleanup: {
      browser: browserCleanup,
      profile: { path: owned.ledger.profileRoot, removed: true, absent: true },
      server: serverCleanup,
      stage: stageCleanup,
    },
  };
  const schema = JSON.parse(
    await Deno.readTextFile(
      new URL("schemas/base-tooling-c-to-wasm-compile-browser-evidence.schema.json", root),
    ),
  );
  const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
    Ajv2020Module) as unknown as AjvConstructor;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validate(evidence)) {
    throw new Error(`browser evidence schema failed: ${JSON.stringify(validate.errors)}`);
  }
  await assertEvidenceSemantics(evidence, fixtureManifest, validation, negativeFixtures);

  const parent = args.output.slice(0, args.output.lastIndexOf("/")) || "/";
  const temp = await Deno.makeTempDir({ dir: parent, prefix: ".tooling-c-to-wasm-evidence-" });
  try {
    await Deno.mkdir(`${temp}/screenshots`);
    await Deno.mkdir(`${temp}/accessibility`);
    for (const artifact of artifacts) {
      await Deno.writeFile(`${temp}/${artifact.path}`, artifact.bytes, { createNew: true });
    }
    await Deno.writeTextFile(`${temp}/evidence.v1.json`, `${canonicalize(evidence)}\n`, {
      createNew: true,
    });
    await Deno.rename(temp, args.output);
  } catch (error) {
    await Deno.remove(temp, { recursive: true }).catch(() => {});
    throw error;
  }
}

if (import.meta.main) await main(parseCollectorArguments(Deno.args));

import Ajv2020Module from "ajv2020";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import { CdpClient } from "../lib/cdp-client.ts";
import {
  inspectChromePackage,
  recordStageCleanupLifecycle,
  removeStagedChrome,
  stageChromePackage,
  StagedChrome,
} from "../lib/chrome-stage.ts";
import {
  ChromeLaunchLifecycleError,
  closeOwnedChrome,
  launchOwnedChrome,
  OwnedChrome,
} from "../lib/owned-chrome.ts";
import { executableSnapshot, FileIdentity, refreshLedger } from "../lib/process-ledger.ts";
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
const EXPECTED_PACKAGE_COMMIT = "9fbb8aa0b631e8f0ed9ca9197d4acacdb5aa6692";
// The /demos/ route now redirects; the collector navigates the canonical
// benchmark page directly so the evidence records the page under test.
const ROUTE = "/benchmarks/server.ssr-template.v1/";
const COLLECTOR_PATH = "scripts/collect-base-server-ssr-evidence.ts";
const ATTESTATION_PATHS = new Set([
  "schemas/base-server-ssr-browser-evidence.schema.json",
  "tests/base-server-ssr-browser-collector.test.ts",
]);
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
const collectionHead = await commandText("git", ["rev-parse", "HEAD"]);
const collectorCommit = await commandText("git", [
  "log",
  "-1",
  "--format=%H",
  "--",
  COLLECTOR_PATH,
]);
const collectorTree = await commandText("git", ["rev-parse", `${collectorCommit}^{tree}`]);
if (
  !/^[a-f0-9]{40}$/u.test(collectionHead) || !/^[a-f0-9]{40}$/u.test(collectorCommit) ||
  !/^[a-f0-9]{40}$/u.test(collectorTree)
) throw new Error("collection HEAD, collector commit, or collector tree is not a SHA-1 identity");
const ancestry = await new Deno.Command("git", {
  cwd: root,
  args: ["merge-base", "--is-ancestor", collectorCommit, collectionHead],
  stdout: "piped",
  stderr: "piped",
}).output();
if (!ancestry.success) {
  throw new Error("collector source commit is not an ancestor of collection HEAD");
}
const postCollectorPaths = (await commandText("git", [
  "diff",
  "--name-only",
  collectorCommit,
  collectionHead,
])).split("\n").filter(Boolean);
if (postCollectorPaths.some((path) => !ATTESTATION_PATHS.has(path))) {
  throw new Error(
    `collection HEAD changes non-attestation source after collector commit: ${postCollectorPaths}`,
  );
}

const sourceExecutable = await executableSnapshot(options.chrome);
if (sourceExecutable.sha256 !== EXPECTED_EXECUTABLE_SHA256) {
  throw new Error(`Chrome executable hash mismatch: ${sourceExecutable.sha256}`);
}
const chromePackage = await inspectChromePackage(options.chrome, EXPECTED_EXECUTABLE_SHA256);

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
if (packageCommit !== EXPECTED_PACKAGE_COMMIT) {
  throw new Error(`package source commit is not pinned: ${packageCommit}`);
}
const packagePinPath = "artifacts/base/server-ssr-template/source-commit.txt";
const packagePin = (await Deno.readTextFile(new URL(packagePinPath, root))).trim();
if (
  packagePin !== packageCommit ||
  decoder.decode(await gitBytes(collectorCommit, packagePinPath)).trim() !== packageCommit ||
  await sha256Hex(registrationBytes) !==
    await sha256Hex(await gitBytes(packageCommit, registrationPath))
) throw new Error("registration, package pin, and package source commit are not cross-bound");

const ASSETS = [
  [ROUTE, "public/benchmarks/server.ssr-template.v1/index.html", "text/html"],
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
  const committedBytes = await gitBytes(collectorCommit, path);
  const headBytes = await gitBytes(collectionHead, path);
  if (
    await sha256Hex(diskBytes) !== await sha256Hex(committedBytes) ||
    await sha256Hex(diskBytes) !== await sha256Hex(headBytes)
  ) throw new Error(`${path} differs from pinned collector commit or clean HEAD bytes`);
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
const collectorBytes = await Deno.readFile(new URL(COLLECTOR_PATH, root));
if (
  await sha256Hex(collectorBytes) !==
    await sha256Hex(await gitBytes(collectorCommit, COLLECTOR_PATH)) ||
  await sha256Hex(collectorBytes) !==
    await sha256Hex(await gitBytes(collectionHead, COLLECTOR_PATH))
) throw new Error("executed collector bytes differ from pinned collector commit or clean HEAD");

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

async function identityStillRunning(identity: ProcessIdentity): Promise<boolean> {
  const current = await processIdentity(identity.pid);
  return current?.startTimeTicks === identity.startTimeTicks &&
    current.executable === identity.executable;
}

function sameExecutable(left: FileIdentity, right: FileIdentity): boolean {
  return left.path === right.path && left.dev === right.dev && left.ino === right.ino &&
    left.sha256 === right.sha256;
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
const origin = `http://127.0.0.1:${serverPort}`;
const serverArguments = [
  "run",
  "--allow-env=PORT,HOST,SERVER_MODE",
  "--allow-net=127.0.0.1",
  "--allow-read=.",
  "deploy.ts",
];
const launchSuffix = crypto.randomUUID().replaceAll("-", "");
const profilePath = `/tmp/wasm-vs-js-owned-profiles/ssr-${launchSuffix}/launch`;
const stageAuthorization = {
  permitId: `ssr-${launchSuffix}`,
  sourceCommit: collectorCommit,
  chromePackageManifestSha256: chromePackage.manifestSha256,
};
const chromeExtraArguments = [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-extensions",
  "--metrics-recording-only",
  "--hide-scrollbars",
  "--window-size=1440,1200",
  "--remote-debugging-address=127.0.0.1",
  "--enable-automation",
];
let server: Deno.ChildProcess | null = null;
let serverStatusPromise: Promise<Deno.CommandStatus> | null = null;
let serverLauncher: ProcessIdentity | null = null;
let stage: StagedChrome | null = null;
let ownedChrome: OwnedChrome | null = null;
let emergencyClient: CdpClient | null = null;
let collectionComplete = false;
let chromeCleanupVerified = false;
let collectionFailure: unknown = null;
const cleanupFailures: Error[] = [];

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function boundedServerStatus(timeoutMs: number): Promise<Deno.CommandStatus | null> {
  if (!serverStatusPromise) return null;
  return await Promise.race([
    serverStatusPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

async function stopEvidenceServer(
  requireIdentity: boolean,
): Promise<{ exit: Deno.CommandStatus; signal: "SIGTERM" | "SIGKILL"; absent: true }> {
  if (!server || !serverStatusPromise) throw new Error("evidence server handle/status unavailable");
  if (!serverLauncher) {
    if (requireIdentity) throw new Error("owned evidence server identity unavailable at cleanup");
    server.kill("SIGKILL");
    const exit = await boundedServerStatus(5_000);
    if (!exit) throw new Error("identity-less evidence server status did not settle after SIGKILL");
    const current = await processIdentity(server.pid);
    if (current) throw new Error("identity-less evidence server PID remained after SIGKILL");
    return { exit, signal: "SIGKILL", absent: true };
  }
  if (!(await identityStillRunning(serverLauncher))) {
    const exit = await boundedServerStatus(1_000);
    if (!exit) throw new Error("evidence server identity disappeared without exact exit status");
    if (requireIdentity) {
      throw new Error(
        `owned evidence server exited before requested cleanup: ${JSON.stringify(exit)}`,
      );
    }
    return { exit, signal: "SIGTERM", absent: true };
  }
  server.kill("SIGTERM");
  let signal: "SIGTERM" | "SIGKILL" = "SIGTERM";
  let exit = await boundedServerStatus(5_000);
  if (!exit) {
    if (!(await identityStillRunning(serverLauncher))) {
      throw new Error("evidence server identity disappeared without exact status after SIGTERM");
    }
    server.kill("SIGKILL");
    signal = "SIGKILL";
    exit = await boundedServerStatus(5_000);
  }
  if (!exit) throw new Error("evidence server exact status remained unresolved after SIGKILL");
  if (await identityStillRunning(serverLauncher)) {
    throw new Error("owned evidence server survived bounded exact cleanup");
  }
  return { exit, signal, absent: true };
}

try {
  stage = await stageChromePackage(
    options.chrome,
    EXPECTED_EXECUTABLE_SHA256,
    stageAuthorization,
  );
  if (!sameExecutable(sourceExecutable, await executableSnapshot(options.chrome))) {
    throw new Error("Chrome source executable changed during setup");
  }
  server = new Deno.Command(Deno.execPath(), {
    cwd: root,
    args: serverArguments,
    env: { PORT: String(serverPort), HOST: "127.0.0.1", SERVER_MODE: "public" },
    stdout: "null",
    stderr: "null",
  }).spawn();
  serverStatusPromise = server.status;
  serverLauncher = await processIdentity(server.pid);
  if (!serverLauncher) throw new Error("owned evidence server identity unavailable");
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
  let launchBegan = false;
  try {
    ownedChrome = await launchOwnedChrome({
      stagedChrome: stage,
      profileRoot: profilePath,
      extraArguments: chromeExtraArguments,
      onSpawn: () => {
        launchBegan = true;
        recordStageCleanupLifecycle(stage!, "owned-launch-active");
      },
    });
  } catch (error) {
    if (error instanceof ChromeLaunchLifecycleError && error.launchBegan) {
      recordStageCleanupLifecycle(
        stage,
        error.cleanupResolved ? "cleanup-verified" : "cleanup-unresolved",
      );
      chromeCleanupVerified = error.cleanupResolved;
    } else if (launchBegan) {
      recordStageCleanupLifecycle(stage, "cleanup-unresolved");
    }
    throw error;
  }
  const client = ownedChrome.browser as CdpClient;
  emergencyClient = client;
  const launchArguments = ownedChrome.arguments;
  const expectedLaunchArguments = [
    `--user-data-dir=${profilePath}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    ...chromeExtraArguments,
    "about:blank",
  ];
  if (JSON.stringify(launchArguments) !== JSON.stringify(expectedLaunchArguments)) {
    throw new Error("owned Chrome launch arguments differ from the pinned collector arguments");
  }

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

  const browserVersion = ownedChrome.version;
  if (browserVersion.product !== EXPECTED_PRODUCT) {
    throw new Error(`unexpected browser ${browserVersion.product}`);
  }
  interface ExpectedNetworkRequest {
    route: string;
    context: string;
    resourceType: "Document" | "Stylesheet" | "Script" | "Other" | "Fetch";
  }
  const baseNetworkRequests: ExpectedNetworkRequest[] = [
    { route: ROUTE, context: "page", resourceType: "Document" },
    { route: "/styles.css", context: "page", resourceType: "Stylesheet" },
    { route: "/base-server-ssr-demo.js", context: "page", resourceType: "Script" },
    { route: "/favicon.ico", context: "page", resourceType: "Other" },
  ];
  const workerModuleRequests = (index: number): ExpectedNetworkRequest[] => [
    { route: "/base-server-ssr-worker.js", context: `worker-${index}`, resourceType: "Script" },
    {
      route: "/benchmarks/v1/server-ssr-template/workload.js",
      context: `worker-${index}`,
      resourceType: "Script",
    },
  ];
  const completedTargetRequests = (
    target: string,
    index: number,
  ): ExpectedNetworkRequest[] => [
    {
      route: "/data/v1-implementation-registrations/server.ssr-template.v1.json",
      context: `worker-${index}`,
      resourceType: "Fetch",
    },
    {
      route: "/artifacts/base-server-ssr-template/build-manifest.json",
      context: `worker-${index}`,
      resourceType: "Fetch",
    },
    {
      route: "/artifacts/base-server-ssr-template/fixture-manifest.json",
      context: `worker-${index}`,
      resourceType: "Fetch",
    },
    {
      route: "/artifacts/base-server-ssr-template/output-manifest.json",
      context: `worker-${index}`,
      resourceType: "Fetch",
    },
    {
      route: "/artifacts/base-server-ssr-template/fixture.bin",
      context: `worker-${index}`,
      resourceType: "Fetch",
    },
    {
      route: target === "js-controlled"
        ? "/benchmarks/v1/server-ssr-template/workload.js"
        : "/artifacts/base-server-ssr-template/server-ssr-template.wasm",
      context: `worker-${index}`,
      resourceType: "Fetch",
    },
  ];
  const expectedNetworkRequests = (
    definition: typeof scenarioDefinitions[number],
  ): ExpectedNetworkRequest[] => {
    const completed = definition.id === "restart-js-to-wasm"
      ? definition.targets.map((target, index) => ({ target, index }))
      : definition.id === "stale-after-restart"
      ? [{ target: definition.targets[1], index: 1 }]
      : ["complete-js", "complete-wasm", "wrong-token"].includes(definition.id)
      ? [{ target: definition.targets[0], index: 0 }]
      : [];
    return [
      ...baseNetworkRequests,
      ...definition.targets.flatMap((_target, index) => workerModuleRequests(index)),
      ...completed.flatMap(({ target, index }) => completedTargetRequests(target, index)),
    ];
  };

  const scenarios: Array<Record<string, unknown>> = [];
  for (const definition of scenarioDefinitions) {
    const created = await client.send("Target.createTarget", { url: "about:blank" });
    const targetId = String(created.targetId);
    const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
    const sessionId = String(attached.sessionId);
    const observedSessions = new Set([sessionId]);
    const sessionRoles = new Map([[sessionId, "page"]]);
    const attachTasks: Promise<void>[] = [];
    const consoleMessages: Array<Record<string, unknown>> = [];
    const exceptions: Array<Record<string, unknown>> = [];
    const lifecycleEvents: Array<Record<string, unknown>> = [];
    const requests = new Map<string, Record<string, unknown>>();
    const responseBodyTasks: Promise<void>[] = [];
    const responseBodyErrors: Error[] = [];
    const interceptionTasks: Promise<void>[] = [];
    const interceptionErrors: Error[] = [];
    const externalRequests: Array<Record<string, unknown>> = [];
    const removers = [
      client.on("Target.attachedToTarget", (params, eventSession) => {
        if (eventSession !== sessionId) return;
        const targetInfo = params.targetInfo as Record<string, unknown>;
        if (targetInfo.type !== "worker") return;
        const workerSession = String(params.sessionId);
        observedSessions.add(workerSession);
        sessionRoles.set(workerSession, `worker-${sessionRoles.size - 1}`);
        attachTasks.push((async () => {
          await Promise.all([
            client.send("Runtime.enable", {}, workerSession),
            client.send("Network.enable", {}, workerSession),
            client.send("Network.setCacheDisabled", { cacheDisabled: true }, workerSession),
            client.send("Fetch.enable", {
              patterns: [{ urlPattern: "*", requestStage: "Request" }],
            }, workerSession),
          ]);
          await client.send("Runtime.runIfWaitingForDebugger", {}, workerSession);
        })());
      }),
      client.on("Fetch.requestPaused", (params, eventSession) => {
        if (!eventSession || !observedSessions.has(eventSession)) return;
        const request = params.request as Record<string, unknown>;
        const urlText = String(request.url);
        let allowed = false;
        try {
          allowed = new URL(urlText).origin === origin;
        } catch {
          allowed = false;
        }
        if (!allowed) {
          externalRequests.push({
            context: sessionRoles.get(eventSession),
            url: urlText,
            method: String(request.method),
            resourceType: String(params.resourceType),
            disposition: "blocked-by-collector",
          });
        }
        interceptionTasks.push(
          client.send(
            allowed ? "Fetch.continueRequest" : "Fetch.failRequest",
            allowed
              ? { requestId: String(params.requestId) }
              : { requestId: String(params.requestId), errorReason: "BlockedByClient" },
            eventSession,
            10_000,
          ).then(() => undefined).catch((error) => {
            interceptionErrors.push(error instanceof Error ? error : new Error(String(error)));
          }),
        );
      }),
      client.on("Runtime.bindingCalled", (params, eventSession) => {
        if (eventSession !== sessionId || params.name !== "__ssrEvidenceEvent") return;
        lifecycleEvents.push(JSON.parse(String(params.payload)));
      }),
      client.on("Runtime.consoleAPICalled", (params, eventSession) => {
        if (!eventSession || !observedSessions.has(eventSession)) return;
        consoleMessages.push({
          context: sessionRoles.get(eventSession),
          type: String(params.type),
          arguments: ((params.args as Array<Record<string, unknown>>) ?? []).map((argument) =>
            String(argument.value ?? argument.description ?? argument.type)
          ),
        });
      }),
      client.on("Runtime.exceptionThrown", (params, eventSession) => {
        if (!eventSession || !observedSessions.has(eventSession)) return;
        const details = params.exceptionDetails as Record<string, unknown>;
        exceptions.push({
          context: sessionRoles.get(eventSession),
          text: String(details.text),
          lineNumber: Number(details.lineNumber),
        });
      }),
      client.on("Network.requestWillBeSent", (params, eventSession) => {
        if (!eventSession || !observedSessions.has(eventSession)) return;
        const request = params.request as Record<string, unknown>;
        const url = new URL(String(request.url));
        if (url.origin !== origin) {
          externalRequests.push({
            context: sessionRoles.get(eventSession),
            url: url.href,
            method: String(request.method),
            resourceType: String(params.type),
            disposition: "observed-by-network",
          });
          return;
        }
        const key = `${eventSession}:${params.requestId}`;
        requests.set(key, {
          context: sessionRoles.get(eventSession),
          route: url.pathname,
          occurrence: 0,
          url: url.href,
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
      client.send(
        "Fetch.enable",
        { patterns: [{ urlPattern: "*", requestStage: "Request" }] },
        sessionId,
      ),
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
      await evaluate(
        client,
        sessionId,
        'dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }))',
      );
      const deadline = Date.now() + 2_000;
      while (
        !lifecycleEvents.some((event) =>
          event.kind === "worker-terminated" &&
          (event.detail as Record<string, unknown>).index === 0
        ) && Date.now() < deadline
      ) await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const expectedRequests = expectedNetworkRequests(definition);
    const requestIdentity = (
      request: Record<string, unknown> | ExpectedNetworkRequest,
    ): string => `${request.context}:${request.resourceType}:${request.route}`;
    const expectedRequestCounts = new Map<string, number>();
    for (const request of expectedRequests) {
      const key = requestIdentity(request);
      expectedRequestCounts.set(key, (expectedRequestCounts.get(key) ?? 0) + 1);
    }
    const networkDeadline = Date.now() + 10_000;
    while (Date.now() < networkDeadline) {
      await Promise.all([...attachTasks, ...interceptionTasks]);
      await Promise.all([...responseBodyTasks]);
      if (responseBodyErrors.length) throw responseBodyErrors[0];
      if (interceptionErrors.length) throw interceptionErrors[0];
      if (externalRequests.length) {
        throw new Error(
          `${definition.id} external network request blocked: ${JSON.stringify(externalRequests)}`,
        );
      }
      const actualCounts = new Map<string, number>();
      for (const request of requests.values()) {
        const key = requestIdentity(request);
        actualCounts.set(key, (actualCounts.get(key) ?? 0) + 1);
      }
      for (const [key, count] of actualCounts) {
        if (count > (expectedRequestCounts.get(key) ?? 0)) {
          throw new Error(`${definition.id} observed unexpected network identity/count: ${key}`);
        }
      }
      const allBodies = [...requests.values()].every((request) =>
        request.bodyBytes !== null && request.bodySha256 !== null && request.sourcePath !== null
      );
      if (
        observedSessions.size === definition.targets.length + 1 &&
        requests.size === expectedRequests.length && allBodies
      ) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (observedSessions.size !== definition.targets.length + 1) {
      throw new Error(`${definition.id} did not attach every worker target`);
    }
    await Promise.all([...attachTasks, ...interceptionTasks]);
    await Promise.all([...responseBodyTasks]);
    if (responseBodyErrors.length) throw responseBodyErrors[0];
    if (interceptionErrors.length) throw interceptionErrors[0];
    if (externalRequests.length) {
      throw new Error(
        `${definition.id} external network request blocked: ${JSON.stringify(externalRequests)}`,
      );
    }

    const requestsByIdentity = new Map<string, Array<Record<string, unknown>>>();
    for (const request of requests.values()) {
      if (request.failed || request.status !== 200) {
        throw new Error(`${definition.id} failed network request: ${JSON.stringify(request)}`);
      }
      if (
        request.bodyBytes === null || request.bodySha256 === null || request.sourcePath === null
      ) {
        throw new Error(`${definition.id} omitted exact raw response bytes: ${request.url}`);
      }
      const key = requestIdentity(request);
      const bucket = requestsByIdentity.get(key) ?? [];
      bucket.push(request);
      requestsByIdentity.set(key, bucket);
    }
    const occurrences = new Map<string, number>();
    const exactNetwork = expectedRequests.map((expectedRequest) => {
      const key = requestIdentity(expectedRequest);
      const request = requestsByIdentity.get(key)?.shift();
      if (!request) throw new Error(`${definition.id} omitted expected network request: ${key}`);
      const occurrence = (occurrences.get(expectedRequest.route) ?? 0) + 1;
      occurrences.set(expectedRequest.route, occurrence);
      request.occurrence = occurrence;
      return request;
    });
    if (
      requests.size !== expectedRequests.length ||
      [...requestsByIdentity.values()].some((bucket) => bucket.length !== 0)
    ) throw new Error(`${definition.id} network set/count differed from the exact contract`);
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

    await new Promise((resolve) => setTimeout(resolve, 50));
    await Promise.all([...interceptionTasks]);
    if (interceptionErrors.length) throw interceptionErrors[0];
    if (externalRequests.length) {
      throw new Error(
        `${definition.id} external network request blocked: ${JSON.stringify(externalRequests)}`,
      );
    }
    if (requests.size !== expectedRequests.length) {
      throw new Error(`${definition.id} received a late request outside the exact network set`);
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
      network: exactNetwork,
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
    ownedChrome.ledger = await refreshLedger(ownedChrome.ledger);
  }

  const browserLedger = ownedChrome.ledger;
  const browserCleanup = await closeOwnedChrome(ownedChrome);
  emergencyClient = null;
  recordStageCleanupLifecycle(stage, "cleanup-verified");
  chromeCleanupVerified = true;
  if (browserCleanup.remaining.length || browserCleanup.identityMismatches.length) {
    throw new Error("owned Chrome cgroup retained members after cleanup");
  }
  let profileAbsent = false;
  try {
    await Deno.lstat(profilePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) profileAbsent = true;
    else throw error;
  }
  if (!profileAbsent) throw new Error("owned Chrome profile survived cleanup");
  await removeStagedChrome(stage);
  stage = null;

  const serverCleanup = await stopEvidenceServer(true);
  const endDirty = await commandText("git", ["status", "--porcelain=v1", "--untracked-files=all"]);
  const endCollectionHead = await commandText("git", ["rev-parse", "HEAD"]);
  const endCollectorCommit = await commandText("git", [
    "log",
    "-1",
    "--format=%H",
    "--",
    COLLECTOR_PATH,
  ]);
  const endCollectorTree = await commandText("git", ["rev-parse", `${endCollectorCommit}^{tree}`]);
  if (
    endDirty || endCollectionHead !== collectionHead || endCollectorCommit !== collectorCommit ||
    endCollectorTree !== collectorTree
  ) throw new Error("repository source identity changed during collection");
  if (!sameExecutable(sourceExecutable, await executableSnapshot(options.chrome))) {
    throw new Error("Chrome source executable changed across collection");
  }
  const endChromePackage = await inspectChromePackage(options.chrome, EXPECTED_EXECUTABLE_SHA256);
  if (endChromePackage.manifestSha256 !== chromePackage.manifestSha256) {
    throw new Error("Chrome source package changed across collection");
  }
  for (const source of sourceFiles) {
    const diskBytes = await Deno.readFile(new URL(source.path, root));
    if (
      diskBytes.byteLength !== source.bytes || await sha256Hex(diskBytes) !== source.sha256 ||
      await sha256Hex(await gitBytes(collectorCommit, source.path)) !== source.sha256 ||
      await sha256Hex(await gitBytes(collectionHead, source.path)) !== source.sha256
    ) throw new Error(`${source.path} changed after browser collection`);
  }
  if (
    await sha256Hex(await Deno.readFile(new URL(COLLECTOR_PATH, root))) !==
      await sha256Hex(await gitBytes(collectorCommit, COLLECTOR_PATH))
  ) throw new Error("executed collector changed after browser collection");

  const evidence = {
    schemaVersion: 1,
    evidenceId: EVIDENCE_ID,
    collectedAt: new Date().toISOString(),
    source: {
      head: collectorCommit,
      headTree: collectorTree,
      clean: true,
      packageCommit,
      collector: {
        path: COLLECTOR_PATH,
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
        sourcePath: sourceExecutable.path,
        sourceDev: sourceExecutable.dev,
        sourceIno: sourceExecutable.ino,
        runningPath: browserLedger.executable.path,
        runningDev: browserLedger.executable.dev,
        runningIno: browserLedger.executable.ino,
        sha256: browserLedger.executable.sha256,
        sourcePackageManifestSha256: chromePackage.manifestSha256,
        runningIdentityVerified: true,
        sourceIdentityVerifiedAtEnd: true,
      },
      launchArguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
      debuggerOrigin: `http://127.0.0.1:${ownedChrome.port}`,
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
        unit: browserLedger.unit,
        controlGroup: browserLedger.controlGroup,
        cgroupPath: browserLedger.cgroupPath,
        cgroupDev: browserLedger.cgroupDev,
        cgroupIno: browserLedger.cgroupIno,
        invocationId: browserLedger.invocationId,
        mainPid: browserLedger.mainPid,
        commandLine: browserLedger.commandLine,
        membershipSnapshots: browserLedger.membershipSnapshots,
        requested: "cgroup.kill",
        remaining: browserCleanup.remaining,
        identityMismatches: browserCleanup.identityMismatches,
        stoppedAt: browserCleanup.stoppedAt,
      },
      profile: {
        path: profilePath,
        removed: true,
        absent: profileAbsent,
      },
      stage: {
        removed: true,
        absent: true,
      },
      server: {
        launcher: serverLauncher,
        signal: serverCleanup.signal,
        exit: serverCleanup.exit,
        processAbsent: serverCleanup.absent,
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
} catch (error) {
  collectionFailure = error;
} finally {
  if (!collectionComplete) {
    try {
      emergencyClient?.close();
    } catch (error) {
      cleanupFailures.push(new Error("emergency CDP close failed", { cause: error }));
    }
    if (ownedChrome && !chromeCleanupVerified) {
      try {
        const result = await closeOwnedChrome(ownedChrome);
        if (result.remaining.length || result.identityMismatches.length) {
          cleanupFailures.push(
            new Error(
              `owned Chrome cleanup retained members: ${
                JSON.stringify({
                  remaining: result.remaining,
                  identityMismatches: result.identityMismatches,
                })
              }`,
            ),
          );
          if (stage) recordStageCleanupLifecycle(stage, "cleanup-unresolved");
        } else {
          chromeCleanupVerified = true;
          if (stage) recordStageCleanupLifecycle(stage, "cleanup-verified");
        }
      } catch (error) {
        cleanupFailures.push(new Error("owned Chrome cleanup unresolved", { cause: error }));
        if (stage) {
          try {
            recordStageCleanupLifecycle(stage, "cleanup-unresolved");
          } catch (recordError) {
            cleanupFailures.push(
              new Error("failed to record unresolved Chrome stage cleanup", { cause: recordError }),
            );
          }
        }
      }
    }
    if (stage && stage.cleanupLifecycle !== "cleanup-unresolved") {
      const currentStage = stage;
      try {
        await removeStagedChrome(currentStage);
        stage = null;
      } catch (error) {
        cleanupFailures.push(new Error("Chrome stage removal unresolved", { cause: error }));
        try {
          recordStageCleanupLifecycle(currentStage, "cleanup-unresolved");
        } catch (recordError) {
          cleanupFailures.push(
            new Error("failed to record unresolved Chrome stage removal", { cause: recordError }),
          );
        }
      }
    }
    if (server && serverStatusPromise) {
      try {
        await stopEvidenceServer(false);
      } catch (error) {
        cleanupFailures.push(new Error("evidence server cleanup unresolved", { cause: error }));
      }
    }
    try {
      await Deno.remove(options.outputDir, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        cleanupFailures.push(new Error("evidence output cleanup unresolved", { cause: error }));
      }
    }
  }
}

if (collectionFailure !== null || cleanupFailures.length) {
  const failures = [
    ...(collectionFailure === null ? [] : [asError(collectionFailure)]),
    ...cleanupFailures,
  ];
  throw new AggregateError(
    failures,
    `server SSR collection failed with ${cleanupFailures.length} unresolved cleanup failure(s)`,
  );
}

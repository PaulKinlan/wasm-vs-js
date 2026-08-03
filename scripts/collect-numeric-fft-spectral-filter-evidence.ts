import Ajv2020Module from "ajv2020";
import { canonicalize, sha256Hex } from "../lib/canonical.ts";
import {
  BrowserClient,
  closeOwnedChrome,
  launchOwnedChrome,
  OwnedChrome,
} from "../lib/owned-chrome.ts";
import {
  inspectChromePackage,
  recordStageCleanupLifecycle,
  removeStagedChrome,
  stageChromePackage,
  StagedChrome,
} from "../lib/chrome-stage.ts";
import { refreshLedger } from "../lib/process-ledger.ts";

const root = new URL("../", import.meta.url);
const ROUTE = "/benchmarks/numeric-fft-spectral-filter-v1/";
const EXPECTED_CHROME_PRODUCT = "Chrome/150.0.7871.24";
const EXPECTED_CHROME_SHA256 = "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
const EXPECTED_OUTPUT_SHA256 = "56674b58154a2272f25bd2cd8c950cea04cf30be7211e9f51f13a183f31ff1a5";
const EXPECTED_QUANTIZED_SHA256 =
  "513b24c63d27d9e84c41b7e0c65c95b687973f209420dd13dbb5fe3b3076ded3";
const EXPECTED_ORACLE = {
  passed: true,
  violations: 0,
  maxAbsolute: 1.7113793338019434e-7,
  maxRelative: 45181.96588413063,
  outputEnergy: 26623.35842396255,
  referenceEnergy: 26623.358400572066,
  energyRelative: 8.785699615237633e-10,
  tolerance: { absolute: 0.00025, relative: 0.0025, energyRelative: 0.0002 },
} as const;
const EXPECTED_CHECKPOINTS = [
  { index: 0, real: -0.00008689425885677338, imaginary: 0 },
  { index: 1, real: -0.00013792701065540314, imaginary: -1.4925550573252622e-8 },
  { index: 131_072, real: 0.05455316603183746, imaginary: 2.026320565128541e-18 },
  { index: 262_144, real: 0.1626012623310089, imaginary: -1.135633119687724e-17 },
  { index: 524_288, real: 0.025741079822182655, imaginary: 0 },
  { index: 1_048_574, real: 0.000009368173778057098, imaginary: -1.2371824453794034e-8 },
  { index: 1_048_575, real: -0.00003272015601396561, imaginary: -4.02133792931636e-9 },
] as const;
const EXPECTED_SCENARIOS = [
  "complete-js",
  "complete-wasm",
  "wrong-token",
  "stale-error",
  "restart",
  "cancel",
  "timeout",
  "pagehide",
] as const;

export const NUMERIC_FFT_EXECUTED_SOURCE_PATHS = [
  "scripts/collect-numeric-fft-spectral-filter-evidence.ts",
  "scripts/serve-numeric-fft-spectral-filter-evidence.ts",
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
  "deno.json",
  "deno.corpus.json",
  "deno.lock",
  "schemas/attempt-record.schema.json",
  "schemas/benchmark.schema.json",
  "schemas/browser-permit.schema.json",
  "schemas/build-manifest.schema.json",
  "schemas/chrome-package-manifest.schema.json",
  "schemas/collection-stop.schema.json",
  "schemas/collector-health.schema.json",
  "schemas/corpus.schema.json",
  "schemas/launch-evidence.schema.json",
  "schemas/launch-manifest.schema.json",
  "schemas/network-attestation.schema.json",
  "schemas/paired-block.schema.json",
  "schemas/permit-receipt.schema.json",
  "schemas/prelaunch-failure.schema.json",
  "schemas/preregistration.schema.json",
  "schemas/source-manifest.schema.json",
  "schemas/stage-owner.schema.json",
  "schemas/numeric-fft-spectral-filter-browser-evidence.schema.json",
  "catalog/base-implementations/numeric.fft-spectral-filter.v1.json",
  "benchmarks/base/numeric-fft-spectral-filter/workload.js",
  "public/benchmarks/numeric-fft-spectral-filter-v1/index.html",
  "public/benchmarks/numeric-fft-spectral-filter-v1/demo.js",
  "public/benchmarks/numeric-fft-spectral-filter-v1/worker.js",
  "public/styles.css",
  "public/artifacts/numeric-fft-spectral-filter/build-manifest.json",
  "public/artifacts/numeric-fft-spectral-filter/fixture-manifest.json",
  "public/artifacts/numeric-fft-spectral-filter/output-manifest.json",
  "public/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm",
] as const;

export const NUMERIC_FFT_EXECUTABLE_ROUTES: Readonly<Record<string, string>> = {
  "/benchmarks/numeric-fft-spectral-filter-v1/demo.js":
    "public/benchmarks/numeric-fft-spectral-filter-v1/demo.js",
  "/benchmarks/numeric-fft-spectral-filter-v1/worker.js":
    "public/benchmarks/numeric-fft-spectral-filter-v1/worker.js",
  "/benchmarks/base/numeric-fft-spectral-filter/workload.js":
    "benchmarks/base/numeric-fft-spectral-filter/workload.js",
  "/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm":
    "public/artifacts/numeric-fft-spectral-filter/numeric-fft-spectral-filter.wasm",
};

export type CollectorArguments = {
  sourceCommit: string;
  chrome: string;
  chromeSha256: string;
  chromeProduct: string;
  output: string;
};

type CommandResult = { success: boolean; stdout: Uint8Array; stderr: Uint8Array };
type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;
const runCommand: CommandRunner = async (command, args) => {
  const result = await new Deno.Command(command, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return { success: result.success, stdout: result.stdout, stderr: result.stderr };
};

export function parseNumericFftCollectorArguments(argv: readonly string[]): CollectorArguments {
  const names = ["source-commit", "chrome", "chrome-sha256", "chrome-product", "output"] as const;
  const values = new Map<string, string>();
  for (const argument of argv) {
    const match = argument.match(/^--([a-z-]+)=(.+)$/);
    if (!match || !names.includes(match[1] as (typeof names)[number]) || values.has(match[1])) {
      throw new Error(`unknown or duplicate collector argument: ${argument}`);
    }
    values.set(match[1], match[2]);
  }
  if (values.size !== names.length) {
    throw new Error("all five exact collector arguments are required");
  }
  const parsed = {
    sourceCommit: values.get("source-commit")!,
    chrome: values.get("chrome")!,
    chromeSha256: values.get("chrome-sha256")!,
    chromeProduct: values.get("chrome-product")!,
    output: values.get("output")!,
  };
  if (!/^[a-f0-9]{40}$/.test(parsed.sourceCommit)) throw new Error("invalid source commit");
  if (parsed.chromeSha256 !== EXPECTED_CHROME_SHA256) {
    throw new Error("invalid exact Chrome SHA-256");
  }
  if (parsed.chromeProduct !== EXPECTED_CHROME_PRODUCT) {
    throw new Error("invalid exact Chrome product version");
  }
  if (!parsed.chrome.startsWith("/") || !parsed.output.startsWith("/")) {
    throw new Error("Chrome and output paths must be absolute");
  }
  return parsed;
}

export async function attestCleanNumericFftSource(
  sourceCommit: string,
  command: CommandRunner = runCommand,
): Promise<Record<string, unknown>> {
  const head = await command("git", ["rev-parse", "HEAD"]);
  if (!head.success || new TextDecoder().decode(head.stdout).trim() !== sourceCommit) {
    throw new Error("source commit is not exact HEAD");
  }
  const tree = await command("git", ["rev-parse", `${sourceCommit}^{tree}`]);
  if (!tree.success) throw new Error("source tree unavailable");
  const status = await command("git", [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  if (!status.success || status.stdout.byteLength !== 0) {
    throw new Error("numeric FFT browser collection requires a completely clean checkout");
  }
  const files = [];
  for (const path of NUMERIC_FFT_EXECUTED_SOURCE_PATHS) {
    const local = await Deno.readFile(new URL(path, root));
    const committed = await command("git", ["show", `${sourceCommit}:${path}`]);
    if (!committed.success || await sha256Hex(local) !== await sha256Hex(committed.stdout)) {
      throw new Error(`executed source differs from ${sourceCommit}:${path}`);
    }
    files.push({ path, bytes: local.byteLength, sha256: await sha256Hex(local) });
  }
  return {
    commit: sourceCommit,
    tree: new TextDecoder().decode(tree.stdout).trim(),
    clean: true,
    statusPorcelainSha256: await sha256Hex(status.stdout),
    files,
  };
}

export type ExecutableAssetAttestation = {
  route: string;
  localPath: string;
  kind: "javascript" | "webassembly";
  fetched: { bytes: number; sha256: string };
  executed: { bytes: number; sha256: string; protocolMethod: string };
  byteIdentical: true;
};

export async function attestFetchedExecutedAssets(
  assets: Array<Omit<ExecutableAssetAttestation, "localPath" | "kind" | "byteIdentical">>,
  expectedRoutes: readonly string[] = Object.keys(NUMERIC_FFT_EXECUTABLE_ROUTES),
): Promise<ExecutableAssetAttestation[]> {
  const byRoute = new Map(assets.map((asset) => [asset.route, asset]));
  if (byRoute.size !== assets.length || byRoute.size !== expectedRoutes.length) {
    throw new Error("executable asset route set is incomplete or duplicated");
  }
  const result: ExecutableAssetAttestation[] = [];
  for (const route of expectedRoutes) {
    const localPath = NUMERIC_FFT_EXECUTABLE_ROUTES[route];
    if (!localPath) throw new Error(`unexpected executable route: ${route}`);
    const asset = byRoute.get(route);
    if (!asset) throw new Error(`executable asset missing: ${route}`);
    const local = await Deno.readFile(new URL(localPath, root));
    const expected = { bytes: local.byteLength, sha256: await sha256Hex(local) };
    if (
      asset.fetched.bytes !== expected.bytes || asset.fetched.sha256 !== expected.sha256 ||
      asset.executed.bytes !== expected.bytes || asset.executed.sha256 !== expected.sha256
    ) throw new Error(`fetched/executed byte identity failed: ${route}`);
    result.push({
      route,
      localPath,
      kind: route.endsWith(".wasm") ? "webassembly" : "javascript",
      fetched: asset.fetched,
      executed: asset.executed,
      byteIdentical: true,
    });
  }
  return result;
}

function expectedCounters(target: "js-controlled" | "wasm-linear-controlled") {
  return {
    pipelines: 1,
    samples: 1_048_576,
    "forward-ffts": 1,
    "inverse-ffts": 1,
    butterflies: 20_971_520,
    "twiddle-pair-loads": 20_971_520,
    "window-multiplies": 1_048_576,
    "filter-scalar-multiplies": 2_097_152,
    "inverse-scale-multiplies": 2_097_152,
    "input-bytes": 20_971_512,
    "output-bytes": 8_388_608,
    allocations: target === "js-controlled" ? 1 : 0,
    "boundary-crossings": target === "js-controlled" ? 0 : 1,
  };
}

function same(left: unknown, right: unknown): boolean {
  return canonicalize(left) === canonicalize(right);
}

export function assertNumericFftBrowserEvidenceSemantics(value: Record<string, unknown>): void {
  const source = value.source as Record<string, unknown>;
  if (
    source?.clean !== true ||
    source.statusPorcelainSha256 !==
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  ) {
    throw new Error("source clean attestation contradiction");
  }
  const sourceFiles = source.files as Array<Record<string, unknown>>;
  if (!same(sourceFiles.map((file) => file.path), NUMERIC_FFT_EXECUTED_SOURCE_PATHS)) {
    throw new Error("executed source file set/order contradiction");
  }
  const browser = value.browser as Record<string, unknown>;
  const executable = browser?.executable as Record<string, unknown>;
  if (
    browser?.product !== browser?.expectedProduct || executable?.sha256 !== browser?.expectedSha256
  ) {
    throw new Error("Chrome identity contradiction");
  }
  const configured = browser.configuredArguments as string[];
  const effective = browser.effectiveArguments as string[];
  const browserProfile = browser.profile as Record<string, unknown>;
  if (
    !configured.every((argument) => effective.includes(argument)) ||
    !configured.includes("--remote-debugging-port=0") ||
    !configured.includes(`--user-data-dir=${browserProfile.profileRoot}`)
  ) {
    throw new Error("Chrome effective/profile arguments omitted a configured identity");
  }
  const scenarios = value.scenarios as Array<Record<string, unknown>>;
  if (
    !Array.isArray(scenarios) || !same(scenarios.map((scenario) => scenario.id), EXPECTED_SCENARIOS)
  ) {
    throw new Error("scenario order/set contradiction");
  }
  for (const [index, target] of ["js-controlled", "wasm-linear-controlled"].entries()) {
    const scenario = scenarios[index];
    const result = scenario.fullResult as Record<string, unknown>;
    if (
      scenario.mode !== "native-full" || scenario.target !== target ||
      result?.executionMode !== "full-2^20-correctness" || result?.sampleCount !== 1_048_576 ||
      result?.componentsValidated !== 2_097_152 ||
      result?.completeOutputSha256 !== EXPECTED_OUTPUT_SHA256 ||
      result?.quantizedOutputSha256 !== EXPECTED_QUANTIZED_SHA256 ||
      !same(result?.checkpoints, EXPECTED_CHECKPOINTS) ||
      !same(result?.registeredOracle, EXPECTED_ORACLE) ||
      !same(
        result?.counters,
        expectedCounters(target as "js-controlled" | "wasm-linear-controlled"),
      )
    ) throw new Error(`${target} full result contradiction`);
  }
  const causalEvents: Record<string, string[]> = {
    "wrong-token": ["start", "inject-wrong-token", "ignored"],
    "stale-error": ["start", "cancel", "restart", "inject-stale-error", "ignored"],
    restart: ["start", "cancel", "restart", "new-worker-active"],
    cancel: ["start", "cancel", "late-message", "ignored"],
    timeout: ["start", "timeout-fired", "worker-terminated"],
    pagehide: ["start", "pagehide", "worker-terminated", "late-message", "ignored"],
  };
  for (const scenario of scenarios.slice(2)) {
    if (scenario.mode !== "instrumented-lifecycle" || scenario.fullResult !== null) {
      throw new Error(`${scenario.id} incorrectly carries native evidence`);
    }
    const events = (scenario.causes as Array<Record<string, unknown>>).map((cause) => cause.event);
    if (!same(events, causalEvents[String(scenario.id)])) {
      throw new Error(`${scenario.id} causal chain contradiction`);
    }
  }
  for (const scenario of scenarios) {
    const assets = scenario.assets as Array<Record<string, unknown>>;
    const expectedRoutes = scenario.target === "wasm-linear-controlled"
      ? Object.keys(NUMERIC_FFT_EXECUTABLE_ROUTES)
      : scenario.target === "js-controlled"
      ? Object.keys(NUMERIC_FFT_EXECUTABLE_ROUTES).filter((route) => !route.endsWith(".wasm"))
      : ["/benchmarks/numeric-fft-spectral-filter-v1/demo.js"];
    if (!same(assets.map((asset) => asset.route), expectedRoutes)) {
      throw new Error(`${scenario.id} executable route set contradiction`);
    }
    for (const asset of assets) {
      const fetched = asset.fetched as Record<string, unknown>;
      const executed = asset.executed as Record<string, unknown>;
      if (
        asset.byteIdentical !== true ||
        !same(fetched, { bytes: executed.bytes, sha256: executed.sha256 })
      ) {
        throw new Error(`${scenario.id} fetched/executed contradiction`);
      }
    }
  }
  const cleanup = value.cleanup as Record<string, unknown>;
  const chrome = cleanup.browser as Record<string, unknown>;
  const profile = cleanup.profile as Record<string, unknown>;
  const server = cleanup.server as Record<string, unknown>;
  if (
    chrome.cgroupEmpty !== true || !same(chrome.remainingPids, []) || profile.absent !== true ||
    server.processAbsent !== true || (cleanup.stage as Record<string, unknown>).absent !== true
  ) throw new Error("exact owned cleanup is incomplete");
}

export async function runCleanupBoundCollection<T>(dependencies: {
  collect: () => Promise<T>;
  cleanupBrowser: () => Promise<void>;
  cleanupServer: () => Promise<void>;
  cleanupStage: () => Promise<void>;
}): Promise<T> {
  let result: T | undefined;
  let primary: unknown;
  try {
    result = await dependencies.collect();
  } catch (error) {
    primary = error;
  }
  const cleanupErrors: unknown[] = [];
  for (
    const cleanup of [
      dependencies.cleanupBrowser,
      dependencies.cleanupServer,
      dependencies.cleanupStage,
    ]
  ) {
    try {
      await cleanup();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length) {
    throw new Error(`collector cleanup failed: ${cleanupErrors.map(String).join("; ")}`, {
      cause: primary,
    });
  }
  if (primary) throw primary;
  return result!;
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
    } catch { /* retry only the owned loopback endpoint */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`owned loopback server unavailable: ${url}`);
}

type Sender = Pick<BrowserClient, "send" | "on">;
function value(result: Record<string, unknown>): unknown {
  return (result.result as Record<string, unknown>)?.value;
}

async function state(client: Sender, sessionId: string): Promise<Record<string, unknown>> {
  const result = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression:
      `(() => ({status:document.querySelector('#status')?.textContent.trim(),result:document.querySelector('#result')?.textContent.trim(),startDisabled:document.querySelector('#start')?.disabled,cancelDisabled:document.querySelector('#cancel')?.disabled,progress:document.querySelector('#progress')?.value ?? null,history:globalThis.__fftCollectorHistory ?? []}))()`,
  }, sessionId);
  return value(result) as Record<string, unknown>;
}

async function waitState(
  client: Sender,
  sessionId: string,
  predicate: (state: Record<string, unknown>) => boolean,
  timeoutMs = 125_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  let last: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    last = await state(client, sessionId);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`browser state timeout: ${JSON.stringify(last)}`);
}

async function evaluate(client: Sender, sessionId: string, expression: string): Promise<unknown> {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(`browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  }
  return value(result);
}

const instrumentation = `(() => {
  globalThis.__fftCollectorHistory=[];
  addEventListener('DOMContentLoaded',()=>{
    const status=document.querySelector('#status');
    const snap=()=>globalThis.__fftCollectorHistory.push({sequence:globalThis.__fftCollectorHistory.length,status:status.textContent.trim(),result:document.querySelector('#result').textContent.trim(),startDisabled:document.querySelector('#start').disabled,cancelDisabled:document.querySelector('#cancel').disabled});
    snap(); new MutationObserver(snap).observe(status,{childList:true,subtree:true,characterData:true});
  });
  if (!location.search.includes('collector-lifecycle=')) return;
  const nativeSetTimeout=globalThis.setTimeout;
  globalThis.setTimeout=(callback,delay,...args)=>nativeSetTimeout(callback,delay===120000?30:delay,...args);
  const workers=[];
  class ControlledWorker {
    constructor(url,options){this.url=String(url);this.options=options;this.onmessage=null;this.onerror=null;this.terminated=false;this.posts=[];workers.push(this);}
    postMessage(message){this.posts.push(structuredClone(message));}
    terminate(){this.terminated=true;}
  }
  globalThis.Worker=ControlledWorker;
  globalThis.__fftCollectorControl={
    workers,
    emit(index,data){workers[index].onmessage?.({data:structuredClone(data)});},
    error(index){workers[index].onerror?.(new ErrorEvent('error'));},
    summary(){return workers.map((worker)=>({terminated:worker.terminated,posts:worker.posts}));}
  };
})();`;

async function click(client: Sender, sessionId: string, selector: string): Promise<void> {
  const bounds = await evaluate(
    client,
    sessionId,
    `(() => { const node=document.querySelector(${
      JSON.stringify(selector)
    }); const rect=node.getBoundingClientRect(); return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,disabled:node.disabled}; })()`,
  ) as { x: number; y: number; disabled: boolean };
  if (bounds.disabled) throw new Error(`visible control is disabled: ${selector}`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: bounds.x,
    y: bounds.y,
    button: "left",
    clickCount: 1,
  }, sessionId);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: bounds.x,
    y: bounds.y,
    button: "left",
    clickCount: 1,
  }, sessionId);
}

async function captureScenario(
  browser: OwnedChrome,
  origin: string,
  id: (typeof EXPECTED_SCENARIOS)[number],
  outputManifest: Record<string, unknown>,
): Promise<{ record: Record<string, unknown>; screenshot: Uint8Array }> {
  const client = browser.browser;
  const native = id === "complete-js" || id === "complete-wasm";
  const target = id === "complete-wasm" ? "wasm-linear-controlled" : "js-controlled";
  const created = await client.send("Target.createTarget", { url: "about:blank" });
  const targetId = String(created.targetId);
  const attached = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const sessionId = String(attached.sessionId);
  const sessions = new Set([sessionId]);
  const consoleEntries: Record<string, unknown>[] = [];
  const exceptions: Record<string, unknown>[] = [];
  const network = new Map<string, Record<string, unknown>>();
  const fetchedBodies = new Map<string, Uint8Array>();
  const executedBodies = new Map<string, { bytes: Uint8Array; method: string }>();
  const pending: Promise<void>[] = [];
  const removers = [
    client.on("Target.attachedToTarget", (params, ownerSession) => {
      if (ownerSession !== sessionId) return;
      const info = params.targetInfo as Record<string, unknown>;
      if (info.type !== "worker") return;
      const workerSession = String(params.sessionId);
      sessions.add(workerSession);
      pending.push(
        Promise.all([
          client.send("Network.enable", {}, workerSession),
          client.send("Runtime.enable", {}, workerSession),
          client.send("Debugger.enable", {}, workerSession),
        ]).then(() =>
          client.send("Network.setCacheDisabled", { cacheDisabled: true }, workerSession)
        ).then(() => client.send("Runtime.runIfWaitingForDebugger", {}, workerSession)).then(
          () => {},
        ),
      );
    }),
    client.on("Runtime.consoleAPICalled", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      consoleEntries.push({
        session: eventSession === sessionId ? "page" : "worker",
        type: String(params.type),
        arguments: ((params.args as Record<string, unknown>[]) ?? []).map((arg) =>
          String(arg.value ?? arg.description ?? arg.type)
        ),
      });
    }),
    client.on("Runtime.exceptionThrown", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      const details = params.exceptionDetails as Record<string, unknown>;
      exceptions.push({
        session: eventSession === sessionId ? "page" : "worker",
        text: String(details.text),
        lineNumber: Number(details.lineNumber),
      });
    }),
    client.on("Network.requestWillBeSent", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      const request = params.request as Record<string, unknown>;
      const key = `${eventSession}:${params.requestId}`;
      network.set(key, {
        key,
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
    }),
    client.on("Network.responseReceived", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      const item = network.get(`${eventSession}:${params.requestId}`);
      const response = params.response as Record<string, unknown>;
      if (item) {
        Object.assign(item, {
          status: Number(response.status),
          mimeType: String(response.mimeType),
          fromDiskCache: Boolean(response.fromDiskCache),
          fromServiceWorker: Boolean(response.fromServiceWorker),
        });
      }
    }),
    client.on("Network.loadingFailed", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      const item = network.get(`${eventSession}:${params.requestId}`);
      if (item) Object.assign(item, { failed: true, errorText: String(params.errorText) });
    }),
    client.on("Network.loadingFinished", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      const item = network.get(`${eventSession}:${params.requestId}`);
      if (!item) return;
      pending.push((async () => {
        const body = await client.send(
          "Network.getResponseBody",
          { requestId: params.requestId },
          eventSession,
        );
        const bytes = body.base64Encoded
          ? Uint8Array.from(atob(String(body.body)), (character) => character.charCodeAt(0))
          : new TextEncoder().encode(String(body.body));
        item.bodyBytes = bytes.byteLength;
        item.bodySha256 = await sha256Hex(bytes);
        fetchedBodies.set(new URL(String(item.url)).pathname, bytes);
      })());
    }),
    client.on("Debugger.scriptParsed", (params, eventSession) => {
      if (!eventSession || !sessions.has(eventSession)) return;
      const url = String(params.url ?? "");
      let path: string;
      try {
        path = new URL(url).pathname;
      } catch {
        return;
      }
      if (!(path in NUMERIC_FFT_EXECUTABLE_ROUTES)) return;
      pending.push((async () => {
        const wasm = params.scriptLanguage === "WebAssembly" || path.endsWith(".wasm");
        const response = await client.send(
          wasm ? "Debugger.getWasmBytecode" : "Debugger.getScriptSource",
          { scriptId: params.scriptId },
          eventSession,
          20_000,
        );
        const bytes = wasm
          ? Uint8Array.from(atob(String(response.bytecode)), (character) => character.charCodeAt(0))
          : new TextEncoder().encode(String(response.scriptSource));
        executedBodies.set(path, {
          bytes,
          method: wasm ? "Debugger.getWasmBytecode" : "Debugger.getScriptSource",
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
      client.send("Debugger.enable", {}, sessionId),
      client.send("Accessibility.enable", {}, sessionId),
      client.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: true,
        flatten: true,
      }, sessionId),
    ]);
    await client.send(
      "Page.addScriptToEvaluateOnNewDocument",
      { source: instrumentation },
      sessionId,
    );
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("page load timeout")), 10_000);
      const remove = client.on("Page.loadEventFired", (_params, eventSession) => {
        if (eventSession !== sessionId) return;
        clearTimeout(timer);
        remove();
        resolve();
      });
    });
    const suffix = native ? "" : `?collector-lifecycle=${id}`;
    await client.send("Page.navigate", { url: `${origin}${ROUTE}${suffix}` }, sessionId);
    await loaded;
    await waitState(client, sessionId, (page) => String(page.status).startsWith("Ready."), 10_000);
    await evaluate(
      client,
      sessionId,
      `document.querySelector('#target').value=${JSON.stringify(target)}`,
    );

    const causes: Record<string, unknown>[] = [];
    const cause = (
      event: string,
      workerIndex: number | null,
      token: number | null,
      detail: string,
    ) => causes.push({ sequence: causes.length, event, workerIndex, token, detail });
    await click(client, sessionId, "#start");
    cause("start", 0, 1, "visible Start control invoked the first worker");
    let finalState: Record<string, unknown>;
    let fullResult: Record<string, unknown> | null = null;
    if (native) {
      finalState = await waitState(
        client,
        sessionId,
        (page) => page.status === "Complete output matched the registered SHA-256.",
      );
      fullResult = JSON.parse(String(finalState.result)) as Record<string, unknown>;
      Object.assign(fullResult!, {
        executionMode: "full-2^20-correctness",
        sampleCount: 1_048_576,
        registeredOracle: (outputManifest.oracle as Record<string, unknown>)[
          target === "js-controlled" ? "js" : "wasm"
        ],
      });
      causes.length = 0;
      cause("start", 0, 1, "visible Start control invoked the native worker");
      cause("complete", 0, 1, "native worker complete-output digest was accepted");
    } else if (id === "wrong-token") {
      await evaluate(
        client,
        sessionId,
        `__fftCollectorControl.emit(0,{type:'error',token:999,message:'wrong token'})`,
      );
      cause("inject-wrong-token", 0, 999, "collector injected a message with a non-current token");
      finalState = await state(client, sessionId);
      cause("ignored", 0, 999, "status and accepted result did not change");
    } else if (id === "stale-error") {
      await click(client, sessionId, "#cancel");
      cause("cancel", 0, null, "first worker was cancelled");
      await click(client, sessionId, "#start");
      cause("restart", 1, 3, "a new worker and token were created");
      await evaluate(client, sessionId, `__fftCollectorControl.error(0)`);
      cause("inject-stale-error", 0, 1, "collector invoked the first worker's stale error handler");
      finalState = await state(client, sessionId);
      cause("ignored", 0, 1, "second worker remained active");
    } else if (id === "restart") {
      await click(client, sessionId, "#cancel");
      cause("cancel", 0, null, "first worker was cancelled");
      await click(client, sessionId, "#start");
      cause("restart", 1, 3, "visible Start created a replacement worker");
      finalState = await state(client, sessionId);
      cause("new-worker-active", 1, 3, "replacement worker owns the running state");
    } else if (id === "cancel") {
      await click(client, sessionId, "#cancel");
      cause("cancel", 0, null, "visible Cancel terminated the worker");
      await evaluate(
        client,
        sessionId,
        `__fftCollectorControl.emit(0,{type:'result',token:1,result:{passed:true}})`,
      );
      cause("late-message", 0, 1, "collector injected a result after cancellation");
      finalState = await state(client, sessionId);
      cause("ignored", 0, 1, "cancel status and no-result state remained");
    } else if (id === "timeout") {
      finalState = await waitState(
        client,
        sessionId,
        (page) => String(page.status).startsWith("Timed out"),
        2_000,
      );
      cause(
        "timeout-fired",
        0,
        1,
        "the exact 120000 ms callback was accelerated by lifecycle instrumentation",
      );
      cause("worker-terminated", 0, 1, "timeout reset terminated the owned fake worker");
    } else {
      await evaluate(client, sessionId, `dispatchEvent(new PageTransitionEvent('pagehide'))`);
      cause("pagehide", 0, 1, "collector dispatched pagehide");
      cause("worker-terminated", 0, 1, "pagehide terminated the worker");
      await evaluate(
        client,
        sessionId,
        `__fftCollectorControl.emit(0,{type:'result',token:1,result:{passed:true}})`,
      );
      cause("late-message", 0, 1, "collector injected a result after pagehide");
      finalState = await state(client, sessionId);
      cause("ignored", 0, 1, "late result was not accepted");
    }
    if (!native) {
      if (id === "wrong-token") {
        await evaluate(client, sessionId, `dispatchEvent(new PageTransitionEvent('pagehide'))`);
      }
      const summary = await evaluate(client, sessionId, `__fftCollectorControl.summary()`);
      const workerSummary = summary as Array<Record<string, unknown>>;
      if (!workerSummary.some((worker) => worker.terminated === true)) {
        throw new Error(`${id} did not terminate an owned lifecycle worker`);
      }
    }
    await Promise.all(pending);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await Promise.all(pending);
    if (
      exceptions.length || [...network.values()].some((item) => item.failed || item.status !== 200)
    ) {
      throw new Error(`${id} browser console/network failure`);
    }
    const rawAssets = [];
    for (const route of Object.keys(NUMERIC_FFT_EXECUTABLE_ROUTES)) {
      const fetched = fetchedBodies.get(route), executed = executedBodies.get(route);
      if (!fetched || !executed) continue;
      rawAssets.push({
        route,
        fetched: { bytes: fetched.byteLength, sha256: await sha256Hex(fetched) },
        executed: {
          bytes: executed.bytes.byteLength,
          sha256: await sha256Hex(executed.bytes),
          protocolMethod: executed.method,
        },
      });
    }
    const expectedRoutes = target === "wasm-linear-controlled" && native
      ? Object.keys(NUMERIC_FFT_EXECUTABLE_ROUTES)
      : native
      ? Object.keys(NUMERIC_FFT_EXECUTABLE_ROUTES).filter((route) => !route.endsWith(".wasm"))
      : ["/benchmarks/numeric-fft-spectral-filter-v1/demo.js"];
    const assets = await attestFetchedExecutedAssets(
      rawAssets.filter((asset) => expectedRoutes.includes(asset.route)),
      expectedRoutes,
    );
    const ax = await client.send("Accessibility.getFullAXTree", {}, sessionId);
    const nodes = (ax.nodes as Array<Record<string, unknown>>) ?? [];
    const axText = canonicalize(nodes);
    const accessibility = {
      nodeCount: nodes.length,
      treeSha256: await sha256Hex(axText),
      checks: {
        document: nodes.some((node) =>
          (node.role as Record<string, unknown>)?.value === "RootWebArea"
        ),
        main: nodes.some((node) => (node.role as Record<string, unknown>)?.value === "main"),
        startButton: nodes.some((node) =>
          (node.name as Record<string, unknown>)?.value === "Start"
        ),
        cancelButton: nodes.some((node) =>
          (node.name as Record<string, unknown>)?.value === "Cancel"
        ),
        statusLiveRegion: nodes.some((node) =>
          (node.role as Record<string, unknown>)?.value === "status"
        ),
        resultFocusable:
          await evaluate(client, sessionId, `document.querySelector('#result').tabIndex===0`) ===
            true,
      },
    };
    if (Object.values(accessibility.checks).some((check) => !check)) {
      throw new Error(`${id} accessibility assertion failed`);
    }
    const shot = await client.send(
      "Page.captureScreenshot",
      {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: true,
      },
      sessionId,
      10_000,
    );
    const screenshot = Uint8Array.from(
      atob(String(shot.data)),
      (character) => character.charCodeAt(0),
    );
    const screenshotPath = `screenshots/${id}.png`;
    return {
      screenshot,
      record: {
        id,
        route: ROUTE,
        mode: native ? "native-full" : "instrumented-lifecycle",
        target: native ? target : null,
        action: native ? "complete" : id,
        causes,
        states: (finalState.history as Array<Record<string, unknown>>) ?? [],
        finalState: {
          status: String(finalState.status),
          result: String(finalState.result),
          startDisabled: Boolean(finalState.startDisabled),
          cancelDisabled: Boolean(finalState.cancelDisabled),
          progress: Number(finalState.progress ?? 0),
        },
        fullResult,
        assertions: native
          ? ["full 2^20 mode", "complete output hash", "registered f64 oracle", "exact counters"]
          : [
            "causal event injected",
            "current UI state observed",
            "late or stale acceptance denied",
          ],
        console: consoleEntries,
        exceptions,
        network: [...network.values()].map(({ key: _key, ...item }) => item),
        assets,
        accessibility,
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

async function main(args: CollectorArguments): Promise<void> {
  if (Deno.version.deno !== "2.9.0") throw new Error("collector requires exact Deno 2.9.0");
  const source = await attestCleanNumericFftSource(args.sourceCommit);
  const outputManifest = JSON.parse(
    await Deno.readTextFile(
      new URL("public/artifacts/numeric-fft-spectral-filter/output-manifest.json", root),
    ),
  );
  const inspection = await inspectChromePackage(args.chrome, args.chromeSha256);
  const stageAuthorization = {
    permitId: "numeric-fft-browser-evidence-v1",
    sourceCommit: args.sourceCommit,
    chromePackageManifestSha256: inspection.manifestSha256,
  };
  let stage: StagedChrome | undefined;
  const serverPort = unusedPort();
  const origin = `http://127.0.0.1:${serverPort}`;
  let serverProcess: Deno.ChildProcess | undefined;
  let serverStatus: Promise<Deno.CommandStatus> | undefined;
  let serverIdentity: ProcessIdentity | null = null;
  let owned: OwnedChrome | undefined;
  let browserCleanup: Record<string, unknown> | undefined;
  let effectiveArguments: string[] | undefined;
  let serverCleanup: Record<string, unknown> | undefined;
  let stageRemoved = false;
  const payload = await runCleanupBoundCollection({
    collect: async () => {
      stage = await stageChromePackage(args.chrome, args.chromeSha256, stageAuthorization);
      serverProcess = new Deno.Command(Deno.execPath(), {
        cwd: root,
        args: [
          "run",
          "--allow-net=127.0.0.1",
          "--allow-read=benchmarks/base/numeric-fft-spectral-filter,public/benchmarks/numeric-fft-spectral-filter-v1,public/artifacts/numeric-fft-spectral-filter,public/styles.css",
          "scripts/serve-numeric-fft-spectral-filter-evidence.ts",
          `--port=${serverPort}`,
        ],
        stdout: "null",
        stderr: "piped",
      }).spawn();
      serverStatus = serverProcess.status;
      serverIdentity = await processIdentity(serverProcess.pid);
      await waitFor(`${origin}/healthz`);
      serverIdentity = await processIdentity(serverProcess.pid);
      if (!serverIdentity) throw new Error("owned evidence server identity disappeared");
      const profileRoot =
        `/tmp/wasm-vs-js-owned-profiles/numeric-fft-${crypto.randomUUID()}/chrome`;
      owned = await launchOwnedChrome({
        stagedChrome: stage,
        profileRoot,
        extraArguments: [
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
        ],
        beforeSpawn: () => recordStageCleanupLifecycle(stage!, "owned-launch-active"),
      });
      if (
        owned.version.product !== args.chromeProduct || owned.binarySha256 !== args.chromeSha256
      ) {
        throw new Error("launched Chrome exact product/hash mismatch");
      }
      const effective = await owned.browser.send("Browser.getBrowserCommandLine");
      if (!Array.isArray(effective.arguments)) {
        throw new Error("effective Chrome arguments unavailable");
      }
      effectiveArguments = effective.arguments.map(String);
      const screenshots = new Map<string, Uint8Array>(), records = [];
      for (const id of EXPECTED_SCENARIOS) {
        const scenario = await captureScenario(owned, origin, id, outputManifest);
        records.push(scenario.record);
        screenshots.set(
          String((scenario.record.screenshot as Record<string, unknown>).path),
          scenario.screenshot,
        );
      }
      owned.ledger = await refreshLedger(owned.ledger);
      return { records, screenshots };
    },
    cleanupBrowser: async () => {
      if (!owned) return;
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
        recordStageCleanupLifecycle(stage!, "cleanup-unresolved");
        throw error;
      }
    },
    cleanupServer: async () => {
      if (!serverProcess || !serverStatus) return;
      let signaled = Boolean(serverIdentity && await identityRunning(serverIdentity));
      if (signaled) Deno.kill(serverIdentity!.pid, "SIGTERM");
      else if (!serverIdentity) {
        try {
          serverProcess.kill("SIGTERM");
          signaled = true;
        } catch { /* the exact spawned child already exited */ }
      }
      const exit = await serverStatus;
      serverCleanup = {
        launcher: serverIdentity,
        signal: signaled ? "SIGTERM" : null,
        exit: { success: exit.success, code: exit.code, signal: exit.signal },
        processAbsent: serverIdentity ? !(await identityRunning(serverIdentity)) : true,
      };
      if (!(serverCleanup.processAbsent as boolean)) throw new Error("server cleanup failed");
    },
    cleanupStage: async () => {
      if (!stage || stage.cleanupLifecycle === "cleanup-unresolved") return;
      await removeStagedChrome(stage);
      stageRemoved = true;
    },
  });
  if (
    !payload || !stage || !owned || !effectiveArguments || !browserCleanup || !serverCleanup ||
    !stageRemoved
  ) {
    throw new Error("collector did not reach exact-cleanup commit gate");
  }
  const denoExecutable = await Deno.realPath(Deno.execPath());
  const evidence: Record<string, unknown> = {
    schemaVersion: 1,
    evidenceId: "numeric-fft-spectral-filter-chrome-parent-v1",
    collectedAt: new Date().toISOString(),
    source,
    collector: {
      denoVersion: Deno.version.deno,
      executable: {
        path: denoExecutable,
        sha256: await sha256Hex(await Deno.readFile(denoExecutable)),
      },
      commandLine: new TextDecoder().decode(await Deno.readFile("/proc/self/cmdline")).split("\0")
        .filter(Boolean),
      scriptArguments: Deno.args,
      parentPid: Deno.ppid,
      pid: Deno.pid,
    },
    browser: {
      product: String(owned.version.product),
      expectedProduct: args.chromeProduct,
      revision: String(owned.version.revision),
      userAgent: String(owned.version.userAgent),
      jsVersion: String(owned.version.jsVersion),
      executable: owned.ledger.executable,
      expectedSha256: args.chromeSha256,
      configuredArguments: owned.arguments,
      effectiveArguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
      endpoint: { host: "127.0.0.1", port: owned.port, browserPath: owned.browserPath },
      profile: owned.ledger.profile,
    },
    server: {
      origin,
      loopbackOnly: true,
      mode: "public",
      launcher: serverIdentity,
      arguments: [
        "scripts/serve-numeric-fft-spectral-filter-evidence.ts",
        "HOST=127.0.0.1",
        `PORT=${serverPort}`,
      ],
    },
    workload: {
      entryId: "numeric.fft-spectral-filter.v1",
      implementationId: "numeric-fft-spectral-filter-controlled-v1",
      mode: "correctness-only-no-timing",
      sampleCount: 1_048_576,
      components: 2_097_152,
      completeOutputSha256: EXPECTED_OUTPUT_SHA256,
      quantizedOutputSha256: EXPECTED_QUANTIZED_SHA256,
      oracleMethod: "independent-scalar-f64-radix-2",
      performanceSamples: [],
    },
    scenarios: payload.records,
    cleanup: {
      browser: browserCleanup,
      profile: {
        path: owned.ledger.profileRoot,
        dev: owned.ledger.profile.profileDev,
        ino: owned.ledger.profile.profileIno,
        removed: true,
        absent: true,
      },
      server: serverCleanup,
      stage: {
        root: stage.root,
        dev: stage.rootDev,
        ino: stage.rootIno,
        removed: true,
        absent: true,
      },
    },
  };
  const schema = JSON.parse(
    await Deno.readTextFile(
      new URL("schemas/numeric-fft-spectral-filter-browser-evidence.schema.json", root),
    ),
  );
  type Validator = ((value: unknown) => boolean) & { errors?: unknown };
  type AjvConstructor = new (options?: Record<string, unknown>) => {
    compile(schema: unknown): Validator;
  };
  const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
    Ajv2020Module) as unknown as AjvConstructor;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validate(evidence)) {
    throw new Error(`browser evidence schema failed: ${JSON.stringify(validate.errors)}`);
  }
  assertNumericFftBrowserEvidenceSemantics(evidence);
  const outputRoot = args.output.replace(/\/$/, "");
  await Deno.mkdir(outputRoot, { recursive: false });
  await Deno.mkdir(`${outputRoot}/screenshots`, { recursive: false });
  for (const [path, bytes] of payload.screenshots) {
    await Deno.writeFile(`${outputRoot}/${path}`, bytes, { createNew: true });
  }
  await Deno.writeTextFile(`${outputRoot}/evidence.v1.json`, `${canonicalize(evidence)}\n`, {
    createNew: true,
  });
}

if (import.meta.main) {
  await main(parseNumericFftCollectorArguments(Deno.args));
}

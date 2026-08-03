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
  inspectChromePackage,
  recordStageCleanupLifecycle,
  removeStagedChrome,
  stageChromePackage,
  StagedChrome,
} from "../lib/chrome-stage.ts";
import { refreshLedger } from "../lib/process-ledger.ts";
import { assertCheckoutStatus } from "../lib/source-identity.ts";

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
export const REVIEWED_CHROME_EXTRA_ARGUMENTS = [
  "--enable-automation",
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
  "lib/source-identity.ts",
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

export function reviewedChromeArguments(profileRoot: string): string[] {
  return [
    `--user-data-dir=${profileRoot}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    ...REVIEWED_CHROME_EXTRA_ARGUMENTS,
    "about:blank",
  ];
}

export function numericFftServerArguments(port: number): string[] {
  return [
    "run",
    "--allow-net=127.0.0.1",
    "--allow-read=benchmarks/base/numeric-fft-spectral-filter,public/benchmarks/numeric-fft-spectral-filter-v1,public/artifacts/numeric-fft-spectral-filter,public/styles.css",
    "scripts/serve-numeric-fft-spectral-filter-evidence.ts",
    `--port=${port}`,
  ];
}

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
    "--ignored=matching",
  ]);
  if (!status.success) throw new Error("git status unavailable");
  try {
    assertCheckoutStatus(new TextDecoder().decode(status.stdout));
  } catch {
    throw new Error("numeric FFT browser collection requires a completely clean checkout");
  }
  const statusText = new TextDecoder().decode(status.stdout);
  const ignoredEntries = statusText.split("\0").filter(Boolean).map((entry) => entry.slice(3));
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
    ignoredEntries,
    files,
  };
}

export function assertNumericFftSourceRecheck(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): void {
  if (!same(before, after)) throw new Error("source changed between start and end checks");
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

export function assertLifecycleScenarioObservations(
  id: string,
  observations: LifecycleObservation[],
): void {
  const posted = (token: number) => [{ type: "start", token, target: "js-controlled" }];
  const worker = (terminated: boolean, token: number) => ({ terminated, posts: posted(token) });
  const view = (
    label: string,
    status: string,
    result: string,
    startDisabled: boolean,
    cancelDisabled: boolean,
    workers: LifecycleObservation["workers"],
  ): LifecycleObservation => ({
    label,
    status,
    result,
    startDisabled,
    cancelDisabled,
    progress: 0,
    workers,
  });
  const ready = view(
    "ready",
    "Ready. The worker timeout is 120 seconds.",
    "No run yet.",
    false,
    true,
    [],
  );
  const running = (label: string, workers: LifecycleObservation["workers"]) =>
    view(
      label,
      "Generating the frozen 2^20-sample fixture.",
      "No result accepted yet.",
      true,
      false,
      workers,
    );
  const canceled = (label: string, workers: LifecycleObservation["workers"]) =>
    view(
      label,
      "Cancelled. Late messages from the terminated worker are ignored.",
      "No result accepted.",
      false,
      true,
      workers,
    );
  const start = running("after-start", [worker(false, 1)]);
  let expected: LifecycleObservation[];
  if (id === "wrong-token") {
    expected = [ready, start, running("after-wrong-token", [worker(false, 1)])];
  } else if (id === "stale-error") {
    expected = [
      ready,
      start,
      canceled("after-cancel", [worker(true, 1)]),
      running("after-restart", [worker(true, 1), worker(false, 3)]),
      running("after-stale-error", [worker(true, 1), worker(false, 3)]),
    ];
  } else if (id === "restart") {
    expected = [
      ready,
      start,
      canceled("after-cancel", [worker(true, 1)]),
      running("after-restart", [worker(true, 1), worker(false, 3)]),
    ];
  } else if (id === "cancel") {
    expected = [
      ready,
      start,
      canceled("after-cancel", [worker(true, 1)]),
      canceled("after-late-message", [worker(true, 1)]),
    ];
  } else if (id === "timeout") {
    expected = [
      ready,
      start,
      view(
        "after-timeout",
        "Timed out after 120 seconds; the worker was terminated.",
        "No result accepted.",
        false,
        true,
        [worker(true, 1)],
      ),
    ];
  } else if (id === "pagehide") {
    expected = [
      ready,
      start,
      running("after-pagehide", [worker(true, 1)]),
      running("after-late-message", [worker(true, 1)]),
    ];
  } else throw new Error(`unknown lifecycle scenario: ${id}`);
  if (!same(observations, expected)) throw new Error(`${id} lifecycle observation contradiction`);
}

export function assertNumericFftBrowserEvidenceSemantics(value: Record<string, unknown>): void {
  const source = value.source as Record<string, unknown>;
  if (
    source?.clean !== true || !/^[a-f0-9]{64}$/.test(String(source.statusPorcelainSha256)) ||
    !same(source.verificationPasses, ["before-launch", "after-cleanup-before-publication"])
  ) {
    throw new Error("source clean attestation contradiction");
  }
  const ignoredEntries = source.ignoredEntries as string[];
  if (
    !ignoredEntries.every((path) =>
      path === ".pi-subagents/" || path === "raw/permits/" || path.startsWith("raw/permits/") ||
      path === "raw/corpora/" || path.startsWith("raw/corpora/")
    )
  ) throw new Error("source ignored-entry contradiction");
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
    !same(configured, reviewedChromeArguments(String(browserProfile.profileRoot))) ||
    !configured.every((argument) => effective.includes(argument))
  ) {
    throw new Error("Chrome reviewed argument contradiction");
  }
  const scenarios = value.scenarios as Array<Record<string, unknown>>;
  if (
    !Array.isArray(scenarios) || !same(scenarios.map((scenario) => scenario.id), EXPECTED_SCENARIOS)
  ) {
    throw new Error("scenario order/set contradiction");
  }
  const expectedCauses: Record<string, Array<[string, number | null, number | null]>> = {
    "complete-js": [["start", 0, 1], ["complete", 0, 1]],
    "complete-wasm": [["start", 0, 1], ["complete", 0, 1]],
    "wrong-token": [["start", 0, 1], ["inject-wrong-token", 0, 999], ["ignored", 0, 999]],
    "stale-error": [
      ["start", 0, 1],
      ["cancel", 0, null],
      ["restart", 1, 3],
      ["inject-stale-error", 0, 1],
      ["ignored", 0, 1],
    ],
    restart: [
      ["start", 0, 1],
      ["cancel", 0, null],
      ["restart", 1, 3],
      ["new-worker-active", 1, 3],
    ],
    cancel: [
      ["start", 0, 1],
      ["cancel", 0, null],
      ["late-message", 0, 1],
      ["ignored", 0, 1],
    ],
    timeout: [["start", 0, 1], ["timeout-fired", 0, 1], ["worker-terminated", 0, 1]],
    pagehide: [
      ["start", 0, 1],
      ["pagehide", 0, 1],
      ["worker-terminated", 0, 1],
      ["late-message", 0, 1],
      ["ignored", 0, 1],
    ],
  };
  for (const [index, scenario] of scenarios.entries()) {
    const id = String(scenario.id), native = index < 2;
    const expectedTarget = index === 0
      ? "js-controlled"
      : index === 1
      ? "wasm-linear-controlled"
      : null;
    const expectedAction = native ? "complete" : id;
    if (scenario.target !== expectedTarget || scenario.action !== expectedAction) {
      throw new Error(`${id} target/action contradiction`);
    }
    const causes = (scenario.causes as Array<Record<string, unknown>>).map((cause, sequence) => [
      cause.event,
      cause.workerIndex,
      cause.token,
      cause.sequence === sequence,
    ]);
    const expected = expectedCauses[id].map(([event, workerIndex, token]) => [
      event,
      workerIndex,
      token,
      true,
    ]);
    if (!same(causes, expected)) throw new Error(`${id} causal sequence/token contradiction`);
    const result = scenario.fullResult as Record<string, unknown> | null;
    if (native) {
      const target = expectedTarget as "js-controlled" | "wasm-linear-controlled";
      if (
        scenario.mode !== "native-full" || result?.target !== target ||
        result?.executionMode !== "full-2^20-correctness" || result?.sampleCount !== 1_048_576 ||
        result?.componentsValidated !== 2_097_152 ||
        result?.completeOutputSha256 !== EXPECTED_OUTPUT_SHA256 ||
        result?.quantizedOutputSha256 !== EXPECTED_QUANTIZED_SHA256 ||
        !same(result?.checkpoints, EXPECTED_CHECKPOINTS) ||
        !same(result?.registeredOracle, EXPECTED_ORACLE) ||
        !same(result?.counters, expectedCounters(target)) || !same(scenario.observations, []) ||
        !same(
          {
            status: (scenario.finalState as Record<string, unknown>).status,
            startDisabled: (scenario.finalState as Record<string, unknown>).startDisabled,
            cancelDisabled: (scenario.finalState as Record<string, unknown>).cancelDisabled,
            progress: (scenario.finalState as Record<string, unknown>).progress,
          },
          {
            status: "Complete output matched the registered SHA-256.",
            startDisabled: false,
            cancelDisabled: true,
            progress: 4,
          },
        )
      ) throw new Error(`${target} full result contradiction`);
    } else {
      if (scenario.mode !== "instrumented-lifecycle" || result !== null) {
        throw new Error(`${id} incorrectly carries native evidence`);
      }
      const observations = scenario.observations as LifecycleObservation[];
      assertLifecycleScenarioObservations(id, observations);
      const last = observations.at(-1)!;
      if (
        !same(scenario.finalState, {
          status: last.status,
          result: last.result,
          startDisabled: last.startDisabled,
          cancelDisabled: last.cancelDisabled,
          progress: last.progress,
        })
      ) throw new Error(`${id} final status/control contradiction`);
    }
  }
  const serverSetup = value.server as Record<string, unknown>;
  const serverOrigin = String(serverSetup.origin);
  const serverLauncher = serverSetup.launcher as Record<string, unknown>;
  const serverArguments = serverSetup.arguments as string[];
  const serverPort = Number(new URL(serverOrigin).port);
  if (
    !same(serverArguments, [serverLauncher.executable, ...numericFftServerArguments(serverPort)])
  ) {
    throw new Error("actual server argv contradiction");
  }
  for (const scenario of scenarios) {
    const id = String(scenario.id);
    const screenshot = scenario.screenshot as Record<string, unknown>;
    if (screenshot.path !== `screenshots/${id}.png`) {
      throw new Error(`${id} screenshot identity contradiction`);
    }
    for (const request of scenario.network as Array<Record<string, unknown>>) {
      let requestOrigin: string;
      try {
        requestOrigin = new URL(String(request.url)).origin;
      } catch {
        throw new Error(`${id} network origin contradiction`);
      }
      if (requestOrigin !== serverOrigin) throw new Error(`${id} network origin contradiction`);
    }
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
  const stage = cleanup.stage as Record<string, unknown>;
  const containment = browser.containment as Record<string, unknown>;
  const stagedPackage = browser.stagedPackage as Record<string, unknown>;
  const profileSetup = browser.profile as Record<string, unknown>;
  if (
    chrome.cgroupEmpty !== true || !same(chrome.remainingPids, []) ||
    !same(chrome.observedPids as unknown[], [...new Set(chrome.observedPids as unknown[])]) ||
    !(chrome.observedPids as unknown[]).includes(chrome.mainPid) || profile.absent !== true ||
    server.processAbsent !== true || stage.absent !== true ||
    !same(
      Object.fromEntries(Object.keys(containment).map((key) => [key, chrome[key]])),
      containment,
    ) ||
    !same(
      { path: profile.path, dev: profile.dev, ino: profile.ino },
      {
        path: profileSetup.profileRoot,
        dev: profileSetup.profileDev,
        ino: profileSetup.profileIno,
      },
    ) ||
    !same(server.launcher, serverSetup.launcher) ||
    !same(
      { root: stage.root, dev: stage.dev, ino: stage.ino },
      stagedPackage,
    )
  ) throw new Error("exact owned cleanup identity contradiction");
}

export function chromeLaunchFailureContainment(error: unknown): {
  lifecycle: "cleanup-verified" | "cleanup-unresolved";
  retainStage: boolean;
  retainProfile: boolean;
} | null {
  if (!(error instanceof ChromeLaunchLifecycleError)) return null;
  return error.cleanupResolved
    ? { lifecycle: "cleanup-verified", retainStage: false, retainProfile: false }
    : { lifecycle: "cleanup-unresolved", retainStage: true, retainProfile: true };
}

export function mayRemoveChromeStage(
  lifecycle: string,
  retainUnresolvedContainment: boolean,
): boolean {
  return !retainUnresolvedContainment && lifecycle !== "cleanup-unresolved";
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

async function processCommandLine(pid: number): Promise<string[]> {
  return new TextDecoder().decode(await Deno.readFile(`/proc/${pid}/cmdline`)).split("\0")
    .filter(Boolean);
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

type LifecycleObservation = {
  label: string;
  status: string;
  result: string;
  startDisabled: boolean;
  cancelDisabled: boolean;
  progress: number;
  workers: Array<{
    terminated: boolean;
    posts: Array<{ type: string; token: number; target: string }>;
  }>;
};

async function lifecycleObservation(
  client: Sender,
  sessionId: string,
  label: string,
): Promise<LifecycleObservation> {
  const page = await state(client, sessionId);
  const workers = await evaluate(client, sessionId, `__fftCollectorControl.summary()`);
  return {
    label,
    status: String(page.status),
    result: String(page.result),
    startDisabled: Boolean(page.startDisabled),
    cancelDisabled: Boolean(page.cancelDisabled),
    progress: Number(page.progress ?? 0),
    workers: workers as LifecycleObservation["workers"],
  };
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
  globalThis.setTimeout=(callback,delay,...args)=>nativeSetTimeout(callback,delay===120000?1000:delay,...args);
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

    const observations: LifecycleObservation[] = [];
    if (!native) observations.push(await lifecycleObservation(client, sessionId, "ready"));
    const causes: Record<string, unknown>[] = [];
    const cause = (
      event: string,
      workerIndex: number | null,
      token: number | null,
      detail: string,
    ) => causes.push({ sequence: causes.length, event, workerIndex, token, detail });
    await click(client, sessionId, "#start");
    cause("start", 0, 1, "visible Start control invoked the first worker");
    if (!native) {
      observations.push(await lifecycleObservation(client, sessionId, "after-start"));
    }
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
      observations.push(await lifecycleObservation(client, sessionId, "after-wrong-token"));
      cause("ignored", 0, 999, "status and accepted result did not change");
    } else if (id === "stale-error") {
      await click(client, sessionId, "#cancel");
      cause("cancel", 0, null, "first worker was cancelled");
      observations.push(await lifecycleObservation(client, sessionId, "after-cancel"));
      await click(client, sessionId, "#start");
      cause("restart", 1, 3, "a new worker and token were created");
      observations.push(await lifecycleObservation(client, sessionId, "after-restart"));
      await evaluate(client, sessionId, `__fftCollectorControl.error(0)`);
      cause("inject-stale-error", 0, 1, "collector invoked the first worker's stale error handler");
      finalState = await state(client, sessionId);
      observations.push(await lifecycleObservation(client, sessionId, "after-stale-error"));
      cause("ignored", 0, 1, "second worker remained active");
    } else if (id === "restart") {
      await click(client, sessionId, "#cancel");
      cause("cancel", 0, null, "first worker was cancelled");
      observations.push(await lifecycleObservation(client, sessionId, "after-cancel"));
      await click(client, sessionId, "#start");
      cause("restart", 1, 3, "visible Start created a replacement worker");
      finalState = await state(client, sessionId);
      observations.push(await lifecycleObservation(client, sessionId, "after-restart"));
      cause("new-worker-active", 1, 3, "replacement worker owns the running state");
    } else if (id === "cancel") {
      await click(client, sessionId, "#cancel");
      cause("cancel", 0, null, "visible Cancel terminated the worker");
      observations.push(await lifecycleObservation(client, sessionId, "after-cancel"));
      await evaluate(
        client,
        sessionId,
        `__fftCollectorControl.emit(0,{type:'result',token:1,result:{passed:true}})`,
      );
      cause("late-message", 0, 1, "collector injected a result after cancellation");
      finalState = await state(client, sessionId);
      observations.push(await lifecycleObservation(client, sessionId, "after-late-message"));
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
      observations.push(await lifecycleObservation(client, sessionId, "after-timeout"));
    } else {
      await evaluate(client, sessionId, `dispatchEvent(new PageTransitionEvent('pagehide'))`);
      cause("pagehide", 0, 1, "collector dispatched pagehide");
      cause("worker-terminated", 0, 1, "pagehide terminated the worker");
      observations.push(await lifecycleObservation(client, sessionId, "after-pagehide"));
      await evaluate(
        client,
        sessionId,
        `__fftCollectorControl.emit(0,{type:'result',token:1,result:{passed:true}})`,
      );
      cause("late-message", 0, 1, "collector injected a result after pagehide");
      finalState = await state(client, sessionId);
      observations.push(await lifecycleObservation(client, sessionId, "after-late-message"));
      cause("ignored", 0, 1, "late result was not accepted");
    }
    if (!native) {
      assertLifecycleScenarioObservations(id, observations);
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
        observations,
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

async function writeSyncedFile(path: string, bytes: Uint8Array): Promise<void> {
  const file = await Deno.open(path, { createNew: true, write: true, mode: 0o600 });
  try {
    let offset = 0;
    while (offset < bytes.length) offset += await file.write(bytes.subarray(offset));
    await file.sync();
  } finally {
    file.close();
  }
}

export async function publishNumericFftEvidenceAtomically(
  output: string,
  evidence: Record<string, unknown>,
  screenshots: ReadonlyMap<string, Uint8Array>,
  hooks: { beforeCommit?: (temporaryRoot: string) => void | Promise<void> } = {},
): Promise<void> {
  const outputRoot = output.replace(/\/$/, "");
  if (!outputRoot.startsWith("/") || outputRoot === "/") throw new Error("unsafe output root");
  const slash = outputRoot.lastIndexOf("/"), parent = outputRoot.slice(0, slash) || "/";
  const basename = outputRoot.slice(slash + 1);
  if (!/^[A-Za-z0-9._-]+$/.test(basename) || await Deno.realPath(parent) !== parent) {
    throw new Error("unsafe output parent or basename");
  }
  try {
    await Deno.lstat(outputRoot);
    throw new Error("output root already exists");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  const temporaryRoot = await Deno.makeTempDir({ dir: parent, prefix: `.${basename}.tmp-` });
  let committed = false;
  try {
    await Deno.mkdir(`${temporaryRoot}/screenshots`);
    for (const [path, bytes] of screenshots) {
      if (!/^screenshots\/[a-z0-9-]+\.png$/.test(path)) {
        throw new Error(`unsafe screenshot publication path: ${path}`);
      }
      await writeSyncedFile(`${temporaryRoot}/${path}`, bytes);
    }
    await writeSyncedFile(
      `${temporaryRoot}/evidence.v1.json`,
      new TextEncoder().encode(`${canonicalize(evidence)}\n`),
    );
    await hooks.beforeCommit?.(temporaryRoot);
    await Deno.rename(temporaryRoot, outputRoot);
    committed = true;
  } finally {
    if (!committed) await Deno.remove(temporaryRoot, { recursive: true }).catch(() => {});
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
  let serverArguments: string[] | undefined;
  let profileRoot: string | undefined;
  let owned: OwnedChrome | undefined;
  let browserCleanup: Record<string, unknown> | undefined;
  let effectiveArguments: string[] | undefined;
  let serverCleanup: Record<string, unknown> | undefined;
  let retainUnresolvedContainment = false;
  let stageRemoved = false;
  const payload = await runCleanupBoundCollection({
    collect: async () => {
      stage = await stageChromePackage(args.chrome, args.chromeSha256, stageAuthorization);
      const spawnArguments = numericFftServerArguments(serverPort);
      serverProcess = new Deno.Command(Deno.execPath(), {
        cwd: root,
        args: spawnArguments,
        stdout: "null",
        stderr: "piped",
      }).spawn();
      serverStatus = serverProcess.status;
      serverIdentity = await processIdentity(serverProcess.pid);
      await waitFor(`${origin}/healthz`);
      serverIdentity = await processIdentity(serverProcess.pid);
      if (!serverIdentity) throw new Error("owned evidence server identity disappeared");
      serverArguments = await processCommandLine(serverIdentity.pid);
      if (!same(serverArguments, [serverIdentity.executable, ...spawnArguments])) {
        throw new Error("spawned evidence server argv mismatch");
      }
      profileRoot = "/tmp/wasm-vs-js-owned-profiles/numeric-fft-browser-evidence-v1/chrome";
      try {
        owned = await launchOwnedChrome({
          stagedChrome: stage,
          profileRoot,
          extraArguments: [...REVIEWED_CHROME_EXTRA_ARGUMENTS],
          beforeSpawn: () => recordStageCleanupLifecycle(stage!, "owned-launch-active"),
        });
      } catch (error) {
        const containment = chromeLaunchFailureContainment(error);
        if (containment) {
          retainUnresolvedContainment = containment.retainStage;
          recordStageCleanupLifecycle(stage, containment.lifecycle);
        }
        throw error;
      }
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
      if (!same(owned.arguments, reviewedChromeArguments(profileRoot))) {
        throw new Error("configured Chrome arguments differ from reviewed set");
      }
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
        retainUnresolvedContainment = true;
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
      if (!stage || !mayRemoveChromeStage(stage.cleanupLifecycle, retainUnresolvedContainment)) {
        return;
      }
      await removeStagedChrome(stage);
      stageRemoved = true;
    },
  });
  if (
    !payload || !stage || !owned || !profileRoot || !effectiveArguments || !browserCleanup ||
    !serverCleanup || !serverArguments || !stageRemoved
  ) {
    throw new Error("collector did not reach exact-cleanup commit gate");
  }
  const verifiedSource = {
    ...source,
    verificationPasses: ["before-launch", "after-cleanup-before-publication"],
  };
  const denoExecutable = await Deno.realPath(Deno.execPath());
  const evidence: Record<string, unknown> = {
    schemaVersion: 1,
    evidenceId: "numeric-fft-spectral-filter-chrome-parent-v1",
    collectedAt: new Date().toISOString(),
    source: verifiedSource,
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
      containment: {
        unit: owned.ledger.unit,
        controlGroup: owned.ledger.controlGroup,
        cgroupPath: owned.ledger.cgroupPath,
        cgroupDev: owned.ledger.cgroupDev,
        cgroupIno: owned.ledger.cgroupIno,
        invocationId: owned.ledger.invocationId,
        mainPid: owned.ledger.mainPid,
      },
      stagedPackage: { root: stage.root, dev: stage.rootDev, ino: stage.rootIno },
    },
    server: {
      origin,
      loopbackOnly: true,
      mode: "public",
      launcher: serverIdentity,
      arguments: serverArguments,
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
  const sourceAtEnd = await attestCleanNumericFftSource(args.sourceCommit);
  assertNumericFftSourceRecheck(source, sourceAtEnd);
  await publishNumericFftEvidenceAtomically(args.output, evidence, payload.screenshots);
}

if (import.meta.main) {
  await main(parseNumericFftCollectorArguments(Deno.args));
}

import Ajv2020Module from "ajv2020";
import { assert, assertEquals, assertRejects } from "./assert.ts";
import { sha256Hex } from "../lib/canonical.ts";
import {
  assertNumericFftBrowserEvidenceSemantics,
  assertNumericFftSourceRecheck,
  attestCleanNumericFftSource,
  attestFetchedExecutedAssets,
  chromeLaunchFailureContainment,
  mayRemoveChromeStage,
  NUMERIC_FFT_EXECUTABLE_ROUTES,
  NUMERIC_FFT_EXECUTED_SOURCE_PATHS,
  parseNumericFftCollectorArguments,
  publishNumericFftEvidenceAtomically,
  runCleanupBoundCollection,
} from "../scripts/collect-numeric-fft-spectral-filter-evidence.ts";
import { numericFftEvidenceResponse } from "../scripts/serve-numeric-fft-spectral-filter-evidence.ts";
import { ChromeLaunchLifecycleError } from "../lib/owned-chrome.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (
  options?: Record<string, unknown>,
) => { compile(schema: unknown): Validator };
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const hash = "a".repeat(64);
const chromeHash = "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
const outputHash = "56674b58154a2272f25bd2cd8c950cea04cf30be7211e9f51f13a183f31ff1a5";
const quantizedHash = "513b24c63d27d9e84c41b7e0c65c95b687973f209420dd13dbb5fe3b3076ded3";
const profileRoot = "/tmp/wasm-vs-js-owned-profiles/numeric-fft-browser-evidence-v1/chrome";
const oracle = {
  passed: true,
  violations: 0,
  maxAbsolute: 1.7113793338019434e-7,
  maxRelative: 45181.96588413063,
  outputEnergy: 26623.35842396255,
  referenceEnergy: 26623.358400572066,
  energyRelative: 8.785699615237633e-10,
  tolerance: { absolute: 0.00025, relative: 0.0025, energyRelative: 0.0002 },
};
const checkpoints = [
  { index: 0, real: -0.00008689425885677338, imaginary: 0 },
  { index: 1, real: -0.00013792701065540314, imaginary: -1.4925550573252622e-8 },
  { index: 131_072, real: 0.05455316603183746, imaginary: 2.026320565128541e-18 },
  { index: 262_144, real: 0.1626012623310089, imaginary: -1.135633119687724e-17 },
  { index: 524_288, real: 0.025741079822182655, imaginary: 0 },
  { index: 1_048_574, real: 0.000009368173778057098, imaginary: -1.2371824453794034e-8 },
  { index: 1_048_575, real: -0.00003272015601396561, imaginary: -4.02133792931636e-9 },
];

function counters(target: "js-controlled" | "wasm-linear-controlled") {
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

const processIdentity = {
  pid: 101,
  parentPid: 100,
  startTimeTicks: "99",
  executable: "/usr/bin/deno",
};
const network = ["/", "/styles.css", "/demo.js"].map((path) => ({
  url: `http://127.0.0.1:8787${path}`,
  method: "GET",
  resourceType: "Script",
  status: 200,
  mimeType: "text/javascript",
  fromDiskCache: false,
  fromServiceWorker: false,
  failed: false,
  errorText: null,
  bodyBytes: 1,
  bodySha256: hash,
}));
const accessibility = {
  nodeCount: 10,
  treeSha256: hash,
  checks: {
    document: true,
    main: true,
    startButton: true,
    cancelButton: true,
    statusLiveRegion: true,
    resultFocusable: true,
  },
};
const causes: Record<string, Array<[string, number | null, number | null]>> = {
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
const assetPaths = NUMERIC_FFT_EXECUTABLE_ROUTES;
const worker = (terminated: boolean, token: number) => ({
  terminated,
  posts: [{ type: "start", token, target: "js-controlled" }],
});
const observed = (
  label: string,
  status: string,
  result: string,
  startDisabled: boolean,
  cancelDisabled: boolean,
  workers: unknown[],
) => ({ label, status, result, startDisabled, cancelDisabled, progress: 0, workers });
const readyObservation = observed(
  "ready",
  "Ready. The worker timeout is 120 seconds.",
  "No run yet.",
  false,
  true,
  [],
);
const runningObservation = (label: string, workers: unknown[]) =>
  observed(
    label,
    "Generating the frozen 2^20-sample fixture.",
    "No result accepted yet.",
    true,
    false,
    workers,
  );
const canceledObservation = (label: string, workers: unknown[]) =>
  observed(
    label,
    "Cancelled. Late messages from the terminated worker are ignored.",
    "No result accepted.",
    false,
    true,
    workers,
  );
function observationsFor(id: string, native: boolean) {
  if (native) return [];
  const start = runningObservation("after-start", [worker(false, 1)]);
  if (id === "wrong-token") {
    return [readyObservation, start, runningObservation("after-wrong-token", [worker(false, 1)])];
  }
  if (id === "stale-error") {
    return [
      readyObservation,
      start,
      canceledObservation("after-cancel", [worker(true, 1)]),
      runningObservation("after-restart", [worker(true, 1), worker(false, 3)]),
      runningObservation("after-stale-error", [worker(true, 1), worker(false, 3)]),
    ];
  }
  if (id === "restart") {
    return [
      readyObservation,
      start,
      canceledObservation("after-cancel", [worker(true, 1)]),
      runningObservation("after-restart", [worker(true, 1), worker(false, 3)]),
    ];
  }
  if (id === "cancel") {
    return [
      readyObservation,
      start,
      canceledObservation("after-cancel", [worker(true, 1)]),
      canceledObservation("after-late-message", [worker(true, 1)]),
    ];
  }
  if (id === "timeout") {
    return [
      readyObservation,
      start,
      observed(
        "after-timeout",
        "Timed out after 120 seconds; the worker was terminated.",
        "No result accepted.",
        false,
        true,
        [worker(true, 1)],
      ),
    ];
  }
  return [
    readyObservation,
    start,
    runningObservation("after-pagehide", [worker(true, 1)]),
    runningObservation("after-late-message", [worker(true, 1)]),
  ];
}

function scenario(id: string, index: number) {
  const native = index < 2;
  const target = index === 1 ? "wasm-linear-controlled" : "js-controlled";
  const scenarioCauses: Array<[string, number | null, number | null]> = native
    ? [["start", 0, 1], ["complete", 0, 1]]
    : causes[id];
  const observations = observationsFor(id, native);
  const lastObservation = observations.at(-1);
  return {
    id,
    route: "/benchmarks/numeric-fft-spectral-filter-v1/",
    mode: native ? "native-full" : "instrumented-lifecycle",
    target: native ? target : null,
    action: native ? "complete" : id,
    causes: scenarioCauses.map(([event, workerIndex, token], sequence) => ({
      sequence,
      event,
      workerIndex,
      token,
      detail: `${id}:${event}`,
    })),
    observations,
    states: [{
      sequence: 0,
      status: native ? "Complete output matched the registered SHA-256." : "Running.",
      result: native ? "accepted" : "No result accepted.",
      startDisabled: !native,
      cancelDisabled: native,
    }],
    finalState: native
      ? {
        status: "Complete output matched the registered SHA-256.",
        result: "accepted",
        startDisabled: false,
        cancelDisabled: true,
        progress: 4,
      }
      : {
        status: lastObservation!.status,
        result: lastObservation!.result,
        startDisabled: lastObservation!.startDisabled,
        cancelDisabled: lastObservation!.cancelDisabled,
        progress: lastObservation!.progress,
      },
    fullResult: native
      ? {
        target,
        passed: true,
        completeOutputSha256: outputHash,
        quantizedOutputSha256: quantizedHash,
        componentsValidated: 2_097_152,
        checkpoints,
        counters: counters(target as "js-controlled" | "wasm-linear-controlled"),
        statement: "No duration was collected.",
        executionMode: "full-2^20-correctness",
        sampleCount: 1_048_576,
        registeredOracle: oracle,
      }
      : null,
    assertions: ["cause", "state", "result"],
    console: [],
    exceptions: [],
    network,
    assets: Object.entries(assetPaths).filter(([route]) =>
      target === "wasm-linear-controlled" ||
      (native ? !route.endsWith(".wasm") : route.endsWith("/demo.js"))
    ).map(([route, localPath]) => ({
      route,
      localPath,
      kind: route.endsWith(".wasm") ? "webassembly" : "javascript",
      fetched: { bytes: 1, sha256: hash },
      executed: {
        bytes: 1,
        sha256: hash,
        protocolMethod: route.endsWith(".wasm")
          ? "Debugger.getWasmBytecode"
          : "Debugger.getScriptSource",
      },
      byteIdentical: true,
    })),
    accessibility,
    screenshot: { path: `screenshots/${id}.png`, bytes: 1, sha256: hash },
  };
}

function evidenceFixture(): Record<string, unknown> {
  const arguments_ = [
    `--user-data-dir=${profileRoot}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
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
    "about:blank",
  ];
  const profile = {
    ownershipRoot: "/tmp/wasm-vs-js-owned-profiles/numeric-fft-browser-evidence-v1",
    ownershipParentDev: 1,
    ownershipParentIno: 2,
    ownershipDev: 3,
    ownershipIno: 4,
    removeOwnershipRoot: true,
    profileRoot,
    profileDev: 5,
    profileIno: 6,
  };
  return {
    schemaVersion: 1,
    evidenceId: "numeric-fft-spectral-filter-chrome-parent-v1",
    collectedAt: "2026-08-03T10:00:00.000Z",
    source: {
      commit: "a".repeat(40),
      tree: "b".repeat(40),
      clean: true,
      statusPorcelainSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ignoredEntries: [],
      files: NUMERIC_FFT_EXECUTED_SOURCE_PATHS.map((path) => ({ path, bytes: 1, sha256: hash })),
      verificationPasses: ["before-launch", "after-cleanup-before-publication"],
    },
    collector: {
      denoVersion: "2.9.0",
      executable: { path: "/usr/bin/deno", sha256: hash },
      commandLine: [
        "deno",
        "run",
        "--allow-read",
        "--allow-run",
        "collector.ts",
        "--source-commit=a",
      ],
      scriptArguments: [
        "--source-commit=a",
        "--chrome=/c",
        "--chrome-sha256=a",
        "--chrome-product=C",
        "--output=/o",
      ],
      parentPid: 100,
      pid: 101,
    },
    browser: {
      product: "Chrome/150.0.7871.24",
      expectedProduct: "Chrome/150.0.7871.24",
      revision: "r1",
      userAgent: "Chrome fixture",
      jsVersion: "14.9",
      executable: { path: "/chrome", dev: 1, ino: 2, sha256: chromeHash },
      expectedSha256: chromeHash,
      configuredArguments: arguments_,
      effectiveArguments: arguments_,
      headless: true,
      protocol: "Chrome DevTools Protocol",
      endpoint: { host: "127.0.0.1", port: 9222, browserPath: "/devtools/browser/abc" },
      profile,
      containment: {
        unit: "wasm-vs-js-0123456789abcdef.service",
        controlGroup: "/owned",
        cgroupPath: "/sys/fs/cgroup/owned",
        cgroupDev: 1,
        cgroupIno: 2,
        invocationId: "a".repeat(32),
        mainPid: 102,
      },
      stagedPackage: {
        root: "/tmp/wasm-vs-js-staged-chrome/numeric-fft-browser-evidence-v1",
        dev: 7,
        ino: 8,
      },
    },
    server: {
      origin: "http://127.0.0.1:8787",
      loopbackOnly: true,
      mode: "public",
      launcher: processIdentity,
      arguments: [
        "/usr/bin/deno",
        "run",
        "--allow-net=127.0.0.1",
        "--allow-read=benchmarks/base/numeric-fft-spectral-filter,public/benchmarks/numeric-fft-spectral-filter-v1,public/artifacts/numeric-fft-spectral-filter,public/styles.css",
        "scripts/serve-numeric-fft-spectral-filter-evidence.ts",
        "--port=8787",
      ],
    },
    workload: {
      entryId: "numeric.fft-spectral-filter.v1",
      implementationId: "numeric-fft-spectral-filter-controlled-v1",
      mode: "correctness-only-no-timing",
      sampleCount: 1_048_576,
      components: 2_097_152,
      completeOutputSha256: outputHash,
      quantizedOutputSha256: quantizedHash,
      oracleMethod: "independent-scalar-f64-radix-2",
      performanceSamples: [],
    },
    scenarios: [
      "complete-js",
      "complete-wasm",
      "wrong-token",
      "stale-error",
      "restart",
      "cancel",
      "timeout",
      "pagehide",
    ].map(scenario),
    cleanup: {
      browser: {
        unit: "wasm-vs-js-0123456789abcdef.service",
        controlGroup: "/owned",
        cgroupPath: "/sys/fs/cgroup/owned",
        cgroupDev: 1,
        cgroupIno: 2,
        invocationId: "a".repeat(32),
        mainPid: 102,
        observedPids: [102],
        membershipSnapshots: [{ collectedAt: "2026-08-03T10:00:00.000Z", members: [102] }],
        remainingPids: [],
        cgroupEmpty: true,
        stoppedAt: "2026-08-03T10:01:00.000Z",
      },
      profile: { path: profileRoot, dev: 5, ino: 6, removed: true, absent: true },
      server: {
        launcher: processIdentity,
        signal: "SIGTERM",
        exit: { success: false, code: 143, signal: "SIGTERM" },
        processAbsent: true,
      },
      stage: {
        root: "/tmp/wasm-vs-js-staged-chrome/numeric-fft-browser-evidence-v1",
        dev: 7,
        ino: 8,
        removed: true,
        absent: true,
      },
    },
  };
}

Deno.test("workload-specific loopback server rejects methods, traversal, and unlisted routes", async () => {
  assertEquals(
    (await numericFftEvidenceResponse(new Request("http://127.0.0.1/private", { method: "POST" })))
      .status,
    405,
  );
  for (
    const path of [
      "/unknown",
      "/../PLAN.md",
      "/artifacts/numeric-fft-spectral-filter/build-manifest.json",
    ]
  ) {
    assertEquals(
      (await numericFftEvidenceResponse(new Request(`http://127.0.0.1${path}`))).status,
      404,
    );
  }
});

Deno.test("numeric FFT collector rejects ambiguous arguments and non-clean source before browser work", async () => {
  for (
    const args of [
      [],
      ["--source-commit=x"],
      [
        `--source-commit=${"a".repeat(40)}`,
        "--chrome=relative",
        `--chrome-sha256=${hash}`,
        "--chrome-product=Chrome/150.0.7871.24",
        "--output=/tmp/out",
      ],
      [
        `--source-commit=${"a".repeat(40)}`,
        "--chrome=/chrome",
        `--chrome-sha256=${hash}`,
        "--chrome-product=Chrome/150.0.7871.24",
        "--output=/tmp/out",
        "--extra=denied",
      ],
    ]
  ) {
    await assertRejects(
      () => Promise.resolve().then(() => parseNumericFftCollectorArguments(args)),
      "",
    );
  }
  const commit = "a".repeat(40);
  const dirtyCommand = (_command: string, args: string[]) => {
    const stdout = args[0] === "rev-parse"
      ? new TextEncoder().encode(args[1] === "HEAD" ? `${commit}\n` : `${"b".repeat(40)}\n`)
      : new TextEncoder().encode("?? untracked\0");
    return Promise.resolve({ success: true, stdout, stderr: new Uint8Array() });
  };
  await assertRejects(
    () => attestCleanNumericFftSource(commit, dirtyCommand),
    "completely clean checkout",
  );
});

Deno.test("numeric FFT collector rejects fetched bytes that differ from executed or local bytes", async () => {
  const records = await Promise.all(
    Object.entries(NUMERIC_FFT_EXECUTABLE_ROUTES).map(async ([route, path]) => {
      const bytes = await Deno.readFile(path);
      const identity = { bytes: bytes.byteLength, sha256: await sha256Hex(bytes) };
      return {
        route,
        fetched: identity,
        executed: {
          ...identity,
          protocolMethod: route.endsWith(".wasm")
            ? "Debugger.getWasmBytecode"
            : "Debugger.getScriptSource",
        },
      };
    }),
  );
  const poisoned = structuredClone(records);
  poisoned[2].executed.sha256 = hash;
  await assertRejects(() => attestFetchedExecutedAssets(poisoned), "byte identity failed");
  await assertRejects(
    () => attestFetchedExecutedAssets(records.slice(1)),
    "incomplete or duplicated",
  );
});

Deno.test("end-of-run source recheck rejects changed HEAD, status, or executed bytes", async () => {
  const before = evidenceFixture().source as Record<string, unknown>;
  for (
    const mutate of [
      (value: Record<string, unknown>) => value.commit = "b".repeat(40),
      (value: Record<string, unknown>) => value.statusPorcelainSha256 = hash,
      (value: Record<string, unknown>) => {
        const files = value.files as Array<Record<string, unknown>>;
        files[0].sha256 = "b".repeat(64);
      },
    ]
  ) {
    const after = structuredClone(before);
    mutate(after);
    await assertRejects(
      () => Promise.resolve().then(() => assertNumericFftSourceRecheck(before, after)),
      "source changed",
    );
  }
});

Deno.test("unmapped owned launch retains stage and profile as cleanup-unresolved", () => {
  const unresolved = chromeLaunchFailureContainment(
    new ChromeLaunchLifecycleError("mapping failed", true, false, new Error("cause")),
  );
  assertEquals(unresolved, {
    lifecycle: "cleanup-unresolved",
    retainStage: true,
    retainProfile: true,
  });
  assertEquals(mayRemoveChromeStage(unresolved!.lifecycle, unresolved!.retainStage), false);
  const resolved = chromeLaunchFailureContainment(
    new ChromeLaunchLifecycleError("prelaunch failed", false, true, new Error("cause")),
  );
  assertEquals(resolved, {
    lifecycle: "cleanup-verified",
    retainStage: false,
    retainProfile: false,
  });
});

Deno.test("atomic output publication removes every temporary byte after precommit failure", async () => {
  const parent = await Deno.makeTempDir();
  const output = `${parent}/browser-evidence`;
  try {
    await assertRejects(
      () =>
        publishNumericFftEvidenceAtomically(
          output,
          { schemaVersion: 1 },
          new Map([["screenshots/failure.png", new Uint8Array([1, 2, 3])]]),
          {
            beforeCommit: async (temporaryRoot) => {
              assert((await Deno.lstat(`${temporaryRoot}/evidence.v1.json`)).isFile);
              throw new Error("publication fault");
            },
          },
        ),
      "publication fault",
    );
    await assertRejects(() => Deno.lstat(output), "No such file");
    assertEquals([...Deno.readDirSync(parent)].map((entry) => entry.name), []);
  } finally {
    await Deno.remove(parent, { recursive: true });
  }
});

Deno.test("closed browser-evidence contract rejects identity, workload, lifecycle, and cleanup mutations", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/numeric-fft-spectral-filter-browser-evidence.schema.json"),
  );
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const object = node as Record<string, unknown>;
    if (object.type === "object") {
      assert(object.additionalProperties === false, "object schema is not closed");
    }
    for (const child of Object.values(object)) visit(child);
  };
  visit(schema);
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  const fixture = evidenceFixture();
  assert(validate(fixture), JSON.stringify(validate.errors));
  assertNumericFftBrowserEvidenceSemantics(fixture);

  const schemaMutations: Array<(value: Record<string, unknown>) => void> = [
    (value) => {
      ((value.scenarios as Array<Record<string, unknown>>)[0].accessibility as Record<
        string,
        unknown
      >)
        .unreviewed = true;
    },
    (value) => {
      (value.workload as Record<string, unknown>).sampleCount = 1024;
    },
    (value) => {
      (value.cleanup as Record<string, Record<string, unknown>>).profile.absent = false;
    },
    (value) => {
      (value.scenarios as Array<unknown>).pop();
    },
    (value) => {
      const browser = value.browser as Record<string, unknown>;
      (browser.configuredArguments as string[]).splice(7, 1);
    },
  ];
  for (const mutate of schemaMutations) {
    const poisoned = structuredClone(fixture);
    mutate(poisoned);
    assert(!validate(poisoned), "schema accepted a closed-contract mutation");
  }

  const semanticMutations: Array<(value: Record<string, unknown>) => void> = [
    (value) => {
      (value.browser as Record<string, unknown>).expectedProduct = "Chrome/151.0.0.0";
    },
    (value) => {
      const arguments_ = (value.browser as Record<string, unknown>).configuredArguments as string[];
      [arguments_[8], arguments_[9]] = [arguments_[9], arguments_[8]];
    },
    (value) => {
      const full = (value.scenarios as Array<Record<string, unknown>>)[0]
        .fullResult as Record<string, unknown>;
      (full.registeredOracle as Record<string, unknown>).maxAbsolute = 0;
    },
    (value) => {
      const full = (value.scenarios as Array<Record<string, unknown>>)[1]
        .fullResult as Record<string, unknown>;
      (full.counters as Record<string, unknown>)["boundary-crossings"] = 0;
    },
    (value) => {
      const lifecycle = (value.scenarios as Array<Record<string, unknown>>)[2];
      (lifecycle.causes as Array<Record<string, unknown>>)[1].event = "complete";
    },
    (value) => {
      const full = (value.scenarios as Array<Record<string, unknown>>)[0];
      (full.fullResult as Record<string, unknown>).target = "wasm-linear-controlled";
    },
    (value) => {
      (value.scenarios as Array<Record<string, unknown>>)[2].action = "cancel";
    },
    (value) => {
      const lifecycle = (value.scenarios as Array<Record<string, unknown>>)[3];
      (lifecycle.causes as Array<Record<string, unknown>>)[2].token = 1;
    },
    (value) => {
      const lifecycle = (value.scenarios as Array<Record<string, unknown>>)[5];
      (lifecycle.observations as Array<Record<string, unknown>>)[3].status = "authored success";
    },
    (value) => {
      const request = ((value.scenarios as Array<Record<string, unknown>>)[0]
        .network as Array<Record<string, unknown>>)[0];
      request.url = "http://127.0.0.1:9999/";
    },
    (value) => {
      const shot = (value.scenarios as Array<Record<string, unknown>>)[0]
        .screenshot as Record<string, unknown>;
      shot.path = "screenshots/complete-wasm.png";
    },
    (value) => {
      const native = (value.scenarios as Array<Record<string, unknown>>)[0];
      (native.assets as Array<Record<string, unknown>>)[0].byteIdentical = false;
    },
    (value) => {
      const files = (value.source as Record<string, unknown>).files as Array<
        Record<string, unknown>
      >;
      files[0].path = "unreviewed.ts";
    },
    (value) => {
      (value.server as Record<string, unknown>).arguments = ["invented"];
    },
    (value) => {
      (value.cleanup as Record<string, Record<string, unknown>>).profile.dev = 99;
    },
    (value) => {
      const browser = value.browser as Record<string, Record<string, unknown>>;
      browser.containment.invocationId = "b".repeat(32);
    },
    (value) => {
      const server = (value.cleanup as Record<string, Record<string, unknown>>).server;
      server.launcher = { ...(server.launcher as Record<string, unknown>), startTimeTicks: "100" };
    },
    (value) => {
      (value.cleanup as Record<string, Record<string, unknown>>).stage.ino = 99;
    },
  ];
  for (const [index, mutate] of semanticMutations.entries()) {
    const poisoned = structuredClone(fixture);
    mutate(poisoned);
    try {
      await assertRejects(
        () => Promise.resolve().then(() => assertNumericFftBrowserEvidenceSemantics(poisoned)),
        "contradiction",
      );
    } catch (error) {
      throw new Error(`semantic mutation ${index} was not rejected`, { cause: error });
    }
  }
});

Deno.test("collector failure path still runs browser, server, and stage cleanup and rejects cleanup failure", async () => {
  const order: string[] = [];
  await assertRejects(
    () =>
      runCleanupBoundCollection({
        collect: () => Promise.reject(new Error("collection failed")),
        cleanupBrowser: () => {
          order.push("browser");
          return Promise.resolve();
        },
        cleanupServer: () => {
          order.push("server");
          return Promise.resolve();
        },
        cleanupStage: () => {
          order.push("stage");
          return Promise.resolve();
        },
      }),
    "collection failed",
  );
  assertEquals(order, ["browser", "server", "stage"]);
  await assertRejects(
    () =>
      runCleanupBoundCollection({
        collect: () => Promise.resolve("would-be evidence"),
        cleanupBrowser: () => Promise.reject(new Error("cgroup not empty")),
        cleanupServer: () => Promise.resolve(),
        cleanupStage: () => Promise.resolve(),
      }),
    "collector cleanup failed",
  );
});

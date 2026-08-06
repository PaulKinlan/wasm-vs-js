import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assertJsonTelemetryEvidenceRelationships } from "../lib/json-telemetry-evidence-validation.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = (addFormatsModule as unknown as { default?: (ajv: unknown) => void }).default ??
  (addFormatsModule as unknown as (ajv: unknown) => void);
const HASH = "a".repeat(64);
const GIT = "b".repeat(40);
const WORKLOAD_PATH = "benchmarks/v1/serialization-json-telemetry/workload.js";
const WORKLOAD_HASH = "54e2ee54b225d8454664dc6a24f5fa178ee0652ccf0e7e01eea93b17f29530f8";
const WORKLOAD_BYTES = await Deno.readFile(
  "benchmarks/v1/serialization-json-telemetry/workload.js",
);
const WORKLOAD_BASE64 = WORKLOAD_BYTES.toBase64();
const SOURCE_PATHS = [
  "public/benchmarks/serialization.json-telemetry.v1/index.html",
  "public/styles.css",
  "public/favicon.svg",
  "public/telemetry-demo.js",
  "public/telemetry-worker.js",
  "public/telemetry-module-loader.js",
  "benchmarks/v1/serialization-json-telemetry/workload.js",
  "public/artifacts/serialization-json-telemetry/build-manifest.json",
  "public/artifacts/serialization-json-telemetry/fixture-manifest.json",
  "public/artifacts/serialization-json-telemetry/input-manifest.json",
  "public/artifacts/serialization-json-telemetry/output-manifest.json",
  "public/artifacts/serialization-json-telemetry/telemetry.wasm",
  "lib/canonical.ts",
  "lib/cdp-client.ts",
  "lib/json-telemetry-evidence-validation.ts",
  "scripts/collect-v1-json-telemetry-browser-evidence.ts",
];
const LAUNCH = [
  "--user-data-dir=/tmp/wasm-json-telemetry-chrome-123",
  "--remote-debugging-port=0",
  "--remote-debugging-address=127.0.0.1",
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--enable-automation",
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
  "about:blank",
];

function validator(schema: unknown): Validator {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
}
function clone<T>(value: T): T {
  return structuredClone(value);
}
const ABC = new TextEncoder().encode("abc");
const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
function network(
  path: string,
  sourcePath: string,
  resourceType = "Script",
  body: { bytes: Uint8Array; sha256: string } = { bytes: ABC, sha256: ABC_SHA256 },
) {
  return {
    url: `http://127.0.0.1:8123${path}`,
    method: "GET",
    resourceType,
    status: 200,
    mimeType: resourceType === "Document" ? "text/html" : "text/javascript",
    requestServedFromCache: false,
    fromDiskCache: false,
    fromPrefetchCache: false,
    fromServiceWorker: false,
    failed: false,
    responseBody: {
      status: "supported",
      bytes: body.bytes.length,
      sha256: body.sha256,
      base64: body.bytes.toBase64(),
      sourcePath,
      gitBlob: GIT,
    },
  };
}
function blobNetwork() {
  return {
    url: "blob:http://127.0.0.1:8123/1234",
    method: "GET",
    resourceType: "Script",
    status: 200,
    mimeType: "text/javascript",
    requestServedFromCache: false,
    fromDiskCache: false,
    fromPrefetchCache: false,
    fromServiceWorker: false,
    failed: false,
    responseBody: {
      status: "unavailable",
      reason: "Blob module bytes are retained by worker constructor audit",
    },
  };
}
function scenarioNetwork(action: string, variant: string, mode: string) {
  const stale = action === "stale-error-restart";
  const entries: Array<Record<string, unknown>> = [
    network(
      "/benchmarks/serialization.json-telemetry.v1/",
      "public/benchmarks/serialization.json-telemetry.v1/index.html",
      "Document",
    ),
    network("/styles.css", "public/styles.css", "Stylesheet"),
    network("/telemetry-demo.js", "public/telemetry-demo.js"),
    network("/telemetry-worker.js", "public/telemetry-worker.js"),
    network("/telemetry-module-loader.js", "public/telemetry-module-loader.js"),
  ];
  if (stale) {
    entries.push(
      network("/telemetry-worker.js", "public/telemetry-worker.js"),
      network("/telemetry-module-loader.js", "public/telemetry-module-loader.js"),
    );
  }
  if (action !== "complete" && !stale) return entries;
  entries.push(
    network(
      `/benchmarks/v1/serialization-json-telemetry/workload.${WORKLOAD_HASH}.js`,
      "benchmarks/v1/serialization-json-telemetry/workload.js",
      "Fetch",
      { bytes: WORKLOAD_BYTES, sha256: WORKLOAD_HASH },
    ),
    blobNetwork(),
  );
  if (variant === "wasm-linear-controlled" || mode === "exact-contract") {
    entries.push(
      network(
        "/artifacts/serialization-json-telemetry/telemetry.wasm",
        "public/artifacts/serialization-json-telemetry/telemetry.wasm",
        "Fetch",
      ),
    );
  }
  if (mode === "exact-contract") {
    for (
      const name of [
        "build-manifest.json",
        "fixture-manifest.json",
        "input-manifest.json",
        "output-manifest.json",
      ]
    ) {
      entries.push(
        network(
          `/artifacts/serialization-json-telemetry/${name}`,
          `public/artifacts/serialization-json-telemetry/${name}`,
          "Fetch",
        ),
      );
    }
  }
  return entries;
}
function exactChecks() {
  return {
    status: "verified",
    executedModuleRoute: `/benchmarks/v1/serialization-json-telemetry/workload.${WORKLOAD_HASH}.js`,
    executedModuleSha256: WORKLOAD_HASH,
    buildManifestSha256: "51afa93fb6d36edf50eb4ee801826acf3058c3c3e3c73cfc2a8cd3f02da101a8",
    fixtureManifestSha256: "89a1039bd30c2ab72499102e653a7ae44a4c9c0c731408223afe2d7df6cb31cf",
    inputManifestSha256: "0cfe5e4dbf3ce2bee9e047a32688a6b5f48ea64dcb120cb24ac9ddfa90a34fb0",
    outputManifestSha256: "3acf258af1cf022c3b6af581107e16324222e551ae3c16f05d522782399bf387",
    wasmSha256: "8d03d4fedbbef99659d95e8930a3db6757eb460d73301c9e95c9eafbfe330c42",
  };
}
function result(
  variant: "js-controlled" | "wasm-linear-controlled",
  mode: "bounded" | "exact-contract",
) {
  const value = {
    target: variant,
    mode,
    records: 1000,
    inputSha256: "1cb2368099252795ffc85d23ea057c93a266d9cdb026e041d0ec1aa563be92f9",
    outputSha256: "b748d5a006f9ca3d3570318cd5bd9c290408eaa243af53470282e7721a302ce8",
    counters: {
      records: 1000,
      "input-bytes": 119397,
      "numeric-values": 3000,
      "string-values": 4000,
      booleans: 1000,
      "query-aggregates": 11,
      "output-bytes": 158,
      allocations: variant === "js-controlled" ? 6 : 0,
      "boundary-crossings": variant === "js-controlled" ? 0 : 2,
    },
    canonicalSummary:
      '{"count":1000,"errorCount":108,"kind":{"click":345,"purchase":335,"view":320},"okCount":892,"region":{"ap":234,"eu":261,"na":247,"sa":258},"valueSum":4868080}',
    servedByteChecks: mode === "exact-contract" ? exactChecks() : { status: "not-requested" },
  };
  const served = value.servedByteChecks as Record<string, unknown>;
  const servedText = served.status === "verified"
    ? `Served-byte checks: ${
      JSON.stringify(
        Object.fromEntries(Object.entries(served).filter(([key]) => key !== "status")),
        null,
        2,
      )
    }\n`
    : "";
  return {
    rawText:
      `Target: ${value.target}\nMode: ${value.mode}\nRecords: ${value.records}\nInput SHA-256: ${value.inputSha256}\nOutput SHA-256: ${value.outputSha256}\nCounters: ${
        JSON.stringify(value.counters, null, 2)
      }\n${servedText}\nCanonical summary:\n${value.canonicalSummary}`,
    ...value,
  };
}
function commonScenario(
  id: string,
  action: string,
  variant: string,
  mode: string,
  records: number,
  status: string,
) {
  const generating = "Generating the registered fixture in a fresh worker.";
  return {
    id,
    action,
    variant,
    mode,
    records,
    statusHistory: ["Ready.", generating, status],
    finalStatus: status,
    console: [],
    exceptions: [],
    network: scenarioNetwork(action, variant, mode),
    accessibility: {
      statusText: status,
      resultText: "",
      axText: [{ role: "status", name: status }],
    },
    screenshot: { file: `screenshots/${id}.png`, bytes: 100, sha256: HASH },
    lifecycle: {
      causalChecks: [`${action} causally terminated the worker`],
      workers: [{
        id: 1,
        createdAt: 1,
        terminateCalls: [2],
        postedTokens: [{ token: 1, at: 1.1 }],
        deliveredTokens: [],
        receivedTokens: action === "wrong-token" ? [{ token: "wrong-token", at: 1.6 }] : [],
      }],
      injections: action === "wrong-token"
        ? [{ kind: "wrong-token-message", workerId: 1, token: "wrong-token", at: 1.5 }]
        : [],
      controls: { startDisabled: false, cancelDisabled: true, progressHasValue: false },
    },
  };
}
function complete(
  id: string,
  variant: "js-controlled" | "wasm-linear-controlled",
  mode: "bounded" | "exact-contract",
) {
  const scenario = commonScenario(id, "complete", variant, mode, 1000, "Complete.");
  const exactResult = result(variant, mode);
  scenario.statusHistory = [
    "Ready.",
    "Generating the registered fixture in a fresh worker.",
    "Loading and verifying the content-addressed workload module.",
    "Generating exactly 1,000 records.",
    "Parsing 119,397 UTF-8 bytes.",
    ...(mode === "exact-contract"
      ? ["Checking served module, manifests, artifact, fixture, output, and counters."]
      : []),
    "Complete.",
  ];
  scenario.accessibility.resultText = exactResult.rawText;
  scenario.accessibility.axText.push({ role: "code", name: exactResult.rawText });
  Object.assign(scenario.lifecycle.workers[0], {
    deliveredTokens: [{ token: 1, at: 1.2 }],
    receivedTokens: [{ token: 1, at: 1.3 }, { token: 1, at: 1.4 }],
  });
  return {
    ...scenario,
    result: exactResult,
    blobExecution: {
      objectUrl: "blob:http://127.0.0.1:8123/1234",
      mimeType: "text/javascript",
      bytes: WORKLOAD_BYTES.length,
      sha256: WORKLOAD_HASH,
      base64: WORKLOAD_BASE64,
      completionImportedModule: true,
    },
  };
}
function fixture() {
  const scenarios: Array<Record<string, unknown>> = [
    complete("js-bounded", "js-controlled", "bounded"),
    complete("js-exact", "js-controlled", "exact-contract"),
    complete("wasm-bounded", "wasm-linear-controlled", "bounded"),
    complete("wasm-exact", "wasm-linear-controlled", "exact-contract"),
    commonScenario(
      "wrong-token",
      "wrong-token",
      "js-controlled",
      "bounded",
      1000000,
      "Cancelled. No result was retained.",
    ),
    {
      ...complete("stale-error-restart", "js-controlled", "exact-contract"),
      action: "stale-error-restart",
      network: scenarioNetwork("stale-error-restart", "js-controlled", "exact-contract"),
      statusHistory: [
        "Ready.",
        "Generating the registered fixture in a fresh worker.",
        "Cancelled. No result was retained.",
        "Generating the registered fixture in a fresh worker.",
        "Loading and verifying the content-addressed workload module.",
        "Generating exactly 1,000 records.",
        "Parsing 119,397 UTF-8 bytes.",
        "Checking served module, manifests, artifact, fixture, output, and counters.",
        "Complete.",
      ],
      lifecycle: {
        causalChecks: [
          "prior worker terminated before restart",
          "stale error left fresh state unchanged",
        ],
        workers: [
          {
            id: 1,
            createdAt: 1,
            terminateCalls: [2],
            postedTokens: [{ token: 1, at: 1.1 }],
            deliveredTokens: [],
            receivedTokens: [],
          },
          {
            id: 2,
            createdAt: 3,
            terminateCalls: [5],
            postedTokens: [{ token: 3, at: 3.1 }],
            deliveredTokens: [{ token: 3, at: 3.2 }],
            receivedTokens: [{ token: 3, at: 3.3 }],
          },
        ],
        injections: [{
          kind: "stale-worker-error",
          workerId: 1,
          staleToken: 1,
          activeWorkerId: 2,
          activeToken: 3,
          at: 4,
        }],
        controls: { startDisabled: false, cancelDisabled: true, progressHasValue: false },
      },
    },
    commonScenario(
      "cancel",
      "cancel",
      "wasm-linear-controlled",
      "bounded",
      1000000,
      "Cancelled. No result was retained.",
    ),
    commonScenario(
      "timeout",
      "timeout",
      "wasm-linear-controlled",
      "exact-contract",
      1000000,
      "Stopped: the 180 second limit expired.",
    ),
    commonScenario(
      "pagehide",
      "pagehide",
      "js-controlled",
      "bounded",
      1000000,
      "Stopped because the page was hidden.",
    ),
  ];
  const process = {
    pid: 1234,
    parentPid: 1,
    startTimeTicks: "99",
    executable: "/opt/chrome/chrome",
  };
  const success = { outcome: "success", checkedAt: "2026-08-02T10:00:01Z", remaining: [] };
  return {
    schemaVersion: 1,
    workload: "serialization.json-telemetry.v1",
    evidenceId: "serialization-json-telemetry-browser-abcdef123456",
    collectedAt: "2026-08-02T10:00:00Z",
    collection: { outcome: "success", completedScenarios: 9 },
    source: {
      commit: GIT,
      tree: GIT,
      root: "/source",
      cleanStatus: "clean",
      endCheck: {
        outcome: "success",
        checkedAt: "2026-08-02T10:00:02Z",
        commit: GIT,
        tree: GIT,
        cleanStatus: "clean",
      },
      frozenFiles: SOURCE_PATHS.map((path) =>
        path === "benchmarks/v1/serialization-json-telemetry/workload.js"
          ? { path, bytes: WORKLOAD_BYTES.length, sha256: WORKLOAD_HASH, gitBlob: GIT }
          : { path, bytes: 3, sha256: HASH, gitBlob: GIT }
      ),
    },
    collector: {
      script: "scripts/collect-v1-json-telemetry-browser-evidence.ts",
      scriptBytes: 3,
      scriptSha256: HASH,
      command: [
        "/usr/bin/deno",
        "run",
        "-A",
        "scripts/collect-v1-json-telemetry-browser-evidence.ts",
        "--chrome=/opt/chrome/chrome",
        "--output=/tmp/evidence.json",
      ],
      denoVersion: "2.9.0",
    },
    browser: {
      product: "Chrome/150.0.7871.24",
      revision: "revision",
      userAgent: "agent",
      jsVersion: "15.0",
      executable:
        "/opt/chrome/.wasm-json-telemetry-browser-bin-12345678-1234-1234-1234-123456789abc",
      requestedExecutable: "/opt/chrome/chrome",
      requestedExecutableIdentity: { device: 1, inode: 10 },
      executableBytes: 10,
      executableSha256: "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
      stagedExecutableIdentity: { device: 1, inode: 11 },
      stagedExecutableMode: 0o500,
      runningExecutableIdentity: { device: 1, inode: 11 },
      launchArguments: LAUNCH,
      effectiveArguments: [
        "/opt/chrome/.wasm-json-telemetry-browser-bin-12345678-1234-1234-1234-123456789abc",
        ...LAUNCH,
      ],
      headless: true,
      protocol: "Chrome DevTools Protocol",
      profile: "/tmp/wasm-json-telemetry-chrome-123",
      cgroup: {
        unit: "wasm-json-telemetry-abcdef0123456789.service",
        controlGroup: "/user.slice/exact.service",
        path: "/sys/fs/cgroup/user.slice/exact.service",
        device: 1,
        inode: 2,
        invocationId: "c".repeat(32),
        mainPid: 1234,
        memberSnapshots: [{ at: "2026-08-02T10:00:00Z", pids: [1234] }],
      },
      processes: [process],
    },
    server: { origin: "http://127.0.0.1:8123", mode: "public", launcher: process },
    scenarios,
    cleanup: {
      browserProcesses: success,
      cgroup: success,
      profile: success,
      binaryStage: success,
      server: success,
    },
  };
}

Deno.test("JSON telemetry evidence schema accepts the exact pinned successful contract", async () => {
  const validate = validator(
    JSON.parse(await Deno.readTextFile("schemas/v1-json-telemetry-browser-evidence.schema.json")),
  );
  const evidence = fixture();
  assert(validate(evidence), JSON.stringify(validate.errors));
  assertEquals(evidence.scenarios.map((scenario) => scenario.id), [
    "js-bounded",
    "js-exact",
    "wasm-bounded",
    "wasm-exact",
    "wrong-token",
    "stale-error-restart",
    "cancel",
    "timeout",
    "pagehide",
  ]);
});

Deno.test("schema rejects semantic roster, oracle, cache, AX, lifecycle, byte, and pin violations", async () => {
  const validate = validator(
    JSON.parse(await Deno.readTextFile("schemas/v1-json-telemetry-browser-evidence.schema.json")),
  );
  const cases: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => Object.assign(value.scenarios[1], { id: "js-bounded" }),
    (value) => Object.assign(value.scenarios[0], { variant: "wasm-linear-controlled" }),
    (value) => Object.assign(value.scenarios[4], { records: 1000 }),
    (value) => Object.assign(value.scenarios[6], { finalStatus: "Complete." }),
    (value) => Object.assign(value.scenarios[0].result as object, { outputSha256: HASH }),
    (value) =>
      Object.assign((value.scenarios[2].result as Record<string, unknown>).counters as object, {
        allocations: 6,
      }),
    (value) =>
      Object.assign((value.scenarios[0].network as Array<Record<string, unknown>>)[0], {
        fromDiskCache: true,
      }),
    (value) =>
      Object.assign((value.scenarios[0].network as Array<Record<string, unknown>>)[0], {
        requestServedFromCache: true,
      }),
    (value) =>
      Object.assign((value.scenarios[0].network as Array<Record<string, unknown>>)[0], {
        fromPrefetchCache: true,
      }),
    (value) => Object.assign(value.scenarios[0].accessibility as object, { statusText: "Ready." }),
    (value) =>
      Object.assign((value.scenarios[0].lifecycle as Record<string, unknown>).controls as object, {
        startDisabled: true,
      }),
    (value) =>
      Object.assign(
        ((value.scenarios[0].lifecycle as Record<string, unknown>).workers as Array<
          Record<string, unknown>
        >)[0],
        { terminateCalls: [] },
      ),
    (value) => Object.assign(value.scenarios[0].blobExecution as object, { bytes: 0 }),
    (value) => Object.assign(value.scenarios[0].blobExecution as object, { base64: "YWJj" }),
    (value) => Object.assign(value.browser, { product: "Chrome/151.0.0.0" }),
    (value) => Object.assign(value.browser, { executableSha256: HASH }),
    (value) => value.browser.launchArguments.splice(6, 1),
    (value) => Object.assign(value.collector, { denoVersion: "2.8.0" }),
    (value) => Object.assign(value.source.frozenFiles[0], { path: SOURCE_PATHS[1] }),
  ];
  for (const mutate of cases) {
    const evidence = clone(fixture());
    mutate(evidence);
    assert(
      !validate(evidence),
      `semantic negative unexpectedly passed: ${JSON.stringify(evidence).slice(0, 500)}`,
    );
  }
});

Deno.test("semantic relationship validator rejects counts, source, inode, raw result, chronology, tokens, network, AX, and bytes", async () => {
  await assertJsonTelemetryEvidenceRelationships(fixture());
  const cases: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => Object.assign(value.collection, { completedScenarios: 0 }),
    (value) => Object.assign(value.source.endCheck, { commit: "c".repeat(40) }),
    (value) => value.source.frozenFiles.splice(12, 1),
    (value) =>
      Object.assign(
        value.source.frozenFiles.find((entry) => entry.path === WORKLOAD_PATH)!,
        { sha256: HASH },
      ),
    (value) => value.browser.effectiveArguments.push("--unexpected"),
    (value) => Object.assign(value.browser.runningExecutableIdentity, { inode: 12 }),
    (value) => Object.assign(value.scenarios[0].result as object, { rawText: "fabricated" }),
    (value) =>
      Object.assign(value.scenarios[0], {
        statusHistory: ["Ready.", "fabricated status", "Complete."],
      }),
    (value) =>
      Object.assign(
        ((value.scenarios[5].lifecycle as Record<string, unknown>).workers as Array<
          Record<string, unknown>
        >)[1].postedTokens as unknown as object,
        { 0: { token: 1, at: 3.1 } },
      ),
    (value) => (value.scenarios[0].network as Array<Record<string, unknown>>).splice(0, 1),
    (value) => (value.scenarios[0].network as Array<Record<string, unknown>>).splice(2, 1),
    (value) => (value.scenarios[0].network as Array<Record<string, unknown>>).splice(4, 1),
    (value) =>
      Object.assign((value.scenarios[0].network as Array<Record<string, unknown>>)[0], {
        requestServedFromCache: true,
      }),
    (value) =>
      Object.assign((value.scenarios[0].network as Array<Record<string, unknown>>)[0], {
        resourceType: "Script",
      }),
    (value) =>
      Object.assign(value.scenarios[0].accessibility as Record<string, unknown>, {
        axText: [{ role: "status", name: "Complete." }],
      }),
    (value) => {
      const workload = (value.scenarios[0].network as Array<Record<string, unknown>>).find((
        entry,
      ) => String(entry.url).includes("/workload."))!;
      Object.assign(workload.responseBody as Record<string, unknown>, { base64: "YWJj" });
    },
    (value) =>
      Object.assign(value.scenarios[0].blobExecution as Record<string, unknown>, { sha256: HASH }),
  ];
  for (const mutate of cases) {
    const evidence = clone(fixture());
    mutate(evidence);
    await assertRejects(() => assertJsonTelemetryEvidenceRelationships(evidence), "");
  }
});

Deno.test("typed collection and cleanup failure evidence remains schema-valid", async () => {
  const validate = validator(
    JSON.parse(await Deno.readTextFile("schemas/v1-json-telemetry-browser-evidence.schema.json")),
  );
  const evidence = fixture();
  evidence.collection = {
    outcome: "failure",
    error: "setup failed after profile creation",
    completedScenarios: 0,
  } as typeof evidence.collection;
  evidence.scenarios = [];
  (evidence.source as Record<string, unknown>).endCheck = {
    outcome: "failure",
    checkedAt: "2026-08-02T10:00:02Z",
    error: "source changed",
  };
  (evidence.cleanup as Record<string, unknown>).cgroup = {
    outcome: "failure",
    checkedAt: "2026-08-02T10:00:02Z",
    remaining: ["1234"],
    error: "retained member",
  };
  delete (evidence as Partial<typeof evidence>).browser;
  delete (evidence as Partial<typeof evidence>).server;
  assert(validate(evidence), JSON.stringify(validate.errors));
});

Deno.test("collector source pins setup, immutable source, exact browser, oracle, lifecycle, network, AX, and retained cleanup without launching Chrome", async () => {
  const source = await Deno.readTextFile("scripts/collect-v1-json-telemetry-browser-evidence.ts");
  for (
    const required of [
      'const CFT_PRODUCT = "Chrome/150.0.7871.24"',
      'const CFT_SHA256 = "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355"',
      '"--enable-automation"',
      '"show", `${sourceCommit}:${path}`',
      "fetched raw response differs from frozen clean HEAD source",
      "source bytes changed during collection",
      "result differs from frozen scenario oracle",
      "executed Blob bytes differ from fetched workload",
      "causally terminate each created worker exactly once",
      "stale prior-worker error mutated the fresh generation",
      "entry.requestServedFromCache",
      "entry.fromDiskCache",
      "entry.fromPrefetchCache",
      'client.on("Network.requestServedFromCache"',
      "network roster differs from the exact scenario contract",
      "unmapped loopback response denied",
      "AX tree omitted visible status or result output",
      "await finalizeCleanup()",
      "await atomicWriteText(outputPath",
      "systemd MainPID is not the staged, hashed Chrome inode",
      "atomic output target",
      "cgroup.kill",
    ]
  ) assert(source.includes(required), `collector omitted ${required}`);
  assert(source.indexOf("try {\n  server =") < source.indexOf("server = new Deno.Command"));
  const firstAtomicWrite = source.indexOf("await atomicWriteText(outputPath");
  assert(source.indexOf("await finalizeCleanup()") < firstAtomicWrite);
  assert(source.indexOf("await recheckFrozenSource();", firstAtomicWrite) > firstAtomicWrite);
  assert(!source.includes("Deno.writeTextFile(outputPath"));
  assert(!source.includes("Deno.kill(-1"));
  assert(!source.includes("pkill"));
  assert(!source.includes("killall"));
});

Deno.test("collector rejects an output symlink before hashing or launching the browser", async () => {
  const directory = await Deno.makeTempDir({ prefix: "json-telemetry-output-negative-" });
  try {
    const target = `${directory}/target.txt`;
    const output = `${directory}/evidence.json`;
    await Deno.writeTextFile(target, "retained");
    await Deno.symlink(target, output);
    const result = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        "scripts/collect-v1-json-telemetry-browser-evidence.ts",
        "--chrome=/bin/true",
        `--output=${output}`,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(!result.success, "output symlink unexpectedly reached collection");
    assert(
      new TextDecoder().decode(result.stderr).includes("output path must not be a symlink"),
      "output symlink rejection was not explicit",
    );
    assertEquals(await Deno.readTextFile(target), "retained");
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("every material object schema is closed", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/v1-json-telemetry-browser-evidence.schema.json"),
  );
  const open: string[] = [];
  function visit(value: unknown, path: string): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      return value.forEach((entry, index) => visit(entry, `${path}/${index}`));
    }
    const record = value as Record<string, unknown>;
    if (record.type === "object" && record.additionalProperties !== false) open.push(path);
    for (const [key, entry] of Object.entries(record)) visit(entry, `${path}/${key}`);
  }
  visit(schema, "#");
  assertEquals(open, []);
});

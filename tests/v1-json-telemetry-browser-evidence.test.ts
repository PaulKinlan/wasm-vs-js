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
const WORKLOAD_HASH = "54e2ee54b225d8454664dc6a24f5fa178ee0652ccf0e7e01eea93b17f29530f8";
const WORKLOAD_BYTES = await Deno.readFile(
  "benchmarks/v1/serialization-json-telemetry/workload.js",
);
const WORKLOAD_BASE64 = WORKLOAD_BYTES.toBase64();
const SOURCE_PATHS = [
  "public/demos/serialization.json-telemetry.v1/index.html",
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
function network(
  url = "http://127.0.0.1:8123/telemetry-worker.js",
  body: { bytes: Uint8Array; sourcePath: string; sha256: string } = {
    bytes: new TextEncoder().encode("abc"),
    sourcePath: "public/telemetry-worker.js",
    sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  },
) {
  return {
    url,
    method: "GET",
    resourceType: "Script",
    status: 200,
    mimeType: "text/javascript",
    fromDiskCache: false,
    fromServiceWorker: false,
    failed: false,
    responseBody: {
      status: "supported",
      bytes: body.bytes.length,
      sha256: body.sha256,
      base64: body.bytes.toBase64(),
      sourcePath: body.sourcePath,
      gitBlob: GIT,
    },
  };
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
  return {
    rawText: "exact complete textual result",
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
}
function commonScenario(
  id: string,
  action: string,
  variant: string,
  mode: string,
  records: number,
  status: string,
) {
  return {
    id,
    action,
    variant,
    mode,
    records,
    statusHistory: ["Ready.", status],
    finalStatus: status,
    console: [],
    exceptions: [],
    network: [network(), network(), network()],
    accessibility: {
      statusText: status,
      resultText: "",
      axText: [{ role: "status", name: status }],
    },
    screenshot: { file: `screenshots/${id}.png`, bytes: 100, sha256: HASH },
    lifecycle: {
      causalChecks: [`${action} causally terminated the worker`],
      workers: [{ id: 1, createdAt: 1, terminateCalls: [2] }],
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
  scenario.accessibility.resultText = "exact complete textual result";
  scenario.accessibility.axText.push({ role: "code", name: "exact complete textual result" });
  scenario.network[0] = network(
    `http://127.0.0.1:8123/benchmarks/v1/serialization-json-telemetry/workload.${WORKLOAD_HASH}.js`,
    {
      bytes: WORKLOAD_BYTES,
      sourcePath: "benchmarks/v1/serialization-json-telemetry/workload.js",
      sha256: WORKLOAD_HASH,
    },
  );
  return {
    ...scenario,
    result: result(variant, mode),
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
      lifecycle: {
        causalChecks: [
          "prior worker terminated before restart",
          "stale error left fresh state unchanged",
        ],
        workers: [
          { id: 1, createdAt: 1, terminateCalls: [2] },
          { id: 2, createdAt: 3, terminateCalls: [4] },
        ],
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
      frozenFiles: SOURCE_PATHS.map((path) => ({ path, bytes: 3, sha256: HASH, gitBlob: GIT })),
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
      executable: "/opt/chrome/chrome",
      executableBytes: 10,
      executableSha256: "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
      launchArguments: LAUNCH,
      effectiveArguments: ["/opt/chrome/chrome", ...LAUNCH],
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
    cleanup: { browserProcesses: success, cgroup: success, profile: success, server: success },
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

Deno.test("semantic relationship validator rejects cross-field source, argv, AX, and byte contradictions", async () => {
  await assertJsonTelemetryEvidenceRelationships(fixture());
  const cases: Array<(value: ReturnType<typeof fixture>) => void> = [
    (value) => Object.assign(value.source.endCheck, { commit: "c".repeat(40) }),
    (value) => value.browser.effectiveArguments.push("--unexpected"),
    (value) =>
      Object.assign(value.scenarios[0].accessibility as Record<string, unknown>, {
        axText: [{ role: "status", name: "Complete." }],
      }),
    (value) =>
      Object.assign(
        (value.scenarios[0].network as Array<Record<string, unknown>>)[0].responseBody as Record<
          string,
          unknown
        >,
        { base64: "YWJj" },
      ),
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
      "entry.fromDiskCache",
      "unmapped loopback response denied",
      "AX tree omitted visible status or result output",
      "await finalizeCleanup()",
      "await Deno.writeTextFile(outputPath",
      "cgroup.kill",
    ]
  ) assert(source.includes(required), `collector omitted ${required}`);
  assert(source.indexOf("try {\n  server =") < source.indexOf("server = new Deno.Command"));
  assert(
    source.indexOf("await finalizeCleanup()") <
      source.indexOf("await Deno.writeTextFile(outputPath"),
  );
  assert(!source.includes("Deno.kill(-1"));
  assert(!source.includes("pkill"));
  assert(!source.includes("killall"));
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

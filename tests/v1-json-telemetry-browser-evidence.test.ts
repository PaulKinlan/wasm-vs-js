import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals } from "./assert.ts";

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

function validator(schema: unknown): Validator {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
}
function clone<T>(value: T): T {
  return structuredClone(value);
}
function network(url = "http://127.0.0.1:8123/telemetry-worker.js") {
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
      bytes: 3,
      sha256: HASH,
      base64: "YWJj",
      sourcePath: "public/telemetry-worker.js",
      gitBlob: GIT,
    },
  };
}
function result(
  variant: "js-controlled" | "wasm-linear-controlled",
  mode: "bounded" | "exact-contract",
) {
  const exact = {
    status: "verified",
    executedModuleRoute: `/benchmarks/v1/serialization-json-telemetry/workload.${HASH}.js`,
    executedModuleSha256: HASH,
    buildManifestSha256: HASH,
    fixtureManifestSha256: HASH,
    inputManifestSha256: HASH,
    outputManifestSha256: HASH,
    wasmSha256: HASH,
  };
  return {
    rawText: "Target and complete canonical textual result",
    target: variant,
    mode,
    records: 1000,
    inputSha256: HASH,
    outputSha256: HASH,
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
    canonicalSummary: '{"count":1000}',
    servedByteChecks: mode === "exact-contract" ? exact : { status: "not-requested" },
  };
}
function commonScenario(id: string, action: string, variant = "js-controlled", mode = "bounded") {
  return {
    id,
    action,
    variant,
    mode,
    records: 1000,
    statusHistory: ["Ready.", "Complete."],
    finalStatus: "Complete.",
    console: [],
    exceptions: [],
    network: [network(), network(), network()],
    accessibility: {
      statusText: "Complete.",
      resultText: "complete canonical textual result",
      axText: [{ role: "status", name: "Complete." }],
    },
    screenshot: { file: `screenshots/${id}.png`, bytes: 100, sha256: HASH },
  };
}
function fixture() {
  const completions = [
    ["js-bounded", "js-controlled", "bounded"],
    ["js-exact", "js-controlled", "exact-contract"],
    ["wasm-bounded", "wasm-linear-controlled", "bounded"],
    ["wasm-exact", "wasm-linear-controlled", "exact-contract"],
  ] as const;
  const scenarios: Array<Record<string, unknown>> = completions.map(([id, variant, mode]) => ({
    ...commonScenario(id, "complete", variant, mode),
    result: result(variant, mode),
    blobExecution: {
      objectUrl: "blob:http://127.0.0.1:8123/1234",
      mimeType: "text/javascript",
      bytes: 3,
      sha256: HASH,
      base64: "YWJj",
      completionImportedModule: true,
    },
  }));
  for (
    const [id, action] of [
      ["wrong-token", "wrong-token"],
      ["stale-error-restart", "stale-error-restart"],
      ["cancel", "cancel"],
      ["timeout", "timeout"],
      ["pagehide", "pagehide"],
    ] as const
  ) {
    const scenario: Record<string, unknown> = {
      ...commonScenario(id, action),
      lifecycle: { checks: [`${action} state transition passed`] },
    };
    if (action === "stale-error-restart") {
      scenario.mode = "exact-contract";
      scenario.result = result("js-controlled", "exact-contract");
      scenario.blobExecution = {
        objectUrl: "blob:http://127.0.0.1:8123/restart",
        mimeType: "text/javascript",
        bytes: 3,
        sha256: HASH,
        base64: "YWJj",
        completionImportedModule: true,
      };
    }
    scenarios.push(scenario);
  }
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
    source: { commit: GIT, tree: GIT, root: "/source", cleanStatus: "clean" },
    collector: {
      script: "scripts/collect-v1-json-telemetry-browser-evidence.ts",
      scriptBytes: 100,
      scriptSha256: HASH,
      command: ["deno", "run", "-A", "scripts/collect-v1-json-telemetry-browser-evidence.ts"],
      denoVersion: "2.9.0",
    },
    browser: {
      product: "Chrome/150.0.7871.24",
      revision: "revision",
      userAgent: "agent",
      jsVersion: "15.0",
      executable: "/opt/chrome/chrome",
      executableBytes: 10,
      executableSha256: HASH,
      launchArguments: Array.from({ length: 14 }, (_, index) => `--argument-${index}`),
      effectiveArguments: Array.from({ length: 14 }, (_, index) => `--argument-${index}`),
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
      server: success,
    },
  };
}

Deno.test("JSON telemetry browser evidence schema accepts the complete closed contract", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/v1-json-telemetry-browser-evidence.schema.json"),
  );
  const validate = validator(schema);
  const evidence = fixture();
  assert(validate(evidence), JSON.stringify(validate.errors));
  assertEquals(
    evidence.scenarios.map((scenario) => scenario.id),
    [
      "js-bounded",
      "js-exact",
      "wasm-bounded",
      "wasm-exact",
      "wrong-token",
      "stale-error-restart",
      "cancel",
      "timeout",
      "pagehide",
    ],
  );
});

Deno.test("JSON telemetry browser evidence schema rejects omissions, null evidence, and open objects", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/v1-json-telemetry-browser-evidence.schema.json"),
  );
  const validate = validator(schema);
  const cases = [
    (value: ReturnType<typeof fixture>) => Object.assign(value, { fabricated: 0 }),
    (value: ReturnType<typeof fixture>) => Object.assign(value.source, { branch: "main" }),
    (value: ReturnType<typeof fixture>) =>
      delete (value.browser as unknown as Record<string, unknown>).executableSha256,
    (value: ReturnType<typeof fixture>) => delete value.scenarios[0].blobExecution,
    (value: ReturnType<typeof fixture>) => {
      const scenario = value.scenarios[0] as Record<string, unknown>;
      const network = scenario.network as Array<Record<string, unknown>>;
      Object.assign(network[0], { responseBody: null });
    },
    (value: ReturnType<typeof fixture>) => {
      const scenario = value.scenarios[1] as Record<string, unknown>;
      const scenarioResult = scenario.result as Record<string, unknown>;
      Object.assign(scenarioResult.servedByteChecks as Record<string, unknown>, {
        status: "not-requested",
      });
    },
    (value: ReturnType<typeof fixture>) => Object.assign(value.cleanup.cgroup, { remaining: [0] }),
    (value: ReturnType<typeof fixture>) =>
      Object.assign(value.browser.cgroup, { pidsAbsent: true }),
  ];
  for (const mutate of cases) {
    const evidence = clone(fixture());
    mutate(evidence);
    assert(
      !validate(evidence),
      `negative fixture unexpectedly passed: ${JSON.stringify(evidence)}`,
    );
  }
});

Deno.test("unavailable response bytes and cleanup failure stay typed instead of numeric zero", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/v1-json-telemetry-browser-evidence.schema.json"),
  );
  const validate = validator(schema);
  const evidence = fixture();
  const lifecycle = evidence.scenarios[4] as Record<string, unknown>;
  const lifecycleNetwork = lifecycle.network as Array<Record<string, unknown>>;
  lifecycleNetwork[0].url = "blob:http://127.0.0.1:8123/module";
  lifecycleNetwork[0].responseBody = {
    status: "unavailable",
    reason: "Blob bytes retained by the separate constructor audit",
  };
  (evidence.cleanup as unknown as Record<string, unknown>).cgroup = {
    outcome: "failure",
    checkedAt: "2026-08-02T10:00:02Z",
    remaining: ["1234"],
    error: "cgroup retained one identity-bound member",
  };
  assert(validate(evidence), JSON.stringify(validate.errors));
});

Deno.test("collector source freezes clean-HEAD, exact-byte, lifecycle, and owned-cleanup behavior without launching Chrome", async () => {
  const source = await Deno.readTextFile(
    "scripts/collect-v1-json-telemetry-browser-evidence.ts",
  );
  for (
    const required of [
      '"status", "--porcelain=v1", "--untracked-files=all"',
      '"rev-parse", "HEAD^{tree}"',
      "fetched raw response differs from clean HEAD source",
      "__collectorBlobAudit",
      "completionImportedModule: true",
      'id: "js-bounded"',
      'id: "js-exact"',
      'id: "wasm-bounded"',
      'id: "wasm-exact"',
      'id: "wrong-token"',
      'id: "stale-error-restart"',
      'id: "cancel"',
      'id: "timeout"',
      'id: "pagehide"',
      "Accessibility.getFullAXTree",
      "Page.captureScreenshot",
      "Network.getResponseBody",
      "cgroup.kill",
      "profile retained because process containment cleanup did not succeed",
    ]
  ) assert(source.includes(required), `collector omitted ${required}`);
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
      value.forEach((entry, index) => visit(entry, `${path}/${index}`));
      return;
    }
    const record = value as Record<string, unknown>;
    if (record.type === "object" && record.additionalProperties !== false) open.push(path);
    for (const [key, entry] of Object.entries(record)) visit(entry, `${path}/${key}`);
  }
  visit(schema, "#");
  assertEquals(open, []);
});

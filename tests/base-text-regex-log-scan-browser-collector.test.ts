import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import {
  EXPECTED_ASSETS,
  EXPECTED_COUNTERS,
  INPUT_SHA256,
  OUTPUT_SHA256,
  validateFullResult,
} from "../scripts/collect-base-text-regex-log-scan-evidence.ts";
import { assert, assertEquals } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
type AddFormats = (ajv: unknown) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

const H40 = "a".repeat(40);
const H64 = "b".repeat(64);
const regressionReason =
  "The accepted UI exposes only the exact registered 100 MiB fixture; static target-equivalence tests retain this regression.";

function processIdentity(pid: number) {
  return {
    pid,
    parentPid: pid - 1,
    startTimeTicks: String(pid * 100),
    executable: "/opt/google/chrome/chrome",
  };
}

function fetchedAssets() {
  return EXPECTED_ASSETS.map((asset) => ({
    route: asset.route,
    sourcePath: asset.sourcePath,
    role: asset.role,
    requestCount: 1,
    status: 200,
    mimeType: asset.role === "wasm" ? "application/wasm" : "text/plain",
    fromDiskCache: false,
    fromServiceWorker: false,
    bytes: 100,
    sha256: H64,
  }));
}

function executedScripts() {
  return EXPECTED_ASSETS.filter((asset) => asset.executed).map((asset) => ({
    route: asset.route,
    sourcePath: asset.sourcePath,
    contexts: asset.route.endsWith("demo.js") ? ["page"] : ["worker"],
    bytes: 100,
    sha256: H64,
  }));
}

function modeRun(mode: "js-controlled" | "wasm-linear-controlled") {
  return {
    mode,
    action: "visible-control-complete",
    inputSha256: INPUT_SHA256,
    outputSha256: OUTPUT_SHA256,
    counters: {
      ...EXPECTED_COUNTERS,
      perPattern: [...EXPECTED_COUNTERS.perPattern],
      boundaryCrossings: mode === "js-controlled" ? 0 : 1,
    },
    visible: {
      status: "Complete. Exact registration and oracle passed.",
      result: `Variant: ${mode}`,
      progress: 4,
      startDisabled: false,
      cancelDisabled: true,
    },
    fetchedAssets: fetchedAssets(),
    executedScripts: executedScripts(),
    console: [],
    exceptions: [],
    accessibility: {
      nodeCount: 30,
      treeSha256: H64,
      mainPresent: true,
      h1Named: true,
      engineLabelled: true,
      startNamed: true,
      cancelNamed: true,
      statusLive: true,
      resultFocusable: true,
    },
    screenshot: {
      path: `artifacts/base/text-regex-log-scan/browser-evidence/screenshots/${mode}.png`,
      format: "png",
      bytes: 1_000,
      sha256: H64,
    },
  };
}

function lifecycle(id: string) {
  return {
    id,
    action: "visible-controller-lifecycle-probe",
    finalStatus: "Cancelled. The worker was terminated.",
    workerCount: id === "restart" ? 2 : 1,
    terminatedWorkers: id === "restart" ? 2 : 1,
    wrongTokenIgnored: id === "wrong-token",
    staleErrorIgnored: id === "stale-error",
    restartReplacedWorker: id === "restart",
    cancelTerminatedWorker: id === "cancel",
    timeoutTerminatedWorker: id === "timeout",
    pagehideTerminatedWorker: id === "pagehide",
    console: [],
    exceptions: [],
  };
}

function validEvidence() {
  return {
    schemaVersion: 1,
    evidenceId: "base-text-regex-log-scan-chrome-v1",
    collectedAt: "2026-04-01T12:00:00.000Z",
    source: { head: H40, tree: H40, root: "/src/wasm-vs-js", clean: true },
    collection: {
      script: "scripts/collect-base-text-regex-log-scan-evidence.ts",
      scriptBytes: 40_000,
      scriptSha256: H64,
      command:
        "deno run -A scripts/collect-base-text-regex-log-scan-evidence.ts --chrome=/opt/google/chrome/chrome",
    },
    workload: {
      id: "text.regex-log-scan.v1",
      registrationId: "text.regex-log-scan.v1-controlled-registration-v1",
      route: "/demos/base/text.regex-log-scan.v1/",
      implementationSourceCommit: H40,
      inputBytes: 104_857_600,
      patterns: 20,
      inputSha256: INPUT_SHA256,
      outputSha256: OUTPUT_SHA256,
      modes: ["js-controlled", "wasm-linear-controlled"],
      performanceClaim: false,
    },
    browser: {
      product: "Chrome/150.0.7871.24",
      revision: "r1",
      userAgent: "Mozilla/5.0 Chrome/150.0.0.0",
      jsVersion: "15.0.1",
      protocol: "Chrome DevTools Protocol",
      executable: {
        path: "/opt/google/chrome/chrome",
        bytes: 1_000_000,
        sha256: H64,
        dev: 1,
        ino: 2,
      },
      launchArguments: new Array(16).fill(0).map((_, index) => `--flag-${index}`),
      headless: true,
      profile: {
        path: "/tmp/wasm-base-regex-chrome-fixture",
        dev: 3,
        ino: 4,
        createdEmpty: true,
      },
    },
    server: { origin: "http://127.0.0.1:8123", mode: "public", launcher: processIdentity(700) },
    modeRuns: [modeRun("js-controlled"), modeRun("wasm-linear-controlled")],
    uiRegressions: ["malformed-utf8", "url-tail-96", "url-tail-97"].map((id) => ({
      id,
      uiStatus: "not-exposed-by-demo-ui",
      reason: regressionReason,
    })),
    lifecycle: ["wrong-token", "stale-error", "restart", "cancel", "timeout", "pagehide"].map(
      lifecycle,
    ),
    cleanup: {
      browser: {
        launcher: processIdentity(800),
        observedProcesses: [processIdentity(800), processIdentity(801)],
        requested: "Browser.close",
        signals: [],
        exit: { success: true, code: 0, signal: null },
        processesAbsent: true,
        executableUnchanged: true,
      },
      profile: {
        path: "/tmp/wasm-base-regex-chrome-fixture",
        identityMatched: true,
        removed: true,
        absent: true,
      },
      server: {
        launcher: processIdentity(700),
        signal: "SIGTERM",
        exit: { success: false, code: 143, signal: "SIGTERM" },
        processAbsent: true,
      },
    },
  };
}

function assertInvalid(validate: Validator, mutate: (record: Record<string, unknown>) => void) {
  const record = structuredClone(validEvidence()) as unknown as Record<string, unknown>;
  mutate(record);
  assert(!validate(record), `mutation unexpectedly passed: ${JSON.stringify(validate.errors)}`);
}

function assertThrows(fn: () => void, includes: string) {
  try {
    fn();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(includes), String(error));
    return;
  }
  throw new Error("expected function to throw");
}

Deno.test("base regex Chrome evidence schema accepts only the complete two-mode contract", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-text-regex-log-scan-browser-evidence.schema.json"),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const record = validEvidence();
  assert(validate(record), JSON.stringify(validate.errors));
  assertEquals(record.modeRuns.map((run) => run.mode), [
    "js-controlled",
    "wasm-linear-controlled",
  ]);
  assertEquals(record.modeRuns.map((run) => run.fetchedAssets.length), [13, 13]);
  assertEquals(record.modeRuns.map((run) => run.executedScripts.length), [5, 5]);

  assertInvalid(validate, (value) => value.extra = true);
  assertInvalid(validate, (value) => ((value.source as Record<string, unknown>).clean = false));
  assertInvalid(
    validate,
    (value) => ((value.browser as Record<string, unknown>).product = "Chromium/150.0.7871.24"),
  );
  assertInvalid(validate, (value) => (value.modeRuns as unknown[]).pop());
  assertInvalid(validate, (value) => {
    const modes = value.modeRuns as Array<Record<string, unknown>>;
    [modes[0], modes[1]] = [modes[1], modes[0]];
  });
  assertInvalid(validate, (value) => {
    const run = (value.modeRuns as Array<Record<string, unknown>>)[0];
    (run.counters as Record<string, unknown>).matchesFound = 0;
  });
  assertInvalid(validate, (value) => {
    const run = (value.modeRuns as Array<Record<string, unknown>>)[1];
    (run.counters as Record<string, unknown>).boundaryCrossings = 0;
  });
  assertInvalid(validate, (value) => {
    const run = (value.modeRuns as Array<Record<string, unknown>>)[0];
    (run.counters as Record<string, unknown>).perPattern = new Array(19).fill(2048);
  });
  assertInvalid(validate, (value) => {
    const run = (value.modeRuns as Array<Record<string, unknown>>)[0];
    (run.fetchedAssets as unknown[]).pop();
  });
  assertInvalid(validate, (value) => {
    const run = (value.modeRuns as Array<Record<string, unknown>>)[0];
    const assets = run.fetchedAssets as Array<Record<string, unknown>>;
    assets[0].route = "/substituted-document";
  });
  assertInvalid(validate, (value) => {
    const run = (value.modeRuns as Array<Record<string, unknown>>)[0];
    (run.executedScripts as Array<Record<string, unknown>>)[0].extra = true;
  });
  assertInvalid(validate, (value) => {
    const run = (value.modeRuns as Array<Record<string, unknown>>)[0];
    const scripts = run.executedScripts as Array<Record<string, unknown>>;
    scripts[4].sourcePath = "benchmarks/text-regex-log-scan/input.js";
  });
  assertInvalid(validate, (value) => {
    const run = (value.modeRuns as Array<Record<string, unknown>>)[0];
    run.exceptions = [{ text: "boom" }];
  });
  assertInvalid(validate, (value) => {
    const regressions = value.uiRegressions as Array<Record<string, unknown>>;
    regressions[0].uiStatus = "passed";
  });
  assertInvalid(validate, (value) => {
    const lifecycleRecords = value.lifecycle as Array<Record<string, unknown>>;
    lifecycleRecords[0].wrongTokenIgnored = false;
  });
  assertInvalid(validate, (value) => {
    const lifecycleRecords = value.lifecycle as Array<Record<string, unknown>>;
    lifecycleRecords[0].staleErrorIgnored = true;
  });
  assertInvalid(validate, (value) => {
    const cleanup = value.cleanup as Record<string, Record<string, unknown>>;
    cleanup.browser.processesAbsent = false;
  });
});

Deno.test("base regex collector validates the full exact output and every structural counter", () => {
  const result = {
    workloadId: "text.regex-log-scan.v1",
    variant: "js-controlled",
    inputSha256: INPUT_SHA256,
    outputSha256: OUTPUT_SHA256,
    counters: {
      ...EXPECTED_COUNTERS,
      perPattern: [...EXPECTED_COUNTERS.perPattern],
      boundaryCrossings: 0,
    },
  };
  validateFullResult("js-controlled", result);
  assertEquals(EXPECTED_ASSETS.length, 13);
  assertEquals(EXPECTED_ASSETS.filter((asset) => asset.executed).length, 5);
  assertEquals(EXPECTED_COUNTERS.perPattern, new Array(20).fill(2048));
  assertThrows(
    () =>
      validateFullResult("js-controlled", {
        ...structuredClone(result),
        outputSha256: "0".repeat(64),
      }),
    "exact input/output hash mismatch",
  );
  const badCounter = structuredClone(result);
  badCounter.counters.prefixByteComparisons--;
  assertThrows(
    () => validateFullResult("js-controlled", badCounter),
    "counter prefixByteComparisons",
  );
  const badPatternVector = structuredClone(result);
  badPatternVector.counters.perPattern[19] = 0;
  assertThrows(() => validateFullResult("js-controlled", badPatternVector), "counter perPattern");
  const badBoundary = structuredClone(result);
  badBoundary.counters.boundaryCrossings = 1;
  assertThrows(() => validateFullResult("js-controlled", badBoundary), "counter boundaryCrossings");
});

Deno.test("base regex collector source freezes provenance, lifecycle, diagnostics, and owned cleanup", async () => {
  const source = await Deno.readTextFile(
    "scripts/collect-base-text-regex-log-scan-evidence.ts",
  );
  for (
    const required of [
      '"--porcelain=v1"',
      '"HEAD"',
      '"HEAD^{tree}"',
      "raw fetched bytes differ from clean HEAD",
      "executed source differs from raw clean-HEAD bytes",
      "Debugger.getScriptSource",
      "Network.getResponseBody",
      "Accessibility.getFullAXTree",
      "Page.captureScreenshot",
      '"wrong-token"',
      '"stale-error"',
      '"restart"',
      '"cancel"',
      '"timeout"',
      '"pagehide"',
      '"Browser.close"',
      "identityStillRunning",
      "profile identity changed before removal",
      "NO_MATCH_SENTINEL_DO_NOT_FIND",
    ]
  ) {
    if (required === "NO_MATCH_SENTINEL_DO_NOT_FIND") {
      assert(!source.includes(required));
    } else {
      assert(source.includes(required), `collector omitted ${required}`);
    }
  }
  for (const forbidden of ["pkill", "killall", "Deno.run(", "performanceClaim: true"]) {
    assert(!source.includes(forbidden), `collector contains unsafe or out-of-scope ${forbidden}`);
  }
});

Deno.test("base regex evidence schema closes every property-bearing contract object", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-text-regex-log-scan-browser-evidence.schema.json"),
  );
  const open: string[] = [];
  const visit = (value: unknown, path: string) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}/${index}`));
      return;
    }
    const object = value as Record<string, unknown>;
    if (object.type === "object" && object.required && object.additionalProperties !== false) {
      open.push(path);
    }
    for (const [name, child] of Object.entries(object)) visit(child, `${path}/${name}`);
  };
  visit(schema, "#");
  assertEquals(open, []);
});

import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import {
  CFT_EXECUTABLE_SHA256,
  CFT_PRODUCT,
  classifyExecutedScriptUrl,
  EXPECTED_ASSETS,
  EXPECTED_COUNTERS,
  EXPECTED_LIFECYCLE,
  INPUT_SHA256,
  OUTPUT_SHA256,
  retainRequestHop,
  STATIC_LAUNCH_ARGUMENTS,
  validateEvidenceRelationships,
  validateFullResult,
  WORKLOAD_ROUTE,
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
    requestCount: asset.requestCount,
    status: 200,
    mimeType: asset.role === "wasm" ? "application/wasm" : "text/plain",
    fromDiskCache: false,
    fromServiceWorker: false,
    bytes: 100,
    sha256: H64,
  }));
}

function executedScripts() {
  return EXPECTED_ASSETS.filter((asset) => asset.executedIn.length > 0).map((asset) => ({
    route: asset.route,
    sourcePath: asset.sourcePath,
    contexts: [...asset.executedIn],
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

function lifecycle(id: keyof typeof EXPECTED_LIFECYCLE) {
  const expected = EXPECTED_LIFECYCLE[id];
  return {
    id,
    action: "visible-controller-lifecycle-probe",
    finalStatus: expected.finalStatus,
    workerCount: expected.workers,
    terminatedWorkers: expected.terminated,
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
    source: { head: H40, tree: H40, root: "/src/wasm-vs-js", clean: true, endCheck: true },
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
      channel: "chrome-for-testing",
      product: CFT_PRODUCT,
      revision: "r1",
      userAgent: "Mozilla/5.0 Chrome/150.0.0.0",
      jsVersion: "15.0.1",
      protocol: "Chrome DevTools Protocol",
      executable: {
        path: "/opt/google/chrome/chrome",
        bytes: 1_000_000,
        sha256: CFT_EXECUTABLE_SHA256,
        dev: 1,
        ino: 2,
      },
      launchArguments: [
        ...STATIC_LAUNCH_ARGUMENTS,
        "--remote-debugging-port=9222",
        "--user-data-dir=/tmp/wasm-base-regex-chrome-fixture",
        "about:blank",
      ],
      headless: true,
      profile: {
        path: "/tmp/wasm-base-regex-chrome-fixture",
        dev: 3,
        ino: 4,
        createdEmpty: true,
      },
      ownership: {
        unit: "wasm-base-regex-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.scope",
        cgroup: {
          path:
            "/user.slice/user-1000.slice/user@1000.service/app.slice/wasm-base-regex-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.scope",
          dev: 5,
          ino: 6,
        },
        scopeLauncherAtLaunch: processIdentity(799),
        browserAtLaunch: processIdentity(800),
        preCgroupProcesses: [processIdentity(799), processIdentity(800)],
        cdpListener: {
          address: "127.0.0.1",
          port: 9222,
          inode: "123456",
          owner: processIdentity(800),
        },
        listenerChecks: ["before-connect", "after-connect", "before-use", "after-use"].map(
          (phase) => ({
            phase,
            address: "127.0.0.1",
            port: 9222,
            inode: "123456",
            owner: processIdentity(800),
          }),
        ),
      },
    },
    server: { origin: "http://127.0.0.1:8123", mode: "public", launcher: processIdentity(700) },
    modeRuns: [modeRun("js-controlled"), modeRun("wasm-linear-controlled")],
    uiRegressions: ["malformed-utf8", "url-tail-96", "url-tail-97"].map((id) => ({
      id,
      uiStatus: "not-exposed-by-demo-ui",
      reason: regressionReason,
    })),
    lifecycle: (
      ["wrong-token", "stale-error", "restart", "cancel", "timeout", "pagehide"] as const
    ).map(lifecycle),
    cleanup: {
      browser: {
        unit: "wasm-base-regex-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.scope",
        cgroup: {
          path:
            "/user.slice/user-1000.slice/user@1000.service/app.slice/wasm-base-regex-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.scope",
          dev: 5,
          ino: 6,
        },
        launcher: processIdentity(800),
        observedProcesses: [processIdentity(799), processIdentity(800), processIdentity(801)],
        requested: "Browser.close",
        signals: [],
        exit: { success: true, code: 0, signal: null },
        processesAbsent: true,
        executableUnchanged: true,
        cgroupIdentityMatched: true,
        cgroupEmpty: true,
        cgroupRemoved: true,
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
  const schemaValid = validate(record);
  let relationshipsValid = true;
  try {
    validateEvidenceRelationships(record);
  } catch {
    relationshipsValid = false;
  }
  assert(
    !schemaValid || !relationshipsValid,
    `mutation unexpectedly passed schema and semantics: ${JSON.stringify(validate.errors)}`,
  );
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

Deno.test("base regex collector retains redirect hops and rejects every unexpected script scheme", () => {
  const origin = "http://127.0.0.1:8123";
  const requests = new Map<string, Record<string, unknown>>();
  const active = new Map<string, string>();
  const violations: string[] = [];
  assertEquals(
    retainRequestHop(requests, active, violations, origin, "session-a", {
      requestId: "request-a",
      request: { url: `${origin}${WORKLOAD_ROUTE}`, method: "GET" },
    }),
    "session-a:request-a:0",
  );
  assertEquals(
    retainRequestHop(requests, active, violations, origin, "session-a", {
      requestId: "request-a",
      redirectResponse: {
        status: 302,
        mimeType: "text/html",
        fromDiskCache: false,
        fromServiceWorker: false,
      },
      request: { url: "data:text/javascript,unexpected", method: "GET" },
    }),
    "session-a:request-a:1",
  );
  assertEquals([...requests.keys()], ["session-a:request-a:0", "session-a:request-a:1"]);
  assertEquals(requests.get("session-a:request-a:0")?.redirected, true);
  assert(violations.some((message) => message.includes("unexpected redirect hop retained")));
  assert(violations.some((message) => message.includes("unexpected request URL/method")));

  assertEquals(
    classifyExecutedScriptUrl(`${origin}/demos/base/text.regex-log-scan.v1/demo.js`, origin),
    { kind: "asset", route: "/demos/base/text.regex-log-scan.v1/demo.js" },
  );
  for (
    const url of [
      "",
      "data:text/javascript,unexpected",
      "blob:http://127.0.0.1:8123/unexpected",
      "javascript:unexpected",
      "file:///tmp/unexpected.js",
      "https://127.0.0.1:8123/unexpected.js",
      "http://foreign.invalid/unexpected.js",
    ]
  ) {
    assertThrows(() => classifyExecutedScriptUrl(url, origin), "executed script");
  }
});

Deno.test("base regex Chrome evidence schema accepts only the complete two-mode contract", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-text-regex-log-scan-browser-evidence.schema.json"),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const record = validEvidence();
  assert(validate(record), JSON.stringify(validate.errors));
  validateEvidenceRelationships(record as unknown as Record<string, unknown>);
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
    (value) => ((value.browser as Record<string, unknown>).channel = "stable"),
  );
  assertInvalid(
    validate,
    (value) => ((value.browser as Record<string, unknown>).product = "Chrome/151.0.0.0"),
  );
  assertInvalid(validate, (value) => {
    const browser = value.browser as Record<string, Record<string, unknown>>;
    browser.executable.sha256 = H64;
  });
  assertInvalid(validate, (value) => {
    const browser = value.browser as Record<string, Record<string, unknown>>;
    browser.executable.path = "/opt/google/chrome/substitute";
  });
  assertInvalid(validate, (value) => {
    const source = value.source as Record<string, unknown>;
    source.endCheck = false;
  });
  assertInvalid(validate, (value) => {
    const browser = value.browser as Record<string, unknown>;
    const args = browser.launchArguments as string[];
    args[15] = "--disable-automation";
  });
  assertInvalid(validate, (value) => {
    const browser = value.browser as Record<string, unknown>;
    const ownership = browser.ownership as Record<string, Record<string, unknown>>;
    ownership.cdpListener.inode = "not-an-inode";
  });
  assertInvalid(validate, (value) => {
    const browser = value.browser as Record<string, unknown>;
    const args = browser.launchArguments as string[];
    args[17] = "--remote-debugging-port=9333";
  });
  assertInvalid(validate, (value) => {
    const browser = value.browser as Record<string, Record<string, unknown>>;
    browser.profile.path = "/tmp/wasm-base-regex-chrome-other";
  });
  assertInvalid(validate, (value) => {
    const browser = value.browser as Record<string, unknown>;
    const ownership = browser.ownership as Record<string, unknown>;
    ownership.unit = "wasm-base-regex-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.scope";
  });
  assertInvalid(validate, (value) => {
    const browser = value.browser as Record<string, unknown>;
    const ownership = browser.ownership as Record<string, Record<string, unknown>>;
    const owner = ownership.cdpListener.owner as Record<string, unknown>;
    owner.executable = "/opt/google/chrome/substitute";
  });
  assertInvalid(validate, (value) => {
    const browser = value.browser as Record<string, unknown>;
    const ownership = browser.ownership as Record<string, Record<string, unknown>>;
    ownership.browserAtLaunch.executable = "/opt/google/chrome/substitute";
  });
  assertInvalid(validate, (value) => {
    const cleanup = value.cleanup as Record<string, Record<string, unknown>>;
    const launcher = cleanup.browser.launcher as Record<string, unknown>;
    launcher.executable = "/opt/google/chrome/substitute";
  });
  assertInvalid(validate, (value) => {
    const cleanup = value.cleanup as Record<string, Record<string, unknown>>;
    const cgroup = cleanup.browser.cgroup as Record<string, unknown>;
    cgroup.path =
      "/user.slice/user-1000.slice/user@1000.service/app.slice/wasm-base-regex-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.scope";
  });
  assertInvalid(validate, (value) => {
    const browser = value.browser as Record<string, unknown>;
    const ownership = browser.ownership as Record<string, unknown>;
    const checks = ownership.listenerChecks as Array<Record<string, unknown>>;
    checks[3].inode = "654321";
  });
  assertInvalid(validate, (value) => {
    const browser = value.browser as Record<string, unknown>;
    const ownership = browser.ownership as Record<string, unknown>;
    ownership.preCgroupProcesses = [processIdentity(798)];
  });
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
    assets[3].requestCount = 1;
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
    scripts[0].contexts = ["worker"];
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
    const lifecycleRecords = value.lifecycle as Array<Record<string, unknown>>;
    lifecycleRecords[2].workerCount = 1;
  });
  assertInvalid(validate, (value) => {
    const lifecycleRecords = value.lifecycle as Array<Record<string, unknown>>;
    lifecycleRecords[4].finalStatus = "Failed: approximately timed out";
  });
  assertInvalid(validate, (value) => {
    const lifecycleRecords = value.lifecycle as Array<Record<string, unknown>>;
    lifecycleRecords[0].console = [{ type: "log", arguments: ["unexpected"] }];
  });
  assertInvalid(validate, (value) => {
    const cleanup = value.cleanup as Record<string, Record<string, unknown>>;
    cleanup.browser.processesAbsent = false;
  });
  assertInvalid(validate, (value) => {
    const cleanup = value.cleanup as Record<string, Record<string, unknown>>;
    cleanup.browser.cgroupRemoved = false;
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
  assertEquals(CFT_PRODUCT, "Chrome/150.0.7871.24");
  assertEquals(
    CFT_EXECUTABLE_SHA256,
    "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
  );
  assertEquals(EXPECTED_ASSETS.length, 13);
  assertEquals(EXPECTED_ASSETS.filter((asset) => asset.executedIn.length > 0).length, 5);
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
      "unexpected URL-less/eval executed script",
      "unexpected executed script scheme",
      "executed script escaped owned origin",
      "unexpected redirect hop retained",
      "request ID reused without redirect response",
      "unexpected same-origin executed script",
      "unexpected owned-origin request",
      "asset request count mismatch",
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
      '"--enable-automation"',
      "listenerOwnership",
      "revalidateListener",
      '"after-connect"',
      '"before-use"',
      '"after-use"',
      '"Browser.getBrowserCommandLine"',
      "pinned launch arguments",
      "waitForScopeCgroup",
      "startOwnedProcessTracker",
      "scope launcher identity disappeared immediately after launch",
      "launched Chrome identity was not retained before cgroup acquisition",
      "startCgroupTracker",
      "cgroup.kill",
      "processCgroupPath",
      "identityStillRunning",
      "end source check",
      "collector failure cleanup was not exact",
      "approved Chrome for Testing executable SHA-256",
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

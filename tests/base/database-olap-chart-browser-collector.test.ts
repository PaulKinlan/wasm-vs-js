import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import {
  EXPECTED_CHROME_PRODUCT,
  LIFECYCLE_IDS,
  ROUTE_SOURCES,
  SOURCE_PATHS,
  TARGETS,
  validateAccessibleResults,
  validateCompleteResult,
  validateLifecycleRecord,
} from "../../scripts/collect-base-database-olap-chart-browser-evidence.ts";
import { assert, assertEquals } from "../assert.ts";

type Json = Record<string, unknown>;
type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats =
  ((addFormatsModule as unknown as { default?: (value: unknown) => void }).default ??
    addFormatsModule) as unknown as (value: unknown) => void;
const H40 = "a".repeat(40);
const H64 = "b".repeat(64);
const oracle = JSON.parse(
  await Deno.readTextFile("public/artifacts/database-olap-chart/output-manifest.json"),
) as Json;
const schema = JSON.parse(
  await Deno.readTextFile("schemas/base-database-olap-chart-browser-evidence.schema.json"),
);

function validator(): Validator {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

function process(pid: number) {
  return {
    pid,
    parentPid: pid - 1,
    startTimeTicks: String(pid * 10),
    executable: "/opt/google/chrome/chrome",
  };
}

function counters(target: (typeof TARGETS)[number]) {
  return structuredClone(((oracle.variants as Json)[target] as Json).counters);
}

function result(target: (typeof TARGETS)[number]) {
  return {
    workloadId: "database.olap-chart.v1",
    variantId: target,
    digest: "e26a152f",
    outputBytes: 2240,
    counters: counters(target),
    chartModels: structuredClone((oracle.completeOutput as Json).chartModels),
    validation: {
      expectedDigest: "e26a152f",
      exactArtifactHashes: true,
      fullOutputValidated: true,
      countersValidated: true,
      crossTargetValidated: true,
      oracleValidated: true,
      allFiveModelsValidated: true,
    },
  };
}

function accessibleResults(target: (typeof TARGETS)[number]) {
  const targetResult = result(target);
  return ((oracle.completeOutput as Json).chartModels as Json[]).map((model, query) => ({
    query,
    rawText: JSON.stringify(
      {
        workloadId: "database.olap-chart.v1",
        variantId: target,
        digest: "e26a152f",
        counters: targetResult.counters,
        displayedChartModel: model,
        validation: targetResult.validation,
      },
      null,
      2,
    ),
    chartLabel: `Query ${query + 1}: ${model.matchedRows} matched rows across 16 category bins`,
    rawTextSha256: H64,
  }));
}

function pageState(
  status = "Complete. Artifact hashes, both targets, and all five models passed.",
) {
  return {
    status,
    result: "accessible exact JSON result",
    chartLabel: "Query 5: 3180 matched rows across 16 category bins",
    startDisabled: false,
    cancelDisabled: true,
    statusHistory: ["Ready. The worker stops after 15 seconds.", status],
    workerCount: 1,
    terminatedWorkers: 1,
  };
}

function network(index: number) {
  const routes = Object.keys(ROUTE_SOURCES).filter((route) =>
    route !== "/favicon.ico" && route !== "/favicon.svg"
  );
  const route = routes[index % routes.length];
  return {
    targetId: `target-${index}`,
    targetIdSha256: H64,
    sessionId: `session-${index}`,
    sessionIdSha256: H64,
    requestId: `request-${index}`,
    requestIdSha256: H64,
    url: `http://127.0.0.1:8123${route}`,
    route,
    method: "GET",
    resourceType: "Script",
    status: 200,
    mimeType: "text/javascript",
    fromDiskCache: false,
    fromServiceWorker: false,
    failed: false,
    sourcePath: ROUTE_SOURCES[route],
    sourceBytes: 100,
    sourceSha256: H64,
    sourceGitBlob: H40,
    rawResponseBytes: 100,
    rawResponseSha256: H64,
    exactSourceMatch: true,
  };
}

function accessibility(status: string) {
  return {
    bodyTextSha256: H64,
    statusText: status,
    resultText: "accessible exact JSON result",
    resultTextSha256: H64,
    inspectedAxNodes: 50,
    axTreeSha256: H64,
    assertions: {
      languageEnglish: true,
      mainLandmark: true,
      namedHeading: true,
      labelledTarget: true,
      labelledQuery: true,
      namedControls: true,
      liveStatus: true,
      keyboardTextResult: true,
    },
  };
}

function screenshot(id: string) {
  return {
    path: `olap-evidence.screenshots/${id}.png`,
    format: "png",
    bytes: 100,
    sha256: H64,
  };
}

function completeScenario(target: (typeof TARGETS)[number]) {
  const id = target === "js-controlled"
    ? "complete-js-controlled"
    : "complete-wasm-linear-controlled";
  const state = pageState();
  return {
    id,
    kind: "complete",
    target,
    route: "/benchmarks/database-olap-chart/",
    targetId: `${id}-target`,
    targetIdSha256: H64,
    sessionId: `${id}-session`,
    sessionIdSha256: H64,
    finalState: state,
    semantic: {
      result: result(target),
      accessibleResults: accessibleResults(target),
      assertionPassed: true,
    },
    console: [],
    exceptions: [],
    network: Array.from({ length: 12 }, (_, index) => network(index)),
    accessibility: accessibility(state.status),
    screenshot: screenshot(id),
  };
}

function lifecycleScenario(id: (typeof LIFECYCLE_IDS)[number]) {
  const outerId = `lifecycle-${id}`;
  const status = id === "timeout"
    ? "Timed out after 15 seconds; the owned worker was terminated."
    : id === "cancel" || id === "wrong-token" || id === "stale" || id === "restart"
    ? "Cancelled; late output from the invalidated token is ignored."
    : "Running all five queries in a fresh worker…";
  const state = pageState(status);
  const assertions = {
    wrongTokenIgnored: id === "wrong-token",
    staleWorkerIgnored: id === "stale",
    restartReplacedWorker: id === "restart",
    timeoutTerminatedWorker: id === "timeout",
    cancelTerminatedWorker: id === "cancel",
    pagehideTerminatedWorker: id === "pagehide",
  };
  return {
    id: outerId,
    kind: "lifecycle",
    target: "js-controlled",
    route: "/benchmarks/database-olap-chart/",
    targetId: `${outerId}-target`,
    targetIdSha256: H64,
    sessionId: `${outerId}-session`,
    sessionIdSha256: H64,
    finalState: state,
    semantic: {
      id,
      action: "controller-lifecycle-probe",
      finalState: state,
      workerCount: id === "restart" ? 2 : 1,
      terminatedWorkers: id === "restart" ? 2 : 1,
      assertions,
      assertionPassed: true,
    },
    console: [],
    exceptions: [],
    network: Array.from({ length: 3 }, (_, index) => network(index)),
    accessibility: accessibility(state.status),
    screenshot: screenshot(outerId),
  };
}

function evidence() {
  const launchArguments = [
    `--user-data-dir=/tmp/wasm-vs-js-owned-profiles/olap-${"a".repeat(32)}/profile`,
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
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
    "--enable-automation",
    "--hide-scrollbars",
    "--window-size=1440,1200",
    "about:blank",
  ];
  return {
    schemaVersion: 1,
    evidenceId: "database-olap-chart-browser-aaaaaaaaaaaa",
    collectedAt: "2026-08-03T12:00:00.000Z",
    workloadId: "database.olap-chart.v1",
    performanceClaims: [],
    source: {
      commit: H40,
      tree: H40,
      root: "/src/wasm-vs-js",
      clean: true,
      files: SOURCE_PATHS.map((path) => ({ path, bytes: 100, sha256: H64, gitBlob: H40 })),
      endCheck: { commit: H40, tree: H40, clean: true, checkedAfterCleanup: true },
    },
    collector: {
      script: "scripts/collect-base-database-olap-chart-browser-evidence.ts",
      scriptBytes: 50_000,
      scriptSha256: H64,
      command: [
        "/usr/bin/deno",
        "run",
        "-A",
        "scripts/collect-base-database-olap-chart-browser-evidence.ts",
        "--source-root=/src/wasm-vs-js",
        `--source-commit=${H40}`,
        "--chrome=/opt/google/chrome/chrome",
        "--output=/tmp/evidence.json",
      ],
      denoVersion: "2.9.0",
      parentPid: 100,
    },
    browser: {
      product: EXPECTED_CHROME_PRODUCT,
      revision: "revision",
      userAgent: "Mozilla/5.0 Chrome/150.0.7871.24",
      jsVersion: "15.0",
      executable: {
        path: "/opt/google/chrome/chrome",
        bytes: 1000000,
        sha256: H64,
        dev: 1,
        ino: 2,
      },
      requestedLaunchArguments: launchArguments,
      effectiveCommandLine: ["/opt/google/chrome/chrome", ...launchArguments],
      headless: true,
      protocol: "Chrome DevTools Protocol",
      devtools: {
        address: "127.0.0.1",
        port: 9222,
        browserPath: "/devtools/browser/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        webSocketOrigin: "ws://127.0.0.1:9222",
      },
      profile: {
        path: `/tmp/wasm-vs-js-owned-profiles/olap-${"a".repeat(32)}/profile`,
        mode: 448,
        ownershipRoot: `/tmp/wasm-vs-js-owned-profiles/olap-${"a".repeat(32)}`,
        ownershipParentDev: 2,
        ownershipParentIno: 3,
        ownershipDev: 4,
        ownershipIno: 5,
        removeOwnershipRoot: true,
        profileRoot: `/tmp/wasm-vs-js-owned-profiles/olap-${"a".repeat(32)}/profile`,
        profileDev: 6,
        profileIno: 7,
      },
      cgroup: {
        unit: "wasm-olap-chart-aaaaaaaaaaaaaaaa.service",
        controlGroup: "/user.slice/exact.service",
        path: "/sys/fs/cgroup/user.slice/exact.service",
        dev: 5,
        ino: 6,
        invocationId: "c".repeat(32),
        mainPid: 200,
        memberSnapshots: Array.from({ length: 9 }, (_, index) => ({
          at: `2026-08-03T12:00:0${index}.000Z`,
          pids: [200, 201],
        })),
      },
    },
    server: {
      origin: "http://127.0.0.1:8123",
      mode: "public",
      launcher: process(150),
    },
    contract: {
      digest: "e26a152f",
      completeOutput: structuredClone(oracle.completeOutput),
      targets: ["js-controlled", "wasm-linear-controlled"],
      queries: 5,
      binsPerModel: 16,
      topRowsPerModel: 8,
      crossTargetValidated: true,
    },
    scenarios: [
      completeScenario("js-controlled"),
      completeScenario("wasm-linear-controlled"),
      ...LIFECYCLE_IDS.map(lifecycleScenario),
    ],
    cleanup: {
      browser: {
        requested: "cgroup.kill",
        processesAbsent: true,
        remainingPids: [],
        mainProcess: process(200),
        observedProcesses: [process(200), process(201)],
      },
      profile: {
        removed: true,
        absent: true,
        path: `/tmp/wasm-vs-js-owned-profiles/olap-${"a".repeat(32)}/profile`,
      },
      server: { signal: "SIGTERM", processAbsent: true, launcher: process(150) },
    },
  };
}

function assertThrows(fn: () => unknown, text: string): void {
  try {
    fn();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(text), String(error));
    return;
  }
  throw new Error("expected function to throw");
}

Deno.test("OLAP parent collector validates both complete 560-word target results and five accessible models", () => {
  const js = result("js-controlled");
  const wasm = result("wasm-linear-controlled");
  validateCompleteResult(js, "js-controlled", oracle);
  validateCompleteResult(wasm, "wasm-linear-controlled", oracle);
  validateAccessibleResults(accessibleResults("js-controlled"), js, oracle);
  validateAccessibleResults(accessibleResults("wasm-linear-controlled"), wasm, oracle);
  assertEquals(((oracle.completeOutput as Json).values as unknown[]).length, 560);
  assertEquals(((oracle.completeOutput as Json).chartModels as Json[]).length, 5);
  assertEquals(
    ((oracle.completeOutput as Json).chartModels as Json[]).map((
      model,
    ) => [(model.bins as unknown[]).length, (model.topRows as unknown[]).length]),
    [[16, 8], [16, 8], [16, 8], [16, 8], [16, 8]],
  );

  const wrongWordCount = structuredClone(oracle);
  (wrongWordCount.completeOutput as Json).words = 559;
  assertThrows(
    () => validateCompleteResult(js, "js-controlled", wrongWordCount),
    "560-word oracle",
  );
  const wrongCounter = structuredClone(wasm);
  (wrongCounter.counters as Json).boundaryCrossings = 0;
  assertThrows(
    () => validateCompleteResult(wrongCounter, "wasm-linear-controlled", oracle),
    "counters mismatch",
  );
  const wrongModel = structuredClone(js);
  ((wrongModel.chartModels as Json[])[4].bins as Json[]).pop();
  assertThrows(
    () => validateCompleteResult(wrongModel, "js-controlled", oracle),
    "five chart models are incomplete",
  );
  const wrongAccessible = accessibleResults("js-controlled");
  wrongAccessible[2].rawText = wrongAccessible[1].rawText;
  assertThrows(
    () => validateAccessibleResults(wrongAccessible, js, oracle),
    "accessible query 3 mismatch",
  );
});

Deno.test("OLAP lifecycle semantic gate rejects every wrong-token, stale, restart, timeout, cancel, and pagehide false claim", () => {
  for (const id of LIFECYCLE_IDS) {
    const record = lifecycleScenario(id).semantic as Json;
    validateLifecycleRecord(record, id);
    const wrong = structuredClone(record);
    (wrong.assertions as Json)[
      id === "stale"
        ? "staleWorkerIgnored"
        : id === "restart"
        ? "restartReplacedWorker"
        : id === "timeout"
        ? "timeoutTerminatedWorker"
        : id === "cancel"
        ? "cancelTerminatedWorker"
        : id === "pagehide"
        ? "pagehideTerminatedWorker"
        : "wrongTokenIgnored"
    ] = false;
    assertThrows(() => validateLifecycleRecord(wrong, id), "lifecycle semantics mismatch");
  }
});

Deno.test("OLAP browser evidence schema accepts the exact closed parent record", () => {
  const validate = validator();
  const record = evidence();
  assert(validate(record), JSON.stringify(validate.errors));
  assertEquals(record.scenarios.map((scenario) => scenario.id), [
    "complete-js-controlled",
    "complete-wasm-linear-controlled",
    "lifecycle-wrong-token",
    "lifecycle-stale",
    "lifecycle-restart",
    "lifecycle-timeout",
    "lifecycle-cancel",
    "lifecycle-pagehide",
  ]);
});

Deno.test("OLAP browser evidence schema rejects open, partial, substituted, and false evidence", () => {
  const validate = validator();
  const mutations: Array<(value: ReturnType<typeof evidence>) => void> = [
    (value) => Object.assign(value, { fabricated: true }),
    (value) => Object.assign(value.source, { branch: "main" }),
    (value) => value.scenarios.pop(),
    (value) => {
      [value.scenarios[0], value.scenarios[1]] = [value.scenarios[1], value.scenarios[0]];
    },
    (value) => {
      value.browser.product = "Chromium/150.0.7871.24";
    },
    (value) => {
      value.browser.requestedLaunchArguments = value.browser.requestedLaunchArguments.filter((
        arg,
      ) => arg !== "--enable-automation");
    },
    (value) => {
      const completeOutput = value.contract.completeOutput as Json;
      (completeOutput.values as unknown[]).pop();
    },
    (value) => {
      const semantic = value.scenarios[0].semantic as Json;
      const scenarioResult = semantic.result as Json;
      (scenarioResult.counters as Json).outputWords = 559;
    },
    (value) => {
      value.scenarios[0].network[0].rawResponseSha256 = "not-a-sha256";
    },
    (value) => {
      value.scenarios[0].network[0].exactSourceMatch = false;
    },
    (value) => {
      (value.scenarios[0] as Json).exceptions = [{
        context: "page",
        text: "boom",
        lineNumber: 1,
      }];
    },
    (value) => {
      value.scenarios[0].accessibility.assertions.keyboardTextResult = false;
    },
    (value) => {
      value.cleanup.browser.processesAbsent = false;
    },
    (value) => {
      value.source.endCheck.checkedAfterCleanup = false;
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const record = structuredClone(evidence());
    mutate(record);
    assert(
      !validate(record),
      `negative evidence ${index} passed: ${JSON.stringify(validate.errors)}`,
    );
  }
});

Deno.test("OLAP evidence schema closes every object contract", () => {
  const open: string[] = [];
  const visit = (value: unknown, path: string): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}/${index}`));
      return;
    }
    const object = value as Json;
    if (object.type === "object" && object.additionalProperties !== false) open.push(path);
    for (const [key, child] of Object.entries(object)) visit(child, `${path}/${key}`);
  };
  visit(schema, "#");
  assertEquals(open, []);
});

Deno.test("OLAP collector source freezes parent-only exact Chrome, raw responses, diagnostics, TOCTOU, and cleanup without launching Chrome", async () => {
  const source = await Deno.readTextFile(
    "scripts/collect-base-database-olap-chart-browser-evidence.ts",
  );
  for (
    const required of [
      'EXPECTED_CHROME_PRODUCT = "Chrome/150.0.7871.24"',
      '"--enable-automation"',
      '"Browser.getBrowserCommandLine"',
      '"Network.getResponseBody"',
      "rawResponseSha256",
      "sourceGitBlob",
      "sessionIdSha256",
      "targetIdSha256",
      '"Accessibility.getFullAXTree"',
      '"Page.captureScreenshot"',
      '"wrong-token"',
      '"stale"',
      '"restart"',
      '"timeout"',
      '"cancel"',
      '"pagehide"',
      '"cgroup.kill"',
      "removeOwnedProfile(profileIdentity)",
      "end-of-collection source tree TOCTOU check failed",
      "evidence output must remain outside the exact clean source root",
    ]
  ) assert(source.includes(required), `collector omitted ${required}`);
  for (const forbidden of ["pkill", "killall", "Deno.kill(-1", "performanceClaims: [true"]) {
    assert(!source.includes(forbidden), `collector contains unsafe ${forbidden}`);
  }
  assertEquals(SOURCE_PATHS.length, 21);
  assertEquals(TARGETS, ["js-controlled", "wasm-linear-controlled"]);
  assertEquals(LIFECYCLE_IDS.length, 6);
});

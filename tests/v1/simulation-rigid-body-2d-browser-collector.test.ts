import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { canonicalize, sha256Hex } from "../../lib/canonical.ts";
import {
  ACCEPTED_COMMIT,
  ACCEPTED_TREE,
  EXPECTED_ASSETS,
  EXPECTED_CHROME_PRODUCT,
  EXPECTED_CHROME_SHA256,
  EXPECTED_METRICS,
  expectedCounters,
  SCENARIOS,
  validateCompleteResult,
} from "../../scripts/collect-simulation-rigid-body-2d-browser-evidence.ts";
import { assert, assertEquals } from "../assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: (ajv: unknown) => void }).default ??
  addFormatsModule) as unknown as (ajv: unknown) => void;
const H64 = "0".repeat(64), H40 = "0".repeat(40);

function visibleResult(target: "javascript" | "wasm-linear" | "both") {
  const execution = target === "javascript" ? "javascript" : "wasm-linear";
  const checks = target === "javascript"
    ? { javascriptMaximumError: 0 }
    : target === "wasm-linear"
    ? { wasmMaximumError: 0 }
    : {
      javascriptMaximumError: 0,
      wasmMaximumError: 0,
      crossTarget: {
        passed: true,
        violations: 0,
        maximumAbsoluteError: 0,
        maximumRelativeError: 0,
      },
    };
  return {
    target,
    checkpointDigest: "b54a6129",
    completeStateValues: 18_000,
    counters: expectedCounters(execution),
    metrics: { ...EXPECTED_METRICS },
    checks,
    performanceClaims: [],
  };
}

function scenario(
  id: string,
  action: string,
  target: "javascript" | "wasm-linear" | "both",
) {
  const complete = action === "complete";
  const workers = [
    { targetId: `${id}-worker-0`, sessionId: `${id}-worker-session-0` },
    ...(["stale-restart", "restart"].includes(action)
      ? [{ targetId: `${id}-worker-1`, sessionId: `${id}-worker-session-1` }]
      : []),
  ];
  const state = action === "cancel"
    ? {
      status: "Cancelled. The worker was terminated.",
      result: "No result retained.",
      progress: 0,
      startDisabled: false,
      cancelDisabled: true,
    }
    : action === "timeout"
    ? {
      status: "Run stopped after the 30 second limit.",
      result: "Running exact fixed work.",
      progress: 0,
      startDisabled: false,
      cancelDisabled: true,
    }
    : complete
    ? {
      status: "Complete. Correctness checks passed.",
      result: JSON.stringify(visibleResult(target)),
      progress: 3,
      startDisabled: false,
      cancelDisabled: true,
    }
    : {
      status: "Loading pinned fixture, manifests, and target…",
      result: "Running exact fixed work.",
      progress: 0,
      startDisabled: false,
      cancelDisabled: true,
    };
  const request = (index: number) => ({
    context: index === 0 ? "page" : "worker",
    sessionId: index === 0 ? `${id}-page-session` : workers[0].sessionId,
    requestId: `${index + 1}`,
    url: `http://127.0.0.1:34567/${
      index === 0 ? "benchmarks/simulation-rigid-body-2d-v1/" : `asset-${index}.js`
    }`,
    method: "GET",
    resourceType: index === 0 ? "Document" : "Script",
    status: 200,
    mimeType: index === 0 ? "text/html" : "text/javascript",
    fromDiskCache: false,
    fromServiceWorker: false,
    failed: false,
    errorText: null,
    responseBody: {
      status: "supported",
      bytes: 1,
      sha256: H64,
      base64: "YQ==",
      sourcePath: `source-${index}`,
      gitBlob: H40,
    },
  });
  const base = {
    id,
    action,
    target,
    sessionOwnership: {
      browserSessionId: "browser-session",
      page: { targetId: `${id}-page`, sessionId: `${id}-page-session` },
      workers,
    },
    statusHistory: ["Ready.", state.status],
    finalState: state,
    lifecycleEvents: [
      { kind: "worker-created", index: 0, url: "/worker.js" },
      { kind: "worker-terminated", index: 0 },
    ],
    network: [request(0), request(1), request(2)],
    executedScripts: [
      {
        context: "page",
        sessionId: `${id}-page-session`,
        targetId: `${id}-page`,
        route: "/runner.js",
        sourcePath: "runner.js",
        bytes: 1,
        sha256: H64,
        base64: "YQ==",
        gitBlob: H40,
      },
      {
        context: "worker",
        sessionId: workers[0].sessionId,
        targetId: workers[0].targetId,
        route: "/worker.js",
        sourcePath: "worker.js",
        bytes: 1,
        sha256: H64,
        base64: "YQ==",
        gitBlob: H40,
      },
    ],
    console: [],
    exceptions: [],
    accessibility: {
      inspectedBy: "Accessibility.getFullAXTree",
      nodes: [{ role: "main", name: "", ignored: false }],
      treeSha256: H64,
      assertions: {
        mainPresent: true,
        headingNamed: true,
        targetNamed: true,
        startNamed: true,
        cancelNamed: true,
        statusPresent: true,
        resultFocusable: true,
      },
    },
    screenshot: { file: `screenshots/${id}.png`, bytes: 8, sha256: H64 },
  };
  return complete
    ? { ...base, result: validateCompleteResult(target, visibleResult(target)) }
    : { ...base, lifecycle: { checks: [`${action} was causally observed`] } };
}

function evidence() {
  const launchArguments = [
    "--user-data-dir=/tmp/wasm-rigid-body-cft-test",
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
    "--hide-scrollbars",
    "--enable-automation",
    "--disable-cache",
    "--window-size=1440,1200",
    "about:blank",
  ];
  const process = {
    pid: 100,
    parentPid: 1,
    startTimeTicks: "1234",
    executable:
      "/home/paulkinlan/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome",
  };
  const checks = () => ({
    outcome: "success",
    checkedAt: "2026-08-03T12:00:00.000Z",
    remaining: [],
  });
  return {
    schemaVersion: 1,
    evidenceId: "simulation-rigid-body-2d-chrome-150-browser-evidence-v1",
    collectedAt: "2026-08-03T12:00:00.000Z",
    authority: {
      kind: "authoritative-parent-run-browser-collection",
      browserWasLaunchedByCollector: true,
      importedOrChildGeneratedEvidenceAccepted: false,
    },
    source: {
      acceptedCommit: ACCEPTED_COMMIT,
      acceptedTree: ACCEPTED_TREE,
      start: { commit: H40, tree: H40, cleanStatus: "clean" },
      end: { commit: H40, tree: H40, cleanStatus: "clean" },
      unchanged: true,
      root: "/source",
      sourceGraphSha256: H64,
      files: Object.entries(EXPECTED_ASSETS).map(([route, sourcePath], index) => ({
        route,
        sourcePath,
        bytes: index + 1,
        sha256: H64,
        gitBlob: H40,
        acceptedCommitBytesMatch: true,
      })),
      supportFiles: [
        "scripts/collect-simulation-rigid-body-2d-browser-evidence.ts",
        "schemas/simulation-rigid-body-2d-browser-evidence.schema.json",
        "lib/canonical.ts",
        "lib/cdp-client.ts",
        "deploy.ts",
        "server.ts",
      ].map((path, index) => ({
        path,
        bytes: index + 1,
        sha256: H64,
        headBytesMatch: true,
      })),
    },
    collector: {
      script: "scripts/collect-simulation-rigid-body-2d-browser-evidence.ts",
      command: [
        "/usr/bin/deno",
        "run",
        "-A",
        "scripts/collect-simulation-rigid-body-2d-browser-evidence.ts",
        `--source-commit=${ACCEPTED_COMMIT}`,
        "--chrome=/exact/chrome",
        "--output=/tmp/evidence/evidence.v1.json",
      ],
      output: "/tmp/evidence/evidence.v1.json",
      denoVersion: "2.9.0",
    },
    workload: {
      id: "simulation.rigid-body-2d.v1",
      registrationId: "simulation-rigid-body-2d-v1-controlled",
      route: "/benchmarks/simulation-rigid-body-2d-v1/",
      targets: ["javascript", "wasm-linear"],
      bodies: 500,
      joints: 19,
      timesteps: 1_800,
      checkpoints: 6,
      checkpointStateValues: 18_000,
      checkpointDigest: "b54a6129",
      metrics: { ...EXPECTED_METRICS },
      counters: {
        javascript: expectedCounters("javascript"),
        wasmLinear: expectedCounters("wasm-linear"),
      },
      angularWork: {
        rotatedManifoldTests: 36_036_054,
        angularContactImpulses: 431_986,
        jointImpulses: 2_394_000,
        torqueApplications: 60_000,
      },
      performanceClaim: false,
    },
    browser: {
      product: EXPECTED_CHROME_PRODUCT,
      revision: "revision",
      userAgent: "user agent",
      jsVersion: "15.0",
      executable: {
        path: process.executable,
        bytes: 281_758_968,
        sha256: EXPECTED_CHROME_SHA256,
        device: 1,
        inode: 2,
      },
      launchArguments,
      effectiveArguments: launchArguments,
      headless: true,
      protocol: "Chrome DevTools Protocol",
      browserSessionId: "browser-session",
      profile: {
        path: "/tmp/wasm-rigid-body-cft-test",
        device: 1,
        inode: 3,
        mode: 448,
        createdEmpty: true,
      },
      cgroup: {
        unit: "wasm-rigid-body-0123456789abcdef.service",
        controlGroup: "/user.slice/test.service",
        path: "/sys/fs/cgroup/user.slice/test.service",
        device: 1,
        inode: 4,
        invocationId: "0".repeat(32),
        mainPid: 100,
        memberSnapshots: [
          { at: "2026-08-03T12:00:00.000Z", pids: [100] },
          { at: "2026-08-03T12:00:01.000Z", pids: [100, 101] },
        ],
      },
      processes: [process],
    },
    server: { origin: "http://127.0.0.1:34567", mode: "public", launcher: process },
    scenarios: SCENARIOS.map((entry) => scenario(entry.id, entry.action, entry.target)),
    cleanup: {
      browserProcesses: checks(),
      cgroup: checks(),
      profile: checks(),
      server: checks(),
    },
  };
}

async function validator(): Promise<Validator> {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/simulation-rigid-body-2d-browser-evidence.schema.json"),
  );
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

function setPath(value: Record<string, unknown>, path: string, replacement: unknown) {
  const parts = path.split(".");
  let cursor = value;
  for (const part of parts.slice(0, -1)) cursor = cursor[part] as Record<string, unknown>;
  cursor[parts.at(-1)!] = replacement;
}

function expectThrows(fn: () => unknown, message: string) {
  let thrown = "";
  try {
    fn();
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error);
  }
  assert(
    thrown.includes(message),
    `expected ${JSON.stringify(message)}, got ${JSON.stringify(thrown)}`,
  );
}

Deno.test("rigid-body collector validation closes every value, metric, counter, and angular work field", () => {
  for (const target of ["javascript", "wasm-linear", "both"] as const) {
    const valid = visibleResult(target);
    const result = validateCompleteResult(target, valid);
    assertEquals(result.checkpointStateValues, 18_000);
    assertEquals(result.bodies, 500);
    assertEquals(result.joints, 19);
    assertEquals(result.timesteps, 1_800);
    assertEquals(result.checkpoints, 6);
    assertEquals(result.checkpointDigest, "b54a6129");
    for (const key of Object.keys(valid.metrics)) {
      const bad = structuredClone(valid);
      (bad.metrics as Record<string, number>)[key] += 1;
      expectThrows(
        () => validateCompleteResult(target, bad),
        "identity, digest, metrics, or counters",
      );
    }
    for (const key of Object.keys(valid.counters)) {
      const bad = structuredClone(valid);
      (bad.counters as Record<string, number>)[key] += 1;
      expectThrows(
        () => validateCompleteResult(target, bad),
        "identity, digest, metrics, or counters",
      );
    }
  }
  const extra = visibleResult("javascript") as Record<string, unknown>;
  extra.extra = true;
  expectThrows(() => validateCompleteResult("javascript", extra), "open or incomplete shape");
  const badAllValues = visibleResult("both");
  (badAllValues.checks.crossTarget as Record<string, unknown>).violations = 1;
  expectThrows(() => validateCompleteResult("both", badAllValues), "every checkpoint");
});

Deno.test("rigid-body browser evidence schema accepts the closed exemplar and rejects semantic drift", async () => {
  const validate = await validator();
  const accepted = evidence();
  assert(validate(accepted), JSON.stringify(validate.errors));
  const negatives: Array<[string, unknown]> = [
    ["source.acceptedCommit", H40],
    ["source.acceptedTree", H40],
    ["source.end.cleanStatus", "dirty"],
    ["source.unchanged", false],
    ["workload.bodies", 499],
    ["workload.joints", 18],
    ["workload.timesteps", 1_799],
    ["workload.checkpoints", 5],
    ["workload.checkpointStateValues", 17_999],
    ["workload.checkpointDigest", "deadbeef"],
    ["workload.metrics.totalEnergy", 0],
    ["workload.counters.javascript.angularContactImpulses", 0],
    ["workload.counters.wasmLinear.exportedCallBoundaries", 0],
    ["workload.angularWork.rotatedManifoldTests", 0],
    ["workload.angularWork.jointImpulses", 0],
    ["workload.performanceClaim", true],
    ["browser.product", "Chrome/150.0.7871.23"],
    ["browser.executable.sha256", H64],
    ["browser.profile.createdEmpty", false],
    ["browser.cgroup.invocationId", "not-owned"],
    ["cleanup.cgroup.outcome", "failure"],
    ["scenarios.0.result.checkpointStateValues", 17_999],
    ["scenarios.1.result.counters.angularContactImpulses", 0],
    ["scenarios.2.result.checks.crossTarget.violations", 1],
    ["scenarios.3.action", "complete"],
    ["scenarios.6.finalState.status", "timed out somehow"],
    ["scenarios.7.finalState.result", "retained result"],
    ["scenarios.8.target", "both"],
    ["scenarios.0.network.0.responseBody.status", "unavailable"],
    ["scenarios.0.console", [{ type: "error" }]],
    ["scenarios.0.exceptions", [{ text: "boom" }]],
    ["scenarios.0.accessibility.assertions.headingNamed", false],
    ["scenarios.0.screenshot.bytes", 0],
  ];
  for (const [path, replacement] of negatives) {
    const bad = structuredClone(accepted) as Record<string, unknown>;
    setPath(bad, path, replacement);
    assert(!validate(bad), `schema accepted semantic negative ${path}`);
  }
  const noAutomation = structuredClone(accepted);
  noAutomation.browser.launchArguments = noAutomation.browser.launchArguments.filter((argument) =>
    argument !== "--enable-automation"
  );
  assert(!validate(noAutomation), "schema accepted launch arguments without --enable-automation");
  const open = structuredClone(accepted) as Record<string, unknown>;
  open.extra = true;
  assert(!validate(open), "schema accepted an open top-level property");
});

Deno.test("accepted 375b7e6 source graph is byte-identical and the collector is parent-run and cleanup-protected", async () => {
  const tree = new Deno.Command("git", {
    args: ["rev-parse", `${ACCEPTED_COMMIT}^{tree}`],
    stdout: "piped",
  });
  assertEquals(new TextDecoder().decode((await tree.output()).stdout).trim(), ACCEPTED_TREE);
  for (const sourcePath of Object.values(EXPECTED_ASSETS)) {
    const committed = await new Deno.Command("git", {
      args: ["show", `${ACCEPTED_COMMIT}:${sourcePath}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(committed.success, `${sourcePath} missing from accepted commit`);
    const disk = await Deno.readFile(sourcePath);
    assertEquals(disk.byteLength, committed.stdout.byteLength);
    assertEquals(await sha256Hex(disk), await sha256Hex(committed.stdout));
  }
  const source = await Deno.readTextFile(
    "scripts/collect-simulation-rigid-body-2d-browser-evidence.ts",
  );
  for (
    const required of [
      ACCEPTED_COMMIT,
      ACCEPTED_TREE,
      EXPECTED_CHROME_PRODUCT,
      EXPECTED_CHROME_SHA256,
      '"--enable-automation"',
      '"--property=KillMode=control-group"',
      "`${cgroupPath}/cgroup.kill`",
      "Browser.close",
      "protected cleanup failed",
      "Network.getResponseBody",
      "Debugger.getScriptSource",
      "Runtime.consoleAPICalled",
      "Runtime.exceptionThrown",
      "Accessibility.getFullAXTree",
      "Page.captureScreenshot",
      "browserSessionId",
      "workerTargets",
      "accepted source changed by collection end",
      "collector support changed by collection end",
      "wrong-token completion mutated visible state",
      "stale prior-worker error mutated restarted generation",
      "real navigation pagehide terminated the active worker",
    ]
  ) assert(source.includes(required), `collector omitted ${required}`);
  assert(!source.includes("pkill"));
  assert(!source.includes("killall"));
  assert(!source.includes('new Deno.Command("google-chrome"'));
  assertEquals(SCENARIOS.length, 9);
  assertEquals(Object.keys(EXPECTED_ASSETS).length, 15);
  assert(
    canonicalize(expectedCounters("javascript")) !== canonicalize(expectedCounters("wasm-linear")),
  );
});

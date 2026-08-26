import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals, assertRejects } from "../assert.ts";
import {
  CFT_EXECUTABLE_SHA256,
  CFT_PRODUCT,
  COLLECTOR_SOURCE_PATHS,
  EXECUTED_ROUTE_PATHS,
  FIXED_CHROME_ARGUMENTS,
  parseTextOracle,
  SCENARIO_ROUTE_PATHS,
  SCENARIOS,
} from "../../scripts/collect-base-simulation-nbody-evidence.ts";
import { COUNTERS } from "../../benchmarks/base/simulation-nbody/contract.js";

const Ajv2020 = (Ajv2020Module as unknown as { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;
const addFormats = (addFormatsModule as unknown as { default?: typeof addFormatsModule }).default ??
  addFormatsModule;
const sha = "0".repeat(64), git = "0".repeat(40);

function resultText(variant: string) {
  const counters = {
    ...COUNTERS,
    allocations: variant === "js-controlled" ? 5 : 0,
    boundaryCrossings: variant === "js-controlled" ? 0 : 2,
  };
  return [
    `Target: ${variant}`,
    "Complete output digest: 00136c5b760c3794",
    "Quantized state digest: 5c5c1eca3fffb709",
    "Checkpoints: 1, 30, 60, 90, 120",
    "Energy relative drift: 0.0000011147386053059117 (limit 0.0000012)",
    `Counters:\n${JSON.stringify(counters, null, 2)}`,
  ].join("\n");
}

function scenario(id: string, target: string, action: string) {
  const complete = action === "complete";
  const text = complete ? resultText(target) : "No completed result.";
  const oracle = complete ? { ...parseTextOracle(text, target), textSha256: sha } : null;
  const kind = action === "complete"
    ? "none"
    : action === "cancel"
    ? "visible-cancel-control"
    : action === "timeout"
    ? "timeout-shortening"
    : "pagehide-dispatch";
  const shellRoutes = [
    "/benchmarks/simulation-nbody-cloth/",
    "/styles.css",
    "/demos/simulation-nbody-cloth/demo.js",
  ];
  const completeRoutes = [
    ...shellRoutes,
    "/demos/simulation-nbody-cloth/worker.js",
    "/benchmarks/base/simulation-nbody/contract.js",
    "/benchmarks/base/simulation-nbody/fixture.js",
    "/benchmarks/base/simulation-nbody/engine.js",
    ...(target === "wasm-linear-controlled" ? ["/artifacts/base-simulation-nbody/nbody.wasm"] : []),
  ];
  const assetRoutes = complete ? completeRoutes : shellRoutes;
  const injectionExpression = action === "timeout"
    ? "(() => { const native=globalThis.setTimeout; globalThis.setTimeout=(callback,delay,...args)=>native(callback,delay===30000?1:delay,...args); })()"
    : action === "pagehide"
    ? "dispatchEvent(new PageTransitionEvent('pagehide'))"
    : null;
  const status = complete
    ? "Complete. Correctness output only; no duration was collected."
    : action === "cancel"
    ? "Cancelled. The worker was terminated."
    : action === "timeout"
    ? "Stopped after the 30-second correctness timeout."
    : "Running 1,024 bodies for exactly 120 leapfrog timesteps in a fresh worker…";
  return {
    id,
    target,
    action,
    route: "/benchmarks/simulation-nbody-cloth/",
    cdpBoundBeforeNavigation: true,
    lifecycleInjection: { kind, expression: injectionExpression },
    finalState: {
      status,
      result: text,
      startDisabled: false,
      cancelDisabled: true,
    },
    oracle,
    console: [],
    exceptions: [],
    network: assetRoutes.map((route) => ({
      url: `http://127.0.0.1:1234${route}`,
      method: "GET",
      type: route === "/benchmarks/simulation-nbody-cloth/" ? "Document" : "Script",
      status: 200,
      mimeType: route.endsWith(".wasm") ? "application/wasm" : "text/javascript",
      fromDiskCache: false,
      fromServiceWorker: false,
      failed: false,
      errorText: null,
    })),
    executedAssets: assetRoutes.map((route) => ({
      route,
      sourcePath: EXECUTED_ROUTE_PATHS[route],
      bytes: 1,
      sha256: sha,
      cdpBodyEncoding: route.endsWith(".wasm") ? "base64" : "utf8",
    })).sort((a, b) => a.route.localeCompare(b.route)),
    accessibility: {
      inspectedAxNodes: 10,
      assertions: {
        languageEnglish: true,
        mainLandmark: true,
        namedHeading: true,
        labelledTarget: true,
        namedControls: true,
        liveStatus: true,
        keyboardResult: true,
      },
    },
    screenshot: { path: `evidence.screenshots/${id}.png`, bytes: 8, sha256: sha },
  };
}

function validEvidence() {
  return {
    schemaVersion: 1,
    evidenceId: "simulation-nbody-browser-correctness-v1",
    collectedAt: "2026-08-04T00:00:00.000Z",
    workloadId: "simulation.nbody-cloth.v1",
    performanceClaims: [],
    source: {
      commit: git,
      tree: git,
      acceptedStaticSourceCommit: git,
      files: COLLECTOR_SOURCE_PATHS.map((path) => ({ path, bytes: 1, sha256: sha })),
      cleanHeadVerifiedBeforeAndAfter: true,
    },
    collectionCommand:
      `deno run -A scripts/collect-base-simulation-nbody-evidence.ts --source-commit=${git} --chrome=/chrome --output=/evidence.json`,
    browser: {
      channel: "chrome-for-testing",
      product: CFT_PRODUCT,
      revision: "@revision",
      userAgent: "Chrome",
      jsVersion: "15.0",
      executable: {
        path: "/chrome",
        bytes: 1,
        sha256: CFT_EXECUTABLE_SHA256,
        dev: 1,
        ino: 1,
      },
      effectiveLaunchArguments: [
        ...FIXED_CHROME_ARGUMENTS,
        "--remote-debugging-port=9222",
        "--user-data-dir=/tmp/wasm-nbody-chrome-owned",
        "about:blank",
      ],
      headless: true,
      protocol: "Chrome DevTools Protocol",
      ownership: {
        launcher: {
          pid: 2,
          parentPid: 1,
          startTimeTicks: "1",
          cdpListener: {
            inode: "42",
            boundBeforeConnection: true,
            boundBeforeEveryNavigation: true,
          },
        },
        otherObservedProcesses: [],
        cgroup: {
          path:
            "/user.slice/user-1000.slice/user@1000.service/app.slice/wasm-nbody-browser-00000000-0000-4000-8000-000000000000.scope",
          dev: 1,
          ino: 2,
          membership: "all processes in the dedicated systemd scope",
        },
      },
    },
    server: {
      origin: "http://127.0.0.1:1234",
      mode: "public",
      launcher: { pid: 3, parentPid: 1, startTimeTicks: "1", executable: "/deno" },
      otherObservedProcesses: [],
      cgroup: {
        path:
          "/user.slice/user-1000.slice/user@1000.service/app.slice/wasm-nbody-server-00000000-0000-4000-8000-000000000000.scope",
        dev: 1,
        ino: 3,
        membership: "all processes in the dedicated systemd scope",
      },
    },
    contract: {
      targets: ["js-controlled", "wasm-linear-controlled"],
      timesteps: 120,
      checkpoints: [1, 30, 60, 90, 120],
      counterCount: 14,
      output: "text-only",
      excluded: {
        cloth: {
          status: "unavailable",
          reason: "The independently accepted implementation contract explicitly excludes cloth.",
        },
        rendering: {
          status: "unavailable",
          reason:
            "The route exposes a textual correctness oracle only; its acceptance screenshot is not benchmark rendering evidence.",
        },
      },
    },
    scenarios: [
      scenario("js-controlled-complete", "js-controlled", "complete"),
      scenario("wasm-linear-controlled-complete", "wasm-linear-controlled", "complete"),
      scenario("cancel-lifecycle", "js-controlled", "cancel"),
      scenario("timeout-lifecycle", "js-controlled", "timeout"),
      scenario("pagehide-lifecycle", "js-controlled", "pagehide"),
    ],
    cleanup: {
      browser: {
        requested: "Browser.close",
        signals: [],
        exit: { success: true, code: 0, signal: null },
        processesAbsent: true,
        cgroupAbsent: true,
      },
      profile: { removed: true, absent: true },
      server: {
        signal: "SIGTERM",
        exit: { success: false, code: 143, signal: "SIGTERM" },
        processAbsent: true,
        cgroupAbsent: true,
      },
    },
  };
}

Deno.test("N-body collector freezes accepted targets, full work, textual oracle and lifecycle journeys", async () => {
  assertEquals(SCENARIOS, [
    { id: "js-controlled-complete", target: "js-controlled", action: "complete" },
    { id: "wasm-linear-controlled-complete", target: "wasm-linear-controlled", action: "complete" },
    { id: "cancel-lifecycle", target: "js-controlled", action: "cancel" },
    { id: "timeout-lifecycle", target: "js-controlled", action: "timeout" },
    { id: "pagehide-lifecycle", target: "js-controlled", action: "pagehide" },
  ]);
  assertEquals(SCENARIO_ROUTE_PATHS["js-controlled-complete"].length, 7);
  assertEquals(SCENARIO_ROUTE_PATHS["wasm-linear-controlled-complete"].length, 8);
  assertEquals(SCENARIO_ROUTE_PATHS["cancel-lifecycle"].length, 3);
  const js = parseTextOracle(resultText("js-controlled"), "js-controlled");
  const wasm = parseTextOracle(resultText("wasm-linear-controlled"), "wasm-linear-controlled");
  assertEquals(js.checkpoints, [1, 30, 60, 90, 120]);
  assertEquals(js.counterCount, 14);
  assertEquals(js.counters.timesteps, 120);
  assertEquals(js.counters.allocations, 5);
  assertEquals(wasm.counters.boundaryCrossings, 2);
  assertEquals(js.rendering, "text-only");
  await assertRejects(
    () =>
      Promise.resolve(
        parseTextOracle(resultText("js-controlled").replace("120,\n", "10000,\n"), "js-controlled"),
      ),
    "14-counter",
  );
  await assertRejects(
    () => Promise.resolve(parseTextOracle(resultText("js-controlled"), "wasm-linear-controlled")),
    "exact oracle",
  );
});

Deno.test("N-body browser evidence schema is closed over source, raw responses, Chrome and cleanup", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/base-simulation-nbody-browser-evidence.schema.json"),
  );
  const ajv = new (Ajv2020 as unknown as new (options: Record<string, unknown>) => {
    compile: (schema: unknown) => ((value: unknown) => boolean) & { errors?: unknown };
  })({ allErrors: true, strict: true });
  (addFormats as unknown as (instance: unknown) => void)(ajv);
  const validate = ajv.compile(schema);
  const evidence = validEvidence();
  assert(validate(evidence), JSON.stringify(validate.errors));

  const rejected = (mutate: (candidate: ReturnType<typeof validEvidence>) => void) => {
    const candidate = structuredClone(evidence);
    mutate(candidate);
    assert(
      !validate(candidate),
      `semantic mutation unexpectedly passed: ${JSON.stringify(candidate)}`,
    );
  };
  rejected((value) => value.contract.timesteps = 10_000);
  rejected((value) => value.contract.output = "canvas" as "text-only");
  rejected((value) => value.contract.excluded.cloth.status = "supported" as "unavailable");
  rejected((value) => value.scenarios[0].oracle!.counterCount = 13);
  rejected((value) => value.scenarios[0].oracle!.variantId = "wasm-linear-controlled");
  rejected((value) => value.scenarios[0].oracle!.counters.pairInteractions = 1);
  rejected((value) => value.scenarios[1].target = "js-controlled");
  rejected((value) => value.scenarios.pop());
  rejected((value) => value.cleanup.browser.processesAbsent = false);
  rejected((value) => value.cleanup.browser.cgroupAbsent = false);
  rejected((value) =>
    value.browser.ownership.cgroup.path =
      "/user.slice/user-1000.slice/user@1000.service/app.slice/wasm-nbody-server-00000000-0000-4000-8000-000000000000.scope"
  );
  rejected((value) =>
    value.server.cgroup.path =
      "/user.slice/user-1000.slice/user@1000.service/app.slice/wasm-nbody-browser-00000000-0000-4000-8000-000000000000.scope"
  );
  rejected((value) => value.server.cgroup.membership = "descendants only");
  rejected((value) => value.source.cleanHeadVerifiedBeforeAndAfter = false);
  rejected((value) =>
    value.source.files[0].path = "uncommitted.js" as typeof value.source.files[0]["path"]
  );
  rejected((value) => value.source.files[1].path = value.source.files[0].path);
  rejected((value) => value.browser.product = "Chrome/1.2.3.4");
  rejected((value) => value.browser.executable.sha256 = sha);
  rejected((value) => value.browser.effectiveLaunchArguments[10] = "--disable-automation");
  rejected((value) => value.browser.effectiveLaunchArguments.push("--js-flags=--jitless"));
  rejected((value) => value.browser.ownership.launcher.pid = 0);
  rejected((value) => value.browser.ownership.launcher.cdpListener.inode = "not-an-inode");
  rejected((value) =>
    value.browser.ownership.launcher.cdpListener.boundBeforeEveryNavigation = false
  );
  rejected((value) =>
    value.browser.effectiveLaunchArguments[15] = "--user-data-dir=/var/tmp/foreign"
  );
  rejected((value) => value.server.launcher.pid = 0);
  rejected((value) => value.scenarios[2].finalState.status = "terminated");
  rejected((value) => value.scenarios[3].lifecycleInjection.expression = "setTimeout = fake");
  rejected((value) => value.scenarios[4].finalState.result = "partial result");
  rejected((value) => value.scenarios[0].cdpBoundBeforeNavigation = false);
  rejected((value) => value.scenarios[0].finalState.result = resultText("wasm-linear-controlled"));
  rejected((value) => value.scenarios[0].network[0].url = "http://127.0.0.1:1234/arbitrary.js");
  rejected((value) =>
    value.scenarios[0].network = value.scenarios[0].network.map(() =>
      structuredClone(value.scenarios[0].network[0])
    )
  );
  rejected((value) => {
    value.scenarios[0].network[6].url =
      "http://127.0.0.1:1234/artifacts/base-simulation-nbody/nbody.wasm";
    value.scenarios[0].executedAssets[6] = structuredClone(value.scenarios[1].executedAssets[0]);
    value.scenarios[0].executedAssets[6].route = "/artifacts/base-simulation-nbody/nbody.wasm";
    value.scenarios[0].executedAssets[6].sourcePath =
      "public/artifacts/base-simulation-nbody/nbody.wasm";
    value.scenarios[0].executedAssets[6].cdpBodyEncoding = "base64";
  });
  rejected((value) => value.scenarios[0].executedAssets.pop());
  rejected((value) =>
    value.scenarios[0].executedAssets[0].sourcePath = "public/demos/simulation-nbody-cloth/demo.js"
  );
  rejected((value) => (value as Record<string, unknown>).invented = true);
});

Deno.test("N-body collector binds every served executable body and contains no retained evidence", async () => {
  assertEquals(Object.keys(EXECUTED_ROUTE_PATHS).sort(), [
    "/artifacts/base-simulation-nbody/nbody.wasm",
    "/benchmarks/base/simulation-nbody/contract.js",
    "/benchmarks/base/simulation-nbody/engine.js",
    "/benchmarks/base/simulation-nbody/fixture.js",
    "/benchmarks/simulation-nbody-cloth/",
    "/demos/simulation-nbody-cloth/demo.js",
    "/demos/simulation-nbody-cloth/worker.js",
    "/styles.css",
  ]);
  const source = await Deno.readTextFile("scripts/collect-base-simulation-nbody-evidence.ts");
  for (
    const token of [
      "Network.getResponseBody",
      "served response bytes differ from frozen commit",
      "Browser.getBrowserCommandLine",
      "Page.captureScreenshot",
      "Accessibility.getFullAXTree",
      "Browser.close",
      "cgroupProcesses",
      "listenerOwnership",
      "Chrome effective argv differs from the exact approved launch arguments",
      "network/execution roster was not the exact unique scenario roster",
      "collector failure cleanup was not exact",
      "KillMode=control-group",
      "output already exists; browser evidence is immutable",
    ]
  ) assert(source.includes(token), `collector omitted ${token}`);
  assert(source.includes("performanceClaims: []"));
  const failureCleanup = source.slice(source.indexOf("const cleanupFailures: string[]"));
  assert(!failureCleanup.includes(".catch(() => {})"));
  assert(!source.includes("10_000 leapfrog"));
  assert(!source.includes("canvas"));
});

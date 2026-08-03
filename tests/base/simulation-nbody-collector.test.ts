import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals, assertRejects } from "../assert.ts";
import {
  COLLECTOR_SOURCE_PATHS,
  EXECUTED_ROUTE_PATHS,
  parseTextOracle,
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
  return {
    id,
    target,
    action,
    route: "/demos/simulation-nbody-cloth/",
    lifecycleInjection: {
      kind,
      expression: kind === "none" || kind === "visible-cancel-control" ? null : "injection",
    },
    finalState: {
      status: complete
        ? "Complete. Correctness output only; no duration was collected."
        : "terminated",
      result: text,
      startDisabled: false,
      cancelDisabled: true,
    },
    oracle,
    console: [],
    exceptions: [],
    network: Array.from({ length: 3 }, (_, index) => ({
      url: `http://127.0.0.1:1234/asset-${index}`,
      method: "GET",
      type: "Script",
      status: 200,
      mimeType: "text/javascript",
      fromDiskCache: false,
      fromServiceWorker: false,
      failed: false,
      errorText: null,
    })),
    executedAssets: Object.entries(EXECUTED_ROUTE_PATHS).slice(0, 3).map(([route, sourcePath]) => ({
      route,
      sourcePath,
      bytes: 1,
      sha256: sha,
      cdpBodyEncoding: "utf8",
    })),
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
    },
    collectionCommand:
      `deno run -A scripts/collect-base-simulation-nbody-evidence.ts --source-commit=${git} --chrome=/chrome --output=/evidence.json`,
    browser: {
      product: "Chrome/150.0.7871.24",
      revision: "@revision",
      userAgent: "Chrome",
      jsVersion: "15.0",
      executable: { path: "/chrome", bytes: 1, sha256: sha, dev: 1, ino: 1 },
      requestedLaunchArguments: Array.from({ length: 17 }, (_, index) => `--arg-${index}`),
      effectiveCommandLine: Array.from({ length: 17 }, (_, index) => `--arg-${index}`),
      headless: true,
      protocol: "Chrome DevTools Protocol",
    },
    server: { origin: "http://127.0.0.1:1234", mode: "public", launcherPid: 1 },
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
        launcher: { pid: 2, parentPid: 1, startTimeTicks: "1", executable: "/chrome" },
        observedProcesses: [
          { pid: 2, parentPid: 1, startTimeTicks: "1", executable: "/chrome" },
        ],
        requested: "Browser.close",
        signals: [],
        exit: { success: true, code: 0, signal: null },
        processesAbsent: true,
      },
      profile: { path: "/tmp/wasm-nbody-chrome-owned", removed: true, absent: true },
      server: {
        launcher: { pid: 3, parentPid: 1, startTimeTicks: "1", executable: "/deno" },
        signal: "SIGTERM",
        exit: { success: false, code: 143, signal: "SIGTERM" },
        processAbsent: true,
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
  rejected((value) =>
    value.source.files[0].path = "uncommitted.js" as typeof value.source.files[0]["path"]
  );
  rejected((value) => (value as Record<string, unknown>).invented = true);
});

Deno.test("N-body collector binds every served executable body and contains no retained evidence", async () => {
  assertEquals(Object.keys(EXECUTED_ROUTE_PATHS).sort(), [
    "/artifacts/base-simulation-nbody/nbody.wasm",
    "/benchmarks/base/simulation-nbody/contract.js",
    "/benchmarks/base/simulation-nbody/engine.js",
    "/benchmarks/base/simulation-nbody/fixture.js",
    "/demos/simulation-nbody-cloth/",
    "/demos/simulation-nbody-cloth/demo.js",
    "/demos/simulation-nbody-cloth/worker.js",
    "/styles.css",
  ]);
  const source = await Deno.readTextFile("scripts/collect-base-simulation-nbody-evidence.ts");
  for (
    const token of [
      "Network.getResponseBody",
      "served response bytes differ from clean HEAD",
      "Browser.getBrowserCommandLine",
      "Page.captureScreenshot",
      "Accessibility.getFullAXTree",
      "Browser.close",
      "identityStillRunning",
      "output already exists; browser evidence is immutable",
    ]
  ) assert(source.includes(token), `collector omitted ${token}`);
  assert(source.includes("performanceClaims: []"));
  assert(!source.includes("10_000 leapfrog"));
  assert(!source.includes("canvas"));
});

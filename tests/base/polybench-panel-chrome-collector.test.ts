import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { assert, assertEquals } from "../assert.ts";
import {
  KERNELS,
  lifecycleExpression,
  lifecycleInitScript,
  SCENARIO_IDS,
  TARGETS,
  verifyExecutionResults,
  verifyLifecycle,
} from "../../scripts/collect-polybench-panel-chrome-evidence.ts";

type Json = Record<string, unknown>;
type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;
const parse = async (path: string) => JSON.parse(await Deno.readTextFile(path));
const clone = <T>(value: T): T => structuredClone(value);
const sha = "a".repeat(64);
const git = "b".repeat(40);

function browserResults(manifest: Json, target: string): Json[] {
  const outputs = manifest.outputs as Json;
  return KERNELS.map((kernel) => {
    const record = ((outputs[kernel] as Json).targets as Json)[target] as Json;
    return {
      kernel,
      target,
      outputSha256: (record.artifact as Json).sha256,
      comparison: record.comparison,
      structuralOracle: record.structuralOracle,
      checkpoints: record.checkpoints,
      counters: record.counters,
    };
  });
}

function state(workerCount = 1): Json {
  return {
    status: "Cancelled. The worker was terminated.",
    output: "No result yet.",
    startDisabled: false,
    cancelDisabled: true,
    progressValue: null,
    workers: Array.from({ length: workerCount }, () => ({
      terminated: true,
      posted: { token: 1, target: "javascript", kernel: "all" },
    })),
  };
}

const sourcePaths = [
  "public/demos/numeric.polybench-panel.v1/index.html",
  "public/polybench-panel-demo.js",
  "public/polybench-panel-worker.js",
  "benchmarks/base/numeric-polybench-panel/workload.js",
  "public/artifacts/numeric-polybench-panel/polybench-panel.wasm",
  "public/artifacts/numeric-polybench-panel/build-manifest.json",
  "public/artifacts/numeric-polybench-panel/outputs/gemm.reference.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/gemm.javascript-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/gemm.linear-wasm-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/cholesky.reference.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/cholesky.javascript-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/cholesky.linear-wasm-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/stencil.reference.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/stencil.javascript-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/stencil.linear-wasm-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/jacobi2d.reference.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/jacobi2d.javascript-controlled.f64le",
  "public/artifacts/numeric-polybench-panel/outputs/jacobi2d.linear-wasm-controlled.f64le",
  "evidence/base/numeric-polybench-panel/correctness-record.json",
  "scripts/collect-polybench-panel-chrome-evidence.ts",
  "schemas/polybench-panel-chrome-evidence.schema.json",
  "tests/base/polybench-panel-chrome-collector.test.ts",
];

function artifact(kind: "accessibility" | "screenshots", id: string): Json {
  return {
    path: `evidence/base/numeric-polybench-panel/chrome-acceptance/${kind}/${id}.${
      kind === "accessibility" ? "json" : "png"
    }`,
    bytes: 100,
    sha256: sha,
  };
}

const axRequired = [
  { role: "button", name: "Start", found: true },
  { role: "button", name: "Cancel", found: true },
  { role: "combobox", name: "Controlled target", found: true },
  { role: "combobox", name: "Kernel", found: true },
  { role: "progressbar", name: "Completed kernels", found: true },
  { role: "status", name: "", found: true },
];

function scenarioBase(id: string): Json {
  return {
    id,
    kind: "lifecycle",
    route: "/demos/numeric.polybench-panel.v1/",
    target: null,
    finalState: {
      status: "Cancelled. The worker was terminated.",
      output: "No result yet.",
      startDisabled: false,
      cancelDisabled: true,
      progressValue: 0,
      progressMax: 4,
    },
    rawResultText: null,
    rawResultTextSha256: null,
    results: null,
    lifecycle: { assertion: id, final: state() },
    console: [],
    exceptions: [],
    network: [0, 1].map(() => ({
      url: "http://127.0.0.1:8123/polybench-panel-demo.js",
      method: "GET",
      type: "Script",
      status: 200,
      mimeType: "text/javascript",
      fromDiskCache: false,
      fromServiceWorker: false,
      failed: false,
      errorText: null,
      encodedDataLength: 100,
    })),
    accessibility: {
      fullTree: artifact("accessibility", id),
      nodeCount: 20,
      required: axRequired,
      violations: [],
    },
    screenshot: artifact("screenshots", id),
  };
}

function syntheticEvidence(manifest: Json): Json {
  const scenarios = SCENARIO_IDS.map((id) => scenarioBase(id));
  for (const [index, target] of TARGETS.entries()) {
    const raw = JSON.stringify(browserResults(manifest, target));
    Object.assign(scenarios[index], {
      kind: "execution",
      target,
      rawResultText: raw,
      rawResultTextSha256: sha,
      results: verifyExecutionResults(JSON.parse(raw), target, manifest),
      lifecycle: null,
    });
  }
  (scenarios[2].lifecycle as Json).ignored = state();
  (scenarios[3].lifecycle as Json).ignored = state();
  (scenarios[4].lifecycle as Json).restarted = state(2);
  return {
    schemaVersion: 1,
    evidenceId: "numeric-polybench-panel-chrome-150-acceptance-v1",
    collectedAt: "2026-04-01T12:00:00.000Z",
    source: {
      commit: git,
      head: git,
      tree: git,
      cleanAtStart: true,
      statusPorcelain: "",
      files: sourcePaths.map((path) => ({ path, bytes: 100, sha256: sha })),
      buildManifest: {
        sha256: sha,
        implementationCommit: git,
        sourceTreeSha256: sha,
      },
    },
    collectionCommand:
      `deno run -A scripts/collect-polybench-panel-chrome-evidence.ts --source-commit=${git} --chrome=/opt/chrome`,
    browser: {
      product: "Chrome/150.0.7871.24",
      revision: "rev",
      userAgent: "Chrome",
      jsVersion: "15.0",
      protocolVersion: "1.3",
      executable: { requestedPath: "/opt/chrome", realPath: "/opt/chrome", bytes: 1, sha256: sha },
      launchArguments: [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        "--hide-scrollbars",
        "--window-size=1440,1200",
        "--force-device-scale-factor=1",
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=9222",
        "--user-data-dir=/tmp/wasm-polybench-panel-chrome-profile",
        "about:blank",
      ],
      headless: true,
      protocol: "Chrome DevTools Protocol",
      host: { operatingSystem: "Linux host", denoOs: "linux", denoArch: "x86_64" },
    },
    server: { origin: "http://127.0.0.1:8123", mode: "public", launcherPid: 10 },
    scenarios,
    cleanup: {
      browser: {
        launcher: { pid: 20, parentPid: 1, startTimeTicks: "100", executable: "/opt/chrome" },
        observedProcesses: [
          { pid: 20, parentPid: 1, startTimeTicks: "100", executable: "/opt/chrome" },
        ],
        requested: "Browser.close",
        signals: [],
        exit: { success: true, code: 0, signal: null },
        processesAbsent: true,
      },
      profile: {
        path: "/tmp/wasm-polybench-panel-chrome-profile",
        removed: true,
        absent: true,
      },
      server: {
        launcher: { pid: 10, parentPid: 1, startTimeTicks: "90", executable: "/deno" },
        signal: "SIGTERM",
        exit: { success: false, code: 143, signal: "SIGTERM" },
        processAbsent: true,
      },
    },
  };
}

Deno.test("PolyBench Chrome collector accepts only all four exact manifest-bound JS/Wasm results", async () => {
  const manifest = await parse("public/artifacts/numeric-polybench-panel/build-manifest.json");
  for (const target of TARGETS) {
    const raw = browserResults(manifest, target);
    const verified = verifyExecutionResults(raw, target, manifest);
    assertEquals(verified.map((result) => result.kernel), [...KERNELS]);
    assertEquals(
      verified.map((result) => (result.completeOutputArtifact as Json).format),
      Array(4).fill("f64le-complete-output"),
    );
    for (
      const mutation of [
        (value: Json[]) => value.pop(),
        (value: Json[]) => value[0].outputSha256 = "0".repeat(64),
        (value: Json[]) => (value[1].checkpoints as Json[])[0].valueHex = "0".repeat(16),
        (value: Json[]) => (value[2].structuralOracle as Json).passed = false,
        (value: Json[]) => (value[3].counters as Json).sampleReads = 1,
        (value: Json[]) => value[0].unexpected = true,
      ]
    ) {
      const changed = clone(raw);
      mutation(changed);
      let rejected = false;
      try {
        verifyExecutionResults(changed, target, manifest);
      } catch {
        rejected = true;
      }
      assert(rejected);
    }
  }
});

Deno.test("closed PolyBench Chrome evidence schema freezes provenance, scenarios, outputs, diagnostics, and cleanup", async () => {
  const schema = await parse("schemas/polybench-panel-chrome-evidence.schema.json");
  const manifest = await parse("public/artifacts/numeric-polybench-panel/build-manifest.json");
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const evidence = syntheticEvidence(manifest);
  assert(validate(evidence), JSON.stringify(validate.errors));
  let mutationIndex = 0;
  for (
    const mutation of [
      (value: Json) => value.unexpected = true,
      (value: Json) => (value.source as Json).cleanAtStart = false,
      (value: Json) => ((value.source as Json).files as Json[]).pop(),
      (value: Json) => (value.browser as Json).product = "Chrome/149.0.0.0",
      (value: Json) => ((value.browser as Json).executable as Json).sha256 = "z".repeat(64),
      (value: Json) => ((value.scenarios as Json[])[0].results as Json[]).pop(),
      (value: Json) => ((value.scenarios as Json[])[0].results as Json[])[0].kernel = "bogus",
      (value: Json) => ((value.scenarios as Json[])[0].network as Json[])[0].status = 404,
      (value: Json) => ((value.scenarios as Json[])[0].accessibility as Json).violations = ["x"],
      (value: Json) => ((value.scenarios as Json[])[5].lifecycle as Json).extra = true,
      (value: Json) => ((value.cleanup as Json).browser as Json).processesAbsent = false,
    ]
  ) {
    const changed = clone(evidence);
    mutation(changed);
    assert(!validate(changed), `mutation ${mutationIndex} was accepted`);
    mutationIndex += 1;
  }
});

Deno.test("collector lifecycle probes cover wrong-token, stale, restart, cancel, timeout, and pagehide fail-closed behavior", () => {
  const init = lifecycleInitScript();
  assert(init.includes("globalThis.Worker = AcceptanceWorker"));
  assert(init.includes("delay === 30000 ? 80"));
  for (const id of SCENARIO_IDS.filter((value) => value.startsWith("lifecycle-"))) {
    assert(lifecycleExpression(id).includes("assertion"), id);
  }
  verifyLifecycle("lifecycle-cancel", {
    assertion: "cancel",
    final: state(),
  });
  verifyLifecycle("lifecycle-timeout", {
    assertion: "timeout",
    final: { ...state(), status: "Stopped after the 30-second bound." },
  });
  verifyLifecycle("lifecycle-pagehide", {
    assertion: "pagehide",
    final: { ...state(), status: "Running exact registered work…" },
  });
  const running = {
    ...state(),
    status: "Running exact registered work…",
    output: "No result yet.",
  };
  verifyLifecycle("lifecycle-wrong-token", {
    assertion: "wrong token",
    ignored: running,
    final: state(),
  });
  verifyLifecycle("lifecycle-stale-message", {
    assertion: "stale",
    ignored: running,
    final: {
      ...state(2),
      status: "Complete. Every reported element passed the registered oracle.",
    },
  });
  verifyLifecycle("lifecycle-restart", {
    assertion: "restart",
    restarted: {
      ...state(2),
      workers: [
        { terminated: true, posted: { token: 1, target: "javascript", kernel: "all" } },
        { terminated: false, posted: { token: 3, target: "javascript", kernel: "all" } },
      ],
    },
    final: state(2),
  });
});

Deno.test("collector source binds clean HEAD, raw execution files, Chrome hash, diagnostics, and identity-owned cleanup", async () => {
  const source = await Deno.readTextFile(
    "scripts/collect-polybench-panel-chrome-evidence.ts",
  );
  for (
    const required of [
      '["status", "--porcelain=v1", "--untracked-files=all"]',
      "if (head !== sourceCommit)",
      'commandText("sha256sum", [executablePath])',
      '"Accessibility.getFullAXTree"',
      '"Page.captureScreenshot"',
      '"Runtime.consoleAPICalled"',
      '"Network.requestWillBeSent"',
      "w.posted.token+1",
      'Deno.kill(identity.pid, "SIGKILL")',
      "await Deno.remove(profilePath, { recursive: true })",
    ]
  ) assert(source.includes(required), required);
  assert(!source.includes("Deno.kill(-1"));
  assert(!source.includes("pkill"));
  assert(!source.includes("killall"));
});

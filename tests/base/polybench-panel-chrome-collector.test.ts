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

function worker(terminated: boolean, token = 1): Json {
  return {
    terminated,
    posted: { token, target: "javascript", kernel: "all" },
  };
}

function state(options: {
  status?: string;
  output?: string;
  progressValue?: string | null;
  workers?: Json[];
  startDisabled?: boolean;
  cancelDisabled?: boolean;
} = {}): Json {
  const status = options.status ?? "Cancelled. The worker was terminated.";
  return {
    status,
    output: options.output ?? "No result yet.",
    startDisabled: options.startDisabled ?? status === "Running exact registered work…",
    cancelDisabled: options.cancelDisabled ?? status !== "Running exact registered work…",
    progressValue: options.progressValue ?? null,
    workers: options.workers ?? [worker(true)],
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
  let finalStatus = "Cancelled. The worker was terminated.";
  let finalOutput = "No result yet.";
  let lifecycle: Json | null = null;
  if (id === "lifecycle-wrong-token") {
    lifecycle = {
      assertion: "wrong token ignored",
      ignored: state({
        status: "Running exact registered work…",
        progressValue: "0",
        workers: [worker(false)],
      }),
      final: state(),
    };
  } else if (id === "lifecycle-stale-message") {
    finalStatus = "Complete. Every reported element passed the registered oracle.";
    finalOutput = "[]";
    lifecycle = {
      assertion: "stale worker message ignored",
      ignored: state({
        status: "Running exact registered work…",
        progressValue: "0",
        workers: [worker(true), worker(false, 3)],
      }),
      final: state({
        status: finalStatus,
        output: finalOutput,
        workers: [worker(true), worker(true, 3)],
      }),
    };
  } else if (id === "lifecycle-restart") {
    lifecycle = {
      assertion: "restart terminates prior worker",
      restarted: state({
        status: "Running exact registered work…",
        progressValue: "0",
        workers: [worker(true), worker(false, 3)],
      }),
      final: state({ workers: [worker(true), worker(true, 3)] }),
    };
  } else if (id === "lifecycle-cancel") {
    lifecycle = { assertion: "cancel terminates active worker", final: state() };
  } else if (id === "lifecycle-timeout") {
    finalStatus = "Stopped after the 30-second bound.";
    lifecycle = {
      assertion: "30-second bound fired under accelerated acceptance clock",
      final: state({ status: finalStatus }),
    };
  } else if (id === "lifecycle-pagehide") {
    finalStatus = "Running exact registered work…";
    lifecycle = {
      assertion: "pagehide terminates active worker",
      final: state({
        status: finalStatus,
        startDisabled: false,
        cancelDisabled: true,
        workers: [worker(true)],
      }),
    };
  }
  return {
    id,
    kind: "lifecycle",
    route: "/demos/numeric.polybench-panel.v1/",
    target: null,
    finalState: {
      status: finalStatus,
      output: finalOutput,
      startDisabled: false,
      cancelDisabled: true,
      progressValue: 0,
      progressMax: 4,
    },
    rawResultText: null,
    rawResultTextSha256: null,
    results: null,
    lifecycle,
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
      finalState: {
        status: "Complete. Every reported element passed the registered oracle.",
        output: raw,
        startDisabled: false,
        cancelDisabled: true,
        progressValue: 0,
        progressMax: 4,
      },
      rawResultText: raw,
      rawResultTextSha256: sha,
      results: verifyExecutionResults(JSON.parse(raw), target, manifest),
      lifecycle: null,
    });
  }
  return {
    schemaVersion: 1,
    evidenceId: "numeric-polybench-panel-chrome-150-acceptance-v1",
    collectedAt: "2026-04-01T12:00:00.000Z",
    source: {
      commit: git,
      tree: git,
      cleanAtStart: true,
      statusPorcelain: "",
      cleanAtEnd: true,
      statusPorcelainAtEnd: "",
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
        "--enable-automation",
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
        launcher: {
          pid: 20,
          parentPid: 1,
          startTimeTicks: "100",
          executable: "/opt/chrome",
          cgroup: "0::/user.slice/polybench",
        },
        observedProcesses: [{
          pid: 20,
          parentPid: 1,
          startTimeTicks: "100",
          executable: "/opt/chrome",
          cgroup: "0::/user.slice/polybench",
        }],
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
        launcher: {
          pid: 10,
          parentPid: 1,
          startTimeTicks: "90",
          executable: "/deno",
          cgroup: "0::/user.slice/polybench",
        },
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
  for (const [scenarioIndex, target] of TARGETS.entries()) {
    for (const [resultIndex, kernel] of KERNELS.entries()) {
      const rejected = (mutate: (result: Json) => void, label: string) => {
        const changed = clone(evidence);
        const result =
          ((changed.scenarios as Json[])[scenarioIndex].results as Json[])[resultIndex];
        mutate(result);
        assert(!validate(changed), `${target}/${kernel} ${label} contradiction was accepted`);
      };
      const otherTarget = target === "javascript-controlled"
        ? "linear-wasm-controlled"
        : "javascript-controlled";
      rejected((result) => result.target = otherTarget, "target");
      rejected((result) => result.outputSha256 = "b".repeat(64), "output hash");
      rejected((result) => {
        const output = result.completeOutputArtifact as Json;
        output.file =
          `public/artifacts/numeric-polybench-panel/outputs/${kernel}.${otherTarget}.f64le`;
      }, "artifact file");
      rejected((result) => {
        const output = result.completeOutputArtifact as Json;
        output.route = `/artifacts/numeric-polybench-panel/outputs/${kernel}.${otherTarget}.f64le`;
      }, "artifact route");
      rejected((result) => {
        const output = result.completeOutputArtifact as Json;
        output.bytes = output.bytes === 4000 ? 7200 : 4000;
      }, "artifact bytes");
      rejected((result) => {
        const output = result.completeOutputArtifact as Json;
        output.elements = output.elements === 500 ? 900 : 500;
      }, "artifact elements");
      rejected(
        (result) => (result.completeOutputArtifact as Json).sha256 = "b".repeat(64),
        "artifact hash",
      );
      rejected(
        (result) => (result.checkpoints as Json[])[0].valueHex = "0".repeat(16),
        "checkpoint",
      );
      rejected((result) => (result.counters as Json).target = otherTarget, "counter target");
    }
  }
  let mutationIndex = 0;
  for (
    const mutation of [
      (value: Json) => value.unexpected = true,
      (value: Json) => (value.source as Json).cleanAtStart = false,
      (value: Json) => (value.source as Json).cleanAtEnd = false,
      (value: Json) => ((value.source as Json).files as Json[]).pop(),
      (value: Json) => {
        const files = (value.source as Json).files as Json[];
        files[1] = clone(files[0]);
      },
      (value: Json) => (value.browser as Json).product = "Chrome/149.0.0.0",
      (value: Json) => ((value.browser as Json).executable as Json).sha256 = "z".repeat(64),
      (value: Json) => ((value.browser as Json).launchArguments as string[])[1] = "--no-sandbox",
      (value: Json) => ((value.scenarios as Json[])[0].results as Json[]).pop(),
      (value: Json) =>
        ((value.scenarios as Json[])[0].results as Json[])[0].target = "linear-wasm-controlled",
      (value: Json) =>
        ((value.scenarios as Json[])[0].results as Json[])[0].outputSha256 = "b".repeat(64),
      (value: Json) =>
        (((value.scenarios as Json[])[0].results as Json[])[0].completeOutputArtifact as Json)
          .file =
            "public/artifacts/numeric-polybench-panel/outputs/cholesky.javascript-controlled.f64le",
      (value: Json) =>
        (((value.scenarios as Json[])[0].results as Json[])[0].completeOutputArtifact as Json)
          .route = "/artifacts/numeric-polybench-panel/outputs/stencil.javascript-controlled.f64le",
      (value: Json) =>
        (((value.scenarios as Json[])[0].results as Json[])[0].completeOutputArtifact as Json)
          .bytes = 7200,
      (value: Json) =>
        (((value.scenarios as Json[])[0].results as Json[])[0].completeOutputArtifact as Json)
          .elements = 900,
      (value: Json) =>
        (((value.scenarios as Json[])[0].results as Json[])[0].completeOutputArtifact as Json)
          .sha256 = "b".repeat(64),
      (value: Json) =>
        (((value.scenarios as Json[])[0].results as Json[])[0].checkpoints as Json[])[0]
          .valueHex = "0".repeat(16),
      (value: Json) =>
        (((value.scenarios as Json[])[0].results as Json[])[0].counters as Json)
          .boundaryCrossings = 1,
      (value: Json) =>
        (((value.scenarios as Json[])[1].results as Json[])[2].counters as Json).target =
          "javascript-controlled",
      (value: Json) => ((value.scenarios as Json[])[0].network as Json[])[0].status = 404,
      (value: Json) => ((value.scenarios as Json[])[0].accessibility as Json).violations = ["x"],
      (value: Json) =>
        (((value.scenarios as Json[])[2].accessibility as Json).fullTree as Json).path =
          "evidence/base/numeric-polybench-panel/chrome-acceptance/accessibility/lifecycle-cancel.json",
      (value: Json) =>
        ((value.scenarios as Json[])[2].screenshot as Json).path =
          "evidence/base/numeric-polybench-panel/chrome-acceptance/screenshots/lifecycle-cancel.png",
      (value: Json) => ((value.scenarios as Json[])[2].lifecycle as Json).assertion = "wrong",
      (value: Json) =>
        ((((value.scenarios as Json[])[2].lifecycle as Json).ignored as Json).workers as Json[])[0]
          .terminated = true,
      (value: Json) =>
        (((value.scenarios as Json[])[3].lifecycle as Json).ignored as Json).status =
          "Cancelled. The worker was terminated.",
      (value: Json) => ((value.scenarios as Json[])[5].lifecycle as Json).extra = true,
      (value: Json) => ((value.scenarios as Json[])[6].finalState as Json).output = "contradiction",
      (value: Json) =>
        (((value.scenarios as Json[])[7].lifecycle as Json).final as Json).startDisabled = true,
      (value: Json) => ((value.cleanup as Json).browser as Json).processesAbsent = false,
      (value: Json) => (((value.cleanup as Json).browser as Json).launcher as Json).cgroup = "",
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
    final: state({ status: "Stopped after the 30-second bound." }),
  });
  verifyLifecycle("lifecycle-pagehide", {
    assertion: "pagehide",
    final: state({
      status: "Running exact registered work…",
      startDisabled: false,
      cancelDisabled: true,
    }),
  });
  const running = state({
    status: "Running exact registered work…",
    progressValue: "0",
    workers: [worker(false)],
  });
  verifyLifecycle("lifecycle-wrong-token", {
    assertion: "wrong token",
    ignored: running,
    final: state(),
  });
  const replacement = state({
    status: "Running exact registered work…",
    progressValue: "0",
    workers: [worker(true), worker(false, 3)],
  });
  verifyLifecycle("lifecycle-stale-message", {
    assertion: "stale",
    ignored: replacement,
    final: state({
      status: "Complete. Every reported element passed the registered oracle.",
      output: "[]",
      workers: [worker(true), worker(true, 3)],
    }),
  });
  verifyLifecycle("lifecycle-restart", {
    assertion: "restart",
    restarted: replacement,
    final: state({ workers: [worker(true), worker(true, 3)] }),
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
      '"--enable-automation"',
      '"Browser.getBrowserCommandLine"',
      "endHead !== sourceCommit",
      "current.cgroup === identity.cgroup",
      "if (outputCreated) await Deno.remove(outputRoot",
      '"Accessibility.getFullAXTree"',
      '"Page.captureScreenshot"',
      '"Runtime.consoleAPICalled"',
      '"Network.requestWillBeSent"',
      "w.posted.token+1",
      'Deno.kill(identity.pid, "SIGKILL")',
      "await Deno.remove(profilePath, { recursive: true })",
    ]
  ) assert(source.includes(required), required);
  const guardedSetup = source.indexOf("try {", source.indexOf("let outputCreated"));
  const cleanup = source.indexOf("} finally {", guardedSetup);
  for (
    const setup of [
      "await Deno.mkdir(outputRoot",
      "server = new Deno.Command",
      "await waitFor(`${origin}/healthz`)",
      "profilePath = await Deno.makeTempDir",
      "browserProcess = new Deno.Command",
    ]
  ) {
    const position = source.indexOf(setup, guardedSetup);
    assert(position > guardedSetup && position < cleanup, `${setup} is outside cleanup guard`);
  }
  assert(!source.includes("Deno.kill(-1"));
  assert(!source.includes("pkill"));
  assert(!source.includes("killall"));
});

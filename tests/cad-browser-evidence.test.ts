import Ajv2020Module from "ajv2020";
import {
  CAD_BROWSER_POLICY,
  CAD_INVARIANTS,
  CAD_TARGETS,
  validateCadBrowserEvidenceSemantics,
} from "../lib/cad-browser-evidence.ts";
import { sha256Hex } from "../lib/canonical.ts";
import { generateDirtyStl } from "../benchmarks/base/cad-mesh-repair/fixture.js";
import { repairMeshJavaScript } from "../benchmarks/base/cad-mesh-repair/engine.js";
import { assert, assertEquals } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
// Test-only mutable shape for exhaustive nested poisoning.
// deno-lint-ignore no-explicit-any
type MutableEvidence = Record<string, any>;

const routeFiles = new Map<string, [string, string]>([
  [CAD_BROWSER_POLICY.route, ["public/benchmarks/cad-mesh-repair-v1/index.html", "text/html"]],
  ["/benchmarks/cad-mesh-repair-v1/demo.js", [
    "public/benchmarks/cad-mesh-repair-v1/demo.js",
    "text/javascript",
  ]],
  ["/benchmarks/cad-mesh-repair-v1/worker.js", [
    "public/benchmarks/cad-mesh-repair-v1/worker.js",
    "text/javascript",
  ]],
  ["/benchmarks/base/cad-mesh-repair/engine.js", [
    "benchmarks/base/cad-mesh-repair/engine.js",
    "text/javascript",
  ]],
  ["/artifacts/cad-mesh-repair-v1/dirty-grid.stl", [
    "public/artifacts/cad-mesh-repair-v1/dirty-grid.stl",
    "model/stl",
  ]],
  ["/artifacts/cad-mesh-repair-v1/mesh-repair.wasm", [
    "public/artifacts/cad-mesh-repair-v1/mesh-repair.wasm",
    "application/wasm",
  ]],
]);

function base64(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

async function makeNetwork(
  target: "javascript" | "wasm",
  origin: string,
): Promise<Array<Record<string, unknown>>> {
  const paths = [
    CAD_BROWSER_POLICY.route,
    "/benchmarks/cad-mesh-repair-v1/demo.js",
    "/benchmarks/cad-mesh-repair-v1/worker.js",
    "/benchmarks/base/cad-mesh-repair/engine.js",
    "/artifacts/cad-mesh-repair-v1/dirty-grid.stl",
    ...(target === "wasm" ? ["/artifacts/cad-mesh-repair-v1/mesh-repair.wasm"] : []),
  ];
  return await Promise.all(paths.map(async (path, index) => {
    const [file, mimeType] = routeFiles.get(path)!;
    const bytes = await Deno.readFile(file);
    const page = index < 2;
    return {
      requestId: `${target}-${index}`,
      sourceSessionId: page ? `${target}-page-session` : `${target}-worker-session`,
      sourceTargetId: page ? `${target}-page-target` : `${target}-worker-target`,
      sourceType: page ? "page" : "worker",
      url: `${origin}${path}`,
      method: "GET",
      resourceType: page ? (index === 0 ? "Document" : "Script") : "Fetch",
      requestSequence: index * 3 + 1,
      responseSequence: index * 3 + 2,
      endSequence: index * 3 + 3,
      status: 200,
      mimeType,
      fromDiskCache: false,
      fromServiceWorker: false,
      failed: false,
      errorText: null,
      encodedDataLength: bytes.length,
      bodyCaptured: true,
      rawBody: { bytes: bytes.length, sha256: await sha256Hex(bytes), base64: base64(bytes) },
    };
  }));
}

async function validEvidence(): Promise<MutableEvidence> {
  const output = repairMeshJavaScript(generateDirtyStl()).bytes;
  assertEquals(output.length, CAD_BROWSER_POLICY.outputBytes);
  assertEquals(await sha256Hex(output), CAD_BROWSER_POLICY.outputSha256);
  const origin = "http://127.0.0.1:43127";
  const profile = "/tmp/wasm-vs-js-owned-profiles/cad-test-run/profile";
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const makeScenario = async (target: "javascript" | "wasm") => ({
    target,
    route: CAD_BROWSER_POLICY.route,
    assertions: [
      "visible Start control entered running state",
      "visible status reached Complete.",
      "raw complete output bytes matched accepted oracle",
      "exact invariants and work counters matched",
    ],
    result: {
      output: { bytes: output.length, sha256: await sha256Hex(output), base64: base64(output) },
      counters: CAD_TARGETS[target].counters,
      invariants: CAD_INVARIANTS,
    },
    session: {
      pageTargetId: `${target}-page-target`,
      pageSessionId: `${target}-page-session`,
      pageAttached: true,
      workerSessions: [{
        targetId: `${target}-worker-target`,
        sessionId: `${target}-worker-session`,
        attachedSequence: 4,
        detachedSequence: 99,
      }],
      workersDetached: true,
    },
    network: await makeNetwork(target, origin),
    networkEventsComplete: true,
    console: [],
    consoleEventsComplete: true,
    exceptions: [],
    exceptionEventsComplete: true,
    accessibility: {
      complete: true,
      nodes: [
        "main",
        "heading",
        "combobox",
        "button",
        "status",
        "progressbar",
        "generic",
        "generic",
      ]
        .map((role, index) => ({
          nodeId: String(index + 1),
          ignored: false,
          role,
          name: role,
          childIds: [],
        })),
    },
    screenshot: {
      path: `artifacts/cad-mesh-repair/browser-evidence/screenshots/${target}.png`,
      bytes: png.length,
      sha256: await sha256Hex(png),
      base64: base64(png),
    },
  });
  return {
    schemaVersion: 1,
    evidenceId: CAD_BROWSER_POLICY.evidenceId,
    status: "authoritative-browser-correctness",
    performanceClaim: false,
    collectedAt: "2026-08-03T16:00:00.000Z",
    source: {
      acceptedCommit: CAD_BROWSER_POLICY.acceptedCommit,
      acceptedTree: CAD_BROWSER_POLICY.acceptedTree,
      collectorCommit: "f".repeat(40),
      cleanAtStart: true,
      cleanAtEnd: true,
    },
    collector: {
      parentRun: true,
      protocol: "Chrome DevTools Protocol",
      command:
        `deno run <permissions> scripts/collect-cad-mesh-repair-browser-evidence.ts --source-commit=${CAD_BROWSER_POLICY.acceptedCommit} --chrome=${CAD_BROWSER_POLICY.requestedBinary}`,
      origin,
      process: {
        pid: 100,
        parentPid: 50,
        processGroupId: 100,
        sessionId: 50,
        startTimeTicks: "123456",
        executable: "/usr/bin/deno",
      },
    },
    browser: {
      channel: CAD_BROWSER_POLICY.channel,
      version: CAD_BROWSER_POLICY.version,
      product: CAD_BROWSER_POLICY.product,
      revision: "@revision",
      userAgent: "HeadlessChrome/150",
      jsVersion: "15.0",
      requestedBinary: CAD_BROWSER_POLICY.requestedBinary,
      resolvedStagedBinary: "/tmp/wasm-vs-js-staged-chrome/cad-test-run/chrome",
      binarySha256: CAD_BROWSER_POLICY.binarySha256,
      packageManifestSha256: CAD_BROWSER_POLICY.packageManifestSha256,
      launchArguments: [`--user-data-dir=${profile}`, ...CAD_BROWSER_POLICY.launchArgumentSuffix],
    },
    ownership: {
      stage: {
        id: "cad-test-run",
        root: "/tmp/wasm-vs-js-staged-chrome/cad-test-run",
        rootDev: 1,
        rootIno: 2,
        ownerManifestSha256: "a".repeat(64),
        packageManifestSha256: CAD_BROWSER_POLICY.packageManifestSha256,
        cleanupLifecycle: "cleanup-verified",
        removed: true,
        absent: true,
      },
      profile: { path: profile, dev: 1, ino: 3, mode: 448, removed: true, absent: true },
      cgroup: {
        unit: "wasm-vs-js-0123456789abcdef.service",
        controlGroup: "/user.slice/cad.service",
        cgroupPath: "/sys/fs/cgroup/user.slice/cad.service",
        cgroupDev: 1,
        cgroupIno: 4,
        invocationId: "b".repeat(32),
        mainPid: 200,
        membershipSnapshots: [{ collectedAt: "2026-08-03T16:00:01Z", members: [200, 201] }],
        cleanupVerified: true,
        remainingMembers: [],
      },
    },
    lifecycle: CAD_BROWSER_POLICY.lifecycle.map((event, index) => ({
      sequence: index + 1,
      event,
      at: `2026-08-03T16:00:${String(index).padStart(2, "0")}Z`,
    })),
    scenarios: [await makeScenario("javascript"), await makeScenario("wasm")],
    cleanup: {
      browserCgroupKilled: true,
      profileRemoved: true,
      stageRemoved: true,
      profileReservationRemoved: true,
      serverStopped: true,
      temporaryOutputRemoved: true,
    },
  };
}

async function assertSemanticRejects(
  source: MutableEvidence,
  label: string,
  mutate: (copy: MutableEvidence) => void,
): Promise<void> {
  const copy = structuredClone(source);
  mutate(copy);
  try {
    await validateCadBrowserEvidenceSemantics(copy);
  } catch {
    return;
  }
  throw new Error(`semantic validator accepted poisoned ${label}`);
}

Deno.test("CAD browser evidence schema is recursively closed and accepts the exact material record", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/cad-mesh-repair-browser-evidence.schema.json"),
  );
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  const evidence = await validEvidence();
  assert(validate(evidence), JSON.stringify(validate.errors));
  for (
    const mutate of [
      (copy: MutableEvidence) => copy.unexpected = true,
      (copy: MutableEvidence) => copy.browser.unexpected = true,
      (copy: MutableEvidence) => copy.ownership.cgroup.unexpected = true,
      (copy: MutableEvidence) => copy.scenarios[0].result.output.unexpected = true,
      (copy: MutableEvidence) => copy.scenarios[0].network[0].rawBody.unexpected = true,
      (copy: MutableEvidence) => copy.scenarios[0].accessibility.nodes[0].unexpected = true,
      (copy: MutableEvidence) => copy.cleanup.unexpected = true,
    ]
  ) {
    const poisoned = structuredClone(evidence);
    mutate(poisoned);
    assert(!validate(poisoned), "closed schema accepted an additional property");
  }
});

Deno.test("CAD browser semantic validator binds CfT, ownership, causal telemetry, and every material field", async () => {
  const evidence = await validEvidence();
  await validateCadBrowserEvidenceSemantics(evidence);
  const poison: Array<[string, (copy: MutableEvidence) => void]> = [
    ["accepted commit", (copy) => copy.source.acceptedCommit = "0".repeat(40)],
    ["accepted tree", (copy) => copy.source.acceptedTree = "0".repeat(40)],
    ["source start", (copy) => copy.source.cleanAtStart = false],
    ["source end", (copy) => copy.source.cleanAtEnd = false],
    ["parent run", (copy) => copy.collector.parentRun = false],
    ["collector session", (copy) => copy.collector.process.sessionId = null],
    ["CfT channel", (copy) => copy.browser.channel = "chrome"],
    ["CfT version", (copy) => copy.browser.version = "149.0.0.0"],
    ["CfT product", (copy) => copy.browser.product = "Chrome/149.0.0.0"],
    ["CfT binary hash", (copy) => copy.browser.binarySha256 = "0".repeat(64)],
    ["CfT package hash", (copy) => copy.browser.packageManifestSha256 = "0".repeat(64)],
    ["enable automation argument", (copy) => copy.browser.launchArguments.splice(8, 1)],
    ["argument order", (copy) => copy.browser.launchArguments.reverse()],
    ["stage package", (copy) => copy.ownership.stage.packageManifestSha256 = "0".repeat(64)],
    ["stage lifecycle", (copy) => copy.ownership.stage.cleanupLifecycle = "owned-launch-active"],
    ["profile ownership", (copy) => copy.ownership.profile.mode = 493],
    ["cgroup invocation", (copy) => copy.ownership.cgroup.invocationId = "bad"],
    ["cgroup membership", (copy) => copy.ownership.cgroup.membershipSnapshots[0].members = [201]],
    ["causal lifecycle", (copy) => copy.lifecycle.reverse()],
    ["lifecycle sequence", (copy) => copy.lifecycle[4].sequence = 99],
    ["target order", (copy) => copy.scenarios.reverse()],
    ["JS output bytes", (copy) => copy.scenarios[0].result.output.bytes++],
    ["Wasm output hash", (copy) => copy.scenarios[1].result.output.sha256 = "0".repeat(64)],
    [
      "raw output",
      (copy) => copy.scenarios[0].result.output.base64 = base64(new Uint8Array(19100)),
    ],
    [
      "cross-target bytes",
      (copy) =>
        copy.scenarios[1].result.output.base64 = copy.scenarios[1].result.output.base64.replace(
          /^./,
          "A",
        ),
    ],
    ["invariant", (copy) => copy.scenarios[0].result.invariants.exactTarget = false],
    ["worker session", (copy) => copy.scenarios[0].session.workerSessions = []],
    ["network source", (copy) => copy.scenarios[0].network[0].sourceSessionId = null],
    ["network end", (copy) => copy.scenarios[0].network[0].endSequence = 1],
    ["network raw bytes", (copy) => copy.scenarios[0].network[3].rawBody.bytes++],
    ["accepted asset hash", (copy) => copy.scenarios[0].network[3].rawBody.sha256 = "0".repeat(64)],
    ["network completeness", (copy) => copy.scenarios[0].networkEventsComplete = false],
    ["console completeness", (copy) => copy.scenarios[0].consoleEventsComplete = false],
    ["exception completeness", (copy) => copy.scenarios[0].exceptionEventsComplete = false],
    ["console error", (copy) => copy.scenarios[0].console.push({ type: "error" })],
    ["exception", (copy) => copy.scenarios[0].exceptions.push({ text: "boom" })],
    ["AX completeness", (copy) => copy.scenarios[0].accessibility.complete = false],
    ["AX roles", (copy) => copy.scenarios[0].accessibility.nodes[0].role = "generic"],
    ["screenshot bytes", (copy) => copy.scenarios[0].screenshot.bytes++],
    ["cleanup", (copy) => copy.cleanup.browserCgroupKilled = false],
  ];
  for (const [label, mutate] of poison) await assertSemanticRejects(evidence, label, mutate);
  for (const scenarioIndex of [0, 1]) {
    for (const counter of Object.keys(evidence.scenarios[scenarioIndex].result.counters)) {
      await assertSemanticRejects(
        evidence,
        `scenario ${scenarioIndex} counter ${counter}`,
        (copy) => {
          copy.scenarios[scenarioIndex].result.counters[counter]++;
        },
      );
    }
    for (const invariant of Object.keys(evidence.scenarios[scenarioIndex].result.invariants)) {
      await assertSemanticRejects(
        evidence,
        `scenario ${scenarioIndex} invariant ${invariant}`,
        (copy) => {
          const current = copy.scenarios[scenarioIndex].result.invariants[invariant];
          copy.scenarios[scenarioIndex].result.invariants[invariant] = typeof current === "boolean"
            ? !current
            : typeof current === "number"
            ? current + 1
            : `${current}-poisoned`;
        },
      );
    }
  }
});

Deno.test("CAD collector source retains parent ownership and protected cleanup without launching Chrome", async () => {
  const collector = await Deno.readTextFile(
    "scripts/collect-cad-mesh-repair-browser-evidence.ts",
  );
  const demo = await Deno.readTextFile("public/benchmarks/cad-mesh-repair-v1/demo.js");
  const worker = await Deno.readTextFile("public/benchmarks/cad-mesh-repair-v1/worker.js");
  for (
    const required of [
      "inspectChromePackage",
      "stageChromePackage",
      "launchOwnedChrome",
      "refreshLedger",
      "closeOwnedChrome",
      "recordStageCleanupLifecycle",
      "removeStagedChrome",
      "reserveProfileNamespace",
      "releaseProfileReservation",
      'browser.on("Target.attachedToTarget"',
      'browser.on("Network.requestWillBeSent"',
      'browser.on("Network.responseReceived"',
      'browser.on("Network.loadingFinished"',
      '"Network.getResponseBody"',
      '"Accessibility.getFullAXTree"',
      '"Page.captureScreenshot"',
      "finally",
    ]
  ) assert(collector.includes(required), `collector omitted ${required}`);
  assert(
    collector.includes("extraArguments: CAD_BROWSER_POLICY.launchArgumentSuffix.slice(6, -1)"),
  );
  assert(!collector.includes("pkill"));
  assert(!collector.includes("killall"));
  assert(worker.includes("outputBase64: base64(value.bytes)"));
  assert(demo.includes("globalThis.__cadMeshEvidenceResult"));
  assert(demo.includes("delete displayResult.outputBase64"));
});

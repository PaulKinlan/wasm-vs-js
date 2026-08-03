import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import { compileC } from "../../benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js";
import { sha256Hex } from "../../lib/canonical.ts";
import {
  ACCEPTED_IMPLEMENTATION_COMMIT,
  ACCEPTED_PACKAGE_PATHS,
  assertCorpusSemantics,
  assertEvidenceSemantics,
  COUNTER_FIELDS,
  EXACT_CHROME_PRODUCT,
  EXACT_CHROME_SHA256,
  EXECUTED_SOURCE_PATHS,
  parseCollectorArguments,
  SCENARIO_IDS,
} from "../../scripts/collect-base-tooling-c-to-wasm-compile-evidence.ts";
import { assert, assertEquals, assertRejects } from "../assert.ts";

type Json = Record<string, unknown>;
type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvInstance = { compile: (schema: unknown) => Validator };
type AjvConstructor = new (options?: Record<string, unknown>) => AjvInstance;
type AddFormats = (ajv: AjvInstance) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;
const HASH = "a".repeat(64), GIT = "b".repeat(40);
const EMPTY_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const BODY_HASH = "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a";
const COMPILER_HASH = "ba3948eeb4a56194a458276ed8c0693f5f54bf8baf2d3179afe4df8a6ce89124";
const root = new URL("../../", import.meta.url);

function b64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function clone<T>(value: T): T {
  return structuredClone(value);
}
async function documents() {
  return {
    fixture: JSON.parse(
      await Deno.readTextFile(
        new URL("public/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json", root),
      ),
    ),
    validation: JSON.parse(
      await Deno.readTextFile(
        new URL("public/evidence/base/tooling-c-to-wasm-compile/validation.json", root),
      ),
    ),
    negatives: JSON.parse(
      await Deno.readTextFile(
        new URL("benchmarks/base/tooling-c-to-wasm-compile/negative-fixtures.v1.json", root),
      ),
    ),
    buildText: await Deno.readTextFile(
      new URL("public/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json", root),
    ),
    compilerBytes: await Deno.readFile(
      new URL("public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm", root),
    ),
  };
}

async function corpusFixture() {
  const { validation, negatives, buildText, compilerBytes } = await documents();
  const programs = [];
  for (let index = 0; index < 20; index += 1) {
    const id = String(index + 1).padStart(2, "0");
    const [source, header] = await Promise.all([
      Deno.readTextFile(
        new URL(`benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${id}.c`, root),
      ),
      Deno.readTextFile(
        new URL(`benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${id}.h`, root),
      ),
    ]);
    const raw = compileC(source, header).bytes;
    const expected = validation.results[index];
    programs.push({
      id,
      "javascript-controlled": {
        outputSha256: expected.outputSha256,
        outputBytes: expected.outputBytes,
        testResult: expected.testResult,
        counters: expected.jsCounters,
        wasmBase64: b64(raw),
      },
      "wasm-self-hosted-controlled": {
        outputSha256: expected.outputSha256,
        outputBytes: expected.outputBytes,
        testResult: expected.testResult,
        counters: expected.wasmCounters,
        wasmBase64: b64(raw),
      },
    });
  }
  return {
    counterFields: [...COUNTER_FIELDS],
    programs,
    negatives: negatives.cases.map((item: Json) => ({
      id: item.id,
      reason: item.reason,
      javascriptRejected: true,
      wasmReturn: -1,
    })),
    outputSetSha256: validation.outputSetSha256,
    compilerArtifactSha256: COMPILER_HASH,
    buildManifestText: buildText,
    executedWasmInputs: Array(41).fill(b64(compilerBytes)),
  };
}

function sourceAttestation(phase: "start" | "end") {
  const file = (path: string) => ({ path, bytes: 1, sha256: HASH });
  return {
    phase,
    commit: GIT,
    tree: GIT,
    clean: true,
    statusPorcelainSha256: EMPTY_HASH,
    acceptedImplementationCommit: ACCEPTED_IMPLEMENTATION_COMMIT,
    files: EXECUTED_SOURCE_PATHS.map(file),
    acceptedFiles: ACCEPTED_PACKAGE_PATHS.map(file),
  };
}
function state(workerAudit: Json[] = []) {
  return {
    status: "Ready.",
    result: "No result yet.",
    startDisabled: false,
    cancelDisabled: true,
    program: "01",
    target: "javascript",
    workerAudit,
  };
}
function network(sessionId: string, index: number) {
  return {
    sessionId,
    requestId: `request-${index}`,
    url: `http://127.0.0.1:8123/resource-${index}`,
    method: "GET",
    resourceType: "Script",
    status: 200,
    mimeType: "application/json",
    fromDiskCache: false,
    fromServiceWorker: false,
    failed: false,
    errorText: null,
    body: { bytes: 2, sha256: BODY_HASH, base64: "e30=" },
  };
}
function artifact(path: string) {
  return { path, bytes: 2, sha256: BODY_HASH };
}
const EXECUTABLES: Record<string, string> = {
  "/benchmarks/tooling-c-to-wasm-compile-v1/demo.js":
    "public/benchmarks/tooling-c-to-wasm-compile-v1/demo.js",
  "/benchmarks/tooling-c-to-wasm-compile-v1/worker.js":
    "public/benchmarks/tooling-c-to-wasm-compile-v1/worker.js",
  "/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js":
    "benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
};
async function executedAsset(sessionId: string, route: string) {
  const sourcePath = EXECUTABLES[route], raw = await Deno.readFile(new URL(sourcePath, root));
  return {
    route,
    sourcePath,
    sessionId,
    protocolMethod: "Debugger.getScriptSource",
    bytes: raw.byteLength,
    sha256: await sha256Hex(raw),
    base64: b64(raw),
  };
}
async function fetchedInput(sessionId: string, index: number, route: string, path: string) {
  const raw = await Deno.readFile(new URL(path, root));
  return {
    sessionId,
    requestId: `input-${index}`,
    url: `http://127.0.0.1:8123${route}`,
    method: "GET",
    resourceType: path.endsWith(".wasm") ? "Fetch" : "Script",
    status: 200,
    mimeType: path.endsWith(".wasm") ? "application/wasm" : "application/octet-stream",
    fromDiskCache: false,
    fromServiceWorker: false,
    failed: false,
    errorText: null,
    body: { bytes: raw.byteLength, sha256: await sha256Hex(raw), base64: b64(raw) },
  };
}
function lifecycleAssertions(id: string): string[] {
  return ({
    "lifecycle-wrong-token": ["wrong-token-ignored", "worker-terminated"],
    "lifecycle-stale-error": [
      "prior-worker-terminated",
      "stale-error-ignored",
      "worker-terminated",
    ],
    "lifecycle-restart": [
      "prior-worker-terminated",
      "replacement-worker-active",
      "worker-terminated",
    ],
    "lifecycle-cancel": ["cancelled", "late-message-ignored", "worker-terminated"],
    "lifecycle-timeout": ["timeout-fired", "late-message-ignored", "worker-terminated"],
    "lifecycle-pagehide": ["pagehide-fired", "late-message-ignored", "worker-terminated"],
  } as Record<string, string[]>)[id];
}
async function evidenceFixture() {
  const corpus = await corpusFixture();
  const { validation, compilerBytes } = await documents();
  const visible = (target: "javascript" | "wasm") =>
    JSON.stringify({
      target,
      program: "01",
      outputSha256: validation.results[0].outputSha256,
      outputBytes: validation.results[0].outputBytes,
      testResult: validation.results[0].testResult,
      counters: target === "javascript"
        ? validation.results[0].jsCounters
        : validation.results[0].wasmCounters,
    });
  const scenarios = await Promise.all(SCENARIO_IDS.map(async (id, index) => {
    const sessionId = `page-${index}`;
    const raw = id === "visible-javascript-01"
      ? visible("javascript")
      : id === "visible-wasm-01"
      ? visible("wasm")
      : null;
    const isCorpus = id === "compiler-corpus";
    const isVisible = id.startsWith("visible-");
    const workerSession = `worker-${index}`;
    const sessions: Json[] = [{
      sessionId,
      targetId: `target-${index}`,
      kind: "page",
      ownerSessionId: null,
      url: "about:blank",
    }];
    if (isVisible) {
      sessions.push({
        sessionId: workerSession,
        targetId: `worker-target-${index}`,
        kind: "worker",
        ownerSessionId: sessionId,
        url: "http://127.0.0.1:8123/benchmarks/tooling-c-to-wasm-compile-v1/worker.js",
      });
    }
    const assetRoutes = isCorpus
      ? [
        "/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
        "/benchmarks/tooling-c-to-wasm-compile-v1/demo.js",
      ]
      : isVisible
      ? Object.keys(EXECUTABLES).sort()
      : ["/benchmarks/tooling-c-to-wasm-compile-v1/demo.js"];
    const scenario: Json = {
      id,
      route: "/benchmarks/tooling-c-to-wasm-compile-v1/",
      mode: isCorpus
        ? "native-browser-corpus"
        : isVisible
        ? "native-visible-demo"
        : "instrumented-lifecycle",
      sessions,
      causes: [{ sequence: 0, event: "test", detail: "synthetic closed-schema evidence" }],
      snapshots: [],
      finalState: state(),
      rawResultText: raw,
      rawResultTextSha256: raw === null ? null : await sha256Hex(raw),
      corpus: isCorpus ? corpus : null,
      assertions: isCorpus
        ? [
          "20-program-corpus",
          "byte-identical-generated-wasm",
          "exact-oracles",
          "exact-counters",
          "nine-negatives-fail-closed",
        ]
        : isVisible
        ? [
          "visible-control",
          "complete-result-text",
          "manifest-output-hash",
          "exported-test-oracle",
          "exact-counters",
        ]
        : lifecycleAssertions(id),
      console: [],
      exceptions: [],
      network: [network(sessionId, 0), network(sessionId, 1), network(sessionId, 2)],
      executedAssets: await Promise.all(
        assetRoutes.map((route) =>
          executedAsset(
            route.includes("worker.js") || route.includes("compiler-js.js") && isVisible
              ? workerSession
              : sessionId,
            route,
          )
        ),
      ),
      executedWasm: isCorpus
        ? {
          route: "/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
          sourcePath: "public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
          sessionId,
          protocolMethod: "WebAssembly.instantiate input instrumentation",
          bytes: compilerBytes.byteLength,
          sha256: COMPILER_HASH,
          base64: b64(compilerBytes),
        }
        : null,
      accessibility: {
        artifact: artifact(`accessibility/${id}.json`),
        nodeCount: 20,
        checks: [true, true, true, true, true, true],
      },
      screenshot: artifact(`screenshots/${id}.png`),
    };
    if (isCorpus) {
      const required: Record<string, string> = {
        "/benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js":
          "benchmarks/base/tooling-c-to-wasm-compile/compiler-js.js",
        "/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm":
          "public/artifacts/base/tooling-c-to-wasm-compile/compiler.wasm",
        "/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json":
          "public/artifacts/base/tooling-c-to-wasm-compile/build-manifest.json",
        "/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json":
          "public/artifacts/base/tooling-c-to-wasm-compile/fixture-manifest.json",
        "/evidence/base/tooling-c-to-wasm-compile/validation.json":
          "public/evidence/base/tooling-c-to-wasm-compile/validation.json",
      };
      for (let fixtureIndex = 1; fixtureIndex <= 20; fixtureIndex += 1) {
        const fixtureId = String(fixtureIndex).padStart(2, "0");
        required[`/benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${fixtureId}.c`] =
          `benchmarks/base/tooling-c-to-wasm-compile/fixtures/programs/${fixtureId}.c`;
        required[`/benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${fixtureId}.h`] =
          `benchmarks/base/tooling-c-to-wasm-compile/fixtures/headers/${fixtureId}.h`;
      }
      const retained = scenario.network as Json[];
      retained.push(
        ...await Promise.all(
          Object.entries(required).map(([route, path], inputIndex) =>
            fetchedInput(sessionId, inputIndex, route, path)
          ),
        ),
      );
    }
    return scenario;
  }));
  const profile =
    "/tmp/wasm-vs-js-owned-profiles/tooling-c-to-wasm-12345678-1234-1234-1234-123456789abc/chrome";
  const args = [
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    "--headless=new",
    "--enable-automation",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--metrics-recording-only",
    "--hide-scrollbars",
    "--window-size=1440,1200",
    "--force-device-scale-factor=1",
    "about:blank",
  ];
  const process = { pid: 1234, parentPid: 1, startTimeTicks: "99", executable: "/tmp/chrome" };
  const snapshot = { collectedAt: "2026-08-03T12:00:00.000Z", members: [1234] };
  return {
    schemaVersion: 1,
    evidenceId: "tooling-c-to-wasm-compile-chrome-parent-v1",
    workloadId: "tooling.c-to-wasm-compile.v1",
    collectedAt: "2026-08-03T12:00:00.000Z",
    source: { start: sourceAttestation("start"), end: sourceAttestation("end"), unchanged: true },
    collector: {
      denoVersion: "2.9.0",
      command: [`--source-commit=${GIT}`, "--chrome=/input/chrome", "--output=/output/evidence"],
      pid: 2000,
      parentPid: 1000,
    },
    browser: {
      product: EXACT_CHROME_PRODUCT,
      expectedProduct: EXACT_CHROME_PRODUCT,
      revision: "@revision",
      userAgent: "HeadlessChrome/150.0.7871.24",
      jsVersion: "15.0.245.5",
      executable: { path: "/tmp/chrome", dev: 1, ino: 2, sha256: EXACT_CHROME_SHA256 },
      expectedSha256: EXACT_CHROME_SHA256,
      configuredArguments: args,
      effectiveArguments: args,
      headless: true,
      protocol: "Chrome DevTools Protocol",
      endpoint: { host: "127.0.0.1", port: 9222, browserPath: "/devtools/browser/abc" },
      profile: {
        ownershipRoot: profile.slice(0, profile.lastIndexOf("/")),
        ownershipParentDev: 1,
        ownershipParentIno: 2,
        ownershipDev: 1,
        ownershipIno: 3,
        removeOwnershipRoot: true,
        profileRoot: profile,
        profileDev: 1,
        profileIno: 4,
      },
      ownership: {
        unit: "wasm-vs-js-abcdef0123456789.service",
        controlGroup: "/user.slice/exact.service",
        cgroupPath: "/sys/fs/cgroup/user.slice/exact.service",
        cgroupDev: 1,
        cgroupIno: 2,
        invocationId: "c".repeat(32),
        mainPid: 1234,
        commandLine: ["/tmp/chrome", ...args],
        members: [1234],
        membershipSnapshots: [snapshot],
      },
    },
    server: {
      origin: "http://127.0.0.1:8123",
      loopbackOnly: true,
      mode: "public",
      launcher: process,
    },
    scenarios,
    cleanup: {
      browser: {
        unit: "wasm-vs-js-abcdef0123456789.service",
        controlGroup: "/user.slice/exact.service",
        cgroupPath: "/sys/fs/cgroup/user.slice/exact.service",
        cgroupDev: 1,
        cgroupIno: 2,
        invocationId: "c".repeat(32),
        mainPid: 1234,
        observedPids: [1234],
        membershipSnapshots: [snapshot],
        remainingPids: [],
        cgroupEmpty: true,
        stoppedAt: "2026-08-03T12:01:00.000Z",
      },
      profile: { path: profile, removed: true, absent: true },
      server: {
        launcher: process,
        signal: "SIGTERM",
        exit: { success: false, code: 143, signal: "SIGTERM" },
        processAbsent: true,
      },
      stage: {
        path: "/tmp/wasm-vs-js-staged-chrome/tooling-c-to-wasm-browser-evidence-v1",
        dev: 1,
        ino: 5,
        removed: true,
        absent: true,
      },
    },
  };
}

Deno.test("C-to-Wasm parent collector argument contract freezes exact external inputs", () => {
  assertEquals(
    parseCollectorArguments([
      `--source-commit=${GIT}`,
      "--chrome=/external/chrome",
      "--output=/external/evidence",
    ]),
    { sourceCommit: GIT, chrome: "/external/chrome", output: "/external/evidence" },
  );
  for (
    const args of [
      [`--source-commit=${GIT}`, "--chrome=/external/chrome"],
      [`--source-commit=${GIT}`, "--chrome=relative", "--output=/external/evidence"],
      [`--source-commit=${GIT}`, "--chrome=/external/chrome", "--output=relative"],
      [
        `--source-commit=${GIT}`,
        "--chrome=/external/chrome",
        "--output=/external/evidence",
        "--extra=x",
      ],
    ]
  ) {
    let rejected = false;
    try {
      parseCollectorArguments(args);
    } catch {
      rejected = true;
    }
    assert(rejected, `argument negative unexpectedly accepted: ${args.join(" ")}`);
  }
});

Deno.test("C-to-Wasm browser corpus semantic gate binds raw bytes, all programs, counters, and negatives", async () => {
  const docs = await documents(), corpus = await corpusFixture();
  await assertCorpusSemantics(corpus, docs.fixture, docs.validation, docs.negatives);
  const mutations: Array<(value: Json) => void> = [
    (value) => (value.programs as Json[]).pop(),
    (value) =>
      ((value.programs as Json[])[0]["javascript-controlled"] as Json).wasmBase64 = "AGFzbQEAAAA=",
    (value) =>
      ((value.programs as Json[])[3]["wasm-self-hosted-controlled"] as Json).testResult = 999,
    (value) =>
      (((value.programs as Json[])[7]["javascript-controlled"] as Json).counters as Json).tokens =
        1,
    (value) => (value.negatives as Json[])[0].javascriptRejected = false,
    (value) => (value.negatives as Json[]).pop(),
  ];
  for (const mutate of mutations) {
    const changed = clone(corpus) as Json;
    mutate(changed);
    await assertRejects(
      () => assertCorpusSemantics(changed, docs.fixture, docs.validation, docs.negatives),
      "",
    );
  }
});

Deno.test("C-to-Wasm browser evidence schema is closed and ordered", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile(
      new URL("schemas/base-tooling-c-to-wasm-compile-browser-evidence.schema.json", root),
    ),
  );
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema), evidence = await evidenceFixture();
  assert(validate(evidence), JSON.stringify(validate.errors));
  const mutations: Array<(value: Json) => void> = [
    (value) => value.unexpected = true,
    (value) => delete (value.browser as Json).expectedSha256,
    (value) => ((value.browser as Json).configuredArguments as string[]).splice(8, 1),
    (value) => ((value.scenarios as Json[]).reverse()),
    (value) => ((value.scenarios as Json[])[0].network as Json[])[0].body = null,
    (value) => ((value.scenarios as Json[])[0].exceptions as Json[]).push({}),
    (value) => ((value.cleanup as Json).browser as Json).remainingPids = [1234],
    (value) => ((value.source as Json).start as Json).extra = true,
  ];
  for (const mutate of mutations) {
    const changed = clone(evidence) as Json;
    mutate(changed);
    assert(!validate(changed), "closed-schema negative unexpectedly passed");
  }
});

Deno.test("C-to-Wasm evidence semantic gate rejects internally consistent-looking false claims", async () => {
  const docs = await documents(), evidence = await evidenceFixture();
  await assertEvidenceSemantics(evidence, docs.fixture, docs.validation, docs.negatives);
  const mutations: Array<(value: Json) => void> = [
    (value) => ((value.source as Json).end as Json).tree = "c".repeat(40),
    (value) => ((value.browser as Json).effectiveArguments as string[]).push("--enable-automation"),
    (value) =>
      ((value.scenarios as Json[])[0].network as Json[])[0].body = {
        bytes: 2,
        sha256: BODY_HASH,
        base64: "W10=",
      },
    (value) => ((value.scenarios as Json[])[0].executedWasm as Json).base64 = "AGFzbQEAAAA=",
    (value) => ((value.scenarios as Json[])[0].sessions as Json[])[0].ownerSessionId = "foreign",
    (value) => ((value.scenarios as Json[])[3].assertions as string[])[0] = "claimed-without-cause",
    (value) => ((value.cleanup as Json).profile as Json).absent = false,
  ];
  for (const mutate of mutations) {
    const changed = clone(evidence) as Json;
    mutate(changed);
    await assertRejects(
      () => assertEvidenceSemantics(changed, docs.fixture, docs.validation, docs.negatives),
      "",
    );
  }
});

Deno.test("collector source contains protected setup cleanup, end-source gate, owned sessions, and no Chrome invocation in tests", async () => {
  const source = await Deno.readTextFile(
    new URL("scripts/collect-base-tooling-c-to-wasm-compile-evidence.ts", root),
  );
  for (
    const required of [
      "stageChromePackage",
      "launchOwnedChrome",
      "ChromeLaunchLifecycleError",
      "recordStageCleanupLifecycle",
      '"--enable-automation"',
      "Browser.getBrowserCommandLine",
      "Target.setAutoAttach",
      "Debugger.getScriptSource",
      "WebAssembly.instantiate input instrumentation",
      'attestFrozenSource(args.sourceCommit, "end")',
      "closeOwnedChrome",
      "removeStagedChrome",
      "cgroupEmpty",
      "Page.captureScreenshot",
      "Accessibility.getFullAXTree",
    ]
  ) assert(source.includes(required), `collector contract missing ${required}`);
  assert(!source.includes("Deno.kill(-1"));
  assert(!source.match(/pkill|killall/));
});

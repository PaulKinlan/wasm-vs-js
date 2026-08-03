import Ajv2020Module from "ajv2020";
import addFormatsModule from "ajv-formats";
import {
  SCENARIOS,
  SERVED_ASSETS,
  TARGETS,
  validateSummary,
} from "../scripts/collect-text-gc-document-edit-browser-evidence.ts";
import { sha256Hex } from "../lib/canonical.ts";
import { assert, assertEquals } from "./assert.ts";

const H40 = "a".repeat(40);
const H64 = "b".repeat(64);
const CANONICAL = "40e55287bfd9486ef258602766e7c839e2ad77ba7f52b843117607132a6fd0c4";
const CHROME = "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355";
const REASON =
  "Portable GC events and runtime-internal allocation counts are not exposed by the Web platform.";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
type AddFormats = (ajv: unknown) => void;
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;
const addFormats = ((addFormatsModule as unknown as { default?: AddFormats }).default ??
  addFormatsModule) as unknown as AddFormats;

function processIdentity(pid: number) {
  return {
    pid,
    parentPid: pid - 1,
    startTimeTicks: String(pid * 100),
    executable: "/opt/google/chrome/chrome",
  };
}

function counters(target: string) {
  return {
    "initial-nodes": 256,
    operations: 10_000,
    inserts: 3_334,
    deletes: 3_333,
    reparents: 3_333,
    "final-nodes": 257,
    "child-insertions": 6_922,
    "child-removals": 6_666,
    "parent-writes": 10_255,
    "node-object-allocations": 3_590,
    "child-list-allocations": 3_590,
    "label-values": 3_590,
    "traversal-nodes": 257,
    "boundary-crossings": target === "wasmgc-controlled" ? 2 : 0,
  };
}

function summary(target: string) {
  return {
    target,
    passed: true,
    canonicalSha256: CANONICAL,
    canonicalBytes: 7_775,
    counters: counters(target),
    identity: {
      rootId: 0,
      reachableNodes: 257,
      uniqueNodeIds: 257,
      parentChildLinksValid: true,
      orderedChildrenRetained: true,
    },
    gcDiagnostics: { status: "unavailable", reason: REASON },
    packageByteHashesVerified: true,
    performanceClaim: null,
    persistence: false,
  };
}

const causalFields = [
  "wrongTokenIgnored",
  "staleErrorIgnored",
  "freshWorkers",
  "timeoutTerminated",
  "cancelTerminated",
  "pagehideTerminated",
] as const;

function scenario(index: number) {
  const definition = SCENARIOS[index];
  const expectedTrue = index === 2
    ? "wrongTokenIgnored"
    : index === 3
    ? "staleErrorIgnored"
    : index === 4
    ? "freshWorkers"
    : index === 5
    ? "timeoutTerminated"
    : index === 6
    ? "cancelTerminated"
    : index === 7
    ? "pagehideTerminated"
    : null;
  const completed = index === 4
    ? [...definition.targets]
    : [0, 1, 2].includes(index)
    ? [definition.targets.at(-1)!]
    : index === 3
    ? ["wasmgc-controlled"]
    : [];
  return {
    id: definition.id,
    mode: definition.mode,
    targetSequence: [...definition.targets],
    completedTargets: completed.map((target) => ({
      target,
      summary: summary(target),
      displayedText: `{"target":"${target}"}`,
      displayedTextSha256: H64,
    })),
    finalState: {
      heading: "GC-rich document model edit",
      status: index < 5
        ? "Complete. Exact output and structural checks passed."
        : index === 5
        ? "Stopped: the 120 second timeout expired."
        : index === 6
        ? "Cancelled. The worker was terminated and no result was retained."
        : "Loading the frozen 10,000-edit fixture in a fresh worker.",
      output: completed.length ? "exact output" : "No result retained while work is in progress.",
      progressValue: completed.length ? null : 0,
      startDisabled: index === 7,
      cancelDisabled: index !== 7,
      target: definition.targets.at(-1)!,
    },
    causal: Object.fromEntries(causalFields.map((name) => [name, name === expectedTrue])),
    assertions: ["causal assertion retained"],
    lifecycleEvents: [
      { kind: "instrumentation-ready", detail: { mode: definition.mode } },
      { kind: "worker-created", detail: { index: 0, url: "/worker.js" } },
      { kind: "worker-terminated", detail: { index: 0 } },
    ],
    console: [],
    exceptions: [],
    network: [{
      context: "page",
      url: "http://127.0.0.1:8123/demo",
      method: "GET",
      resourceType: "Document",
      status: 200,
      mimeType: "text/html",
      fromDiskCache: false,
      fromServiceWorker: false,
      failed: false,
      errorText: null,
      sourcePath: "public/demo.html",
      responseBytes: 100,
      responseSha256: H64,
      cdpBodyEncoding: "utf8",
    }, {
      context: "page",
      url: "http://127.0.0.1:8123/runner.js",
      method: "GET",
      resourceType: "Script",
      status: 200,
      mimeType: "text/javascript",
      fromDiskCache: false,
      fromServiceWorker: false,
      failed: false,
      errorText: null,
      sourcePath: "public/runner.js",
      responseBytes: 100,
      responseSha256: H64,
      cdpBodyEncoding: "utf8",
    }, {
      context: "worker",
      url: "http://127.0.0.1:8123/worker.js",
      method: "GET",
      resourceType: "Script",
      status: 200,
      mimeType: "text/javascript",
      fromDiskCache: false,
      fromServiceWorker: false,
      failed: false,
      errorText: null,
      sourcePath: "public/worker.js",
      responseBytes: 100,
      responseSha256: H64,
      cdpBodyEncoding: "utf8",
    }],
    executedSources: [
      { context: "page", url: "http://127.0.0.1:8123/runner.js", bytes: 100, sha256: H64 },
      { context: "worker", url: "http://127.0.0.1:8123/worker.js", bytes: 100, sha256: H64 },
    ],
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
      },
    },
    screenshot: { path: `screenshots/${definition.id}.png`, bytes: 1_000, sha256: H64 },
    cdpIdentity: {
      browserSessionSha256: H64,
      targetIdSha256: H64,
      pageSessionIdSha256: H64,
      workerSessionIdSha256: index === 3 || index === 4 ? [H64, "c".repeat(64)] : [H64],
      sourceExecutionSha256: H64,
      sessionNetworkSha256: H64,
      targetStateSha256: H64,
    },
  };
}

function validEvidence() {
  const files = SERVED_ASSETS.map(([route, path, contentType]) => ({
    route,
    path,
    contentType,
    bytes: 100,
    sha256: H64,
    acceptedCommitBytesMatch: true,
  }));
  const supportFiles = ["canonical", "cdp", "deploy", "server", "schema", "collector"].map(
    (path) => ({ path, bytes: 100, sha256: H64, headBytesMatch: true }),
  );
  return {
    schemaVersion: 1,
    evidenceId: "text-gc-document-edit-chrome-150-browser-evidence-v1",
    collectedAt: "2026-08-03T12:00:00.000Z",
    authority: {
      kind: "authoritative-parent-run-browser-collection",
      browserWasLaunchedByCollector: true,
      importedOrChildGeneratedEvidenceAccepted: false,
    },
    source: {
      acceptedCommit: "7fca505568b593e374185a0926ffd890196e5e18",
      acceptedTree: "d585a3590b35d9552acb7b9a0a68fddb5eafad09",
      collectorHead: H40,
      collectorTree: H40,
      cleanAtStart: true,
      cleanAtEnd: true,
      endHead: H40,
      endTree: H40,
      sourceGraphSha256: H64,
      files,
      supportFiles,
    },
    collection: {
      script: "scripts/collect-text-gc-document-edit-browser-evidence.ts",
      command:
        "deno run -A scripts/collect-text-gc-document-edit-browser-evidence.ts --source-commit=7fca505568b593e374185a0926ffd890196e5e18 --chrome=/opt/google/chrome/chrome --output-dir=/tmp/evidence",
      outputDirectory: "/tmp/evidence",
    },
    workload: {
      id: "text.gc-document-edit.v1",
      registrationId: "text.gc-document-edit.v1-supplemental-registration-v1",
      route: "/demos/text.gc-document-edit.v1/",
      initialNodes: 256,
      operations: 10_000,
      inserts: 3_334,
      deletes: 3_333,
      reparents: 3_333,
      canonicalBytes: 7_775,
      canonicalSha256: CANONICAL,
      targets: [...TARGETS],
      performanceClaim: false,
    },
    browser: {
      product: "Chrome/150.0.7871.24",
      revision: "r1",
      userAgent: "Mozilla/5.0 Chrome/150.0.7871.24",
      jsVersion: "15.0",
      executable: {
        path: "/opt/google/chrome/chrome",
        bytes: 1_000,
        sha256: CHROME,
        dev: 1,
        ino: 2,
      },
      requestedLaunchArguments: [
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
        "--enable-automation",
        "--disable-cache",
        "--window-size=1440,1200",
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=9222",
        "--user-data-dir=/tmp/profile",
        "about:blank",
      ],
      effectiveCommandLine: new Array(17).fill(0).map((_, index) => `arg-${index}`),
      headless: true,
      protocol: "Chrome DevTools Protocol",
      debuggerOrigin: "http://127.0.0.1:9222",
    },
    server: {
      origin: "http://127.0.0.1:8123",
      host: "127.0.0.1",
      mode: "public",
      executable: "/usr/bin/deno",
      arguments: ["run", "--allow-env", "--allow-net", "--allow-read", "deploy.ts"],
      launcher: processIdentity(700),
      preflight: files.map(({ route, bytes, sha256 }) => ({ route, bytes, sha256 })),
    },
    scenarios: SCENARIOS.map((_, index) => scenario(index)),
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
        path: "/tmp/wasm-text-gc-document-edit-chrome-test",
        dev: 1,
        ino: 3,
        initiallyEmpty: true,
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

function assertInvalid(validate: Validator, mutate: (value: Record<string, unknown>) => void) {
  const value = structuredClone(validEvidence()) as unknown as Record<string, unknown>;
  mutate(value);
  assert(
    !validate(value),
    `semantic mutation unexpectedly passed: ${JSON.stringify(validate.errors)}`,
  );
}

function expectThrows(fn: () => unknown, text: string) {
  try {
    fn();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(text), String(error));
    return;
  }
  throw new Error("expected function to throw");
}

Deno.test("document-edit browser schema accepts exactly eight ordered causal scenarios", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/text-gc-document-edit-browser-evidence.schema.json"),
  );
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const value = validEvidence();
  assert(validate(value), JSON.stringify(validate.errors));
  assertEquals(value.scenarios.map((entry) => entry.id), SCENARIOS.map((entry) => entry.id));
  assertEquals(value.source.files.length, SERVED_ASSETS.length);

  assertInvalid(validate, (record) => record.extra = true);
  assertInvalid(validate, (record) => (record.scenarios as unknown[]).pop());
  assertInvalid(validate, (record) => {
    const scenarios = record.scenarios as Array<Record<string, unknown>>;
    [scenarios[0], scenarios[1]] = [scenarios[1], scenarios[0]];
  });
  assertInvalid(validate, (record) => {
    (record.authority as Record<string, unknown>).importedOrChildGeneratedEvidenceAccepted = true;
  });
  assertInvalid(
    validate,
    (record) => (record.source as Record<string, unknown>).cleanAtEnd = false,
  );
  assertInvalid(
    validate,
    (record) => (record.browser as Record<string, unknown>).product = "Chromium/150.0.7871.24",
  );
  assertInvalid(validate, (record) => {
    const args = (record.browser as Record<string, unknown>).requestedLaunchArguments as string[];
    args.splice(args.indexOf("--enable-automation"), 1, "--other");
  });
  assertInvalid(validate, (record) => {
    const network = (record.scenarios as Array<Record<string, unknown>>)[0].network as Array<
      Record<string, unknown>
    >;
    network[0].responseSha256 = "G".repeat(64);
  });
  assertInvalid(validate, (record) => {
    const ax = (record.scenarios as Array<Record<string, unknown>>)[0].accessibility as Record<
      string,
      unknown
    >;
    (ax.assertions as Record<string, unknown>).statusPresent = false;
  });
  assertInvalid(validate, (record) => {
    const cleanup = record.cleanup as Record<string, Record<string, unknown>>;
    cleanup.browser.processesAbsent = false;
  });
});

Deno.test("document-edit schema exhaustively rejects every wrong causal boolean in every scenario", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/text-gc-document-edit-browser-evidence.schema.json"),
  );
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  for (let scenarioIndex = 0; scenarioIndex < SCENARIOS.length; scenarioIndex++) {
    for (const field of causalFields) {
      assertInvalid(validate, (record) => {
        const item = (record.scenarios as Array<Record<string, unknown>>)[scenarioIndex];
        const causal = item.causal as Record<string, boolean>;
        causal[field] = !causal[field];
      });
    }
  }
  for (let index = 0; index < SCENARIOS.length; index++) {
    assertInvalid(validate, (record) => {
      const item = (record.scenarios as Array<Record<string, unknown>>)[index];
      item.mode = "normal";
      if (SCENARIOS[index].mode === "normal") item.mode = "timeout";
    });
    assertInvalid(validate, (record) => {
      const item = (record.scenarios as Array<Record<string, unknown>>)[index];
      (item.targetSequence as string[]).push("js-controlled");
    });
    assertInvalid(validate, (record) => {
      const item = (record.scenarios as Array<Record<string, unknown>>)[index];
      (item.completedTargets as unknown[]).push({});
    });
  }
});

Deno.test("document-edit served source graph is byte-exact at the accepted candidate", async () => {
  const routes = new Set<string>();
  for (const [route, path] of SERVED_ASSETS) {
    assert(!routes.has(route), `duplicate served route: ${route}`);
    routes.add(route);
    const disk = await Deno.readFile(path);
    const committed = await new Deno.Command("git", {
      args: ["show", `HEAD:${path}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(committed.success, `${path} missing from accepted candidate`);
    assertEquals(disk.byteLength, committed.stdout.byteLength);
    assertEquals(await sha256Hex(disk), await sha256Hex(committed.stdout));
  }
  assertEquals(routes.size, 16);
});

Deno.test("document-edit exact summary validation rejects every structural counter and identity drift", () => {
  for (const target of TARGETS) validateSummary(target, summary(target));
  for (const name of Object.keys(counters("js-controlled"))) {
    const bad = structuredClone(summary("js-controlled"));
    (bad.counters as Record<string, number>)[name]++;
    expectThrows(() => validateSummary("js-controlled", bad), "structural counters mismatch");
  }
  for (const name of Object.keys(summary("js-controlled").identity)) {
    const bad = structuredClone(summary("js-controlled"));
    (bad.identity as Record<string, unknown>)[name] = null;
    expectThrows(() => validateSummary("js-controlled", bad), "tree identity mismatch");
  }
  const badTarget = structuredClone(summary("wasmgc-controlled"));
  badTarget.target = "js-controlled";
  expectThrows(
    () => validateSummary("wasmgc-controlled", badTarget),
    "identity/oracle mismatch",
  );
  const open = structuredClone(summary("js-controlled")) as Record<string, unknown>;
  open.extra = true;
  expectThrows(() => validateSummary("js-controlled", open), "open or incomplete shape");
});

Deno.test("document-edit collector source freezes parent authority, raw bytes, CDP hashes, and cleanup", async () => {
  const source = await Deno.readTextFile(
    "scripts/collect-text-gc-document-edit-browser-evidence.ts",
  );
  for (
    const required of [
      "7fca505568b593e374185a0926ffd890196e5e18",
      "d585a3590b35d9552acb7b9a0a68fddb5eafad09",
      "Chrome/150.0.7871.24",
      "--enable-automation",
      "Browser.getBrowserCommandLine",
      "Network.getResponseBody",
      "raw response bytes differ from accepted source",
      "Debugger.getScriptSource",
      "Accessibility.getFullAXTree",
      "Page.captureScreenshot",
      "browserSessionSha256",
      "targetIdSha256",
      "pageSessionIdSha256",
      "sourceExecutionSha256",
      "sessionNetworkSha256",
      "targetStateSha256",
      "wrong-token",
      "stale-error-after-restart",
      "restart",
      "timeout",
      "cancel",
      "pagehide",
      "End-of-run TOCTOU recheck",
      "identityStillRunning",
      "profile identity changed before removal",
      "Browser.close",
      "if (!complete)",
    ]
  ) assert(source.includes(required), `collector omitted ${required}`);
  for (const forbidden of ["pkill", "killall", "performanceClaim: true"]) {
    assert(!source.includes(forbidden), `collector contains forbidden ${forbidden}`);
  }

  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "scripts/collect-text-gc-document-edit-browser-evidence.ts"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(output.success, false);
  assert(decoder.decode(output.stderr).includes("usage:"));
});

Deno.test("document-edit browser schema closes every property-bearing record", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/text-gc-document-edit-browser-evidence.schema.json"),
  );
  const open: string[] = [];
  const visit = (value: unknown, path: string) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}/${index}`));
      return;
    }
    const object = value as Record<string, unknown>;
    if (
      object.type === "object" && object.required && object.properties &&
      object.additionalProperties !== false
    ) {
      open.push(path);
    }
    for (const [name, child] of Object.entries(object)) visit(child, `${path}/${name}`);
  };
  visit(schema, "#");
  assertEquals(open, []);
});

const decoder = new TextDecoder();

import {
  assertBrowserContract,
  assertCompleteResult,
  assertEvidenceSemantics,
  compileEvidenceSchema,
  COMPLETE_OUTPUT_SHA256,
  EXPECTED_EXECUTABLE_SHA256,
  EXPECTED_PRODUCT,
  type NotebookResult,
  parseOptions,
  STATIC_LAUNCH_ARGUMENTS,
} from "../scripts/collect-sqlite-notebook-browser-evidence.ts";
import { sha256Hex } from "../lib/canonical.ts";
import { assert, assertEquals, assertRejects } from "./assert.ts";

interface Validator {
  (value: unknown): boolean;
  errors?: unknown;
}
const HASH = "a".repeat(64);
const GIT = "b".repeat(40);
const EXACT_CHECKS = [
  ["runtime-manifest", "2ce28bfc0925ccb9881858fe8e6fcd9c39d6b7d41ec25e01b22e7abe15c82c4e"],
  ["page", "13099fe088503c322fc85d54c1ad85ca47691dc7fb40b45c004d169991db1c10"],
  ["runner", "7c08a7884c2f28039a29c8de14f6b5b63c298883780032a56136ad52c397ae48"],
  ["worker", "b92b7507bbd5ffa6d69328f0dd8b58a10a80423fe08b16b7f63dbb2465d91bdb"],
  ["contract", "137cbba4f5f825f7dd8cb6e3442be6d5f2bffd3a9fc5c5f9ed8a23f3b51ef48f"],
  ["engine", "ee413b0095633ef9218c37ed8ff0e803bc3ecc8dff8aa282574f442b0a1b5851"],
  ["javascript-engine", "d7a6b9f0d11c60fcd1d1e5d574a13cf8bd02cfa1589a600ff701c6be3926cc87"],
  ["sqlite-glue", "3f707d33cc51193ea446d02487dbda93223ac462aa8b4f512fee9a4122101c1e"],
  ["sqlite-wasm", "02d7e48164395fa68f81c6ec33e9da5461be397dc57602ac0cd89b4bbba1d312"],
  ["dependencies", "6269d01a0dd29410eca9e5774c8d9dd7cd71706b882ef9bd3dc68d7750620ffc"],
  ["fixture-manifest", "5a42c7a7caf3e131846fbcfc2179de016b8f6de8501337172f0c7e534cc3845a"],
  ["customers", "43392b2d16460b282d48cea531c610e7e60c6441e7cb52676f6ba1790f540243"],
  ["products", "a7b935af4de4c21ac40b7a45fd5d7e214dcdf8cd611a756a9bae106615721aa1"],
  ["sales", "40047e14c8445e9fcf49ac0f97bda606efa7485c6b6167b1ae11b0a84ed26d98"],
  ["reference", "13aeb91156f6a11ddb62b6d08c5902bff44962cc886e4d689f4c54fddadc828a"],
] as const;

async function schemaValidator(): Promise<Validator> {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/sqlite-notebook-browser-evidence.schema.json"),
  );
  return compileEvidenceSchema(schema);
}

async function referenceResults() {
  return JSON.parse(
    await Deno.readTextFile("public/artifacts/sqlite-notebook/reference.json"),
  ).results as NotebookResult["results"];
}

function counters(variant: NotebookResult["variant"]) {
  return {
    imports: 3,
    "imported-rows": 4192,
    queries: 8,
    scans: 14,
    joins: 6,
    groups: 6,
    windows: 2,
    sorts: 8,
    allocations: 11,
    "boundary-crossings": variant === "linear-wasm-controlled" ? 2 : 0,
  };
}

async function result(variant: NotebookResult["variant"]): Promise<NotebookResult> {
  const engine = variant === "javascript-controlled"
    ? "AlaSQL 4.17.2"
    : "SQLite linear-wasm 3.53.0";
  const results = await referenceResults();
  const exactChecks = EXACT_CHECKS.map(([id, sha256]) => ({ id, sha256 }));
  const resultCounters = counters(variant);
  const rawText = [
    `Variant: ${variant}`,
    `Engine: ${engine}`,
    "Queries: 8",
    `Canonical output SHA-256: ${COMPLETE_OUTPUT_SHA256}`,
    `Counters: ${JSON.stringify(resultCounters, null, 2)}`,
    `Executed-byte checks: ${exactChecks.map((entry) => `${entry.id}:${entry.sha256}`).join("; ")}`,
    "",
    JSON.stringify(results, null, 2),
  ].join("\n");
  return {
    rawText,
    variant,
    engine,
    queryCount: 8,
    resultRowCount: 744,
    completeOutputSha256: COMPLETE_OUTPUT_SHA256,
    counters: resultCounters,
    exactChecks,
    results,
  };
}

function process() {
  return { pid: 1234, parentPid: 1, startTimeTicks: "99", executable: "/opt/cft/chrome" };
}

function network(index: number) {
  return {
    requestId: String(index),
    sessionId: "page-session",
    targetId: "page-target",
    targetType: "page",
    url: `http://127.0.0.1:8123/asset-${index}`,
    method: "GET",
    resourceType: "Script",
    status: 200,
    statusText: "OK",
    protocol: "http/1.1",
    mimeType: "text/javascript",
    headers: [{ name: "content-type", value: "text/javascript" }],
    fromDiskCache: false,
    fromServiceWorker: false,
    failed: false,
    errorText: null,
    body: {
      status: "supported",
      bytes: 3,
      sha256: HASH,
      sourcePath: `public/asset-${index}`,
      gitBlob: GIT,
    },
  };
}

async function scenario(
  id: string,
  mode: string,
  targets: NotebookResult["variant"][],
  variant: NotebookResult["variant"] | null,
) {
  const lifecycle = [
    {
      kind: "instrumentation-ready",
      detailJson: "{}",
      sessionId: "page-session",
      targetId: "page-target",
    },
    ...targets.flatMap((_target, index) => [
      {
        kind: "worker-created",
        detailJson: `{"index":${index}}`,
        sessionId: "page-session",
        targetId: "page-target",
      },
      {
        kind: "worker-terminated",
        detailJson: `{"index":${index}}`,
        sessionId: "page-session",
        targetId: "page-target",
      },
    ]),
  ];
  const retainedResult = variant ? await result(variant) : null;
  const resultText = retainedResult?.rawText ??
    (id === "timeout"
      ? "Stopped after 120 seconds"
      : id === "cancel"
      ? "No result retained."
      : "Running…");
  const resultTextSha256 = await sha256Hex(new TextEncoder().encode(resultText));
  const finalStatus = variant
    ? "Complete. Every returned value matched the independent reference."
    : id === "timeout"
    ? "Failed: Stopped after 120 seconds"
    : id === "cancel"
    ? "Cancelled. The worker and in-memory database were discarded."
    : "Binding the runtime to verified response bytes…";
  return {
    id,
    mode,
    targetSequence: targets,
    ownership: {
      browserContextId: "context-1",
      pageTargetId: "page-target",
      pageSessionId: "page-session",
      sessions: [
        { sessionId: "page-session", targetId: "page-target", type: "page", parentSessionId: null },
        {
          sessionId: "worker-session",
          targetId: "worker-target",
          type: "worker",
          parentSessionId: "page-session",
        },
      ],
    },
    statusHistory: ["Ready.", finalStatus],
    finalState: {
      status: finalStatus,
      resultTextSha256,
      bodyTextSha256: HASH,
      startDisabled: false,
      cancelDisabled: true,
      progress: variant ? 4 : 0,
    },
    ...(retainedResult ? { result: retainedResult } : {}),
    lifecycle: { events: lifecycle, assertions: [`${id} causal assertion`] },
    executionAudits: variant
      ? Array.from({ length: 3 }, (_, index) => ({
        kind: "blob-created",
        sessionId: index === 0 ? "page-session" : "worker-session",
        targetId: index === 0 ? "page-target" : "worker-target",
        url: `blob:http://127.0.0.1:8123/${index}`,
        mimeType: "text/javascript",
        bytes: 3,
        sha256: HASH,
        base64: "YWJj",
      }))
      : [],
    console: [
      {
        sessionId: "worker-session",
        targetId: "worker-target",
        targetType: "worker",
        type: "log",
        arguments: ["observed"],
      },
      {
        sessionId: "page-session",
        targetId: "page-target",
        targetType: "page",
        type: "log",
        arguments: ["observed"],
      },
    ],
    exceptions: [],
    network: [network(1), network(2), network(3)],
    accessibility: {
      inspectedBy: "Accessibility.getFullAXTree",
      visibleStatus: finalStatus,
      visibleResultTextSha256: resultTextSha256,
      resultDigestExposed: variant !== null,
      matchingNodes: [{ role: "status", nameSha256: HASH }],
      assertions: variant
        ? ["visible status is exposed", "full-result digest is exposed"]
        : ["visible status is exposed"],
    },
    screenshot: { path: `screenshots/${id}.png`, bytes: 100, sha256: HASH },
  };
}

async function fixture() {
  const launchArguments = [
    ...STATIC_LAUNCH_ARGUMENTS,
    "--remote-debugging-port=9222",
    "--user-data-dir=/tmp/wasm-sqlite-notebook-chrome-unit",
    "about:blank",
  ];
  return {
    schemaVersion: 1,
    workload: "database.sqlite-notebook.v1",
    evidenceId: "database-sqlite-notebook-browser-abcdef123456",
    collectedAt: "2026-08-03T12:00:00Z",
    source: {
      head: GIT,
      tree: GIT,
      acceptedParentCommit: "3a49f34aa7bd226ade54001fd503c346b4e4883c",
      root: "/source",
      initialClean: true,
      collector: {
        path: "scripts/collect-sqlite-notebook-browser-evidence.ts",
        bytes: 100,
        sha256: HASH,
        headBytesMatch: true,
      },
      files: Array.from({ length: 17 }, (_, index) => ({
        route: `/asset-${index}`,
        path: index === 16 ? "server.ts#sqliteNotebookTrustRoot" : `public/asset-${index}`,
        bytes: 3,
        sha256: HASH,
        gitBlob: GIT,
        headBytesMatch: true,
      })),
      endRecheck: {
        status: "clean",
        head: GIT,
        tree: GIT,
        filesMatch: true,
        collectorMatches: true,
        checkedAt: "2026-08-03T12:10:00Z",
      },
    },
    browser: {
      product: EXPECTED_PRODUCT,
      revision: "revision",
      userAgent: "Mozilla/5.0 Chrome/150.0.7871.24",
      jsVersion: "15.0",
      executable: {
        path: "/opt/cft/chrome",
        bytes: 281758968,
        sha256: EXPECTED_EXECUTABLE_SHA256,
      },
      launchArguments,
      effectiveArguments: ["/opt/cft/chrome", ...launchArguments],
      headless: true,
      protocol: "Chrome DevTools Protocol",
      debuggerOrigin: "http://127.0.0.1:9222",
      profile: {
        path: "/tmp/wasm-sqlite-notebook-chrome-unit",
        dev: 1,
        ino: 2,
        mode: 448,
        initiallyEmpty: true,
      },
      cgroup: {
        unit: "wasm-sqlite-notebook-abcdef0123456789.service",
        path: "/sys/fs/cgroup/user.slice/unit",
        dev: 1,
        ino: 2,
        controlGroup: "/user.slice/unit",
        invocationId: "c".repeat(32),
        mainPid: 1234,
        snapshots: Array.from({ length: 9 }, (_, index) => ({
          at: `2026-08-03T12:0${index}:00Z`,
          pids: [1234],
        })),
      },
      processes: [process()],
    },
    server: {
      origin: "http://127.0.0.1:8123",
      host: "127.0.0.1",
      mode: "public",
      launcher: process(),
    },
    scenarios: [
      await scenario(
        "complete-javascript",
        "normal",
        ["javascript-controlled"],
        "javascript-controlled",
      ),
      await scenario(
        "complete-wasm",
        "normal",
        ["linear-wasm-controlled"],
        "linear-wasm-controlled",
      ),
      await scenario(
        "wrong-token",
        "wrong-token",
        ["javascript-controlled"],
        "javascript-controlled",
      ),
      await scenario("stale-after-restart", "stale", [
        "javascript-controlled",
        "linear-wasm-controlled",
      ], "linear-wasm-controlled"),
      await scenario(
        "restart",
        "normal",
        ["javascript-controlled", "linear-wasm-controlled"],
        "linear-wasm-controlled",
      ),
      await scenario("timeout", "timeout", ["linear-wasm-controlled"], null),
      await scenario("cancel", "cancel", ["javascript-controlled"], null),
      await scenario("pagehide", "pagehide", ["linear-wasm-controlled"], null),
    ],
    cleanup: {
      sessionTargets: {
        outcome: "success",
        browserContextId: "context-1",
        targetsBefore: [],
        targetsAfter: [],
      },
      cgroup: { outcome: "success", killed: true, remainingPids: [] },
      browserProcesses: { outcome: "success", remainingPids: [] },
      profile: {
        outcome: "success",
        path: "/tmp/wasm-sqlite-notebook-chrome-unit",
        absent: true,
      },
      server: { outcome: "success", processAbsent: true },
      output: { outcome: "success", path: "/tmp/sqlite-browser-evidence", retained: true },
    },
  };
}

Deno.test("SQLite notebook browser evidence schema accepts the exact eight-scenario semantic record", async () => {
  const validate = await schemaValidator();
  const value = await fixture();
  assert(validate(value), JSON.stringify((validate.errors as unknown[] | undefined)?.slice(0, 12)));
  assertEquals(value.scenarios.map((entry) => entry.id), [
    "complete-javascript",
    "complete-wasm",
    "wrong-token",
    "stale-after-restart",
    "restart",
    "timeout",
    "cancel",
    "pagehide",
  ]);
});

Deno.test("SQLite notebook evidence rejects browser, source, semantic, lifecycle, and cleanup negatives", async () => {
  const validate = await schemaValidator();
  const mutations: Array<(value: Awaited<ReturnType<typeof fixture>>) => void> = [
    (value) => Object.assign(value, { fabricated: true }),
    (value) => Object.assign(value.browser, { product: "Chrome/151.0.0.0" }),
    (value) => Object.assign(value.browser.executable, { sha256: HASH }),
    (value) => value.browser.launchArguments.splice(0, 1),
    (value) => Object.assign(value.source.endRecheck, { status: "dirty" }),
    (value) => Object.assign(value.source.endRecheck, { filesMatch: false }),
    (value) => value.source.files.pop(),
    (value) => value.scenarios.reverse(),
    (value) => value.scenarios.pop(),
    (value) => delete (value.scenarios[0] as Record<string, unknown>).result,
    (value) => Object.assign(value.scenarios[0].result!, { queryCount: 7 }),
    (value) => Object.assign(value.scenarios[0].result!, { resultRowCount: 743 }),
    (value) => Object.assign(value.scenarios[0].result!, { completeOutputSha256: HASH }),
    (value) => value.scenarios[0].result!.exactChecks.pop(),
    (value) => value.scenarios[0].result!.results[4].rows.pop(),
    (value) => Object.assign(value.scenarios[0].result!.results[0].rows[0], { timingMs: 0 }),
    (value) => Object.assign(value.scenarios[0].result!.counters, { scans: 13 }),
    (value) => Object.assign(value.scenarios[0].result!.counters, { "boundary-crossings": 2 }),
    (value) => value.scenarios[0].ownership.sessions.pop(),
    (value) => Object.assign(value.scenarios[0].network[0], { fromDiskCache: true }),
    (value) => Object.assign(value.scenarios[0].network[0], { fromServiceWorker: true }),
    (value) => Object.assign(value.scenarios[0].network[0], { body: null }),
    (value) => (value.scenarios[0].exceptions as unknown[]).push({ fabricated: true }),
    (value) => Object.assign(value.scenarios[0].accessibility, { resultDigestExposed: false }),
    (value) => value.scenarios[0].accessibility.matchingNodes.splice(0),
    (value) => Object.assign(value.cleanup.cgroup, { remainingPids: [1234] }),
    (value) => Object.assign(value.cleanup.profile, { absent: false }),
    (value) => Object.assign(value.cleanup.sessionTargets, { targetsAfter: ["survivor"] }),
    (value) => Object.assign(value.cleanup.server, { processAbsent: false }),
  ];
  for (const mutate of mutations) {
    const value = structuredClone(await fixture());
    mutate(value);
    assert(
      !validate(value),
      `negative evidence unexpectedly passed: ${JSON.stringify(validate.errors)}`,
    );
  }
});

Deno.test("semantic validator rejects cross-field oracle, ownership, raw, UI, and engine contradictions", async () => {
  const expected = await referenceResults();
  const baseline = await fixture();
  await assertEvidenceSemantics(baseline, expected);
  const mutations: Array<{
    name: string;
    mutate: (value: Awaited<ReturnType<typeof fixture>>) => void;
  }> = [
    {
      name: "oracle row/hash",
      mutate: (value) => {
        value.scenarios[0].result!.results[0].rows[0].gross_cents = 1;
      },
    },
    {
      name: "raw visible result",
      mutate: (value) => {
        value.scenarios[0].result!.rawText = value.scenarios[0].result!.rawText.replace(
          "Queries: 8",
          "Queries: 7",
        );
      },
    },
    {
      name: "raw response/source hash",
      mutate: (value) =>
        Object.assign(value.scenarios[0].network[0].body, { sha256: "c".repeat(64) }),
    },
    {
      name: "source/end identity",
      mutate: (value) => Object.assign(value.source.endRecheck, { head: "c".repeat(40) }),
    },
    {
      name: "cgroup identity",
      mutate: (value) => Object.assign(value.browser.cgroup, { path: "/sys/fs/cgroup/other" }),
    },
    {
      name: "cgroup process membership",
      mutate: (value) => value.browser.cgroup.snapshots[0].pids.push(9999),
    },
    {
      name: "session/target identity",
      mutate: (value) => Object.assign(value.scenarios[0].network[0], { targetId: "other" }),
    },
    {
      name: "lifecycle kind",
      mutate: (value) =>
        Object.assign(value.scenarios[0].lifecycle.events[0], { kind: "fabricated" }),
    },
    {
      name: "final/visible status",
      mutate: (value) =>
        Object.assign(value.scenarios[0].accessibility, { visibleStatus: "Ready." }),
    },
    {
      name: "console error",
      mutate: (value) => Object.assign(value.scenarios[0].console[0], { type: "error" }),
    },
    {
      name: "external network URL",
      mutate: (value) =>
        Object.assign(value.scenarios[0].network[0], { url: "http://example.com/x" }),
    },
    {
      name: "AX digest",
      mutate: (value) =>
        Object.assign(value.scenarios[0].accessibility, { resultDigestExposed: false }),
    },
    {
      name: "screenshot assignment",
      mutate: (value) =>
        Object.assign(value.scenarios[0].screenshot, { path: "screenshots/complete-wasm.png" }),
    },
    {
      name: "result engine",
      mutate: (value) =>
        Object.assign(value.scenarios[0].result!, { engine: "SQLite linear-wasm 3.53.0" }),
    },
    {
      name: "effective argument extra",
      mutate: (value) => value.browser.effectiveArguments.push("--js-flags=--jitless"),
    },
  ];
  for (const { name, mutate } of mutations) {
    const changed = structuredClone(baseline);
    mutate(changed);
    await assertRejects(
      () => assertEvidenceSemantics(changed, expected),
      "",
    ).catch((error) => {
      throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
});

Deno.test("parent result gate requires all eight queries, 744 rows, exact output, counters, and 15 byte checks", async () => {
  const actual = await result("javascript-controlled");
  const runtimeHashes = new Map(actual.exactChecks.map((entry) => [entry.id, entry.sha256]));
  assertCompleteResult(actual, await referenceResults(), runtimeHashes);
  for (
    const mutate of [
      (value: NotebookResult) => value.results[0].rows.pop(),
      (value: NotebookResult) => value.exactChecks.pop(),
      (value: NotebookResult) => value.counters.scans = 13,
      (value: NotebookResult) => value.completeOutputSha256 = HASH,
      (value: NotebookResult) => value.resultRowCount = 743,
    ]
  ) {
    const changed = structuredClone(actual);
    mutate(changed);
    await assertRejects(
      () => Promise.resolve(assertCompleteResult(changed, actual.results, runtimeHashes)),
      "",
    );
  }
});

Deno.test("CfT contract is exact and explicitly retains --enable-automation", async () => {
  const args = [
    ...STATIC_LAUNCH_ARGUMENTS,
    "--remote-debugging-port=9222",
    "--user-data-dir=/tmp/wasm-sqlite-notebook-chrome-test",
    "about:blank",
  ];
  assertEquals(args[0], "--enable-automation");
  assertBrowserContract(EXPECTED_PRODUCT, EXPECTED_EXECUTABLE_SHA256, args, ["chrome", ...args]);
  for (
    const [product, hash, changed] of [
      ["Chrome/151.0.0.0", EXPECTED_EXECUTABLE_SHA256, args],
      [EXPECTED_PRODUCT, HASH, args],
      [EXPECTED_PRODUCT, EXPECTED_EXECUTABLE_SHA256, args.slice(1)],
      [EXPECTED_PRODUCT, EXPECTED_EXECUTABLE_SHA256, [...args, "--extra"]],
    ] as const
  ) {
    await assertRejects(
      () =>
        Promise.resolve(assertBrowserContract(product, hash, [...changed], ["chrome", ...changed])),
      "",
    );
  }
  await assertRejects(
    () =>
      Promise.resolve(
        assertBrowserContract(
          EXPECTED_PRODUCT,
          EXPECTED_EXECUTABLE_SHA256,
          args,
          ["chrome", ...args, "--js-flags=--jitless"],
        ),
      ),
    "effective Chrome arguments differ",
  );
  assertEquals(
    parseOptions(["--chrome=/opt/cft/chrome", "--output-dir=/tmp/evidence"]),
    { chrome: "/opt/cft/chrome", outputDir: "/tmp/evidence" },
  );
  await assertRejects(() => Promise.resolve(parseOptions([])), "usage");
});

Deno.test("collector source hardens cgroup, target/session, raw/executed bytes, lifecycle, AX, and cleanup without launching Chrome", async () => {
  const source = await Deno.readTextFile(
    "scripts/collect-sqlite-notebook-browser-evidence.ts",
  );
  for (
    const required of [
      "Chrome/150.0.7871.24",
      EXPECTED_EXECUTABLE_SHA256,
      '"--enable-automation"',
      'from "ajv-formats"',
      "addFormats(ajv)",
      "assertEvidenceSemantics(evidence, reference.results)",
      '"status",\n    "--porcelain=v1"',
      '"rev-parse", "HEAD^{tree}"',
      "endRecheck",
      "frozen clean-HEAD bytes",
      "source HEAD/tree/bytes changed during browser collection",
      "/usr/bin/systemd-run",
      "KillMode=control-group",
      "cgroup.kill",
      "unresolved owned cgroup cleanup evidence after systemd-run",
      '"--kill-whom=all"',
      "unresolved owned browser process identity evidence after exact unit kill",
      "Target.createBrowserContext",
      "Target.disposeBrowserContext",
      "Target.getTargetInfo",
      "ownedSessions",
      "Network.getResponseBody",
      "raw response differs from frozen clean HEAD",
      "WORKER_INSTRUMENTATION",
      "wasm-instantiated",
      "executed Blob bytes omitted AlaSQL",
      "executed module bytes omitted",
      'id: "complete-javascript"',
      'id: "complete-wasm"',
      'id: "wrong-token"',
      'id: "stale-after-restart"',
      'id: "restart"',
      'id: "timeout"',
      'id: "cancel"',
      'id: "pagehide"',
      "stale prior-worker result and error",
      "wrong-token completion mutated visible state",
      "Page.captureScreenshot",
      "Accessibility.getFullAXTree",
      "failure.v1.json",
      "profile retained because process containment cleanup failed",
    ]
  ) assert(source.includes(required), `collector omitted hardened contract: ${required}`);
  for (const forbidden of ["puppeteer", "playwright", "pkill", "killall", "Deno.kill(-1"]) {
    assert(
      !source.includes(forbidden),
      `collector contains forbidden global/browser driver: ${forbidden}`,
    );
  }
});

Deno.test("browser evidence schema closes every declared object and freezes semantic cardinalities", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/sqlite-notebook-browser-evidence.schema.json"),
  );
  const open: string[] = [];
  const visit = (value: unknown, path: string) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}/${index}`));
      return;
    }
    const record = value as Record<string, unknown>;
    if (
      record.type === "object" && record.additionalProperties !== false &&
      !path.includes("/allOf/")
    ) open.push(path);
    for (const [key, entry] of Object.entries(record)) visit(entry, `${path}/${key}`);
  };
  visit(schema, "#");
  assertEquals(open, []);
  assertEquals(schema.properties.scenarios.minItems, 8);
  assertEquals(schema.properties.scenarios.maxItems, 8);
  assertEquals(schema.$defs.result.properties.queryCount.const, 8);
  assertEquals(schema.$defs.result.properties.resultRowCount.const, 744);
  assertEquals(schema.$defs.query5.properties.rows.minItems, 512);
  assertEquals(schema.$defs.browser.properties.product.const, EXPECTED_PRODUCT);
  assertEquals(schema.$defs.executable.properties.sha256.const, EXPECTED_EXECUTABLE_SHA256);
});

import Ajv2020Module from "ajv2020";
import { sha256Hex } from "../lib/canonical.ts";
import {
  assertProtobufBrowserEvidenceSemantics,
  buildProtobufParentOracle,
  PROTOBUF_CFT,
  PROTOBUF_EXPECTED_COUNTERS,
  PROTOBUF_ROUTE_HASHES,
  PROTOBUF_SEMANTIC_CHECKS,
  PROTOBUF_SOURCE,
} from "../lib/protobuf-browser-evidence.ts";
import {
  generateFixture,
  runJavaScript,
  runWasm,
} from "../benchmarks/base/serialization-protobuf-gateway/workload.js";
import { assert, assertEquals, assertRejects } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = ((Ajv2020Module as unknown as { default?: AjvConstructor }).default ??
  Ajv2020Module) as unknown as AjvConstructor;

const jsCounters = {
  ...PROTOBUF_EXPECTED_COUNTERS,
  allocations: 41_705,
  boundaryCrossings: 0,
};
const wasmCounters = {
  ...PROTOBUF_EXPECTED_COUNTERS,
  allocations: 0,
  boundaryCrossings: 1,
};

function network(sessionId: string) {
  return Object.entries(PROTOBUF_ROUTE_HASHES).map(([path, hash], index) => ({
    requestId: `request-${index}`,
    sessionId,
    targetType: index < 3 ? "page" : "worker",
    url: `http://127.0.0.1:43123${path}`,
    path,
    method: "GET",
    status: 200,
    mimeType: path.endsWith(".wasm") ? "application/wasm" : "text/plain",
    encodedDataLength: 100,
    fromDiskCache: false,
    fromServiceWorker: false,
    failed: false,
    errorText: null,
    responseBodyBytes: 100,
    responseBodySha256: hash,
  }));
}

function scenario(target: "javascript" | "wasm") {
  const id = `${target}-exact`;
  const sessionId = `${target}-page-session`;
  return {
    id,
    target,
    mode: "exact",
    targetId: `${target}-page-target`,
    sessionId,
    workerSessionIds: [`${target}-worker-session`],
    finalStatus: "complete",
    lifecycle: ["ready", "running", "complete", "worker-absent"],
    result: {
      target,
      mode: "exact",
      digest: "4539813029587b58d20441ef6b95174dc86c2546b0becbf23ca1b48a6f0c8c9a",
      outputBytes: 354_976,
      counters: {
        javascript: target === "javascript" ? jsCounters : null,
        wasm: target === "wasm" ? wasmCounters : null,
      },
      exact: {
        verifiedRawBytes: 6,
        catalogSha256: "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4",
      },
    },
    assertions: [
      "visible Start control entered running state",
      "fresh module worker completed",
      "worker target detached after completion",
      "exact source and artifact hashes passed",
      "complete 10000-message output oracle matched",
      "exact work counters matched",
      "all observed response bodies matched accepted raw bytes",
      "no console errors, exceptions, or error logs",
      "accessibility tree and screenshot retained",
    ],
    network: network(sessionId),
    console: [],
    exceptions: [],
    logs: [],
    accessibility: {
      path: `raw/protobuf-browser-evidence/protobuf-gateway-ae8e0c9-${
        "a".repeat(32)
      }/accessibility/${id}.json`,
      bytes: 200,
      sha256: "b".repeat(64),
      nodeCount: 12,
    },
    screenshot: {
      path: `raw/protobuf-browser-evidence/protobuf-gateway-ae8e0c9-${
        "a".repeat(32)
      }/screenshots/${id}.png`,
      bytes: 300,
      sha256: "c".repeat(64),
    },
  };
}

function parentOracle() {
  return {
    fixture: {
      messages: 10_000,
      bytes: 1_534_122,
      sha256: "624f17efb27799018a020cec7337c2d365d48a9d2995bf39a2c5bcff325a883a",
    },
    output: {
      bytes: 354_976,
      sha256: "4539813029587b58d20441ef6b95174dc86c2546b0becbf23ca1b48a6f0c8c9a",
    },
    enumWireCounts: { "-1": 20, "0": 2486, "1": 2485, "2": 2485, "3": 2486, "99": 38 },
    negativeUnknownEnum: { value: -1, occurrences: 20, varintBytesEach: 10 },
    counters: PROTOBUF_EXPECTED_COUNTERS,
    targetBoundaryCrossings: { javascript: 0, wasm: 1 },
    targetAllocations: { javascript: 41_705, wasm: 0 },
    checks: [...PROTOBUF_SEMANTIC_CHECKS],
  };
}

function evidence(): Record<string, unknown> {
  const profile = `/tmp/wasm-vs-js-owned-profiles/protobuf-${"a".repeat(32)}/launch`;
  const launchArguments = [
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-crash-reporter",
    "--disable-breakpad",
    ...PROTOBUF_CFT.extraArguments,
    "about:blank",
  ];
  return {
    schemaVersion: 1,
    evidenceId: `protobuf-gateway-ae8e0c9-${"a".repeat(32)}`,
    collectedAt: "2026-08-03T12:00:00.000Z",
    collectionCommand: "deno task --config deno.corpus.json protobuf:collect-browser-evidence",
    source: { ...PROTOBUF_SOURCE, routeHashes: PROTOBUF_ROUTE_HASHES },
    browser: {
      channel: PROTOBUF_CFT.channel,
      product: PROTOBUF_CFT.product,
      version: PROTOBUF_CFT.version,
      revision: "r123",
      userAgent: "Mozilla/5.0 Chrome/150.0.7871.24",
      jsVersion: "15.0",
      sourceExecutable: PROTOBUF_CFT.sourceExecutable,
      resolvedExecutable: `/tmp/wasm-vs-js-staged-chrome/protobuf-${"a".repeat(32)}/chrome`,
      binarySha256: PROTOBUF_CFT.binarySha256,
      packageManifestSha256: PROTOBUF_CFT.packageManifestSha256,
      launchArguments,
      effectiveArguments: launchArguments,
      protocol: "Chrome DevTools Protocol",
    },
    server: {
      origin: "http://127.0.0.1:43123",
      mode: "public",
      sourceCheckout: "/tmp/wasm-vs-js-protobuf-source/protobuf-source-test/source",
      sessionOwnedByCollector: true,
    },
    parentOracle: parentOracle(),
    scenarios: [scenario("javascript"), scenario("wasm")],
    ownership: {
      unit: `wasm-vs-js-${"a".repeat(32)}.service`,
      controlGroup: "/user.slice/owned.service",
      invocationId: "d".repeat(32),
      cgroupDev: 29,
      cgroupIno: 41,
      mainPid: 700,
      members: [700, 701],
      membershipSnapshots: [{ collectedAt: "2026-08-03T12:00:01.000Z", members: [700, 701] }],
    },
    cleanup: {
      browserCgroupEmpty: true,
      remainingPids: [],
      profileAbsent: true,
      chromeStageAbsent: true,
      serverStopped: true,
      sourceCheckoutAbsent: true,
      stoppedAt: "2026-08-03T12:01:00.000Z",
    },
  };
}

Deno.test("protobuf parent oracle independently proves complete adversarial corpus and both targets", async () => {
  const fixture = generateFixture();
  const javascript = runJavaScript(fixture);
  const wasm = await runWasm(
    fixture,
    await Deno.readFile(
      "public/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm",
    ),
  );
  const oracle = await buildProtobufParentOracle(fixture, javascript, wasm);
  assertEquals(oracle, parentOracle());
  assertEquals((oracle.enumWireCounts as Record<string, number>)["1"], 2485);
  assertEquals((oracle.enumWireCounts as Record<string, number>)["99"], 38);
  assertEquals(oracle.negativeUnknownEnum, { value: -1, occurrences: 20, varintBytesEach: 10 });
});

Deno.test("protobuf browser evidence schema and semantic gate accept only complete closed evidence", async () => {
  const schema = JSON.parse(
    await Deno.readTextFile("schemas/protobuf-browser-evidence.schema.json"),
  );
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  const accepted = evidence();
  assert(validate(accepted), JSON.stringify(validate.errors));
  assertProtobufBrowserEvidenceSemantics(accepted);

  const additions: Array<[string, (copy: Record<string, unknown>) => void]> = [
    ["top", (copy) => copy.untrusted = true],
    ["browser", (copy) => ((copy.browser as Record<string, unknown>).untrusted = true)],
    [
      "scenario",
      (copy) => ((copy.scenarios as Array<Record<string, unknown>>)[0].untrusted = true),
    ],
    [
      "result",
      (
        copy,
      ) => (((copy.scenarios as Array<Record<string, unknown>>)[0].result as Record<
        string,
        unknown
      >).untrusted = true),
    ],
    [
      "network",
      (
        copy,
      ) => (((copy.scenarios as Array<Record<string, unknown>>)[0].network as Array<
        Record<string, unknown>
      >)[0].untrusted = true),
    ],
    ["cleanup", (copy) => ((copy.cleanup as Record<string, unknown>).untrusted = true)],
  ];
  for (const [label, mutate] of additions) {
    const copy = structuredClone(accepted);
    mutate(copy);
    assert(!validate(copy), `${label} additional property passed closed schema`);
  }
});

Deno.test("protobuf semantic gate rejects source end raw-byte counter lifecycle and cleanup contradictions", async () => {
  const cases: Array<[string, (copy: Record<string, unknown>) => void]> = [
    ["source", (copy) => ((copy.source as Record<string, unknown>).commit = "0".repeat(40))],
    [
      "CfT hash",
      (copy) => ((copy.browser as Record<string, unknown>).binarySha256 = "0".repeat(64)),
    ],
    ["automation argument", (copy) => {
      const browser = copy.browser as Record<string, unknown>;
      browser.launchArguments = (browser.launchArguments as string[]).filter((arg) =>
        arg !== "--enable-automation"
      );
    }],
    ["effective arguments", (copy) => {
      const browser = copy.browser as Record<string, unknown>;
      browser.effectiveArguments = (browser.effectiveArguments as string[]).filter((arg) =>
        arg !== "--enable-automation"
      );
    }],
    [
      "negative int32 width",
      (
        copy,
      ) => ((copy.parentOracle as Record<string, unknown>).negativeUnknownEnum = {
        value: -1,
        occurrences: 20,
        varintBytesEach: 5,
      }),
    ],
    ["target denominator", (copy) => (copy.scenarios as Array<Record<string, unknown>>).reverse()],
    [
      "output",
      (
        copy,
      ) => (((copy.scenarios as Array<Record<string, unknown>>)[0].result as Record<
        string,
        unknown
      >).digest = "0".repeat(64)),
    ],
    ["counter", (copy) => {
      const counters =
        (((copy.scenarios as Array<Record<string, unknown>>)[0].result as Record<string, unknown>)
          .counters as Record<string, unknown>).javascript as Record<string, number>;
      counters.fields--;
    }],
    [
      "raw response",
      (
        copy,
      ) => (((copy.scenarios as Array<Record<string, unknown>>)[0].network as Array<
        Record<string, unknown>
      >)[0].responseBodySha256 = "0".repeat(64)),
    ],
    [
      "lifecycle",
      (
        copy,
      ) => ((copy.scenarios as Array<Record<string, unknown>>)[0].lifecycle = [
        "ready",
        "complete",
      ]),
    ],
    [
      "exception",
      (
        copy,
      ) => ((copy.scenarios as Array<Record<string, unknown>>)[0].exceptions = [{ text: "boom" }]),
    ],
    ["ownership", (copy) => ((copy.ownership as Record<string, unknown>).members = [701])],
    ["cleanup", (copy) => ((copy.cleanup as Record<string, unknown>).profileAbsent = false)],
  ];
  for (const [label, mutate] of cases) {
    const copy = structuredClone(evidence());
    mutate(copy);
    await assertRejects(
      () => Promise.resolve().then(() => assertProtobufBrowserEvidenceSemantics(copy)),
      "",
    ).catch((error) => {
      throw new Error(`${label} contradiction was not rejected: ${error}`);
    });
  }
});

Deno.test("protobuf collector is source-pinned parent orchestration with cgroup, session, exhaustive evidence, and protected cleanup", async () => {
  const collector = await Deno.readTextFile("scripts/collect-protobuf-browser-evidence.ts");
  const contract = await Deno.readTextFile("lib/protobuf-browser-evidence.ts");
  const config = JSON.parse(await Deno.readTextFile("deno.corpus.json"));
  const task = config.tasks["protobuf:collect-browser-evidence"] as string;
  for (
    const text of [
      "stageChromePackage(",
      "launchOwnedChrome(",
      "recordStageCleanupLifecycle",
      "closeOwnedChrome(",
      "removeStagedChrome(",
      "PROTOBUF_CFT.extraArguments",
      '"Target.setAutoAttach"',
      '"Fetch.getResponseBody"',
      '"Runtime.consoleAPICalled"',
      '"Runtime.exceptionThrown"',
      '"Log.entryAdded"',
      '"Accessibility.getFullAXTree"',
      '"Page.captureScreenshot"',
      '"worker-absent"',
      "buildProtobufParentOracle",
      "assertProtobufBrowserEvidenceSemantics",
    ]
  ) assert(collector.includes(text), `collector omitted ${text}`);
  assert(collector.includes("Deno.args.length !== 0"));
  assert(contract.includes('"--enable-automation"'));
  assertEquals(PROTOBUF_CFT.extraArguments[0], "--enable-automation");
  assert(!collector.includes("google-chrome --"));
  assert(
    task.startsWith(
      "SERVER_MODE=public deno run --no-lock --no-prompt --allow-env=SERVER_MODE",
    ),
  );
  assert(task.includes("--no-prompt"));
  assert(
    task.includes(
      "--allow-write=raw,/tmp/wasm-vs-js-protobuf-source,/tmp/wasm-vs-js-owned-profiles,/tmp/wasm-vs-js-staged-chrome,",
    ),
  );
  assert(!task.includes("--allow-write=/tmp"));
  assert(!task.includes("--allow-write=/sys/fs/cgroup"));
  assert(
    task.includes("/sys/fs/cgroup/user.slice/user-$(id -u).slice/user@$(id -u).service/app.slice"),
  );

  const commit = decoder(
    await new Deno.Command("git", {
      args: ["rev-parse", `${PROTOBUF_SOURCE.commit}^{commit}`],
      stdout: "piped",
    }).output(),
  );
  const tree = decoder(
    await new Deno.Command("git", {
      args: ["rev-parse", `${PROTOBUF_SOURCE.commit}^{tree}`],
      stdout: "piped",
    }).output(),
  );
  assertEquals(commit, PROTOBUF_SOURCE.commit);
  assertEquals(tree, PROTOBUF_SOURCE.tree);
  for (const [path, expected] of Object.entries(PROTOBUF_ROUTE_HASHES)) {
    const file = ({
      "/benchmarks/serialization-protobuf-gateway/":
        "public/benchmarks/serialization-protobuf-gateway/index.html",
      "/benchmarks/serialization-protobuf-gateway/protobuf-runner.js":
        "public/benchmarks/serialization-protobuf-gateway/protobuf-runner.js",
      "/benchmarks/serialization-protobuf-gateway/protobuf-worker.js":
        "public/benchmarks/serialization-protobuf-gateway/protobuf-worker.js",
      "/benchmarks/base/serialization-protobuf-gateway/workload.js":
        "benchmarks/base/serialization-protobuf-gateway/workload.js",
      "/benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json":
        "benchmarks/base/serialization-protobuf-gateway/implementation-contract.v1.json",
      "/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm":
        "public/artifacts/serialization-protobuf-gateway/serialization-protobuf-gateway.wasm",
      "/artifacts/serialization-protobuf-gateway/fixture-manifest.json":
        "public/artifacts/serialization-protobuf-gateway/fixture-manifest.json",
      "/artifacts/serialization-protobuf-gateway/output-manifest.json":
        "public/artifacts/serialization-protobuf-gateway/output-manifest.json",
      "/artifacts/serialization-protobuf-gateway/build-manifest.json":
        "public/artifacts/serialization-protobuf-gateway/build-manifest.json",
      "/styles.css": "public/styles.css",
      "/favicon.ico": "public/favicon.svg",
    } as Record<string, string>)[path];
    const shown = await new Deno.Command("git", {
      args: ["show", `${PROTOBUF_SOURCE.commit}:${file}`],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(shown.success, path);
    assert(await sha256Hex(shown.stdout) === expected, `${path} accepted raw-byte hash changed`);
  }
});

function decoder(output: Deno.CommandOutput): string {
  assert(output.success);
  return new TextDecoder().decode(output.stdout).trim();
}

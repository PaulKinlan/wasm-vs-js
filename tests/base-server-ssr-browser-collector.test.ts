import Ajv2020Module from "ajv2020";
import { assert, assertEquals } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = Ajv2020Module as unknown as AjvConstructor;
const schemaPath = "schemas/base-server-ssr-browser-evidence.schema.json";
const collectorPath = "scripts/collect-base-server-ssr-evidence.ts";
const chromeStagePath = "lib/chrome-stage.ts";

function record(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

Deno.test("server SSR browser-evidence schema compiles and closes every retained record", async () => {
  const schema = JSON.parse(await Deno.readTextFile(schemaPath));
  new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  assertEquals(schema.additionalProperties, false);

  const defs = schema.$defs as Record<string, Record<string, unknown>>;
  for (
    const name of [
      "fileRecord",
      "source",
      "packageSource",
      "browser",
      "preflightRecord",
      "server",
      "instrumentation",
      "pageState",
      "counters",
      "responseDigest",
      "routeRender",
      "eventData",
      "eventDetail",
      "lifecycleEvent",
      "lifecycle",
      "consoleRecord",
      "exceptionRecord",
      "header",
      "networkRecord",
      "axNode",
      "accessibility",
      "screenshot",
      "scenarioBase",
      "processIdentity",
      "exitStatus",
      "cleanup",
      "membershipSnapshot",
    ]
  ) assertEquals(defs[name].additionalProperties, false);

  assertEquals(schema.properties.scenarios.minItems, 8);
  assertEquals(schema.properties.scenarios.maxItems, 8);
  assertEquals(schema.properties.scenarios.items, false);
  const counterProperties = record(defs.counters.properties);
  assertEquals(record(counterProperties.responses).const, 1_000);
  assertEquals(record(counterProperties["template-tokens"]).const, 23_000);
  const renderProperties = record(defs.routeRender.properties);
  assertEquals(record(renderProperties.completeOutputBytes).const, 426_192);
  assertEquals(
    record(renderProperties.completeOutputSha256).const,
    "330a49b560410f667eba4ae3baa9cce1f661201f84d7ea703a91a36835dbcedc",
  );
  const sourceProperties = record(defs.source.properties);
  assertEquals(record(sourceProperties.head).const, "802667d4690e742afd475540ab45bd43c04e6ebb");
  assertEquals(
    record(sourceProperties.headTree).const,
    "518cc6026814a456466a26d087c7278b6078a7b9",
  );
  assertEquals(
    record(sourceProperties.packageCommit).const,
    "9fbb8aa0b631e8f0ed9ca9197d4acacdb5aa6692",
  );
  const collectorProperties = record(record(sourceProperties.collector).properties);
  assertEquals(record(collectorProperties.bytes).const, 62_002);
  assertEquals(
    record(collectorProperties.sha256).const,
    "3baa3d247f2be63f29943a6944b913dafb85df23ba696eb1c39dd9c8f81ca3af",
  );

  const browserProperties = record(defs.browser.properties);
  const executableProperties = record(record(browserProperties.executable).properties);
  assertEquals(
    record(executableProperties.sha256).const,
    "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
  );
  const launch = record(browserProperties.launchArguments);
  assertEquals(launch.minItems, 20);
  assertEquals(launch.maxItems, 20);
  assertEquals(
    (launch.prefixItems as Array<Record<string, unknown>>).at(-2)?.const,
    "--enable-automation",
  );
});

Deno.test("server SSR evidence schema rejects semantic scenario, source, and network mutations", async () => {
  const schema = JSON.parse(await Deno.readTextFile(schemaPath));
  const defs = schema.$defs as Record<string, Record<string, unknown>>;
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const validatorFor = (name: string) =>
    ajv.compile({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $defs: defs,
      $ref: `#/$defs/${name}`,
    });
  const sha = "a".repeat(64);
  const scenarioMeta: Record<string, {
    id: string;
    mode: string;
    sequence: string[];
    render: string | null;
    status: string;
    output: string;
    startDisabled: boolean;
    cancelDisabled: boolean;
    assertions: string[];
  }> = {
    completeJsScenario: {
      id: "complete-js",
      mode: "normal",
      sequence: ["js-controlled"],
      render: "js-controlled",
      status: "Complete.",
      output: "rendered",
      startDisabled: false,
      cancelDisabled: true,
      assertions: [],
    },
    completeWasmScenario: {
      id: "complete-wasm",
      mode: "normal",
      sequence: ["wasm-linear-controlled"],
      render: "wasm-linear-controlled",
      status: "Complete.",
      output: "rendered",
      startDisabled: false,
      cancelDisabled: true,
      assertions: [],
    },
    restartScenario: {
      id: "restart-js-to-wasm",
      mode: "normal",
      sequence: ["js-controlled", "wasm-linear-controlled"],
      render: "wasm-linear-controlled",
      status: "Complete.",
      output: "rendered",
      startDisabled: false,
      cancelDisabled: true,
      assertions: ["two sequential starts created two fresh workers"],
    },
    wrongTokenScenario: {
      id: "wrong-token",
      mode: "wrong-token",
      sequence: ["js-controlled"],
      render: "js-controlled",
      status: "Complete.",
      output: "rendered",
      startDisabled: false,
      cancelDisabled: true,
      assertions: ["wrong-token completion was ignored"],
    },
    staleScenario: {
      id: "stale-after-restart",
      mode: "stale",
      sequence: ["js-controlled", "wasm-linear-controlled"],
      render: "wasm-linear-controlled",
      status: "Complete.",
      output: "rendered",
      startDisabled: false,
      cancelDisabled: true,
      assertions: ["terminated first-worker message was ignored after restart"],
    },
    cancelScenario: {
      id: "cancel",
      mode: "cancel",
      sequence: ["js-controlled"],
      render: null,
      status: "Cancelled. No result was retained.",
      output: "Cancelled.",
      startDisabled: false,
      cancelDisabled: true,
      assertions: ["Cancel terminated the exact held worker"],
    },
    timeoutScenario: {
      id: "timeout",
      mode: "timeout",
      sequence: ["js-controlled"],
      render: null,
      status: "Stopped: the 30 second exact-run timeout expired.",
      output: "",
      startDisabled: false,
      cancelDisabled: true,
      assertions: ["30 second timeout terminated the exact held worker"],
    },
    pagehideScenario: {
      id: "pagehide",
      mode: "pagehide",
      sequence: ["js-controlled"],
      render: null,
      status: "Running the exact 1,000-response contract in a fresh worker.",
      output: "",
      startDisabled: true,
      cancelDisabled: false,
      assertions: ["pagehide terminated the exact held worker"],
    },
  };
  const makeScenario = (name: string) => {
    const meta = scenarioMeta[name];
    const specific = (defs[name].allOf as Array<Record<string, unknown>>)[1];
    const properties = specific.properties as Record<string, Record<string, unknown>>;
    const networkSchema = properties.network;
    const network = (networkSchema.prefixItems as Array<Record<string, unknown>>).map((entry) => {
      const allOf = entry.allOf as Array<Record<string, unknown>>;
      const assetName = String(allOf[1].$ref).split("/").at(-1)!;
      const assetProperties = defs[assetName].properties as Record<string, Record<string, unknown>>;
      const route = String(assetProperties.route.const);
      const requestProperties = allOf[2].properties as Record<string, Record<string, unknown>>;
      const occurrence = Number(requestProperties.occurrence.const);
      const headerItems = (assetProperties.headers.prefixItems as Array<{
        properties: Record<string, Record<string, unknown>>;
      }>).map((header) => ({
        name: header.properties.name.const,
        value: header.properties.value.const ?? "Mon, 03 Aug 2026 14:00:00 GMT",
      }));
      return {
        context: requestProperties.context.const,
        route,
        occurrence,
        url: `http://127.0.0.1:8000${route}${
          route.endsWith("/") ? `?evidence-mode=${meta.mode}` : ""
        }`,
        method: "GET",
        resourceType: requestProperties.resourceType.const,
        status: 200,
        statusText: "OK",
        protocol: "http/1.1",
        mimeType: assetProperties.mimeType.const,
        headers: headerItems,
        fromDiskCache: false,
        fromServiceWorker: false,
        failed: false,
        errorText: null,
        bodyBytes: assetProperties.bodyBytes.const,
        bodySha256: assetProperties.bodySha256.const,
        sourcePath: assetProperties.sourcePath.const,
      };
    });
    const counters = Object.fromEntries(
      Object.entries(defs.counters.properties as Record<string, Record<string, unknown>>).map(
        ([key, value]) => [
          key,
          key === "boundary-crossings" ? (meta.render === "js-controlled" ? 0 : 1) : value.const,
        ],
      ),
    );
    const lifecycleSpecific = (properties.lifecycle.allOf as Array<Record<string, unknown>>)[1];
    const lifecycleEvents = (
      (lifecycleSpecific.properties as Record<string, Record<string, unknown>>).events
        .prefixItems as Array<Record<string, unknown>>
    ).map((entry) => {
      const eventProperties = (entry.allOf as Array<Record<string, unknown>>)[1]
        .properties as Record<string, Record<string, unknown>>;
      return {
        kind: eventProperties.kind.const,
        detail: structuredClone(eventProperties.detail.const),
      };
    });
    const routeRender = meta.render
      ? {
        target: meta.render,
        responses: 1_000,
        completeOutputSha256: "330a49b560410f667eba4ae3baa9cce1f661201f84d7ea703a91a36835dbcedc",
        completeOutputBytes: 426_192,
        counters,
        firstResponse: { bytes: 1, sha256: sha },
        lastResponse: { bytes: 1, sha256: sha },
        displayedResultText:
          `Target: ${meta.render}\nResponses: 1000\nComplete output SHA-256: 330a49b560410f667eba4ae3baa9cce1f661201f84d7ea703a91a36835dbcedc`,
        displayedResultTextSha256: sha,
        documentBodyTextSha256: sha,
      }
      : null;
    return {
      id: meta.id,
      mode: meta.mode,
      targetSequence: meta.sequence,
      finalState: {
        heading: "Render 1,000 catalog responses",
        status: meta.status,
        output: meta.output,
        bodyText: "body",
        startDisabled: meta.startDisabled,
        cancelDisabled: meta.cancelDisabled,
        target: meta.sequence.at(-1),
      },
      routeRender,
      lifecycle: {
        events: lifecycleEvents,
        assertions: meta.assertions,
      },
      console: [],
      exceptions: [],
      network,
      accessibility: {
        inspectedBy: "Accessibility.getFullAXTree",
        nodes: Array.from({ length: 5 }, (_, index) => ({
          role: "heading",
          name: `node-${index}`,
          ignored: false,
        })),
        assertions: [
          "named level-one heading present",
          "named target combobox present",
          "named Start and Cancel buttons present",
          "live status role present",
        ],
      },
      screenshot: { path: `screenshots/${meta.id}.png`, bytes: 8, sha256: sha },
    };
  };

  for (const name of Object.keys(scenarioMeta)) {
    const validate = validatorFor(name);
    const scenario = makeScenario(name);
    assert(validate(scenario), `${name} fixture invalid: ${JSON.stringify(validate.errors)}`);
  }

  const completeValidator = validatorFor("completeJsScenario");
  const missingRender = makeScenario("completeJsScenario");
  missingRender.routeRender = null;
  assertEquals(completeValidator(missingRender), false);

  const cancelValidator = validatorFor("cancelScenario");
  const retainedCancelRender = makeScenario("cancelScenario");
  retainedCancelRender.routeRender = makeScenario("completeJsScenario").routeRender;
  assertEquals(cancelValidator(retainedCancelRender), false);

  const wrongLifecycle = makeScenario("wrongTokenScenario");
  wrongLifecycle.lifecycle.events[3].kind = "worker-held";
  assertEquals(validatorFor("wrongTokenScenario")(wrongLifecycle), false);
  for (
    const [field, value] of [
      ["index", 7],
      ["url", "/wrong-worker.js"],
      ["mode", "stale"],
    ] as const
  ) {
    const mutation = makeScenario("wrongTokenScenario");
    (mutation.lifecycle.events[1].detail as Record<string, unknown>)[field] = value;
    assert(!validatorFor("wrongTokenScenario")(mutation), `accepted lifecycle ${field}`);
  }
  const wrongTarget = makeScenario("wrongTokenScenario");
  record(record(wrongTarget.lifecycle.events[2].detail).data).target = "wasm-linear-controlled";
  assertEquals(validatorFor("wrongTokenScenario")(wrongTarget), false);
  const wrongPostedToken = makeScenario("wrongTokenScenario");
  record(record(wrongPostedToken.lifecycle.events[2].detail).data).token = 2;
  assertEquals(validatorFor("wrongTokenScenario")(wrongPostedToken), false);
  const wrongDispatchedToken = makeScenario("wrongTokenScenario");
  record(wrongDispatchedToken.lifecycle.events[3].detail).token = 1;
  assertEquals(validatorFor("wrongTokenScenario")(wrongDispatchedToken), false);

  const duplicateNetwork = makeScenario("completeJsScenario");
  duplicateNetwork.network[1] = structuredClone(duplicateNetwork.network[0]);
  assertEquals(completeValidator(duplicateNetwork), false);
  const missingBody = makeScenario("completeJsScenario");
  missingBody.network[0].bodySha256 = "b".repeat(64);
  assertEquals(completeValidator(missingBody), false);
  const shortNetwork = makeScenario("completeJsScenario");
  shortNetwork.network.pop();
  assertEquals(completeValidator(shortNetwork), false);
  for (
    const [field, value] of [
      ["context", "page"],
      ["resourceType", "Document"],
      ["mimeType", "text/plain"],
    ] as const
  ) {
    const mutation = makeScenario("completeJsScenario");
    Object.assign(mutation.network[4], { [field]: value });
    assert(!completeValidator(mutation), `accepted worker network ${field}`);
  }
  const wrongHeader = makeScenario("completeJsScenario");
  wrongHeader.network[4].headers[3].value = "text/plain";
  assertEquals(completeValidator(wrongHeader), false);
  const missingHeader = makeScenario("completeJsScenario");
  missingHeader.network[4].headers.pop();
  assertEquals(completeValidator(missingHeader), false);

  const sourceValidator = validatorFor("source");
  const sourceProperties = defs.source.properties as Record<string, Record<string, unknown>>;
  const collectorProperties = sourceProperties.collector.properties as Record<
    string,
    Record<string, unknown>
  >;
  const source = {
    head: sourceProperties.head.const,
    headTree: sourceProperties.headTree.const,
    clean: true,
    packageCommit: sourceProperties.packageCommit.const,
    collector: {
      path: collectorPath,
      bytes: collectorProperties.bytes.const,
      sha256: collectorProperties.sha256.const,
      headBytesMatch: true,
    },
    packageSources: (sourceProperties.packageSources.prefixItems as Array<{ const: unknown }>).map(
      (entry) => structuredClone(entry.const),
    ),
    files: (sourceProperties.files.prefixItems as Array<{ const: unknown }>).map((entry) =>
      structuredClone(entry.const)
    ),
  };
  assert(sourceValidator(source), JSON.stringify(sourceValidator.errors));
  source.files[1] = structuredClone(source.files[0]);
  assertEquals(sourceValidator(source), false);
  for (
    const mutate of [
      (value: typeof source) => value.head = "a".repeat(40),
      (value: typeof source) => value.headTree = "b".repeat(40),
      (value: typeof source) => value.packageCommit = "c".repeat(40),
      (value: typeof source) => value.collector.bytes = Number(value.collector.bytes) + 1,
      (value: typeof source) => value.collector.sha256 = sha,
    ]
  ) {
    const mutation = structuredClone(source);
    mutation.files = (sourceProperties.files.prefixItems as Array<{ const: unknown }>).map((
      entry,
    ) => structuredClone(entry.const));
    mutate(mutation);
    assertEquals(sourceValidator(mutation), false);
  }

  const workerConsole = validatorFor("consoleRecord");
  assert(workerConsole({ context: "worker-0", type: "log", arguments: ["retained"] }));
  const workerException = validatorFor("exceptionRecord");
  assert(workerException({ context: "worker-1", text: "failure", lineNumber: 1 }));
});

Deno.test("server SSR parent collector binds clean HEAD, raw route bytes, Chrome, and loopback", async () => {
  const source = await Deno.readTextFile(collectorPath);
  for (
    const required of [
      '["status", "--porcelain=v1", "--untracked-files=all"]',
      'const collectionHead = await commandText("git", ["rev-parse", "HEAD"])',
      '"log",\n  "-1",\n  "--format=%H"',
      "executed collector bytes differ from pinned collector commit or clean HEAD",
      "differs from pinned collector commit or clean HEAD bytes",
      "registration, package pin, and package source commit are not cross-bound",
      "differs from the accepted package source commit",
      "packageCommitBytesMatch",
      "Chrome executable hash mismatch",
      "launchOwnedChrome({",
      "sourceIdentityVerifiedAtEnd: true",
      "Chrome source package changed across collection",
      'HOST: "127.0.0.1"',
      '"--remote-debugging-address=127.0.0.1"',
      '"--allow-net=127.0.0.1"',
      'Network.setCacheDisabled", { cacheDisabled: true }',
      '"Fetch.failRequest"',
      'disposition: "blocked-by-collector"',
      '"Network.getResponseBody"',
      "raw response differs from clean HEAD",
      "response.status !== 200",
      'response.headers.get("content-type")',
      "Page.captureScreenshot",
      "Accessibility.getFullAXTree",
    ]
  ) assert(source.includes(required), `collector omitted ${required}`);

  assert(source.includes("registration.fixedWork.responses !== RECORDS"));
  assert(source.includes("RECORDS !== 1_000"));
  assert(source.includes('state.heading !== "Render 1,000 catalog responses"'));
  assert(!source.includes("RECORDS !== 10_000"));
  assert(!source.includes("Render 10,000 catalog responses"));
});

Deno.test("server SSR parent collector exercises exact JS/Wasm render and lifecycle modes", async () => {
  const source = await Deno.readTextFile(collectorPath);
  for (
    const scenario of [
      'id: "complete-js"',
      'id: "complete-wasm"',
      'id: "restart-js-to-wasm"',
      'id: "wrong-token"',
      'id: "stale-after-restart"',
      'id: "cancel"',
      'id: "timeout"',
      'id: "pagehide"',
    ]
  ) assert(source.includes(scenario), `collector omitted ${scenario}`);
  for (
    const assertion of [
      "exact result text mismatch",
      "wrong-token worker message mutated visible state",
      "stale first-worker message mutated the restarted run",
      'value.status === "Cancelled. No result was retained."',
      'value.status === "Stopped: the 30 second exact-run timeout expired."',
      'event.kind === "worker-terminated"',
      "terminated ${workerTerminations.length}/${expectedTerminations} workers",
      "result.counters",
      "completeOutputSha256",
      "displayedResultText",
      "documentBodyTextSha256",
    ]
  ) assert(source.includes(assertion), `collector omitted ${assertion}`);

  const schema = JSON.parse(await Deno.readTextFile(schemaPath));
  const scenarioRefs = schema.properties.scenarios.prefixItems.map(
    (entry: { $ref: string }) => entry.$ref,
  );
  assertEquals(scenarioRefs, [
    "#/$defs/completeJsScenario",
    "#/$defs/completeWasmScenario",
    "#/$defs/restartScenario",
    "#/$defs/wrongTokenScenario",
    "#/$defs/staleScenario",
    "#/$defs/cancelScenario",
    "#/$defs/timeoutScenario",
    "#/$defs/pagehideScenario",
  ]);
});

Deno.test("server SSR collector records exact owned cleanup and refuses implicit execution", async () => {
  const source = await Deno.readTextFile(collectorPath);
  const chromeStageSource = await Deno.readTextFile(chromeStagePath);
  for (
    const required of [
      "closeOwnedChrome",
      "refreshLedger",
      "recordStageCleanupLifecycle",
      '"cleanup-unresolved"',
      "owned Chrome cgroup retained members after cleanup",
      "owned Chrome profile survived cleanup",
      "removeStagedChrome",
      "owned evidence server survived bounded exact cleanup",
      "identity-less evidence server status did not settle after SIGKILL",
      "evidence output directory already exists",
      "evidence output must be outside the source repository",
      "if (!validate(evidence))",
      "createNew: true",
      "if (!collectionComplete)",
      "evidence output cleanup unresolved",
      "Chrome stage removal unresolved",
      'client.send("Runtime.enable", {}, workerSession)',
      "!observedSessions.has(eventSession)",
      "network set/count differed from the exact contract",
    ]
  ) assert(source.includes(required), `collector omitted ${required}`);
  for (
    const required of [
      "Chrome staging failed with unresolved cleanup",
      'recordStageCleanupLifecycle(stagedForFailure, "cleanup-unresolved")',
      "incomplete Chrome stage tree removal unresolved",
      "incomplete Chrome stage owner removal unresolved",
    ]
  ) assert(chromeStageSource.includes(required), `Chrome staging omitted ${required}`);
  for (
    const forbidden of [
      "removeStagedChrome(stage).catch",
      "Deno.remove(options.outputDir, { recursive: true }).catch",
      "await serverStatusPromise?.catch",
    ]
  ) assert(!source.includes(forbidden), `collector swallows cleanup via ${forbidden}`);
  assert(
    !chromeStageSource.includes(".catch(() => {})"),
    "Chrome staging must not silently swallow setup cleanup failures",
  );

  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-read", collectorPath],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(output.success, false);
  assert(
    new TextDecoder().decode(output.stderr).includes(
      "usage: collect-base-server-ssr-evidence.ts",
    ),
  );

  const tracked = await new Deno.Command("git", {
    args: ["ls-files"],
    stdout: "piped",
  }).output();
  assert(tracked.success);
  const trackedPaths = new TextDecoder().decode(tracked.stdout).split("\n");
  assert(
    !trackedPaths.some((path) =>
      path.includes("base-server-ssr-template/browser-evidence") ||
      path.endsWith("base-server-ssr-evidence.v1.json")
    ),
    "implementation commit must not fabricate or retain Chrome evidence",
  );
});

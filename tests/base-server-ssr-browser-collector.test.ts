import Ajv2020Module from "ajv2020";
import { assert, assertEquals } from "./assert.ts";

type Validator = ((value: unknown) => boolean) & { errors?: unknown };
type AjvConstructor = new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => Validator;
};
const Ajv2020 = Ajv2020Module as unknown as AjvConstructor;
const schemaPath = "schemas/base-server-ssr-browser-evidence.schema.json";
const collectorPath = "scripts/collect-base-server-ssr-evidence.ts";

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
  const browserProperties = record(defs.browser.properties);
  const executableProperties = record(record(browserProperties.executable).properties);
  assertEquals(
    record(executableProperties.sha256).const,
    "dea3ab8fba923b718920ef9d62570824f2dc0ab0c72d66d53f91b41de6570355",
  );
});

Deno.test("server SSR parent collector binds clean HEAD, raw route bytes, Chrome, and loopback", async () => {
  const source = await Deno.readTextFile(collectorPath);
  for (
    const required of [
      '["status", "--porcelain=v1", "--untracked-files=all"]',
      'const head = await commandText("git", ["rev-parse", "HEAD"])',
      "executed collector bytes differ from clean HEAD",
      "differs from clean HEAD bytes",
      "differs from the accepted package source commit",
      "packageCommitBytesMatch",
      "Chrome executable hash mismatch",
      'webSocketUrl.hostname !== "127.0.0.1"',
      'HOST: "127.0.0.1"',
      '"--remote-debugging-address=127.0.0.1"',
      '"--allow-net=127.0.0.1"',
      'Network.setCacheDisabled", { cacheDisabled: true }',
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
  for (
    const required of [
      "startTimeTicks",
      "identityStillRunning",
      "Browser.close",
      'Deno.kill(identity.pid, "SIGTERM")',
      'Deno.kill(identity.pid, "SIGKILL")',
      "processes survived exact cleanup",
      "profile survived cleanup",
      "server survived cleanup",
      "evidence output directory already exists",
      "evidence output must be outside the source repository",
      "if (!validate(evidence))",
      "createNew: true",
      "if (!collectionComplete)",
      "Deno.remove(options.outputDir, { recursive: true })",
    ]
  ) assert(source.includes(required), `collector omitted ${required}`);

  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", collectorPath],
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

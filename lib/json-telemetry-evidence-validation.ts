import { canonicalize, sha256Hex } from "./canonical.ts";

const WORKLOAD_PATH = "benchmarks/v1/serialization-json-telemetry/workload.js";
const WORKLOAD_SHA256 = "54e2ee54b225d8454664dc6a24f5fa178ee0652ccf0e7e01eea93b17f29530f8";
// The /demos/ route now redirects; the collector navigates the canonical
// benchmark page directly so the evidence records the page under test.
const DEMO_ROUTE = "/benchmarks/serialization.json-telemetry.v1/";
const SOURCE_PATHS = [
  "public/demos/serialization.json-telemetry.v1/index.html",
  "public/styles.css",
  "public/favicon.svg",
  "public/telemetry-demo.js",
  "public/telemetry-worker.js",
  "public/telemetry-module-loader.js",
  WORKLOAD_PATH,
  "public/artifacts/serialization-json-telemetry/build-manifest.json",
  "public/artifacts/serialization-json-telemetry/fixture-manifest.json",
  "public/artifacts/serialization-json-telemetry/input-manifest.json",
  "public/artifacts/serialization-json-telemetry/output-manifest.json",
  "public/artifacts/serialization-json-telemetry/telemetry.wasm",
  "lib/canonical.ts",
  "lib/cdp-client.ts",
  "lib/json-telemetry-evidence-validation.ts",
  "scripts/collect-v1-json-telemetry-browser-evidence.ts",
] as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as Record<string, unknown>;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} is not an array`);
  return value;
}
function bytes(value: unknown, label: string): Uint8Array {
  try {
    return Uint8Array.from(atob(String(value)), (character) => character.charCodeAt(0));
  } catch {
    throw new Error(`${label} is not base64`);
  }
}
async function assertEncodedBytes(
  value: Record<string, unknown>,
  label: string,
): Promise<Uint8Array> {
  const decoded = bytes(value.base64, `${label}.base64`);
  if (decoded.length !== value.bytes || await sha256Hex(decoded) !== value.sha256) {
    throw new Error(`${label} byte length, base64, and SHA-256 do not agree`);
  }
  return decoded;
}
function rawResultText(result: Record<string, unknown>): string {
  const served = record(result.servedByteChecks, "result.servedByteChecks");
  const servedText = served.status === "verified"
    ? `Served-byte checks: ${
      JSON.stringify(
        Object.fromEntries(Object.entries(served).filter(([key]) => key !== "status")),
        null,
        2,
      )
    }\n`
    : "";
  return `Target: ${result.target}\nMode: ${result.mode}\nRecords: ${result.records}\nInput SHA-256: ${result.inputSha256}\nOutput SHA-256: ${result.outputSha256}\nCounters: ${
    JSON.stringify(result.counters, null, 2)
  }\n${servedText}\nCanonical summary:\n${result.canonicalSummary}`;
}
function assertOrdered(values: unknown[], expected: string[], label: string): void {
  let cursor = 0;
  for (const value of values) {
    if (value === expected[cursor]) cursor++;
  }
  if (cursor !== expected.length) {
    throw new Error(`${label} omits or reorders required status transitions`);
  }
}
function expectedStatusChronology(scenario: Record<string, unknown>): string[] {
  const generating = "Generating the registered fixture in a fresh worker.";
  const action = String(scenario.action);
  if (action === "complete") {
    const values = [
      "Ready.",
      generating,
      "Loading and verifying the content-addressed workload module.",
      "Generating exactly 1,000 records.",
      "Parsing 119,397 UTF-8 bytes.",
    ];
    if (scenario.mode === "exact-contract") {
      values.push("Checking served module, manifests, artifact, fixture, output, and counters.");
    }
    values.push("Complete.");
    return values;
  }
  if (action === "stale-error-restart") {
    return [
      "Ready.",
      generating,
      "Cancelled. No result was retained.",
      generating,
      "Loading and verifying the content-addressed workload module.",
      "Generating exactly 1,000 records.",
      "Parsing 119,397 UTF-8 bytes.",
      "Checking served module, manifests, artifact, fixture, output, and counters.",
      "Complete.",
    ];
  }
  const final = String(scenario.finalStatus);
  return ["Ready.", generating, final];
}
function networkKey(urlValue: string): string {
  if (urlValue.startsWith("blob:")) return "blob-executed-workload";
  return new URL(urlValue).pathname;
}
function expectedNetworkRoster(scenario: Record<string, unknown>): Map<string, number> {
  const stale = scenario.action === "stale-error-restart";
  const expected = new Map<string, number>([
    [DEMO_ROUTE, 1],
    ["/styles.css", 1],
    ["/telemetry-demo.js", 1],
    ["/telemetry-worker.js", stale ? 2 : 1],
    ["/telemetry-module-loader.js", stale ? 2 : 1],
  ]);
  const completes = scenario.action === "complete" || stale;
  if (!completes) return expected;
  expected.set(`/benchmarks/v1/serialization-json-telemetry/workload.${WORKLOAD_SHA256}.js`, 1);
  expected.set("blob-executed-workload", 1);
  if (scenario.variant === "wasm-linear-controlled" || scenario.mode === "exact-contract") {
    expected.set("/artifacts/serialization-json-telemetry/telemetry.wasm", 1);
  }
  if (scenario.mode === "exact-contract") {
    for (
      const name of [
        "build-manifest.json",
        "fixture-manifest.json",
        "input-manifest.json",
        "output-manifest.json",
      ]
    ) {
      expected.set(`/artifacts/serialization-json-telemetry/${name}`, 1);
    }
  }
  return expected;
}
function expectedResourceType(path: string): string {
  if (path === DEMO_ROUTE) return "Document";
  if (path === "/styles.css") return "Stylesheet";
  if (
    path === "/telemetry-demo.js" || path === "/telemetry-worker.js" ||
    path === "/telemetry-module-loader.js" || path === "blob-executed-workload"
  ) return "Script";
  return "Fetch";
}
function expectedSourcePath(path: string): string | null {
  if (path === DEMO_ROUTE) return "public/demos/serialization.json-telemetry.v1/index.html";
  if (path === "/styles.css") return "public/styles.css";
  if (path === "/telemetry-demo.js") return "public/telemetry-demo.js";
  if (path === "/telemetry-worker.js") return "public/telemetry-worker.js";
  if (path === "/telemetry-module-loader.js") return "public/telemetry-module-loader.js";
  if (path.startsWith("/benchmarks/v1/serialization-json-telemetry/workload.")) {
    return WORKLOAD_PATH;
  }
  if (path.startsWith("/artifacts/serialization-json-telemetry/")) return `public${path}`;
  return null;
}
function assertTokenChronology(scenario: Record<string, unknown>, label: string): void {
  const lifecycle = record(scenario.lifecycle, `${label}.lifecycle`);
  const workers = array(lifecycle.workers, `${label}.lifecycle.workers`).map((value, index) =>
    record(value, `${label}.lifecycle.workers[${index}]`)
  );
  const injections = array(lifecycle.injections, `${label}.lifecycle.injections`).map((
    value,
    index,
  ) => record(value, `${label}.lifecycle.injections[${index}]`));
  for (const worker of workers) {
    const posted = array(worker.postedTokens, `${label}.worker.postedTokens`).map((value) =>
      record(value, "posted token")
    );
    const delivered = array(worker.deliveredTokens, `${label}.worker.deliveredTokens`).map((
      value,
    ) => record(value, "delivered token"));
    const received = array(worker.receivedTokens, `${label}.worker.receivedTokens`).map((value) =>
      record(value, "received token")
    );
    const terminated = array(worker.terminateCalls, `${label}.worker.terminateCalls`);
    if (posted.length !== 1 || typeof posted[0].token !== "number") {
      throw new Error(`${label} worker lacks its one controller token`);
    }
    if (
      Number(posted[0].at) < Number(worker.createdAt) ||
      Number(terminated[0]) < Number(posted[0].at)
    ) {
      throw new Error(
        `${label} worker creation, token post, and termination chronology is contradictory`,
      );
    }
    if (
      delivered.some((entry) => entry.token !== posted[0].token) ||
      received.some((entry) =>
        entry.token !== posted[0].token &&
        !(scenario.action === "wrong-token" && entry.token === "wrong-token")
      )
    ) {
      throw new Error(`${label} delivered or received an unregistered stale controller token`);
    }
  }
  if (scenario.action === "wrong-token") {
    const received = array(workers[0].receivedTokens, `${label}.wrongToken.received`).map((value) =>
      record(value, `${label}.wrongToken.receivedToken`)
    );
    if (
      injections.length !== 1 || injections[0].kind !== "wrong-token-message" ||
      injections[0].workerId !== 1 || injections[0].token !== "wrong-token" ||
      received.length !== 1 || received[0].token !== "wrong-token" ||
      Number(received[0].at) < Number(injections[0].at)
    ) {
      throw new Error(`${label} lacks the exact wrong-token injection`);
    }
  } else if (scenario.action === "stale-error-restart") {
    if (workers.length !== 2 || injections.length !== 1) {
      throw new Error(`${label} lacks both worker generations and one stale error`);
    }
    const staleToken =
      record(array(workers[0].postedTokens, "stale posted tokens")[0], "stale posted token").token;
    const activeToken =
      record(array(workers[1].postedTokens, "active posted tokens")[0], "active posted token")
        .token;
    const injection = injections[0];
    if (
      injection.kind !== "stale-worker-error" || injection.workerId !== workers[0].id ||
      injection.activeWorkerId !== workers[1].id || injection.staleToken !== staleToken ||
      injection.activeToken !== activeToken || staleToken === activeToken ||
      Number(array(workers[0].terminateCalls, "stale terminate calls")[0]) >
        Number(workers[1].createdAt) ||
      Number(injection.at) < Number(workers[1].createdAt)
    ) throw new Error(`${label} stale and active generation chronology is contradictory`);
  } else if (injections.length !== 0) {
    throw new Error(`${label} has an unregistered synthetic injection`);
  }
}

/** Checks relationships that JSON Schema cannot express. The closed schema must be applied first. */
export async function assertJsonTelemetryEvidenceRelationships(value: unknown): Promise<void> {
  const evidence = record(value, "evidence");
  const scenarios = array(evidence.scenarios, "scenarios");
  const collection = record(evidence.collection, "collection");
  if (
    collection.completedScenarios !== scenarios.length ||
    (collection.outcome === "success" && scenarios.length !== 9)
  ) {
    throw new Error("collection completedScenarios does not equal the retained scenario count");
  }

  const source = record(evidence.source, "source");
  const end = record(source.endCheck, "source.endCheck");
  if (end.outcome === "success" && (end.commit !== source.commit || end.tree !== source.tree)) {
    throw new Error("source end recheck does not match the frozen commit and tree");
  }
  const frozen = array(source.frozenFiles, "source.frozenFiles") as Array<Record<string, unknown>>;
  if (canonicalize(frozen.map((entry) => entry.path)) !== canonicalize(SOURCE_PATHS)) {
    throw new Error("frozen source graph omits or reorders a collector dependency");
  }
  const frozenWorkload = frozen.find((entry) => entry.path === WORKLOAD_PATH);
  if (!frozenWorkload || frozenWorkload.sha256 !== WORKLOAD_SHA256) {
    throw new Error("frozen workload source hash differs from the registered workload hash");
  }
  const collector = record(evidence.collector, "collector");
  const script = frozen.find((entry) => entry.path === collector.script);
  if (
    !script || script.bytes !== collector.scriptBytes || script.sha256 !== collector.scriptSha256
  ) {
    throw new Error("collector identity does not match its frozen source file");
  }
  if (evidence.browser) {
    const browser = record(evidence.browser, "browser");
    if (
      canonicalize(browser.stagedExecutableIdentity) !==
        canonicalize(browser.runningExecutableIdentity)
    ) {
      throw new Error("running Chrome inode does not match the immutable verified stage");
    }
    if (
      canonicalize(browser.effectiveArguments) !==
        canonicalize([browser.executable, ...(browser.launchArguments as unknown[])])
    ) {
      throw new Error(
        "effective browser argv does not equal staged executable plus reviewed launch argv",
      );
    }
  }

  const server = evidence.server ? record(evidence.server, "server") : null;
  for (const [index, scenarioValue] of scenarios.entries()) {
    const scenario = record(scenarioValue, `scenarios[${index}]`);
    const label = `scenarios[${index}]`;
    const statusHistory = array(scenario.statusHistory, `${label}.statusHistory`);
    if (
      statusHistory.at(-1) !== scenario.finalStatus ||
      statusHistory.some((status, statusIndex) =>
        statusIndex > 0 && status === statusHistory[statusIndex - 1]
      )
    ) throw new Error(`${label} final status and de-duplicated status history do not agree`);
    assertOrdered(statusHistory, expectedStatusChronology(scenario), `${label}.statusHistory`);
    assertTokenChronology(scenario, label);

    const accessibility = record(scenario.accessibility, `${label}.accessibility`);
    const axNames = (accessibility.axText as Array<Record<string, unknown>>).map((entry) =>
      entry.name
    );
    if (
      !axNames.includes(accessibility.statusText) ||
      (accessibility.resultText !== "" && !axNames.includes(accessibility.resultText))
    ) {
      throw new Error(`${label} AX names omit visible status or result text`);
    }

    const network = array(scenario.network, `${label}.network`).map((entry, requestIndex) =>
      record(entry, `${label}.network[${requestIndex}]`)
    );
    const actualRoster = new Map<string, number>();
    for (const [requestIndex, request] of network.entries()) {
      if (
        request.requestServedFromCache !== false || request.fromDiskCache !== false ||
        request.fromPrefetchCache !== false || request.fromServiceWorker !== false
      ) {
        throw new Error(`${label}.network[${requestIndex}] lacks complete no-cache evidence`);
      }
      const key = networkKey(String(request.url));
      if (request.resourceType !== expectedResourceType(key)) {
        throw new Error(`${label} ${key} has the wrong CDP resource type`);
      }
      actualRoster.set(key, (actualRoster.get(key) ?? 0) + 1);
      const body = record(request.responseBody, `${label}.network[${requestIndex}].responseBody`);
      if (key === "blob-executed-workload") {
        if (body.status !== "unavailable") {
          throw new Error(`${label} Blob response body must use the retained constructor audit`);
        }
      } else {
        if (!server || request.url !== `${server.origin}${key}`) {
          throw new Error(`${label} request URL escaped the exact loopback roster`);
        }
        if (body.status !== "supported") {
          throw new Error(`${label} exact roster response body is unavailable`);
        }
        await assertEncodedBytes(body, `${label}.network[${requestIndex}].responseBody`);
        if (body.sourcePath !== expectedSourcePath(key)) {
          throw new Error(`${label} response source mapping is contradictory`);
        }
        if (key.includes("/workload.") && body.sha256 !== WORKLOAD_SHA256) {
          throw new Error(`${label} fetched workload hash changed`);
        }
      }
    }
    if (
      canonicalize([...actualRoster.entries()].sort()) !==
        canonicalize([...expectedNetworkRoster(scenario).entries()].sort())
    ) {
      throw new Error(`${label} network roster differs from the exact scenario contract`);
    }

    if (!scenario.result) continue;
    const result = record(scenario.result, `${label}.result`);
    if (result.rawText !== rawResultText(result)) {
      throw new Error(`${label} result.rawText contradicts its parsed fields`);
    }
    if (
      result.target !== scenario.variant || result.mode !== scenario.mode ||
      result.records !== scenario.records
    ) {
      throw new Error(`${label} result identity differs from the scenario`);
    }
    const blob = record(scenario.blobExecution, `${label}.blobExecution`);
    const blobBytes = await assertEncodedBytes(blob, `${label}.blobExecution`);
    const workloadRequest = network.find((request) =>
      record(request.responseBody, "network.responseBody").sourcePath === WORKLOAD_PATH
    );
    if (!workloadRequest) throw new Error(`${label} lacks fetched workload bytes`);
    const workloadBody = record(workloadRequest.responseBody, "workload response body");
    const workloadBytes = await assertEncodedBytes(workloadBody, "workload response body");
    const served = record(result.servedByteChecks, "result.servedByteChecks");
    const sameBytes = blobBytes.length === workloadBytes.length &&
      blobBytes.every((byte, byteIndex) => byte === workloadBytes[byteIndex]);
    if (
      !sameBytes || blob.sha256 !== WORKLOAD_SHA256 || workloadBody.sha256 !== WORKLOAD_SHA256 ||
      (served.status === "verified" &&
        (served.executedModuleSha256 !== WORKLOAD_SHA256 ||
          served.executedModuleRoute !==
            `/benchmarks/v1/serialization-json-telemetry/workload.${WORKLOAD_SHA256}.js`))
    ) {
      throw new Error(
        `${label} executed Blob, fetched workload, frozen workload, and served identity do not agree`,
      );
    }
  }
}

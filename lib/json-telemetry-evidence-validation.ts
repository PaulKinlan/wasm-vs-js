import { canonicalize, sha256Hex } from "./canonical.ts";

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as Record<string, unknown>;
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

/** Checks relationships that JSON Schema cannot express. The closed schema must be applied first. */
export async function assertJsonTelemetryEvidenceRelationships(value: unknown): Promise<void> {
  const evidence = record(value, "evidence");
  const source = record(evidence.source, "source");
  const end = record(source.endCheck, "source.endCheck");
  if (end.outcome === "success" && (end.commit !== source.commit || end.tree !== source.tree)) {
    throw new Error("source end recheck does not match the frozen commit and tree");
  }
  const frozen = source.frozenFiles as Array<Record<string, unknown>>;
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
      canonicalize(browser.effectiveArguments) !==
        canonicalize([browser.executable, ...(browser.launchArguments as unknown[])])
    ) {
      throw new Error("effective browser argv does not equal executable plus reviewed launch argv");
    }
  }
  for (const [index, scenarioValue] of (evidence.scenarios as unknown[]).entries()) {
    const scenario = record(scenarioValue, `scenarios[${index}]`);
    const accessibility = record(scenario.accessibility, `scenarios[${index}].accessibility`);
    const axNames = (accessibility.axText as Array<Record<string, unknown>>).map((entry) =>
      entry.name
    );
    if (
      !axNames.includes(accessibility.statusText) ||
      (accessibility.resultText !== "" && !axNames.includes(accessibility.resultText))
    ) {
      throw new Error(`scenarios[${index}] AX names omit visible status or result text`);
    }
    const network = scenario.network as Array<Record<string, unknown>>;
    for (const [requestIndex, request] of network.entries()) {
      const body = record(
        request.responseBody,
        `scenarios[${index}].network[${requestIndex}].responseBody`,
      );
      if (body.status === "supported") {
        await assertEncodedBytes(body, `scenarios[${index}].network[${requestIndex}].responseBody`);
      }
    }
    if (!scenario.result) continue;
    const blob = record(scenario.blobExecution, `scenarios[${index}].blobExecution`);
    const blobBytes = await assertEncodedBytes(blob, `scenarios[${index}].blobExecution`);
    const workloadRequest = network.find((request) =>
      record(request.responseBody, "network.responseBody").sourcePath ===
        "benchmarks/v1/serialization-json-telemetry/workload.js"
    );
    if (!workloadRequest) throw new Error(`scenarios[${index}] lacks fetched workload bytes`);
    const workloadBody = record(workloadRequest.responseBody, "workload response body");
    const workloadBytes = await assertEncodedBytes(workloadBody, "workload response body");
    const served = record(
      record(scenario.result, "result").servedByteChecks,
      "result.servedByteChecks",
    );
    const sameBytes = blobBytes.length === workloadBytes.length &&
      blobBytes.every((byte, byteIndex) => byte === workloadBytes[byteIndex]);
    if (
      !sameBytes || blob.sha256 !== workloadBody.sha256 ||
      (served.status === "verified" && served.executedModuleSha256 !== blob.sha256)
    ) {
      throw new Error(
        `scenarios[${index}] executed Blob, fetched workload, and served identity do not agree`,
      );
    }
  }
}

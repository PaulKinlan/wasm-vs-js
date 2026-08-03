// @ts-ignore Browser same-origin route, mapped by server.ts.
import {
  generateTelemetryFixture,
  REGISTERED_COUNTS,
  runTelemetryJS,
  runTelemetryWasm,
  sha256Hex,
  VARIANTS,
} from "/benchmarks/v1/serialization-json-telemetry/workload.js";

const ALLOWED_VARIANTS = new Set(VARIANTS);
const ALLOWED_MODES = new Set(["bounded", "exact-contract"]);
async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
async function fetchJsonBytes(path) {
  const bytes = await fetchBytes(path);
  return {
    bytes,
    value: JSON.parse(new TextDecoder().decode(bytes)),
    sha256: await sha256Hex(bytes),
  };
}

self.onmessage = async ({ data }) => {
  const { token, values } = data;
  try {
    const variant = String(values.variant);
    const mode = String(values.mode);
    const records = Number(values.records);
    if (!ALLOWED_VARIANTS.has(variant)) throw new Error("unknown target denied");
    if (!ALLOWED_MODES.has(mode)) throw new Error("unknown mode denied");
    if (!REGISTERED_COUNTS.includes(records)) throw new Error("unregistered record count denied");
    self.postMessage({
      token,
      type: "progress",
      value: 0.15,
      message: `Generating exactly ${records.toLocaleString()} records.`,
    });
    const input = generateTelemetryFixture(records);
    const inputSha256 = await sha256Hex(input);
    self.postMessage({
      token,
      type: "progress",
      value: 0.4,
      message: `Parsing ${input.length.toLocaleString()} UTF-8 bytes.`,
    });
    let result;
    let wasmBytes = null;
    if (variant === "wasm-linear-controlled" || mode === "exact-contract") {
      wasmBytes = await fetchBytes("/artifacts/serialization-json-telemetry/telemetry.wasm");
    }
    if (variant === "js-controlled") result = runTelemetryJS(input);
    else result = await runTelemetryWasm(input, wasmBytes);
    const outputSha256 = await sha256Hex(result.outputBytes);
    const exact = {};
    if (mode === "exact-contract") {
      self.postMessage({
        token,
        type: "progress",
        value: 0.75,
        message: "Checking served source, manifests, artifact, fixture, output, and counters.",
      });
      const [build, fixtureManifest, inputManifest, outputManifest, sourceBytes] = await Promise
        .all([
          fetchJsonBytes("/artifacts/serialization-json-telemetry/build-manifest.json"),
          fetchJsonBytes("/artifacts/serialization-json-telemetry/fixture-manifest.json"),
          fetchJsonBytes("/artifacts/serialization-json-telemetry/input-manifest.json"),
          fetchJsonBytes("/artifacts/serialization-json-telemetry/output-manifest.json"),
          fetchBytes("/benchmarks/v1/serialization-json-telemetry/workload.js"),
        ]);
      for (const item of [build, fixtureManifest, inputManifest, outputManifest]) {
        if (item.value.workload !== "serialization.json-telemetry.v1") {
          throw new Error("manifest workload mismatch");
        }
      }
      const inputTier = inputManifest.value.tiers.find((tier) => tier.records === records);
      const outputTier = outputManifest.value.tiers.find((tier) => tier.records === records);
      if (!inputTier || inputTier.sha256 !== inputSha256 || inputTier.bytes !== input.length) {
        throw new Error("fixture raw-byte identity mismatch");
      }
      if (
        !outputTier || outputTier.sha256 !== outputSha256 ||
        outputTier.canonicalSummary !== result.text
      ) throw new Error("canonical output identity mismatch");
      const expectedCounters = outputTier.variants[variant].counters;
      if (JSON.stringify(expectedCounters) !== JSON.stringify(result.counters)) {
        throw new Error("counter contract mismatch");
      }
      if (await sha256Hex(wasmBytes) !== build.value.artifact.sha256) {
        throw new Error("Wasm artifact identity mismatch");
      }
      const source = build.value.fullSourceGraph.find((entry) =>
        entry.path.endsWith("/workload.js")
      );
      if (!source || await sha256Hex(sourceBytes) !== source.sha256) {
        throw new Error("JavaScript source identity mismatch");
      }
      Object.assign(exact, {
        buildManifestSha256: build.sha256,
        fixtureManifestSha256: fixtureManifest.sha256,
        inputManifestSha256: inputManifest.sha256,
        outputManifestSha256: outputManifest.sha256,
        sourceSha256: source.sha256,
        wasmSha256: build.value.artifact.sha256,
      });
    }
    self.postMessage({
      token,
      type: "complete",
      text:
        `Target: ${variant}\nMode: ${mode}\nRecords: ${records}\nInput SHA-256: ${inputSha256}\nOutput SHA-256: ${outputSha256}\nCounters: ${
          JSON.stringify(result.counters, null, 2)
        }\n${
          mode === "exact-contract" ? `Served-byte checks: ${JSON.stringify(exact, null, 2)}\n` : ""
        }\nCanonical summary:\n${result.text}`,
    });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : "unknown worker error",
    });
  }
};

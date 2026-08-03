// @ts-ignore Browser same-origin route, mapped by server.ts.
import { loadVerifiedModule } from "/telemetry-module-loader.js";

const WORKLOAD_SOURCE_SHA256 = "54e2ee54b225d8454664dc6a24f5fa178ee0652ccf0e7e01eea93b17f29530f8";
const WORKLOAD_MODULE_ROUTE =
  `/benchmarks/v1/serialization-json-telemetry/workload.${WORKLOAD_SOURCE_SHA256}.js`;
const ALLOWED_VARIANTS = new Set(["js-controlled", "wasm-linear-controlled"]);
const ALLOWED_MODES = new Set(["bounded", "exact-contract"]);
const REGISTERED_COUNTS = Object.freeze([1_000, 100_000, 1_000_000]);

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
    sha256: await crypto.subtle.digest("SHA-256", bytes).then((digest) =>
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
    ),
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
      value: 0.05,
      message: "Loading and verifying the content-addressed workload module.",
    });
    const loaded = await loadVerifiedModule({
      route: WORKLOAD_MODULE_ROUTE,
      expectedSha256: WORKLOAD_SOURCE_SHA256,
    });
    const workload = loaded.module;
    if (
      workload.WORKLOAD_ID !== "serialization.json-telemetry.v1" ||
      !workload.REGISTERED_COUNTS.includes(records) ||
      !workload.VARIANTS.includes(variant)
    ) throw new Error("executed workload module contract mismatch");
    self.postMessage({
      token,
      type: "progress",
      value: 0.15,
      message: `Generating exactly ${records.toLocaleString()} records.`,
    });
    const input = workload.generateTelemetryFixture(records);
    const inputSha256 = await workload.sha256Hex(input);
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
    if (variant === "js-controlled") result = workload.runTelemetryJS(input);
    else result = await workload.runTelemetryWasm(input, wasmBytes);
    const outputSha256 = await workload.sha256Hex(result.outputBytes);
    const exact = {};
    if (mode === "exact-contract") {
      self.postMessage({
        token,
        type: "progress",
        value: 0.75,
        message: "Checking served module, manifests, artifact, fixture, output, and counters.",
      });
      const [build, fixtureManifest, inputManifest, outputManifest] = await Promise.all([
        fetchJsonBytes("/artifacts/serialization-json-telemetry/build-manifest.json"),
        fetchJsonBytes("/artifacts/serialization-json-telemetry/fixture-manifest.json"),
        fetchJsonBytes("/artifacts/serialization-json-telemetry/input-manifest.json"),
        fetchJsonBytes("/artifacts/serialization-json-telemetry/output-manifest.json"),
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
      if (await workload.sha256Hex(wasmBytes) !== build.value.artifact.sha256) {
        throw new Error("Wasm artifact identity mismatch");
      }
      const source = build.value.fullSourceGraph.find((entry) =>
        entry.path.endsWith("/workload.js")
      );
      if (!source || loaded.sourceSha256 !== source.sha256) {
        throw new Error("executed JavaScript source identity mismatch");
      }
      Object.assign(exact, {
        executedModuleRoute: loaded.route,
        executedModuleSha256: loaded.sourceSha256,
        buildManifestSha256: build.sha256,
        fixtureManifestSha256: fixtureManifest.sha256,
        inputManifestSha256: inputManifest.sha256,
        outputManifestSha256: outputManifest.sha256,
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

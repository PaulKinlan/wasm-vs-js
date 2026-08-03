import { validateOlapBrowserResults } from "/benchmarks/base/database-olap-chart/browser-validation.js";
import {
  instantiateOlapWasm,
  OLAP_VARIANTS,
  runOlapJavaScript,
  runOlapWasm,
} from "/benchmarks/base/database-olap-chart/engine.js";

const ROOT = "/artifacts/database-olap-chart/";
const FROZEN_ARTIFACTS = Object.freeze({
  "public/artifacts/database-olap-chart/database-olap-chart.wasm": Object.freeze({
    bytes: 4092,
    sha256: "d8961ca2376da7f5fc571b89235d3986fa80e27d557c832ba86d025d8077acd8",
  }),
  "public/artifacts/database-olap-chart/fixture.bin": Object.freeze({
    bytes: 240152,
    sha256: "5cf987b48dffafc4d11f11f23d25c2064e631a8ac8070ef89fdb2090751b9e8c",
  }),
  "public/artifacts/database-olap-chart/fixture-manifest.json": Object.freeze({
    bytes: 613,
    sha256: "a05e3b89e64f4dd4868d7c6617d5e5fa283ca7ccb7fa864ad5905c1993a85ffd",
  }),
  "public/artifacts/database-olap-chart/output-manifest.json": Object.freeze({
    bytes: 29529,
    sha256: "de1bb41b8e1053b7639a4c96f150698bb3542c6278ba4e6d277c49f9715374c1",
  }),
});

async function sha256Hex(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Artifact fetch failed for ${path}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchJson(path) {
  const bytes = await fetchBytes(path);
  try {
    return { bytes, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    throw new Error(`Artifact JSON is invalid: ${path}`);
  }
}

function artifactReference(buildManifest, path) {
  const reference = buildManifest.artifacts?.find((entry) => entry.path === path);
  const frozen = FROZEN_ARTIFACTS[path];
  if (
    !reference || !frozen || reference.bytes !== frozen.bytes || reference.sha256 !== frozen.sha256
  ) {
    throw new Error(`Build manifest has no frozen exact reference for ${path}`);
  }
  return { path, ...frozen };
}

async function verifyBytes(bytes, reference) {
  if (bytes.byteLength !== reference.bytes) {
    throw new Error(`Artifact byte count mismatch: ${reference.path}`);
  }
  if (await sha256Hex(bytes) !== reference.sha256) {
    throw new Error(`Artifact SHA-256 mismatch: ${reference.path}`);
  }
}

async function executeAndValidate() {
  const { value: buildManifest } = await fetchJson(`${ROOT}build-manifest.json`);
  if (buildManifest.schemaVersion !== 1 || buildManifest.workloadId !== "database.olap-chart.v1") {
    throw new Error("Build manifest identity mismatch");
  }
  const fixtureManifestFetch = await fetchJson(`${ROOT}fixture-manifest.json`);
  const outputManifestFetch = await fetchJson(`${ROOT}output-manifest.json`);
  await verifyBytes(
    fixtureManifestFetch.bytes,
    artifactReference(
      buildManifest,
      "public/artifacts/database-olap-chart/fixture-manifest.json",
    ),
  );
  await verifyBytes(
    outputManifestFetch.bytes,
    artifactReference(
      buildManifest,
      "public/artifacts/database-olap-chart/output-manifest.json",
    ),
  );

  const fixtureReference = artifactReference(
    buildManifest,
    "public/artifacts/database-olap-chart/fixture.bin",
  );
  const wasmReference = artifactReference(
    buildManifest,
    "public/artifacts/database-olap-chart/database-olap-chart.wasm",
  );
  const fixture = await fetchBytes(`${ROOT}fixture.bin`);
  const wasmBytes = await fetchBytes(`${ROOT}database-olap-chart.wasm`);
  await verifyBytes(fixture, fixtureReference);
  await verifyBytes(wasmBytes, wasmReference);
  const declaredFixture = fixtureManifestFetch.value.fixture;
  if (
    fixtureManifestFetch.value.workloadId !== buildManifest.workloadId ||
    declaredFixture.path !== fixtureReference.path ||
    declaredFixture.bytes !== fixtureReference.bytes ||
    declaredFixture.sha256 !== fixtureReference.sha256
  ) throw new Error("Fixture and build manifests disagree");

  const javascript = runOlapJavaScript(fixture);
  const wasm = runOlapWasm(await instantiateOlapWasm(wasmBytes), fixture);
  const validation = validateOlapBrowserResults(javascript, wasm, outputManifestFetch.value);
  return { javascript, wasm, validation };
}

self.onmessage = async ({ data }) => {
  if (!data || data.type !== "start" || !Number.isSafeInteger(data.token)) return;
  const { token, variantId } = data;
  if (!OLAP_VARIANTS.includes(variantId)) {
    self.postMessage({ type: "error", token, message: "Target is not in the fixed allowlist." });
    return;
  }
  try {
    const executions = await executeAndValidate();
    const value = variantId === "js-controlled" ? executions.javascript : executions.wasm;
    const { output: _output, ...result } = value;
    self.postMessage({
      type: "result",
      token,
      result: { ...result, validation: executions.validation },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : "Worker failed.",
    });
  }
};

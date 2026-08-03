import {
  compareRigidBodyResults,
  instantiateRigidBodyWasm,
  runRigidBodyJavaScript,
  runRigidBodyWasm,
} from "/benchmarks/v1/simulation-rigid-body-2d/engine.js";

const base = "/artifacts/simulation-rigid-body-2d-v1/";
const allowedTargets = new Set(["javascript", "wasm-linear", "both"]);

function post(token, type, data = {}) {
  self.postMessage({ token, type, ...data });
}
async function bytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
async function jsonWithBytes(path) {
  const raw = await bytes(path);
  return { raw, value: JSON.parse(new TextDecoder().decode(raw)) };
}
async function sha256(raw) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  return [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function exactObject(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(`${label} counter ${key}: ${actual[key]} != ${value}`);
    }
  }
}
function validate(result, expected, reference) {
  if (result.checkpoints.length !== reference.length) throw new Error("reference length mismatch");
  let maximum = 0;
  for (let index = 0; index < reference.length; index += 1) {
    const difference = Math.abs(result.checkpoints[index] - reference[index]);
    maximum = Math.max(maximum, difference);
    if (difference > 0.0005) throw new Error(`checkpoint ${index} exceeds tolerance`);
  }
  if (result.metrics.groundPenetration > 0.0005) throw new Error("ground penetration");
  if (result.metrics.jointLengthError > 0.0031) throw new Error("joint length error");
  if (result.metrics.contactPenetration > 0.003) throw new Error("contact penetration");
  if (result.metrics.maxSpeed > 0.025) throw new Error("scene did not settle");
  exactObject(result.counters, expected, result.executionTarget);
  return maximum;
}

self.addEventListener("message", async (event) => {
  if (event.data?.type !== "run") return;
  const { token, target } = event.data;
  try {
    if (!Number.isSafeInteger(token) || !allowedTargets.has(target)) {
      throw new Error("invalid run request");
    }
    post(token, "progress", { phase: 1, message: "Verifying raw artifact and manifest bytes…" });
    const [
      fixture,
      wasmBytes,
      referenceBytes,
      fixtureManifestResult,
      outputManifestResult,
      buildManifestResult,
    ] = await Promise.all([
      bytes(`${base}fixture.bin`),
      bytes(`${base}rigid-body-2d.wasm`),
      bytes(`${base}reference-checkpoints.f32le`),
      jsonWithBytes(`${base}fixture-manifest.json`),
      jsonWithBytes(`${base}output-manifest.json`),
      jsonWithBytes(`${base}build-manifest.json`),
    ]);
    const fixtureManifest = fixtureManifestResult.value;
    const outputManifest = outputManifestResult.value;
    const buildManifest = buildManifestResult.value;
    if (await sha256(fixture) !== fixtureManifest.fixture.sha256) {
      throw new Error("fixture hash mismatch");
    }
    if (await sha256(wasmBytes) !== buildManifest.artifact.sha256) {
      throw new Error("Wasm hash mismatch");
    }
    if (await sha256(referenceBytes) !== outputManifest.oracle.referenceSha256) {
      throw new Error("reference hash mismatch");
    }
    if (await sha256(fixtureManifestResult.raw) !== buildManifest.fixtureManifestSha256) {
      throw new Error("fixture manifest raw-byte mismatch");
    }
    if (await sha256(outputManifestResult.raw) !== buildManifest.outputManifestSha256) {
      throw new Error("output manifest raw-byte mismatch");
    }
    if (buildManifest.toolchain.deno !== "2.9.0") throw new Error("toolchain pin mismatch");
    if (
      fixtureManifest.frozenCatalogSha256 !==
        "6665664f984683e5b7d3fdc8c1602198124844704c224a526d48be2f02edf9d4"
    ) throw new Error("frozen catalog anchor mismatch");
    const reference = new Float32Array(
      referenceBytes.buffer,
      referenceBytes.byteOffset,
      referenceBytes.byteLength / 4,
    );
    post(token, "progress", { phase: 2, message: `Executing ${target} fixed work…` });
    let javascript = null, wasm = null;
    if (target === "javascript" || target === "both") javascript = runRigidBodyJavaScript(fixture);
    if (target === "wasm-linear" || target === "both") {
      wasm = runRigidBodyWasm(fixture, await instantiateRigidBodyWasm(wasmBytes));
    }
    post(token, "progress", {
      phase: 3,
      message: "Checking 12,000 state values and exact counters…",
    });
    const checks = {};
    if (javascript) {
      checks.javascriptMaximumError = validate(
        javascript,
        outputManifest.counters.javascript,
        reference,
      );
    }
    if (wasm) checks.wasmMaximumError = validate(wasm, outputManifest.counters.wasm, reference);
    if (javascript && wasm) {
      const comparison = compareRigidBodyResults(javascript, wasm);
      if (!comparison.passed) throw new Error("cross-target state mismatch");
      checks.crossTarget = comparison;
    }
    const selected = wasm ?? javascript;
    post(token, "complete", {
      result: {
        target,
        checkpointDigest: selected.checkpointDigest,
        completeStateValues: selected.checkpoints.length,
        counters: selected.counters,
        metrics: selected.metrics,
        checks,
        performanceClaims: [],
      },
    });
  } catch (error) {
    post(event.data?.token, "error", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

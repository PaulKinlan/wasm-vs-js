import { IDENTITY } from "./identity.js";
import { generateCorpus } from "../../../../benchmarks/text-regex-log-scan/input.js";
import {
  assertFullContract,
  scanJsControlled,
  scanWasmControlled,
  sha256Hex,
} from "../../../../benchmarks/text-regex-log-scan/workload.js";

async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function exactCounters(actual, expected) {
  for (const [name, value] of Object.entries(expected)) {
    if (JSON.stringify(actual[name]) !== JSON.stringify(value)) {
      throw new Error(`counter ${name} did not match the registration`);
    }
  }
}

self.addEventListener("message", async ({ data }) => {
  const { token, variant } = data;
  try {
    if (variant !== "js-controlled" && variant !== "wasm-linear-controlled") {
      throw new Error("unknown controlled target");
    }
    self.postMessage({
      type: "progress",
      token,
      step: 1,
      message: "Verifying served source and manifests…",
    });
    const raw = {
      registration: await fetchBytes("/data/base-implementations/text.regex-log-scan.v1.json"),
      buildManifest: await fetchBytes("/artifacts/text-regex-log-scan/build-manifest.json"),
      inputManifest: await fetchBytes("/artifacts/text-regex-log-scan/input-manifest.json"),
      outputManifest: await fetchBytes("/artifacts/text-regex-log-scan/output-manifest.json"),
      wasm: await fetchBytes("/artifacts/text-regex-log-scan/text-regex-log-scan.wasm"),
      captures: await fetchBytes("/artifacts/text-regex-log-scan/ordered-captures.bin"),
      inputModule: await fetchBytes("/benchmarks/text-regex-log-scan/input.js"),
      workloadModule: await fetchBytes("/benchmarks/text-regex-log-scan/workload.js"),
      workerModule: await fetchBytes("/benchmarks/base/text.regex-log-scan.v1/worker.js"),
    };
    for (const [name, bytes] of Object.entries(raw)) {
      if (await sha256Hex(bytes) !== IDENTITY.rawSha256[name]) {
        throw new Error(`served raw-byte hash mismatch: ${name}`);
      }
    }
    const registration = JSON.parse(new TextDecoder().decode(raw.registration));
    const build = JSON.parse(new TextDecoder().decode(raw.buildManifest));
    if (IDENTITY.sourceCommit !== build.sourceCommit) {
      throw new Error("identity source commit mismatch");
    }
    if (registration.catalogEntryId !== "text.regex-log-scan.v1") {
      throw new Error("registration id mismatch");
    }
    if (registration.implementation.sourceCommit !== build.sourceCommit) {
      throw new Error("source commit mismatch");
    }
    for (
      const [path, identityKey] of [
        ["benchmarks/text-regex-log-scan/input.js", "inputModule"],
        ["benchmarks/text-regex-log-scan/workload.js", "workloadModule"],
        ["public/benchmarks/base/text.regex-log-scan.v1/worker.js", "workerModule"],
      ]
    ) {
      const source = build.sources.find((entry) => entry.path === path);
      if (!source || source.sha256 !== IDENTITY.rawSha256[identityKey]) {
        throw new Error(`source manifest relationship mismatch: ${path}`);
      }
    }

    self.postMessage({
      type: "progress",
      token,
      step: 2,
      message: "Generating the exact 100 MiB fixture…",
    });
    const input = generateCorpus();
    if (await sha256Hex(input) !== registration.fixture.sha256) {
      throw new Error("fixture hash mismatch");
    }

    self.postMessage({ type: "progress", token, step: 3, message: `Running ${variant}…` });
    let result;
    if (variant === "js-controlled") {
      result = await scanJsControlled(input);
    } else {
      if (IDENTITY.rawSha256.wasm !== build.variants[variant].artifactSha256) {
        throw new Error("Wasm build-manifest relationship mismatch");
      }
      const instance = await WebAssembly.instantiate(await WebAssembly.compile(raw.wasm), {});
      result = await scanWasmControlled(input, instance);
    }
    assertFullContract(result);
    if (result.inputSha256 !== registration.fixture.sha256) {
      throw new Error("result input hash mismatch");
    }
    if (result.outputSha256 !== registration.oracle.sha256) {
      throw new Error("result oracle mismatch");
    }
    exactCounters(result.counters, registration.structuralCounters);
    delete result.matches;
    self.postMessage({ type: "complete", token, result });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

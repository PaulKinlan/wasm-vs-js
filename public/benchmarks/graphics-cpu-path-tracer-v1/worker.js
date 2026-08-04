import {
  compareToReference,
  PATH_CHECKPOINT_PIXELS,
  readWasmResult,
  renderJavaScript,
  SAMPLE_CHECKPOINT_COORDINATES,
  sampleCheckpointPixels,
} from "/benchmarks/base-v1/graphics-cpu-path-tracer/engine.js";
import { renderReference } from "/benchmarks/base-v1/graphics-cpu-path-tracer/reference.js";
async function hash(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((v) =>
    v.toString(16).padStart(2, "0")
  ).join("");
}
async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = stableValue(value[key]);
    return result;
  }
  return value;
}
function evidenceEquals(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}
self.onmessage = async (event) => {
  const token = event.data?.token;
  let target = event.data?.target || "javascript";
  if (target === "wasm" || target === "wasm-linear-controlled") target = "wasm-linear";
  if (target === "js" || target === "js-controlled") target = "javascript";
  let mode = event.data?.mode || "preview";
  const trust = event.data?.trust;
  try {
    if (
      !Number.isInteger(token) || !["javascript", "wasm-linear"].includes(target) ||
      !["preview", "exact"].includes(mode)
    ) throw new Error("invalid request");
    const exact = mode === "exact",
      width = exact ? 512 : 64,
      height = exact ? 512 : 64,
      spp = exact ? 64 : 4;
    let manifest = null, wasmBytes = null;
    if (exact) {
      const manifestBytes = await fetchBytes(
        "/artifacts/graphics-cpu-path-tracer-v1/build-manifest.json",
      );
      if (await hash(manifestBytes) !== trust.buildManifestSha256) {
        throw new Error("build manifest raw-byte mismatch");
      }
      manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
      const engineBytes = await fetchBytes(
        "/benchmarks/base-v1/graphics-cpu-path-tracer/engine.js",
      );
      const referenceBytes = await fetchBytes(
        "/benchmarks/base-v1/graphics-cpu-path-tracer/reference.js",
      );
      const runnerBytes = await fetchBytes("/benchmarks/graphics-cpu-path-tracer-v1/runner.js");
      const workerBytes = await fetchBytes("/benchmarks/graphics-cpu-path-tracer-v1/worker.js");
      const contractBytes = await fetchBytes(
        "/benchmarks/base-v1/graphics-cpu-path-tracer/implementation-contract.v1.json",
      );
      const contract = JSON.parse(new TextDecoder().decode(contractBytes));
      if (
        JSON.stringify(contract.oracle.samplePixelCheckpoints) !==
          JSON.stringify(SAMPLE_CHECKPOINT_COORDINATES) ||
        JSON.stringify(contract.oracle.pathCheckpointPixels) !==
          JSON.stringify(PATH_CHECKPOINT_PIXELS)
      ) {
        throw new Error("checkpoint contract/source mismatch");
      }
      wasmBytes = await fetchBytes("/artifacts/graphics-cpu-path-tracer-v1/path-tracer.wasm");
      for (
        const [path, bytes] of [
          ["benchmarks/base-v1/graphics-cpu-path-tracer/engine.js", engineBytes],
          ["benchmarks/base-v1/graphics-cpu-path-tracer/reference.js", referenceBytes],
          ["public/benchmarks/graphics-cpu-path-tracer-v1/runner.js", runnerBytes],
          ["public/benchmarks/graphics-cpu-path-tracer-v1/worker.js", workerBytes],
          [
            "benchmarks/base-v1/graphics-cpu-path-tracer/implementation-contract.v1.json",
            contractBytes,
          ],
          ["public/artifacts/graphics-cpu-path-tracer-v1/path-tracer.wasm", wasmBytes],
        ]
      ) {
        const record = manifest.files.find((entry) => entry.path === path);
        if (!record || record.sha256 !== await hash(bytes)) {
          throw new Error(`${path} raw-byte mismatch`);
        }
      }
    }
    self.postMessage({ token, type: "progress", phase: "compute" });
    let result;
    if (target === "javascript") result = renderJavaScript(width, height, spp);
    else {
      wasmBytes ??= await fetchBytes("/artifacts/graphics-cpu-path-tracer-v1/path-tracer.wasm");
      const { instance } = await WebAssembly.instantiate(wasmBytes, {});
      result = readWasmResult(instance, width, height, spp);
    }
    self.postMessage({ token, type: "progress", phase: "oracle" });
    const reference = renderReference(width, height, spp),
      comparison = compareToReference(result.framebuffer, reference);
    if (!comparison.passed) {
      throw new Error(`reference tolerance failed ${JSON.stringify(comparison)}`);
    }
    const framebufferHash = await hash(result.framebuffer);
    const checkpointIndices = sampleCheckpointPixels(width, height);
    const checkpoints = checkpointIndices.map((pixel) => ({
      pixel,
      rgba: Array.from(result.framebuffer.slice(pixel * 4, pixel * 4 + 4)),
    }));
    if (exact) {
      const expectedHash = target === "javascript"
        ? manifest.oracle.jsFramebufferSha256
        : manifest.oracle.wasmFramebufferSha256;
      if (framebufferHash !== expectedHash) throw new Error("complete framebuffer hash mismatch");
      const expectedCounter = target === "javascript"
        ? manifest.oracle.jsCounters
        : manifest.oracle.wasmCounters;
      if (!evidenceEquals(result.counters, expectedCounter)) {
        throw new Error("complete counter mismatch");
      }
      const variantKey = target === "javascript" ? "js" : "wasm";
      const expectedCheckpoints = manifest.oracle.checkpoints.map((checkpoint) => ({
        pixel: checkpoint.pixel,
        rgba: checkpoint[variantKey],
      }));
      if (JSON.stringify(checkpoints) !== JSON.stringify(expectedCheckpoints)) {
        throw new Error("five sample checkpoint mismatch");
      }
      if (
        target === "javascript" &&
        !evidenceEquals(result.checkpoints, manifest.oracle.pathCheckpoints)
      ) {
        throw new Error("path checkpoint mismatch");
      }
    }
    const transfer = result.framebuffer.buffer;
    self.postMessage({
      token,
      type: "complete",
      target,
      mode,
      width,
      height,
      spp,
      framebufferHash,
      comparison,
      counters: result.counters,
      checkpoints,
      framebuffer: transfer,
    }, [transfer]);
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

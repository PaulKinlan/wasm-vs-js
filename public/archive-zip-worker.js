// Browser-served absolute module route.
// @ts-ignore Deno checks this file from disk, while browsers resolve it from the site root.
import {
  assertExactCounters,
  BOUNDED_ENTRY_COUNT,
  ENTRY_COUNT,
  inspectArchive,
  runJavaScript,
  SELECTED_INDICES,
} from "/benchmarks/v1/archive-zip-workspace/engine.js";

const ARTIFACT_BASE = "/artifacts/archive-zip-workspace-v1/";

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
async function fetchJsonBytes(path) {
  const bytes = await fetchBytes(path);
  return { bytes, json: JSON.parse(new TextDecoder().decode(bytes)) };
}
function equalBytes(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function verifyExactGraph() {
  const [build, fixture, output, wasm, engine] = await Promise.all([
    fetchJsonBytes(`${ARTIFACT_BASE}build-manifest.json`),
    fetchJsonBytes(`${ARTIFACT_BASE}fixture-manifest.json`),
    fetchJsonBytes(`${ARTIFACT_BASE}output-manifest.json`),
    fetchBytes(`${ARTIFACT_BASE}archive-zip-workspace.wasm`),
    fetchBytes("/benchmarks/v1/archive-zip-workspace/engine.js"),
  ]);
  const artifactHash = await sha256(wasm);
  if (artifactHash !== build.json.artifact.sha256) throw new Error("Wasm artifact hash mismatch");
  if (
    fixture.json.workloadId !== "archive.zip-workspace.v1" ||
    fixture.json.generator.entryCount !== 10_000
  ) {
    throw new Error("fixture manifest structure mismatch");
  }
  if (output.json.fixedWork.paths !== 10_000 || output.json.fixedWork.selectedExtractions !== 10) {
    throw new Error("output manifest structure mismatch");
  }
  const engineRecord = build.json.sourceGraph.find((item) =>
    item.path === "benchmarks/v1/archive-zip-workspace/engine.js"
  );
  if (!engineRecord || await sha256(engine) !== engineRecord.sha256) {
    throw new Error("JavaScript engine hash mismatch");
  }
  return { build, fixture, output, wasm };
}

async function runWasm(wasm, mode) {
  const { instance } = await WebAssembly.instantiate(wasm);
  const exports = instance.exports;
  const run = mode === "full" ? exports.archive_run : exports.archive_run_bounded;
  if (run() !== 0) throw new Error("Wasm archive workload failed");
  const memory = new Uint8Array(exports.memory.buffer);
  const copy = (pointer, length) => memory.slice(pointer(), pointer() + length());
  const archive = copy(exports.archive_ptr, exports.archive_length);
  const listing = copy(exports.listing_ptr, exports.listing_length);
  const extracted = copy(exports.extracted_ptr, exports.extracted_length);
  const values = [...new Uint32Array(exports.memory.buffer, exports.counters_ptr(), 15)];
  return {
    archive,
    listing,
    extracted,
    counters: {
      entries: values[0],
      inputBytes: values[1],
      crcBytes: values[2],
      deflateLiterals: values[3],
      deflateMatches: values[4],
      deflateMatchedBytes: values[5],
      deflateEndSymbols: values[6],
      localHeaders: values[7],
      centralHeaders: values[8],
      zip64Records: values[9],
      listedEntries: values[10],
      extractedEntries: values[11],
      extractedBytes: values[12],
      boundaryCrossings: values[13],
      zipBytes: values[14],
    },
  };
}

self.onmessage = async (event) => {
  const { token, target, mode } = event.data ?? {};
  try {
    if (target !== "javascript" && target !== "wasm") throw new Error("unknown target");
    if (mode !== "bounded" && mode !== "full") throw new Error("unknown demo mode");
    const graph = await verifyExactGraph();
    const entryCount = mode === "full" ? ENTRY_COUNT : BOUNDED_ENTRY_COUNT;
    const result = target === "javascript"
      ? runJavaScript(entryCount)
      : await runWasm(graph.wasm, mode);
    const hashes = {
      archiveSha256: await sha256(result.archive),
      listingSha256: await sha256(result.listing),
      extractedSha256: await sha256(result.extracted),
    };
    if (mode === "full") {
      for (const [key, value] of Object.entries(hashes)) {
        if (value !== graph.output.json.outputs[key]) throw new Error(`${key} oracle mismatch`);
      }
      const variant = target === "javascript" ? "js-controlled" : "wasm-linear-controlled";
      assertExactCounters(result.counters, graph.output.json.counters[variant]);
    }
    if (target === "wasm") {
      const selected = SELECTED_INDICES.filter((index) => index < entryCount);
      const replay = inspectArchive(result.archive, selected, entryCount);
      if (
        !equalBytes(replay.listing, result.listing) ||
        !equalBytes(replay.extracted, result.extracted)
      ) {
        throw new Error("independent JavaScript ZIP inspection mismatch");
      }
    }
    self.postMessage({
      token,
      type: "complete",
      target,
      mode,
      entryCount,
      hashes,
      counters: result.counters,
    });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

// @ts-ignore Browser same-origin route, mapped by server.ts.
import {
  assertEquivalent,
  instantiateWasm,
  runJavaScript,
  runWasm,
  sha256Hex,
} from "/benchmarks/base/ml-keyword-spotting/engine.js";

function parseWav(bytes) {
  const raw = new Uint8Array(bytes);
  const view = new DataView(bytes);
  const text = new TextDecoder();
  if (text.decode(raw.subarray(0, 4)) !== "RIFF" || text.decode(raw.subarray(8, 12)) !== "WAVE") {
    throw new Error("selected file is not RIFF/WAVE");
  }
  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= raw.length) {
    const id = text.decode(raw.subarray(offset, offset + 4));
    const length = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      format = {
        tag: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    }
    if (id === "data") data = raw.slice(body, body + length);
    offset = body + length + (length & 1);
  }
  if (
    !format || format.tag !== 1 || format.channels !== 1 || format.rate !== 16000 ||
    format.bits !== 16 || !data
  ) throw new Error("selected WAV must be mono PCM16 at 16000 Hz");
  const normalized = new Uint8Array(32000);
  normalized.set(data.subarray(0, normalized.length));
  return normalized;
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
async function exactContract() {
  const registration = await fetchJsonBytes(
    "/artifacts/base-ml-keyword-spotting/registration.v1.json",
  );
  if (
    registration.json.workloadId !== "ml.keyword-spotting.v1" ||
    registration.json.status !== "proposal-validation-complete"
  ) throw new Error("registration identity/status mismatch");
  const served = new Map([
    [
      "benchmarks/base/ml-keyword-spotting/engine.js",
      "/benchmarks/base/ml-keyword-spotting/engine.js",
    ],
    [
      "benchmarks/base/ml-keyword-spotting/constants.v1.js",
      "/benchmarks/base/ml-keyword-spotting/constants.v1.js",
    ],
    [
      "benchmarks/base/ml-keyword-spotting/speech-commands-subset.v1.json",
      "/artifacts/base-ml-keyword-spotting/fixture-manifest.json",
    ],
    [
      "benchmarks/base/ml-keyword-spotting/model-checkpoint.v1.json",
      "/artifacts/base-ml-keyword-spotting/model-checkpoint.v1.json",
    ],
  ]);
  for (const source of registration.json.sourceGraph) {
    const route = served.get(source.path);
    if (!route) continue;
    if (await sha256Hex(await fetchBytes(route)) !== source.sha256) {
      throw new Error(`raw source hash mismatch: ${source.path}`);
    }
  }
  const artifact = await fetchBytes("/artifacts/base-ml-keyword-spotting/keyword-spotting.wasm");
  if (
    artifact.length !== registration.json.artifact.bytes ||
    await sha256Hex(artifact) !== registration.json.artifact.sha256
  ) throw new Error("raw Wasm artifact hash mismatch");
  const output = await fetchJsonBytes(
    "/artifacts/base-ml-keyword-spotting/output-manifest.v1.json",
  );
  return { registration: registration.json, output: output.json, artifact };
}
function typedHash(value) {
  return sha256Hex(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
}
self.addEventListener("message", async (event) => {
  const { token, target, mode, files } = event.data;
  try {
    if (!["both", "javascript", "wasm-linear"].includes(target)) throw new Error("unknown target");
    if (mode !== "exact") throw new Error("only exact mode is available");
    self.postMessage({ token, type: "progress", phase: "contract", hops: 0 });
    const fixture = await fetchJsonBytes(
      "/artifacts/base-ml-keyword-spotting/fixture-manifest.json",
    );
    const exact = await exactContract();
    const bySuffix = new Map();
    for (const selected of files) {
      const normalizedPath = selected.path.replaceAll("\\", "/");
      for (const entry of fixture.json.files) {
        if (normalizedPath.endsWith(entry.path)) bySuffix.set(entry.path, selected.bytes);
      }
    }
    const pcmBytes = new Uint8Array(1920000);
    let pcmOffset = 0;
    for (const entry of fixture.json.files) {
      const selected = bySuffix.get(entry.path);
      if (!selected) throw new Error(`missing prescribed file: ${entry.path}`);
      const raw = new Uint8Array(selected);
      if (raw.length !== entry.wavBytes || await sha256Hex(raw) !== entry.wavSha256) {
        throw new Error(`WAV hash mismatch: ${entry.path}`);
      }
      const normalized = parseWav(selected);
      if (await sha256Hex(normalized) !== entry.normalizedPcmSha256) {
        throw new Error(`normalized PCM mismatch: ${entry.path}`);
      }
      pcmBytes.set(normalized, pcmOffset);
      pcmOffset += normalized.length;
    }
    if (await sha256Hex(pcmBytes) !== fixture.json.normalizedPcmSha256) {
      throw new Error("combined 60-second PCM hash mismatch");
    }
    const pcm = new Int16Array(pcmBytes.buffer);
    const results = {};
    self.postMessage({
      token,
      type: "progress",
      phase: "complete preprocessing and inference",
      hops: 0,
    });
    if (target === "both" || target === "javascript") results.javascript = runJavaScript(pcm);
    if (target === "both" || target === "wasm-linear") {
      results.wasm = runWasm(await instantiateWasm(exact.artifact), pcm);
    }
    if (results.javascript && results.wasm) assertEquivalent(results.javascript, results.wasm);
    const selectedResult = results.javascript ?? results.wasm;
    const resultHashes = {};
    for (const [resultTarget, value] of Object.entries(results)) {
      const hashes = {
        features: await typedHash(value.features),
        scores: await typedHash(value.scores),
        detections: await typedHash(value.detections),
      };
      for (const name of Object.keys(hashes)) {
        if (hashes[name] !== exact.output.outputs[name].sha256) {
          throw new Error(`${resultTarget} ${name} oracle hash mismatch`);
        }
      }
      const variant = resultTarget === "javascript" ? "js-controlled" : "wasm-linear-controlled";
      if (
        JSON.stringify(value.counters) !== JSON.stringify(exact.output.variants[variant].counters)
      ) {
        throw new Error(`${resultTarget} counter oracle mismatch`);
      }
      resultHashes[resultTarget] = hashes;
    }
    const hashes = resultHashes.javascript ?? resultHashes.wasm;
    self.postMessage({ token, type: "progress", phase: "validated", hops: 3000 });
    self.postMessage({
      token,
      type: "complete",
      result: {
        target,
        mode,
        fixtureSha256: fixture.json.normalizedPcmSha256,
        hashes,
        detections: selectedResult.detections.length / 3,
        jsCounters: results.javascript?.counters ?? null,
        wasmCounters: results.wasm?.counters ?? null,
        tensorsValidated: true,
        detectionsValidated: true,
        countersValidated: true,
        crossTargetExact: Boolean(results.javascript && results.wasm),
      },
    });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

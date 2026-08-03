// @ts-ignore Browser same-origin route, mapped by server.ts.
import { runWorkload } from "/benchmarks/base/crypto-authenticated-stream/workload.js";

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function sha256(bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}
async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
function decodeJson(bytes, path) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error(`${path} is not valid UTF-8 JSON`);
  }
}

self.addEventListener("message", async (event) => {
  const { token, variant, mode } = event.data ?? {};
  try {
    if (variant !== "js-controlled" && variant !== "wasm-linear-controlled") {
      throw new Error("unknown target");
    }
    if (mode !== "bounded" && mode !== "exact") throw new Error("unknown work contract");
    const wasmPath = "/artifacts/crypto-authenticated-stream/crypto-authenticated-stream.wasm";
    const wasm = await fetchBytes(wasmPath);
    const result = await runWorkload(variant, wasm, mode === "exact" ? 10_000 : 256);
    const verification = { mode, rawByteChecks: [], fullOracle: mode === "exact" };
    if (mode === "exact") {
      const buildPath = "/artifacts/crypto-authenticated-stream/build-manifest.json";
      const fixturePath = "/artifacts/crypto-authenticated-stream/fixture-manifest.json";
      const outputPath = "/artifacts/crypto-authenticated-stream/output-manifest.json";
      const registrationPath = "/benchmarks/base/crypto-authenticated-stream/registration.v1.json";
      const [buildBytes, fixtureBytes, outputBytes, registrationBytes] = await Promise.all([
        fetchBytes(buildPath),
        fetchBytes(fixturePath),
        fetchBytes(outputPath),
        fetchBytes(registrationPath),
      ]);
      const build = decodeJson(buildBytes, buildPath);
      const output = decodeJson(outputBytes, outputPath);
      const registration = decodeJson(registrationBytes, registrationPath);
      const artifactHash = await sha256(wasm);
      if (artifactHash !== build.artifact?.sha256) throw new Error("Wasm artifact hash mismatch");
      for (const [path, bytes] of [[fixturePath, fixtureBytes], [outputPath, outputBytes]]) {
        const expected = build.manifests?.find((entry) =>
          `/${entry.path.replace(/^public\//, "")}` === path
        )?.sha256;
        const actual = await sha256(bytes);
        if (!expected || actual !== expected) throw new Error(`${path} raw-byte hash mismatch`);
        verification.rawByteChecks.push({ path, sha256: actual });
      }
      const oracle = registration.oracle;
      if (
        result.cipherTranscriptSha256 !== oracle.cipherTranscriptSha256 ||
        result.plaintextTranscriptSha256 !== oracle.plaintextTranscriptSha256
      ) {
        throw new Error("registered complete transcript oracle mismatch");
      }
      const recorded = output.variants?.[variant];
      if (
        !recorded || recorded.cipherTranscriptSha256 !== result.cipherTranscriptSha256 ||
        recorded.plaintextTranscriptSha256 !== result.plaintextTranscriptSha256 ||
        JSON.stringify(recorded.counters) !== JSON.stringify(result.counters)
      ) {
        throw new Error("output manifest result/counter mismatch");
      }
      verification.rawByteChecks.push({ path: wasmPath, sha256: artifactHash });
      verification.manifestBytes = {
        build: { path: buildPath, sha256: await sha256(buildBytes) },
        registration: { path: registrationPath, sha256: await sha256(registrationBytes) },
      };
    }
    self.postMessage({ token, type: "complete", result: { ...result, verification } });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : "run failed",
    });
  }
});

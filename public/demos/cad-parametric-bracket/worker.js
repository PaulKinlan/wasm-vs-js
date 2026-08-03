import { generateFixture } from "/benchmarks/base/cad-parametric-bracket/fixture.js";
import {
  instantiateBracketWasm,
  runJavaScript,
  runWasm,
} from "/benchmarks/base/cad-parametric-bracket/engine.js";

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

self.onmessage = async (event) => {
  if (event.data?.type !== "start") return;
  const { token, variantId } = event.data;
  try {
    const fixture = generateFixture();
    let value;
    if (variantId === "js-controlled") {
      value = runJavaScript(fixture);
    } else if (variantId === "wasm-linear-controlled") {
      const response = await fetch("/artifacts/base-cad-parametric-bracket/bracket.wasm", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Wasm fetch failed: HTTP ${response.status}`);
      value = runWasm(await instantiateBracketWasm(await response.arrayBuffer()), fixture);
    } else {
      throw new Error("Unknown controlled target");
    }
    const manifestResponse = await fetch(
      "/artifacts/base-cad-parametric-bracket/output-manifest.json",
      { cache: "no-store" },
    );
    if (!manifestResponse.ok) {
      throw new Error(`Oracle fetch failed: HTTP ${manifestResponse.status}`);
    }
    const manifest = await manifestResponse.json();
    const completeOutputSha256 = await sha256Hex(value.output);
    if (
      completeOutputSha256 !== manifest.completeOutputSha256 ||
      value.completeOutputDigest !== manifest.completeOutputDigest ||
      value.triangleCount !== manifest.triangleCount ||
      JSON.stringify(value.topology) !== JSON.stringify(manifest.topology)
    ) throw new Error("Frozen complete-output oracle mismatch");
    self.postMessage({
      type: "result",
      token,
      result: {
        variantId: value.variantId,
        oracleVerified: true,
        completeOutputSha256,
        completeOutputDigest: value.completeOutputDigest,
        triangleCount: value.triangleCount,
        topology: value.topology,
        counters: value.counters,
      },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

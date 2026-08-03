import { generateFixture } from "/benchmarks/base/cad-parametric-bracket/fixture.js";
import {
  instantiateBracketWasm,
  runJavaScript,
  runWasm,
} from "/benchmarks/base/cad-parametric-bracket/engine.js";

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
    self.postMessage({
      type: "result",
      token,
      result: {
        variantId: value.variantId,
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

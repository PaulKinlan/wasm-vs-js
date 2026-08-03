import {
  instantiateOlapWasm,
  OLAP_VARIANTS,
  runOlapJavaScript,
  runOlapWasm,
} from "/benchmarks/base/database-olap-chart/engine.js";

self.onmessage = async ({ data }) => {
  if (!data || data.type !== "start" || !Number.isSafeInteger(data.token)) return;
  const { token, variantId } = data;
  if (!OLAP_VARIANTS.includes(variantId)) {
    self.postMessage({ type: "error", token, message: "Target is not in the fixed allowlist." });
    return;
  }
  try {
    let value;
    if (variantId === "js-controlled") value = runOlapJavaScript();
    else {
      const response = await fetch("/artifacts/database-olap-chart/database-olap-chart.wasm", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Wasm fetch failed: ${response.status}`);
      value = runOlapWasm(await instantiateOlapWasm(await response.arrayBuffer()));
    }
    const { output: _output, ...result } = value;
    self.postMessage({ type: "result", token, result });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : "Worker failed.",
    });
  }
};

// @ts-ignore Browser same-origin route, mapped by server.ts.
import { runDiffJS, runDiffWasm } from "/benchmarks/v2/text-diff-patch/workload.js";
const MAX_BYTES = 16_384;
const MAX_LINES = 512;
const encoder = new TextEncoder();
function lines(value) {
  if (encoder.encode(value).length > MAX_BYTES) {
    throw new Error(`each document is limited to ${MAX_BYTES} UTF-8 bytes`);
  }
  const result = value.replace(/\r\n?/gu, "\n").split("\n");
  if (result.length > MAX_LINES) throw new Error(`each document is limited to ${MAX_LINES} lines`);
  return result;
}
self.onmessage = async ({ data }) => {
  const { token, values } = data;
  try {
    const base = lines(String(values.base ?? ""));
    const target = lines(String(values.target ?? ""));
    let result;
    if (values.variant === "wasm-linear-controlled") {
      const response = await fetch("/artifacts/text-diff-patch/text-diff-patch.wasm");
      if (!response.ok) throw new Error("Wasm artifact could not be loaded");
      result = await runDiffWasm(base, target, new Uint8Array(await response.arrayBuffer()));
    } else result = await runDiffJS(base, target);
    const preview = result.operations.slice(0, 80).map(([kind, ai, bi, id]) =>
      `${["equal", "delete", "insert"][kind]} base=${ai} target=${bi} line-id=${id}`
    ).join("\n");
    self.postMessage({
      token,
      type: "complete",
      text: `Variant: ${values.variant}\nScript SHA-256: ${result.digestSha256}\nCounters: ${
        JSON.stringify(result.counters, null, 2)
      }\n\nCanonical operations${result.operations.length > 80 ? " (first 80)" : ""}:\n${preview}`,
    });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : "unknown worker error",
    });
  }
};

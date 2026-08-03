// @ts-ignore Browser same-origin route, mapped by server.ts.
import {
  RAW_HTML_LIMIT_BYTES,
  renderMarkdown,
  renderMarkdownWasm,
  sha256Hex,
} from "/benchmarks/v2/text-markdown-cms/workload.js";
const encoder = new TextEncoder();
const VARIANTS = new Set(["js-controlled", "wasm-linear-controlled"]);
self.onmessage = async ({ data }) => {
  const { token, values } = data;
  try {
    if (!VARIANTS.has(values.variant)) throw new Error("unknown variant denied");
    const source = String(values.source ?? "");
    if (encoder.encode(source).length > RAW_HTML_LIMIT_BYTES) {
      throw new Error(`source is limited to ${RAW_HTML_LIMIT_BYTES} UTF-8 bytes`);
    }
    let result;
    if (values.variant === "wasm-linear-controlled") {
      const response = await fetch("/artifacts/text-markdown-cms/text-markdown-cms.wasm");
      if (!response.ok) throw new Error("Wasm artifact could not be loaded");
      result = await renderMarkdownWasm(source, new Uint8Array(await response.arrayBuffer()));
    } else if (values.variant === "js-controlled") result = renderMarkdown(source);
    else throw new Error("unknown variant denied");
    self.postMessage({
      token,
      type: "complete",
      text: `Variant: ${values.variant}\nCanonical HTML SHA-256: ${await sha256Hex(
        result.outputBytes,
      )}\nRejected nodes: ${result.rejected}\nCounters: ${
        JSON.stringify(result.counters, null, 2)
      }\n\nCanonical HTML source (displayed as text, never inserted):\n${result.html}`,
    });
  } catch (error) {
    self.postMessage({
      token,
      type: "error",
      message: error instanceof Error ? error.message : "unknown worker error",
    });
  }
};

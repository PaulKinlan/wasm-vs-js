import { runJavaScript, runWasm } from "/benchmarks/base/document-pdf-viewer/engine.js";

self.addEventListener("message", async (event) => {
  const { token, target } = event.data ?? {};
  if (!Number.isInteger(token) || !["javascript", "wasm-linear"].includes(target)) return;
  try {
    const pdfResponse = await fetch("/artifacts/document-pdf-viewer/report-100-pages.pdf", {
      cache: "no-store",
    });
    if (!pdfResponse.ok) throw new Error(`PDF fetch failed: ${pdfResponse.status}`);
    const pdf = new Uint8Array(await pdfResponse.arrayBuffer());
    let result;
    if (target === "javascript") result = await runJavaScript(pdf);
    else {
      const wasmResponse = await fetch("/artifacts/document-pdf-viewer/pdf-engine.wasm", {
        cache: "no-store",
      });
      if (!wasmResponse.ok) throw new Error(`Wasm fetch failed: ${wasmResponse.status}`);
      result = await runWasm(pdf, new Uint8Array(await wasmResponse.arrayBuffer()));
    }
    self.postMessage({ token, ok: true, result });
  } catch (error) {
    self.postMessage({
      token,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

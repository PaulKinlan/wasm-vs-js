import {
  instantiateGridWasm,
  runJavaScript,
  runWasm,
  VARIANTS,
} from "/benchmarks/base/dom-virtualized-grid/engine.js";

async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) =>
    value.toString(16).padStart(2, "0")
  ).join("");
}

async function fetchBytes(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

self.onmessage = async ({ data }) => {
  if (!data || data.type !== "start" || !Number.isSafeInteger(data.token)) return;
  const { token, variantId } = data;
  if (!VARIANTS.includes(variantId)) {
    self.postMessage({ type: "error", token, message: "Target is not in the fixed allowlist." });
    return;
  }
  try {
    if (Number.isInteger(data.holdMs) && data.holdMs > 0 && data.holdMs <= 1000) {
      await new Promise((resolve) => setTimeout(resolve, data.holdMs));
    }
    const manifestBytes = await fetchBytes(
      "/artifacts/dom-virtualized-grid-v1/build-manifest.json",
    );
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    const fixture = await fetchBytes("/artifacts/dom-virtualized-grid-v1/fixture.bin");
    if (await sha256(fixture) !== manifest.artifacts.fixture.sha256) {
      throw new Error("Fixture raw-byte hash mismatch");
    }
    let result;
    if (variantId === "js-controlled") {
      result = runJavaScript(fixture);
    } else {
      const wasmBytes = await fetchBytes("/artifacts/dom-virtualized-grid-v1/grid.wasm");
      if (await sha256(wasmBytes) !== manifest.artifacts.wasm.sha256) {
        throw new Error("Wasm raw-byte hash mismatch");
      }
      const wasm = await instantiateGridWasm(wasmBytes);
      result = runWasm(wasm, fixture);
    }
    const commands = result.commands;
    self.postMessage({
      type: "result",
      token,
      result: { ...result, commands: undefined, buildManifestSha256: await sha256(manifestBytes) },
      commands: commands.buffer,
    }, [commands.buffer]);
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : "Worker failed.",
    });
  }
};

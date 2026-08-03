import { generateFixture } from "/benchmarks/base/simulation-nbody/fixture.js";
import {
  instantiateNbodyWasm,
  runJavaScript,
  runWasm,
} from "/benchmarks/base/simulation-nbody/engine.js";

let activeToken = null;
self.onmessage = async (event) => {
  const message = event.data;
  if (!message || message.type !== "start" || !Number.isSafeInteger(message.token)) return;
  if (!["js-controlled", "wasm-linear-controlled"].includes(message.variantId)) {
    self.postMessage({
      type: "error",
      token: message.token,
      message: "Target is not in the fixed allowlist.",
    });
    return;
  }
  activeToken = message.token;
  try {
    const fixture = generateFixture();
    let result;
    if (message.variantId === "js-controlled") result = runJavaScript(fixture);
    else {
      const response = await fetch("/artifacts/base-simulation-nbody/nbody.wasm", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Wasm fetch failed: ${response.status}`);
      result = runWasm(
        await instantiateNbodyWasm(new Uint8Array(await response.arrayBuffer())),
        fixture,
      );
    }
    if (activeToken !== message.token) return;
    const { output: _output, ...serializable } = result;
    self.postMessage({ type: "result", token: message.token, result: serializable });
  } catch (error) {
    if (activeToken === message.token) {
      self.postMessage({
        type: "error",
        token: message.token,
        message: error instanceof Error ? error.message : "Worker failed.",
      });
    }
  }
};

import { GAME_IDS } from "../../../benchmarks/v2/game-family/fixtures.js";
import {
  GAME_VARIANTS,
  instantiateGameWasm,
  runGameJavaScript,
  runGameWasmHybrid,
} from "../../../benchmarks/v2/game-family/engine.js";

let wasm;
self.onmessage = async (event) => {
  const message = event.data;
  if (!message || message.type !== "start" || !Number.isSafeInteger(message.token)) return;
  const { token, workloadId, variantId } = message;
  if (!GAME_IDS.includes(workloadId) || !GAME_VARIANTS.includes(variantId)) {
    self.postMessage({
      type: "error",
      token,
      message: "Requested workload or variant is not in the fixed allowlist.",
    });
    return;
  }
  try {
    let result;
    if (variantId === "js-controlled") {
      result = runGameJavaScript(workloadId);
    } else {
      wasm ??= instantiateGameWasm(
        new Uint8Array(
          await (await fetch("/artifacts/game-v2-controlled-family/game-family.wasm", {
            cache: "no-store",
          })).arrayBuffer(),
        ),
      );
      result = runGameWasmHybrid(workloadId, await wasm);
    }
    self.postMessage({ type: "result", token, result });
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : "Worker failed.",
    });
  }
};

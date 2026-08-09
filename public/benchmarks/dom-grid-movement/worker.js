import {
  generateGridActions,
  instantiateGridWasm,
  runGridMovementJS,
  runGridMovementWasm,
} from "./engine.js";

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "run") return;
  const { token, target } = message;

  (async () => {
    const actions = generateGridActions();
    let result;
    if (target === "javascript" || target === "js-controlled") {
      result = runGridMovementJS(actions);
    } else if (target === "wasm") {
      // REAL Wasm kernel: the model trace runs in linear memory (dom_grid.c).
      const instance = await instantiateGridWasm();
      result = runGridMovementWasm(actions, instance);
    } else {
      throw new Error(`unknown target: ${target}`);
    }
    self.postMessage({
      type: "complete",
      token,
      result: {
        target,
        ...result,
        checkpoints: actions.length,
      },
    });
  })().catch((error) => {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : String(error),
    });
  });
});

import {
  generateScrollActions,
  instantiateVscrollWasm,
  runVirtualizedScrollingJS,
  runVirtualizedScrollingWasm,
} from "./engine.js";

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "run") return;
  const { token, target } = message;

  (async () => {
    const actions = generateScrollActions();
    let result;
    if (target === "javascript") {
      result = runVirtualizedScrollingJS(actions);
    } else if (target === "wasm") {
      // REAL Wasm kernel: the visible-window computation runs in linear
      // memory inside the compiled module (see dom_vscroll.c).
      const instance = await instantiateVscrollWasm();
      result = runVirtualizedScrollingWasm(actions, instance);
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

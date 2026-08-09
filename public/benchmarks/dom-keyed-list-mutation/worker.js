import {
  generateKeyedListActions,
  instantiateKeyedListWasm,
  runKeyedListMutationJS,
  runKeyedListMutationWasmSteps,
} from "./engine.js";

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "run") return;
  const { token, target } = message;

  (async () => {
    const actions = generateKeyedListActions();
    let result;
    if (target === "javascript" || target === "js-controlled") {
      result = runKeyedListMutationJS(actions);
    } else if (target === "wasm") {
      // REAL Wasm kernel (dom_keyed_list.c) — totals identical to the JS model.
      const instance = await instantiateKeyedListWasm();
      result = runKeyedListMutationWasmSteps(actions, instance);
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

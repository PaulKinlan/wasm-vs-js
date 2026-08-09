import {
  generateNestedTreeActions,
  instantiateNestedTreeWasm,
  runNestedTreeMutationJS,
  runNestedTreeMutationWasmSteps,
} from "./engine.js";

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "run") return;
  const { token, target } = message;

  (async () => {
    const actions = generateNestedTreeActions();
    let result;
    if (target === "javascript" || target === "js-controlled") {
      result = runNestedTreeMutationJS(actions);
    } else if (target === "wasm") {
      // REAL Wasm kernel (dom_nested_tree.c).
      const instance = await instantiateNestedTreeWasm();
      result = runNestedTreeMutationWasmSteps(actions, instance);
    } else {
      throw new Error(`unknown target: ${target}`);
    }
    self.postMessage({
      type: "complete",
      token,
      result: { target, ...result, checkpoints: actions.length },
    });
  })().catch((error) => {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : String(error),
    });
  });
});

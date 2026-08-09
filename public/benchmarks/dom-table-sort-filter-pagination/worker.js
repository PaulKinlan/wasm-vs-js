import {
  generateTableActions,
  instantiateTableSortWasm,
  runTableSortFilterJS,
  runTableSortWasmSteps,
} from "./engine.js";

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "run") return;
  const { token, target } = message;

  (async () => {
    const actions = generateTableActions();
    let result;
    if (target === "javascript" || target === "js-controlled") {
      result = runTableSortFilterJS(actions);
    } else if (target === "wasm") {
      // REAL Wasm kernel (dom_table_sort.c) — totals identical to the JS model.
      const instance = await instantiateTableSortWasm();
      result = runTableSortWasmSteps(actions, instance);
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

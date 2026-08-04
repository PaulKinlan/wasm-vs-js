import { generateTableActions, runTableSortFilterJS, runTableSortFilterWasm } from "./engine.js";

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "run") return;
  const { token, target } = message;

  try {
    const actions = generateTableActions();
    let result;
    if (target === "javascript" || target === "js-controlled") {
      result = runTableSortFilterJS(actions);
    } else {
      result = runTableSortFilterWasm(actions);
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
  } catch (error) {
    self.postMessage({
      type: "error",
      token,
      message: error instanceof Error ? error.message : "Worker error",
    });
  }
});

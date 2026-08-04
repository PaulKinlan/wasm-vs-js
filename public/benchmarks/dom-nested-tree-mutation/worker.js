import {
  generateNestedTreeActions,
  runNestedTreeMutationJS,
  runNestedTreeMutationWasm,
} from "./engine.js";

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "run") return;
  const { token, target } = message;

  try {
    const actions = generateNestedTreeActions();
    let result;
    if (target === "javascript" || target === "js-controlled") {
      result = runNestedTreeMutationJS(actions);
    } else {
      result = runNestedTreeMutationWasm(actions);
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

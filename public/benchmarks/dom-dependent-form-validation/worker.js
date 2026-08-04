import { generateFormActions, runFormValidationJS, runFormValidationWasm } from "./engine.js";

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "run") return;
  const { token, target } = message;

  try {
    const actions = generateFormActions();
    let result;
    if (target === "javascript" || target === "js-controlled") {
      result = runFormValidationJS(actions);
    } else {
      result = runFormValidationWasm(actions);
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

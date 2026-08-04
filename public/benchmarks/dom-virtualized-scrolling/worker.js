import {
  generateScrollActions,
  runVirtualizedScrollingJS,
  runVirtualizedScrollingWasm,
} from "./engine.js";

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "run") return;
  const { token, target } = message;

  try {
    const actions = generateScrollActions();
    let result;
    if (target === "javascript" || target === "js-controlled") {
      result = runVirtualizedScrollingJS(actions);
    } else {
      result = runVirtualizedScrollingWasm(actions);
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

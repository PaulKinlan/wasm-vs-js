import {
  generateFormActions,
  instantiateFormValidateWasm,
  runFormValidationJS,
  runFormValidationWasmSteps,
} from "./engine.js";

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "run") return;
  const { token, target } = message;

  (async () => {
    const actions = generateFormActions();
    let result;
    if (target === "javascript" || target === "js-controlled") {
      result = runFormValidationJS(actions);
    } else if (target === "wasm") {
      // REAL Wasm kernel (dom_form_validate.c) — mirrors the JS model exactly.
      const instance = await instantiateFormValidateWasm();
      result = runFormValidationWasmSteps(actions, instance);
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

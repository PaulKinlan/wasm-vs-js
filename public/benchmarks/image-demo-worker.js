import { runImageDemo } from "./image-demo-worker-core.js";

let accepted = false;
globalThis.addEventListener("message", async (event) => {
  const message = event.data;
  if (accepted || !message || message.type !== "run" || typeof message.token !== "string") return;
  accepted = true;
  try {
    const result = await runImageDemo(message);
    const transfers = [result.output.buffer];
    if (result.mask) transfers.push(result.mask.buffer);
    globalThis.postMessage({ type: "result", token: message.token, result }, {
      transfer: transfers,
    });
  } catch (error) {
    globalThis.postMessage({
      type: "error",
      token: message.token,
      message: error instanceof Error ? error.message : "worker failed",
    });
  }
});

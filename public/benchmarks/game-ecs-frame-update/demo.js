const form = document.querySelector("#ecs-form");
const target = document.querySelector("#ecs-target");
const start = document.querySelector("#ecs-start");
const cancel = document.querySelector("#ecs-cancel");
const status = document.querySelector("#ecs-status");
const output = document.querySelector("#ecs-output");
const TIMEOUT_MS = 120_000;
let worker = null;
let timeout = null;
let token = 0;

function cleanup() {
  token += 1;
  if (timeout !== null) clearTimeout(timeout);
  timeout = null;
  if (worker) worker.terminate();
  worker = null;
  start.disabled = false;
  cancel.disabled = true;
  target.disabled = false;
}
function fail(message) {
  cleanup();
  status.textContent = message;
  output.textContent = "No accepted result.";
}
function formatResult(result) {
  return [
    `Variant: ${result.variantId}`,
    `Semantic digest: ${result.semanticDigest}`,
    `Final-state digest: ${result.oracle.finalStateDigest}`,
    `Final-state SHA-256: ${result.oracle.finalStateSha256}`,
    `Checkpoint digest: ${result.oracle.checkpointDigest}`,
    `Complete state words checked: ${result.oracle.finalStateWords}`,
    `Counters: ${JSON.stringify(result.counters, null, 2)}`,
    "",
    "Checkpoints:",
    ...result.oracle.checkpoints.map((item) =>
      `frame=${item.frame} state=${item.stateDigest} pairs=${item.pairTests} collisions=${item.collisions}`
    ),
  ].join("\n");
}
if (document.body?.dataset?.unifiedRunnerActive) {
  // unified-runner.js owns the run control (composed flow).
  if (document.querySelector("#start")) document.querySelector("#start").disabled = false;
} else {
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token;
  const selectedTarget = target.value;
  start.disabled = true;
  cancel.disabled = false;
  target.disabled = true;
  status.textContent = `Running ${selectedTarget}; 10,000 entities × 1,000 frames.`;
  output.textContent = "Worker is running the fixed contract.";
  const runWorker = new Worker("/benchmarks/game-ecs-frame-update/worker.js", { type: "module" });
  worker = runWorker;
  timeout = setTimeout(() => {
    if (worker !== runWorker || token !== runToken) return;
    fail("Stopped after the 120 second limit.");
  }, TIMEOUT_MS);
  runWorker.addEventListener("message", (messageEvent) => {
    if (worker !== runWorker || token !== runToken || messageEvent.data?.token !== runToken) return;
    if (messageEvent.data.type === "error") {
      fail(messageEvent.data.message || "Worker failed.");
      return;
    }
    if (messageEvent.data.type !== "result") return;
    const result = messageEvent.data.result;
    cleanup();
    status.textContent =
      "Complete. The exact fixture, full state, checkpoints, and counters passed.";
    output.textContent = formatResult(result);
  });
  runWorker.addEventListener("error", () => {
    if (worker !== runWorker || token !== runToken) return;
    fail("Worker failed before producing a result.");
  });
  runWorker.postMessage({ type: "start", token: runToken, variantId: selectedTarget });
});
cancel.addEventListener("click", () => {
  if (!worker) return;
  cleanup();
  status.textContent = "Cancelled. The worker was terminated.";
  output.textContent = "No result retained.";
});
addEventListener("pagehide", cleanup, { once: true });
}

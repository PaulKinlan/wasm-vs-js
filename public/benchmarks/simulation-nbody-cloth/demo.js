const target = document.querySelector("#target");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
let worker = null, token = 0, timeout = null;
function cleanup() {
  token++;
  if (timeout !== null) clearTimeout(timeout);
  timeout = null;
  worker?.terminate();
  worker = null;
  start.disabled = false;
  cancel.disabled = true;
}
function stop(message) {
  cleanup();
  status.textContent = message;
}
function begin() {
  cleanup();
  const runToken = token;
  start.disabled = true;
  cancel.disabled = false;
  result.textContent = "No completed result.";
  status.textContent = "Running 1,024 bodies for exactly 120 leapfrog timesteps in a fresh worker…";
  const owned = new Worker("/benchmarks/simulation-nbody-cloth/worker.js", { type: "module" });
  worker = owned;
  owned.onmessage = (event) => {
    if (worker !== owned || event.data?.token !== runToken || token !== runToken) return;
    if (event.data.type === "error") {
      stop(`Failed: ${event.data.message}`);
      return;
    }
    if (event.data.type !== "result") return;
    const value = event.data.result;
    cleanup();
    status.textContent = "Complete. Correctness output only; no duration was collected.";
    result.textContent = [
      `Target: ${value.variantId}`,
      `Complete output digest: ${value.completeOutputDigest}`,
      `Quantized state digest: ${value.quantizedStateDigest}`,
      `Checkpoints: ${value.checkpoints.join(", ")}`,
      `Energy relative drift: ${value.energy.relativeDrift} (limit ${value.energy.tolerance})`,
      `Counters:\n${JSON.stringify(value.counters, null, 2)}`,
    ].join("\n");
  };
  owned.onerror = (event) => {
    if (worker === owned && token === runToken) stop(`Failed: ${event.message || "worker error"}`);
  };
  timeout = setTimeout(() => {
    if (worker === owned && token === runToken) {
      stop("Stopped after the 30-second correctness timeout.");
    }
  }, 30_000);
  owned.postMessage({ type: "start", token: runToken, variantId: target.value });
}
start.addEventListener("click", begin);
cancel.addEventListener("click", () => stop("Cancelled. The worker was terminated."));
addEventListener("pagehide", () => cleanup());
start.disabled = false;

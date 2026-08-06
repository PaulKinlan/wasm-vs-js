const form = document.querySelector("form");
const start = document.querySelector("#cfi-start");
const cancel = document.querySelector("#cfi-cancel");
const status = document.querySelector("#cfi-status");
const output = document.querySelector("#output");
let worker = null;
let token = 0;
let timeout = 0;
function cleanup() {
  token++;
  if (worker) worker.terminate();
  worker = null;
  clearTimeout(timeout);
  timeout = 0;
  start.disabled = false;
  cancel.disabled = true;
}
function stop(message) {
  cleanup();
  status.textContent = message;
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token;
  worker = new Worker("/crypto-file-integrity-worker.js", { type: "module" });
  start.disabled = true;
  cancel.disabled = false;
  output.textContent = "No result while work is in progress.";
  status.textContent = "Starting fresh worker.";
  worker.onmessage = (message) => {
    if (message.data?.token !== runToken || runToken !== token) return;
    if (message.data.type === "progress") {
      status.textContent = message.data.phase;
      return;
    }
    if (message.data.type === "error") {
      output.textContent = message.data.message;
      stop("Validation failed.");
      return;
    }
    if (message.data.type === "complete") {
      output.textContent = JSON.stringify(message.data.result, null, 2);
      stop("Complete. Exact digest and work counters passed.");
    }
  };
  worker.onerror = () => {
    if (runToken === token) stop("Worker failed.");
  };
  const data = new FormData(form);
  worker.postMessage({
    token: runToken,
    target: data.get("target"),
    kind: data.get("kind"),
    byteLength: Number(data.get("size")),
    schedule: data.get("schedule") === "whole-buffer"
      ? "whole-buffer"
      : Number(data.get("schedule")),
  });
  timeout = setTimeout(() => {
    if (runToken === token) stop("Stopped after the 180 second limit.");
  }, 180000);
});
cancel.addEventListener("click", () => stop("Cancelled. The worker was terminated."));
addEventListener("pagehide", cleanup, { once: true });

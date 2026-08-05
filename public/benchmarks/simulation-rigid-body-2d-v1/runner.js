const form = document.querySelector("#rb-demo-form");
const target = document.querySelector("#rb-target");
const start = document.querySelector("#rb-start");
const cancel = document.querySelector("#rb-cancel");
const progress = document.querySelector("#rb-progress");
const status = document.querySelector("#rb-status");
const result = document.querySelector("#rb-result");

let worker = null;
let timeout = 0;
let token = 0;

function cleanup() {
  token += 1;
  if (worker) worker.terminate();
  worker = null;
  clearTimeout(timeout);
  timeout = 0;
  start.disabled = false;
  cancel.disabled = true;
}

function finish(message, detail) {
  cleanup();
  status.textContent = message;
  if (detail) result.textContent = detail;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token;
  const runWorker = new Worker("/benchmarks/simulation-rigid-body-2d-v1/worker.js", {
    type: "module",
  });
  worker = runWorker;
  start.disabled = true;
  cancel.disabled = false;
  progress.value = 0;
  status.textContent = "Loading pinned fixture, manifests, and target…";
  result.textContent = "Running exact fixed work.";
  runWorker.addEventListener("message", (message) => {
    if (worker !== runWorker || token !== runToken || message.data.token !== runToken) return;
    if (message.data.type === "progress") {
      progress.value = message.data.phase;
      status.textContent = message.data.message;
      return;
    }
    if (message.data.type === "complete") {
      progress.value = 3;
      finish("Complete. Correctness checks passed.", JSON.stringify(message.data.result, null, 2));
      return;
    }
    if (message.data.type === "error") finish("Run failed.", message.data.message);
  });
  runWorker.addEventListener("error", (event) => {
    if (worker !== runWorker || token !== runToken) return;
    finish("Worker failed.", event.message || "Unknown worker error");
  });
  timeout = setTimeout(() => {
    if (worker === runWorker && token === runToken) {
      finish("Run stopped after the 30 second limit.");
    }
  }, 30_000);
  runWorker.postMessage({ type: "run", token: runToken, target: target.value });
});

cancel.addEventListener("click", () => {
  if (!worker) return;
  cleanup();
  progress.value = 0;
  status.textContent = "Cancelled. The worker was terminated.";
  result.textContent = "No result retained.";
});

addEventListener("pagehide", cleanup);

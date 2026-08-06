const form = document.querySelector("form");
const start = document.querySelector("#pb-start");
const cancel = document.querySelector("#pb-cancel");
const status = document.querySelector("#pb-status");
const output = document.querySelector("#output");
const progress = document.querySelector("#progress");
let active = null;
let generation = 0;

function cleanup(message) {
  generation += 1;
  if (active) {
    clearTimeout(active.timeout);
    active.worker.terminate();
    active = null;
  }
  start.disabled = false;
  cancel.disabled = true;
  progress.removeAttribute("value");
  if (message) status.textContent = message;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const token = ++generation;
  const worker = new Worker("/polybench-panel-worker.js", { type: "module" });
  const timeout = setTimeout(() => {
    if (active?.token === token) cleanup("Stopped after the 30-second bound.");
  }, 30_000);
  active = { token, worker, timeout };
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Running exact registered work…";
  output.textContent = "No result yet.";
  progress.value = 0;
  progress.max = document.querySelector("#kernel").value === "all" ? 4 : 1;
  worker.onmessage = ({ data }) => {
    if (!active || active.token !== token || data.token !== token) return;
    if (data.type === "progress") {
      progress.value = data.completed;
      return;
    }
    if (data.type === "error") {
      output.textContent = data.message;
      cleanup("Validation failed.");
      return;
    }
    if (data.type === "complete") {
      output.textContent = JSON.stringify(data.results, null, 2);
      cleanup("Complete. Every reported element passed the registered oracle.");
    }
  };
  worker.onerror = (event) => {
    if (!active || active.token !== token) return;
    output.textContent = event.message;
    cleanup("Worker failed.");
  };
  worker.postMessage({
    token,
    target: document.querySelector("#pb-target").value,
    kernel: document.querySelector("#kernel").value,
  });
});
cancel.addEventListener("click", () => cleanup("Cancelled. The worker was terminated."));
addEventListener("pagehide", () => cleanup());

const form = document.querySelector("#document-edit-form");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const output = document.querySelector("#output");
const progress = document.querySelector("#progress");
const TIMEOUT_MS = 120_000;
let generation = 0;
let active = null;

function cleanup(message, text = "") {
  const current = active;
  active = null;
  generation++;
  if (current) {
    clearTimeout(current.timeout);
    current.worker.terminate();
  }
  start.disabled = false;
  cancel.disabled = true;
  progress.removeAttribute("value");
  status.textContent = message;
  if (text) output.textContent = text;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (active || !form.reportValidity()) return;
  const runGeneration = ++generation;
  const token = crypto.randomUUID();
  const worker = new Worker("/text-gc-document-edit-worker.js", { type: "module" });
  active = {
    token,
    runGeneration,
    worker,
    timeout: setTimeout(() => {
      if (active?.runGeneration === runGeneration) {
        cleanup("Stopped: the 120 second timeout expired.");
      }
    }, TIMEOUT_MS),
  };
  start.disabled = true;
  cancel.disabled = false;
  progress.value = 0;
  output.textContent = "No result retained while work is in progress.";
  status.textContent = "Loading the frozen 10,000-edit fixture in a fresh worker.";
  const startTime = performance.now();
  worker.addEventListener("message", (event) => {
    if (!active || active.runGeneration !== runGeneration || event.data?.token !== token) return;
    if (event.data.type === "progress") {
      progress.value = event.data.value;
      status.textContent = event.data.message;
    } else if (event.data.type === "complete") {
      const elapsed = (performance.now() - startTime).toFixed(2);
      cleanup(
        `Complete in ${elapsed} ms. Exact output and structural checks passed.`,
        event.data.text,
      );
    } else if (event.data.type === "unsupported") {
      cleanup(`Unavailable in this browser: ${event.data.message}`);
    } else if (event.data.type === "error") {
      cleanup(`Stopped: ${event.data.message}`);
    }
  });
  worker.addEventListener("error", (event) => {
    if (active?.runGeneration === runGeneration) {
      cleanup(`Stopped: ${event.message || "worker failed"}`);
    }
  });
  worker.postMessage({ token, target: new FormData(form).get("target") });
});

cancel.addEventListener("click", () => {
  if (active) cleanup("Cancelled. The worker was terminated and no result was retained.");
});
addEventListener("pagehide", () => cleanup("Page closed. Active work was terminated."));

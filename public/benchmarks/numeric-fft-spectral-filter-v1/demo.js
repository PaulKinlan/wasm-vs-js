const target = document.querySelector("#target");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const progress = document.querySelector("#progress");
const result = document.querySelector("#result");
let worker = null;
let token = 0;
let timeout = 0;

function terminate() {
  clearTimeout(timeout);
  worker?.terminate();
  worker = null;
}

function reset(message) {
  terminate();
  status.textContent = message;
  start.disabled = false;
  cancel.disabled = true;
  progress.removeAttribute("value");
}

function begin() {
  token += 1;
  const runToken = token;
  terminate();
  worker = new Worker("/benchmarks/numeric-fft-spectral-filter-v1/worker.js", { type: "module" });
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Generating the frozen 2^20-sample fixture.";
  result.textContent = "No result accepted yet.";
  progress.value = 0;
  worker.onmessage = ({ data }) => {
    if (!data || data.token !== runToken || runToken !== token) return;
    if (data.type === "phase") {
      const phases = {
        fixture: [1, "Generating fixture."],
        compute: [2, "Running the complete pipeline."],
        validate: [3, "Hashing every output component."],
      };
      const phase = phases[data.phase];
      if (phase) {
        progress.value = phase[0];
        status.textContent = phase[1];
      }
      return;
    }
    if (data.type === "error") {
      token += 1;
      result.textContent = "No result accepted.";
      reset(`Run failed: ${data.message}`);
      return;
    }
    if (data.type !== "result") return;
    progress.value = 4;
    status.textContent = "Complete output matched the registered SHA-256.";
    result.textContent = JSON.stringify(data.result, null, 2);
    terminate();
    start.disabled = false;
    cancel.disabled = true;
  };
  worker.onerror = () => {
    if (runToken !== token) return;
    token += 1;
    result.textContent = "No result accepted.";
    reset("The worker stopped unexpectedly.");
  };
  worker.postMessage({ type: "start", token: runToken, target: target.value });
  timeout = setTimeout(() => {
    if (runToken !== token) return;
    token += 1;
    result.textContent = "No result accepted.";
    reset("Timed out after 120 seconds; the worker was terminated.");
  }, 120000);
}

start.addEventListener("click", begin);
cancel.addEventListener("click", () => {
  token += 1;
  result.textContent = "No result accepted.";
  reset("Cancelled. Late messages from the terminated worker are ignored.");
});
self.addEventListener("pagehide", () => {
  token += 1;
  terminate();
});
start.disabled = false;

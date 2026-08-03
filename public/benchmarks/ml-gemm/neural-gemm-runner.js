// Neural GEMM demo main-thread controller.
// Manages a fresh module worker with Start/Cancel/hard timeout/stale-token cleanup.
const form = document.getElementById("neural-form");
const startBtn = document.getElementById("start-btn");
const cancelBtn = document.getElementById("cancel-btn");
const progress = document.getElementById("run-progress");
const phaseLog = document.getElementById("phase-log");
const resultSection = document.getElementById("result-section");
const resultContent = document.getElementById("result-content");
const TIMEOUT_MS = 120_000;

let worker = null;
let token = 0;
let timeoutId = null;

function addPhase(msg) {
  const li = document.createElement("li");
  li.textContent = msg;
  phaseLog.append(li);
}

function showResult(data) {
  resultSection.hidden = false;
  const status = data.passed ? "✓ Passed" : "✗ Failed";
  const rows = [
    ["Status", status],
    ["Output elements", data.outputElements.toLocaleString()],
    ["JS time", `${data.jsMs} ms`],
    ["Wasm time", `${data.wasmMs} ms`],
    ["JS max deviation", data.jsMaxDeviation],
    ["Wasm max deviation", data.wasmMaxDeviation],
    ["JS bound violations", data.jsBoundViolations],
    ["Wasm bound violations", data.wasmBoundViolations],
    ["Cross-target identical", data.crossTargetIdentical ? "Yes" : "No"],
    ["Wasm artifact", `${data.wasmBytes} bytes`],
  ];
  if (data.layers) rows.splice(1, 0, ["Layers", data.layers]);
  resultContent.innerHTML = "";
  const dl = document.createElement("dl");
  dl.className = "result-facts";
  for (const [dt, dd] of rows) {
    const dtEl = document.createElement("dt");
    dtEl.textContent = dt;
    const ddEl = document.createElement("dd");
    ddEl.textContent = dd;
    dl.append(dtEl, ddEl);
  }
  resultContent.append(dl);
  const note = document.createElement("p");
  note.className = "notice";
  note.textContent =
    "Exploratory result. Not uploaded, not stored, not part of the accepted corpus.";
  resultContent.append(note);
}

function cleanup() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (worker) {
    worker.terminate();
    worker = null;
  }
  startBtn.disabled = false;
  cancelBtn.hidden = true;
  progress.value = 0;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (worker) return;
  phaseLog.innerHTML = "";
  resultSection.hidden = true;
  startBtn.disabled = true;
  cancelBtn.hidden = false;
  progress.value = 0.1;
  token++;
  const runToken = token;
  const mode = document.getElementById("mode-select").value;

  worker = new Worker("/benchmarks/ml-gemm/neural-gemm-worker.js", { type: "module" });

  timeoutId = setTimeout(() => {
    addPhase("Hard timeout — terminating worker.");
    cleanup();
  }, TIMEOUT_MS);

  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.token !== runToken) return; // stale
    if (msg.type === "phase") {
      addPhase(msg.message);
      progress.value = Math.min(0.9, progress.value + 0.1);
    } else if (msg.type === "result") {
      progress.value = 1;
      showResult(msg);
    } else if (msg.type === "done") {
      addPhase("Complete.");
      cleanup();
    } else if (msg.type === "error") {
      addPhase(`Error: ${msg.detail}`);
      cleanup();
    }
  };
  worker.onerror = (e) => {
    addPhase(`Worker error: ${e.message || e}`);
    cleanup();
  };

  worker.postMessage({ type: "run", token: runToken, mode });
});

cancelBtn.addEventListener("click", () => {
  if (worker) worker.postMessage({ type: "cancel" });
  addPhase("Cancelled.");
  cleanup();
});

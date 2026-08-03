const form = document.getElementById("neural-form");
const startBtn = document.getElementById("start-btn");
const cancelBtn = document.getElementById("cancel-btn");
const progress = document.getElementById("run-progress");
const phaseLog = document.getElementById("phase-log");
const resultSection = document.getElementById("result-section");
const resultContent = document.getElementById("result-content");
const TIMEOUT_MS = 120_000;
let worker = null, token = 0, timeoutId = null;

function addPhase(msg) {
  const li = document.createElement("li");
  li.textContent = msg;
  phaseLog.append(li);
}

function cleanup() {
  token++; // invalidate any stale messages
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
}

function showResult(data) {
  resultSection.hidden = false;
  const status = data.passed ? "✓ Passed" : "✗ Failed";
  const rows = [["Status", status], [
    "Output elements",
    (data.outputElements || 0).toLocaleString(),
  ]];
  if (data.layers) rows.push(["Layers", data.layers]);
  if (data.js) {
    rows.push(["JS time", `${data.js.ms} ms`], ["JS max deviation", data.js.maxDeviation], [
      "JS bound violations",
      data.js.boundViolations,
    ]);
  }
  if (data.wasm) {
    rows.push(["Wasm time", `${data.wasm.ms} ms`], ["Wasm max deviation", data.wasm.maxDeviation], [
      "Wasm bound violations",
      data.wasm.boundViolations,
    ]);
  }
  if (data.crossTargetIdentical !== undefined) {
    rows.push(["Cross-target identical", data.crossTargetIdentical ? "Yes" : "No"]);
  }
  if (data.wasmBytes) rows.push(["Wasm artifact", `${data.wasmBytes} bytes`]);
  resultContent.innerHTML = "";
  const dl = document.createElement("dl");
  dl.className = "result-facts";
  for (const [dt, dd] of rows) {
    const d = document.createElement("dt");
    d.textContent = dt;
    const v = document.createElement("dd");
    v.textContent = dd;
    dl.append(d, v);
  }
  resultContent.append(dl);
  const note = document.createElement("p");
  note.className = "notice";
  note.textContent =
    "Exploratory result. Not uploaded, not stored, not part of the accepted corpus.";
  resultContent.append(note);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (worker) return;
  phaseLog.innerHTML = "";
  resultSection.hidden = true;
  startBtn.disabled = true;
  cancelBtn.hidden = false;
  const runToken = ++token;
  const target = document.getElementById("target-select").value;
  const mode = document.getElementById("mode-select").value;
  progress.value = 0.1;

  worker = new Worker("/benchmarks/ml-dense-mlp/neural-mlp-worker.js", { type: "module" });
  timeoutId = setTimeout(() => {
    addPhase("Hard timeout — terminating.");
    cleanup();
  }, TIMEOUT_MS);

  worker.onmessage = (ev) => {
    const msg = ev.data;
    if (msg.token !== runToken || msg.token !== token) return; // stale
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
  worker.onerror = (er) => {
    addPhase(`Worker error: ${er.message || er}`);
    cleanup();
  };
  worker.postMessage({ type: "run", token: runToken, target, mode });
});

cancelBtn.addEventListener("click", () => {
  if (worker) worker.postMessage({ type: "cancel" });
  addPhase("Cancelled.");
  cleanup();
});

self.addEventListener("pagehide", () => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
});

const form = document.querySelector("form");
const target = document.querySelector("#az-target");
const mode = document.querySelector("#az-mode");
const start = document.querySelector("#az-start");
const cancel = document.querySelector("#az-cancel");
const status = document.querySelector("#az-status");
const output = document.querySelector("#az-output");
let worker = null;
let token = 0;
let timeout = null;

function cleanup() {
  token++;
  if (timeout !== null) clearTimeout(timeout);
  timeout = null;
  worker?.terminate();
  worker = null;
  start.disabled = false;
  cancel.disabled = true;
}
function cancelRun(message = "Cancelled.") {
  cleanup();
  status.textContent = message;
  output.textContent = "No retained result.";
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token;
  const currentMode = mode.value;
  const isFull = currentMode === "full";
  const timeoutMs = isFull ? 30_000 : 10_000;
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = isFull
    ? "Running the complete 10,000-entry exact contract…"
    : "Running the reduced 1,000-entry demo…";
  output.textContent = "Waiting for the worker.";
  const current = new Worker("/archive-zip-worker.js", { type: "module" });
  worker = current;
  timeout = setTimeout(
    () => cancelRun(`Stopped after the ${timeoutMs / 1_000} second bound.`),
    timeoutMs,
  );
  current.addEventListener("message", (message) => {
    if (current !== worker || runToken !== token || message.data?.token !== runToken) return;
    if (message.data.type === "error") {
      const detail = message.data.message;
      cleanup();
      status.textContent = "Validation failed.";
      output.textContent = detail;
      return;
    }
    if (message.data.type !== "complete") return;
    const result = message.data;
    cleanup();
    status.textContent = result.mode === "full"
      ? "Complete exact validation passed."
      : "Bounded structural validation passed.";
    output.textContent =
      `Mode: ${result.mode}\nTarget: ${result.target}\nEntries: ${result.entryCount}\nArchive SHA-256: ${result.hashes.archiveSha256}\nListing SHA-256: ${result.hashes.listingSha256}\nExtracted SHA-256: ${result.hashes.extractedSha256}\nCounters: ${
        JSON.stringify(result.counters, null, 2)
      }`;
  });
  current.addEventListener("error", (event) => {
    if (current !== worker || runToken !== token) return;
    cleanup();
    status.textContent = "Worker failed.";
    output.textContent = event.message;
  });
  current.postMessage({ token: runToken, target: target.value, mode: currentMode });
});
cancel.addEventListener("click", () => cancelRun());
addEventListener("pagehide", () => cleanup());

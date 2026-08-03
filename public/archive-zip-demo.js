const form = document.querySelector("form");
const target = document.querySelector("#target");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const output = document.querySelector("#output");
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
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Running the complete 10,000-entry exact contract…";
  output.textContent = "Waiting for the worker.";
  const current = new Worker("/archive-zip-worker.js", { type: "module" });
  worker = current;
  timeout = setTimeout(() => cancelRun("Stopped after the 30 second bound."), 30_000);
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
    status.textContent = "Complete exact validation passed.";
    output.textContent =
      `Target: ${result.target}\nArchive SHA-256: ${result.hashes.archiveSha256}\nListing SHA-256: ${result.hashes.listingSha256}\nExtracted SHA-256: ${result.hashes.extractedSha256}\nCounters: ${
        JSON.stringify(result.counters, null, 2)
      }`;
  });
  current.addEventListener("error", (event) => {
    if (current !== worker || runToken !== token) return;
    cleanup();
    status.textContent = "Worker failed.";
    output.textContent = event.message;
  });
  current.postMessage({ token: runToken, target: target.value });
});
cancel.addEventListener("click", () => cancelRun());
addEventListener("pagehide", () => cleanup());

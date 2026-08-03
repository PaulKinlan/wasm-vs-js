const form = document.querySelector("#controls");
const target = document.querySelector("#target");
const page = document.querySelector("#page");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
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
function finish(message) {
  cleanup();
  status.textContent = message;
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token;
  worker = new Worker("/benchmarks/document-pdf-viewer-v1/worker.js", { type: "module" });
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Parsing 100 pages and rasterizing five complete pages…";
  result.textContent = "Running.";
  const ownedWorker = worker;
  ownedWorker.addEventListener("message", (event) => {
    if (worker !== ownedWorker || runToken !== token || event.data.token !== runToken) return;
    if (!event.data.ok) {
      result.textContent = event.data.error;
      finish("Failed.");
      return;
    }
    const selected = Number(page.value);
    const selectedHash = event.data.result.pageHashes.find((entry) => entry.page === selected);
    result.textContent = [
      `Target: ${event.data.result.target}`,
      `Pages parsed: ${event.data.result.pageCount}`,
      `Search hit pages: ${event.data.result.hits.join(", ")}`,
      `Complete extracted-text SHA-256: ${event.data.result.textSha256}`,
      `Selected page ${selected} RGBA SHA-256: ${selectedHash.sha256}`,
      `All five raster hashes: ${JSON.stringify(event.data.result.pageHashes, null, 2)}`,
      `Counters: ${JSON.stringify(event.data.result.counters, null, 2)}`,
    ].join("\n");
    finish("Complete.");
  });
  ownedWorker.addEventListener("error", (event) => {
    if (worker !== ownedWorker || runToken !== token) return;
    result.textContent = event.message || "Worker error";
    finish("Failed.");
  });
  ownedWorker.postMessage({ token: runToken, target: target.value });
  timeout = setTimeout(() => {
    if (worker !== ownedWorker || runToken !== token) return;
    result.textContent = "The fixed 60 second timeout stopped the worker.";
    finish("Timed out.");
  }, 60_000);
});
cancel.addEventListener("click", () => {
  if (!worker) return;
  cleanup();
  result.textContent = "The owned worker was terminated. No partial result was retained.";
  status.textContent = "Cancelled.";
});
addEventListener("pagehide", cleanup);

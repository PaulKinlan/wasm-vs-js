const form = document.querySelector("#kws-contract-form");
const files = document.querySelector("#kws-files");
const target = document.querySelector("#kws-target");
const mode = document.querySelector("#kws-mode");
const start = document.querySelector("#kws-start");
const cancel = document.querySelector("#kws-cancel");
const status = document.querySelector("#kws-status");
const progress = document.querySelector("#kws-progress");
const result = document.querySelector("#kws-result");
let worker = null;
let token = 0;
let timer = 0;
function cleanup() {
  token += 1;
  if (worker) worker.terminate();
  worker = null;
  clearTimeout(timer);
  timer = 0;
  start.disabled = false;
  const bundled = document.querySelector("#kws-start-bundled");
  if (bundled) bundled.disabled = false;
  cancel.disabled = true;
}
function stop(message) {
  cleanup();
  status.textContent = message;
}
const startBundled = document.querySelector("#kws-start-bundled");
async function beginRun(useBundled) {
  cleanup();
  const runToken = token;
  status.textContent = useBundled
    ? "Loading and validating the bundled pinned fixture…"
    : "Reading and validating the prescribed local files…";
  progress.value = 0;
  result.textContent = "No result yet.";
  start.disabled = true;
  if (startBundled) startBundled.disabled = true;
  cancel.disabled = false;
  const transferred = [];
  if (!useBundled) {
    const selected = [...files.files].map((file) => ({
      path: file.webkitRelativePath || file.name,
      name: file.name,
      bytes: file.arrayBuffer(),
    }));
    for (const entry of selected) {
      const bytes = await entry.bytes;
      transferred.push({ path: entry.path, name: entry.name, bytes });
    }
  }
  if (runToken !== token) return;
  worker = new Worker("/base-ml-keyword-spotting-worker.js", { type: "module" });
  worker.addEventListener("message", (message) => {
    if (runToken !== token || message.data.token !== runToken) return;
    if (message.data.type === "progress") {
      progress.value = message.data.hops;
      status.textContent = `${message.data.phase}: ${message.data.hops} of 3000 hops`;
      return;
    }
    if (message.data.type === "complete") {
      result.textContent = JSON.stringify(message.data.result, null, 2);
      progress.value = 3000;
      stop("Complete. Exact tensors, detections, and work counters validated.");
      return;
    }
    if (message.data.type === "error") {
      result.textContent = message.data.message;
      stop("Run failed.");
    }
  });
  worker.addEventListener("error", (event) => {
    if (runToken !== token) return;
    result.textContent = event.message;
    stop("Worker failed.");
  });
  worker.postMessage({
    token: runToken,
    target: target.value,
    mode: mode.value,
    files: transferred,
  }, transferred.map((entry) => entry.bytes));
  timer = setTimeout(() => {
    if (runToken === token) {
      result.textContent = "The bounded 120 second worker deadline expired.";
      stop("Timed out.");
    }
  }, 120000);
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (files.files.length === 0) return;
  beginRun(false);
});
if (startBundled) {
  startBundled.addEventListener("click", () => beginRun(true));
}
cancel.addEventListener("click", () => stop("Cancelled. The worker was terminated."));
self.addEventListener("pagehide", cleanup);

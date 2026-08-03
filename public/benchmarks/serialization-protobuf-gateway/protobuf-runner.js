const form = document.querySelector("form");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const output = document.querySelector("#output");
let worker = null, timer = 0, token = 0;
function cleanup() {
  if (worker) worker.terminate();
  worker = null;
  clearTimeout(timer);
  timer = 0;
  start.disabled = false;
  cancel.disabled = true;
}
function stop(message) {
  token++;
  cleanup();
  status.textContent = message;
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = ++token;
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Running exactly 10,000 messages…";
  output.textContent = "No result yet.";
  const owned = new Worker("/benchmarks/serialization-protobuf-gateway/protobuf-worker.js", {
    type: "module",
  });
  worker = owned;
  owned.onmessage = ({ data }) => {
    if (owned !== worker || data.token !== runToken || token !== runToken) return;
    if (data.type === "error") {
      stop(`Failed: ${data.message}`);
      return;
    }
    output.textContent = JSON.stringify(data.result, null, 2);
    cleanup();
    status.textContent = "Complete. Correctness evidence only; no performance claim.";
  };
  owned.onerror = () => {
    if (owned === worker && token === runToken) stop("Worker failed.");
  };
  timer = setTimeout(() => {
    if (owned === worker && token === runToken) stop("Stopped after the 120 second bound.");
  }, 120000);
  owned.postMessage({
    token: runToken,
    target: form.elements.target.value,
    mode: form.elements.mode.value,
  });
});
cancel.addEventListener("click", () => stop("Cancelled. No result retained."));
addEventListener("pagehide", () => {
  token++;
  cleanup();
});

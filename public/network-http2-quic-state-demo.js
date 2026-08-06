const form = document.querySelector("#demo-form");
const start = document.querySelector("#h2q-start");
const cancel = document.querySelector("#h2q-cancel");
const status = document.querySelector("#h2q-status");
const result = document.querySelector("#result");
let worker = null;
let token = 0;
let timer = 0;

function cleanup(message) {
  token++;
  if (worker) worker.terminate();
  worker = null;
  clearTimeout(timer);
  start.disabled = false;
  cancel.disabled = true;
  if (message) status.textContent = message;
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cleanup();
  const runToken = token;
  worker = new Worker("/network-http2-quic-state-worker.js", { type: "module" });
  start.disabled = true;
  cancel.disabled = false;
  status.textContent = "Running fixed trace…";
  worker.onmessage = ({ data }) => {
    if (runToken !== token || data.token !== runToken) return;
    if (!data.ok) {
      result.textContent = data.error;
      cleanup("Failed.");
      return;
    }
    result.textContent = `Target: ${data.target}\nState SHA-256: ${data.sha256}\nErrors: ${
      data.state[31]
    }\nEvents: ${data.state[30]}\n\nComplete state vector:\n${JSON.stringify(data.state, null, 2)}`;
    cleanup("Complete.");
  };
  worker.onerror = () => {
    if (runToken === token) cleanup("Worker failed.");
  };
  worker.postMessage({ token: runToken, target: document.querySelector("#h2q-target").value });
  timer = setTimeout(() => cleanup("Stopped after the 10 second limit."), 10_000);
});
cancel.addEventListener("click", () => cleanup("Cancelled."));
addEventListener("pagehide", () => cleanup());

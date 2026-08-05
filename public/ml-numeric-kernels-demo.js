const form = document.querySelector("form[data-worker]");
const start = document.querySelector("#nlk-start");
const cancel = document.querySelector("#nlk-cancel");
const status = document.querySelector("#nlk-status");
const output = document.querySelector("#nlk-output");
const TIMEOUT_MS = 20_000;
let active = null;
let generation = 0;
function cleanup(message, text = "") {
  generation += 1;
  if (active) {
    clearTimeout(active.timeout);
    active.worker.terminate();
    active = null;
  }
  start.disabled = false;
  cancel.disabled = true;
  status.textContent = message;
  if (text) output.textContent = text;
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (active || !form.reportValidity()) return;
  const token = ++generation;
  const worker = new Worker(form.dataset.worker, { type: "module" });
  active = {
    token,
    worker,
    timeout: setTimeout(() => {
      if (active?.token === token) cleanup("Stopped: 20 second timeout.");
    }, TIMEOUT_MS),
  };
  start.disabled = true;
  cancel.disabled = false;
  output.textContent = "";
  status.textContent = "Running in a fresh worker.";
  worker.addEventListener("message", ({ data }) => {
    if (!active || data?.token !== active.token || data.token !== generation) return;
    if (data.type === "complete") cleanup("Complete.", data.text);
    else if (data.type === "error") cleanup(`Stopped: ${data.message}`);
  });
  worker.addEventListener("error", (error) => {
    if (active?.token === token) cleanup(`Stopped: ${error.message || "worker failed"}`);
  });
  worker.postMessage({ token, values: Object.fromEntries(new FormData(form)) });
});
cancel.addEventListener("click", () => cleanup("Cancelled. No result was retained."));
addEventListener("pagehide", () => cleanup("Stopped because the page was hidden."));

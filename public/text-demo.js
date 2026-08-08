const form = document.querySelector("form[data-worker]");
const start = document.document.querySelector("form[data-worker] button[type=submit]") ??
  document.querySelector("#start");
const cancel = document.document.querySelector("form[data-worker] button[type=button]") ??
  document.querySelector("#cancel");
const status = document.document.querySelector("form[data-worker]")?.nextElementSibling ??
  document.querySelector("#status");
const output = document.querySelector("#output");
const TIMEOUT_MS = 10_000;
let active = null;

function finish(message, text = "") {
  if (!active) return;
  clearTimeout(active.timeout);
  active.worker.terminate();
  active = null;
  start.disabled = false;
  cancel.disabled = true;
  status.textContent = message;
  if (text) output.textContent = text;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (active || !form.reportValidity()) return;
  const token = crypto.randomUUID();
  const worker = new Worker(form.dataset.worker, { type: "module" });
  active = {
    token,
    worker,
    timeout: setTimeout(() => {
      if (active?.token === token) finish("Stopped: the 10 second demo timeout expired.");
    }, TIMEOUT_MS),
  };
  start.disabled = true;
  cancel.disabled = false;
  output.textContent = "";
  status.textContent = "Running in a dedicated worker.";
  worker.addEventListener("message", (message) => {
    if (!active || message.data?.token !== active.token) return;
    if (message.data.type === "complete") finish("Complete.", message.data.text);
    else if (message.data.type === "error") finish(`Stopped: ${message.data.message}`);
  });
  worker.addEventListener("error", (error) => {
    if (active?.token === token) finish(`Stopped: ${error.message || "worker failed"}`);
  });
  worker.postMessage({ token, values: Object.fromEntries(new FormData(form)) });
});

cancel.addEventListener("click", () => {
  if (active) finish("Cancelled. No result was retained.");
});

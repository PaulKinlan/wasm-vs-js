const form = document.querySelector("form[data-worker]");
const start = document.document.querySelector("form[data-worker] button[type=submit]") ??
  document.querySelector("#start");
const cancel = document.document.querySelector("form[data-worker] button[type=button]") ??
  document.querySelector("#cancel");
const status = document.document.querySelector("form[data-worker]")?.nextElementSibling ??
  document.querySelector("#status");
const output = document.querySelector("#output");
const progress = document.querySelector("#progress");
const TIMEOUT_MS = 180_000;
let generation = 0;
let active = null;

function cleanup(message, text = "") {
  generation++;
  if (active) {
    clearTimeout(active.timeout);
    active.worker.terminate();
    active = null;
  }
  start.disabled = false;
  cancel.disabled = true;
  progress.removeAttribute("value");
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
      if (active?.token === token) cleanup("Stopped: the 180 second limit expired.");
    }, TIMEOUT_MS),
  };
  start.disabled = true;
  cancel.disabled = false;
  output.textContent = "";
  progress.value = 0;
  status.textContent = "Generating the registered fixture in a fresh worker.";
  const startTime = performance.now();
  worker.addEventListener("message", ({ data }) => {
    if (!active || data?.token !== token || token !== generation) return;
    if (data.type === "progress") {
      progress.value = data.value;
      status.textContent = data.message;
    } else if (data.type === "complete") {
      const elapsed = (performance.now() - startTime).toFixed(2);
      cleanup(`Complete in ${elapsed} ms.`, data.text);
    } else if (data.type === "error") cleanup(`Stopped: ${data.message}`);
  });
  worker.addEventListener("error", (error) => {
    if (active?.token === token && token === generation) {
      cleanup(`Stopped: ${error.message || "worker failed"}`);
    }
  });
  worker.postMessage({ token, values: Object.fromEntries(new FormData(form)) });
});

cancel.addEventListener("click", () => {
  if (active) cleanup("Cancelled. No result was retained.");
});
addEventListener("pagehide", () => cleanup("Stopped because the page was hidden."));

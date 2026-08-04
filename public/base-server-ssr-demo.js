const form = document.querySelector("form[data-worker]");
const start = document.querySelector("#start");
const cancel = document.querySelector("#cancel");
const status = document.querySelector("#status");
const output = document.querySelector("#output");
const TIMEOUT_MS = 120_000;
let sequence = 0;
let active = null;

function cleanup(run, message, text = "") {
  if (!run || active !== run) return;
  clearTimeout(run.timeout);
  run.worker.terminate();
  active = null;
  start.disabled = false;
  cancel.disabled = true;
  status.textContent = message;
  if (text) output.textContent = text;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (active || !form.reportValidity()) return;
  const token = ++sequence;
  const worker = new Worker(form.dataset.worker, { type: "module" });
  const run = { token, worker, timeout: 0 };
  const startTime = performance.now();
  run.timeout = setTimeout(() => {
    if (active === run) cleanup(run, "Stopped: the 120 second exact-run timeout expired.");
  }, TIMEOUT_MS);
  active = run;
  start.disabled = true;
  cancel.disabled = false;
  output.textContent = "";
  status.textContent = "Running the exact 1,000-response contract in a fresh worker.";
  worker.addEventListener("message", (event) => {
    if (active !== run || event.data?.token !== token) return;
    if (event.data.type === "complete") {
      const elapsed = (performance.now() - startTime).toFixed(2);
      cleanup(run, `Complete in ${elapsed} ms.`, event.data.text);
    } else if (event.data.type === "error") cleanup(run, `Stopped: ${event.data.message}`);
  });
  worker.addEventListener("error", (event) => {
    if (active === run) cleanup(run, `Stopped: ${event.message || "worker failed"}`);
  });
  worker.postMessage({ token, target: new FormData(form).get("target") });
});

cancel.addEventListener("click", () => {
  if (active) cleanup(active, "Cancelled. No result was retained.", "Cancelled.");
});

addEventListener("pagehide", () => {
  if (active) {
    clearTimeout(active.timeout);
    active.worker.terminate();
    active = null;
  }
  sequence++;
});
